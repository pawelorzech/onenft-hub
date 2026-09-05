# onenft.click

The landing for a family of daily on-chain collections on Base. Each collection mints one token a day, drawn on chain from the clock of the chain: nobody picks it, nobody can delay it, and a day nobody claims stays empty forever. Free, gas only, CC0, every tenth day up to 1000 to the author.

Live: **https://onenft.click**

| Collection | Site | Code |
|---|---|---|
| Knot, one Truchet knot a day | https://knot.onenft.click | [pawelorzech/onenft](https://github.com/pawelorzech/onenft) |
| Blit, one Blitmap remix a day | https://blit.onenft.click | [pawelorzech/onenft-blit](https://github.com/pawelorzech/onenft-blit) |
| Chain Run, one Chain Runner a day | https://chainrun.onenft.click | [pawelorzech/onenft-chainrun](https://github.com/pawelorzech/onenft-chainrun) |
| Faces, one face a day per wallet | https://faces.onenft.click | [pawelorzech/onenft-faces](https://github.com/pawelorzech/onenft-faces) |

## What this repo does

- Serves `/` with today's image, day, state and tallies for every collection, read from each site's `/api/today` and `/api/days` (cached one minute, last good answer kept on failure).
- Serves `/api/collections.json`, the machine-readable list.
- Serves `/wallet` and `/wallet/<address or name.eth>`: every token one wallet holds across the collections, each one downloadable as SVG, PNG or JPEG. JSON at `/api/wallet/<who>.json`. Each collection's own `/yours` page does the same for that collection alone.
- Redirects every other path to `https://knot.onenft.click` with a 301. The knot sat at the root until 2026-09-05, so old links to `/day/N`, `/explore`, `/api/*`, `/feed.xml` and holder pages keep working.
- Takes its colors from the knot of the day. It has no palette of its own and no light or dark mode, like every collection.

Adding a collection is one entry in `src/collections.ts`.

## Run

```
bun test
PORT=3000 bun run src/server.ts
```

No dependencies. `STATE_TTL_MS` changes the cache time; `UMAMI_URL` and `UMAMI_WEBSITE_ID` turn on analytics.

Everything is CC0.
