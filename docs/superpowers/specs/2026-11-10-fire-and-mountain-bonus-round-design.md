# Fire & Mountain: Bonus Round (daily games) — Design

Status: approved in brainstorming 2026-11-10. Builds on
`2026-11-09-fire-and-mountain-exchange-design.md` (the Exchange) and
`2026-11-09-fire-and-mountain-daily-reading-design.md` (the readings).

## Goal

Add one small two-player game every day, below the existing Exchange, on the
daily reading page at `/fire-and-mountain/today/`. The tone is a late-'90s
irreverent quiz show, but every format is original: no segment names, rules,
characters or look from You Don't Know Jack or any other show.

The reading's "Together" Exchange stays as it is. The game is a second,
independent round called **🎲 Bonus Round**.

## Players and access

Same as the Exchange: Joel and Nancy, identified by their existing personal
keys (bearer token, hashed in the Lambda environment). No new keys or join
flow. Visitors without a key see no Bonus Round panel.

## Shared rules

- One game per day, every day of the batch (2026-11-10 .. 2027-11-09).
- Open window equals the Exchange: from today-4 to today+1, Halifax time
  (`dayStatus` in `exchange/src/core.mjs`). After the window closes the round
  is read-only and shows whatever was completed.
- Answers are sealed until both players have answered. A player may change
  their answer until both are in.
- ΔΕΣ stamp on the game-specific "match" condition listed below.

## The nine games

### Single-stage games (answer → reveal)

| Type id | Name | Public content (day file) | Secret (server) | Answer shape | Reveal / result |
|---|---|---|---|---|---|
| `mind` | Read My Mind | `question`, `options` (2–4 strings) | none | `{ pick, guess }`, both option indexes | 1 point per correct guess of the other's pick. ΔΕΣ when both guess right. |
| `wrong` | Wrong Answers Only | `question` | `rule` (Saturn rule id) | `{ text }` ≤ 120 chars | The rule is unveiled and the server picks the winner by that rule. ΔΕΣ when the rule produces a tie. |
| `closest` | Closest Without Going Over | `question`, `unit` | `value` (number) | `{ number }` finite | True value revealed. Closest without going over wins; above the value is a bust; both bust means no winner. ΔΕΣ when both numbers are equal. |
| `lightning` | Lightning Round | `pairs`: exactly 3 `[a, b]` string pairs | none | `{ picks: [0\|1, 0\|1, 0\|1] }` | Matches out of 3. ΔΕΣ at 3/3. The 10-second timer per pair runs on the page only (honour system). |
| `tabloid` | Tabloid Front Page | `headline` containing exactly one `___` | none | `{ text }` ≤ 60 chars | Both headlines set as a fake front page. No winner. ΔΕΣ when the normalized texts match. |

### Two-stage games (answer → guess → ruling)

| Type id | Name | Public content | Answer shape (caption is sealed) |
|---|---|---|---|
| `closeup` | Extreme Close-Up | `prompt` | `{ photo: <storage key>, caption }` |
| `sound` | Sound Off | `prompt` | `{ audio: <storage key>, caption }` |
| `emoji` | Emoji Charades | `prompt` (category, e.g. "a movie") | `{ emoji, caption }`; `emoji` is 1–16 emoji (graphemes) with no letters or digits |
| `tales` | Two Truths and a Tall Tale | `prompt` | `{ facts: [3 strings ≤ 100 chars], caption: <index of the tale, 0–2> }` |

`caption` is ≤ 80 chars of text, except for `tales`, where it is the index of
the invented fact.

Stages:

1. **Answer.** Each submits their item plus the sealed caption.
2. **Guess.** Once both answers are in, each sees the other's item (never the
   caption) and submits one guess (text ≤ 80 chars; for `tales`, an index
   0–2). A guess can be changed until both guesses are in.
3. **Ruling.** Once both guesses are in, both captions are revealed. Each
   player rules on the guess about their own item: `yes` (✅ Nailed it),
   `close` (🤏 Close) or `no` (❌ Nope). A ruling is final. For `tales` the
   server rules automatically (the guess is right when it equals the caption
   index), so there is no ruling step.
4. **Done** when both rulings exist. ΔΕΣ when both rulings are `yes`.

If the window closes before the round finishes, the panel shows the completed
steps and "No ruling from the judges." for any missing ruling.

