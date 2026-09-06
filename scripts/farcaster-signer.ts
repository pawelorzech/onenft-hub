/**
 * Registers an app key for the Farcaster account so the hub can cast.
 *
 * One run: a new Ed25519 key pair, a Signed Key Request signed by the
 * account's custody wallet (the recovery phrase of the account, from
 * FC_MNEMONIC), a link the account opens in the Farcaster app to approve,
 * and a wait until it is approved on chain. Farcaster pays the gas.
 *
 *   FC_FID=3350139 FC_MNEMONIC="$(op read 'op://Private/Farcaster/recovery phrase')" bun run scripts/farcaster-signer.ts
 *
 * The signing key is written to the macOS Keychain (service
 * onenft-farcaster-signer) and never printed; read it with
 *   security find-generic-password -a onenft-farcaster -s onenft-farcaster-signer -w
 * and put it in the hosting env as FC_SIGNER_KEY next to FC_FID.
 */
import { SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN, SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_TYPES, bytesToHexString } from "@farcaster/core";
import { ed25519 } from "@noble/curves/ed25519";
import { mnemonicToAccount } from "viem/accounts";

const API = "https://api.farcaster.xyz";
const fid = Number(process.env.FC_FID);
const mnemonic = (process.env.FC_MNEMONIC ?? "").trim();
if (!Number.isInteger(fid) || fid <= 0 || mnemonic.split(/\s+/).length < 12) {
  console.error("need FC_FID and FC_MNEMONIC (12 or 24 words) in the env");
  process.exit(2);
}

const account = mnemonicToAccount(mnemonic);
const secret = ed25519.utils.randomPrivateKey();
const key = bytesToHexString(ed25519.getPublicKey(secret))._unsafeUnwrap();
const deadline = Math.floor(Date.now() / 1000) + 86400;
const signature = await account.signTypedData({
  domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
  types: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_TYPES.types,
  primaryType: "SignedKeyRequest",
  message: { requestFid: BigInt(fid), key, deadline: BigInt(deadline) },
});
console.log(`custody ${account.address}, requesting a key for fid ${fid}`);

const created = await fetch(`${API}/v2/signed-key-requests`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key, requestFid: fid, signature, deadline }),
}).then((r) => r.json()) as { result?: { signedKeyRequest?: { token?: string; deeplinkUrl?: string } }; errors?: unknown };
const req = created.result?.signedKeyRequest;
if (!req?.token || !req.deeplinkUrl) {
  console.error("signed key request not created:", JSON.stringify(created).slice(0, 400));
  process.exit(1);
}

// The key goes to the Keychain before anyone approves it, so a crash after approval loses nothing.
const stored = Bun.spawnSync(["security", "add-generic-password", "-a", "onenft-farcaster", "-s", "onenft-farcaster-signer", "-w", bytesToHexString(secret)._unsafeUnwrap(), "-U"]);
if (stored.exitCode !== 0) {
  console.error("keychain write failed:", stored.stderr.toString());
  process.exit(1);
}
console.log(`public key ${key} saved to Keychain (onenft-farcaster-signer)`);
console.log(`\nOpen this on the phone with the Farcaster app and approve:\n\n  ${req.deeplinkUrl}\n\nWaiting for the approval...`);

for (;;) {
  await Bun.sleep(3000);
  const j = await fetch(`${API}/v2/signed-key-request?token=${encodeURIComponent(req.token)}`).then((r) => r.json()).catch(() => null) as { result?: { signedKeyRequest?: { state?: string } } } | null;
  const state = j?.result?.signedKeyRequest?.state;
  if (state === "completed") {
    console.log(`\nApproved. Put FC_FID=${fid} and FC_SIGNER_KEY (from the Keychain) in the hosting env, then redeploy.`);
    break;
  }
  if (state && state !== "pending" && state !== "approved") {
    console.error(`request ended in state ${state}`);
    process.exit(1);
  }
}
