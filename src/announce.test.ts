import { test, expect } from "bun:test";
import { dailyMint, rollMints, fresh, who, oauthHeader, keysFromEnv } from "./announce.ts";
import { COLLECTIONS } from "./collections.ts";

const knot = COLLECTIONS.find((c) => c.slug === "knot")!;
const faces = COLLECTIONS.find((c) => c.slug === "faces")!;

test("a claimed day becomes one message with the 1024 png; a free day is nothing", () => {
  const m = dailyMint(knot, { day: 12, state: "taken", owner: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", ownerName: "pawelorzech.eth", traits: { palette: "tar" } })!;
  expect(m.key).toBe("knot:12");
  expect(m.text).toStartWith("Day 12 of Knot is claimed by pawelorzech.eth.\nOne Truchet knot a day. Today's palette: tar.");
  expect(m.text).toContain("\nhttps://knot.onenft.click/day/12\n#generativeart");
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
  expect(ms[0]!.text).toStartWith("Face #4 was rolled for the author.\nA one of one: The Astronaut. It exists once and never again.");
  expect(ms[0]!.text).toContain("\nhttps://faces.onenft.click/face/4\n#pixelart");
  expect(ms[0]!.image).toBe("https://faces.onenft.click/face/4-1024.png");
  expect(ms[1]!.text).toStartWith("Face #5 was rolled by pawelorzech.eth.\nRarity: rare.");
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

test("auth comes from the env: OAuth 1.0a first, else OAuth 2.0, else none", () => {
  const { authFromEnv } = require("./announce.ts");
  expect(authFromEnv({})).toBeNull();
  expect(authFromEnv({ X_API_KEY: "a", X_API_SECRET: "b", X_ACCESS_TOKEN: "c", X_ACCESS_SECRET: "d" })!.kind).toBe("oauth1");
  const o2 = authFromEnv({ X_CLIENT_ID: "a", X_CLIENT_SECRET: "b", X_OAUTH2_ACCESS_TOKEN: "c", X_OAUTH2_REFRESH_TOKEN: "d" })!;
  expect(o2.kind).toBe("oauth2");
  expect(o2.media).toBe(false);
});

test("every post fits X's 280 with links at 23, keeps the link, and carries tags", () => {
  const { xLength, X_LIMIT, promoText, promoPick, fit } = require("./announce.ts");
  const long = { day: 3, state: "taken", owner: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", ownerName: "a-very-long-ens-name-that-goes-on-and-on-and-on.eth", traits: { palette: "a palette name that is very long indeed" } };
  const m = dailyMint(knot, long)!;
  expect(xLength(m.text)).toBeLessThanOrEqual(X_LIMIT);
  expect(m.text).toContain("https://knot.onenft.click/day/3");
  expect(m.text).toContain("#");
  const short = dailyMint(knot, { day: 3, state: "taken", owner: "0x84Cf6667FdE676a5950730720b67d62B9AB476Df", ownerName: "pawelorzech.eth", traits: { palette: "tar" } })!;
  expect(short.text).toBe("Day 3 of Knot is claimed by pawelorzech.eth.\nOne Truchet knot a day. Today's palette: tar.\nTomorrow at 00:00 UTC a new one appears. Free to claim, gas only. One a day, first wallet wins.\nhttps://knot.onenft.click/day/3\n#generativeart #Truchet #onchain #Base #NFT #CC0");
  expect(xLength(short.text)).toBeLessThanOrEqual(X_LIMIT);
  const f = rollMints(faces, { recent: [{ id: 5, rarity: "rare", ownerName: "pawelorzech.eth" }] })[0]!;
  expect(f.text).toContain("Face #5 was rolled by pawelorzech.eth.\nRarity: rare.");
  expect(xLength(f.text)).toBeLessThanOrEqual(X_LIMIT);
  expect(fit(["x".repeat(300)], "https://knot.onenft.click", ["#a"])).toContain("https://knot.onenft.click");
});

test("the daily note says what is open: a free day with hours left, a taken day, or the faces count; collections take turns", () => {
  const { promoText, promoPick, xLength, X_LIMIT } = require("./announce.ts");
  const now = Date.UTC(2026, 8, 6, 12, 0, 0);
  const free = promoText(knot, { day: 2, state: "free", startsAt: 1788652800, traits: { palette: "tar" } }, now)!;
  expect(free).toStartWith("Day 2 of Knot is still free: tar. 12 hours left, then it is gone for good.");
  expect(free).toContain("https://knot.onenft.click/day/2");
  expect(xLength(free)).toBeLessThanOrEqual(X_LIMIT);
  expect(promoText(knot, { day: 2, state: "taken", startsAt: 1788652800 }, now)).toStartWith("Day 2 of Knot is taken.\nOne Truchet knot a day. Tomorrow at 00:00 UTC");
  expect(promoText(faces, { totalSupply: 4, maxSupply: 10000, poolLeft: 50 })).toStartWith("Faces: 4 of 10,000 faces rolled, 50 one of ones still in the pool.");
  expect(promoText(faces, {})).toBeNull();
  const picks = ["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"].map((d) => promoPick(d).slug);
  expect(new Set(picks).size).toBe(4);
});
