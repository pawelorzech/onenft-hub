/**
 * Live state of every collection, read from its own site.
 *
 * Every upstream answer is data from another server: its shape is checked
 * field by field, and anything that does not fit becomes null, never a
 * "zero" or a "gap". Each collection has its own cache: a fresh value is
 * returned at once; an older one is returned at once with a refresh behind it,
 * shared by every request; with no value the caller waits only up to a
 * deadline. One collection's outage never blanks the page: the others render,
 * and that one is marked with the age of its last good answer.
 */
import { COLLECTIONS, type Collection } from "./collections.ts";
import { Swr, withDeadline, type SwrStatus } from "./swr.ts";

export type Today = {
  day: number;
  date: string;
  state: "author" | "taken" | "free" | "gap" | "unknown" | null;
  ownerName: string | null;
  owner: string | null;
  image: string;
  url: string;
  /** Page colors of the collection, when its API gives them. */
  bg: string | null;
  fg: string | null;
};

export type Tally = { taken: number; gaps: number; author: number };
/** For "rolls" collections: how many rolled of the cap, being revealed, and what is left in the 1/1 pool. */
export type Rolls = { rolled: number; pending: number; max: number; poolLeft: number };

/** What the upstream said about its own chain data. */
export type Upstream = { known: boolean; stale: boolean; readAt: string | null };

export type CollectionState = {
  c: Collection;
  today: Today | null;
  tally: Tally | null;
  rolls?: Rolls | null;
  upstream: Upstream | null;
  /** Unix milliseconds of the read this state came from; 0 when nothing was ever read. */
  fetchedAt: number;
  /** How this hub's cache of the collection stands: known, stale, last error. */
  status: SwrStatus;
};

const TTL_MS = Number(process.env.STATE_TTL_MS ?? 20_000);
const STALE_AFTER_MS = Number(process.env.STATE_STALE_MS ?? 120_000);
/** One upstream request. */
const TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 4_000);
/** The longest a page waits for a collection with no cached value. */
const DEADLINE_MS = Number(process.env.STATE_DEADLINE_MS ?? 2_000);
/** The longest the wallet page waits for any one collection's holder answer. */
const WALLET_DEADLINE_MS = Number(process.env.WALLET_DEADLINE_MS ?? 3_000);

/** Where each collection's API lives. Tests point a slug at a local fake with UPSTREAM_OVERRIDE='{"knot":"http://127.0.0.1:1234"}'; production never sets it. */
const OVERRIDE: Record<string, string> = (() => { try { return JSON.parse(process.env.UPSTREAM_OVERRIDE ?? "{}"); } catch { return {}; } })();
export function baseOf(c: Collection): string {
  return OVERRIDE[c.slug] ?? `https://${c.host}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json", "user-agent": "onenft-hub" } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// ---- validation of upstream data

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
/** A finite, non-negative integer, else null. String(undefined) and NaN are not numbers. */
export function count(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" && /^\d+$/.test(x) ? Number(x) : NaN;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
export function color(x: unknown): string | null {
  return typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x) ? x.toLowerCase() : null;
}
/** An https URL on the collection's own host, else null. Escaping does not stop javascript: in an href; this does. */
export function ownUrl(x: unknown, host: string): string | null {
  if (typeof x !== "string") return null;
  try {
    const u = new URL(x);
    return u.protocol === "https:" && u.hostname === host ? u.href : null;
  } catch {
    return null;
  }
}
export function address(x: unknown): string | null {
  return typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x) ? x : null;
}
/** An ENS name in plain form, else null. The collection sites already filter these; the hub does not trust that. */
export function ensName(x: unknown): string | null {
  return typeof x === "string" && x.length <= 255 && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/.test(x) ? x : null;
}
const STATES = new Set(["author", "taken", "free", "gap", "unknown"]);
export function stateWord(x: unknown): Today["state"] {
  return typeof x === "string" && STATES.has(x) ? (x as Today["state"]) : null;
}
export function upstreamOf(j: unknown): Upstream | null {
  if (!isObj(j) || !isObj(j.chain)) return null;
  const c = j.chain;
  // A site with no contract configured has no chain data to be stale or unknown about.
  if (c.configured === false) return null;
  return { known: c.known === true, stale: c.stale === true, readAt: typeof c.readAt === "string" ? c.readAt : null };
}

/** Colors from the shapes the APIs return today. Unknown shape gives nulls. */
export function colorsOf(j: unknown): { bg: string | null; fg: string | null } {
  if (isObj(j) && isObj(j.palette)) return { bg: color(j.palette.bg), fg: color(j.palette.cord) };
  return { bg: null, fg: null };
}

export function todayOf(j: unknown, host: string): Today | null {
  if (!isObj(j)) return null;
  const day = count(j.day);
  if (day === null) return null;
  const { bg, fg } = colorsOf(j);
  return {
    day,
    date: typeof j.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : "",
    state: stateWord(j.state),
    ownerName: ensName(j.ownerName),
    owner: address(j.owner),
    image: ownUrl(j.image, host) ?? `https://${host}/day/${day}.svg`,
    url: ownUrl(j.url, host) ?? `https://${host}/day/${day}`,
    bg,
    fg,
  };
}

