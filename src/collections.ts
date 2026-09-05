/**
 * The table of daily collections. Adding one is one entry here; the site,
 * the JSON and the tests read this table and nothing else. The order here is
 * the order on every page: Faces first (decided 2026-09-05), then the rest.
 *
 * Every collection site keeps one contract for the wallet page here:
 * GET /api/holder/<0x… or name.eth> lists that wallet's tokens (`days` with a
 * `day` for daily ones, `faces` with an `id` for rolls), resolves the ENS name
 * itself, and serves each image at the `image` URL with `access-control-allow-origin: *`.
 */
export type Collection = {
  slug: string;
  /** "daily": one token a day, read from /api/today and /api/days. "rolls": one roll per wallet a day, read from /api/state. */
  kind: "daily" | "rolls";
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

export const COLLECTIONS: Collection[] = [
  {
    slug: "faces",
    kind: "rolls",
    name: "Faces",
    host: "faces.onenft.click",
    line: "One face a day per wallet.",
    source: "Rolled on chain from a seed: seven pixel layers and five colours. Pin up to three things for a small fee; rare things and the one of ones come only from luck. 10,000 faces, then it stops.",
    pixel: true,
    repo: "https://github.com/pawelorzech/onenft-faces",
    contract: "0x37747e1c6221848807B2fA060dbf4Be798361752",
    opensea: "https://opensea.io/collection/faces-onenft-click",
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
