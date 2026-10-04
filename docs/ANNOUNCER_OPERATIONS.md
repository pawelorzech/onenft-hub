# Announcer delivery state v2

The announcer needs exactly one running worker and a persistent volume. Set `ANNOUNCE_STATE_FILE=/data/announce.json`; retain the existing production filename if different. Without a path, live delivery fails closed. `/data` must survive replacement of the container. This is a single-process queue, not a distributed lock: stop the old worker before starting a replacement. Do not scale the announcer to two replicas or use overlapping rolling deployments.

Deploy collection servers with `/api/mints` before the hub. Each source must return its expected chain and contract identity. The hub fetches at most 300 items per collection per round, retaining the cursor and queued jobs together. Remaining pages drain in later rounds. One unavailable collection does not stop discovery of the others. Cursor regression is rejected: investigate a source rollback rather than clearing its cursor blindly.

## First migration and backups

Stop the old announcer and take a backup of its state and OAuth token files. Version 1 arrays are backed up to `<state-file>.v1-backup` and **fail closed until explicitly migrated**. Do not start with an empty state file.

Run the offline migration locally, using a downloaded copy of the stopped worker's `/data/announce-seen.json`:

```sh
bun scripts/migrate-announcer.ts announce-seen-v1.json announce-seen-v2.json cutover-heads.json --confirm-current-contracts
```

The confirmation means you verified that old slug keys belong to the current Base contract addresses in `src/collections.ts`. The command has no network calls, preserves its input, and refuses to overwrite the output. `cutover-heads.json` is an object such as `{"one":123}`: a collection without any old seen keys must have its head captured when stopping the old worker, before deployment. Existing histories need no supplied head. Do not substitute a later `latest` snapshot, which would omit cutover mints.

The migration keeps every old key in `legacySeen`, carries promo keys over, and starts discovery immediately before each collection's earliest old key. Ingest skips exactly the recorded keys, allowing failed gaps and later cutover mints to be delivered without repeating recorded successes. IDs before the earliest observed key are historical and are not backfilled. Install the generated JSON at the original state path while the worker is stopped, preserving volume permissions, then start the new worker.

The old ledger did not distinguish X success from Farcaster failure, or record ambiguous X network outcomes. Migration prevents reposts of recorded keys but cannot prove delivery of old casts or rule out an unrecorded post accepted just before an old timeout. Reconcile those against account history if exact recovery matters. Burns cannot be recovered from an enumeration of currently existing NFTs.

After a version 2 restart, persisted cursors recover the backlog. Do not delete the file to repair an upstream failure: deletion would seed at today's head and omit downtime mints. Corrupt state fails closed; restore the last valid backup and reconcile any sends after that backup before enabling the worker. Keep OAuth refresh tokens on the same durable volume; these credentials must never be copied into logs or tickets.

`ANNOUNCE_DRY_RUN=1` uses `<state-file>.dry-run`, so a dry run cannot consume live delivery cursors. Tests use mocks and do not publish posts or casts.

## Retry and uncertainty

A successful X request is never repeated just because Farcaster failed. Explicit X HTTP 4xx rejection is retried with backoff. X timeouts, socket failures, ambiguous responses and interrupted `sending` records become `uncertain`: no automatic resend. This favors no duplicates over an unsupported exactly-once promise.

Farcaster retries the exact persisted signed bytes, keeping its message identity. A restart converts an interrupted Farcaster send to `pending` only when those bytes exist. Failed requests back off from one minute to one hour. Persistent authorization errors still need operator repair; retries do not repair credentials. At most 20 channel sends are attempted in a round. New deliveries can continue while older ones are backing off.

For an uncertain delivery:

1. Stop the worker and back up its JSON state.
2. Find the job by its key (`collection:8453:contract:tokenId`, or a promo key). Check the corresponding public account for the exact stored text and link around the failure time.
3. If the post exists, change only that channel to `{"state":"sent","id":"actual-post-id"}`. If you can establish that it was not accepted, change it to `{"state":"pending"}`. When unsure, keep `uncertain`; resending could duplicate it.
4. Preserve the job, other channel, signed bytes and cursors. Validate the JSON before restarting. Never reset an already successful channel merely to retry the other channel.