export function tallyOf(days: unknown): Tally | null {
  if (!Array.isArray(days)) return null;
  let taken = 0, gaps = 0, author = 0, unknown = 0;
  for (const d of days) {
    const s = isObj(d) ? stateWord(d.state) : null;
    if (s === "author") { author++; taken++; }
    else if (s === "taken") taken++;
    else if (s === "gap") gaps++;
    else if (s === "unknown" || s === null) unknown++;
  }
  // A list the upstream could not read is no tally at all.
  return unknown > 0 && taken + gaps + author === 0 ? null : { taken, gaps, author };
}
/** The tally as /api/summary already computed it. */
export function tallyFrom(j: unknown): Tally | null {
  if (!isObj(j) || !isObj(j.tally)) return null;
  const t = j.tally;
  const taken = count(t.taken), gaps = count(t.gaps), author = count(t.author);
  return taken === null || gaps === null || author === null ? null : { taken, gaps, author };
}

/** The newest face as a "today", so the block renders like the others. */
export function newestOf(j: unknown, host: string): Today | null {
  if (!isObj(j) || !Array.isArray(j.recent)) return null;
  const f = j.recent[0];
  if (!isObj(f)) return null;
  const id = count(f.id);
  if (id === null) return null;
  const roll = isObj(f.roll) ? f.roll : null;
  return { day: id, date: "", state: roll?.treasury === true || f.treasury === true ? "author" : "taken", ownerName: ensName(f.ownerName), owner: address(f.owner), image: ownUrl(f.image, host) ?? `https://${host}/face/${id}.svg`, url: ownUrl(f.url, host) ?? `https://${host}/face/${id}`, bg: null, fg: null };
}
export function rollsOf(j: unknown): Rolls | null {
  if (!isObj(j)) return null;
  const rolled = count(j.totalSupply);
  if (rolled === null) return null;
  return { rolled, pending: count(j.pending) ?? 0, max: count(j.maxSupply) ?? 10000, poolLeft: count(j.poolLeft) ?? 0 };
}

type Loaded = Omit<CollectionState, "status" | "c">;

/**
 * One snapshot per collection. Rolls read /api/state. Daily ones read
 * /api/summary (today, tally, palette in one small answer) and fall back to
 * /api/days for a site that does not have it yet.
 */
async function load(c: Collection): Promise<Loaded> {
  const base = baseOf(c);
  if (c.kind === "rolls") {
    const j = await getJson(`${base}/api/state`);
    return { today: newestOf(j, c.host), tally: null, rolls: rollsOf(j), upstream: upstreamOf(j), fetchedAt: Date.now() };
  }
  try {
    const s = await getJson(`${base}/api/summary`);
    if (isObj(s) && isObj(s.today)) {
      const today = todayOf({ ...s.today, palette: s.palette }, c.host);
      return { today, tally: tallyFrom(s), upstream: upstreamOf(s), fetchedAt: Date.now() };
    }
  } catch {}
  const d = await getJson(`${base}/api/days`);
  const days = isObj(d) && Array.isArray(d.days) ? d.days : [];
  const last = days[days.length - 1];
  const today = isObj(last) ? todayOf({ ...last, url: `${base}/day/${last.day}` }, c.host) : null;
  if (today && !today.bg) {
    try { const t = await getJson(`${base}/api/today`); const { bg, fg } = colorsOf(t); today.bg = bg; today.fg = fg; } catch {}
  }
  return { today, tally: tallyOf(days), upstream: upstreamOf(d), fetchedAt: Date.now() };
}

