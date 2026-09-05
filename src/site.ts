/**
 * The landing page. It has no palette of its own: the colors come from the
 * knot's palette of the day, the same rule every collection follows. When the
 * knot cannot be reached the page falls back to near-black on near-white.
 *
 * Copy rules: plain words, active voice, no adverbs, no em dashes, nothing a
 * reader could misunderstand. Facts (numbers, addresses, paths) stay exact.
 */
import { COLLECTIONS, PALETTE_SOURCE, type Collection } from "./collections.ts";
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
.who{display:flex;flex-direction:column;gap:10px}
.who .cta{font-size:17px;height:50px}
.field{height:50px;padding:0 14px;border:1px solid var(--line);background:transparent;color:var(--fg);width:100%;font-family:ui-monospace,Menlo,monospace;font-size:14px}
.field::placeholder{color:var(--muted)}
.msg{font-size:15px;color:var(--muted);min-height:1.5em;margin:0}
.wcoll{padding:34px 34px 30px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:18px}
.wcoll .head{display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap}
.wcoll h2{font-weight:800;font-size:34px;line-height:.95;letter-spacing:-.03em;margin:0}
.wcoll h2 span{font-weight:400;font-size:17px;color:var(--muted);letter-spacing:0;margin-left:12px;font-family:"Newsreader",Georgia,serif}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.strip .tile{display:flex;flex-direction:column;gap:6px}
.strip img{width:100%;aspect-ratio:1;display:block;box-shadow:0 0 0 1px var(--line)}
.strip img.pixel{image-rendering:pixelated}
.strip .cap{font-size:14px;color:var(--muted)}
.strip .cap a{text-decoration:none}
.get{display:flex;gap:6px}
.get a{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 9px;border:1px solid var(--line);color:var(--muted);text-decoration:none;font-size:13px;font-weight:700;font-family:"Syne",system-ui,sans-serif}
.get a:hover{border-color:var(--fg);color:var(--fg)}
.sizes{display:flex;border:1px solid var(--line)}
.sizes button{flex:1;height:40px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--muted);border:0;border-right:1px solid var(--line);background:transparent;font-family:"Syne",system-ui,sans-serif;cursor:pointer}
.sizes button:last-child{border-right:0}
.sizes button[aria-pressed="true"]{background:var(--soft);color:var(--fg);font-weight:700}
@media (max-width:1180px){
 .coll{grid-template-columns:1fr}
 .coll .art{max-width:460px}
 .coll .meta{max-width:520px}
}
@media (max-width:900px){
 .wcoll{padding:20px}
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
<nav class="small" style="display:flex;flex-direction:column;gap:6px">${states.map((s) => `<a href="#${s.c.slug}">${esc(s.c.name)}</a>`).join("")}<a href="#format">The format</a><a href="/wallet">Your wallet</a></nav>
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
<footer><span>This is not an investment and never will be. Everything is CC0.</span><nav><a href="/wallet">Your wallet</a>${COLLECTIONS.map((c) => `<a href="https://${c.host}">${esc(c.name)}</a>`).join("")}<a href="/api/collections.json">JSON</a><a href="${REPO}">Code</a></nav></footer>
</main>
</div>`;
  return layout(`${SITE}, one a day, on chain`, p, body, ogImage);
}

// ---- wallet page: connect, downloads, routing helpers (kept in step with the collection sites)

export const SIZES = [1024, 2048, 4096];

/**
 * Connect button: asks the wallet for an account and opens that wallet's page.
 * `base` is the path the address is appended to ("/" here, "/wallet/" on the hub).
 * Also fills the "last time here" link from the browser's memory.
 */
export function connectScript(base = "/"): string {
  return `<script>
(function(){
var BASE=${JSON.stringify(base)};var KEY='onenft_who';var btn=document.getElementById('connect');var out=document.getElementById('msg');var last=document.getElementById('last');
function say(t){if(out)out.textContent=t}
var who=null;try{who=localStorage.getItem(KEY)}catch(e){}
if(last&&who&&/^0x[0-9a-fA-F]{40}$/.test(who)&&location.pathname.toLowerCase()!==(BASE+who).toLowerCase()){var a=last.querySelector('a');a.href=BASE+who;a.textContent=who.slice(0,6)+'\\u2026'+who.slice(-4);last.hidden=false}
if(!btn)return;var eth=window.ethereum;
if(!eth||!eth.request){btn.disabled=true;btn.textContent='No wallet in this browser';return}
btn.addEventListener('click',async function(){btn.disabled=true;
  try{var accs=await eth.request({method:'eth_requestAccounts'});if(!accs||!accs.length)throw new Error('the wallet gave no account');var acc=accs[0];try{localStorage.setItem(KEY,acc)}catch(e){}location.href=BASE+acc}
  catch(e){say(e&&e.code===4001?'Cancelled in the wallet.':'Failed: '+((e&&e.message)||e));btn.disabled=false}});
})();
</script>`;
}

/**
 * Downloads drawn in the browser. Fetches the SVG, sets its size to the pick,
 * draws it on a canvas and saves PNG or JPEG. JPEG has no alpha, so it gets the
 * day's background first. Pixel art turns smoothing off. data-dl="svg" saves the
 * fetched file as is, for pages on another origin than the image.
 */
export function downloadScript(prefix = "onenft", pixel = false): string {
  return `<script>
(function(){
var PREFIX=${JSON.stringify(prefix)};var PIXEL=${pixel ? "true" : "false"};var KEY='onenft_size';var SIZES=${JSON.stringify(SIZES)};
var size=2048;try{var s=+localStorage.getItem(KEY);if(SIZES.indexOf(s)>=0)size=s}catch(e){}
var out=document.getElementById('msg');function say(t){if(out)out.textContent=t}
var picks=document.querySelectorAll('.sizes button');
function paint(){picks.forEach(function(b){b.setAttribute('aria-pressed',String(+b.getAttribute('data-size')===size))})}
picks.forEach(function(b){b.addEventListener('click',function(){size=+b.getAttribute('data-size');try{localStorage.setItem(KEY,String(size))}catch(e){}paint()})});paint();
function save(blob,name){var a=document.createElement('a');var u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(u);a.remove()},2000)}
document.querySelectorAll('[data-dl]').forEach(function(el){el.addEventListener('click',async function(ev){
  ev.preventDefault();var kind=el.getAttribute('data-dl');var n=el.getAttribute('data-day');var prefix=el.getAttribute('data-prefix')||PREFIX;
  var pixel=el.hasAttribute('data-pixel')?el.getAttribute('data-pixel')==='1':PIXEL;var bg=el.getAttribute('data-bg')||'#000000';
  var was=el.textContent;el.textContent='\\u2026';say('');
  try{
    var res=await fetch(el.getAttribute('data-src'));if(!res.ok)throw new Error('the image answered '+res.status);var text=await res.text();
    if(kind==='svg'){save(new Blob([text],{type:'image/svg+xml'}),prefix+'-day-'+n+'.svg');return}
    text=text.replace(/ width="\\d+" height="\\d+"/,' width="'+size+'" height="'+size+'"');
    var u=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));var img=new Image();
    try{await new Promise(function(ok,no){img.onload=ok;img.onerror=function(){no(new Error('the browser could not draw the image'))};img.src=u})}finally{setTimeout(function(){URL.revokeObjectURL(u)},0)}
    var c=document.createElement('canvas');c.width=size;c.height=size;var ctx=c.getContext('2d');ctx.imageSmoothingEnabled=!pixel;
    if(kind==='jpeg'){ctx.fillStyle=bg;ctx.fillRect(0,0,size,size)}
    ctx.drawImage(img,0,0,size,size);
    var blob=await new Promise(function(ok){c.toBlob(ok,kind==='jpeg'?'image/jpeg':'image/png',0.92)});
    if(!blob)throw new Error('the browser gave no file');
    save(blob,prefix+'-day-'+n+'-'+size+(kind==='jpeg'?'.jpg':'.png'));
  }catch(e){say('Download failed: '+((e&&e.message)||e))}
  finally{el.textContent=was}
})});
})();
</script>`;
}

/** Where /go?who=... sends a typed address or ENS name. Anything else goes back to the form. */
export function goTarget(who: string | null, base = "/", back = "/yours"): string {
  const w = (who ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(w) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/i.test(w)) return base + w;
  return back;
}

// ---- the wallet page: one address, every collection

/** What one token of each collection is called, for the counts in the sidebar. */
const UNIT: Record<string, [string, string]> = { knot: ["knot", "knots"], blit: ["blit", "blits"], chainrun: ["runner", "runners"], faces: ["face", "faces"] };
function unit(c: Collection, n: number): string {
  const u = UNIT[c.slug] ?? ["token", "tokens"];
  return plural(n, u[0], u[1]);
}

function walletSection(s: WalletState): string {
  const c = s.c;
  const n = s.tokens.length;
  const head = `<div class="head"><h2 class="syne">${esc(c.name)}<span>${s.ok ? `${n} ${unit(c, n)}` : "did not answer"}</span></h2><a class="small" href="https://${c.host}/">Open ${c.host}</a></div>`;
  if (!s.ok) return `<section class="wcoll" id="${c.slug}">${head}<p class="small">The site did not answer. Try again in a minute, or <a href="https://${c.host}/yours">look there</a>.</p></section>`;
  if (!n) return `<section class="wcoll" id="${c.slug}">${head}<p class="small">Nothing here yet.</p></section>`;
  const tiles = s.tokens.map((t) => {
    const d = `data-day="${t.id}" data-src="${esc(t.image)}" data-prefix="${c.slug}" data-pixel="${c.pixel ? 1 : 0}"${t.bg ? ` data-bg="${esc(t.bg)}"` : ""}`;
    return `<div class="tile"><a href="${esc(t.url)}"><img src="${esc(t.image)}" alt="${esc(t.label)}" loading="lazy"${c.pixel ? ' class="pixel"' : ""}></a><div class="cap"><a href="${esc(t.url)}">${esc(t.caption)}</a></div><div class="get"><a href="${esc(t.image)}" data-dl="svg" ${d}>SVG</a><a href="${esc(t.image)}" data-dl="png" ${d}>PNG</a><a href="${esc(t.image)}" data-dl="jpeg" ${d}>JPEG</a></div></div>`;
  });
  return `<section class="wcoll" id="${c.slug}">${head}<div class="strip">${tiles.join("")}</div></section>`;
}

function whoBlock(): string {
  return `<div class="who"><button class="cta syne" id="connect" type="button">Connect wallet</button><form action="/go" method="get" style="display:flex;flex-direction:column;gap:10px"><input class="field" name="who" placeholder="0x… or name.eth" autocomplete="off" spellcheck="false" aria-label="Wallet address or ENS name" required><button class="cta ghost syne" type="submit">Show</button></form></div>
