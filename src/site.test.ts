import { test, expect } from "bun:test";
import { homePage, pageColors, FALLBACK, mix } from "./site.ts";
import { colorsOf, todayOf, tallyOf, newestOf, rollsOf, type CollectionState } from "./state.ts";
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