### Saturn's rules (for `wrong`)

A fixed table of named pure functions over the two answer texts. Each returns
`'joel'`, `'nancy'` or `'tie'`, and has a one-line host announcement:

| Rule id | Announcement | Winner |
|---|---|---|
| `shortest` | "Saturn rewards brevity." | fewer characters (after trim) |
| `longest` | "Saturn was paid by the word." | more characters |
| `mostVowels` | "Saturn is collecting vowels this week." | more a/e/i/o/u (case-insensitive) |
| `firstAlphabetically` | "Saturn files everything alphabetically." | earlier by `localeCompare` |
| `lastAlphabetically` | "Saturn reads the dictionary backwards." | later by `localeCompare` |
| `mostWords` | "Saturn counts words, not quality." | more whitespace-separated words |
| `fewestWords` | "Saturn has a short attention span." | fewer words |

Equal scores give `tie`. The writers pick one rule id per `wrong` day.

### Weekly rhythm

Fixed slot by weekday (decided during implementation: no writer overrides, which
keeps validation simple; `scheduleFor` in `lib/game-content.mjs`):

| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|
| `lightning` | `mind` | `closeup` | `wrong` | `sound` | `tabloid` / `emoji` (alternating weeks) | `closest` / `tales` (alternating weeks) |

`validate-games.mjs` enforces the scheduled type for every date.

## Content

### Source

Each day gets a `game` object in `tools/fire-and-mountain/games/YYYY-MM.json`
(an array of `{ date, game }`, kept apart from the approved reading files):

```json
"game": {
  "type": "closest",
  "intro": "Host line, ≤ 140 chars",
  "question": "How many steps climb to the top of Cape Smokey's lookout trail?",
  "unit": "steps",
  "secret": { "value": 1234 },
  "source": "Where the number comes from (source file only)"
}
```

The fields depend on the type, as listed in the tables above. `secret` holds
`value` for `closest` and `rule` for `wrong`, and is absent for every other
type. `source` is required for `closest` and is never published.

### Build outputs (`build.mjs`)

- **Public half:** the day file `static/fire-and-mountain/today/days/<hash>.json`
  gains `game` = the source object without `secret` and `source`.
- **Secret half:** `tools/fire-and-mountain/exchange/games.json` =
  `{ "<date>": { "type": "<type>", "secret": { ... } } }` for every day,
  generated, committed, and packaged into the Lambda by `deploy.sh`. The
  server needs `type` for every date to validate answers. It is committed
  because the repo source already contains it; the risk is the same accepted
  trade-off as the readings.
- `build.mjs` keeps its rule: write nothing unless the whole year validates.

### Validation

`lib/validate.mjs` (per month) and `check-year.mjs` (whole year) add:

- schema and length checks for every type, as in the tables above
- the `tabloid` headline has exactly one `___`
- the `wrong` rule id exists in the Saturn table
- the `closest` value is a finite number with a non-empty `source`
- the weekly rhythm bounds above
- no repeated `question`, `prompt`, `headline` or lightning pair across the year
  (normalized compare)

### Writing pass

