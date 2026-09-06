/**
 * The landing page. It has no palette of its own: the colors come from the
 * knot's palette of the day, the same rule every collection follows. When the
 * knot cannot be reached the page falls back to near-black on near-white.
 *
 * Copy rules: plain words, active voice, no adverbs, no em dashes, nothing a
 * reader could misunderstand. Facts (numbers, addresses, paths) stay exact.
 */
import { COLLECTIONS, PALETTE_SOURCE, FACES_MAX, FACES_MAX_PINS, FACES_FIRST_PIN_ETH, FACES_ALL_PINS_ETH, type Collection } from "./collections.ts";
import type { CollectionState, Wallet, WalletState } from "./state.ts";

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
function luminance(c: string): number {
  const ch = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hex(c).map((x) => ch(x / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function pulled(fg: string, bg: string, from: number, min: number): string {
  for (let t = from; t > 0; t -= 0.01) {
    const c = mix(fg, bg, t);
    if (contrast(c, bg) >= min) return c;
  }
  return fg;
}
export const mutedFor = (fg: string, bg: string) => pulled(fg, bg, 0.38, 4.5);
export const edgeFor = (fg: string, bg: string) => pulled(fg, bg, 0.6, 3);
export function textFor(fg: string, bg: string): string {
  if (contrast(fg, bg) >= 4.5) return fg;
  const ink = contrast("#000000", bg) >= contrast("#ffffff", bg) ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(fg, ink, t);
    if (contrast(c, bg) >= 4.5) return c;
  }
  return ink;
}
export function cssVars(cord: string, bg: string): string {
  const fg = textFor(cord, bg);
  return `--bg:${bg};--fg:${fg};--muted:${mutedFor(fg, bg)};--edge:${edgeFor(fg, bg)};--line:${mix(fg, bg, 0.82)};--soft:${mix(fg, bg, 0.955)}`;
}

export type Colors = { bg: string; fg: string };
export const FALLBACK: Colors = { bg: "#f4f2ec", fg: "#141414" };

export function pageColors(states: CollectionState[]): Colors {
  const src = states.find((s) => s.c.slug === PALETTE_SOURCE)?.today;
  return src?.bg && src?.fg ? { bg: src.bg, fg: src.fg } : FALLBACK;
}

function css(p: Colors): string {
  return `
:root{${cssVars(p.fg, p.bg)}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{background:var(--bg);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:17px;line-height:1.5}
body{margin:0;min-height:100vh}
a{color:inherit}
a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--fg);outline-offset:3px}
.skip{position:absolute;left:-999px;top:8px;background:var(--fg);color:var(--bg);padding:8px 14px;font-weight:700;z-index:9}
.skip:focus{left:8px}
.syne{font-family:"Syne",system-ui,sans-serif}
.page{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:100vh}
aside{border-right:1px solid var(--line);padding:38px 32px}
aside .stick{position:sticky;top:38px;display:flex;flex-direction:column;gap:28px}
.mark{font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}
h1{font-weight:800;font-size:33px;line-height:.96;letter-spacing:-.045em;margin:0;overflow-wrap:normal;hyphens:manual}
.lead{color:var(--muted);margin:0}
hr{border:0;border-top:1px solid var(--line);margin:0;width:100%}
.big{font-weight:700;font-size:40px;line-height:1}
.small{font-size:15px;color:var(--muted)}
.cta{display:flex;align-items:center;justify-content:center;min-height:58px;padding:0 16px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:700;font-size:18px;text-align:center}
.cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--fg)}
button.cta{border:0;cursor:pointer;width:100%;font-family:"Syne",system-ui,sans-serif}
button.cta[disabled]{opacity:.55;cursor:default}
.note{padding:12px 16px;border:1px solid var(--edge);font-size:15px;color:var(--fg);margin:0}
.coll{padding:38px 34px 34px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,396px) minmax(240px,1fr);gap:32px;align-items:start}
.coll .art{width:100%;height:auto;max-width:396px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line);display:block;background:var(--soft)}
.coll .art.pixel{image-rendering:pixelated}
.coll .meta{display:flex;flex-direction:column;gap:18px;padding-top:6px}
.coll h2{font-weight:800;font-size:44px;line-height:.95;letter-spacing:-.03em;margin:0}
.coll h2 a{text-decoration:none}
.coll h2 a:hover{text-decoration:underline;text-underline-offset:6px}
.coll p{margin:0}
.coll .ctas{display:flex;flex-direction:column;gap:10px;max-width:360px}
.coll .cta{min-height:50px;font-size:17px}
.status{font-size:15px;color:var(--muted)}
.tally{display:flex;gap:28px;flex-wrap:wrap}
.tally b{display:block;font-weight:700;font-size:28px;line-height:1}
.tally span{font-size:15px;color:var(--muted)}
.counts{display:flex;gap:34px;flex-wrap:wrap;padding:22px 34px;border-bottom:1px solid var(--line)}
.counts b{display:block;font-weight:700;font-size:26px;line-height:1}
.sitenav{display:flex;gap:4px 22px;flex-wrap:wrap;padding:6px 34px;border-bottom:1px solid var(--line)}
.sitenav a,footer nav a,.links a{display:inline-flex;align-items:center;min-height:44px}
.links{display:flex;gap:4px 18px;flex-wrap:wrap}
.prose{max-width:640px;padding:38px 34px;display:flex;flex-direction:column;gap:22px}
.prose h2{font-weight:800;font-size:34px;line-height:1;letter-spacing:-.03em;margin:22px 0 0}
.prose p{margin:0}
.prose code{font-family:ui-monospace,Menlo,monospace;font-size:.92em}
.prose ul{margin:0;padding-left:22px}
footer{padding:26px 34px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;color:var(--muted);font-size:16px;border-top:1px solid var(--line)}
footer nav{display:flex;gap:6px 20px;flex-wrap:wrap}
.who{display:flex;flex-direction:column;gap:10px}
.who .cta{font-size:17px;min-height:50px}
.who label{font-size:15px;color:var(--muted)}
.field{height:50px;padding:0 14px;border:1px solid var(--edge);background:transparent;color:var(--fg);width:100%;font-family:ui-monospace,Menlo,monospace;font-size:14px}
.field::placeholder{color:var(--muted)}
.msg{font-size:15px;color:var(--muted);min-height:1.5em;margin:0}
.wname{overflow-wrap:normal;word-break:keep-all}
.wcoll{padding:34px 34px 30px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:18px}
.wcoll .head{display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap}
.wcoll h2{font-weight:800;font-size:34px;line-height:.95;letter-spacing:-.03em;margin:0}
.wcoll h2 span{font-weight:400;font-size:17px;color:var(--muted);letter-spacing:0;margin-left:12px;font-family:"Newsreader",Georgia,serif}
.facts{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line);max-width:1120px}
.facts li{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:18px 20px 16px;display:flex;flex-direction:column;gap:6px;min-width:0}
.facts .fig{font-weight:800;font-size:28px;line-height:1;letter-spacing:-.03em;white-space:nowrap}
.facts .lab{font-size:15px;color:var(--muted);line-height:1.35}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.strip .tile{display:flex;flex-direction:column;gap:6px}
.strip img{width:100%;aspect-ratio:1;display:block;box-shadow:0 0 0 1px var(--line);background:var(--soft)}
.strip img.pixel{image-rendering:pixelated}
.strip .cap{font-size:14px;color:var(--muted)}
.strip .cap a{text-decoration:none}
.get{display:flex;gap:6px;flex-wrap:wrap}
.get a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 12px;border:1px solid var(--edge);color:var(--fg);text-decoration:none;font-size:13px;font-weight:700;font-family:"Syne",system-ui,sans-serif}
.get a:hover{border-color:var(--fg)}
.get a[aria-busy="true"]{opacity:.6;cursor:progress}
.sizes{display:flex;border:1px solid var(--edge)}
.sizes button{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--muted);border:0;border-right:1px solid var(--line);background:transparent;font-family:"Syne",system-ui,sans-serif;cursor:pointer}
.sizes button:last-child{border-right:0}
.sizes button[aria-pressed="true"]{background:var(--soft);color:var(--fg);font-weight:700}
.crumb{margin:0}
.crumb ol{list-style:none;margin:0;padding:0;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.crumb li{display:flex;gap:10px;align-items:baseline}
.crumb .sep{color:var(--line);font-weight:800;font-size:20px}
.crumb span[aria-current]{color:var(--muted);font-size:16px}
.top nav a,.nav a,.sitenav a,footer nav a,.links a,.cats a{font-family:"Syne",system-ui,sans-serif;font-weight:700;font-size:14px;letter-spacing:.01em;text-decoration:none;color:var(--muted)}
.top nav a:hover,.nav a:hover,.sitenav a:hover,footer nav a:hover,.links a:hover,.cats a:hover{color:var(--fg);text-decoration:underline;text-underline-offset:4px}
.top nav,.sitenav,footer nav,.links{gap:2px 24px}
@media (max-width:1180px){
 .coll{grid-template-columns:1fr}
 .coll .art{max-width:460px}
 .coll .meta{max-width:520px}
}
@media (max-width:900px){
 .wcoll,.counts{padding:20px}
 .page{grid-template-columns:1fr}
 aside{border-right:0;border-bottom:1px solid var(--line);padding:18px 20px}
 aside .stick{position:static;gap:16px}
 h1{font-size:38px}
 .coll{padding:20px;gap:16px}
 .coll .art{max-width:100%}
 .coll h2{font-size:36px}
 .sitenav{padding:4px 20px}
 footer,.prose{padding:20px}
}
@media (max-width:360px){h1{font-size:29px}.mark{font-size:17px}}
`;
}

const UMAMI_URL = process.env.UMAMI_URL ?? "";
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? "";
const ANALYTICS = UMAMI_URL && UMAMI_WEBSITE_ID ? `<script defer src="${esc(UMAMI_URL)}/script.js" data-website-id="${esc(UMAMI_WEBSITE_ID)}"></script>` : "";
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Newsreader:opsz,wght@6..72,400&display=swap">`;
const daily = COLLECTIONS.filter((c) => c.kind === "daily");
const DESCRIPTION = `${COLLECTIONS.length} on-chain collections on Base. ${daily.map((c) => c.name).join(", ")} offer one token per UTC day; Faces lets each wallet roll one face a day, up to ${num(FACES_MAX)}; ONE mints pixel coins backed by USDC. CC0.`;
/** What one token of a collection is called in a link or a label. */
export function tokenWord(c: Collection, n: number): string {
  return c.kind === "rolls" ? `Face #${num(n)}` : c.kind === "coins" ? `Coin #${num(n)}` : `Day ${num(n)}`;
}
/** The plural for "Your faces", "Your days". */
export function tokensWord(c: Collection): string {
  return c.kind === "rolls" ? "faces" : c.kind === "coins" ? "coins" : "days";
}

/** `path` is the page's own path; a wallet page is not indexed, since it names an address. */
export function layout(title: string, p: Colors, body: string, image: string, path = "/", index = true, description?: string): string {
  const alt = "Today's knot at knot.onenft.click, the card of " + SITE;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description ?? DESCRIPTION)}">
<meta name="theme-color" content="${p.bg}">
${index ? "" : '<meta name="robots" content="noindex">'}
<link rel="icon" href="https://knot.onenft.click/today.svg" type="image/svg+xml">
<link rel="canonical" href="https://${SITE}${esc(path)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description ?? DESCRIPTION)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://${SITE}${esc(path)}">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:locale" content="en_US">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description ?? DESCRIPTION)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(alt)}">
${FONTS}
${ANALYTICS}
<style>${css(p)}</style>
</head>
<body><a class="skip" href="#main">Skip to content</a>${body}</body>
</html>`;
}

/** The breadcrumb of the hub itself: the site, and on inner pages the page. */
export function crumb(current?: string): string {
  const here = current ? `<li><span class="sep syne" aria-hidden="true">/</span><span aria-current="page">${esc(current)}</span></li>` : "";
  return `<nav class="crumb" aria-label="Breadcrumb"><ol><li><a class="mark syne" href="/"${current ? "" : ' aria-current="page"'}>${SITE}</a></li>${here}</ol></nav>`;
}
export function shortAddr(a: string): string {
  return a.length >= 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function ago(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
}
/** One line on how fresh a collection's block is. Silent when fresh. */
function freshness(s: CollectionState): string {
  if (!s.status.known) return `<p class="status">Status unavailable. ${esc(s.c.name)} did not answer.</p>`;
  if (!s.today && !s.tally && !s.rolls) return `<p class="status">Status unavailable. ${esc(s.c.name)} answered, but not with anything this page can show.</p>`;
  const parts: string[] = [];
  if (s.status.stale) parts.push(`Showing data from ${ago(s.fetchedAt)}${s.status.error ? `; ${esc(s.c.name)} did not answer since` : ""}`);
  if (s.upstream && !s.upstream.known) parts.push(`${esc(s.c.name)} reports its own chain data as unavailable`);
  else if (s.upstream?.stale) parts.push(`${esc(s.c.name)} reports its own chain data as stale`);
  return parts.length ? `<p class="status">${parts.join(". ")}.</p>` : `<p class="status">Updated ${ago(s.fetchedAt)}.</p>`;
}

const DAILY_STATE: Record<string, string> = { author: "reserved for the author", taken: "claimed", free: "available today", gap: "unclaimed", unknown: "status unavailable" };

function stateLine(s: CollectionState): string {
  const t = s.today;
  if (s.c.kind === "rolls" || s.c.kind === "coins") {
    if (!s.rolls) return "";
    if (!t) return `<p>Nobody has ${s.c.kind === "coins" ? "minted" : "rolled"} yet.</p>`;
    const owner = t.ownerName ?? (t.owner ? shortAddr(t.owner) : null);
    const who = t.state === "author" ? (s.c.kind === "coins" ? "a founder coin" : "the treasury's daily roll") : owner ? `held by ${esc(owner)}` : s.c.preview ? "from the preview series" : "";
    return `<p><span class="syne" style="font-weight:700">${tokenWord(s.c, t.day)}</span>, the newest${who ? `, ${who}` : ""}.</p>`;
  }
  if (!t) return "";
  const owner = t.ownerName ?? (t.owner ? shortAddr(t.owner) : null);
  const who = t.state === "taken" && owner ? `claimed, held by ${esc(owner)}` : DAILY_STATE[t.state ?? "unknown"] ?? "status unavailable";
  return `<p><span class="syne" style="font-weight:700">Day ${num(t.day)}</span>${t.date ? `, ${esc(t.date)}` : ""}, ${who}.</p>`;
}

function tallyBlock(s: CollectionState): string {
  if (s.c.kind === "rolls" || s.c.kind === "coins") {
    const r = s.rolls;
    if (!r) return "";
    const coins = s.c.kind === "coins";
    return `<div class="tally syne"><div><b>${num(r.rolled)}</b><span>of ${num(r.max)} ${coins ? `minted${s.c.preview ? " in the preview" : ""}` : "rolled"}</span></div>${r.pending ? `<div><b>${num(r.pending)}</b><span>being revealed</span></div>` : ""}<div><b>${num(r.poolLeft)}</b><span>${coins ? "Master Coins left" : "one of ones left"}</span></div></div>`;
  }
  const y = s.tally;
  if (!y) return "";
  return `<div class="tally syne"><div><b>${num(y.taken)}</b><span>${plural(y.taken, "day", "days")} claimed</span></div><div><b>${num(y.gaps)}</b><span>${plural(y.gaps, "gap", "gaps")}</span></div><div><b>${num(y.author)}</b><span>author's</span></div></div>`;
}