const stores = new Map<string, Swr<Loaded>>();
function storeOf(c: Collection): Swr<Loaded> {
  let s = stores.get(c.slug);
  if (!s) {
    s = new Swr<Loaded>({ load: () => load(c), ttlMs: TTL_MS, staleAfterMs: STALE_AFTER_MS, deadlineMs: DEADLINE_MS, describe: (e) => String((e as Error)?.message ?? e).replace(/https?:\/\/\S+/g, "[upstream]").slice(0, 200), onError: (m, n) => console.error(`${c.host} (${n}): ${m}`) });
    stores.set(c.slug, s);
  }
  return s;
}

export async function stateOf(c: Collection): Promise<CollectionState> {
  const s = storeOf(c);
  const v = await s.get();
  const status = s.status();
  return v ? { c, ...v, status } : { c, today: null, tally: null, rolls: null, upstream: null, fetchedAt: 0, status };
}

/** Every collection, in parallel; the slowest one costs at most the deadline. */
export async function allStates(): Promise<CollectionState[]> {
  return Promise.all(COLLECTIONS.map(stateOf));
}

// ---- one wallet across every collection

/** One token as the wallet page shows it, whatever the collection calls it. */
export type WalletToken = { id: number; unit: "day" | "face"; label: string; image: string; url: string; caption: string; bg: string | null };
export type WalletState = { c: Collection; ok: boolean; tokens: WalletToken[]; fetchedAt: number; error: string | null };
export type Wallet = { address: string | null; name: string | null; states: WalletState[]; fetchedAt: number };

/** Normalize a collection's /api/holder answer. Daily collections list `days` with a `day`; rolls list `faces` with an `id`. */
export function tokensOf(c: Collection, j: unknown): WalletToken[] {
  if (!isObj(j)) return [];
  const list = c.kind === "rolls" ? j.faces : j.days;
  if (!Array.isArray(list)) return [];
  const unit = c.kind === "rolls" ? "face" : "day";
  const out: WalletToken[] = [];
  for (const t of list) {
    if (!isObj(t)) continue;
    const id = count(c.kind === "rolls" ? t.id : t.day);
    if (id === null) continue;
    const palette = isObj(t.traits) && typeof t.traits.palette === "string" ? t.traits.palette.slice(0, 40) : null;
    out.push({
      id,
      unit,
      label: c.kind === "rolls" ? `Face #${id}` : `Day ${id}`,
      image: ownUrl(t.image, c.host) ?? `https://${c.host}/${unit}/${id}.svg`,
      url: ownUrl(t.url, c.host) ?? `https://${c.host}/${unit}/${id}`,
      caption: palette ? `${unit} ${id}, ${palette}` : `${unit} ${id}`,
      bg: isObj(t.palette) ? color(t.palette.bg) : null,
    });
  }
  return out;
}

const WALLET_MAX = 200;
const wallets = new Map<string, Wallet>();

/**
 * Every collection's /api/holder for one address or ENS name, in parallel. A
 * site that fails is marked, not dropped, and keeps its last good tokens from
 * the cache with their age, so one outage never shows a wallet as empty.
 */
export async function walletOf(who: string): Promise<Wallet> {
  const key = who.toLowerCase();
  const hit = wallets.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit;
  let addr: string | null = null, name: string | null = null;
  const states = await Promise.all(
    COLLECTIONS.map(async (c): Promise<WalletState> => {
      const old = hit?.states.find((s) => s.c.slug === c.slug);
      try {
        const j = await withDeadline(getJson(`${baseOf(c)}/api/holder/${encodeURIComponent(who)}`), WALLET_DEADLINE_MS);
        if (isObj(j)) {
          if (!addr) addr = address(j.address);
          if (!name) name = ensName(j.name);
        }
        return { c, ok: true, tokens: tokensOf(c, j), fetchedAt: Date.now(), error: null };
      } catch (e) {
        const error = String((e as Error)?.message ?? e).replace(/https?:\/\/\S+/g, "[upstream]").slice(0, 120);
        console.error(`${c.host} holder: ${error}`);
        return old?.ok ? { ...old, ok: false, error } : { c, ok: false, tokens: [], fetchedAt: 0, error };
      }
    }),
  );
  const w: Wallet = { address: addr ?? hit?.address ?? null, name: name ?? hit?.name ?? null, states, fetchedAt: Date.now() };
  if (wallets.size >= WALLET_MAX) wallets.delete(wallets.keys().next().value!);
  wallets.set(key, w);
  return w;
}
