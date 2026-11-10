# Implementation Plan: Fire & Mountain Exchange

Spec: `docs/superpowers/specs/2026-11-09-fire-and-mountain-exchange-design.md`
AWS: account 622206739165, `--profile personal`, `ca-central-1`.

## Stage 1: Lambda logic
**Goal:** `tools/fire-and-mountain/exchange/` with `src/core.mjs` (pure: key→person, day window, reveal, match, response shaping, validation), `src/handler.mjs` (routing; store/media injected), `src/store.mjs` (DynamoDB), `src/media.mjs` (S3 presign).
**Success Criteria:** every API rule in spec §4 covered by a test; `them.answer` provably absent before reveal.
**Tests:** `node --test test/*.test.mjs` with in-memory fake store and fake media.
**Status:** Complete

## Stage 2: AWS deploy + live smoke
**Goal:** `deploy.sh` (idempotent: table, bucket + CORS + public-access block, role, Lambda zip with deps, function URL + CORS, reserved concurrency 5); `keys.mjs` (generate key + SHA-256); `smoke.mjs`.
**Success Criteria:** smoke passes with temporary test keys: 401 without key, post → sealed → second post → revealed, photo + audio presigned POST upload and presigned GET fetch, history. Test data removed afterwards.
**Tests:** `node smoke.mjs` against the live function URL.
**Status:** Complete (function URL https://2etmatfpkhkso64i3jfuychdsa0cmkeu.lambda-url.ca-central-1.on.aws/; test keys deployed, localhost CORS on)

## Stage 3: Page
**Goal:** `exchange-core.mjs` (+ tests), `exchange-api.mjs`, `exchange.js`, `exchange.css`, `exchange-sounds.mjs`; panel wired into `today/index.html`; SW precache + `VERSION` bump.
**Success Criteria:** six panel states (spec §5); join flow; photo resize; recorder with 60 s cap and preview; reveal sequence; ΔΕΣ match stamp; scrapbook; reduced motion; no panel without a key.
**Tests:** `exchange-core` unit tests; Playwright with two contexts (Joel/Nancy test keys) against the live API, 390/1280 screenshots, no console errors. Function URL CORS temporarily allows `http://localhost:8811`.
**Status:** Not Started

## Stage 4: Go live
**Goal:** remove localhost from CORS, delete test data, generate real keys into `~/.secrets/tokens/`, set real hashes, push site, verify live.
**Success Criteria:** live page with Joel's key shows the panel; without a key shows none; CORS rejects other origins; real links handed to Joel.
**Tests:** curl CORS preflight checks; Playwright smoke on live with a throwaway-free read-only check (whoami only, no posts).
**Status:** Not Started
