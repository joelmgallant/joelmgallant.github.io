# Fire & Mountain: The Exchange (design)

**Date:** 2026-11-09
**Status:** Approved in brainstorming, awaiting spec review
**Builds on:** `2026-11-09-fire-and-mountain-daily-reading-design.md` (the `/fire-and-mountain/today/` page)

## 1. Goal

250 of the 365 daily readings ask Joel and Nancy to send each other something (a word, a photo, a message, occasionally a voice memo), often "without conferring, then compare". The Exchange lets them do that inside the today page: each posts an answer, answers stay sealed until both are in, then reveal together in a quiz-show moment. Past exchanges form a scrapbook.

Out of scope: push notifications, more than two people, answers for anything other than the day's "Together today" task, server-side audio transcoding (see section 7).

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Where | In the page, stored server-side, sealed until both answer |
| Identity | Per-person secret link (`/today/#join=<key>`), key kept on the device |
| Answer types | Text, photo, voice memo (any combination, at least one) |
| Backend | AWS personal account, `ca-central-1`: Lambda function URL + DynamoDB + private S3 |
| Style | Original late-'90s irreverent quiz-show style, in the page's palette. Not a copy of *You Don't Know Jack* (no name, logo, host character, sounds or look) |
| Sounds | Original synthesized stings, off by default, behind a toggle |

## 3. How it works

- **One exchange per day**, attached to that day's `together.text`, which is shown as the prompt.
- Each person posts **one answer**: text (≤ 500 characters), a photo (resized on the device to ≤ 1600 px, JPEG), and/or a voice memo (≤ 60 s). They can replace it until the reveal.
- **Sealed:** until both have answered, each sees only their own answer and whether the other has answered ("🔒 Nancy's still thinking…").
- **Reveal:** when both answers exist, both unlock together. If both texts normalize to the same value (case, punctuation, whitespace and a leading "a"/"an"/"the" ignored), the response flags `match: true` and the page stamps **ΔΕΣ!**.
- **Window:** a day accepts answers from its date until 3 days later, plus a day of slack either side for time zones (server time `America/Halifax`; accepted while `today-4 ≤ date ≤ today+1` and the date is inside the reading batch). After the window, the day is closed and any lone answer is revealed.
- **Scrapbook:** "Past exchanges" lists earlier days that are revealed or closed, newest first, 30 per page, each with its prompt and both answers. Only past days appear, so reading one day at a time still holds.

## 4. Backend

### Resources (created by `tools/fire-and-mountain/exchange/deploy.sh`, `aws --profile personal --region ca-central-1`)

| Resource | Details |
| --- | --- |
| DynamoDB `fm-exchanges` | On-demand. Partition key `date` (S). Item: `{ date, joel?: Answer, nancy?: Answer }` |
| S3 `fm-exchange-media-<account-suffix>` | Private, Block Public Access on, SSE-S3, versioning off. CORS: `POST` from `https://joelmgallant.com`. Keys `<date>/<person>/<kind>-<uuid>.<ext>`. No expiry |
| Lambda `fm-exchange` | Node 22, ESM, 256 MB, 10 s timeout, reserved concurrency 5. Function URL, auth type NONE (application-level key auth), CORS origin `https://joelmgallant.com` only |
| IAM role `fm-exchange-role` | `dynamodb:GetItem/PutItem/UpdateItem/Scan` on the table; `s3:PutObject/GetObject` on the bucket; basic logs |
| Env vars | `KEY_HASH_JOEL`, `KEY_HASH_NANCY` (hex SHA-256 of each key), `TABLE`, `BUCKET`, `FIRST_DAY`, `LAST_DAY` |

`Answer = { text?: string, photoKey?: string, audioKey?: string, audioType?: string, updatedAt: ISO string }`

### Keys

- 32 random bytes, base64url. Only the hashes go to AWS.
- Plain links saved as `~/.secrets/tokens/fm-exchange-joel-link` and `~/.secrets/tokens/fm-exchange-nancy-link`, then `secretsync push`.
- Reissue: generate a new key, update that person's hash env var.

### API (function URL; every request sends `Authorization: Bearer <key>`; unknown or missing key → 401)

