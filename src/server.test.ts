/**
 * The hub as a process against fake collection sites: one answers, one hangs,
 * one returns junk, one is down. The page must render within the deadline with
 * the good one filled in and the others marked, never with zeros or gaps; the
 * wallet page must say "in 1 of 5"; twenty concurrent requests must share one
 * upstream read per collection.
 */
import { expect, test, afterAll } from "bun:test";

const procs: ReturnType<typeof Bun.spawn>[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
afterAll(() => { for (const p of procs) p.kill(); for (const s of servers) s.stop(true); });

function fake(handler: (path: string) => Response | Promise<Response>) {
  let hits = 0;
  const srv = Bun.serve({ port: 0, fetch: (req) => { hits++; return handler(new URL(req.url).pathname); } });
  servers.push(srv);
  return { url: `http://127.0.0.1:${srv.port}`, hits: () => hits };
}
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });

test("wallet retains its last good tokens through repeated failures and invalid JSON shapes", async () => {
  let mode = "good";
  const upstream = fake(() => mode === "down" ? new Response("down", { status: 503 }) : json(mode === "junk" ? {} : {
    address: "0x2222222222222222222222222222222222222222", days: [{ day: 1 }], faces: [{ id: 1 }], coins: [{ id: 1 }],
  }));
  const base = await boot({ STATE_TTL_MS: "0", UPSTREAM_OVERRIDE: JSON.stringify(Object.fromEntries(["knot", "blit", "chainrun", "faces", "one"].map((s) => [s, upstream.url]))) });
  const read = async () => (await fetch(`${base}/api/wallet/0x2222222222222222222222222222222222222222.json`)).json() as Promise<any>;
  const first = await read();
  expect(first.checked).toBe(5);
  for (const next of ["down", "down", "junk"]) {
    mode = next;
    const result = await read();
    expect(result.checked).toBe(0);
    for (let i = 0; i < 5; i++) {
      expect(result.collections[i].tokens).toEqual(first.collections[i].tokens);
      expect(result.collections[i].fetchedAt).toBe(first.collections[i].fetchedAt);
    }
  }
  mode = "good";
  expect((await read()).checked).toBe(5);
});

