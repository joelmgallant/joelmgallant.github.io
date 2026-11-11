# Fire & Mountain daily reading tools

Builds the content for `https://joelmgallant.com/fire-and-mountain/today/`. Nothing in this folder is published; the outputs land in `static/fire-and-mountain/`.

Design: `docs/superpowers/specs/2026-11-09-fire-and-mountain-daily-reading-design.md`.

## Current batch

**2026-11-10 to 2027-11-09.** After 2027-11-09 the page shows "The cards are being reshuffled…". Start the renewal in early October 2027.

## Layout

| Path | What it is |
| --- | --- |
| `lib/sky-core.mjs`, `sky.mjs` | Real moon phase, illumination and sign at noon in Halifax → `sky.json` |
| `lib/tarot-cards.mjs`, `tarot.mjs` | 78 cards → `static/fire-and-mountain/tarot-links.json` (Biddy Tarot) |
| `lib/vocab.mjs` | Allowed stones, elements, emblems, moods, phases, and the 34 image names |
| `lib/validate.mjs` | Content checks (fields, word limits, vocab, card names, never-list, DES, repeats) |
| `style-guide.md` | The writing rules every subagent follows |
| `agent-prompt.md` | Per-month subagent prompt template |
| `validate-month.mjs` | Self-check one month file (subagents run this) |
| `games/YYYY-MM.json`, `lib/game-content.mjs`, `validate-games.mjs`, `game-agent-prompt.md` | Bonus Round games: one per day on a fixed weekly rhythm; schema, schedule and repeat checks; per-month writer prompt |
| `build.mjs` | Validates all months and games, merges sky data and each game's public half → one hashed file per day in `static/fire-and-mountain/today/days/` (the page fetches only today's); writes the games' secret half (Closest answers, Saturn's rules) to `exchange/games.json` for the Lambda |
| `review.mjs` | Writes `review.html` with every day, for proofreading |
| `art.mjs`, `art/prompts.json`, `art/reference.jpg` | Illustration library via fal `nano-banana/edit` |
| `check-links.mjs` | Every tarot URL answers 200 with no redirect; every image exists |
| `test/` | `npm test` (node's built-in runner) |

## Renewing for the next year

1. `cd tools/fire-and-mountain && npm install && npm test`
2. Pick the new range (for example `2027-11-10` to `2028-11-09`; 2028 is a leap year, so that's 366 days).
3. Update `FIRST_DAY` / `LAST_DAY` in `static/fire-and-mountain/today/today-core.mjs`, the date-range test in `test/sky.test.mjs`, the defaults in `sky.mjs`, and the date in `README.md` (this file). Run `node sky.mjs`.
4. Move the old `months/*.json` and `games/*.json` into `months/archive-YYYY/` and `games/archive-YYYY/` so the build only sees the new year. Keep them: they help the new agents avoid repeating jokes.
5. Review `style-guide.md` with Joel. New in-jokes, new lore, retire anything stale.
6. In a Claude Code session, send `agent-prompt.md` to one general-purpose subagent per calendar month (fill in `{{MONTH}}`, `{{DES_DAYS}}` ≈ days ÷ 7, `{{REPO}}`), in waves of up to 7. Mention that month's special days (birthdays Dec 22 and Mar 21, solstices, equinoxes, holidays) in the prompt.
6b. Send `game-agent-prompt.md` to subagents for the Bonus Round games (2-3 months each; tell each to keep helper scripts in its own scratch subfolder). Check every `closest` value yourself before shipping.
7. Trust the files, not the agents' summaries: `node build.mjs`. It writes `build-report.json`. Send any failing months or `flaggedDates` (near-duplicate lines) to one cleanup subagent with the report, then build again until `BUILD OK`.
8. `node review.mjs` and have Joel read `review.html`. It leaves the games out on purpose (Joel plays them); `node review.mjs --games` includes them for whoever checks the games instead.
9. Bump `VERSION` in `static/fire-and-mountain/today/sw.js` so installed copies pick up the new data.
10. `node check-links.mjs`, commit, push to `trunk`, then check the live page.
11. Update `FIRST_DAY` / `LAST_DAY` in `exchange/deploy.sh` and run `bash exchange/deploy.sh` so the Lambda gets the new range and the new `games.json`.

## Images

`node art.mjs` regenerates only missing images (it costs money per image). `node art.mjs <name>` forces one. Read every image after generating: the model draws the moon as a crescent regardless of the prompt, so phase scenes other than `moon-full` are deliberately moonless and the page draws the accurate moon on top.

## The Exchange (backend)

Sealed daily answers between Joel and Nancy. Spec: `docs/superpowers/specs/2026-11-09-fire-and-mountain-exchange-design.md`. Code in `exchange/` (Lambda: `src/`, tests: `npm test` inside `exchange/`).

- **AWS:** account 622206739165, `--profile personal`, `ca-central-1`. Lambda `fm-exchange` (function URL in `static/fire-and-mountain/today/exchange-api.mjs`), DynamoDB `fm-exchanges`, S3 `fm-exchange-media-622206739165`, role `fm-exchange-role`.
- **Deploy code changes:** `cd exchange && bash deploy.sh` (keeps the deployed key hashes).
- **Personal links:** `~/.secrets/tokens/fm-exchange-{joel,nancy}-link` (hashes alongside). Only the SHA-256 hashes live in AWS.
- **Reissue a lost link:** `node keys.mjs nancy` → save `link`/`hash` to the token files → `KEY_HASH_NANCY=<hash> bash deploy.sh` → `secretsync push`. The old link stops working immediately.
- **End-to-end check:** generate two throwaway keys, deploy them with `EXTRA_ORIGIN` unset, run `node smoke.mjs <url> <keys.json> <open-date>` (it deletes its own data), then redeploy the real hashes. Never run it on a day Joel and Nancy have already answered: cleanup deletes that whole day.
- **New reading year:** update `FIRST_DAY`/`LAST_DAY` in `deploy.sh` too, and redeploy.
- **Push notifications** (spec `docs/superpowers/specs/2026-11-10-fire-and-mountain-push-notifications-design.md`): the Lambda sends Web Push itself (`web-push`, pinned). The VAPID key pair is in `~/.secrets/tokens/fm-exchange-vapid-{public,private}`. `deploy.sh` reads it at deploy time and keeps the deployed pair when those files are missing; with no keys at all, push is off. Subscriptions live in item `push#<person>`; the send-once log lives in `pushlog#<date>`. Rotating the keys (new files, then redeploy) silently invalidates every subscription, so both people would need to tap the 🔔 again. Desktop Chrome under automation won't deliver or show pushes; test on a real phone.
