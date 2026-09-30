import { readFile } from "node:fs/promises";
import { Message } from "@farcaster/core";
import { atomicJson } from "./delivery.ts";
import { fcFromEnv, buildReply, submitCastBytes, type Fc } from "./farcaster.ts";
import { approvedReply, needsReview, parseChoice, type Choice } from "./community-policy.ts";
import { classifier, type Classify } from "./community-model.ts";

const DAY = 86400000;
const EPOCH = 1609459200000;
const HASH = /^0x[0-9a-f]{40}$/i;
export type Incoming = { hash: string; fid: number; at: number; text: string; parent?: { fid: number; hash: string }; mentions: number[] };
type Item = { input: Incoming; state: "pending" | "review" | "ignored" | "draft" | "ready" | "sent"; choice?: Choice; body?: string; sentHash?: string; attempts: number; retryAt?: number; reason?: string };
export type CommunityState = { version: 1; fid: number; since: number; day: string; models: number; sends: number; authorSends: Record<string, number>; lastReply: Record<string, number>; optedOut: Record<string, boolean>; items: Record<string, Item> };
export type Mode = "off" | "draft" | "auto";
const date = (now: number) => new Date(now).toISOString().slice(0,10);

export function incoming(raw: unknown): Incoming | null {
  const m = raw as any, d = m?.data, b = d?.castAddBody;
  if (!HASH.test(m?.hash ?? "") || !Number.isSafeInteger(d?.fid) || d.fid <= 0 || !Number.isSafeInteger(d?.timestamp) || d.timestamp < 0 || !b || typeof b.text !== "string" || !b.text.trim() || Buffer.byteLength(b.text) > 2048) return null;
  if (d.network !== "FARCASTER_NETWORK_MAINNET" && d.network !== 1) return null;
  const parent = b.parentCastId;
  if (parent && (!HASH.test(parent.hash ?? "") || !Number.isSafeInteger(parent.fid) || parent.fid <= 0)) return null;
  if (!Array.isArray(b.mentions) || b.mentions.some((v: unknown) => !Number.isSafeInteger(v) || Number(v) <= 0)) return null;
  return { hash: m.hash.toLowerCase(), fid: d.fid, at: EPOCH + d.timestamp * 1000, text: b.text, mentions: b.mentions, ...(parent ? { parent: { fid: parent.fid, hash: parent.hash.toLowerCase() } } : {}) };
}

