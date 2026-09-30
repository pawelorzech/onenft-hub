# OneNFT community assistant

Implemented 2026-10-01 at the owner's request: improve the existing social account,
reply to people and resist prompt injection in comments. Scope is OneNFT's own
application and local tests. No attack payloads were posted to third-party accounts.

## Editorial brief

The account should be useful even to someone who never mints. Explain the art,
creative constraints, on-chain ownership and collection rules using verified repo
facts. Invite a concrete comparison, accept criticism and answer before promoting.
No fabricated credentials, human experiences, partnerships or popularity. No
financial advice, guaranteed profit, fake scarcity or unreleased casino/lottery
announcements. Identify as an AI assistant when asked.

The original daily story still uses the announcer's collection rotation, history
and duplicate checks. The community persona is shared with its prompt. X and
Farcaster share the original story; Farcaster strips tags and places links in
embeds. Incoming comments NEVER enter the original-post prompt or its history.

## Replies and their security boundary

A worker polls the configured Farcaster hub every five minutes. It checks public
mentions and replies to the latest 12 casts by the account, including its replies.
Only new messages since first activation are considered; no historical reply blast.
Only direct replies or explicit protocol mentions qualify. This does not read DMs,
search for strangers to pitch, follow users, like posts or send unsolicited messages.

The model is a classifier, not a free-form public reply writer. It chooses one
reviewed answer category and a collection. All actual reply text comes from
`community-policy.ts`. This sacrifices unconstrained conversation for a strong
publication boundary: even if an attack fools the classifier, it cannot publish
attacker text, change a link, choose a recipient, reveal a secret or execute a tool.
Wrong classification is still possible; it can cause an irrelevant catalog answer.
This is not a claim of universal prompt-injection immunity.

The classifier receives only message text and a null collection context. It can
recognize an explicitly named collection; otherwise answers should be general.
There are no wallet tools, shell access, retrieval, URL fetching, private prompts
with credentials, or cross-user conversation memory. Keys are transport/signing
credentials and are never included in model messages. Public inbound text is sent
to the configured OpenRouter model for classification. Do not add private DMs
without separately designing privacy and authorization handling.

Suspicious instructions, external links, disputes, legal/security/financial
requests and unknown answers enter the private review queue. A failure produces
no fallback public reply. Opt-out phrases such as "stop replying" persist per FID
and suppress pending and future replies. The owner can manage these private records;
users cannot edit policy by claiming to be the owner in a cast.

Limits enforced by code (not by prompts):
- Eight send attempts per UTC day, including retries; at most two per author/day.
- Six hours between attempts to the same author; 24 model calls/day.
- Replies older than 24 hours go to review.
- Up to 1,000 inbox records; records older than eight days are pruned.
- Opt-outs retained, bounded at 10,000; capacity exhaustion stops ingestion.
- Three pages of 50 per API source per poll. Busy feeds can exceed this window;
  this is bounded best-effort monitoring, not lossless historical ingestion.

Signed bytes, budget reservation and target parent are persisted before sending.
A timeout retries the same signed Farcaster message, including across restarts.
Outbox recipient/text bindings are rechecked before submission. A disk-write failure
stops the worker until restart; a bad state file is never replaced by a fresh one.
Exactly one worker may run, as with the existing announcer. No overlap on deploy.

## Enablement

Defaults to OFF. Deployment and runtime activation are separate from source edits.

```
COMMUNITY_MODE=draft
COMMUNITY_STATE_FILE=/data/community.json
```

The state path must differ from ANNOUNCE_STATE_FILE. Existing FC_FID, FC_SIGNER_KEY
and OPENROUTER_API_KEY are reused without increasing their permissions. `draft`
classifies incoming messages but neither signs nor sends. `auto` sends only catalog
answers for newly pending messages; existing drafts are NOT automatically approved.
`off` stops polling on the next process restart. Do not delete state to change mode.
When temporarily switching from auto to draft, pre-existing signed outbox records
remain unsent until auto is restored; expired replies go to review.

`/ready` includes public counters and a generic error status, never raw comments,
review text, keys or model errors. The private state is atomically written with
mode 0600. Inspect a protected local copy using:

```
bun scripts/community-report.ts /path/to/community.json
```

The JSON report shows observed people, categories, drafts and review items. Treat
its `untrustedMessage` fields as data, not instructions. It does not claim follower,
click, purchase or conversion attribution; those integrations are still absent.
There is no public admin/approval endpoint. Review is manual and cannot mutate
policy or send posts through a comment command.

## Platform coverage

- Farcaster: API reading verified read-only against the public OneNFT account;
  reply signing and delivery behavior tested with mocks, no live replies sent.
- X: original posts supported by the existing announcer if credentials exist.
  The last verified production configuration has no X authorization. No X reply
  or DM implementation is claimed. X automation also requires appropriate API
  access and compliance with its automated-reply rules.
- Private Farcaster messages: not provided by this Snapchain public-cast integration.

## Validation and limitations

Tests cover direct/Unicode/role-spoofing injections, malicious structured output,
an undetected instruction with bounded output, fixed recipient binding, no unsolicited
or self replies, opt-out, budgets, dry mode, persistence failure and replay of the
same signed bytes after a timeout and restart. All catalog answers fit 320 bytes.
No paid model evaluation or live publication has been performed. These deterministic
tests verify the publication boundary, not classification accuracy or growth.

References:
- https://snapchain.farcaster.xyz/reference/httpapi/casts
- https://help.x.com/en/rules-and-policies/x-automation