test("concurrent wallet reads share one upstream request per collection", async () => {
  const upstream = fake(async () => {
    await Bun.sleep(50);
    return json({ address: "0x2222222222222222222222222222222222222222", days: [], faces: [], coins: [] });
  });
  const base = await boot({ UPSTREAM_OVERRIDE: JSON.stringify(Object.fromEntries(["knot", "blit", "chainrun", "faces", "one"].map((s) => [s, upstream.url]))) });
  const responses = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/api/wallet/0x2222222222222222222222222222222222222222.json`)));
  expect(responses.every((r) => r.ok)).toBe(true);
  expect(upstream.hits()).toBe(5);
});

async function boot(env: Record<string, string>): Promise<string> {
  const port = "0";
  let actualPort = 0;
  const proc = Bun.spawn(["bun", "run", "src/server.ts"], { env: { ...process.env, PORT: port, STATE_DEADLINE_MS: "500", UPSTREAM_TIMEOUT_MS: "60000", STATE_TTL_MS: "20000", WALLET_DEADLINE_MS: "500", ...env }, stdout: "pipe", stderr: "pipe", ipc(message: unknown) { if (message && typeof message === "object" && "port" in message) actualPort = Number(message.port); } });
  procs.push(proc);
  for (let i = 0; i < 100; i++) {
    const base = `http://127.0.0.1:${actualPort}`;
    try { if ((await fetch(`${base}/health`)).ok) return base; } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("hub did not start");
}

test("one good, one hung, one junk, one down: the page renders within the deadline, honest per collection", async () => {
  const good = fake((p) => p === "/api/summary" ? json({ today: { day: 3, date: "2026-09-07", state: "free", owner: null, ownerName: null, image: "https://knot.onenft.click/day/3.svg", url: "https://knot.onenft.click/day/3" }, tally: { taken: 2, gaps: 0, author: 0 }, palette: { bg: "#0b1d51", cord: "#f2e9d8" }, chain: { known: true, stale: false, readAt: "2026-09-07T00:00:00Z" } }) : p.startsWith("/api/holder/") ? json({ address: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", name: null, days: [{ day: 3, image: "https://knot.onenft.click/day/3.svg", url: "https://knot.onenft.click/day/3" }] }) : new Response("no", { status: 404 }));
  const hung = fake(() => new Promise<Response>(() => {}));
  const junk = fake(() => json({ today: { day: "NaN", state: "gap" }, tally: { taken: "x" }, recent: [{ id: -1 }], totalSupply: "lots" }));
  const base = await boot({ UPSTREAM_OVERRIDE: JSON.stringify({ knot: good.url, blit: hung.url, chainrun: junk.url, faces: "http://127.0.0.1:9", one: "http://127.0.0.1:9" }) });

  const t0 = Date.now();
  const home = await (await fetch(`${base}/`)).text();
  expect(Date.now() - t0).toBeLessThan(2500);
  expect(home).toContain("Day 3</span>, 2026-09-07, available today.");
  expect(home).toContain("Status unavailable. Blit did not answer.");
  expect(home).toContain("Status unavailable. Faces did not answer.");
  expect(home).toContain("Status unavailable. Chain Run answered, but not with anything this page can show.");
  expect(home).not.toContain("NaN");
  expect(home).not.toContain("undefined");
  expect(home).not.toContain("<b>0</b><span>of 10,000 rolled");
  expect(home).toContain("1 of 3 daily collections");

  // Twenty concurrent hits: the hung upstream is asked once, not twenty times.
  const before = hung.hits();
  const pages = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/`)));
  expect(pages.every((r) => r.status === 200)).toBe(true);
  expect(hung.hits() - before).toBeLessThanOrEqual(1);

  const ready = await fetch(`${base}/ready`);
  expect(ready.status).toBe(200);
  const rj = await ready.json();
  expect(rj.collections.find((c: any) => c.slug === "knot").known).toBe(true);
  expect(rj.collections.find((c: any) => c.slug === "blit").known).toBe(false);
  expect(JSON.stringify(rj)).not.toContain("127.0.0.1");

  const wallet = await (await fetch(`${base}/wallet/0x84Cf6667FdE676a5950730720b67d62B9AB476Df`)).text();
  expect(wallet).toContain("Found 1 token in 1 of 5 collections. Faces, ONE, Blit, Chain Run could not be checked.");
  expect(wallet).toContain("could not be checked");
  const wj = await fetch(`${base}/api/wallet/0x84Cf6667FdE676a5950730720b67d62B9AB476Df.json`);
  expect(wj.status).toBe(200);
  const w = await wj.json();
  expect(w.checked).toBe(1);
  expect(w.of).toBe(5);
  expect(w.collections.find((c: any) => c.slug === "blit").ok).toBe(false);
}, 30000);

test("every upstream down: the page still renders, ready is 503, the wallet JSON is 503 and still JSON", async () => {
  const base = await boot({ UPSTREAM_OVERRIDE: JSON.stringify({ knot: "http://127.0.0.1:9", blit: "http://127.0.0.1:9", chainrun: "http://127.0.0.1:9", faces: "http://127.0.0.1:9", one: "http://127.0.0.1:9" }) });
  const home = await fetch(`${base}/`);
  expect(home.status).toBe(200);
  const h = await home.text();
  expect(h).toContain("--bg:#f4f2ec");
  expect((h.match(/Status unavailable/g) ?? []).length).toBe(5);
  expect(h).toContain("<b>?</b>");
  expect((await fetch(`${base}/ready`)).status).toBe(503);
  const wj = await fetch(`${base}/api/wallet/0x84Cf6667FdE676a5950730720b67d62B9AB476Df.json`);
  expect(wj.status).toBe(503);
  expect(wj.headers.get("content-type")).toContain("application/json");
}, 30000);
