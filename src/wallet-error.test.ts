import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { toFunctionSelector } from "viem";
import { walletError } from "./wallet-error.ts";

const browser = runInNewContext(`(${walletError.toString()})`) as typeof walletError;
for (const [name, error, expected] of [
  ["rejected", { code: 4001 }, "You cancelled"],
  ["pending", { code: -32002 }, "approve or dismiss"],
  ["gas", { cause: { message: "insufficient funds for gas * price + value" } }, "not enough ETH"],
  ["wrong chain", { code: 4901 }, "wrong network"],
  ["disconnected", { code: 4900 }, "connection was lost"],
  ["timeout", { error: { message: "RPC timed out" } }, "did not answer in time"],
  ["claimed day", { data: toFunctionSelector("DayAlreadyClaimed(uint256)") + "0".repeat(64) }, "already been claimed"],
  ["daily roll", { data: { originalError: { data: toFunctionSelector("OneRollADay(address,uint256)") } } }, "midnight UTC"],
  ["reveal too early", { data: toFunctionSelector("TooEarly(address,uint256)") }, "Wait a few blocks"],
  ["reveal expired", { data: toFunctionSelector("Expired(address,uint256)") }, "renew it"],
] as const) {
  test(`browser wallet error: ${name} gives a reason and next step`, () => {
    expect(browser(error, true)).toContain(expected);
    expect(browser(error, true)).toBe(walletError(error, true));
  });
}
test("unknown send errors preserve uncertainty and never expose raw RPC details", () => {
  const error: any = { message: "secret https://rpc.example/key/PRIVATE" }; error.cause = error;
  expect(browser(error, true)).toContain("transaction may have been sent");
  expect(browser(error, true)).not.toContain("PRIVATE");
  expect(browser(error, false)).toContain("Reconnect your wallet");
});
