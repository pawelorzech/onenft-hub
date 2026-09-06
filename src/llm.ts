/**
 * Copy from a language model, through OpenRouter, for the announcer.
 *
 * The announcer always has a template post ready. When OPENROUTER_API_KEY is
 * set it asks the model to write the same facts in a fresh way, in the voice
 * below, and takes the answer only when it passes `accept`: the link kept
 * word for word, within X's 280, at least one of the tags, no em dash, no
 * emoji, plain text. Anything else, any error, any timeout: the template
 * goes out. So the model can make posts better, never make them fail.
 */
import { xLength, X_LIMIT } from "./announce.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "anthropic/claude-opus-5";

export type Brief = {
  /** What to say, one fact per line. */
  facts: string;
  /** The angle for this post: "a mint just happened", "what is open this morning", "last hours", "how it works". */
  angle: string;
  /** The link that must appear word for word. */
  url: string;
  /** The tags to choose from. */
  tags: string[];
  /** The template, for the model to see the register, never to copy. */
  reference: string;
};

export const VOICE = `You write short posts on X for onenft.click, a family of free on-chain art collections on Base: Knot (one Truchet knot a day), Blit (one Blitmap remix a day), Chain Run (one Chain Runner a day) and Faces (one pixel face per wallet a day, with traits you can pin). Everything is CC0, free, gas only, made by one person. Not an investment, no price, no roadmap, no hype.

Voice: plain words, active voice, no adverbs, no exclamation marks, no emoji, no hashtags inside sentences, no em dashes, nothing a reader could misunderstand. Say what happened or what is open, what the thing is in one line, and how to take part. Vary the opening and the rhythm from post to post; never start two posts the same way. You may be dry or wry, never salesy.

Rules: write only the post, nothing else. Keep every number, name and address exactly as given. Put the link on its own line, word for word. End with 3 to 5 of the given tags on the last line, nothing else on that line. The whole post must fit in 260 characters, counting the link as 23.`;

/** Whether a model answer may go out as it is. */
export function accept(text: string, b: Brief): boolean {
  return whyNot(text, b) === null;
}

export type LlmStatus = { model: string | null; asked: number; used: number; rejected: number; failed: number; lastError: string | null };
const status: LlmStatus = { model: null, asked: 0, used: 0, rejected: 0, failed: 0, lastError: null };
export const llmStatus = (): LlmStatus => ({ ...status });

/** Why an answer was not accepted, for the retry note and the log. */
export function whyNot(text: string, b: Brief): string | null {
  if (!text.trim()) return "the answer was empty";
  if (!text.includes(b.url)) return `the link ${b.url} must appear word for word on its own line`;
  if (xLength(text) > X_LIMIT) return `the post is ${xLength(text)} characters as X counts it; the limit is 260, cut it down`;
  if (/[—–]/.test(text)) return "no em dashes or en dashes; use a comma or a full stop";
  if (/\p{Extended_Pictographic}/u.test(text)) return "no emoji";
  if (!b.tags.some((t) => text.includes(t))) return `end with 3 to 5 of these tags: ${b.tags.join(" ")}`;
  const lines = text.trim().split("\n");
  if (lines.length < 2 || lines.length > 6) return "two to six lines: the text, the link on its own line, the tags on the last line";
  return null;
}

/** The model's post, or null when there is no key, the call fails, or two answers in a row do not pass. */
export async function llmPost(b: Brief, env: Record<string, string | undefined> = process.env): Promise<string | null> {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = env.LLM_MODEL || DEFAULT_MODEL;
  status.model = model;
  status.asked++;
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: VOICE },
    { role: "user", content: `Angle: ${b.angle}\n\nFacts:\n${b.facts}\n\nLink: ${b.url}\nTags to choose from: ${b.tags.join(" ")}\n\nFor the register only, a plain version of this post (do not copy it):\n${b.reference}` },
  ];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "http-referer": "https://onenft.click", "x-title": "onenft.click announcer" },
        body: JSON.stringify({ model, max_tokens: 2000, temperature: 1, reasoning: { effort: "low" }, messages }),
        signal: AbortSignal.timeout(Number(env.LLM_TIMEOUT_MS ?? 60_000)),
      });
      const j = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
      if (!res.ok) throw new Error(`${res.status} ${j?.error?.message ?? ""}`.trim());
      const text = (j?.choices?.[0]?.message?.content ?? "").trim().replace(/^["“]|["”]$/g, "");
      const why = whyNot(text, b);
      if (!why) {
        status.used++;
        return text;
      }
      console.warn(`announce: llm answer ${attempt ? "rejected again" : "sent back"} (${why}): ${text.replace(/\n/g, " ").slice(0, 120)}`);
      messages.push({ role: "assistant", content: text || "(empty)" }, { role: "user", content: `Not accepted: ${why}. Write the post again, only the post.` });
    }
    status.rejected++;
    return null;
  } catch (e) {
    status.failed++;
    status.lastError = String((e as Error)?.message ?? e);
    console.warn(`announce: llm failed, template goes out: ${status.lastError}`);
    return null;
  }
}
