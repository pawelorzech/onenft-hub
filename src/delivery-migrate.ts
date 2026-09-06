import type { State } from "./delivery.ts";

type Source = { slug: string; contract: string };
/** Offline cutover: replay the old observed range, suppressing exactly the recorded keys. */
export function migrateLegacy(raw: unknown, sources: Source[], heads: Record<string, number>): State {
  if (!Array.isArray(raw) || !raw.every(k => typeof k === "string")) throw new Error("expected a version 1 seen array");
  const state: State = { version: 2, cursors: {}, jobs: {}, promos: [], legacySeen: [] };
  const bySlug = new Map(sources.map(c => [c.slug, c]));
  const minima = new Map<string, number>();
  for (const key of new Set(raw as string[])) {
    if (/^promo:\d{4}-\d{2}-\d{2}:\d+$/.test(key)) { state.promos.push(key); continue; }
    const match = /^([a-z0-9-]+):([1-9]\d*)$/.exec(key);
    const source = match && bySlug.get(match[1]!);
    const id = match ? Number(match[2]) : NaN;
    if (!source || !Number.isSafeInteger(id) || !/^0x[0-9a-fA-F]{40}$/.test(source.contract)) throw new Error(`unrecognized legacy key: ${key}`);
    const ns = `${source.slug}:8453:${source.contract.toLowerCase()}`;
    state.legacySeen!.push(`${ns}:${id}`);
    minima.set(source.slug, Math.min(minima.get(source.slug) ?? id, id));
  }
  for (const source of sources) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(source.contract)) throw new Error(`invalid contract: ${source.slug}`);
    const first = minima.get(source.slug);
    const cursor = first === undefined ? heads[source.slug] : first - 1;
    if (!Number.isSafeInteger(cursor) || cursor! < 0) throw new Error(`missing cutover head for ${source.slug}`);
    state.cursors[`${source.slug}:8453:${source.contract.toLowerCase()}`] = cursor!;
  }
  return state;
}
