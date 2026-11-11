# Fire & Mountain: push notifications

Closes GitHub issue #3. Approved 2026-11-10 (option 1 of four: direct Web Push, no third-party service).

## Goal

Tell the other player when the daily Exchange or Bonus Round needs their move, or when a reveal is ready, so neither of them has to keep checking the page.

## Choice

The `fm-exchange` Lambda sends standard Web Push (VAPID) itself with the `web-push` library (pinned to 3.6.7). Rejected alternatives: OneSignal (a third-party script and tracking), ntfy and Pushover (a separate app, and tapping opens that app instead of the reading). Only the browsers' own push services (Google for Android Chrome, Apple for iOS) carry the messages.

## Server

- **Keys:** a VAPID key pair lives in `~/.secrets/tokens/fm-exchange-vapid-public` and `…-vapid-private`. `deploy.sh` reads them at call time and passes them to the Lambda through a mode-600 temp file (`--environment file://…`), never on a command line. When they are absent, the Lambda keeps the values already deployed. With no keys at all, push is a no-op.
- **Subscriptions:** stored in the `fm-exchanges` table as item `push#<person>`, field `subs`: a list of `{endpoint, keys: {p256dh, auth}, addedAt}`, at most 5 per person (the oldest is dropped). Subscriptions that the push service answers with 404 or 410 are removed.
- **Routes** (checked before the date rules):
  - `GET /push` returns `{publicKey}`.
  - `PUT /push` with `{subscription}` saves one. The endpoint must be an `https:` URL of at most 1000 characters, and the keys must be base64url strings.
  - `PUT /push/off` with `{endpoint}` removes one. This avoids adding `DELETE` to the CORS config.
- **Triggers:** pure functions in `src/nudges.mjs` compare the item before and after a successful write and return at most one nudge for the other person:
  - Exchange: a first answer while the other hasn't answered gives "X locked in …'s Exchange. Your move 🔥". A first answer that completes the pair gives "… Exchange is revealed 🎤". Edits send nothing.
  - Bonus Round, by the stage before and after the write:
    - answer→answer: "X played … Your turn 🎲"
    - →guess: "Both in. Time to guess 🎲"
    - guess→guess: "X guessed. Your turn 🎲"
    - →ruling: "Time to rule ⚖️"
    - ruling→ruling: "X ruled. Your call ⚖️"
    - →done: "results are in 🏆"
- **No spam:** each `(date, recipient, kind)` is sent at most once, recorded with a conditional write to item `pushlog#<date>`.
- **Privacy:** notification text holds names and the day only, never answers or game content.
- **Failure isolation:** sending is awaited inside the request (Lambda freezes after it returns), with a 3 s timeout per send. Any error is logged and swallowed, so a push problem never fails a save.

## Page

- `push-client.mjs` adds a 🔔/🔕 button to the Exchange header, next to the sound toggle.
  - Tapping it asks for notification permission (iOS requires a tap), subscribes with the server's public key, and PUTs the subscription.
  - Tapping it again unsubscribes.
  - On each open, an existing subscription is re-sent, so a rotated one heals itself.
- Where push is unsupported (iOS Safari outside the home-screen app), the button explains: "Add to Home Screen to get notifications". Where it is impossible, it is hidden.
- `sw.js` gets `push` (shows the notification, with one tag per day and kind) and `notificationclick` (focuses or opens the today page, `#exchange` or `#bonus`). Bump `VERSION`.

## Testing

- Unit tests:
  - the nudge rules, including the no-content invariant
  - the push store and sender: dedupe, pruning on 410, the subscription cap, and the no-op without keys
  - the routes
- End to end: Playwright against the in-process handler with a fake push sender and a real browser subscription flow where possible. Then a live check on the Android emulator. iOS needs Joel's phone.

## Out of scope

- Evening reminders (they need a scheduled trigger).
- SMS or email.
- Per-kind preferences.
