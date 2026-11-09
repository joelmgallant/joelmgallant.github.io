# Fire & Mountain: Daily Reading (design)

**Date:** 2026-11-09
**Status:** Approved in brainstorming, awaiting spec review
**Parent page:** `static/fire-and-mountain/index.html` (live at https://joelmgallant.com/fire-and-mountain/)

## 1. Goal

Add a daily horoscope-style reading for Joel and Nancy as its own installable page at `/fire-and-mountain/today/`. Each day shows a fun, specific, illustrated reading for each of them plus a shared line. All content for one year is pre-written, reviewed by Joel, and served as static files. Nothing runs on a schedule and there is no backend.

Out of scope for this version: browsing past days or peeking ahead, push notifications, a share card, interactive hero hands.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Who it's for | Two readings side by side (Joel, Nancy) plus a shared "Together today" section |
| Content source | Pre-generated for one year by Claude Code subagents (no Claude API, no API key) |
| Placement | Separate page `/fire-and-mountain/today/`; keepsake links to it with a "Today's Reading" nav pill |
| Shared styling | Keepsake CSS and JS split into `shared.css` and `sky.js`, used by both pages |
| Installable | PWA, installable from Android Chrome ("Add to Home Screen"), works offline |
| Tone | Fun and specific even when inaccurate; strict "never" list (section 6) |
| Imagery | A library of about 34 illustrations in the '70s cosmic airbrush style (made once with fal) plus code-drawn SVG: accurate moon, per-date star sigil, Mi'kmaw eight-point star |
| Tarot links | `[[Card Name]]` markup in content, converted to Biddy Tarot links via a verified 78-card map; keepsake tarot cards linked too |
| Date range | 2026-11-10 to 2027-11-09 (365 days) |
| "Today" | The viewer's device date, local midnight |
| Sky data | Computed for 12:00 America/Halifax each date with `astronomy-engine` |

## 3. Files

```
static/fire-and-mountain/
├── index.html              keepsake (edited: links shared files, "Today's Reading" pill, tarot links)
├── shared.css              tokens, sky layer, panels, type, nav pills, reveal, reduced motion, print
├── sky.js                  starfield + scroll reveal
├── tarot-links.json        78 cards -> Biddy Tarot URLs
└── today/
    ├── index.html          the daily page (noindex)
    ├── today.css           page-specific styles (airbrush-warm palette layered on shared tokens)
    ├── today-core.mjs      pure functions (date pick, rollover, card links, fallbacks)
    ├── today.js            DOM rendering; imports today-core.mjs
    ├── sw.js               service worker, scope /fire-and-mountain/today/
    ├── manifest.webmanifest
    ├── data/YYYY-MM.json   13 month files (Nov 2026 partial ... Nov 2027 partial)
    ├── img/                ~34 WebP illustrations
    └── icons/              icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png

tools/fire-and-mountain/    (not published)
├── README.md               how to regenerate next year, step by step
├── package.json            local deps only: astronomy-engine
├── style-guide.md          the writing rules given to every subagent
├── agent-prompt.md         the per-month subagent prompt template
├── sky.mjs                 writes sky.json for the date range
├── build.mjs               merges agent month files + sky data -> static/.../data/, runs checks
├── check-links.mjs         verifies tarot-links.json and image references
├── review.mjs              writes review.html (all 365 days in card style)
├── months/YYYY-MM.json     raw subagent output
├── art/reference.jpg       the approved airbrush style sample
├── art/prompts.json        prompt per library image
├── art/originals/          full-size fal outputs
└── test/*.test.mjs         node --test unit tests
```

The site has no root `package.json`; `tools/fire-and-mountain/package.json` stays local so the Hugo build is unaffected. Static files are not in Hugo's sitemap, so nothing new appears there.

## 4. The daily page

### Layout (top to bottom; cards side by side at 680px and wider)

1. **Header:** date written out, "Today's Reading", the day's title in italics.
2. **Moon scene:** library image chosen by the real moon phase, with the per-date star sigil (code-drawn SVG) in a corner.
3. **Sky strip:** accurate SVG moon, phase name, moon sign, percent lit.
4. **Sky story:** one dramatic, playful paragraph about today's sky.
5. **Joel's card** (fire-toned): emblem banner, two paragraphs, Today's mission, Watch for, stone chip (image + one-line why), element chip (orb + one-line why).
6. **Nancy's card** (green/blue): same structure, with the code-drawn Mi'kmaw eight-point star beside her name.
7. **Together today:** mood scene image + the joint mission.
8. **Footer:** link back to the keepsake; "Made for fun, for friendship, and for a little cosmic magic."

### Behaviour

- Picks the entry whose date equals the device's local date (`YYYY-MM-DD`), loading only that month's file.
- On `visibilitychange` to visible, re-checks the date and re-renders if it changed (midnight rollover).
- `[[Card Name]]` in any text field becomes `<a href="(Biddy URL)" target="_blank" rel="noopener">Card Name</a>`, styled with a gold dotted underline. Unknown names render as plain text (the build rejects them anyway).
- Text is inserted with `textContent`; only the card-link conversion creates elements. No `innerHTML` of content.

### Fallbacks

| Situation | What shows |
| --- | --- |
| JavaScript off | Static message in the HTML: "The stars need JavaScript to speak today 🔮" + link to the keepsake |
| Date before 2026-11-10 | The first day's reading |
| Date after 2027-11-09 | "The cards are being reshuffled for a new year…" + link to the keepsake |
| Month file can't load (offline, never cached) | "The stars are out of reach right now" + Retry button |

### PWA

- `manifest.webmanifest`: `name` "The Fire & The Mountain: Today", `short_name` "Fire & Mountain", `start_url` and `scope` `/fire-and-mountain/today/`, `display` `standalone`, `background_color` `#0d0a1f`, warm `theme_color`, the four icons (maskable has a safe-zone layout).
- `sw.js` registered from `/fire-and-mountain/today/` with scope `./`. It cannot control `/`, `/doom/` or the keepsake.
- Cache strategy: precache the page shell, shared files, `tarot-links.json`, current and next month's data, and all images. Stale-while-revalidate on fetch. Cache name carries a version string; bumping it on deploy evicts old caches in `activate`.
- Icons: a candle on a warm airbrush sky, drawn as SVG and rendered to PNG.
- `<meta name="robots" content="noindex, nofollow">`. No analytics or third-party scripts beyond Google Fonts.

## 5. Content

### Data shape (one entry, after build merges sky data)

```json
{
  "date": "2026-11-10",
  "sky": { "phase": "waxing-crescent", "phaseName": "Waxing Crescent", "illumination": 0.18, "moonSign": "Capricorn" },
  "title": "The Day of the Missing Pen",
  "skyStory": "…",
  "joel":  { "emblem": "fire-tiger", "reading": ["…", "…"], "mission": "…", "omen": "…",
             "stone": "onyx", "stoneWhy": "…", "element": "earth", "elementWhy": "…" },
  "nancy": { "emblem": "shore", "reading": ["…", "…"], "mission": "…", "omen": "…",
             "stone": "pearl", "stoneWhy": "…", "element": "water", "elementWhy": "…" },
  "together": { "mood": "mischief", "text": "…" },
  "des": false
}
```

`des` marks a "Don't Even Scream" day (Joel and Nancy's in-joke for big coincidences, also written "DES" or "ΔΕΣ", delta-epsilon-sigma). On those days the reading features a synchronicity and names it; the page stamps a gold ΔΕΣ seal on the moon scene.

Subagents write everything except `sky`; the build adds `sky` from `sky.json` so the moon is never written by a model.

### Allowed values

- `stone`: `ruby`, `onyx`, `pearl` (mother of pearl), `diamonds-stacked`, `diamond`
- `element`: `earth`, `fire`, `water`, `wind`, `heart`
- `joel.emblem`: `fire-tiger`, `cabin`. `nancy.emblem`: `wood-rat`, `shore`
- `together.mood`: `mischief`, `rest`, `courage`, `crossing`, `feast`, `focus`, `wonder`, `homecoming`, `celebration`, `patience`, `spark`, `release`
- `sky.phase`: the 8 standard phases, bucketed by phase angle in 45° bands centred on 0°, 45°, … 315°

### Length limits (words)

| Field | Limit |
| --- | --- |
| `title` | 2 to 8 |
| `skyStory` | 40 to 80 |
| each person's `reading` (both paragraphs together) | 90 to 150 |
| `mission`, `omen` | 8 to 35 |
| `stoneWhy`, `elementWhy` | 2 to 10 |
| `together.text` | 30 to 60 |

About 450 words per day, about 165k words for the year.

### Generation

1. `sky.mjs` writes `sky.json` for all 365 dates.
2. 13 subagents, one per calendar month, in two waves (7 then 6). Each receives `style-guide.md`, `agent-prompt.md`, and its month's slice of `sky.json`, and writes `months/YYYY-MM.json`. Agents write files; their final messages are not trusted for counts or status.
3. `build.mjs` validates and merges into `static/fire-and-mountain/today/data/YYYY-MM.json`. Any failing month, or any days flagged as near-duplicates, go to one cleanup subagent to rewrite, then the build runs again.
4. `review.mjs` writes `review.html`. Joel reviews; requested changes are made the same way. Nothing is published until Joel approves.

### Build checks

- Every date in range present exactly once; no extra dates.
- Every field present, non-empty, within its length limit.
- All enums valid.
- Every `[[Card Name]]` is a key in `tarot-links.json`.
- Banned-phrase list (section 6) finds nothing.
- DES: every `des: true` day contains "don't even scream", "DES" or "ΔΕΣ" somewhere in its text; no `des: false` day does; 40 to 70 DES days in the year.
- Near-duplicates: no two openings (first 8 words of any `reading` paragraph, `skyStory`, `together.text`) match across the year, and no two missions or omens share 8 or more consecutive words (6 flagged ordinary connecting phrases; tuned on the real year).

## 6. Style guide (summary; full text in `tools/fire-and-mountain/style-guide.md`)

**Go big:**

- Oddly specific predictions: times, colours, objects, small events, even if inaccurate.
- Dramatic, made-up astrology ("Mars is side-eyeing your inbox").
- Their lore, often: ruby and onyx, wrist switching, Fire Tiger and Wood Rat, Life Paths 3 and 11, the cabin and the shore, the cards from their spread, Captain Planet in original words.
- Small dares and missions; joint missions in "Together today".
- About one day in seven is a DES day: a specific, ridiculous coincidence or synchronicity, called out with "Don't even scream", "DES" or "ΔΕΣ".
- Short, punchy sentences, warm and mischievous; an occasional italic stage direction.
- Joel is fire and spark (Aries, Mars); Nancy is mountain and returning light (Capricorn, Saturn).

**Never:**

- Health, medical, body or food rules.
- Money, investing, gambling, buying things.
- Big life decisions (jobs, moving, ending relationships).
- Anything bad happening to anyone (accidents, illness, loss, death, danger).
- Relationship drama (jealousy, betrayal, partners, exes).
- Real named people other than Joel and Nancy.
- Jokes at their expense about looks, age or worth.
- Mi'kmaw or Acadian heritage, or the past-life story, in reading text. Cabin and shore imagery is fine.
- Theme song lyrics or other copyrighted text.
- Contradicting the key facts in BRIEF.md section 4.

## 7. Illustration library

| Set | Count | Files |
| --- | --- | --- |
| Moon phase scenes | 8 | `moon-new.webp`, `moon-waxing-crescent.webp`, … |
| Stones | 5 | `stone-ruby.webp`, `stone-onyx.webp`, `stone-pearl.webp`, `stone-diamonds-stacked.webp`, `stone-diamond.webp` |
| Elements | 5 | `element-earth.webp`, … |
| Emblems | 4 | `emblem-fire-tiger.webp`, `emblem-cabin.webp`, `emblem-wood-rat.webp`, `emblem-shore.webp` |
| Mood scenes | 12 | `mood-mischief.webp`, … (`mood-crossing` shows a birchbark canoe on the shore) |

- Made with fal `nano-banana/edit`, using `art/reference.jpg` (the approved airbrush sample) as the style reference and a shared style prompt. Each output is checked for the safety-checker black image and read by eye before use.
- Exported as WebP, about 800px on the long side, about 80 KB each.
- Joel approves or rerolls each image in a gallery before use.
- Original art only: nothing resembling Shadowscapes Tarot or Captain Planet, no people or faces.
- Mi'kmaw imagery stays light and specific: the eight-point star is drawn in code (not generated), and land imagery (birchbark canoe) is the only Mi'kmaw element in generated art. Nothing sacred or ceremonial; no headdresses, dreamcatchers, generic feathers or faux-tribal patterns. Nancy has OK'd light use.

Expected fal cost: about $1.50, up to about $3 with rerolls.

## 8. Keepsake changes

1. Move the inline CSS into `shared.css` (shared parts) and keep page-only CSS inline; move the starfield and reveal script into `sky.js`. Keep the inline head script that adds the `js` class.
2. Add a "✨ Today's Reading" pill to the header nav, linking to `today/`.
3. Link the seven spread cards in the `#tarot` section to Biddy Tarot with plain `<a>` tags (no JS dependency).
3a. In `#stones`, after "The universe does not do coincidences like this.", add a one-line ΔΕΣ nod (Joel-requested; the only keepsake copy change).
4. The page must look identical after the split: pixel comparison of before/after screenshots at 390px and 1280px.

## 9. Testing and acceptance

**Automated:**

- Sky data: new and full moons for Nov–Dec 2026 fall on the correct dates; moon sign matches a published ephemeris on sampled dates.
- Build checks (section 5) pass.
- `check-links.mjs`: all 78 tarot URLs return 200; every image referenced by the data and code exists.
- `node --test tools/fire-and-mountain/test/`: date selection, midnight rollover, card-link conversion, before-range and after-range fallbacks.

**Browser (Playwright):**

- 390px and 1280px viewport screenshots while scrolling; no console errors; no horizontal scroll.
- Faked dates: normal day, first day, last day, after the range, a full-moon day.
- Offline: load, go offline, reload; today's reading still renders.
- Service worker controls only `/fire-and-mountain/today/`; `/`, `/doom/` and the keepsake have no controlling worker.
- JavaScript off and `prefers-reduced-motion: reduce` render their fallbacks.
- Lighthouse accessibility ≥ 95 on both pages; text contrast meets WCAG AA, including on airbrush colours.
- Lighthouse installability checks pass.

**Manual (Joel):** image gallery approval, 365-day review page approval, "Add to Home Screen" on an Android phone after deploy.

## 10. Renewal

The batch ends 2027-11-09. `tools/fire-and-mountain/README.md` documents the full regeneration procedure (sky data, subagent waves, build, review, deploy). Suggested reminder: early October 2027.
