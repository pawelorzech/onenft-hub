/**
 * The landing page. It has no palette of its own: the colors come from the
 * knot's palette of the day, the same rule every collection follows. When the
 * knot cannot be reached the page falls back to near-black on near-white.
 *
 * Copy rules: plain words, active voice, no adverbs, no em dashes, nothing a
 * reader could misunderstand. Facts (numbers, addresses, paths) stay exact.
 */
import { COLLECTIONS, PALETTE_SOURCE } from "./collections.ts";
import type { CollectionState } from "./state.ts";

export const SITE = "onenft.click";
export const REPO = "https://github.com/pawelorzech/onenft-hub";
export const TOKEN_CONTRACT = "https://github.com/pawelorzech/onenft/blob/master/contracts/src/OneNFT.sol";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const num = (n: number) => n.toLocaleString("en-US");
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

export type Colors = { bg: string; fg: string };
export const FALLBACK: Colors = { bg: "#f4f2ec", fg: "#141414" };

export function pageColors(states: CollectionState[]): Colors {
  const src = states.find((s) => s.c.slug === PALETTE_SOURCE)?.today;
  return src?.bg && src?.fg ? { bg: src.bg, fg: src.fg } : FALLBACK;
}

function css(p: Colors): string {
  const { fg, bg } = p;
  return `
:root{--bg:${bg};--fg:${fg};--muted:${mix(fg, bg, 0.38)};--line:${mix(fg, bg, 0.82)};--soft:${mix(fg, bg, 0.955)}}
*{box-sizing:border-box}
html{background:var(--bg);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:17px;line-height:1.5}
body{margin:0;min-height:100vh}
a{color:inherit}
a:focus-visible{outline:3px solid var(--fg);outline-offset:3px}
.syne{font-family:"Syne",system-ui,sans-serif}
.page{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:100vh}
aside{border-right:1px solid var(--line);padding:38px 32px}
aside .stick{position:sticky;top:38px;display:flex;flex-direction:column;gap:28px}
.mark{font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}
h1{font-weight:800;font-size:33px;line-height:.96;letter-spacing:-.045em;margin:0;overflow-wrap:anywhere}
.lead{color:var(--muted);margin:0}
hr{border:0;border-top:1px solid var(--line);margin:0;width:100%}
.big{font-weight:700;font-size:40px;line-height:1}
.small{font-size:15px;color:var(--muted)}
.cta{display:flex;align-items:center;justify-content:center;height:58px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:700;font-size:18px}
.cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--fg)}
.coll{padding:38px 34px 34px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,396px) minmax(240px,1fr);gap:32px;align-items:start}
.coll .art{width:100%;max-width:396px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line);display:block}
.coll .art.pixel{image-rendering:pixelated}
.coll .meta{display:flex;flex-direction:column;gap:18px;padding-top:6px}
.coll h2{font-weight:800;font-size:44px;line-height:.95;letter-spacing:-.03em;margin:0}
.coll p{margin:0}
.coll .ctas{display:flex;flex-direction:column;gap:10px;max-width:360px}
.tally{display:flex;gap:28px;flex-wrap:wrap}
.tally b{display:block;font-weight:700;font-size:28px;line-height:1}
.tally span{font-size:15px;color:var(--muted)}
.prose{max-width:640px;padding:38px 34px;display:flex;flex-direction:column;gap:22px}
.prose h2{font-weight:800;font-size:34px;line-height:1;letter-spacing:-.03em;margin:22px 0 0}
.prose p{margin:0}
.prose code{font-family:ui-monospace,Menlo,monospace;font-size:.92em}
.prose ul{margin:0;padding-left:22px}
footer{padding:26px 34px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;color:var(--muted);font-size:16px;border-top:1px solid var(--line)}
footer nav{display:flex;gap:20px;flex-wrap:wrap}
@media (max-width:1180px){
 .coll{grid-template-columns:1fr}
 .coll .art{max-width:460px}
 .coll .meta{max-width:520px}
}
@media (max-width:900px){
 .page{grid-template-columns:1fr}
 aside{border-right:0;border-bottom:1px solid var(--line);padding:18px 20px}
 aside .stick{position:static;gap:18px}
 h1{font-size:40px}
 .coll{padding:20px;gap:16px}
 .coll .art{max-width:100%}
 .coll h2{font-size:36px}
 footer,.prose{padding:20px}
}
`;
}

