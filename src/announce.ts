/**
 * Mint announcer: one post on X for every new token in every collection.
 *
 * Every ANNOUNCE_EVERY_MS the announcer reads each collection's own API
 * (today for daily ones, state for rolls), finds tokens it has not seen, and
 * posts one message with the token's PNG. On boot it marks what already
 * exists as seen without posting, so a redeploy never repeats old news; a
 * mint that lands while the hub is down is not announced. The seen set is
 * also written to ANNOUNCE_STATE_FILE when that is set, so a restart with a
 * volume picks up where it left off.
 *
 * Posting needs an X app with write access and four keys in the env:
 * X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (OAuth 1.0a user
 * context, signed here with node:crypto, no dependency). Without them the
 * announcer stays off. ANNOUNCE_DRY_RUN=1 logs the posts instead of sending.
 */
import { createHmac, randomBytes } from "node:crypto";
import { COLLECTIONS, type Collection } from "./collections.ts";
import { baseOf, count, address, ensName, stateWord, ownUrl } from "./state.ts";

export type Mint = {
  slug: string;
  /** "knot:12" or "faces:5": one key per token, ever. */
  key: string;
  id: number;
  text: string;
  image: string;
};

type Keys = { apiKey: string; apiSecret: string; token: string; tokenSecret: string };

export function keysFromEnv(env: Record<string, string | undefined> = process.env): Keys | null {
  const apiKey = env.X_API_KEY, apiSecret = env.X_API_SECRET, token = env.X_ACCESS_TOKEN, tokenSecret = env.X_ACCESS_SECRET;
  return apiKey && apiSecret && token && tokenSecret ? { apiKey, apiSecret, token, tokenSecret } : null;
}

// ---- what to say

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

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
  const line = state === "author" ? `Day ${day} of ${c.name} went to the author.` : `Day ${day} of ${c.name} is claimed by ${owner}.`;
  const detail = palette ? ` Palette: ${palette}.` : "";
  return { slug: c.slug, key: `${c.slug}:${day}`, id: day, text: `${line}${detail}\nhttps://${c.host}/day/${day}`, image: `https://${c.host}/day/${day}-1024.png` };
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
    const line = treasury ? `Face #${id} was rolled for the author.` : owner ? `Face #${id} was rolled by ${owner}.` : `Face #${id} was rolled.`;
    const detail = one ? ` A one of one: ${one}.` : rarity ? ` Rarity: ${rarity}.` : "";
    out.push({ slug: c.slug, key: `${c.slug}:${id}`, id, text: `${line}${detail}\nhttps://${c.host}/face/${id}`, image: ownUrl(f.png, c.host) ?? `https://${c.host}/face/${id}-1024.png` });
  }
  return out.sort((a, b) => a.id - b.id);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6_000), headers: { accept: "application/json", "user-agent": "onenft-hub announcer" } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Every token the collections show right now. A collection that fails is skipped this round, not the others. */
export async function currentMints(): Promise<Mint[]> {
  const all = await Promise.all(COLLECTIONS.map(async (c) => {
    try {
      const base = baseOf(c);
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
      try { await Bun.write(file, JSON.stringify(state)); } catch (e) { console.warn(`announce: token file not written: ${String((e as Error)?.message ?? e)}`); }
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
  if (!res.ok || !j?.data?.id) throw new Error(`post ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.data.id;
}

// ---- the loop

export type AnnouncerStatus = { enabled: boolean; auth: "oauth1" | "oauth2" | null; dryRun: boolean; seeded: boolean; seen: number; posted: number; failed: number; lastPostAt: string | null; lastError: string | null };

/** Which of `now` are new, given what was seen. Pure, so the test can drive it. */
export function fresh(now: Mint[], seen: Set<string>): Mint[] {
  return now.filter((m) => !seen.has(m.key));
}

const seen = new Set<string>();
const status: AnnouncerStatus = { enabled: false, auth: null, dryRun: false, seeded: false, seen: 0, posted: 0, failed: 0, lastPostAt: null, lastError: null };
export const announcerStatus = (): AnnouncerStatus => ({ ...status, seen: seen.size });

async function loadSeen(file: string): Promise<void> {
  try {
    const j = await Bun.file(file).json();
    if (Array.isArray(j)) for (const k of j) if (typeof k === "string") seen.add(k);
  } catch {}
}
async function saveSeen(file: string | undefined): Promise<void> {
  if (!file) return;
  try { await Bun.write(file, JSON.stringify([...seen])); } catch (e) { console.warn(`announce: state not saved: ${String((e as Error)?.message ?? e)}`); }
}

/** One round: read, diff, post. Exported so a test can run it without the timer. */
export async function round(auth: Auth | null, file?: string): Promise<Mint[]> {
  const now = await currentMints();
  if (!status.seeded) {
    for (const m of now) seen.add(m.key);
    status.seeded = true;
    await saveSeen(file);
    console.log(`announce: seeded with ${seen.size} tokens, watching ${COLLECTIONS.map((c) => c.slug).join(", ")}`);
    return [];
  }
  const out: Mint[] = [];
  for (const m of fresh(now, seen)) {
    try {
      if (status.dryRun || !auth) console.log(`announce (dry run): ${m.text.replace(/\n/g, " ")} [${m.image}]`);
      else console.log(`announce: ${m.key} posted as ${await post(auth, m)}`);
      seen.add(m.key);
      status.posted++;
      status.lastPostAt = new Date().toISOString();
      out.push(m);
    } catch (e) {
      // Left out of `seen`, so the next round tries again.
      status.failed++;
      status.lastError = String((e as Error)?.message ?? e);
      console.warn(`announce: ${m.key} failed: ${status.lastError}`);
    }
  }
  if (out.length) await saveSeen(file);
  return out;
}

/** Starts the timer when an auth is present or dry run is on. Returns whether it started. */
export function startAnnouncer(env: Record<string, string | undefined> = process.env): boolean {
  const auth = authFromEnv(env);
  status.dryRun = env.ANNOUNCE_DRY_RUN === "1";
  if (!auth && !status.dryRun) {
    console.log("announce: off, no X keys in the env");
    return false;
  }
  status.enabled = true;
  status.auth = auth?.kind ?? null;
  const every = Math.max(15_000, Number(env.ANNOUNCE_EVERY_MS ?? 60_000));
  const file = env.ANNOUNCE_STATE_FILE;
  const tick = async () => {
    if (file && !status.seeded && seen.size === 0) await loadSeen(file);
    // A saved seen set means the boot already happened once; only post from then on.
    if (file && seen.size > 0) status.seeded = true;
    await round(auth, file).catch((e) => console.warn(`announce: round failed: ${String((e as Error)?.message ?? e)}`));
  };
  void tick();
  setInterval(() => void tick(), every);
  console.log(`announce: on${status.dryRun ? " (dry run)" : ""} with ${auth?.kind ?? "no auth"}, every ${every / 1000} s`);
  return true;
}
