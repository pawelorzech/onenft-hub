import { test, expect } from "bun:test";
import * as site from "./site.ts";
import { handle } from "./server.ts";
const yours = () => site.walletPage([], null);
const how = () => site.layout("How", site.FALLBACK, "<main></main>", "https://knot.onenft.click/today.png", "/how");
const assets = () => site.layout("Assets", site.FALLBACK, "<main></main>", "https://knot.onenft.click/today.png", "/assets");

test("wallet form validates ENS and addresses with the browser v flag", () => {
  const pattern = yours().match(/pattern="([^"]+)"/)![1];
  const re = new RegExp(pattern, "v");
  for (const value of ["name.eth", "some-name.eth", "0x" + "a".repeat(40), " name.eth "]) expect(re.test(value)).toBe(true);
  for (const value of ["not-a-wallet", "name.com", "0x1234"]) expect(re.test(value)).toBe(false);
});

test("server failures render recovery actions and stay out of the index", () => {
  const html = site.serviceError();
  expect(html).toContain('<a href="">Try again</a>');
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).toContain("<h1");
  expect(html).not.toContain("stack trace");
});
test("wallet entry is excluded from indexing", () => {
  expect(yours()).toContain('<meta name="robots" content="noindex">');
});

test("sitemap is served as XML with public canonical origins and no internal pages", async () => {
  const response = await handle(new Request("http://localhost/sitemap.xml"));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("xml");
  const body = await response.text();
  expect(body).toContain("https://onenft.click/");
  for (const value of ["localhost", "/yours", "/wallet", "/api/", "<lastmod>"]) expect(body).not.toContain(value);
  const robots = await (await handle(new Request("http://localhost/robots.txt"))).text();
  expect(robots).toContain("Sitemap: https://onenft.click/sitemap.xml");
});

test("wallet validation keeps safely escaped input for correction", () => {
  const html = site.walletPage([], null, "", 'bad"<input>');
  expect(html).toContain('value="bad&quot;&lt;input&gt;"');
});