function collectionBlock(s: CollectionState, i: number): string {
  const c = s.c;
  const img = s.today?.image ?? (c.kind === "coins" ? `https://${c.host}/newest.svg` : `https://${c.host}/today.svg`);
  const tokenUrl = s.today?.url ?? null;
  const alt = c.kind !== "daily" ? (s.today ? `${tokenWord(c, s.today.day)}, the newest at ${c.host}` : `The newest at ${c.host}`) : (s.today ? `Day ${s.today.day} at ${c.host}` : `Today at ${c.host}`);
  return `<section class="coll" id="${c.slug}" aria-labelledby="h-${c.slug}">
<a href="${tokenUrl ?? `https://${c.host}/`}" aria-label="${esc(alt)}"><img class="art${c.pixel ? " pixel" : ""}" src="${esc(img)}" alt="" width="396" height="396"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}></a>
<div class="meta">
<h2 class="syne" id="h-${c.slug}"><a href="https://${c.host}/">${esc(c.name)}</a></h2>
<p>${esc(c.line)} ${esc(c.source)}</p>
${stateLine(s)}
${tallyBlock(s)}
${freshness(s)}
<div class="ctas">
<a class="cta syne" href="https://${c.host}/">Explore ${esc(c.name)}</a>
${tokenUrl ? `<a class="cta ghost syne" href="${esc(tokenUrl)}">${tokenWord(c, s.today!.day)}, the one above</a>` : ""}
</div>
<p class="small">${c.host}</p>
<nav class="links small" aria-label="${esc(c.name)} links"><a href="https://${c.host}/how">How it works</a><a href="https://${c.host}/yours">Your ${tokensWord(c)}</a>${c.opensea ? `<a href="${c.opensea}">OpenSea</a>` : ""}${c.contract ? `<a href="https://basescan.org/address/${c.contract}">Contract</a>` : ""}<a href="${c.repo}">Code</a></nav>
</div>
</section>`;
}

export function homePage(states: CollectionState[]): string {
  const p = pageColors(states);
  const known = states.filter((s) => s.tally);
  const taken = known.reduce((a, s) => a + (s.tally?.taken ?? 0), 0);
  const gaps = known.reduce((a, s) => a + (s.tally?.gaps ?? 0), 0);
  const faces = states.find((s) => s.c.kind === "rolls");
  const rolled = faces?.rolls?.rolled ?? null;
  const knot = states.find((s) => s.c.slug === PALETTE_SOURCE);
  const ogImage = knot?.today ? knot.today.image.replace(/\.svg$/, ".png") : "https://knot.onenft.click/today.png";
  const dailyNames = daily.map((c) => c.name);
  const dailyList = dailyNames.length > 1 ? `${dailyNames.slice(0, -1).join(", ")} and ${dailyNames[dailyNames.length - 1]}` : dailyNames[0];
  const body = `<div class="page">
<aside><div class="stick">
${crumb()}
<h1 class="syne">On-chain art, one day at a time.</h1>
<p class="lead">Explore ${COLLECTIONS.length} collections on Base. ${dailyList} offer one token per UTC day. Faces lets each wallet roll once a day, while supply remains.</p>
</div></aside>
<main id="main">
<nav class="sitenav small" aria-label="Site">${states.map((s) => `<a href="#${s.c.slug}">${esc(s.c.name)}</a>`).join("")}<a href="#format">The format</a><a href="/wallet">Your wallet</a></nav>
${states.map(collectionBlock).join("\n")}
<section class="counts syne" aria-label="Totals"><div><b>${known.length ? num(taken) : "?"}</b><span class="small">${plural(taken, "day", "days")} claimed across ${known.length} of ${daily.length} daily collections</span></div><div><b>${known.length ? num(gaps) : "?"}</b><span class="small">${plural(gaps, "gap", "gaps")}</span></div><div><b>${rolled === null ? "?" : num(rolled)}</b><span class="small">${plural(rolled ?? 0, "face", "faces")} rolled</span></div></section>
<div class="prose" id="format">
<h2 class="syne">The format</h2>
<p>The daily collections (${dailyList}) follow the same rules. One token a day, <code>tokenId</code> equal to the day number, day 1 on 5 September 2026. The day is <code>block.timestamp / 86400</code>, rounded down. The image is built by a renderer contract from the day number alone and returned as a <code>data:</code> URI. The image and its rules live on chain; this site and the collection sites only show them, and they need a working chain connection to do so.</p>
<ul>
<li>0 ETH mint fee, network gas only. No price, no royalties, no allowlist. Not an investment.</li>
<li>Every tenth day up to day 1000 goes to the author. That is the whole cut, written into the contract on day one.</li>
<li>A day nobody claims stays empty. It can no longer be minted once the day has ended; the gaps are part of the work.</li>
<li>Images are CC0. Each site's assets page says what else is, and under which license.</li>
<li>The daily collections share one token contract, <a href="${TOKEN_CONTRACT}">OneNFT.sol</a>; only the renderer differs, and only the renderer can be swapped, for future days only.</li>
</ul>
<p><strong>Faces</strong> has its own contract and its own rules: one roll per wallet each UTC day while supply remains, up to ${FACES_MAX_PINS} pins for a fee that starts at ${FACES_FIRST_PIN_ETH} ETH and doubles with every pin up to ${FACES_ALL_PINS_ETH} ETH, a cap of ${num(FACES_MAX)}, and a pool of one of ones that empties with the supply. Its API differs too. Everything is on <a href="https://faces.onenft.click/how">its how page</a>.</p>
<p>Each daily site has a <code>/how</code> page that writes the draw out in full so you can port it to any language, a <code>/spec.json</code> with the tables, and a JSON API at <code>/api/today</code>, <code>/api/summary</code>, <code>/api/day/N</code> and <code>/api/days</code>. Faces answers at <code>/api/state</code>. This page reads those. Its own list is at <a href="/api/collections.json">/api/collections.json</a>.</p>
<p>The page borrows its colors from the knot of the day, the way each collection borrows from its own day. There is no light or dark mode.</p>
<h2 class="syne">Start one</h2>
<p>Take <a href="${TOKEN_CONTRACT}">the token contract</a>, write a renderer, and point the site code at it. The ${daily.length} daily repos above are the worked examples. If you ship one, say so and it can be listed here.</p>
</div>
<footer><span>This is not an investment and never will be. Images are CC0.</span><nav aria-label="Footer"><a href="/wallet">Your wallet</a>${COLLECTIONS.map((c) => `<a href="https://${c.host}">${esc(c.name)}</a>`).join("")}<a href="/api/collections.json">JSON</a><a href="${REPO}">Code</a></nav></footer>
</main>
</div>`;
  return layout(`${SITE}, on-chain art, one day at a time`, p, body, ogImage, "/");
}

// ---- wallet page: connect, downloads, routing helpers (kept in step with the collection sites)

export const SIZES = [1024, 2048, 4096];

export function connectScript(base = "/", entry = false): string {
  return `<script>
(function(){
var BASE=${JSON.stringify(base)};var ENTRY=${entry ? "true" : "false"};var KEY='onenft_who';var btn=document.getElementById('connect');var out=document.getElementById('msg');var last=document.getElementById('last');
function say(t){if(out)out.textContent=t}
function here(a){return location.pathname.toLowerCase()===(BASE+a).toLowerCase()}
function remember(a){try{localStorage.setItem(KEY,a)}catch(e){}}
function offer(a,label){if(!last||here(a))return;var l=last.querySelector('a');l.href=BASE+a;l.textContent=a.slice(0,6)+'\\u2026'+a.slice(-4);last.firstChild.textContent=label+': ';last.hidden=false}
var who=null;try{who=localStorage.getItem(KEY)}catch(e){}
if(who&&/^0x[0-9a-fA-F]{40}$/.test(who))offer(who,'Last time here');
if(!btn)return;var eth=window.ethereum;
if(!eth||!eth.request){btn.disabled=true;btn.textContent='No wallet detected';say('No wallet detected. Enter a public address to browse, or open this site in your wallet\\u2019s browser to connect.');return}
function known(accs){if(!accs||!accs.length){btn.textContent='Connect wallet';btn.onclick=null;btn.disabled=false;return}var a=accs[0];remember(a);if(here(a)){btn.textContent='This is your wallet';btn.disabled=true;return}if(ENTRY){location.replace(BASE+a);return}btn.textContent='Your wallet';btn.disabled=false;btn.onclick=function(){location.href=BASE+a};offer(a,'Connected')}
eth.request({method:'eth_accounts'}).then(known).catch(function(){});
if(eth.on){eth.on('accountsChanged',known);eth.on('disconnect',function(){known([])})}
btn.addEventListener('click',async function(){if(btn.onclick)return;btn.disabled=true;
  try{var accs=await eth.request({method:'eth_requestAccounts'});if(!accs||!accs.length)throw new Error('the wallet gave no account');var acc=accs[0];remember(acc);location.href=BASE+acc}
  catch(e){say(e&&e.code===4001?'Cancelled in the wallet.':e&&e.code===-32002?'The wallet is already asking. Open it to answer.':'Failed: '+((e&&e.message)||e));btn.disabled=false}});
})();
</script>`;
}

/** Downloads drawn in the browser, the same script the collection sites use: one at a time, every step with a timeout. */
export function downloadScript(prefix = "onenft", pixel = false): string {
  return `<script>
(function(){
var PREFIX=${JSON.stringify(prefix)};var PIXEL=${pixel ? "true" : "false"};var KEY='onenft_size';var SIZES=${JSON.stringify(SIZES)};
var size=2048;try{var s=+localStorage.getItem(KEY);if(SIZES.indexOf(s)>=0)size=s}catch(e){}
var out=document.getElementById('msg');function say(t){if(out)out.textContent=t}
var picks=document.querySelectorAll('.sizes button');
function paint(){picks.forEach(function(b){b.setAttribute('aria-pressed',String(+b.getAttribute('data-size')===size))})}
picks.forEach(function(b){b.addEventListener('click',function(){size=+b.getAttribute('data-size');try{localStorage.setItem(KEY,String(size))}catch(e){}paint()})});paint();
document.querySelectorAll('[data-js]').forEach(function(el){el.hidden=false});
function save(blob,name){var a=document.createElement('a');var u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(u);a.remove()},10000)}
function timeout(ms,what){return new Promise(function(_,no){setTimeout(function(){no(new Error(what+' took too long'))},ms)})}
var busy=false;
document.querySelectorAll('[data-dl]').forEach(function(el){el.addEventListener('click',async function(ev){
  ev.preventDefault();if(busy){say('One download at a time. The other one is still drawing.');return}
  var kind=el.getAttribute('data-dl');var n=el.getAttribute('data-id')||el.getAttribute('data-day');var unit=el.getAttribute('data-unit')||'day';var prefix=el.getAttribute('data-prefix')||PREFIX;
  var pixel=el.hasAttribute('data-pixel')?el.getAttribute('data-pixel')==='1':PIXEL;var bg=el.getAttribute('data-bg')||'#000000';
  busy=true;var was=el.textContent;el.textContent='\\u2026';el.setAttribute('aria-busy','true');say('');var u=null;
  try{
    var ctl=new AbortController();var t=setTimeout(function(){ctl.abort()},20000);
    var res;try{res=await fetch(el.getAttribute('data-src'),{signal:ctl.signal})}finally{clearTimeout(t)}
    if(!res.ok)throw new Error('the image answered '+res.status);var text=await res.text();
    if(kind==='svg'){save(new Blob([text],{type:'image/svg+xml'}),prefix+'-'+unit+'-'+n+'.svg');return}
    text=text.replace(/ width="\\d+" height="\\d+"/,' width="'+size+'" height="'+size+'"');
    u=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));var img=new Image();
    await Promise.race([new Promise(function(ok,no){img.onload=ok;img.onerror=function(){no(new Error('the browser could not draw the image'))};img.src=u}),timeout(20000,'drawing')]);
    if(img.decode){try{await img.decode()}catch(e){}}
    var c=document.createElement('canvas');c.width=size;c.height=size;var ctx=c.getContext('2d');if(!ctx)throw new Error('the browser gave no canvas');ctx.imageSmoothingEnabled=!pixel;
    if(kind==='jpeg'){ctx.fillStyle=bg;ctx.fillRect(0,0,size,size)}
    ctx.drawImage(img,0,0,size,size);
    var blob=await Promise.race([new Promise(function(ok){c.toBlob(ok,kind==='jpeg'?'image/jpeg':'image/png',0.92)}),timeout(30000,'encoding')]);
    if(!blob)throw new Error('the browser gave no file, try a smaller size');
    save(blob,prefix+'-'+unit+'-'+n+'-'+size+(kind==='jpeg'?'.jpg':'.png'));c.width=c.height=1;
  }catch(e){say('Download failed: '+((e&&e.name==='AbortError')?'the image took too long':((e&&e.message)||e)))}
  finally{if(u)URL.revokeObjectURL(u);el.textContent=was;el.removeAttribute('aria-busy');busy=false}
})});
})();
</script>`;
}

/** A wallet name or address in a heading: smaller when long, and it may break only before a dot. */
export function nameHeading(name: string): string {
  const size = name.length <= 11 ? "" : name.length <= 16 ? ' style="font-size:26px"' : ' style="font-size:20px;letter-spacing:-.02em"';
  return `<span class="wname"${size}>${esc(name).replace(/\./g, "<wbr>.")}</span>`;
}

/** Where /go?who=... sends a typed address or ENS name. Anything else goes back to the form with the reason. */
export function goTarget(who: string | null, base = "/", back = "/yours"): string {
  const w = (who ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(w) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/i.test(w)) return base + w;
  return `${back}?bad=${encodeURIComponent(w.slice(0, 80))}`;
}

// ---- the wallet page: one address, every collection

/** What one token of each collection is called, for the counts in the sidebar. */
const UNIT: Record<string, [string, string]> = { knot: ["knot", "knots"], blit: ["blit", "blits"], chainrun: ["runner", "runners"], faces: ["face", "faces"], one: ["coin", "coins"] };
function unit(c: Collection, n: number): string {
  const u = UNIT[c.slug] ?? ["token", "tokens"];
  return plural(n, u[0], u[1]);
}

function walletSection(s: WalletState): string {
  const c = s.c;
  const n = s.tokens.length;
  const head = `<div class="head"><h2 class="syne" id="w-${c.slug}">${esc(c.name)}<span>${s.ok ? `${n} ${unit(c, n)}` : s.tokens.length ? `${n} ${unit(c, n)} as of ${ago(s.fetchedAt)}` : "could not be checked"}</span></h2><a class="small" href="https://${c.host}/yours">Your ${tokensWord(c)} on ${c.host}</a></div>`;
  if (!s.ok && !n) return `<section class="wcoll" id="${c.slug}" aria-labelledby="w-${c.slug}">${head}<p class="small">${esc(c.name)} could not be checked. <a href="">Try again</a>, or <a href="https://${c.host}/yours">look there</a>.</p></section>`;
  const note = !s.ok ? `<p class="small">${esc(c.name)} did not answer just now. This is its last answer, from ${ago(s.fetchedAt)}. <a href="">Try again</a>.</p>` : "";
  if (!n) return `<section class="wcoll" id="${c.slug}" aria-labelledby="w-${c.slug}">${head}${note}<p class="small">Nothing here yet.</p></section>`;
  const tiles = s.tokens.map((t) => {
    const d = `data-id="${t.id}" data-unit="${t.unit}" data-src="${esc(t.image)}" data-prefix="${c.slug}" data-pixel="${c.pixel ? 1 : 0}"${t.bg ? ` data-bg="${esc(t.bg)}"` : ""}`;
    const png = t.image.replace(/\.svg(\?.*)?$/, "-1024.png$1");
    return `<div class="tile"><a href="${esc(t.url)}"><img src="${esc(t.image)}" alt="${esc(t.label)}" loading="lazy"${c.pixel ? ' class="pixel"' : ""}></a><div class="cap"><a href="${esc(t.url)}">${esc(t.caption)}</a></div><div class="get"><a href="${esc(t.image)}" download="${c.slug}-${t.unit}-${t.id}.svg" data-dl="svg" ${d} aria-label="Download SVG of ${esc(t.label)}">SVG</a><a href="${esc(png)}" download="${c.slug}-${t.unit}-${t.id}-1024.png" data-dl="png" ${d} aria-label="Download PNG of ${esc(t.label)}">PNG</a><a href="${esc(png)}" data-dl="jpeg" ${d} hidden data-js aria-label="Download JPEG of ${esc(t.label)}">JPEG</a></div></div>`;
  });
  const facts = s.facts.length ? `<ul class="facts" aria-label="About these ${tokensWord(c)}">${s.facts.map((f) => `<li><span class="fig syne">${esc(f.figure)}</span><span class="lab">${esc(f.label)}</span></li>`).join("")}</ul>` : "";
  return `<section class="wcoll" id="${c.slug}" aria-labelledby="w-${c.slug}">${head}${note}${facts}<div class="strip">${tiles.join("")}</div></section>`;
}

function whoBlock(): string {
  return `<div class="who"><button class="cta syne" id="connect" type="button">Connect wallet</button><form action="/go" method="get" style="display:flex;flex-direction:column;gap:8px"><label for="who">Wallet address or ENS name</label><input class="field" id="who" name="who" placeholder="0x1234… or name.eth" autocomplete="off" spellcheck="false" required pattern="^\\s*(0x[0-9a-fA-F]{40}|[a-zA-Z0-9-]+(\\.[a-zA-Z0-9-]+)*\\.eth)\\s*$" title="A 42-character address starting with 0x, or an ENS name ending in .eth"><button class="cta ghost syne" type="submit">View wallet</button></form></div>
