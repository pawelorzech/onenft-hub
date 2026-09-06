/**
 * Mint announcer: one post on X for every new token in every collection.
 *
 * Every ANNOUNCE_EVERY_MS it pages /api/mints from a durable contract-scoped
 * cursor. First boot seeds the current head; later restarts recover backlog.
 * Text, signed Farcaster bytes and per-channel delivery state are persisted
 * before sending. Ambiguous X requests require operator reconciliation.
 * ANNOUNCE_STATE_FILE on a durable volume is required for live delivery.
 * Run exactly one worker; see docs/ANNOUNCER_OPERATIONS.md.
 *
 * Posting needs an X app with write access and four keys in the env:
 * X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (OAuth 1.0a user
 * context, signed here with node:crypto, no dependency). The same post goes
 * out as a cast on Farcaster when FC_FID and FC_SIGNER_KEY are set
 * (`farcaster.ts`). Without either the announcer stays off. ANNOUNCE_DRY_RUN=1
 * logs the posts instead of sending.
 */
import { createHmac, randomBytes } from "node:crypto";
import { COLLECTIONS, type Collection } from "./collections.ts";
import { baseOf, count, address, ensName, stateWord, ownUrl } from "./state.ts";
import { llmPost, llmStatus, type Brief } from "./llm.ts";
import { fcFromEnv, castText, buildCast, submitCastBytes, type Fc } from "./farcaster.ts";
import { DeliveryQueue, DefiniteSendError, atomicJson, type Channel } from "./delivery.ts";

export type Mint = {
  slug: string;
  /** "knot:12" or "faces:5": one key per token, ever. */
  key: string;
  id: number;
  text: string;
  image: string;
  /** What the language model gets when one is configured. */
  brief: Brief;
};

type Keys = { apiKey: string; apiSecret: string; token: string; tokenSecret: string };

export function keysFromEnv(env: Record<string, string | undefined> = process.env): Keys | null {
  const apiKey = env.X_API_KEY, apiSecret = env.X_API_SECRET, token = env.X_ACCESS_TOKEN, tokenSecret = env.X_ACCESS_SECRET;
  return apiKey && apiSecret && token && tokenSecret ? { apiKey, apiSecret, token, tokenSecret } : null;
}

// ---- what to say
//
// Every post says what happened, what the collection is, how to take part,
// and ends with the link and a few tags. Plain words, no adverbs. X counts
// any link as 23 characters; `fit` drops tags from the end until a post fits.

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** The tags of a collection, most specific first, the shared ones last. */
export const TAGS: Record<string, string[]> = {
  knot: ["#generativeart", "#Truchet", "#onchain", "#Base", "#NFT", "#CC0"],
  blit: ["#Blitmap", "#pixelart", "#onchain", "#Base", "#NFT", "#CC0"],
  chainrun: ["#ChainRunners", "#pixelart", "#onchain", "#Base", "#NFT", "#CC0"],
  faces: ["#pixelart", "#PFP", "#onchain", "#Base", "#NFT", "#CC0"],
};
/** One line on how to take part, per kind. */
const HOW: Record<Collection["kind"], string> = {
  daily: "Free to claim, gas only. One a day, first wallet wins.",
  rolls: "No fee unless you pin, gas only. Rare and legendary come from luck alone.",
  coins: "The mint price is the backing, nothing on top. Burn to redeem after 30 days. It can lose you money.",
};
/** The collections the announcer speaks about: a preview site is shown on the hub but never announced. */
export const ANNOUNCED: Collection[] = COLLECTIONS.filter((c) => !c.preview && c.announce !== false);

export const X_LIMIT = 280;
/** Length as X counts it: every link is 23, the rest by code point. */
export function xLength(text: string): number {
  return [...text.replace(/https?:\/\/\S+/g, "x".repeat(23))].length;
}
/** Lines, then the link, then the tags. Drops tags from the end, then lines from the end, until it fits; the first line and the link stay. */
export function fit(lines: string[], url: string, tags: string[]): string {
  const ls = lines.filter(Boolean);
  for (let n = ls.length; n >= 1; n--) {
    const body = ls.slice(0, n).join("\n");
    for (let t = tags.length; t >= 0; t--) {
      const text = t ? `${body}\n${url}\n${tags.slice(0, t).join(" ")}` : `${body}\n${url}`;
      if (xLength(text) <= X_LIMIT) return text;
    }
  }
  return `${ls[0] ?? ""}\n${url}`;
}