- `style-guide.md` and `agent-prompt.md` gain a Bonus Round section: each
  format, the length limits, the rhythm, the tone (original, irreverent,
  warm; no You Don't Know Jack references), and the same privacy and
  cultural-care rules as the readings.
- 13 writer subagents, one per month file, add `game` blocks. Each must report
  back through SendMessage, and its counts are rechecked independently.
- Every `closest` value is spot-checked against its `source` before shipping.
  A wrong true answer ruins the round, so any unverifiable fact is replaced.
- Joel reviews the games in the local `review.html` (it gains a game column)
  before anything goes live.

## Server (`tools/fire-and-mountain/exchange/`)

### Storage

The same DynamoDB table `fm-exchanges`, with a separate item per day: key
`date = "game#<YYYY-MM-DD>"`. Attributes:

- `joel`, `nancy`: the answer objects (caption included), each with `at` timestamp
- `guess_joel`, `guess_nancy`: B games only
- `ruling_joel`, `ruling_nancy`: B games only (`yes` / `close` / `no`)

The existing `/history` scan skips these items because `dayStatus` rejects a
non-date key. A test pins that behaviour.

`store.mjs` gains a generic `setField(key, field, value)`. It may also gain a
conditional variant, used where the stage rules need atomicity (a ruling is
written only if absent).

### Pure logic: `src/game.mjs`

- `gameStage(type, item, status)` returns `answer` | `guess` | `ruling` | `done` | `closed` | `upcoming` (before the window opens)
- `validateGameAnswer(type, body, publicGame?)`, `validateGuess(type, body)`, `validateRuling(body)`
- `SATURN_RULES`: the table above
- `scoreGame(type, item, secret)` returns the type-specific result (points,
  winner, bust flags, matches, `des`)
- `shapeGame(type, item, person, status, secret)`: the response for one
  person. **Invariant:** it never includes the other's answer before both
  answers are in, never a caption before both guesses are in, and never the
  `secret` before the reveal. Tests cover every stage for every type.

### Routes: `src/game-routes.mjs`, wired from `handler.mjs`

| Route | Behaviour |
|---|---|
| `GET /game?date=` | `shapeGame` for the caller |
| `PUT /game?date=` | Set the caller's answer. 409 unless the stage is `answer` and the window is open. |
| `PUT /game/guess?date=` | Set the caller's guess. 409 unless the stage is `guess` and the window is open. |
| `PUT /game/ruling?date=` | Set the caller's ruling on the guess about their own item. 409 unless the stage is `ruling`, the ruling is unset, and the window is open. 400 for `tales`. |
| `POST /upload?date=&kind=&round=game` | The existing presigned upload. Storage key `<date>/<person>/game-<kind>-<uuid>.<ext>`. Closed-check against the game item. |

`/history` gains each day's game result (shaped as above) beside the Exchange
answers, so the scrapbook can show it. `games.json` is loaded once at cold
start. A date missing from it returns 404 for the game routes.

## Page (`static/fire-and-mountain/today/`)

- `index.html`: a `<section class="bonus" id="bonus" hidden>` under `#exchange`.
- `game.js`: mounts the panel when the day file has `game` and the visitor is
  joined. It reuses `createApi` (extended with `game`, `putGame`, `guess`,
  `rule`), the identity in storage, polling while waiting, and the composer's
  photo and voice capture for `closeup` and `sound`.
- `game-ui.mjs`: the per-type input builders and reveal renderers:
  - a title card with the game name and the intro, then the prompt
  - a stage stepper
  - input: A/B pick buttons; the lightning sequence with a 10 s countdown ring;
    a number field; text fields; caption field(s)
  - reveal: point tallies, a BUST! stamp, Saturn's rule as a card flip, a
    tabloid front-page layout, and the ✅ / 🤏 / ❌ ruling buttons
  - the ΔΕΣ stamp on matches
- `game.css`: same frame as `.exchange` with a distinct accent colour, honours
  `prefers-reduced-motion`, hidden in print.
- `exchange-sounds.mjs`: adds a countdown tick sting. Sound stays off by default.
- Scrapbook: each past day in 📼 Past exchanges shows its game result under the
  Together answers.
- `sw.js`: add the new files to `SHELL` and bump `VERSION` to `today-v6`.
- Each module stays under 200 lines.

## Testing

- **Unit (node:test, written first):** `gameStage` transitions; validation for
  every type and edge (length limits, emoji with letters, a tabloid headline
  missing its blank, index range); every Saturn rule including ties;
  `closest` scoring (one bust, both bust, exact, tie); lightning matches;
  automatic `tales` ruling; the `shapeGame` secrecy invariant at every stage
  for both players.
- **Handler:** the full A and B flows for both players against the in-memory
  store: out-of-stage writes refused with 409, edits refused after the
  reveal, game items absent from the Together history, and a missing
  `games.json` date returning 404.
- **Content:** the new validators run in `npm test` against fixtures, and
  `check-year` runs on the real year.
- **Browser (Playwright, local static server, mocked API):** one complete round
  of each of the nine games for both players, at 390px and 1280px, with no
  console errors.
- **Live:** read-only checks only (GET), never `smoke.mjs` on a played day.

## Rollout

1. Server and `games.json` deploy first. Day files have no `game` key yet, so
   the page is unchanged.
2. Content, review by Joel, then the page UI and day files ship together with
   `today-v6`.
3. Update the tools README (renewal now also regenerates `games.json` and
   redeploys the Lambda) and the project memory.

## Out of scope

Saturn's Ledger (season scoreboard), push notifications (tracked in issue #3), server-enforced
timers, more than one game per day.