| Method & path | Behaviour |
| --- | --- |
| `GET /whoami` | `{ person: "joel" | "nancy" }` |
| `GET /exchange?date=D` | `{ date, open, revealed, match, me: Answer|null, them: { answered: bool, answer?: Answer } }`. `them.answer` is present **only** when `revealed`. Media keys are replaced by 5-minute presigned GET URLs. |
| `PUT /exchange?date=D` | Body `{ text?, photoKey?, audioKey?, audioType? }`. 409 if the day is closed or already revealed; 400 if empty, text > 500 chars, or media keys not under `D/<me>/`. Returns the new `GET` shape. |
| `POST /upload?date=D&kind=photo|audio` | Body `{ contentType }` (`image/jpeg`; `audio/webm` or `audio/mp4`). Returns a presigned POST `{ url, fields, key }` with `content-length-range` 1 byte to 5 MB (photo) or 3 MB (audio). 409 if the day is closed. |
| `GET /history?before=D&limit=30` | `{ days: [...] }`: revealed or closed days before `D`, newest first, each in the same shape as `GET /exchange`. The page looks up each day's prompt from that day's reading file. (At most 365 items, so a table scan is fine.) |

`revealed = both answered OR day closed`. The reveal rule and match detection run only on the server.

## 5. Page

### Files (all under `static/fire-and-mountain/today/`)

| File | Responsibility |
| --- | --- |
| `exchange-core.mjs` | Pure: parse `#join=` keys, choose panel state from an API response, normalize text for match display, pick a recording MIME type from what the browser supports |
| `exchange-api.mjs` | Fetch wrapper for the five endpoints; uploads via presigned POST |
| `exchange.js` | Panel rendering, form, photo resize (canvas), recorder (MediaRecorder, 60 s cap, preview before sending), reveal sequence, scrapbook view |
| `exchange.css` | Quiz-show styling |
| `exchange-sounds.mjs` | Web Audio synthesized stings (lock-in click, reveal hit, ΔΕΣ fanfare); off by default; toggle remembered in `localStorage` |

The function URL lives in one constant in `exchange-api.mjs`.

### Panel states

1. **No key on this device:** panel not rendered.
2. **Unanswered:** host line, prompt, text box, 📷 photo, 🎙️ record, **Lock it in**.
3. **Waiting:** own answer shown back, "Nancy's still thinking…" (or "Joel's…"), **Change my answer**.
4. **Revealed:** stage sequence (spotlight sweep, both cards slam in together, **ΔΕΣ!** stamp on a match, otherwise a host quip).
5. **Closed:** "This round's over", whatever was posted.
6. **Offline / API error:** "Connect to play 📡" with Retry. The reading itself is unaffected.

### Joining

Opening `/today/#join=<key>` calls `/whoami`; on success it stores `{ key, person }` in `localStorage`, removes the hash with `history.replaceState`, and shows "Welcome, Tiger" / "Welcome, Mountain". A rejected key shows "That link didn't work. Ask Joel for a fresh one."

### Style

- Host-voice copy in the UI: "Final answer, Tiger? Locking it in.", "Don't rush a Capricorn.", "BOTH ANSWERS ARE IN."
- A dark stage panel, bold display type (Cinzel 700 and Inter 600 with tight tracking), chunky rounded buttons with a hard drop shadow, snappy 150–300 ms transitions, the page's colours (night, sunset `#ff8a4c`, magenta `#c2457a`, gold `#f2c46d`).
- No logos, characters, sounds or visual elements from *You Don't Know Jack*.
- `prefers-reduced-motion`: the reveal becomes an instant swap, with no sweep or slam.

### Service worker

No change to its scope or rules: it only handles same-origin GETs, so API calls to the function URL always go to the network. Bump `VERSION` and add the new static files to the precache list.

## 6. Testing

- **Lambda unit tests** (`tools/fire-and-mountain/exchange/test/`, `node --test`, DynamoDB/S3 calls stubbed): auth (401s), open/closed window edges, `them.answer` absent before reveal for both people, reveal after both answer, lone answer revealed after close, match normalization, media key ownership check, history excludes open unrevealed days and future days.
- **Page unit tests:** `exchange-core.mjs` functions.
- **Live smoke test** after deploy, with two temporary test keys: post, sealed check, second post, reveal, photo and audio upload, presigned GET fetch, history. Then restore the real hashes; test data deleted from the table and bucket.
- **Playwright** with two browser contexts as Joel and Nancy against the live API (test keys): join flow, sealed state, reveal, ΔΕΣ match, closed day, offline message, no-key visitor sees no panel, reduced motion, 390 px and 1280 px screenshots, no console errors.
- **Manual:** Joel posts a photo and a voice memo from his phone. Nancy's first use is the real cross-device check.

## 7. Risks

- **Audio formats:** Android records WebM/Opus, iPhone records MP4/AAC. Current Safari plays WebM and Android plays MP4, so files are stored as recorded. If Nancy's iPhone is older than iOS 17, add transcoding later.
- **Lost key** (phone reset, cleared site data): reissue that person's link.
- **Public repo:** the Lambda code and the function URL are public; only the key hashes protect the data, and the hashes live in Lambda env vars, not the repo.
- **Cost:** two people's usage sits inside free tiers; reserved concurrency 5 caps any abuse.
