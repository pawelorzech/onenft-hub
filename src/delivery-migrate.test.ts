import { test, expect } from "bun:test";
import { migrateLegacy } from "./delivery-migrate.ts";
import { DeliveryQueue } from "./delivery.ts";
import type { Mint } from "./announce.ts";
const source = { slug: "one", contract: `0x${"1".repeat(40)}` };
const ns = `one:8453:${source.contract}`;

test("migration preserves exact seen history and recovers a failed gap without reposting successes", async () => {
  const q = new DeliveryQueue();
  q.state = migrateLegacy(["one:11", "one:13", "promo:2026-09-07:0"], [source], {});
  expect(q.state.cursors[ns]).toBe(10);
  expect(q.state.promos).toEqual(["promo:2026-09-07:0"]);
  const items = [11,12,13,14].map(id => ({key:`${ns}:${id}`,id,slug:"one",text:"test",image:"",brief:{facts:"",angle:"",url:"",tags:[],reference:""}} satisfies Mint));
  await q.ingest(ns,14,items,["x"]);
  expect(Object.keys(q.state.jobs)).toEqual([`${ns}:12`,`${ns}:14`]);
  expect(q.state.legacySeen).toHaveLength(2);
});
test("collections with no old history require a cutover snapshot, not a later latest head", () => {
  expect(() => migrateLegacy([], [source], {})).toThrow("missing cutover head");
  expect(migrateLegacy([], [source], {one:80}).cursors[ns]).toBe(80);
  expect(() => migrateLegacy(["unknown:1"], [source], {})).toThrow();
  expect(() => migrateLegacy(["one:NaN"], [source], {})).toThrow();
});
