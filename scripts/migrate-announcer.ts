/** No network access. Stop the worker and inspect the source contracts before using this. */
import { open } from "node:fs/promises";
import { COLLECTIONS } from "../src/collections.ts";
import { migrateLegacy } from "../src/delivery-migrate.ts";

const [input, output, headsFile, confirmation] = process.argv.slice(2);
if (!input || !output || !headsFile || confirmation !== "--confirm-current-contracts") {
  throw new Error("usage: bun scripts/migrate-announcer.ts OLD.json NEW.json CUTOVER-HEADS.json --confirm-current-contracts");
}
const legacy: unknown = await Bun.file(input).json();
const heads: unknown = await Bun.file(headsFile).json();
if (!heads || typeof heads !== "object" || Array.isArray(heads)) throw new Error("cutover heads must be an object keyed by collection slug");
const state = migrateLegacy(legacy, COLLECTIONS.filter(c => !c.preview), heads as Record<string, number>);
const file = await open(output, "wx", 0o600); // Refuse to overwrite the live file or a previous result.
try { await file.writeFile(JSON.stringify(state)); await file.sync(); } finally { await file.close(); }
console.log(JSON.stringify({ output, preservedKeys: state.legacySeen!.length, preservedPromos: state.promos.length, cursors: state.cursors }));
