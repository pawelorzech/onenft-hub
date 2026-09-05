import { test, expect } from "bun:test";
import { homePage, walletPage, goTarget, pageColors, FALLBACK, mix } from "./site.ts";
import { colorsOf, todayOf, tallyOf, newestOf, rollsOf, tokensOf, type CollectionState, type Wallet } from "./state.ts";
import { COLLECTIONS } from "./collections.ts";
import { handle, OWN } from "./server.ts";

const knotToday = { day: 3, date: "2026-09-07", state: "taken", owner: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", ownerName: "pawelorzech.eth", image: "https://knot.onenft.click/day/3.svg", url: "https://knot.onenft.click/day/3", palette: { bg: "#0b1d51", cord: "#f2e9d8" } };
const facesState = { totalSupply: 12, maxSupply: 10000, poolLeft: 49, recent: [{ id: 12, owner: "0x2222222222222222222222222222222222222222", ownerName: null, treasury: false, image: "https://faces.onenft.click/face/12.svg", url: "https://faces.onenft.click/face/12" }] };
const blitToday = { day: 3, date: "2026-09-07", state: "free", owner: null, ownerName: null, image: "https://blit.onenft.click/day/3.svg", url: "https://blit.onenft.click/day/3", colors: ["#000", "#fff", "#f00", "#0f0"] };

function states(withKnot = true): CollectionState[] {
  return COLLECTIONS.map((c) => {
    if (c.slug === "knot") return { c, today: withKnot ? todayOf(knotToday) : null, tally: withKnot ? { taken: 2, gaps: 0, author: 0 } : null, fetchedAt: 1 };
    if (c.slug === "blit") return { c, today: todayOf(blitToday), tally: { taken: 1, gaps: 1, author: 0 }, fetchedAt: 1 };
    if (c.slug === "faces") return { c, today: newestOf(facesState, c.host), tally: null, rolls: rollsOf(facesState), fetchedAt: 1 };
    return { c, today: null, tally: null, fetchedAt: 0 };
  });
}

test("colors come from the knot's palette, with a fallback", () => {
  expect(colorsOf(knotToday)).toEqual({ bg: "#0b1d51", fg: "#f2e9d8" });
  expect(colorsOf(blitToday)).toEqual({ bg: null, fg: null });
  expect(pageColors(states())).toEqual({ bg: "#0b1d51", fg: "#f2e9d8" });
  expect(pageColors(states(false))).toEqual(FALLBACK);
  expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
});

test("tally counts states", () => {
  expect(tallyOf([{ state: "author" }, { state: "taken" }, { state: "gap" }, { state: "free" }])).toEqual({ taken: 2, gaps: 1, author: 1 });
});

test("home page lists every collection and the totals", () => {
  const h = homePage(states());
  for (const c of COLLECTIONS) {
    expect(h).toContain(`id="${c.slug}"`);
    expect(h).toContain(`href="https://${c.host}/"`);
  }
  expect(h).toContain("Day 3</span>, 2026-09-07, taken by pawelorzech.eth.");
  expect(h).toContain("still nobody's, free to claim");
  expect(h).toContain("The site did not answer.");
  expect(h).toContain(">3</div>");
  expect(h).toContain("Face #12</span>, the newest, rolled by 0x2222…2222.");
  expect(h).toContain("of 10,000 rolled");
  expect(h).toContain("12 faces rolled");
  expect(h).toContain("--bg:#0b1d51;--fg:#f2e9d8");
  expect(h).toContain('og:image" content="https://knot.onenft.click/day/3.png"');
  expect(h).not.toContain("—");
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
  expect(await h.text()).toBe("ok, 4 collections");
});

const A = "0x84Cf6667FdE676a5950730720b67d62B9AB476Df";
function wallet(): Wallet {
  const by = (slug: string) => COLLECTIONS.find((c) => c.slug === slug)!;
  return {
    address: A,
    name: "pawelorzech.eth",
    fetchedAt: 1,
    states: [
      { c: by("faces"), ok: true, tokens: tokensOf(by("faces"), { faces: [{ id: 12, image: "https://faces.onenft.click/face/12.svg", url: "https://faces.onenft.click/face/12" }] }) },
      { c: by("knot"), ok: true, tokens: tokensOf(by("knot"), { days: [{ day: 1, image: "https://knot.onenft.click/day/1.svg", url: "https://knot.onenft.click/day/1", traits: { palette: "ultramarine" }, palette: { bg: "#0e1430" } }, { day: 3, image: "https://knot.onenft.click/day/3.svg", url: "https://knot.onenft.click/day/3", traits: { palette: "pine" }, palette: { bg: "#0c1a1a" } }] }) },
      { c: by("blit"), ok: true, tokens: [] },
      { c: by("chainrun"), ok: false, tokens: [] },
    ],
  };
}

test("tokens normalize daily days and rolled faces the same way", () => {
  const w = wallet();
  expect(w.states[0].tokens[0]).toMatchObject({ id: 12, label: "Face #12", caption: "face 12", bg: null });
  expect(w.states[1].tokens[1]).toMatchObject({ id: 3, label: "Day 3", caption: "day 3, pine", bg: "#0c1a1a" });
});

test("wallet page: Faces first, one section per collection, three chips per token, a failed site is marked", () => {
  const h = walletPage(states(), wallet(), A);
  expect(h.indexOf('id="faces"')).toBeLessThan(h.indexOf('id="knot"'));
  expect(h).toContain("<h1 class=\"syne\">pawelorzech.eth</h1>");
  expect(h).toContain(">3</div>");
  expect(h).toContain("1 face, 2 knots, 0 blits");
  expect((h.match(/data-dl="png"/g) ?? []).length).toBe(3);
  expect(h).toContain('data-prefix="knot" data-pixel="0" data-bg="#0e1430"');
  expect(h).toContain('data-prefix="faces" data-pixel="1"');
  expect(h).toContain("Nothing here yet.");
  expect(h).toContain("did not answer");
  expect(h).toContain('href="https://chainrun.onenft.click/yours"');
  expect(h).toContain('class="sizes"');
  expect(h).toContain("onenft_size");
  expect(h).toContain(`/api/wallet/${A}.json`);
  expect(h).not.toContain("—");
});

test("wallet page without an address asks for one and links each site's Yours page", () => {
  const h = walletPage(states(), null);
  expect(h).toContain('id="connect"');
  expect(h).toContain('action="/go"');
  for (const c of COLLECTIONS) expect(h).toContain(`https://${c.host}/yours`);
  expect(h).not.toContain("onenft_size");
});

test("home page links the wallet page and lists Faces first", () => {
  const h = homePage(states());
  expect(h).toContain('href="/wallet">Your wallet</a>');
  expect(h.indexOf('id="faces"')).toBeLessThan(h.indexOf('id="knot"'));
});

test("/wallet routes: own paths, prefix match, /go validation, bad handles bounce", async () => {
  expect(OWN.has("/wallet")).toBe(true);
  const g = await handle(new Request("https://onenft.click/go?who=pawelorzech.eth"));
  expect(g.status).toBe(302);
  expect(g.headers.get("location")).toBe("/wallet/pawelorzech.eth");
  const bad = await handle(new Request("https://onenft.click/go?who=junk"));
  expect(bad.headers.get("location")).toBe("/wallet");
  const bounce = await handle(new Request("https://onenft.click/wallet/junk"));
  expect(bounce.status).toBe(302);
  expect(bounce.headers.get("location")).toBe("/wallet");
  const badJson = await handle(new Request("https://onenft.click/api/wallet/junk.json"));
  expect(badJson.status).toBe(200);
  expect((await badJson.json()).error).toContain("not an address");
  expect(goTarget(" 0x84Cf6667FdE676a5950730720b67d62B9AB476Df ", "/wallet/", "/wallet")).toBe(`/wallet/${A}`);
  const old = await handle(new Request("https://onenft.click/0x84Cf6667FdE676a5950730720b67d62B9AB476Df"));
  expect(old.status).toBe(301);
});