<p class="msg" id="msg" aria-live="polite"></p>
<p class="small" id="last" hidden>Last time here: <a href="/wallet">…</a>.</p>`;
}

/** /wallet (no address yet) and /wallet/<who>. Colors follow the home page. */
export function walletPage(states: CollectionState[], wallet: Wallet | null, handle = "", bad: string | null = null): string {
  const p = pageColors(states);
  const total = wallet ? wallet.states.reduce((a, s) => a + s.tokens.length, 0) : 0;
  const checked = wallet ? wallet.states.filter((s) => s.ok).length : 0;
  const missing = wallet ? wallet.states.filter((s) => !s.ok).map((s) => s.c.name) : [];
  const parts = wallet ? wallet.states.filter((s) => s.ok || s.tokens.length).map((s) => `${s.tokens.length} ${unit(s.c, s.tokens.length)}`).join(", ") : "";
  const rawName = wallet ? wallet.name ?? (wallet.address ? shortAddr(wallet.address) : handle) : "Your wallet";
  const title = wallet ? nameHeading(rawName) : "Your wallet";
  const sizes = `<div><p class="small" style="margin:0 0 8px" id="sizelab">PNG and JPEG size</p><div class="sizes" role="group" aria-labelledby="sizelab">${SIZES.map((s) => `<button type="button" data-size="${s}" aria-pressed="${s === 2048}">${s}</button>`).join("")}</div></div>`;
  const found = wallet
    ? checked === wallet.states.length
      ? `${num(total)} ${plural(total, "token", "tokens")} in this wallet${parts ? `: ${parts}` : ""}`
      : `Found ${num(total)} ${plural(total, "token", "tokens")} in ${checked} of ${wallet.states.length} collections. ${missing.join(", ")} could not be checked.`
    : "";
  const body = `<div class="page">
