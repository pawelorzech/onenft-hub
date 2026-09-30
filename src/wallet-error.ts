/** Self-contained: this exact function is embedded in the wallet scripts. Never prints raw RPC data. */
export function walletError(error: unknown, sending = false): string {
  const pending = sending ? " Check your wallet activity before trying again; the transaction may have been sent." : " Reconnect your wallet and try again.";
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  const codes: number[] = [];
  const texts: string[] = [];
  const data: string[] = [];
  for (let i = 0; i < queue.length && i < 40; i++) {
    const value = queue[i];
    if (typeof value === "string") { texts.push(value.toLowerCase()); if (/^0x[0-9a-f]{8}/i.test(value)) data.push(value.slice(0, 10).toLowerCase()); continue; }
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const e = value as Record<string, unknown>;
    if (typeof e.code === "number" || typeof e.code === "string") codes.push(Number(e.code));
    for (const key of ["message", "shortMessage", "details", "reason", "data", "cause", "error", "originalError"]) if (e[key] !== undefined) queue.push(e[key]);
  }
  const text = texts.join(" ");
  const reasons: Record<string, string> = {
  "0xaa992da7": "This day has already been claimed. Refresh the page to see its owner, or return for the next day.",
  "0x1e394759": "Claiming has not opened yet. Check the opening time shown on the page and come back then.",
  "0x52df9fe5": "Every face has been rolled or reserved by a pending roll. Check the collection for available faces.",
  "0x65697a45": "This wallet has already rolled today. Check your existing roll, or come back after midnight UTC.",
  "0x6fbf60c1": "This pin selection is not valid. Reload the builder and choose the pins again.",
  "0x6871963e": "The pin fee does not match this selection. Refresh the page, review the fee and confirm again.",
  "0x3b1ab104": "The contract could not transfer the fee. Do not keep retrying; check the transaction in your wallet and try later.",
  "0x0436cc11": "There is no pending reveal for this wallet. Refresh to check whether your face has already been revealed.",
  "0x3c8d90d8": "The reveal block has not arrived yet. Wait a few blocks, then check the roll again.",
  "0x751a0eb6": "The reveal window has expired. Check your roll so the reveal service can renew it before revealing.",
  "0x1a91ec62": "This roll can still be revealed and cannot be renewed yet. Check its reveal status instead.",
  "0x3d0c5c90": "The reveal block is unavailable. Check the roll again so the reveal service can recover it."
};
  for (const selector of data) if (reasons[selector]) return reasons[selector];
  if (codes.includes(4001) || /user rejected|user denied|request rejected/.test(text)) return "You cancelled the request in your wallet. Open the wallet and approve it when you are ready.";
  if (codes.includes(-32002) || /already pending|request pending/.test(text)) return "Your wallet is waiting for an answer. Open it and approve or dismiss the pending request before trying again.";
  if (/insufficient funds|insufficient balance|exceeds balance/.test(text)) return "There is not enough ETH on this network for the fee and gas. Add ETH on Base (Base Sepolia for the test site), then try again.";
  if (codes.includes(4901) || codes.includes(4902) || /wrong (chain|network)|chain mismatch|unsupported chain/.test(text)) return "Your wallet is on the wrong network. Switch to the Base network shown by this site, then check your wallet activity before continuing.";
  if (codes.includes(4100)) return "This site does not have access to your wallet account. Open your wallet and allow the connection, then try again.";
  if (codes.includes(4900) || /disconnect|no account/.test(text)) return "The wallet connection was lost." + pending;
  if (/timeout|timed out|failed to fetch|network error|socket|429|rate limit/.test(text)) return "The network did not answer in time." + pending;
  if (/dayalreadyclaimed/.test(text)) return "This day has already been claimed. Refresh the page to see its owner, or return for the next day.";
  if (/onerolladay/.test(text)) return "This wallet has already rolled today. Check your existing roll, or come back after midnight UTC.";
  if (/execution reverted|transaction reverted|revert/.test(text)) return "The contract rejected this request. Refresh the page to check availability and the current fee. Check your wallet activity before trying again.";
  return "The wallet could not complete the request." + pending;
}
