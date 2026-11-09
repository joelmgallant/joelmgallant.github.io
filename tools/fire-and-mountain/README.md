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
| `build.mjs` | Validates all months, merges sky data → `static/fire-and-mountain/today/data/` |
| `review.mjs` | Writes `review.html` with every day, for proofreading |
| `art.mjs`, `art/prompts.json`, `art/reference.jpg` | Illustration library via fal `nano-banana/edit` |
| `check-links.mjs` | Every tarot URL answers 200 with no redirect; every image exists |
| `test/` | `npm test` (node's built-in runner) |

## Renewing for the next year

1. `cd tools/fire-and-mountain && npm install && npm test`
2. Pick the new range (for example `2027-11-10` to `2028-11-09`; 2028 is a leap year, so that's 366 days).
3. Update `FIRST_DAY` / `LAST_DAY` in `static/fire-and-mountain/today/today-core.mjs`, the date-range test in `test/sky.test.mjs`, the defaults in `sky.mjs`, and the date in `README.md` (this file). Run `node sky.mjs`.
4. Move the old `months/*.json` into `months/archive-YYYY/` so the build only sees the new year. Keep them: they help the new agents avoid repeating jokes.
5. Review `style-guide.md` with Joel. New in-jokes, new lore, retire anything stale.
6. In a Claude Code session, send `agent-prompt.md` to one general-purpose subagent per calendar month (fill in `{{MONTH}}`, `{{DES_DAYS}}` ≈ days ÷ 7, `{{REPO}}`), in waves of up to 7. Mention that month's special days (birthdays Dec 22 and Mar 21, solstices, equinoxes, holidays) in the prompt.
7. Trust the files, not the agents' summaries: `node build.mjs`. It writes `build-report.json`. Send any failing months or `flaggedDates` (near-duplicate lines) to one cleanup subagent with the report, then build again until `BUILD OK`.
8. `node review.mjs` and have Joel read `review.html`.
9. Bump `VERSION` in `static/fire-and-mountain/today/sw.js` so installed copies pick up the new data.
10. `node check-links.mjs`, commit, push to `trunk`, then check the live page.

## Images

`node art.mjs` regenerates only missing images (it costs money per image). `node art.mjs <name>` forces one. Read every image after generating: the model draws the moon as a crescent regardless of the prompt, so phase scenes other than `moon-full` are deliberately moonless and the page draws the accurate moon on top.
