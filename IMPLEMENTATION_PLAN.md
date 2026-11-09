# Implementation Plan: Fire & Mountain Daily Reading

Spec: `docs/superpowers/specs/2026-11-09-fire-and-mountain-daily-reading-design.md`
Goal for this run: a deployed `/fire-and-mountain/today/` page for Joel to review.
The keepsake "Today's Reading" pill is held back until Joel approves the content.

## Stage 1: Tooling and sky data
**Goal:** `tools/fire-and-mountain/` with local `package.json`, `lib/sky-core.mjs`, `sky.mjs` writing `sky.json` for 2026-11-10..2027-11-09.
**Success Criteria:** 365 entries; phase, phaseName, illumination, moonSign per date; noon America/Halifax handles DST.
**Tests:** `node --test test/` — eclipse ground truth: 2026-03-03 full / Virgo, 2026-08-28 full / Pisces, 2026-08-12 new / Leo; phase bucketing at band edges; DST noon (Feb = 16:00Z, Aug = 15:00Z); range length 365.
**Status:** Complete

## Stage 2: Tarot map and keepsake refactor
**Goal:** `static/fire-and-mountain/tarot-links.json` (78 cards, canonical `https://biddytarot.com/...`); keepsake split into `shared.css` + `sky.js`; seven spread cards linked with plain `<a>`.
**Success Criteria:** link checker: 78/78 return 200 with no redirect; keepsake before/after screenshots pixel-identical at 390 and 1280 (excluding random starfield, which is disabled for the comparison).
**Tests:** `test/tarot.test.mjs` (78 unique names and URLs, names match card-name grammar); `check-links.mjs`; Playwright pixel diff.
**Status:** Complete

## Stage 3: Illustration library
**Goal:** 34 airbrush WebP images in `static/fire-and-mountain/today/img/` from fal `nano-banana/edit` with `art/reference.jpg` as style reference.
**Success Criteria:** every file present per spec section 7; each image viewed; none black (safety checker); no people/faces; style consistent.
**Tests:** `check-links.mjs` image existence check; manual read of every image.
**Status:** Complete (moon scenes except full are moonless; today page overlays the accurate SVG moon)

## Stage 4: Content
**Goal:** `style-guide.md`, `agent-prompt.md`, 13 month files by subagents (waves of 7 + 6), `build.mjs` merge + checks into `static/fire-and-mountain/today/data/`.
**Success Criteria:** build passes all checks in spec section 5 (dates, fields, lengths, enums, card names, banned phrases, near-duplicates); counts verified by build, not agent reports.
**Tests:** `test/build.test.mjs` for each validator with good and bad fixtures.
**Status:** Not Started

## Stage 5: Today page + PWA
**Goal:** `today/index.html`, `today.css`, `today-core.mjs`, `today.js`, `sw.js`, `manifest.webmanifest`, icons.
**Success Criteria:** renders spec section 4 layout; fallbacks; SW scoped to `/fire-and-mountain/today/`; offline reload works.
**Tests:** `test/today-core.test.mjs` (pickEntry, monthKey, card-link tokenizer, range fallbacks); Playwright faked dates, offline, SW scope, no-JS, reduced motion, 390/1280 screenshots; Lighthouse a11y ≥ 95.
**Status:** Not Started

## Stage 6: Deploy for review
**Goal:** push to `trunk`, confirm live over HTTPS, hand Joel the URL.
**Success Criteria:** Pages workflow success; live page serves today's entry; SW scope verified live; keepsake unchanged visually and has no Today pill yet.
**Tests:** curl + Playwright against live URL.
**Status:** Not Started
