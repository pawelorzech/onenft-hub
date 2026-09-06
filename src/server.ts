import { allStates, walletOf } from "./state.ts";
import { homePage, walletPage, goTarget, SITE } from "./site.ts";
import { COLLECTIONS } from "./collections.ts";
import { startAnnouncer, announcerStatus } from "./announce.ts";

const PORT = Number(process.env.PORT ?? 3000);
const BOOT_AT = Date.now();
/** Where the knot lived until 2026-09-05. Every path this site does not own goes there. */
export const KNOT = "https://knot.onenft.click";

const html = (s: string, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const json = (o: unknown, maxAge = 15, status = 200) =>
  new Response(JSON.stringify(o, null, 1), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 && maxAge > 0 ? `public, max-age=${maxAge}` : "no-store", "access-control-allow-origin": "*" } });
const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });

/** Paths this site answers itself. Everything else belonged to the knot and redirects there. */
export const OWN = new Set(["/", "/api/collections.json", "/health", "/ready", "/robots.txt", "/wallet", "/go"]);
/** An address or ENS name, the same rule the collection sites use. */
const WHO = /^(0x[0-9a-fA-F]{40}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth)$/i;

function withHeaders(res: Response): Response {
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  res.headers.set("x-frame-options", "SAMEORIGIN");
  return res;
}

export async function handle(req: Request): Promise<Response> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return withHeaders(new Response("bad request", { status: 400, headers: { "content-type": "text/plain" } }));
  }
  try {
    return withHeaders(await route(url));
  } catch (e) {
    console.error(`route ${url.pathname}:`, (e as Error).message);
    return withHeaders(url.pathname.startsWith("/api/") ? json({ error: "internal error" }, 0, 500) : new Response("internal error", { status: 500, headers: { "content-type": "text/plain" } }));
  }
}

async function route(url: URL): Promise<Response> {
  const path = url.pathname;
  if (url.hostname === `www.${SITE}`) return redirect(`https://${SITE}${path}${url.search}`);
  const wallet = path.match(/^\/(api\/)?wallet\/([^/]+?)(\.json)?$/);
  if (!OWN.has(path) && !wallet) return redirect(`${KNOT}${path}${url.search}`);
  // Liveness never waits on an upstream; readiness reports each one.
  if (path === "/health") { const a = announcerStatus(); return new Response(`ok, ${COLLECTIONS.length} collections, up ${Math.floor((Date.now() - BOOT_AT) / 1000)} s, announcer ${a.enabled ? `on${a.dryRun ? " (dry run)" : ""} (${a.auth ?? "no auth"}), ${a.seen} seen, ${a.posted} posted, ${a.failed} failed${a.lastError ? `, last error: ${a.lastError}` : ""}` : "off"}`); }
  if (path === "/ready") {
    const states = await allStates();
    const ok = states.some((s) => s.status.known);
    return json({ ok, collections: states.map((s) => ({ slug: s.c.slug, known: s.status.known, stale: s.status.stale, ageSeconds: s.status.ageSeconds, error: s.status.error, upstream: s.upstream })) }, 0, ok ? 200 : 503);
  }
  if (path === "/robots.txt") return new Response("User-agent: *\nAllow: /\nDisallow: /wallet/\nDisallow: /api/\n", { headers: { "content-type": "text/plain" } });
  if (path === "/go") return redirect(goTarget(url.searchParams.get("who"), "/wallet/", "/wallet"), 302);
  if (wallet) {
    let who: string;
    try {
      who = decodeURIComponent(wallet[2]);
    } catch {
      // Malformed percent-encoding is a bad request, never an exception.
      return wallet[1] ? json({ error: "malformed address" }, 0, 400) : redirect(`/wallet?bad=${encodeURIComponent(wallet[2].slice(0, 80))}`, 302);
    }
    if (!WHO.test(who)) return wallet[1] ? json({ error: "not an address or ENS name" }, 0, 400) : redirect(`/wallet?bad=${encodeURIComponent(who.slice(0, 80))}`, 302);
    const w = await walletOf(who);
    if (wallet[1]) {
      const checked = w.states.filter((s) => s.ok).length;
      return json({ site: SITE, address: w.address, name: w.name, checked, of: w.states.length, fetchedAt: new Date(w.fetchedAt).toISOString(), collections: w.states.map((s) => ({ slug: s.c.slug, name: s.c.name, host: s.c.host, ok: s.ok, error: s.error, fetchedAt: s.fetchedAt ? new Date(s.fetchedAt).toISOString() : null, tokens: s.tokens })) }, 0, checked ? 200 : 503);
    }
    return html(walletPage(await allStates(), w, who));
  }
  const states = await allStates();
  if (path === "/wallet") return html(walletPage(states, null, "", url.searchParams.get("bad")));
  if (path === "/api/collections.json") {
    return json({
      site: SITE,
      collections: states.map((s) => ({
        slug: s.c.slug,
        name: s.c.name,
        url: `https://${s.c.host}/`,
        kind: s.c.kind,
        api: s.c.kind === "rolls" ? `https://${s.c.host}/api/state` : `https://${s.c.host}/api/summary`,
        holder: `https://${s.c.host}/api/holder/ADDRESS`,
        contract: s.c.contract,
        chainId: 8453,
        repo: s.c.repo,
        today: s.today,
        tally: s.tally,
        rolls: s.rolls ?? null,
        hub: { known: s.status.known, stale: s.status.stale, fetchedAt: s.fetchedAt ? new Date(s.fetchedAt).toISOString() : null, error: s.status.error },
        upstream: s.upstream,
      })),
    });
  }
  return html(homePage(states));
}

if (import.meta.main) {
  Bun.serve({ port: PORT, fetch: handle });
  console.log(`${SITE} on :${PORT}`);
  startAnnouncer();
}