/** "pawelorzech.eth" when the site resolved a name, else "0x84Cf…76Df". */
export function who(name: unknown, addr: unknown): string | null {
  const n = ensName(name);
  if (n) return n;
  const a = address(addr);
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : null;
}

/** Today's token of a daily collection as a mint, or null when the day is still free or the answer does not fit. */
export function dailyMint(c: Collection, j: unknown): Mint | null {
  if (!isObj(j)) return null;
  const day = count(j.day);
  const state = stateWord(j.state);
  if (day === null || (state !== "taken" && state !== "author")) return null;
  const owner = who(j.ownerName, j.owner);
  if (!owner) return null;
  const palette = isObj(j.traits) && typeof j.traits.palette === "string" ? j.traits.palette : null;
  const first = state === "author" ? `Day ${day} of ${c.name} went to the author.` : `Day ${day} of ${c.name} is claimed by ${owner}.`;
  const what = `${c.line}${palette ? ` Today's palette: ${palette}.` : ""}`;
  const url = `https://${c.host}/day/${day}`;
  const tags = TAGS[c.slug] ?? [];
  const text = fit([first, what, "Tomorrow at 00:00 UTC a new one appears. " + HOW.daily], url, tags);
  const facts = [first, c.line, c.source, palette ? `Palette of the day: ${palette}.` : "", `Day ${day} is the token id. A day nobody claims stays empty forever.`, HOW.daily, "Tomorrow at 00:00 UTC a new one appears."].filter(Boolean).join("\n");
  return { slug: c.slug, key: `${c.slug}:${day}`, id: day, text, image: `https://${c.host}/day/${day}-1024.png`, brief: { facts, angle: "a mint just happened; say who took the day and invite the reader to come for tomorrow's", url, tags, reference: text } };
}

/** Every face in the recent list of a rolls collection, oldest first. */
export function rollMints(c: Collection, j: unknown): Mint[] {
  if (!isObj(j) || !Array.isArray(j.recent)) return [];
  const out: Mint[] = [];
  for (const f of j.recent) {
    if (!isObj(f)) continue;
    const id = count(f.id);
    if (id === null) continue;
    const roll = isObj(f.roll) ? f.roll : {};
    const treasury = roll.treasury === true || f.treasury === true;
    const owner = who(f.ownerName ?? roll.ownerName, f.owner ?? roll.owner ?? roll.roller);
    const rarity = typeof f.rarity === "string" ? f.rarity : null;
    const one = typeof f.oneOfOne === "string" && f.oneOfOne ? f.oneOfOne : null;
    const pins = isObj(f.pins) ? Object.keys(f.pins).length : 0;
    const first = treasury ? `Face #${id} was rolled for the author.` : owner ? `Face #${id} was rolled by ${owner}.` : `Face #${id} was rolled.`;
    const detail = one ? `A one of one: ${one}. It exists once and never again.` : rarity ? `Rarity: ${rarity}.` : "";
    const url = `https://${c.host}/face/${id}`;
    const tags = TAGS[c.slug] ?? [];
    const text = fit([first, detail, `${c.line} Pin the traits you want or leave it all to luck. ${HOW.rolls}`], url, tags);
    const facts = [first, detail, pins ? `${pins} ${pins === 1 ? "trait was" : "traits were"} pinned by the roller, the rest came from luck.` : "No pins, luck decided every trait.", c.line, c.source, HOW.rolls].filter(Boolean).join("\n");
    out.push({ slug: c.slug, key: `${c.slug}:${id}`, id, text, image: ownUrl(f.png, c.host) ?? `https://${c.host}/face/${id}-1024.png`, brief: { facts, angle: "a face was just rolled; say what came out and invite the reader to roll their own today", url, tags, reference: text } });
  }
  return out.sort((a, b) => a.id - b.id);
}

