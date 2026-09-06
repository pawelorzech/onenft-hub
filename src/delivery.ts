import { mkdir, open, rename, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Mint } from "./announce.ts";

export type Channel = "x" | "fc";
export type Delivery = { state: "pending" | "sending" | "sent" | "uncertain"; id?: string; error?: string; attempts?: number; retryAt?: number };
export type Job = { mint: Mint; text?: string; fcBody?: string; channels: Partial<Record<Channel, Delivery>> };
export type State = { legacySeen?: string[]; version: 2; cursors: Record<string, number>; jobs: Record<string, Job>; promos: string[] };
export class DefiniteSendError extends Error {}

/** A write failure stops the worker before an external effect can be attempted. */
export async function atomicJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const handle = await open(tmp, "w", 0o600);
  try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
  await rename(tmp, file);
}

export class DeliveryQueue {
  state: State = { version: 2, cursors: {}, jobs: {}, promos: [] };
  constructor(private readonly file?: string, private readonly persist = atomicJson, private readonly now = Date.now) {}
  async load() {
    if (!this.file) return;
    let raw: unknown;
    try { raw = JSON.parse(await readFile(this.file, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return; throw e; }
    // Legacy arrays lack contract identity and per-channel outcomes. Require an explicit
    // offline migration so deployment cannot silently discard the cutover backlog.
    if (Array.isArray(raw) && raw.every((v) => typeof v === "string")) { await this.persist(`${this.file}.v1-backup`, raw); throw new Error("legacy announcer state requires offline migration; see docs/ANNOUNCER_OPERATIONS.md"); }
    const s = raw as State;
    if (s?.version !== 2 || !s.cursors || !s.jobs || !Array.isArray(s.promos)) throw new Error("invalid announcer state; restore its backup before sending");
    if (s.legacySeen !== undefined && (!Array.isArray(s.legacySeen) || !s.legacySeen.every(k => typeof k === "string"))) throw new Error("invalid legacy history");
    for (const [key, value] of Object.entries(s.cursors)) if (!key || !Number.isSafeInteger(value) || value < 0) throw new Error("invalid announcer cursor");
    for (const [key, job] of Object.entries(s.jobs)) {
      if (!job?.mint || job.mint.key !== key || !job.channels) throw new Error("invalid announcer job");
      for (const [channel, d] of Object.entries(job.channels)) {
        if (!["x", "fc"].includes(channel) || !["pending", "sending", "sent", "uncertain"].includes(d.state)) throw new Error("invalid delivery state");
        if (d.state === "sending") d.state = channel === "fc" && job.fcBody ? "pending" : "uncertain";
      }
    }
    this.state = s;
    await this.save();
  }
  private save() { return this.file ? this.persist(this.file, this.state) : Promise.resolve(); }
  async ingest(namespace: string, cursor: number, mints: Mint[], channels: Channel[]) {
    const legacySeen = new Set(this.state.legacySeen ?? []);
    for (const mint of mints) if (!this.state.jobs[mint.key] && !legacySeen.has(mint.key)) this.state.jobs[mint.key] = { mint, channels: Object.fromEntries(channels.map((c) => [c, { state: "pending" }])) };
    this.state.cursors[namespace] = cursor;
    await this.save();
  }
  async promo(mint: Mint, channels: Channel[]) {
    if (this.state.promos.includes(mint.key)) return;
    this.state.jobs[mint.key] = { mint, channels: Object.fromEntries(channels.map((c) => [c, { state: "pending" }])) };
    this.state.promos = [...this.state.promos.slice(-89), mint.key];
    await this.save();
  }
  async deliver(prepare: (job: Job) => Promise<void>, senders: Partial<Record<Channel, (job: Job) => Promise<string>>>, limit = 20) {
    let attempts = 0;
    for (const job of Object.values(this.state.jobs)) {
      const pending = (Object.keys(job.channels) as Channel[]).filter((c) => job.channels[c]?.state === "pending" && senders[c] && (job.channels[c]?.retryAt ?? 0) <= this.now());
      if (!pending.length) continue;
      if (attempts >= limit) break;
      // Prepared text and the exact signed Farcaster bytes are durable before either send.
      await prepare(job);
      await this.save();
      for (const channel of pending) {
        if (attempts++ >= limit) break;
        const tries = (job.channels[channel]?.attempts ?? 0) + 1;
        job.channels[channel] = { state: "sending", attempts: tries };
        await this.save();
        try {
          const id = await senders[channel]!(job);
          job.channels[channel] = { state: "sent", id };
        } catch (e) {
          const retry = channel === "fc" || e instanceof DefiniteSendError;
          job.channels[channel] = { state: retry ? "pending" : "uncertain", attempts: tries, retryAt: retry ? this.now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(tries - 1, 6)) : undefined, error: String((e as Error).message).replace(/https?:\/\/\S+/g, "[upstream]").slice(0, 200) };
        }
        await this.save();
      }
    }
    const complete = Object.entries(this.state.jobs).filter(([, j]) => Object.values(j.channels).every((d) => d.state === "sent"));
    for (const [key] of complete.slice(0, Math.max(0, complete.length - 500))) delete this.state.jobs[key];
    await this.save();
  }
  summary() {
    const deliveries = Object.values(this.state.jobs).flatMap((j) => Object.values(j.channels));
    return { jobs: Object.keys(this.state.jobs).length, pending: deliveries.filter((d) => d.state === "pending").length, uncertain: deliveries.filter((d) => d.state === "uncertain" || d.state === "sending").length, sent: deliveries.filter((d) => d.state === "sent").length };
  }
}
