/**
 * The table of daily collections. Adding one is one entry here; the site,
 * the JSON and the tests read this table and nothing else. The order here is
 * the order on every page: Faces first (decided 2026-09-05), then the rest.
 *
 * Every collection site keeps one contract for the wallet page here:
 * GET /api/holder/<0x… or name.eth> lists that wallet's tokens (`days` with a
 * `day` for daily ones, `faces` with an `id` for rolls), resolves the ENS name
 * itself, and serves each image at the `image` URL with `access-control-allow-origin: *`.
 * It may add `facts`: a list of `{ figure, label }` the wallet page shows as tiles above the tokens.
 * Daily sites also answer /api/summary (today, tally, palette, freshness); rolls answer /api/state.
 */
export type Collection = {
  slug: string;
  /** "daily": one token a day, read from /api/today and /api/days. "rolls": one roll per wallet a day, read from /api/state. "coins": ONE, minted any time, read from /api/state the same way. */
  kind: "daily" | "rolls" | "coins";
  /** True while the site runs without a contract; the hub shows it but never announces it. */
  preview?: boolean;
  /** Short name shown on the page. */
  name: string;
  /** Host of the collection's own site. Its /api/today and /api/days feed this page. */
  host: string;
  /** One line under the name. Plain words, no adverbs. */
  line: string;
  /** Second line: where the material comes from. */
  source: string;
  /** Pixel art wants crisp scaling. */
  pixel: boolean;
  repo: string;
  contract: string;
  opensea: string;
};

/** Faces facts the hub states. They mirror faces.onenft.click/spec.json (maxSupply, maxPins, pinPricesEth); a test checks the live spec against them. */
export const FACES_MAX = 10000;
export const FACES_MAX_PINS = 12;
export const FACES_FIRST_PIN_ETH = "0.0005";
export const FACES_ALL_PINS_ETH = "1.024";

export const COLLECTIONS: Collection[] = [
  {
    slug: "faces",
    kind: "rolls",
    name: "Faces",
    host: "faces.onenft.click",
    line: "Roll one face per wallet each UTC day.",
    source: `Seven pixel layers and five colours from an on-chain seed. Leave all traits to chance, or pin up to ${FACES_MAX_PINS} traits and colours for a fee that starts at ${FACES_FIRST_PIN_ETH} ETH and doubles with every pin, up to ${FACES_ALL_PINS_ETH} ETH. Rare and legendary traits cannot be pinned. The collection ends at ${FACES_MAX.toLocaleString("en-US")} faces.`,
    pixel: true,
    repo: "https://github.com/pawelorzech/onenft-faces",
    contract: "0x7C745F4eA367A7A3CD596219A4E428F2eA9A8C4c",
    // The second Faces contract (2026-09-06); OpenSea has not named its collection yet, so the link goes to the contract's assets.
    opensea: "https://opensea.io/assets/base/0x7C745F4eA367A7A3CD596219A4E428F2eA9A8C4c/1",
  },
  {
    slug: "one",
    kind: "coins",
    name: "ONE",
    host: "one.onenft.click",
    line: "Pixel coins backed by USDC, 25,000 a series.",
    source: "Every coin holds 5, 10, 25 or 50 USDC in a vault that earns; burn it and the backing plus its yield comes back. Art and money never correlate: 50 Master Coins a series come from an urn nobody can steer, and a 5 USDC coin can be one of them. Burn after 30 days. It can lose you money.",
    pixel: true,
    repo: "https://github.com/pawelorzech/onenft-one",
    contract: "0xF597D7bD4467A501a7634dD53Be63E1c7261bcdB",
    // No OpenSea collection slug yet; the contract's first asset page lists the collection once it exists.
    opensea: "https://opensea.io/assets/base/0xF597D7bD4467A501a7634dD53Be63E1c7261bcdB/1",
  },
  {
    slug: "knot",
    kind: "daily",
    name: "Knot",
    host: "knot.onenft.click",
    line: "One Truchet knot a day.",
    source: "Drawn from the day number alone: sixteen palettes, ten traits, one grid of arcs and lines.",
    pixel: false,
    repo: "https://github.com/pawelorzech/onenft",
    contract: "0xb3b83788b9E6ccCb2379c3445dEF0627cf45E783",
    opensea: "https://opensea.io/collection/onenft-click",
  },
  {
    slug: "blit",
    kind: "daily",
    name: "Blit",
    host: "blit.onenft.click",
    line: "One Blitmap remix a day.",
    source: "The composition of one of the 100 CC0 Blitmap originals with the palette of another. Every pair once in 9,900 days.",
    pixel: true,
    repo: "https://github.com/pawelorzech/onenft-blit",
    contract: "0x27E85c52527D3955AF013664eb0AED799555588B",
    opensea: "https://opensea.io/collection/blit-onenft-click",
  },
  {
    slug: "chainrun",
    kind: "daily",
    name: "Chain Run",
    host: "chainrun.onenft.click",
    line: "One Chain Runner a day.",
    source: "Thirteen draws seeded with the day pick from the 338 CC0 Chain Runners layers with the original's weight tables.",
    pixel: true,
    repo: "https://github.com/pawelorzech/onenft-chainrun",
    contract: "0x748b55c3762FE2a697DC268eD19743e22481Bb58",
    opensea: "https://opensea.io/collection/chainrun-onenft-click",
  },
];

/** The collection that lends the page its colors. */
export const PALETTE_SOURCE = "knot";