/** ONE has coins, backing and VRF; Faces copy and routes do not apply. */
export function coinMints(c: Collection, j: unknown): Mint[] {
  if (!isObj(j) || !Array.isArray(j.recent)) return [];
  const out: Mint[] = [];
  for (const coin of j.recent) {
    if (!isObj(coin)) continue;
    const id = count(coin.id);
    if (id === null) continue;
    const url = `https://${c.host}/coin/${id}`;
    const tags = ["#onchain", "#Base", "#NFT"];
    const first = `Coin #${id} was minted${coin.sealed === true ? " and awaits reveal" : ""}. ONE can lose you money.`;
    const text = fit([first, c.line], url, tags);
    out.push({ slug: c.slug, key: `${c.slug}:${id}`, id, text,
      image: ownUrl(coin.png, c.host) ?? `https://${c.host}/coin/${id}-1024.png`,
      brief: { facts: [first, c.line, c.source].join("\n"), angle: "a coin was minted; keep the warning that ONE can lose money", url, tags, reference: text, requiredText: "ONE can lose you money." } });
  }
  return out.sort((a, b) => a.id - b.id);
}

/** A number with thousands separators, English style. */
const num = (n: number) => n.toLocaleString("en-US");

/** The three angles of the day, by slot: morning, midday, evening. */
export const ANGLES = [
  "morning: what is open right now and how to take part",
  "midday: how the thing works, one detail a curious reader would like, then the invitation",
  "evening: last hours of the UTC day; what is still free or what is coming at midnight",
];

/**
 * The template and the facts for a promo about one collection. For a daily
 * collection: the free day and the hours left, or that today is gone and
 * tomorrow's is coming. For rolls: the count and the pool. Null when the
 * answer does not fit.
 */
export function promoBrief(c: Collection, j: unknown, slot = 0, now = Date.now()): { text: string; brief: Brief } | null {
  if (!isObj(j)) return null;
  const tags = TAGS[c.slug] ?? [];
  const angle = ANGLES[slot] ?? ANGLES[0]!;
  if (c.kind === "coins") {
    const url = `https://${c.host}`;
    const warning = "ONE can lose you money.";
    const text = fit([warning, c.line], url, ["#onchain", "#Base", "#NFT"]);
    return { text, brief: { facts: [warning, c.line, c.source].join("\n"), angle, url, tags: ["#onchain", "#Base", "#NFT"], reference: text, requiredText: warning } };
  }
  if (c.kind === "rolls") {
    const rolled = count(j.totalSupply), max = count(j.maxSupply) ?? 10000, pool = count(j.poolLeft);
    if (rolled === null) return null;
    const first = `${c.name}: ${num(rolled)} of ${num(max)} faces rolled${pool !== null ? `, ${num(pool)} one of ones still in the pool` : ""}.`;
    const url = `https://${c.host}`;
    const text = fit([first, `${c.line} Pin the traits you want or leave it all to luck. ${HOW.rolls}`], url, tags);
    const facts = [first, c.line, c.source, "Any roll may take a one of one from the pool; each exists once.", "Seven pixel layers and five colours; rarity is the rarest part.", HOW.rolls].join("\n");
    return { text, brief: { facts, angle, url, tags, reference: text } };
  }
  const day = count(j.day);
  const state = stateWord(j.state);
  if (day === null || state === null) return null;
  const startsAt = count(j.startsAt);
  const left = startsAt !== null ? Math.max(0, startsAt + 86400 - Math.floor(now / 1000)) : null;
  const hours = left !== null ? Math.floor(left / 3600) : null;
  const palette = isObj(j.traits) && typeof j.traits.palette === "string" ? j.traits.palette : null;
  const common = [c.line, c.source, "The token id is the day number. A day nobody claims stays empty forever; the gaps are part of the work.", "The image is computed on chain from the day number alone.", HOW.daily];
  if (state === "free") {
    const url = `https://${c.host}/day/${day}`;
    const first = `Day ${day} of ${c.name} is still free${palette ? `: ${palette}` : ""}.${hours !== null ? ` ${hours === 0 ? "Less than an hour" : `${hours} ${hours === 1 ? "hour" : "hours"}`} left, then it is gone for good.` : ""}`;
    const text = fit([first, `${c.line} ${HOW.daily}`], url, tags);
    return { text, brief: { facts: [first, ...common].join("\n"), angle, url, tags, reference: text } };
  }
  const url = `https://${c.host}`;
  const first = state === "author" ? `Day ${day} of ${c.name} is the author's.` : `Day ${day} of ${c.name} is taken.`;
  const text = fit([first, `${c.line} Tomorrow at 00:00 UTC a new one appears. ${HOW.daily}`], url, tags);
  const facts = [first, hours !== null ? `${hours} hours until the next day starts at 00:00 UTC.` : "", ...common].filter(Boolean).join("\n");
  return { text, brief: { facts, angle, url, tags, reference: text } };
}