const UMAMI_URL = process.env.UMAMI_URL ?? "";
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? "";
const ANALYTICS = UMAMI_URL && UMAMI_WEBSITE_ID ? `<script defer src="${UMAMI_URL}/script.js" data-website-id="${UMAMI_WEBSITE_ID}"></script>` : "";
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Newsreader:opsz,wght@6..72,400&display=swap">`;
const DESCRIPTION = "Daily on-chain collections on Base. Each one mints one token a day, drawn from the clock of the chain. Free, CC0, gaps included.";

export function layout(title: string, p: Colors, body: string, image: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${DESCRIPTION}">
<meta name="theme-color" content="${p.bg}">
<link rel="icon" href="https://knot.onenft.click/today.svg" type="image/svg+xml">
<link rel="canonical" href="https://${SITE}/">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://${SITE}/">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${ANALYTICS}
<style>${css(p)}</style>
</head>
<body>${body}</body>
</html>`;
}

function stateLine(s: CollectionState): string {
  const t = s.today;
  if (s.c.kind === "rolls") {
    if (!s.rolls) return `<p class="small">The site did not answer. <a href="https://${s.c.host}">Open it</a>.</p>`;
    if (!t) return `<p>Nobody has rolled yet.</p>`;
    const who = t.state === "author" ? "the treasury's daily roll" : `rolled by ${esc(t.ownerName ?? shortAddr(t.owner ?? ""))}`;
    return `<p><span class="syne" style="font-weight:700">Face #${num(t.day)}</span>, the newest, ${who}.</p>`;
  }
  if (!t) return `<p class="small">The site did not answer. <a href="https://${s.c.host}">Open it</a>.</p>`;
  const who = t.state === "author" ? "the author's day" : t.state === "taken" ? `taken by ${esc(t.ownerName ?? shortAddr(t.owner ?? ""))}` : t.state === "free" ? "still nobody's, free to claim" : "today";
  return `<p><span class="syne" style="font-weight:700">Day ${num(t.day)}</span>, ${esc(t.date)}, ${who}.</p>`;
}

