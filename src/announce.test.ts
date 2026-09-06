import { test, expect } from "bun:test";
import { dailyMint, rollMints, fresh, who, oauthHeader, keysFromEnv } from "./announce.ts";
import { COLLECTIONS } from "./collections.ts";

const knot = COLLECTIONS.find((c) => c.slug === "knot")!;
const faces = COLLECTIONS.find((c) => c.slug === "faces")!;

test("a claimed day becomes one message with the 1024 png; a free day is nothing", () => {
  const m = dailyMint(knot, { day: 12, state: "taken", owner: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", ownerName: "pawelorzech.eth", traits: { palette: "tar" } })!;
  expect(m.key).toBe("knot:12");
  expect(m.text).toBe("Day 12 of Knot is claimed by pawelorzech.eth. Palette: tar.\nhttps://knot.onenft.click/day/12");
  expect(m.image).toBe("https://knot.onenft.click/day/12-1024.png");
  expect(dailyMint(knot, { day: 13, state: "free" })).toBeNull();
  expect(dailyMint(knot, { day: 10, state: "author", owner: "0x6e36Dc3ec2F9D4f3D8e616725fB6Fa184CD9aE20" })!.text).toStartWith("Day 10 of Knot went to the author.");
  expect(dailyMint(knot, null)).toBeNull();
  expect(dailyMint(knot, { day: "x", state: "taken" })).toBeNull();
});

test("faces come oldest first, with rarity or the one of one, and their own png url only when it is on their host", () => {
  const ms = rollMints(faces, { recent: [
    { id: 5, rarity: "rare", owner: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", ownerName: "pawelorzech.eth", png: "https://faces.onenft.click/face/5-1024.png?c=7c745f4e" },
    { id: 4, oneOfOne: "The Astronaut", treasury: true, png: "https://evil.example/x.png" },
    { id: "bad" },
  ]});
  expect(ms.map((m) => m.id)).toEqual([4, 5]);
  expect(ms[0]!.text).toBe("Face #4 was rolled for the author. A one of one: The Astronaut.\nhttps://faces.onenft.click/face/4");
  expect(ms[0]!.image).toBe("https://faces.onenft.click/face/4-1024.png");
  expect(ms[1]!.text).toBe("Face #5 was rolled by pawelorzech.eth. Rarity: rare.\nhttps://faces.onenft.click/face/5");
  expect(ms[1]!.image).toBe("https://faces.onenft.click/face/5-1024.png?c=7c745f4e");
  expect(rollMints(faces, {})).toEqual([]);
});

test("names win over addresses, addresses are shortened, junk is null", () => {
  expect(who("pawelorzech.eth", "0x84Cf6667FdE676a5950730720b67d62B9AB476Df")).toBe("pawelorzech.eth");
  expect(who(null, "0x84Cf6667FdE676a5950730720b67d62B9AB476Df")).toBe("0x84Cf…76Df");
  expect(who("<script>", "nope")).toBeNull();
});

test("only unseen keys are fresh", () => {
  const a = { slug: "knot", key: "knot:1", id: 1, text: "", image: "" };
  const b = { slug: "knot", key: "knot:2", id: 2, text: "", image: "" };
  expect(fresh([a, b], new Set(["knot:1"]))).toEqual([b]);
});

test("the OAuth 1.0a signature matches the worked example in X's docs", () => {
  const k = { apiKey: "xvz1evFS4wEEPTGEFPHBog", apiSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw", token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE" }; // gitleaks:allow, the public example from X's OAuth 1.0a docs
  const h = oauthHeader(k, "POST", "https://api.twitter.com/1.1/statuses/update.json", { include_entities: "true", status: "Hello Ladies + Gentlemen, a signed OAuth request!" }, "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", "1318622958");
  expect(h).toContain('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"'); // gitleaks:allow, the expected signature from the same docs page
  expect(h).toStartWith("OAuth oauth_consumer_key=");
});

test("keys come only as a full set", () => {
  expect(keysFromEnv({ X_API_KEY: "a" })).toBeNull();
  expect(keysFromEnv({ X_API_KEY: "a", X_API_SECRET: "b", X_ACCESS_TOKEN: "c", X_ACCESS_SECRET: "d" })).toEqual({ apiKey: "a", apiSecret: "b", token: "c", tokenSecret: "d" });
});