/** The template alone, for tests and for the plain path. */
export function promoText(c: Collection, j: unknown, now = Date.now()): string | null {
  return promoBrief(c, j, 0, now)?.text ?? null;
}

/** Which collection gets a slot: they take turns, and one day's slots cover different collections. */
export function promoPick(date: string, slot = 0): Collection {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const n = ANNOUNCED.length;
  return ANNOUNCED[(((days * 3 + slot) % n) + n) % n]!;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6_000), headers: { accept: "application/json", "user-agent": "onenft-hub announcer" } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Every token the collections show right now. A collection that fails is skipped this round, not the others. */
export async function currentMints(): Promise<Mint[]> {
  const all = await Promise.all(ANNOUNCED.map(async (c) => {
    try {
      const base = baseOf(c);
      if (c.kind === "coins") return coinMints(c, await getJson(`${base}/api/state`));
      if (c.kind === "rolls") return rollMints(c, await getJson(`${base}/api/state`));
      const m = dailyMint(c, await getJson(`${base}/api/today`));
      return m ? [m] : [];
    } catch (e) {
      console.warn(`announce: ${c.slug} not read: ${String((e as Error)?.message ?? e)}`);
      return [];
    }
  }));
  return all.flat();
}

/**
 * The promo due now, if any: the latest slot whose hour has passed today,
 * keyed by date and slot so each goes out once. Null when no slot is due,
 * or when the read fails.
 */
export async function promoMint(hoursUtc: number[], now = Date.now()): Promise<Mint | null> {
  const d = new Date(now);
  const date = d.toISOString().slice(0, 10);
  let slot = -1;
  hoursUtc.forEach((h, i) => { if (d.getUTCHours() >= h) slot = i; });
  if (slot < 0) return null;
  const c = promoPick(date, slot);
  try {
    const j = await getJson(`${baseOf(c)}/api/${c.kind === "daily" ? "today" : "state"}`);
    const p = promoBrief(c, j, slot, now);
    return p ? { slug: c.slug, key: `promo:${date}:${slot}`, id: 0, text: p.text, image: `https://${c.host}/today.png`, brief: p.brief } : null;
  } catch (e) {
    console.warn(`announce: promo ${c.slug} not read: ${String((e as Error)?.message ?? e)}`);
    return null;
  }
}

// ---- OAuth 1.0a, the part of RFC 5849 that X needs

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * The Authorization header for one request. `params` are the query and, for
 * form bodies, the body fields; a multipart or JSON body adds nothing to the
 * signature. nonce and timestamp are arguments so a test can pin them.
 */