<p class="msg" id="msg" aria-live="polite"></p>
<p class="small" id="last" hidden>Last time here: <a href="/wallet">…</a>.</p>`;
}

/** /wallet (no address yet) and /wallet/<who>. Colors follow the home page. */
export function walletPage(states: CollectionState[], wallet: Wallet | null, handle = ""): string {
  const p = pageColors(states);
  const total = wallet ? wallet.states.reduce((a, s) => a + s.tokens.length, 0) : 0;
  const parts = wallet ? wallet.states.filter((s) => s.ok).map((s) => `${s.tokens.length} ${unit(s.c, s.tokens.length)}`).join(", ") : "";
  const title = wallet ? esc(wallet.name ?? (wallet.address ? shortAddr(wallet.address) : handle)) : "Your wallet";
  const sizes = `<div><p class="small" style="margin:0 0 8px">PNG and JPEG size</p><div class="sizes" role="group" aria-label="Image size">${SIZES.map((s) => `<button type="button" data-size="${s}" aria-pressed="${s === 2048}">${s}</button>`).join("")}</div></div>`;
  const body = `<div class="page">
<aside><div class="stick">
<a class="mark syne" href="/">${SITE}</a>
<h1 class="syne">${title}</h1>
<p class="lead">${wallet ? `Every token this wallet holds across the collections here. Save any of them as SVG, PNG or JPEG.${wallet.address && wallet.name ? ` <span class="small">${shortAddr(wallet.address)}</span>` : ""}` : "Connect a wallet or type an address, and this page lists every token it holds across the collections here, each one ready to save as SVG, PNG or JPEG."}</p>
<hr>
${wallet ? `<div><div class="big syne">${num(total)}</div><p class="small">${plural(total, "token", "tokens")} in this wallet${parts ? `: ${parts}` : ""}</p></div>\n<hr>` : ""}
${whoBlock()}
${wallet && total ? `<hr>\n${sizes}` : ""}
<hr>
<nav class="small" style="display:flex;flex-direction:column;gap:6px">${states.map((s) => `<a href="${wallet ? `#${s.c.slug}` : `https://${s.c.host}/yours`}">${esc(s.c.name)}</a>`).join("")}<a href="/">All collections</a></nav>
</div></aside>
<main>
${wallet ? wallet.states.map(walletSection).join("\n") : states.map((s) => `<section class="wcoll" id="${s.c.slug}"><div class="head"><h2 class="syne">${esc(s.c.name)}</h2><a class="small" href="https://${s.c.host}/yours">Your ${s.c.kind === "rolls" ? "faces" : "days"} on ${s.c.host}</a></div></section>`).join("\n")}
<footer><span>This is not an investment and never will be. Everything is CC0.${wallet?.address ? ` <a href="/api/wallet/${wallet.address}.json">JSON</a>` : ""}</span><nav>${COLLECTIONS.map((c) => `<a href="https://${c.host}">${esc(c.name)}</a>`).join("")}<a href="/">Home</a></nav></footer>
</main>
</div>
${connectScript("/wallet/")}
${wallet && total ? downloadScript("onenft", false) : ""}`;
  return layout(`${wallet ? title : "Your wallet"}, ${SITE}`, p, body, "https://knot.onenft.click/today.png");
}
