import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  const { fetcher, sleeps } = await setup(
    [{ status: 503, body: null }, { status: 200, body: { ok: true } }], { minIntervalMs: 0 });
  assert.deepEqual(await fetcher.getJson("https://example.test/x"), { ok: true });
  assert.deepEqual(sleeps, [1000]);
});

test("retries 429, then succeeds", async () => {
  const { fetcher, fake } = await setup(
    [{ status: 429, body: null }, { status: 200, body: { ok: true } }], { minIntervalMs: 0 });
  assert.deepEqual(await fetcher.getJson("https://example.test/x"), { ok: true });
  assert.equal(fake.calls.length, 2);
});

test("gives up after maxRetries with the HTTP status", async () => {
  const { fetcher, fake } = await setup(
    [{ status: 503, body: null }, { status: 503, body: null }, { status: 503, body: null }],
    { minIntervalMs: 0, maxRetries: 2 });
  await assert.rejects(
    fetcher.getJson("https://example.test/x"),
    (error) => error.message === "HTTP 503 for https://example.test/x",
  );
  assert.equal(fake.calls.length, 3);
});

test("backoff doubles on each retry", async () => {
  const { fetcher, sleeps } = await setup(
    [{ status: 503, body: null }, { status: 503, body: null }, { status: 200, body: 1 }], { minIntervalMs: 0 });
  await fetcher.getJson("https://example.test/x");
  assert.deepEqual(sleeps, [1000, 2000]);
});

test("leaves exactly one .json file and no temp files after a fetch", async () => {
  const { fetcher, cacheDir } = await setup([{ status: 200, body: { a: 1 } }]);
  await fetcher.getJson("https://example.test/a");
  const names = await readdir(cacheDir);
  assert.equal(names.length, 1);
  assert.match(names[0], /\.json$/);
  assert.equal(names.some((name) => name.endsWith(".tmp")), false);
});

test("a corrupt cache file fails loudly with its path and does not refetch", async () => {
  const { fetcher, fake, cacheDir } = await setup([{ status: 200, body: { a: 1 } }]);
  const url = "https://example.test/corrupt";
  const file = join(cacheDir, `${createHash("sha256").update(url).digest("hex")}.json`);
  await writeFile(file, '{"truncated": ');
  await assert.rejects(
    fetcher.getJson(url),
    (error) => error.message.includes(file) && /corrupt/i.test(error.message),
  );
  assert.equal(fake.calls.length, 0);
});

test("cacheKey defaults to the redacted URL", async () => {
  const { fetcher, fake } = await setup([{ status: 200, body: "first" }]);
  await fetcher.getJson("https://example.test/?q=1&api_key=one");
  assert.equal(await fetcher.getJson("https://example.test/?q=1&api_key=two"), "first");
  assert.equal(fake.calls.length, 1);
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
