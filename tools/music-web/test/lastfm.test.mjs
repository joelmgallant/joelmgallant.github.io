import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readApiKey, methodUrl, parseSimilar, parseTopTags, enrichLastfm } from "../lastfm.mjs";

const KEY = "0123456789abcdef0123456789abcdef";

test("readApiKey trims and validates the token file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfm-"));
  await writeFile(join(dir, "good"), `${KEY}\n`);
  await writeFile(join(dir, "bad"), "nope\n");
  assert.equal(readApiKey(join(dir, "good")), KEY);
  assert.throws(() => readApiKey(join(dir, "bad")), /not a 32-character hex string/);
});

test("methodUrl keeps the key out of the cache key", () => {
  const { url, cacheKey } = methodUrl("artist.getSimilar", "Mumford & Sons", KEY);
  assert.ok(url.includes(`api_key=${KEY}`));
  assert.ok(url.includes("artist=Mumford+%26+Sons"));
  assert.equal(cacheKey.includes(KEY), false);
  assert.equal(cacheKey.includes("api_key"), false);
});

test("parseSimilar reads match scores and tolerates Last.fm errors", () => {
  const json = { similarartists: { artist: [{ name: "Brenn!", match: "1" }, { name: "Zero", match: "0" }, { name: "Gregory Alan Isakov", match: "0.66" }] } };
  assert.deepEqual(parseSimilar(json), [{ name: "Brenn!", match: 1 }, { name: "Gregory Alan Isakov", match: 0.66 }]);
  assert.deepEqual(parseSimilar({ error: 6, message: "The artist you supplied could not be found" }), []);
});

test("parseTopTags lowercases, drops weak and generic tags, caps at ten", () => {
  const tag = (name, count) => ({ name, count });
  const json = { toptags: { tag: [tag("Folk", 100), tag("seen live", 90), tag("folk punk", 25), tag("rare", 5), tag("American", 40)] } };
  assert.deepEqual(parseTopTags(json), [{ name: "folk", count: 100 }, { name: "folk punk", count: 25 }]);
  const many = { toptags: { tag: Array.from({ length: 15 }, (_, index) => tag(`t${index}`, 50)) } };
  assert.equal(parseTopTags(many).length, 10);
  assert.deepEqual(parseTopTags({ error: 6 }), []);
});

test("enrichLastfm attaches similar artists and tags and lists empties", async () => {
  const fetcher = {
    getJson: async (url, { cacheKey }) => {
      assert.equal(cacheKey.includes(KEY), false);
      if (url.includes("Nobody")) return { error: 6 };
      if (url.includes("getsimilar") || url.includes("getSimilar")) return { similarartists: { artist: [{ name: "Brenn!", match: "1" }] } };
      return { toptags: { tag: [{ name: "Folk", count: 100 }] } };
    },
  };
  const result = await enrichLastfm([{ id: "noah-kahan", name: "Noah Kahan" }, { id: "nobody", name: "Nobody" }], { fetcher, apiKey: KEY });
  assert.deepEqual(result.artists[0].lfmSimilar, [{ name: "Brenn!", match: 1 }]);
  assert.deepEqual(result.artists[0].lfmTags, [{ name: "folk", count: 100 }]);
  assert.deepEqual(result.missing, [{ id: "nobody", name: "Nobody" }]);
});

test("methodUrl double-encodes plus signs in the artist so Last.fm decodes them once", () => {
  const plus = methodUrl("artist.getSimilar", "Florence + the Machine", KEY);
  assert.ok(plus.url.includes("artist=Florence+%252B+the+Machine"), plus.url);
  assert.ok(plus.cacheKey.includes("artist=Florence+%252B+the+Machine"), plus.cacheKey);
  const plain = methodUrl("artist.getSimilar", "Noah Kahan", KEY);
  assert.equal(plain.cacheKey, "https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=Noah+Kahan&autocorrect=1&limit=100&format=json");
  assert.equal(plain.url, `${plain.cacheKey}&api_key=${KEY}`);
});
