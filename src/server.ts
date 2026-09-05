import { allStates, walletOf } from "./state.ts";
import { homePage, walletPage, goTarget, SITE } from "./site.ts";
import { COLLECTIONS } from "./collections.ts";

const PORT = Number(process.env.PORT ?? 3000);
/** Where the knot lived until 2026-09-05. Every path this site does not own goes there. */
export const KNOT = "https://knot.onenft.click";

const html = (s: string, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const json = (o: unknown, maxAge = 15) =>
  new Response(JSON.stringify(o, null, 1), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}`, "access-control-allow-origin": "*" } });
const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });

/** Paths this site answers itself. Everything else belonged to the knot and redirects there. */
export const OWN = new Set(["/", "/api/collections.json", "/health", "/robots.txt", "/wallet", "/go"]);
/** An address or ENS name, the same rule the collection sites use. */
const WHO = /^(0x[0-9a-fA-F]{40}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth)$/i;

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (url.hostname === `www.${SITE}`) return redirect(`https://${SITE}${path}${url.search}`);
  const wallet = path.match(/^\/(api\/)?wallet\/([^/]+?)(\.json)?$/);
  if (!OWN.has(path) && !wallet) return redirect(`${KNOT}${path}${url.search}`);
  if (path === "/health") return new Response(`ok, ${COLLECTIONS.length} collections`);
  if (path === "/robots.txt") return new Response("User-agent: *\nAllow: /\n", { headers: { "content-type": "text/plain" } });
  if (path === "/go") return redirect(goTarget(url.searchParams.get("who"), "/wallet/", "/wallet"), 302);
  if (wallet) {
    const who = decodeURIComponent(wallet[2]);
    if (!WHO.test(who)) return wallet[1] ? json({ error: "not an address or ENS name" }, 0) : redirect("/wallet", 302);
    const w = await walletOf(who);
    if (wallet[1]) return json({ site: SITE, address: w.address, name: w.name, collections: w.states.map((s) => ({ slug: s.c.slug, name: s.c.name, host: s.c.host, ok: s.ok, tokens: s.tokens })) });
    return html(walletPage(await allStates(), w, who));
  }
  const states = await allStates();
  if (path === "/wallet") return html(walletPage(states, null));
  if (path === "/api/collections.json") {
    return json({
      site: SITE,
      collections: states.map((s) => ({
        slug: s.c.slug,
        name: s.c.name,
        url: `https://${s.c.host}/`,
        kind: s.c.kind,
        api: s.c.kind === "rolls" ? `https://${s.c.host}/api/state` : `https://${s.c.host}/api/today`,
        holder: `https://${s.c.host}/api/holder/ADDRESS`,
        contract: s.c.contract,
        chainId: 8453,
        repo: s.c.repo,
        today: s.today,
        tally: s.tally,
        rolls: s.rolls ?? null,
      })),
    });
  }
  return html(homePage(states));
}

if (import.meta.main) {
  Bun.serve({ port: PORT, fetch: handle });
  console.log(`${SITE} on :${PORT}`);
}