export function shortAddr(a: string): string {
  return a.length >= 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function tallyBlock(s: CollectionState): string {
  if (s.c.kind === "rolls") {
    const r = s.rolls;
    if (!r) return "";
    return `<div class="tally syne"><div><b>${num(r.rolled)}</b><span>of ${num(r.max)} rolled</span></div><div><b>${num(r.poolLeft)}</b><span>1/1 left</span></div></div>`;
  }
  const y = s.tally;
  if (!y) return "";
  return `<div class="tally syne"><div><b>${num(y.taken)}</b><span>${plural(y.taken, "day", "days")} taken</span></div><div><b>${num(y.gaps)}</b><span>${plural(y.gaps, "gap", "gaps")}</span></div><div><b>${num(y.author)}</b><span>author's</span></div></div>`;
}

function collectionBlock(s: CollectionState): string {
  const c = s.c;
  const img = s.today?.image ?? `https://${c.host}/today.svg`;
  const dayUrl = s.today?.url ?? `https://${c.host}/`;
  const alt = c.kind === "rolls" ? `The newest face at ${c.host}` : `Today at ${c.host}`;
  return `<section class="coll" id="${c.slug}">
<a href="https://${c.host}/"><img class="art${c.pixel ? " pixel" : ""}" src="${img}" alt="${alt}" width="396" height="396"></a>
<div class="meta">
<h2 class="syne">${esc(c.name)}</h2>
<p>${esc(c.line)} ${esc(c.source)}</p>
${stateLine(s)}
${tallyBlock(s)}
<div class="ctas">
<a class="cta syne" href="https://${c.host}/">Open ${c.host}</a>
<a class="cta ghost syne" href="${dayUrl}">${c.kind === "rolls" ? "Newest face" : "Today's page"}</a>
</div>
<p class="small"><a href="https://${c.host}/how">How it works</a> · <a href="${c.opensea}">OpenSea</a>${c.contract ? ` · <a href="https://basescan.org/address/${c.contract}">Contract</a>` : ""} · <a href="${c.repo}">Code</a></p>
</div>
</section>`;
}

export function homePage(states: CollectionState[]): string {
  const p = pageColors(states);
  const taken = states.reduce((a, s) => a + (s.tally?.taken ?? 0), 0);
  const gaps = states.reduce((a, s) => a + (s.tally?.gaps ?? 0), 0);
  const rolled = states.reduce((a, s) => a + (s.rolls?.rolled ?? 0), 0);
  const daily = states.filter((s) => s.c.kind === "daily").length;
  const knot = states.find((s) => s.c.slug === PALETTE_SOURCE);
  const ogImage = knot?.today ? knot.today.image.replace(/\.svg$/, ".png") : "https://knot.onenft.click/today.png";
  const body = `<div class="page">
<aside><div class="stick">
<a class="mark syne" href="/">${SITE}</a>
<h1 class="syne">One a day, on chain, forever.</h1>
<p class="lead">${states.length} ${plural(states.length, "collection", "collections")} live here, drawn on chain from the clock of the Base chain. ${daily} of them mint one token a day; a day nobody claims stays empty forever. One lets every wallet roll a face a day.</p>
<hr>
<div><div class="big syne">${num(taken)}</div><p class="small">${plural(taken, "day", "days")} taken across the daily collections, ${num(gaps)} ${plural(gaps, "gap", "gaps")}${rolled ? `, ${num(rolled)} ${plural(rolled, "face", "faces")} rolled` : ""}</p></div>
<hr>
<nav class="small" style="display:flex;flex-direction:column;gap:6px">${states.map((s) => `<a href="#${s.c.slug}">${esc(s.c.name)}</a>`).join("")}<a href="#format">The format</a></nav>
</div></aside>
<main>
${states.map(collectionBlock).join("\n")}
<div class="prose" id="format">
<h2 class="syne">The format</h2>
<p>The daily collections follow the same rules. One token a day, <code>tokenId</code> equal to the day number, day 1 on 5 September 2026. The day is <code>block.timestamp / 86400</code>, rounded down. The image is built by a renderer contract from the day number alone and returned as a <code>data:</code> URI. No server is in the loop and no file can go missing.</p>
<ul>
<li>Free to claim, gas only. No price, no royalties, no allowlist. Not an investment.</li>
<li>Every tenth day up to day 1000 goes to the author. That is the whole cut, written into the contract on day one.</li>
<li>A day nobody claims stays empty. The gaps are part of the work.</li>
<li>Everything is CC0: images, generators, contracts, sites.</li>
<li>The token contract is the same in every collection: <a href="${TOKEN_CONTRACT}">OneNFT.sol</a>. Only the renderer differs, and only the renderer can be swapped, for future days only.</li>
</ul>
<p><strong>Faces</strong> breaks the format on purpose: one roll per wallet a day instead of one token a day, pins for a small fee, a cap of 10,000, and a pool of one of ones that empties with the supply. Its rules are on <a href="https://faces.onenft.click/how">its own how page</a>.</p>
<p>Each site has a <code>/how</code> page that writes the draw out in full so you can port it to any language, a <code>/spec.json</code> with the tables, and a JSON API at <code>/api/today</code>, <code>/api/day/N</code> and <code>/api/days</code>. This page reads those. Its own list is at <a href="/api/collections.json">/api/collections.json</a>.</p>
<p>The page borrows its colors from the knot of the day, the way each collection borrows from its own day. There is no light or dark mode.</p>
<h2 class="syne">Start one</h2>
<p>Take <a href="${TOKEN_CONTRACT}">the token contract</a>, write a renderer, and point the site code at it. The three repos above are the worked examples. If you ship one, say so and it can be listed here.</p>
</div>
<footer><span>This is not an investment and never will be. Everything is CC0.</span><nav>${COLLECTIONS.map((c) => `<a href="https://${c.host}">${esc(c.name)}</a>`).join("")}<a href="/api/collections.json">JSON</a><a href="${REPO}">Code</a></nav></footer>
</main>
</div>`;
  return layout(`${SITE}, one a day, on chain`, p, body, ogImage);
}
