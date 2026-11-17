import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFetcher, redact } from "../lib/cached-fetch.mjs";

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    return { status: next.status, ok: next.status >= 200 && next.status < 300, json: async () => next.body };
  };
  return { impl, calls };
}

async function setup(responses, extra = {}) {
  const cacheDir = await mkdtemp(join(tmpdir(), "music-web-"));
  const fake = fakeFetch(responses);
  const sleeps = [];
  let clock = 0;
  const fetcher = createFetcher({
    cacheDir, minIntervalMs: 1000, userAgent: "test-agent",
    fetchImpl: fake.impl, sleep: async (ms) => { sleeps.push(ms); clock += ms; }, now: () => clock, ...extra,
  });
  return { fetcher, fake, sleeps, cacheDir };
}

test("caches responses on disk and serves repeats from cache", async () => {
  const { fetcher, fake, cacheDir } = await setup([{ status: 200, body: { hello: "world" } }]);
  assert.deepEqual(await fetcher.getJson("https://example.test/a"), { hello: "world" });
  assert.deepEqual(await fetcher.getJson("https://example.test/a"), { hello: "world" });
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(fetcher.stats, { network: 1, cached: 1 });
  assert.equal(fake.calls[0].options.headers["User-Agent"], "test-agent");
  assert.equal((await readdir(cacheDir)).length, 1);
});

test("throttles consecutive network requests to minIntervalMs", async () => {
  const { fetcher, sleeps } = await setup([{ status: 200, body: 1 }, { status: 200, body: 2 }]);
  await fetcher.getJson("https://example.test/1");
  await fetcher.getJson("https://example.test/2");
  assert.deepEqual(sleeps, [1000]);
});

test("retries 503 with backoff, then succeeds", async () => {
  const { fetcher, sleeps } = await setup([{ status: 503, body: null }, { status: 200, body: { ok: true } }]);
  assert.deepEqual(await fetcher.getJson("https://example.test/x"), { ok: true });
  assert.ok(sleeps.includes(1000), `expected a 1000ms backoff, got ${sleeps}`);
});

test("throws on other errors with the API key redacted", async () => {
  const { fetcher } = await setup([{ status: 500, body: null }]);
  await assert.rejects(
    fetcher.getJson("https://example.test/?method=x&api_key=abc123&format=json"),
    (error) => error.message === "HTTP 500 for https://example.test/?method=x&api_key=REDACTED&format=json",
  );
});

test("cacheKey keeps secrets out of the cache identity", async () => {
  const { fetcher, fake } = await setup([{ status: 200, body: "first" }]);
  await fetcher.getJson("https://example.test/?api_key=one", { cacheKey: "same" });
  assert.equal(await fetcher.getJson("https://example.test/?api_key=two", { cacheKey: "same" }), "first");
  assert.equal(fake.calls.length, 1);
});

test("redact replaces every api_key value", () => {
  assert.equal(redact("a?api_key=1&b=2&api_key=3"), "a?api_key=REDACTED&b=2&api_key=REDACTED");
});