`/ready` exposes delivery counts; announcer counters on `/health` include X and Farcaster failures. `pending` that fails to drain or any `uncertain` entry needs attention. `seen` is now retained queued job count, not lifetime mint count; completed job history is bounded to 500. Pending and uncertain jobs remain until resolved. These counts are not proof of end-user visibility: inspect the external account for uncertain sends.

## Copy and dependencies

ONE posts and promos use the deterministic template with `ONE can lose you money.`; they bypass the language model. Other collections can use validated LLM text with the exact link on its own line and allowed tags on the final line.

Farcaster 0.20.0 still references Faker 7 APIs. The pinned Faker 10.5.0 override requires the checked-in Bun patch in `patches/`, copied before container install. ESM/CommonJS factory smoke tests cover the renamed integer, string and date APIs; signing validation tests exercise a real ephemeral signature without network publication. Do not remove the patch when updating the lockfile unless upstream no longer needs it.

ONE announcements describe minting, including `awaits reveal` for sealed coins. Reveal is not a second mint and does not generate another post. The coin page and image URL serve the revealed artwork once available.

## First v1 cutover while serving the website

The first v2 application may start against the existing v1 file: delivery fails closed while HTTP pages remain available. Wait until the old container has stopped, then take the final ledger backup, migrate and atomically install v2, and restart the new container once so it loads v2. This exception is safe only for the first v1 cutover because the new worker cannot send. Subsequent v2 deployments still require stop-before-start for the announcer. Never migrate while an old worker can still write the ledger.

## Editorial mode (2026-10-01)

Default: `ANNOUNCE_MINTS=0` (also when absent), `ANNOUNCE_PROMO_HOURS_UTC=14`.
Mint discovery still advances durable cursors, but newly discovered mints have no
outbound channels. Re-enabling mint announcements does not backfill those events.
Previously queued deliveries keep their existing state and may still be sent;
this is not a global daily delivery cap. Do not erase the queue to change cadence.
Existing explicit promo hours override the new default: set them to `14` when
rolling out the one-post-per-day policy. Empty promo hours disables scheduled posts.

Scheduled art posts rotate between an explanation, a constraint and a concrete
question. Deterministic fallback copy follows the same editorial approach.
The model receives up to 12 recent prepared posts from the persisted queue;
validation rejects repeated normalized text, repeated six-word openings and wallet
addresses. This is a lexical check, not a guarantee against semantic repetition.
ONE retains deterministic copy and its loss warning. No casino promises are added.
ONE promos use the latest valid recent coin image; with no coin, Farcaster embeds
only the page and X skips image upload. ONE does not provide `/today.png`.

These source changes require a separate deployment to affect the live account.
Test without live credentials; unit tests mock network calls and never publish.

## Loud mode (2026-10-05)

Last verified: 2026-10-05 | 2026-10-05

Owner's decision, replacing the copy and cadence defaults of the editorial mode
above. Mint reports stay opt-in (`ANNOUNCE_MINTS=0`).

- Default `ANNOUNCE_PROMO_HOURS_UTC=8,14,20`: three scheduled posts a day, three
  different collections. An explicit value in the env still wins.
- Slots: morning (what is open), midday (one rule that sets the collection
  apart), evening (the countdown to 00:00 UTC). The fallback templates carry an
  emoji, an exclamation mark, the live countdown and a call to action. A daily
  piece that is taken is never presented as open.
- The model prompt (`VOICE` in `src/llm.ts`) asks for a hook, 1 to 3 emoji,
  urgency from the supplied facts and a call to action. The validator allows up
  to three emoji and requires two to five tags. Invented popularity, prices,
  returns, wallet addresses, mentions and foreign links are still rejected.
  The community reply persona (`COMMUNITY_VOICE`) no longer feeds this prompt;
  replies keep their reviewed, calm answers.
- ONE is unchanged: deterministic template, the loss warning, no model, no emoji.
- Casts keep the tag line. Farcaster text is the post without the link line.
- Channels: `CHANNELS` in `src/announce.ts` sends Knot and Faces to `cryptoart`
  and Blit and Chain Run to `cc0`, both open to any caster on 2026-10-05. ONE
  stays on the home feed. `FC_CHANNEL=<parentUrl>` sends everything to one
  channel instead; `FC_CHANNEL=home` turns channels off without a deploy of new
  code. The channel is signed into the cast when it is prepared, so a change
  applies to casts prepared after the restart.
