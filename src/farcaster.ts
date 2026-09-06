/**
 * Farcaster: one cast for every post the announcer makes on X.
 *
 * Writes go straight to a Snapchain node over HTTP (FC_HUB, by default the
 * one Farcaster runs), signed with an app key the account approved once
 * (`scripts/farcaster-signer.ts`). Needs FC_FID and FC_SIGNER_KEY (the
 * 32-byte signing key, hex) in the env; without them the channel stays off.
 * FC_CHANNEL, when set, is the parentUrl of a channel the account may cast
 * in; otherwise casts go to the home feed.
 *
 * A cast is the X text without the link line and the tag line, cut to 320
 * bytes, with the picture and the page as its two embeds; Farcaster renders
 * embeds as cards, so the text does not repeat the link.
 */
import { CastType, FarcasterNetwork, Message, NobleEd25519Signer, hexStringToBytes, makeCastAdd } from "@farcaster/core";

export const DEFAULT_HUB = "https://snap.farcaster.xyz:3381";
/** Bytes of text a plain cast may carry. */
export const CAST_LIMIT = 320;

export type Fc = { fid: number; signer: NobleEd25519Signer; hub: string; channel: string | null };

/** The Farcaster channel the env describes, or null when FC_FID or FC_SIGNER_KEY is missing or malformed. */
export function fcFromEnv(env: Record<string, string | undefined> = process.env): Fc | null {
  const fid = Number(env.FC_FID);
  const hex = (env.FC_SIGNER_KEY ?? "").trim();
  if (!Number.isInteger(fid) || fid <= 0 || !/^(0x)?[0-9a-fA-F]{64}$/.test(hex)) return null;
  const key = hexStringToBytes(hex.startsWith("0x") ? hex : `0x${hex}`);
  if (key.isErr()) return null;
  const hub = (env.FC_HUB || DEFAULT_HUB).replace(/\/+$/, "");
  return { fid, signer: new NobleEd25519Signer(key.value), hub, channel: env.FC_CHANNEL || null };
}

const utf8 = (s: string) => new TextEncoder().encode(s).length;

/**
 * The cast text from a post: the link line and the tag line go (they are
 * embeds and noise on Farcaster), then lines are dropped from the end until
 * the text fits 320 bytes. A single line that is still too long is cut at a
 * space.
 */
export function castText(text: string, url: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && l !== url && !/^(#\S+\s*)+$/.test(l));
  for (let n = lines.length; n >= 1; n--) {
    const t = lines.slice(0, n).join("\n");
    if (utf8(t) <= CAST_LIMIT) return t;
  }
  let one = lines[0] ?? "";
  while (utf8(one) > CAST_LIMIT) {
    const cut = one.replace(/\s+\S*$/, "");
    one = cut.length < one.length ? cut : [...one].slice(0, -1).join("");
  }
  return one;
}

/** A signed, encoded CastAdd with up to two url embeds. */
export async function buildCast(fc: Fc, text: string, embeds: string[]): Promise<Uint8Array> {
  const r = await makeCastAdd(
    { text, type: CastType.CAST, embeds: embeds.slice(0, 2).map((url) => ({ url })), embedsDeprecated: [], mentions: [], mentionsPositions: [], parentUrl: fc.channel ?? undefined },
    { fid: fc.fid, network: FarcasterNetwork.MAINNET },
    fc.signer,
  );
  if (r.isErr()) throw new Error(`cast not built: ${r.error.message}`);
  return Message.encode(r.value).finish();
}

/** Submits one cast to the hub. Returns the cast hash. */
export async function submitCast(fc: Fc, text: string, embeds: string[]): Promise<string> {
  const body = await buildCast(fc, text, embeds);
  const res = await fetch(`${fc.hub}/v1/submitMessage`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: body as BodyInit, signal: AbortSignal.timeout(20_000) });
  const j = (await res.json().catch(() => null)) as { hash?: string; error?: string; error_detail?: string } | null;
  if (!res.ok || !j?.hash) throw new Error(`cast ${res.status}: ${(j?.error_detail ?? j?.error ?? JSON.stringify(j)).slice(0, 300)}`);
  return j.hash;
}