<aside><div class="stick">
${crumb(wallet ? rawName : "Your wallet")}
<h1 class="syne">${title}</h1>
<p class="lead">${wallet ? `Every token this wallet holds across the collections here. Save any of them as SVG, PNG or JPEG.${wallet.address && wallet.name ? ` <span class="small">${shortAddr(wallet.address)}</span>` : ""}` : "Connect a wallet or type an address, and this page lists every token it holds across the collections here, each one ready to save as SVG, PNG or JPEG."}</p>
<hr>
${wallet ? `<div><div class="big syne">${checked ? num(total) : "?"}</div><p class="small">${found}</p></div>\n<hr>` : ""}
${bad !== null ? `<p class="note" role="alert">"${esc(bad)}" is not a wallet address or an ENS name. An address is 42 characters starting with 0x; a name ends in .eth.</p>` : ""}
${whoBlock()}
<p class="small">Viewing a wallet needs no transaction and no signature. Its public address appears in the page URL and is sent to this site and to each collection site to load its tokens. Each site connects to a wallet on its own.</p>
${wallet && total ? `<hr>\n${sizes}` : ""}
<hr>
<nav class="small" style="display:flex;flex-direction:column;gap:6px" aria-label="Collections">${states.map((s) => `<a href="${wallet ? `#${s.c.slug}` : `https://${s.c.host}/yours`}">${esc(s.c.name)}</a>`).join("")}<a href="/">All collections</a></nav>
</div></aside>
<main id="main">
${wallet ? wallet.states.map(walletSection).join("\n") : states.map((s) => `<section class="wcoll" id="${s.c.slug}"><div class="head"><h2 class="syne">${esc(s.c.name)}</h2><a class="small" href="https://${s.c.host}/yours">Your ${tokensWord(s.c)} on ${s.c.host}</a></div></section>`).join("\n")}
<footer><span>This is not an investment and never will be. Images are CC0.${wallet?.address ? ` <a href="/api/wallet/${wallet.address}.json">JSON</a>` : ""}</span><nav aria-label="Footer">${COLLECTIONS.map((c) => `<a href="https://${c.host}">${esc(c.name)}</a>`).join("")}<a href="/">All collections</a></nav></footer>
</main>
</div>
${connectScript("/wallet/", !wallet)}
${wallet && total ? downloadScript("onenft", false) : ""}`;
  return layout(`${rawName}, ${SITE}`, p, body, "https://knot.onenft.click/today.png", wallet ? `/wallet/${wallet.address ?? handle}` : "/wallet", !wallet, wallet ? `${num(total)} ${plural(total, "token", "tokens")} across the collections at ${SITE}, held by ${rawName}.` : undefined);
}
