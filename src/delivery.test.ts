import { test, expect, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { DeliveryQueue, DefiniteSendError } from "./delivery.ts";
import { collectPages, type Mint } from "./announce.ts";
import { COLLECTIONS } from "./collections.ts";

const mint: Mint = { key: "one:8453:contract:1", slug: "one", id: 1, text: "test", image: "", brief: { facts: "", angle: "", url: "", tags: [], reference: "" } };
test("a failed Farcaster delivery retries without repeating X", async () => {
  let now = 0; const q = new DeliveryQueue(undefined, undefined, () => now); await q.ingest("ns",1,[mint],["x","fc"]);
  let x=0, fc=0;
  const senders = { x: async() => { x++;return "tweet"; }, fc: async() => { if(++fc===1)throw new Error("timeout");return "cast"; } };
  await q.deliver(async(j)=>{j.text="test";j.fcBody="stable";},senders);
  now += 60_000; await q.deliver(async()=>{},senders);
  expect(x).toBe(1);expect(fc).toBe(2);expect(q.summary().sent).toBe(2);
});
test("X timeout is uncertain, an explicit rejection can retry", async () => {
  for(const definite of [false,true]) {
    let now = 0; const q=new DeliveryQueue(undefined, undefined, () => now);await q.ingest("ns",1,[mint],["x"]);let n=0;
    const sender={x:async()=>{n++;if(n===1)throw definite?new DefiniteSendError("429"):new Error("socket closed");return "id";}};
    await q.deliver(async()=>{},sender);now += 60_000;await q.deliver(async()=>{},sender);
    expect(n).toBe(definite?2:1);expect(q.summary().uncertain).toBe(definite?0:1);
  }
});
test("restart retains cursor, signed cast bytes and an uncertain X request", async () => {
  const dir=await mkdtemp(`${tmpdir()}/onenft-queue-`),file=`${dir}/state.json`;
  try {
    const q=new DeliveryQueue(file);await q.ingest("ns",1,[mint],["x","fc"]);
    q.state.jobs[mint.key].fcBody="signed-bytes";
    q.state.jobs[mint.key].channels={x:{state:"sending"},fc:{state:"sending"}};
    await q.ingest("ns",1,[],[]);
    const next=new DeliveryQueue(file);await next.load();
    expect(next.state.cursors.ns).toBe(1);expect(next.state.jobs[mint.key].fcBody).toBe("signed-bytes");
    expect(next.state.jobs[mint.key].channels).toEqual({x:{state:"uncertain"},fc:{state:"pending"}});
    await writeFile(file,"broken");await expect(new DeliveryQueue(file).load()).rejects.toThrow();
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test("disk failure before sending prevents external effects", async () => {
  let fail=false,sends=0;
  const q=new DeliveryQueue("test",async()=>{if(fail)throw new Error("disk full");});
  await q.ingest("ns",1,[mint],["x"]);fail=true;
  await expect(q.deliver(async()=>{}, {x:async()=>{sends++;return "id";}})).rejects.toThrow("disk full");
  expect(sends).toBe(0);
});
test("discovery covers 250 mints after downtime and scopes ids by contract", async () => {
  const c=COLLECTIONS.find(c=>c.slug==="one")!;
  const ns=`one:8453:${c.contract.toLowerCase()}`;
  const q=new DeliveryQueue();q.state.cursors[ns]=10;
  const fakeFetch=Object.assign(async(input:Parameters<typeof fetch>[0])=>{
    const after=Number(new URL(String(input)).searchParams.get("after"));
    const end=Math.min(260,after+100);
    return Response.json({version:1,namespace:`8453:${c.contract.toLowerCase()}`,head:260,nextCursor:end,hasMore:end<260,items:Array.from({length:end-after},(_,i)=>({id:after+i+1}))});
  },{preconnect:fetch.preconnect});
  const mock=spyOn(globalThis,"fetch").mockImplementation(fakeFetch);
  try { await collectPages(q,["x"],[c]);expect(q.state.cursors[ns]).toBe(260);expect(Object.keys(q.state.jobs)).toHaveLength(250);expect(q.state.jobs[`${ns}:11`]).toBeDefined(); }
  finally {mock.mockRestore();}
});

test("retry backoff prevents a failing channel from taking every delivery slot", async () => {
  let now = 0, calls = 0;
  const q = new DeliveryQueue(undefined, undefined, () => now);
  await q.ingest("ns", 1, [mint], ["fc"]);
  const senders = { fc: async () => { calls++; throw new Error("offline"); } };
  await q.deliver(async () => {}, senders);
  await q.deliver(async () => {}, senders);
  expect(calls).toBe(1);
  now = 60_000;
  await q.deliver(async () => {}, senders);
  expect(calls).toBe(2);
  expect(q.state.jobs[mint.key].channels.fc?.retryAt).toBe(180_000);
});

test("duplicate ids in a mint page cannot advance the durable cursor", async () => {
  const c = COLLECTIONS.find(c => c.slug === "one")!;
  const ns = `one:8453:${c.contract.toLowerCase()}`;
  const q = new DeliveryQueue(); q.state.cursors[ns] = 10;
  const mock = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async () => Response.json({ version: 1, namespace: `8453:${c.contract.toLowerCase()}`, head: 11, nextCursor: 11, hasMore: false, items: [{ id: 11 }, { id: 11 }] }), { preconnect: fetch.preconnect }));
  try { await expect(collectPages(q, ["x"], [c])).rejects.toThrow(); expect(q.state.cursors[ns]).toBe(10); } finally { mock.mockRestore(); }
});

test("legacy state fails closed instead of silently seeding past cutover mints", async () => {
  const dir = await mkdtemp(`${tmpdir()}/onenft-migration-`);
  const file = `${dir}/state.json`;
  try {
    await writeFile(file, JSON.stringify(["one:11"]));
    await expect(new DeliveryQueue(file).load()).rejects.toThrow("offline migration");
    expect(await Bun.file(`${file}.v1-backup`).json()).toEqual(["one:11"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
