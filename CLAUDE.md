# onenft.click (hub)

The landing at the root of onenft.click, listing every daily collection: knot (`~/Programowanie/onenft`), blit (`~/Programowanie/onenft-blit`), chainrun (`~/Programowanie/onenft-chainrun`). Created 2026-09-05 when the knot moved from the root to `knot.onenft.click`. Operational identifiers live in `CLAUDE.local.md` (gitignored).

## What this is

- One Bun server, no dependencies, no chain reads of its own. It reads each collection's `/api/today` and `/api/days` over HTTPS (`src/state.ts`), caches for a minute and keeps the last good answer on failure.
- `src/collections.ts` is the table. **Adding a collection is one entry there**; the page, the JSON and the tests follow.
- Every path not in `OWN` (`src/server.ts`) redirects 301 to `https://knot.onenft.click` with path and query kept. Never add a page here whose path the knot uses (`/how`, `/explore`, `/day/*`, `/api/*`, `/feed.xml`, `/calendar.ics`); it would shadow a redirect people rely on.
- Colors come from the knot's `palette.bg` and `palette.cord`. Fallback near-black on near-white only when the knot does not answer. No light/dark toggle, ever.
- Same copy rules as the collections: English, plain words, active voice, no adverbs, no em dashes. Same anti-slop design rules.

## Commands

- `bun test` (4 tests) · `PORT=3000 bun run src/server.ts`.
- Deploy = `git push origin master`, then trigger the Coolify redeploy (see `CLAUDE.local.md`).

## Frontend Theme

Inherited from knot.onenft.click: Syne 700/800 for display and numbers, Newsreader 400 for text; no border radius, 1px hairlines in `--line`, solid CTA in `--fg` on `--bg`; sidebar 360px sticky, one 396px image per collection; no motion.