export function oauthHeader(k: Keys, method: string, url: string, params: Record<string, string> = {}, nonce = randomBytes(16).toString("hex"), timestamp = String(Math.floor(Date.now() / 1000))): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: k.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: k.token,
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const normalized = Object.keys(all).map((key) => [enc(key), enc(all[key]!)] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1)).map(([a, b]) => `${a}=${b}`).join("&");
  const u = new URL(url);
  const base = `${method.toUpperCase()}&${enc(`${u.protocol}//${u.host}${u.pathname}`)}&${enc(normalized)}`;
  const signature = createHmac("sha1", `${enc(k.apiSecret)}&${enc(k.tokenSecret)}`).update(base).digest("base64");
  const head: Record<string, string> = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.keys(head).sort().map((key) => `${enc(key)}="${enc(head[key]!)}"`).join(", ")}`;
}

// ---- X: two ways in
//
// OAuth 1.0a (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET): a user
// token that never expires and may upload media. OAuth 2.0 (X_CLIENT_ID,
// X_CLIENT_SECRET, X_OAUTH2_ACCESS_TOKEN, X_OAUTH2_REFRESH_TOKEN): the access
// token lives two hours and the refresh token is single use, so every refresh
// is written to X_TOKEN_FILE and the file wins over the env on the next boot.
// Media upload needs the media.write scope; a token without it posts text only.

const MEDIA_URL = "https://api.x.com/2/media/upload";
const TWEETS_URL = "https://api.x.com/2/tweets";
const OAUTH2_TOKEN_URL = "https://api.x.com/2/oauth2/token";

export type Auth = {
  kind: "oauth1" | "oauth2";
  /** The Authorization header for one request. */
  header(method: string, url: string): Promise<string>;
  /** After a 401: get a fresh token. False when there is nothing to refresh. */
  refresh(): Promise<boolean>;
  /** Whether media upload is worth trying. */
  media: boolean;
};

export function oauth1Auth(k: Keys): Auth {
  return { kind: "oauth1", media: true, header: async (m, u) => oauthHeader(k, m, u), refresh: async () => false };
}

type Oauth2State = { access: string; refresh: string; expiresAt: number };

/**
 * OAuth 2.0 user context with refresh. The state is read from the file when
 * it exists, else from the env; a token with no known expiry is refreshed
 * before its first use. Every refresh rotates the refresh token, so the file
 * is written at once; losing it means a new authorization by the account.
 */
export function oauth2Auth(clientId: string, clientSecret: string, seed: { access: string; refresh: string }, file: string | undefined, media = false): Auth {
  let state: Oauth2State | null = null;
  let loaded = false;
  async function load(): Promise<Oauth2State> {
    if (state) return state;
    if (file && !loaded) {
      loaded = true;
      try {
        const j = (await Bun.file(file).json()) as Partial<Oauth2State>;
        if (typeof j.access === "string" && typeof j.refresh === "string") state = { access: j.access, refresh: j.refresh, expiresAt: Number(j.expiresAt) || 0 };
      } catch {}
    }
    if (!state) state = { access: seed.access, refresh: seed.refresh, expiresAt: 0 };
    return state;
  }
  async function refresh(): Promise<boolean> {
    const s = await load();
    const res = await fetch(OAUTH2_TOKEN_URL, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refresh, client_id: clientId }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
    if (!res.ok || !j?.access_token) throw new Error(`oauth2 refresh ${res.status}: ${j?.error ?? ""} ${j?.error_description ?? ""}`.trim());
    state = { access: j.access_token, refresh: j.refresh_token ?? s.refresh, expiresAt: Date.now() + (Number(j.expires_in) || 7200) * 1000 };
    if (file) {
      try { await atomicJson(file, state); } catch (e) { console.warn(`announce: token file not written: ${String((e as Error)?.message ?? e)}`); }
    }
    console.log(`announce: oauth2 token refreshed, good for ${Math.round((state.expiresAt - Date.now()) / 60000)} min`);
    return true;
  }
  return {
    kind: "oauth2",
    media,
    async header() {
      const s = await load();
      // Unknown expiry, or less than five minutes left: refresh first.
      if (s.expiresAt - Date.now() < 5 * 60_000) await refresh();
      return `Bearer ${state!.access}`;
    },
    refresh,
  };
}

/** The auth the env describes: OAuth 1.0a when its four keys are complete, else OAuth 2.0 when its four are, else none. */
export function authFromEnv(env: Record<string, string | undefined> = process.env): Auth | null {
  const k = keysFromEnv(env);
  if (k) return oauth1Auth(k);
  const { X_CLIENT_ID: id, X_CLIENT_SECRET: secret, X_OAUTH2_ACCESS_TOKEN: access, X_OAUTH2_REFRESH_TOKEN: refresh } = env;
  if (id && secret && access && refresh) return oauth2Auth(id, secret, { access, refresh }, env.X_TOKEN_FILE, env.X_MEDIA === "1");
  return null;
}

async function uploadPng(auth: Auth, png: Uint8Array): Promise<string> {
  const form = new FormData();
  form.set("media", new Blob([png as BlobPart], { type: "image/png" }), "token.png");
  form.set("media_category", "tweet_image");
  const res = await fetch(MEDIA_URL, { method: "POST", headers: { authorization: await auth.header("POST", MEDIA_URL) }, body: form, signal: AbortSignal.timeout(30_000) });
  const j = (await res.json().catch(() => null)) as { data?: { id?: string }; id?: string; media_id_string?: string } | null;
  const id = j?.data?.id ?? j?.id ?? j?.media_id_string;
  if (!res.ok || !id) throw new Error(`media upload ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return id;
}

