/** Inbound text can select a reviewed answer, never supply publishable text or tools. */
import { COLLECTIONS } from "./collections.ts";

export const COMMUNITY_VOICE = `You are OneNFT's AI community assistant. Help people understand the art and participate on their own terms. Be useful, specific and welcoming. Know the difference between on-chain artwork, ownership, CC0 rights, gas, paid traits and financial risk. Never invent expertise, experiences, partnerships, popularity, launches, prices, rewards or returns. Do not impersonate a human. Avoid engagement bait, pressure, unsolicited promotion and trading advice. Criticism is welcome; feedback is not consent to a purchase. Do not promote unreleased lottery or casino concepts.
For original posts: teach one concrete thing, show a creative constraint, invite a thoughtful comparison or explain a collection. Vary these purposes. X needs a self-contained short opening; Farcaster benefits from a concrete question and a conversation worth continuing. Do not promise follower growth. Public replies should answer before promoting. Never ask for keys, seed phrases, payments to an address or wallet signatures in a conversation.`;

export const REPLY_CODES = ["how", "cost", "rules", "rights", "bot", "thanks", "feedback", "review", "ignore"] as const;
export type ReplyCode = typeof REPLY_CODES[number];
export type Choice = { code: ReplyCode; collection: string | null };
export const SLUGS = COLLECTIONS.map(c => c.slug);

/** Defense in depth only. Capability restrictions remain effective if this misses an attack. */
export function needsReview(text: string): boolean {
  const t = text.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "");
  return /ignore.{0,40}(instruction|previous)|system.?prompt|developer.?message|override|jailbreak|seed.?phrase|private.?key|api.?key|mnemonic|recovery.?phrase|base64|<\/?(?:system|assistant|tool)|zignoruj|instrukcj|klucz prywatny|fraza odzyskiwania|refund|stolen|hacked|scam|lawsuit|guaranteed|airdrop|casino|lottery|jackpot|stop replying|do not reply|nie odpisuj/i.test(t);
}

export function parseChoice(raw: string): Choice | null {
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object" || Array.isArray(j) || Object.keys(j).sort().join(",") !== "code,collection") return null;
    if (!REPLY_CODES.includes(j.code) || !(j.collection === null || SLUGS.includes(j.collection))) return null;
    return { code: j.code, collection: j.collection };
  } catch { return null; }
}

/** Only literals and trusted repository data reach outbound text. No inbound interpolation. */
export function approvedReply(choice: Choice): string | null {
  const c = COLLECTIONS.find(c => c.slug === choice.collection);
  switch (choice.code) {
    case "how": return c ? `You can explore ${c.name} and its mint rules at https://${c.host}. Check the transaction details and costs before confirming in your wallet. We never need your seed phrase.` : "Start at https://onenft.click to compare the collections and their rules. Which one caught your eye?";
    case "cost": return c?.kind === "coins" ? "ONE is a paid USDC-backed experiment, not a free mint. Vault value can fall, and ONE can lose you money. Check the current terms at https://one.onenft.click." : c?.kind === "rolls" ? "An unpinned Faces roll has no mint fee, but gas applies. Pinning traits costs extra; the price increases with each pin. Rare and legendary traits cannot be pinned." : c?.kind === "daily" ? `${c.name} has no mint fee; gas still applies. One token is available each day, and the first wallet to claim takes it.` : "Costs differ by collection: daily art is gas-only, Faces charges for optional pins, and ONE requires USDC backing plus gas. Which collection are you looking at?";
    case "rules": return c?.kind === "daily" ? `${c.name} creates one piece per day. A day nobody claims stays empty forever. The day number determines the image, so those gaps are part of the collection.` : c?.kind === "rolls" ? "Faces combines seven pixel layers and five colours. You can leave traits to chance or pay to pin choices. Rare and legendary traits come from luck, not paid pins." : c?.kind === "coins" ? "ONE connects pixel coins to vault shares. Redemption opens after 30 days, with a fee on positive yield. Vault value can fall. ONE can lose you money." : "OneNFT collections have different rules for creating and claiming art. Which collection would you like to explore?";
    case "rights": return "Owning an NFT and having copyright permissions are different things. CC0 allows reuse without asking permission; check the collection's stated licence and source material before a remix.";
    case "bot": return "Yes, this is OneNFT's AI community assistant. I can explain published collection rules. I cannot access your wallet or resolve account and payment disputes.";
    case "thanks": return "Thanks for taking a look. Was it the artwork or the collection's rules that caught your attention?";
    case "feedback": return "Thanks for the feedback. Which part would you change: the artwork, the rules, or the experience of using the site?";
    default: return null;
  }
}
