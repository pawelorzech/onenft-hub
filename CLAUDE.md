# onenft.click (hub)

The landing at the root of onenft.click, listing every daily collection: knot (`~/Programowanie/onenft`), blit (`~/Programowanie/onenft-blit`), chainrun (`~/Programowanie/onenft-chainrun`). Created 2026-09-05 when the knot moved from the root to `knot.onenft.click`. Operational identifiers live in `CLAUDE.local.md` (gitignored).

## What this is

- One Bun server, no dependencies, no chain reads of its own. It reads each collection's `/api/today` and `/api/days` over HTTPS (`src/state.ts`), caches for a minute and keeps the last good answer on failure.
- `src/collections.ts` is the table. **Adding a collection is one entry there**; the page, the JSON and the tests follow.
- Every path not in `OWN` (`src/server.ts`) redirects 301 to `https://knot.onenft.click` with path and query kept. Never add a page here whose path the knot uses (`/how`, `/explore`, `/day/*`, `/api/*`, `/feed.xml`, `/calendar.ics`); it would shadow a redirect people rely on.
- `src/announce.ts` posts every new token of every collection on X: it polls each site (`/api/today`, `/api/state`) every minute, marks what exists at boot as seen without posting, and posts text plus the 1024 PNG for each new one. Needs `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` in the env (OAuth 1.0a user context of the posting account, signed in-house); off without them. `ANNOUNCE_DRY_RUN=1` logs instead of posting; `ANNOUNCE_STATE_FILE` keeps the seen set across restarts when a volume is mounted. OAuth 2.0 works too: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_OAUTH2_ACCESS_TOKEN`, `X_OAUTH2_REFRESH_TOKEN` plus `X_TOKEN_FILE` on the volume, since every refresh rotates the refresh token (the file wins over the env after the first refresh; a lost file means a new authorization). An OAuth 2.0 token without the `media.write` scope posts text only; set `X_MEDIA=1` to try uploads. Production (2026-09-06) runs OAuth 2.0 as @onenftclick, text only, with `/data` mounted. `/health` shows its counters.
- `/wallet` and `/wallet/<address or name.eth>` (plus `/api/wallet/<who>.json`) show one wallet across every collection. The hub reads each site's `/api/holder/<who>` (`src/state.ts`, `walletOf`), normalizes `days` (daily) and `faces` (rolls) into one token list (`tokensOf`), and downloads PNG/JPEG in the browser from the cross-origin SVG (`downloadScript`, copied from the knot; keep the two in step). Collections resolve ENS themselves, so the hub still has no chain code.
- Order on every page = order of `COLLECTIONS`: Faces first (Paweł, 2026-09-05), then Knot, Blit, Chain Run.
- Colors come from the knot's `palette.bg` and `palette.cord`. Fallback near-black on near-white only when the knot does not answer. No light/dark toggle, ever.
- Same copy rules as the collections: English, plain words, active voice, no adverbs, no em dashes. Same anti-slop design rules.

## Commands

- `bun test` (9 tests) · `PORT=3000 bun run src/server.ts`.
- Deploy = `git push origin master`, then trigger the Coolify redeploy (see `CLAUDE.local.md`).

## Frontend Theme

Inherited from knot.onenft.click: Syne 700/800 for display and numbers, Newsreader 400 for text; no border radius, 1px hairlines in `--line`, solid CTA in `--fg` on `--bg`; sidebar 360px sticky, one 396px image per collection; no motion.
