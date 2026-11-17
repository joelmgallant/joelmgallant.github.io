import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleData, validateData, largestMoves, loadStories, formatReport } from "../build.mjs";

function sample() {
  const artists = [
    { id: "brian-fallon", name: "Brian Fallon", mbid: "m-bf", love: 30, songs: 19, plays: 50, favourites: 1, appleGenres: ["Singer/Songwriter"], tracks: [{ title: "Painkillers", plays: 9 }],
      lineage: [{ relation: "member of", name: "The Gaslight Anthem", mbid: "m-tga" }, { relation: "member of", name: "The Horrible Crowes", mbid: "m-thc" }] },
    { id: "the-gaslight-anthem", name: "The Gaslight Anthem", mbid: "m-tga", love: 80, songs: 68, plays: 10, favourites: 0, appleGenres: ["Alternative"], tracks: [], lineage: [] },
  ];
  return assembleData({
    artists,
    edges: [{ source: "brian-fallon", target: "the-gaslight-anthem", weight: 0.9 }],
    clusterOf: new Map([["brian-fallon", "c0"], ["the-gaslight-anthem", "c0"]]),
    clusters: [{ id: "c0", name: "Heartland Punk", color: "#c8361f", size: 2 }],
    positions: { "brian-fallon": { x: 1, y: 2 }, "the-gaslight-anthem": { x: 3, y: 4 } },
    stories: [{ id: "s", title: "S", steps: [{ artist: "brian-fallon", caption: "hi" }] }],
    stats: { songs: 4790, artists: 1027 },
    generated: "2026-11-17",
  });
}

test("assembleData resolves lineage ids and similar artists", () => {
  const data = sample();
  const fallon = data.artists.find((artist) => artist.id === "brian-fallon");
  assert.deepEqual(fallon.lineage, [
    { relation: "member of", name: "The Gaslight Anthem", mbid: "m-tga", id: "the-gaslight-anthem" },
    { relation: "member of", name: "The Horrible Crowes", mbid: "m-thc", id: null },
  ]);
  assert.deepEqual(fallon.similar, [{ id: "the-gaslight-anthem", weight: 0.9 }]);
  assert.equal(fallon.cluster, "c0");
  assert.deepEqual([fallon.x, fallon.y], [1, 2]);
  assert.deepEqual(data.clusters, [{ id: "c0", name: "Heartland Punk", color: "#c8361f" }]);
  assert.deepEqual(data.stats, { songs: 4790, artists: 1027 });
  assert.equal("dateAdded" in fallon, false);
});

test("validateData passes good data", () => {
  assert.deepEqual(validateData(sample(), { forbiddenStrings: ["0123456789abcdef0123456789abcdef"] }), []);
});

test("validateData catches every class of problem", () => {
  const data = sample();
  data.artists.push({ ...data.artists[0] });
  data.artists[1].cluster = "nope";
  data.artists[1].x = Number.NaN;
  data.artists[0].similar.push({ id: "ghost", weight: 1 });
  data.artists[0].lineage.push({ relation: "member of", name: "X", mbid: "x", id: "ghost-band" });
  data.stories[0].steps.push({ artist: "missing", caption: "?" });
  data.artists[0].tracks.push({ title: "secret-key-here", plays: 1 });
  const errors = validateData(data, { forbiddenStrings: ["secret-key-here"] });
  for (const expected of [/duplicate artist id: brian-fallon/, /unknown cluster nope/, /not a finite number/, /similar artist ghost/, /lineage id ghost-band/, /artist missing is not on the map/, /forbidden string/]) {
    assert.ok(errors.some((error) => expected.test(error)), `missing ${expected} in ${JSON.stringify(errors)}`);
  }
});

test("largestMoves ranks moved artists and ignores new ones", () => {
  const moves = largestMoves({ a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 1, y: 1 } }, { a: { x: 3, y: 4 }, b: { x: 0, y: 1 }, c: { x: 1, y: 1 }, d: { x: 9, y: 9 } });
  assert.deepEqual(moves, [{ id: "a", distance: 5 }, { id: "b", distance: 1 }]);
});

test("loadStories reads sorted JSON files and tolerates a missing folder", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stories-"));
  await writeFile(join(dir, "b.json"), JSON.stringify({ id: "b", title: "B", steps: [] }));
  await writeFile(join(dir, "a.json"), JSON.stringify({ id: "a", title: "A", steps: [] }));
  await writeFile(join(dir, "notes.txt"), "ignored");
  assert.deepEqual((await loadStories(dir)).map((story) => story.id), ["a", "b"]);
  assert.deepEqual(await loadStories(join(dir, "nope")), []);
});

test("formatReport states counts, unmatched names and the validation result", () => {
  const report = formatReport({
    trackCount: 4790, groupCount: 1027, selected: 210, newIds: ["noah-kahan"],
    unmatched: [{ id: "valley", name: "Valley", reason: "ambiguous: 3 artists named \"Valley\"" }],
    lastfmMissing: [], missingForced: ["Nobody"], clusters: [{ id: "c0", name: "Folk", size: 40 }],
    moves: [], network: { network: 12, cached: 400 }, errors: [], outFile: "static/music/data.json",
  });
  for (const expected of ["Tracks read: 4790", "Artists on the map: 210", "Valley [valley]: ambiguous", "c0 \"Folk\" (40)", "forceIn names not found in the library: Nobody", "Validation: ok", "Wrote static/music/data.json"]) {
    assert.ok(report.includes(expected), `report is missing "${expected}"\n${report}`);
  }
});