/** One post, with the picture when the auth may upload one. Returns the post id. A 401 gets one refresh and one retry. */
export async function post(auth: Auth, m: Mint): Promise<string> {
  let mediaId: string | null = null;
  if (auth.media) {
    try {
      const img = await fetch(m.image, { signal: AbortSignal.timeout(15_000) });
      if (img.ok) mediaId = await uploadPng(auth, new Uint8Array(await img.arrayBuffer()));
      else console.warn(`announce: ${m.key} image ${img.status}, posting text only`);
    } catch (e) {
      console.warn(`announce: ${m.key} image failed, posting text only: ${String((e as Error)?.message ?? e)}`);
    }
  }
  const body = JSON.stringify(mediaId ? { text: m.text, media: { media_ids: [mediaId] } } : { text: m.text });
  const send = async () => fetch(TWEETS_URL, { method: "POST", headers: { authorization: await auth.header("POST", TWEETS_URL), "content-type": "application/json" }, body, signal: AbortSignal.timeout(30_000) });
  let res = await send();
  if (res.status === 401 && (await auth.refresh().catch(() => false))) res = await send();
  const j = (await res.json().catch(() => null)) as { data?: { id?: string } } | null;
  if (!res.ok || !j?.data?.id) {
    const ErrorType = res.status >= 400 && res.status < 500 ? DefiniteSendError : Error;
    throw new ErrorType(`post ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  }
  return j.data.id;
}

// ---- the loop

export type FcStatus = { fid: number | null; posted: number; failed: number; lastError: string | null };
export type AnnouncerStatus = { llm: ReturnType<typeof llmStatus>; enabled: boolean; auth: "oauth1" | "oauth2" | null; fc: FcStatus; dryRun: boolean; seeded: boolean; seen: number; posted: number; failed: number; lastPostAt: string | null; lastError: string | null };

/** Which of `now` are new, given what was seen. Pure, so the test can drive it. */
export function fresh(now: Mint[], seen: Set<string>): Mint[] {
  return now.filter((m) => !seen.has(m.key));
}

/** UTC hour after which the daily note goes out; -1 turns it off. */
/** UTC hours at which the promos go out, one collection each; empty turns them off. */
let promoHours: number[] = [8, 14, 20];
const status: Omit<AnnouncerStatus, "llm"> = { enabled: false, auth: null, fc: { fid: null, posted: 0, failed: 0, lastError: null }, dryRun: false, seeded: false, seen: 0, posted: 0, failed: 0, lastPostAt: null, lastError: null };
export const announcerStatus = (): AnnouncerStatus => ({ ...status, fc: { ...status.fc }, seen: queue?.summary().jobs ?? 0, llm: llmStatus() });

let queue: DeliveryQueue | null = null;
let queueReady: Promise<void> | null = null;
let roundRunning: Promise<Mint[]> | null = null;
export const deliveryStatus = () => queue?.summary() ?? { jobs: 0, pending: 0, uncertain: 0, sent: 0 };

/** Fetch every page from the last durable cursor; a failed collection keeps its cursor. */
export async function collectPages(q: DeliveryQueue, channels: Channel[], collections = ANNOUNCED): Promise<void> {
  for (const c of collections) {
    const namespace = c.slug + ':8453:' + c.contract.toLowerCase();
    for (let page = 0; page < 3; page++) {
      const cursor = q.state.cursors[namespace];
      const j = await getJson(baseOf(c) + '/api/mints?after=' + (cursor ?? 'latest') + '&limit=100');
      if (!isObj(j) || j.version !== 1 || j.namespace !== '8453:' + c.contract.toLowerCase() || !Array.isArray(j.items)) throw new Error(c.slug + ': invalid mint page identity');
      const next = count(j.nextCursor), head = count(j.head);
      if (next === null || head === null || next > head || (cursor !== undefined && next < cursor)) throw new Error(c.slug + ': invalid mint cursor');
      const mints = c.kind === 'daily' ? j.items.map((item) => dailyMint(c,item)).filter((m): m is Mint => m !== null) : c.kind === 'coins' ? coinMints(c,{recent:j.items}) : rollMints(c,{recent:j.items});
      if (typeof j.hasMore !== "boolean" || (cursor === undefined && (next !== head || j.hasMore)) || (cursor !== undefined && mints.length === 0 && next !== cursor) || new Set(mints.map(m => m.id)).size !== mints.length || (mints.length > 0 && Math.max(...mints.map(m => m.id)) !== next) || mints.length !== j.items.length || mints.some((m) => m.id > next || m.id <= (cursor ?? head))) throw new Error(c.slug + ': incomplete mint page');
      for (const m of mints) m.key = namespace + ':' + m.id;
      if (cursor !== undefined && j.hasMore === true && next <= cursor) throw new Error(c.slug + ': stalled mint cursor');
      await q.ingest(namespace,next,mints,channels);
      if (j.hasMore !== true || cursor === undefined) break;
    }
  }
}

/** One worker owns discovery and delivery; interval overlap cannot send a second copy. */
export function round(auth: Auth | null, file?: string, fc: Fc | null = null): Promise<Mint[]> {
  if (roundRunning) return roundRunning;
  roundRunning = runRound(auth,file,fc).finally(() => { roundRunning = null; });
  return roundRunning;
}
async function runRound(auth: Auth | null, file?: string, fc: Fc | null = null): Promise<Mint[]> {
  const dry = status.dryRun || (!auth && !fc);
  if (!dry && !file) throw new Error('ANNOUNCE_STATE_FILE is required before sending');
  if (!queue) { queue = new DeliveryQueue(dry && file ? file + '.dry-run' : file); queueReady = queue.load(); }
  await queueReady;
  const q = queue;
  const channels: Channel[] = dry ? ['x'] : [...(auth ? ['x' as const] : []), ...(fc ? ['fc' as const] : [])];
  for (const c of ANNOUNCED) {
    try { await collectPages(q,channels,[c]); }
    catch(e) { status.failed++; status.lastError = String((e as Error).message).replace(/https?:\/\/\S+/g,'[upstream]').slice(0,200); }
  }
  status.seeded = true;
  const promo = promoHours.length ? await promoMint(promoHours) : null;
  if (promo) await q.promo(promo,channels);
  const out: Mint[] = [];
  await q.deliver(async(job) => {
    if (!job.text) job.text = dry || job.mint.slug === "one" ? job.mint.text : (await llmPost(job.mint.brief)) ?? job.mint.text;
    if (fc && !job.fcBody && !dry) job.fcBody = Buffer.from(await buildCast(fc,castText(job.text,job.mint.brief.url),[job.mint.image,job.mint.brief.url])).toString('base64');
  }, {
    x: dry ? async(job) => { console.log('announce (dry run): ' + job.text); out.push(job.mint); return 'dry-run'; } : auth ? async(job) => {
      let id: string; try { id = await post(auth,{...job.mint,text:job.text!}); } catch(e) { status.failed++; status.lastError = "X delivery failed; see delivery queue"; throw e; } status.posted++; status.lastPostAt = new Date().toISOString(); out.push(job.mint); return id;
    } : undefined,
    fc: !dry && fc ? async(job) => { let id: string; try { id=await submitCastBytes(fc,Buffer.from(job.fcBody!,'base64')); } catch(e) { status.fc.failed++; status.fc.lastError = 'Farcaster delivery failed; see delivery queue'; throw e; } status.fc.posted++; return id; } : undefined,
  });
  return out;
}

/** Starts the timer when an X auth or a Farcaster key is present, or dry run is on. Returns whether it started. */
export function startAnnouncer(env: Record<string, string | undefined> = process.env): boolean {
  const auth = authFromEnv(env);
  const fc = fcFromEnv(env);
  status.dryRun = env.ANNOUNCE_DRY_RUN === "1";
  promoHours = (env.ANNOUNCE_PROMO_HOURS_UTC ?? "8,14,20").split(",").filter((s) => s.trim() !== "").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n < 24).sort((a, b) => a - b);
  if (!auth && !fc && !status.dryRun) {
    console.log("announce: off, no X keys and no Farcaster key in the env");
    return false;
  }
  status.enabled = true;
  status.auth = auth?.kind ?? null;
  status.fc.fid = fc?.fid ?? null;
  const every = Math.max(15_000, Number(env.ANNOUNCE_EVERY_MS ?? 60_000));
  const file = env.ANNOUNCE_STATE_FILE;
  const tick = async () => {
    await round(auth, file, fc).catch(() => { status.failed++; status.lastError = "Announcer round failed; inspect state file and upstream health"; console.warn(status.lastError); });
  };
  void tick();
  setInterval(() => void tick(), every);
  console.log(`announce: on${status.dryRun ? " (dry run)" : ""} with ${auth?.kind ?? "no X auth"}${fc ? `, farcaster fid ${fc.fid}` : ""}, every ${every / 1000} s`);
  return true;
}
