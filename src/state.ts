/**
 * Live state of every collection, read from its own site. Cached in memory
 * for a minute; on failure the last good answer is kept, so one collection's
 * outage does not blank the page.
 */
import { COLLECTIONS, type Collection } from "./collections.ts";

export type Today = {
  day: number;
  date: string;
  state: "author" | "taken" | "free" | "gap" | null;
  ownerName: string | null;
  owner: string | null;
  image: string;
  url: string;
  /** Page colors of the collection, when its API gives them. */
  bg: string | null;
  fg: string | null;
};

export type Tally = { taken: number; gaps: number; author: number };
/** For "rolls" collections: how many rolled of the cap, and what is left in the 1/1 pool. */
export type Rolls = { rolled: number; max: number; poolLeft: number };

export type CollectionState = {
  c: Collection;
  today: Today | null;
  tally: Tally | null;
  rolls?: Rolls | null;
  fetchedAt: number;
};

const TTL_MS = Number(process.env.STATE_TTL_MS ?? 20_000);
const TIMEOUT_MS = 6_000;

const cache = new Map<string, CollectionState>();

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json", "user-agent": "onenft-hub" } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Colors from the shapes the three APIs return today. Unknown shape gives nulls. */
export function colorsOf(j: any): { bg: string | null; fg: string | null } {
  if (j?.palette?.bg && j?.palette?.cord) return { bg: j.palette.bg, fg: j.palette.cord };
  return { bg: null, fg: null };
}

export function todayOf(j: any): Today {
  const { bg, fg } = colorsOf(j);
  return {
    day: Number(j.day),
    date: String(j.date),
    state: j.state ?? null,
    ownerName: j.ownerName ?? null,
    owner: j.owner ?? null,
    image: String(j.image),
    url: String(j.url),
    bg,
    fg,
  };
}

export function tallyOf(days: any[]): Tally {
  let taken = 0, gaps = 0, author = 0;
  for (const d of days) {
    if (d.state === "author") { author++; taken++; }
    else if (d.state === "taken") taken++;
    else if (d.state === "gap") gaps++;
  }
  return { taken, gaps, author };
}

/** The newest face as a "today", so the block renders like the others. */
export function newestOf(j: any, host: string): Today | null {
  const f = j?.recent?.[0];
  if (!f) return null;
  return { day: Number(f.id), date: "", state: f.treasury ? "author" : "taken", ownerName: f.ownerName ?? null, owner: f.owner ?? null, image: String(f.image), url: String(f.url), bg: null, fg: null };
}
export function rollsOf(j: any): Rolls {
  return { rolled: Number(j?.totalSupply ?? 0), max: Number(j?.maxSupply ?? 10000), poolLeft: Number(j?.poolLeft ?? 0) };
}

/** One snapshot per collection: for daily ones /api/days feeds both the tile (its last entry) and the tally, so they never disagree. */
async function load(c: Collection): Promise<CollectionState> {
  const base = `https://${c.host}`;
  if (c.kind === "rolls") {
    const j = await getJson(`${base}/api/state`);
    return { c, today: newestOf(j, c.host), tally: null, rolls: rollsOf(j), fetchedAt: Date.now() };
  }
  const d = await getJson(`${base}/api/days`);
  const days: any[] = d.days ?? [];
  const last = days[days.length - 1];
  const today = last ? todayOf({ ...last, url: `${base}/day/${last.day}`, palette: last.palette }) : null;
  if (today && !today.bg) {
    // the day list carries no colours; one extra read for the palette source only
    try { const t = await getJson(`${base}/api/today`); const { bg, fg } = colorsOf(t); today.bg = bg; today.fg = fg; } catch {}
  }
  return { c, today, tally: tallyOf(days), fetchedAt: Date.now() };
}

export async function stateOf(c: Collection): Promise<CollectionState> {
  const hit = cache.get(c.slug);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit;
  try {
    const fresh = await load(c);
    cache.set(c.slug, fresh);
    return fresh;
  } catch (e) {
    console.error(`${c.host}: ${(e as Error).message}`);
    if (hit) return hit;
    const empty = { c, today: null, tally: null, fetchedAt: 0 };
    return empty;
  }
}

export async function allStates(): Promise<CollectionState[]> {
  return Promise.all(COLLECTIONS.map(stateOf));
}
