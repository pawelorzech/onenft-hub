import { test, expect } from "bun:test";
import { Message, NobleEd25519Signer, isCastAddMessage, validations } from "@farcaster/core";
import { ed25519 } from "@noble/curves/ed25519";
import { buildCast, castText, fcFromEnv, CAST_LIMIT, DEFAULT_HUB } from "./farcaster.ts";

// A throwaway signing key for this test run only.
const key = ed25519.utils.randomPrivateKey();
const hex = Buffer.from(key).toString("hex");

test("the channel needs a fid and a 32-byte key; the hub and the channel are optional", () => {
  expect(fcFromEnv({})).toBeNull();
  expect(fcFromEnv({ FC_FID: "3350139" })).toBeNull();
  expect(fcFromEnv({ FC_FID: "0", FC_SIGNER_KEY: hex })).toBeNull();
  expect(fcFromEnv({ FC_FID: "3350139", FC_SIGNER_KEY: "abc" })).toBeNull();
  const fc = fcFromEnv({ FC_FID: "3350139", FC_SIGNER_KEY: `0x${hex}` })!;
  expect(fc.fid).toBe(3350139);
  expect(fc.hub).toBe(DEFAULT_HUB);
  expect(fc.channel).toBeNull();
  expect(fcFromEnv({ FC_FID: "1", FC_SIGNER_KEY: hex, FC_HUB: "https://hub.pinata.cloud/", FC_CHANNEL: "https://onchainsummer.xyz" })).toMatchObject({ hub: "https://hub.pinata.cloud", channel: "https://onchainsummer.xyz" });
});

test("the cast keeps the words, drops the link line and the tags, and fits 320 bytes", () => {
  const url = "https://knot.onenft.click/day/12";
  const x = `Day 12 of Knot is claimed by pawelorzech.eth.\nOne Truchet knot a day. Today's palette: tar.\n${url}\n#generativeart #Truchet #onchain`;
  expect(castText(x, url)).toBe("Day 12 of Knot is claimed by pawelorzech.eth.\nOne Truchet knot a day. Today's palette: tar.");
  const long = `${"a".repeat(200)}\n${"b".repeat(200)}\n${url}\n#x`;
  expect(castText(long, url)).toBe("a".repeat(200));
  const oneLong = `${"word ".repeat(100).trim()}\n${url}`;
  const t = castText(oneLong, url);
  expect(new TextEncoder().encode(t).length).toBeLessThanOrEqual(CAST_LIMIT);
  expect(t.endsWith("word")).toBe(true);
  const utf = `${"ż".repeat(200)}\n${url}`;
  expect(new TextEncoder().encode(castText(utf, url)).length).toBeLessThanOrEqual(CAST_LIMIT);
});

test("a built cast is a valid signed CastAdd with the fid, the text and two url embeds", async () => {
  const fc = { fid: 3350139, signer: new NobleEd25519Signer(key), hub: DEFAULT_HUB, channel: null };
  const bytes = await buildCast(fc, "Day 12 of Knot is claimed.", ["https://knot.onenft.click/day/12-1024.png", "https://knot.onenft.click/day/12", "https://ignored.example"]);
  const msg = Message.decode(bytes);
  expect(isCastAddMessage(msg)).toBe(true);
  expect(msg.data!.fid).toBe(3350139);
  expect(msg.data!.castAddBody!.text).toBe("Day 12 of Knot is claimed.");
  expect(msg.data!.castAddBody!.embeds.map((e) => e.url)).toEqual(["https://knot.onenft.click/day/12-1024.png", "https://knot.onenft.click/day/12"]);
  expect(msg.data!.castAddBody!.parentUrl).toBeUndefined();
  const v = await validations.validateMessage(msg);
  expect(v.isOk()).toBe(true);
  const inChannel = Message.decode(await buildCast({ ...fc, channel: "https://onchainsummer.xyz" }, "gm", []));
  expect(inChannel.data!.castAddBody!.parentUrl).toBe("https://onchainsummer.xyz");
});