export class CommunityWorker {
  state: CommunityState;
  private active: Promise<void> | null = null;
  private poisoned = false;
  constructor(readonly fc: Fc, readonly mode: Exclude<Mode,"off">, private file: string,
    private classify: Classify, private persist = atomicJson, private now = Date.now,
    private send = submitCastBytes) {
    this.state = { version: 1, fid: fc.fid, since: now(), day: date(now()), models: 0, sends: 0, authorSends: {}, lastReply: {}, optedOut: {}, items: {} };
  }
  async load() {
    let s: CommunityState;
    try { s = JSON.parse(await readFile(this.file, "utf8")); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("invalid community state"); await this.save(); return; }
    if (s.version !== 1 || s.fid !== this.fc.fid || !Number.isFinite(s.since) || typeof s.day !== "string" || !s.items || !s.authorSends || !s.lastReply || !Number.isSafeInteger(s.models) || s.models < 0 || !Number.isSafeInteger(s.sends) || s.sends < 0) throw new Error("invalid community state");
    if (!s.optedOut || Object.keys(s.optedOut).length > 10000) throw new Error("invalid opt-out state");
    if (Object.keys(s.items).length > 1000) throw new Error("community state exceeds limit");
    for (const [hash, item] of Object.entries(s.items)) {
      if (item.input?.hash !== hash || !HASH.test(hash) || !Number.isFinite(item.input.at) || !Number.isSafeInteger(item.input.fid) || typeof item.input.text !== "string" || !["pending","review","ignored","draft","ready","sent"].includes(item.state) || !Number.isSafeInteger(item.attempts) || item.attempts < 0) throw new Error("invalid community item");
      if (item.choice && !parseChoice(JSON.stringify(item.choice))) throw new Error("invalid community choice");
      if (item.state === "ready" && (!item.body || !item.choice)) throw new Error("incomplete community outbox");
    }
    this.state = s;
  }
  private async save() { try { await this.persist(this.file, this.state); } catch { this.poisoned = true; throw new Error("community persistence failed; restart required"); } }
  summary() {
    const items = Object.values(this.state.items);
    return { mode: this.mode, monitoredSince: new Date(this.state.since).toISOString(), review: items.filter(i=>i.state === "review").length, drafts: items.filter(i=>i.state === "draft").length, sent: items.filter(i=>i.state === "sent").length, pending: items.filter(i=>i.state === "ready" || i.state === "pending").length, modelsToday: this.state.models, attemptsToday: this.state.sends };
  }
  tick(): Promise<void> {
    if (this.active) return this.active;
    this.active = this.run().finally(()=> { this.active = null; });
    return this.active;
  }
  async ingest(messages: Incoming[]) {
    if (this.poisoned) throw new Error("community requires restart");
    const now = this.now(), cutoff = Math.max(this.state.since, now - 7 * DAY);
    for (const [hash,item] of Object.entries(this.state.items)) if (item.input.at < now - 8 * DAY) delete this.state.items[hash];
    for (const [fid,at] of Object.entries(this.state.lastReply)) if (at < now - DAY) delete this.state.lastReply[fid];
    for (const m of messages) {
      if (m.fid === this.fc.fid || m.at < cutoff || m.at > now + 60000 || this.state.items[m.hash] || Object.keys(this.state.items).length >= 1000) continue;
      if (m.parent?.fid !== this.fc.fid && !m.mentions.includes(this.fc.fid)) continue;
      if (/\b(stop replying|do not reply|don.t reply|opt out|unsubscribe|nie odpisuj)\b/i.test(m.text)) {
        if (Object.keys(this.state.optedOut).length >= 10000) throw new Error("opt-out capacity reached; operator required");
        this.state.optedOut[m.fid] = true;
      }
      this.state.items[m.hash] = { input: m, state: this.state.optedOut[m.fid] ? "ignored" : "pending", attempts: 0 };
    }
    await this.save();
  }
  async process() {
    if (this.poisoned) throw new Error("community requires restart");
    const now = this.now();
    if (this.state.day !== date(now)) { this.state.day = date(now); this.state.models = 0; this.state.sends = 0; this.state.authorSends = {}; await this.save(); }
    for (const item of Object.values(this.state.items)) {
      if (item.state !== "pending" && item.state !== "ready") continue;
      if (this.state.optedOut[item.input.fid]) { item.state = "ignored"; await this.save(); continue; }
      if (now - item.input.at > DAY) { item.state = "review"; item.reason = "expired"; await this.save(); continue; }
      if ((this.state.lastReply[item.input.fid] ?? 0) + 6 * 3600000 > now || (this.state.authorSends[item.input.fid] ?? 0) >= 2) continue;
      if (item.state === "pending") {
        // Never fetch or echo links supplied by commenters. Escalate sensitive requests.
        if (needsReview(item.input.text) || /https?:|www\.|\b[\w-]+\.(?:com|xyz|click|io|net|org)\b/i.test(item.input.text)) { item.state = "review"; item.reason = "sensitive-or-external-content"; await this.save(); continue; }
        if (this.state.models >= 24) break;
        this.state.models++; await this.save();
        let choice: Choice | null;
        try { choice = await this.classify(item.input.text, null); }
        catch { item.reason = "model-unavailable"; await this.save(); continue; }
        // Re-validate even injected classifier implementations. No model strings are published.
        choice = choice && parseChoice(JSON.stringify(choice));
        if (!choice) { item.state = "review"; item.reason = "invalid-model-output"; await this.save(); continue; }
        item.choice = choice;
        if (!approvedReply(choice)) { item.state = choice.code === "ignore" ? "ignored" : "review"; await this.save(); continue; }
        if (this.mode === "draft") { item.state = "draft"; await this.save(); continue; }
        const body = await buildReply(this.fc, approvedReply(choice)!, { fid: item.input.fid, hash: item.input.hash });
        item.body = Buffer.from(body).toString("base64"); item.state = "ready"; await this.save();
      }
      // Draft mode never drains a live outbox. A runtime mode change is not approval of drafts.
      if (this.mode !== "auto" || this.state.sends >= 8 || (item.retryAt ?? 0) > now) continue;
      const body = Buffer.from(item.body!, "base64");
      const decoded = Message.decode(body), b = decoded.data?.castAddBody;
      // Bind persisted output to the reviewed catalog and exact inbound recipient.
      if (decoded.data?.fid !== this.fc.fid || b?.text !== approvedReply(item.choice!) || b?.parentCastId?.fid !== item.input.fid || '0x'+Buffer.from(b.parentCastId.hash).toString('hex') !== item.input.hash || b.embeds.length || b.embedsDeprecated.length || b.mentions.length || b.parentUrl || decoded.data.network !== 1) throw new Error("community outbox binding failed");
      this.state.sends++; this.state.authorSends[item.input.fid] = (this.state.authorSends[item.input.fid] ?? 0) + 1;
      item.attempts++; item.retryAt = now + Math.min(6 * 3600000, 60000 * 2 ** Math.min(item.attempts, 8));
      this.state.lastReply[item.input.fid] = now;
      await this.save(); // Reserve budget and persist exact signed bytes before external effects.
      try {
        const hash = await this.send(this.fc, body);
        if (hash.toLowerCase() !== '0x'+Buffer.from(decoded.hash).toString('hex')) throw new Error("unexpected receipt");
        item.sentHash = hash; item.state = "sent"; item.reason = undefined;
      } catch { item.reason = "send-unconfirmed"; }
      await this.save();
    }
  }
  private async page(endpoint: string, params: Record<string,string>): Promise<Incoming[]> {
    const out: Incoming[] = []; let pageToken = "";
    for (let n=0;n<3;n++) {
      const url = new URL(`${this.fc.hub}/v1/${endpoint}`);
      url.search = new URLSearchParams({ ...params, pageSize:"50", reverse:"true", ...(pageToken ? {pageToken} : {}) }).toString();
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
      if (!res.ok) throw new Error("community source unavailable");
      const data = await res.json() as { messages?: unknown[]; nextPageToken?: string };
      if (!Array.isArray(data.messages) || data.messages.length > 50) throw new Error("invalid community page");
      out.push(...data.messages.map(incoming).filter((m):m is Incoming=>m!==null));
      const next = data.nextPageToken;
      if (!next) break;
      if (typeof next !== "string" || next.length > 2048 || next === pageToken) throw new Error("invalid community pagination");
      pageToken = next;
    }
    return out;
  }
  private async run() {
    if (this.poisoned) throw new Error("community requires restart");
    const own = (await this.page("castsByFid",{fid:String(this.fc.fid)})).filter(m=>m.fid === this.fc.fid).slice(0,12);
    await this.ingest(await this.page("castsByMention",{fid:String(this.fc.fid)}));
    for (const post of own) {
      const replies = await this.page("castsByParent",{fid:String(this.fc.fid), hash:post.hash});
      await this.ingest(replies.filter(m=>m.parent?.fid===this.fc.fid && m.parent.hash===post.hash));
    }
    await this.process();
  }
}

let worker: CommunityWorker | null = null;
let mode: Mode = "off";
let lastError: string | null = null;
export const communityStatus = () => ({ ...(worker?.summary() ?? { mode }), lastError });
export function startCommunity(env: Record<string,string|undefined> = process.env): boolean {
  mode = env.COMMUNITY_MODE === "auto" ? "auto" : env.COMMUNITY_MODE === "draft" ? "draft" : "off";
  if (mode === "off") return false;
  const fc = fcFromEnv(env);
  if (!fc || !env.OPENROUTER_API_KEY || !env.COMMUNITY_STATE_FILE || env.COMMUNITY_STATE_FILE === env.ANNOUNCE_STATE_FILE) { lastError = "community needs Farcaster, model key and a separate durable state file"; return false; }
  const w = new CommunityWorker(fc, mode, env.COMMUNITY_STATE_FILE, classifier(env));
  worker = w;
  // One worker only, following the same deployment constraints as the announcer.
  void w.load().then(() => {
    const tick = () => void w.tick().then(()=> { lastError=null; }).catch(()=> { lastError="community check failed; inspect private state and source availability"; });
    tick(); setInterval(tick, 300000);
  }).catch(()=> { lastError="community state failed to load; worker stopped"; });
  return true;
}
