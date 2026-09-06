import { test, expect } from "bun:test";
import { homePage, walletPage, goTarget, pageColors, FALLBACK, mix, cssVars, contrast } from "./site.ts";
import { colorsOf, todayOf, tallyOf, tallyFrom, newestOf, rollsOf, tokensOf, factsOf, count, color, ownUrl, ensName, upstreamOf, type CollectionState, type Wallet, type WalletState } from "./state.ts";
import { COLLECTIONS, FACES_MAX, FACES_MAX_PINS, FACES_FIRST_PIN_ETH, FACES_ALL_PINS_ETH } from "./collections.ts";
import { handle, OWN } from "./server.ts";
import type { SwrStatus } from "./swr.ts";

const OK: SwrStatus = { known: true, stale: false, readAt: 1, ageSeconds: 1, error: null, errorAt: null, failures: 0, inflight: false };
const DOWN: SwrStatus = { known: false, stale: false, readAt: null, ageSeconds: null, error: "x", errorAt: 1, failures: 1, inflight: false };
const knotToday = { day: 3, date: "2026-09-07", state: "taken", owner: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", ownerName: "pawelorzech.eth", image: "https://knot.onenft.click/day/3.svg", url: "https://knot.onenft.click/day/3", palette: { bg: "#0b1d51", cord: "#f2e9d8" } };
const facesState = { totalSupply: 12, pending: 1, maxSupply: 10000, poolLeft: 49, chain: { known: true, stale: false, readAt: "2026-09-05T12:00:00Z" }, recent: [{ id: 12, owner: "0x2222222222222222222222222222222222222222", ownerName: null, treasury: false, image: "https://faces.onenft.click/face/12.svg", url: "https://faces.onenft.click/face/12" }] };
const blitToday = { day: 3, date: "2026-09-07", state: "free", owner: null, ownerName: null, image: "https://blit.onenft.click/day/3.svg", url: "https://blit.onenft.click/day/3", colors: ["#000", "#fff", "#f00", "#0f0"] };

function states(withKnot = true): CollectionState[] {
  return COLLECTIONS.map((c) => {
    if (c.slug === "knot") return { c, today: withKnot ? todayOf(knotToday, c.host) : null, tally: withKnot ? { taken: 2, gaps: 0, author: 0 } : null, upstream: null, fetchedAt: Date.now(), status: withKnot ? OK : DOWN };
    if (c.slug === "blit") return { c, today: todayOf(blitToday, c.host), tally: { taken: 1, gaps: 1, author: 0 }, upstream: null, fetchedAt: Date.now(), status: OK };
    if (c.slug === "faces") return { c, today: newestOf(facesState, c.host), tally: null, rolls: rollsOf(facesState), upstream: upstreamOf(facesState), fetchedAt: Date.now(), status: OK };
    return { c, today: null, tally: null, upstream: null, fetchedAt: 0, status: DOWN };
  });
}

test("colors come from the knot's palette, with a fallback; the page ink always reads", () => {
  expect(colorsOf(knotToday)).toEqual({ bg: "#0b1d51", fg: "#f2e9d8" });
  expect(colorsOf(blitToday)).toEqual({ bg: null, fg: null });
  expect(pageColors(states())).toEqual({ bg: "#0b1d51", fg: "#f2e9d8" });
  expect(pageColors(states(false))).toEqual(FALLBACK);
  expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  for (const [fg, bg] of [["#f2e9d8", "#0b1d51"], ["#141414", "#f4f2ec"], ["#777777", "#888888"], ["#ff0000", "#00ff00"]]) {
    const v = cssVars(fg, bg);
    const ink = v.match(/--fg:(#[0-9a-f]{6})/)![1], muted = v.match(/--muted:(#[0-9a-f]{6})/)![1], edge = v.match(/--edge:(#[0-9a-f]{6})/)![1];
    expect(contrast(ink, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(edge, bg)).toBeGreaterThanOrEqual(3);
  }
});

test("upstream data is validated field by field: no NaN, no undefined, no foreign or javascript: URLs, no unknown states", () => {
  expect(count(3)).toBe(3);
  expect(count("3")).toBe(3);
  expect(count(-1)).toBeNull();
  expect(count(NaN)).toBeNull();
  expect(count(undefined)).toBeNull();
  expect(count("abc")).toBeNull();
  expect(color("#0B1D51")).toBe("#0b1d51");
  expect(color("red")).toBeNull();
  expect(color("#0b1d51;x")).toBeNull();
  expect(ownUrl("https://knot.onenft.click/day/3.svg", "knot.onenft.click")).toBe("https://knot.onenft.click/day/3.svg");
  expect(ownUrl("javascript:alert(1)", "knot.onenft.click")).toBeNull();
  expect(ownUrl("https://evil.example/x.svg", "knot.onenft.click")).toBeNull();
  expect(ownUrl("http://knot.onenft.click/x.svg", "knot.onenft.click")).toBeNull();
  expect(ensName("pawelorzech.eth")).toBe("pawelorzech.eth");
  expect(ensName('</title><script>.eth')).toBeNull();
  expect(todayOf({ day: "x" }, "knot.onenft.click")).toBeNull();
  const t = todayOf({ day: 5, state: "weird", owner: "not-an-address", image: "javascript:alert(1)", url: 42 }, "knot.onenft.click")!;
  expect(t.state).toBeNull();
  expect(t.owner).toBeNull();
  expect(t.image).toBe("https://knot.onenft.click/day/5.svg");
  expect(t.url).toBe("https://knot.onenft.click/day/5");
  expect(newestOf({ recent: [{ id: "12", image: "https://faces.onenft.click/face/12.svg", url: "https://faces.onenft.click/face/12" }] }, "faces.onenft.click")!.day).toBe(12);
  expect(newestOf({ recent: "nope" }, "faces.onenft.click")).toBeNull();
  expect(rollsOf({ totalSupply: null })).toBeNull();
  expect(rollsOf(facesState)).toEqual({ rolled: 12, pending: 1, max: 10000, poolLeft: 49 });
  expect(upstreamOf(facesState)).toEqual({ known: true, stale: false, readAt: "2026-09-05T12:00:00Z" });
});

test("tally counts states and refuses to turn an unread list into zeros", () => {
  expect(tallyOf([{ state: "author" }, { state: "taken" }, { state: "gap" }, { state: "free" }])).toEqual({ taken: 2, gaps: 1, author: 1 });
  expect(tallyOf([{ state: "unknown" }, { state: "unknown" }])).toBeNull();
  expect(tallyOf("nope")).toBeNull();
  expect(tallyFrom({ tally: { taken: 2, gaps: 1, author: 1 } })).toEqual({ taken: 2, gaps: 1, author: 1 });
  expect(tallyFrom({ tally: { taken: "x" } })).toBeNull();
});

test("home page lists every collection, the totals, honest states and the audit copy", () => {
  const h = homePage(states());
  for (const c of COLLECTIONS) {
    expect(h).toContain(`id="${c.slug}"`);
    expect(h).toContain(`href="https://${c.host}/"`);
    expect(h).toContain(`Explore ${c.name}`);
  }
  expect(h).toContain("On-chain art, one day at a time.");
  expect(h).toContain("Faces lets each wallet roll once a day, while supply remains.");
  expect(h).toContain("Day 3</span>, 2026-09-07, claimed, held by pawelorzech.eth.");
  expect(h).toContain("available today");
  expect(h).toContain("Status unavailable. Chain Run did not answer.");
  expect(h).toContain("Face #12</span>, the newest, held by 0x2222…2222.");
  expect(h).toContain("of 10,000 rolled");
  expect(h).toContain("<b>1</b><span>being revealed</span>");
  expect(h).toContain("--bg:#0b1d51;--fg:#f2e9d8");
  expect(h).toContain('og:image" content="https://knot.onenft.click/day/3.png"');
  expect(h).toContain("2 of 3 daily collections");
  expect(h).toContain(`up to ${FACES_MAX_PINS} pins for a fee that starts at ${FACES_FIRST_PIN_ETH} ETH and doubles with every pin up to ${FACES_ALL_PINS_ETH} ETH`);
  expect(h).toContain(`pin up to ${FACES_MAX_PINS} traits and colours`);
  expect(h).not.toContain("up to three");
  expect(h).not.toContain("small fee");
  expect(h).not.toContain("no file can go missing");
  expect(h).not.toContain("Everything is CC0");
  expect(h).toContain(">Day 3, the one above</a>");
  expect(h).not.toContain("—");
  expect(h).toContain('<nav class="crumb" aria-label="Breadcrumb">');
  expect(h).toContain('class="skip"');
  expect(h).toContain("[hidden]{display:none!important}");
});

test("old knot paths redirect to knot.onenft.click, own paths do not", async () => {
  for (const p of ["/day/12", "/day/12.svg", "/explore", "/api/today", "/api/day/4", "/feed.xml", "/calendar.ics", "/0x84Cf6667FdE676a5950730720b67d62B9AB476Df", "/pawelorzech.eth", "/how", "/today.png"]) {
    const r = await handle(new Request(`https://onenft.click${p}`));
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe(`https://knot.onenft.click${p}`);
  }
  const q = await handle(new Request("https://onenft.click/api/days?x=1"));
  expect(q.headers.get("location")).toBe("https://knot.onenft.click/api/days?x=1");
  const w = await handle(new Request("https://www.onenft.click/"));
  expect(w.status).toBe(301);
  expect(w.headers.get("location")).toBe("https://onenft.click/");
  expect(OWN.has("/")).toBe(true);
  const h = await handle(new Request("https://onenft.click/health"));
  expect(await h.text()).toStartWith("ok, 4 collections");
  expect(h.headers.get("x-content-type-options")).toBe("nosniff");
});

const A = "0x84Cf6667FdE676a5950730720b67d62B9AB476Df";
function wallet(): Wallet {
  const by = (slug: string) => COLLECTIONS.find((c) => c.slug === slug)!;
  const ok = (c: WalletState["c"], tokens: WalletState["tokens"], facts: WalletState["facts"] = []): WalletState => ({ c, ok: true, tokens, facts, fetchedAt: Date.now(), error: null });
  return {
    address: A,
    name: "pawelorzech.eth",
    fetchedAt: 1,
    states: [
      ok(by("faces"), tokensOf(by("faces"), { faces: [{ id: 12, image: "https://faces.onenft.click/face/12.svg", url: "https://faces.onenft.click/face/12" }] })),
      ok(by("knot"), tokensOf(by("knot"), { days: [{ day: 1, image: "https://knot.onenft.click/day/1.svg", url: "https://knot.onenft.click/day/1", traits: { palette: "ultramarine" }, palette: { bg: "#0e1430" } }, { day: 3, image: "https://knot.onenft.click/day/3.svg", url: "https://knot.onenft.click/day/3", traits: { palette: "pine" }, palette: { bg: "#0c1a1a" } }] }), factsOf({ facts: [{ figure: "Day 1", label: "the first knot", text: "Holds day 1." }, { figure: "<b>", label: "x".repeat(300) }, { figure: 3 }] })),
      ok(by("blit"), []),
      { c: by("chainrun"), ok: false, tokens: [], facts: [], fetchedAt: 0, error: "timeout" },
    ],
  };
}

test("tokens normalize daily days and rolled faces the same way, and drop foreign URLs", () => {
  const w = wallet();
  expect(w.states[0].tokens[0]).toMatchObject({ id: 12, unit: "face", label: "Face #12", caption: "face 12", bg: null });
  expect(w.states[1].tokens[1]).toMatchObject({ id: 3, unit: "day", label: "Day 3", caption: "day 3, pine", bg: "#0c1a1a" });
  const by = (slug: string) => COLLECTIONS.find((c) => c.slug === slug)!;
  const t = tokensOf(by("knot"), { days: [{ day: 9, image: "javascript:alert(1)", url: "https://evil.example/" }] })[0];
  expect(t.image).toBe("https://knot.onenft.click/day/9.svg");
  expect(t.url).toBe("https://knot.onenft.click/day/9");
  expect(tokensOf(by("knot"), { days: [{ day: "x" }, null, 5] })).toEqual([]);
});

test("wallet page: Faces first, one section per collection, three chips per token with faces-face-N names, a failed site says found N in 3 of 4", () => {
  const h = walletPage(states(), wallet(), A);
  expect(h.indexOf('id="faces"')).toBeLessThan(h.indexOf('id="knot"'));
  expect(h).toContain('<span class="wname" style="font-size:26px">pawelorzech<wbr>.eth</span>');
  expect(h).toContain(">3</div>");
  expect(h).toContain("Found 3 tokens in 3 of 4 collections. Chain Run could not be checked.");
  expect((h.match(/data-dl="png"/g) ?? []).length).toBe(3);
  expect(h).toContain('download="faces-face-12.svg"');
  expect(h).toContain('download="faces-face-12-1024.png"');
  expect(h).toContain('download="knot-day-3.svg"');
  expect(h).toContain('href="https://faces.onenft.click/face/12-1024.png"');
  expect(h).toContain('data-prefix="knot" data-pixel="0" data-bg="#0e1430"');
  expect(h).toContain('data-prefix="faces" data-pixel="1"');
  expect(h).toContain('aria-label="Download PNG of Face #12"');
  expect(h).toContain("Nothing here yet.");
  expect(h).toContain("Chain Run could not be checked.");
  expect(h).toContain('href="https://chainrun.onenft.click/yours"');
  expect(h).toContain('class="sizes"');
  expect(h).toContain("onenft_size");
  expect(h).toContain(`/api/wallet/${A}.json`);
  expect(h).toContain(`<link rel="canonical" href="https://onenft.click/wallet/${A}">`);
  expect(h).toContain('<meta name="robots" content="noindex">');
  expect(h).toContain("Viewing a wallet needs no transaction");
  expect(h).not.toContain("—");
});

test("wallet page without an address asks for one with a label, keeps a bad input with a reason, and links each site's page", () => {
  const h = walletPage(states(), null, "", "junk");
  expect(h).toContain('id="connect"');
  expect(h).toContain('action="/go"');
  expect(h).toContain('<label for="who">');
  expect(h).toContain("View wallet");
  expect(h).toContain("is not a wallet address or an ENS name");
  expect(h).toContain('<link rel="canonical" href="https://onenft.click/wallet">');
  for (const c of COLLECTIONS) expect(h).toContain(`https://${c.host}/yours`);
  expect(h).not.toContain("onenft_size");
  expect(walletPage(states(), null)).not.toContain("is not a wallet address");
});

test("home page links the wallet page without the footer and lists Faces first", () => {
  const h = homePage(states());
  expect(h).toContain('<nav class="sitenav small" aria-label="Site">');
  expect(h).toContain('href="/wallet">Your wallet</a>');
  expect(h.indexOf('id="faces"')).toBeLessThan(h.indexOf('id="knot"'));
});

test("/wallet routes: own paths, prefix match, /go validation, bad handles bounce, malformed encoding is a 400, JSON stays JSON", async () => {
  expect(OWN.has("/wallet")).toBe(true);
  const g = await handle(new Request("https://onenft.click/go?who=pawelorzech.eth"));
  expect(g.status).toBe(302);
  expect(g.headers.get("location")).toBe("/wallet/pawelorzech.eth");
  const bad = await handle(new Request("https://onenft.click/go?who=junk"));
  expect(bad.headers.get("location")).toBe("/wallet?bad=junk");
  const bounce = await handle(new Request("https://onenft.click/wallet/junk"));
  expect(bounce.status).toBe(302);
  expect(bounce.headers.get("location")).toBe("/wallet?bad=junk");
  const badJson = await handle(new Request("https://onenft.click/api/wallet/junk.json"));
  expect(badJson.status).toBe(400);
  expect(badJson.headers.get("content-type")).toContain("application/json");
  expect((await badJson.json()).error).toContain("not an address");
  const zz = await handle(new Request("http://localhost/wallet/%ZZ"));
  expect(zz.status).toBe(302);
  expect(zz.headers.get("location")).toBe("/wallet?bad=%25ZZ");
  const zzJson = await handle(new Request("http://localhost/api/wallet/%ZZ.json"));
  expect(zzJson.status).toBe(400);
  expect(goTarget(" 0x84Cf6667FdE676a5950730720b67d62B9AB476Df ", "/wallet/", "/wallet")).toBe(`/wallet/${A}`);
  const old = await handle(new Request("https://onenft.click/0x84Cf6667FdE676a5950730720b67d62B9AB476Df"));
  expect(old.status).toBe(301);
  const robots = await (await handle(new Request("https://onenft.click/robots.txt"))).text();
  expect(robots).toContain("Disallow: /wallet/");
});

test("the Faces facts the hub states match the Faces site's own spec (skipped when the sister repo is not checked out beside this one)", async () => {
  const path = new URL("../../onenft-faces/src/api.ts", import.meta.url).pathname;
  if (!(await Bun.file(path).exists())) return;
  const spec = await import(path).then((m) => m.specJson());
  expect(spec.maxSupply).toBe(FACES_MAX);
  expect(spec.maxPins).toBe(FACES_MAX_PINS);
  expect(spec.pinPricesEth[1]).toBe(FACES_FIRST_PIN_ETH);
  expect(spec.pinPricesEth[FACES_MAX_PINS]).toBe(FACES_ALL_PINS_ETH);
});

test("facts from a collection are tiles in its section; malformed ones are clipped or dropped", () => {
  const w = wallet();
  expect(w.states[1].facts).toEqual([{ figure: "Day 1", label: "the first knot" }, { figure: "<b>", label: "x".repeat(160) }]);
  const h = walletPage([], w, "pawelorzech.eth");
  expect(h).toContain('<span class="fig syne">Day 1</span><span class="lab">the first knot</span>');
  expect(h).toContain('<span class="fig syne">&lt;b&gt;</span>');
  expect((h.match(/class="facts"/g) ?? []).length).toBe(1);
});
