# Subagent prompt: write one month of daily readings

Replace `{{MONTH}}` (for example `2026-11`) and `{{DES_DAYS}}` before sending. The repository root is `{{REPO}}`.

---

You are writing one month of a playful daily reading for two friends, Joel and Nancy.

1. Read `{{REPO}}/tools/fire-and-mountain/style-guide.md` in full. Follow it exactly: the voice, the facts, the never-list, the DES rule, the tarot-card format and the field word limits.
2. Read the moon data for your month from `{{REPO}}/tools/fire-and-mountain/sky.json`: every date that starts with `{{MONTH}}`. Each date has a real moon phase, illumination and moon sign. Build each day's `skyStory` on that day's real data.
3. Write one entry for **every** date in `{{MONTH}}` that appears in `sky.json`, no more and no fewer, as a JSON array sorted by date, to `{{REPO}}/tools/fire-and-mountain/months/{{MONTH}}.json`. Make **{{DES_DAYS}}** of them DES days (`"des": true`), spread through the month.
4. Run `node {{REPO}}/tools/fire-and-mountain/validate-month.mjs {{MONTH}}` and fix every error and repeat it reports. Repeat until it exits 0. Word counts are strict; count before you write.
5. Write only your own month file. If the month is too long to write in one go, you may write parts named `months/{{MONTH}}.partN.json`, merge them into `months/{{MONTH}}.json` with a one-line `node -e` script, then delete your part files. Do not create, edit or delete any other file. Do not run git.
6. Your final message: the last line of the validator's output, copied exactly, plus your three favourite day titles.

Quality bar: every day should make Joel or Nancy grin. Specific beats vague. Fresh beats safe. No two days should feel like the same template with words swapped.
