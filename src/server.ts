import { allStates } from "./state.ts";
import { homePage, SITE } from "./site.ts";
import { COLLECTIONS } from "./collections.ts";

const PORT = Number(process.env.PORT ?? 3000);
/** Where the knot lived until 2026-09-05. Every path this site does not own goes there. */
export const KNOT = "https://knot.onenft.click";

const html = (s: string, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const json = (o: unknown, maxAge = 15) =>
  new Response(JSON.stringify(o, null, 1), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}`, "access-control-allow-origin": "*" } });
const redirect = (to: string) => new Response(null, { status: 301, headers: { location: to } });

/** Paths this site answers itself. Everything else belonged to the knot and redirects there. */
export const OWN = new Set(["/", "/api/collections.json", "/health", "/robots.txt"]);

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (url.hostname === `www.${SITE}`) return redirect(`https://${SITE}${path}${url.search}`);
  if (!OWN.has(path)) return redirect(`${KNOT}${path}${url.search}`);
  if (path === "/health") return new Response(`ok, ${COLLECTIONS.length} collections`);
  if (path === "/robots.txt") return new Response("User-agent: *\nAllow: /\n", { headers: { "content-type": "text/plain" } });
  const states = await allStates();
  if (path === "/api/collections.json") {
    return json({
      site: SITE,
      collections: states.map((s) => ({
        slug: s.c.slug,
        name: s.c.name,
        url: `https://${s.c.host}/`,
        kind: s.c.kind,
        api: s.c.kind === "rolls" ? `https://${s.c.host}/api/state` : `https://${s.c.host}/api/today`,
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
