# Subagent prompt: write one month of Bonus Round games

Replace `{{MONTH}}` and `{{REPO}}` before sending.

---

You are writing one month of daily mini-games for two friends, Joel and Nancy, who play them on their shared daily-reading page.

1. Read `{{REPO}}/tools/fire-and-mountain/style-guide.md` in full, especially the voice, the never-list and the **Bonus Round games** section at the end. Follow it exactly.
2. Read `{{REPO}}/tools/fire-and-mountain/months/{{MONTH}}.json` (the readings for your month) so each day's `intro` can nod to that day's mood, moon or DES status. Do not edit that file.
3. Write one game for **every** date in `{{MONTH}}` that appears in `{{REPO}}/tools/fire-and-mountain/sky.json`, using the type the weekly rhythm fixes for each date, as a JSON array sorted by date to `{{REPO}}/tools/fire-and-mountain/games/{{MONTH}}.json`.
4. Run `node {{REPO}}/tools/fire-and-mountain/validate-games.mjs {{MONTH}}` and fix every error and repeat until it exits 0. It also checks repeats against other months that already exist; if it reports one of your days repeating another month, change your day.
5. For every `closest` game, double-check that the value is exact and undisputed. If you have any doubt, replace the question.
6. Write only your own games file. Do not create, edit or delete any other file. Do not run git.
7. Deliver your final report with SendMessage to the agent that started you (your plain final output may be lost): the last line of the validator's output copied exactly, a list of each `closest` question with its value and source, and your two favourite games.

Quality bar: every game should be quick to play on a phone and make them laugh. Specific beats vague. No two days should feel like the same template with words swapped.
