import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchUrl, lookupUrl, pickMatch, parseLineage, parseGenres, enrichMusicBrainz } from "../musicbrainz.mjs";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const FALLON_ID = "20d7beef-118f-493c-99f9-3931835cb658";

test("URLs quote the artist and request relations + genres", () => {
  assert.equal(searchUrl('Say "Hi"'), "https://musicbrainz.org/ws/2/artist?query=artist%3A%22Say%20Hi%22&fmt=json&limit=5");
  assert.equal(lookupUrl("abc"), "https://musicbrainz.org/ws/2/artist/abc?inc=artist-rels+genres&fmt=json");
});

test("pickMatch accepts a single confident, same-name result", () => {
  assert.deepEqual(pickMatch(fixture("mb-search-brian-fallon.json"), "Brian Fallon"), { mbid: FALLON_ID, reason: null });
});

test("pickMatch refuses low scores, different names and ties", () => {
  assert.equal(pickMatch({ artists: [{ id: "1", name: "Valley", score: 80 }] }, "Valley").mbid, null);
  assert.equal(pickMatch({ artists: [{ id: "1", name: "Valley Girl", score: 100 }] }, "Valley").mbid, null);
  const tie = pickMatch({ artists: [{ id: "1", name: "Valley", score: 100 }, { id: "2", name: "Valley", score: 100 }] }, "Valley");
  assert.equal(tie.mbid, null);
  assert.match(tie.reason, /ambiguous/);
  assert.equal(pickMatch({}, "Anyone").reason, "no confident match");
});

test("parseLineage labels and de-duplicates relations", () => {
  const lineage = parseLineage(fixture("mb-artist-brian-fallon.json"));
  const gaslight = lineage.filter((item) => item.name === "The Gaslight Anthem");
  assert.equal(gaslight.length, 1, "repeated membership periods collapse to one");
  assert.equal(gaslight[0].relation, "member of");
  const keys = lineage.map((item) => `${item.relation}|${item.mbid}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("parseLineage maps backward memberships and ignores other relation types", () => {
  const lineage = parseLineage({ relations: [
    { type: "member of band", direction: "backward", artist: { id: "m1", name: "Member One" } },
    { type: "subgroup", direction: "forward", artist: { id: "g1", name: "Offshoot" } },
    { type: "is person", direction: "backward", artist: { id: "p1", name: "Real Name" } },
    { type: "collaboration", direction: "forward", artist: { id: "x", name: "Ignored" } },
  ] });
  assert.deepEqual(lineage, [
    { relation: "member", name: "Member One", mbid: "m1" },
    { relation: "related group", name: "Offshoot", mbid: "g1" },
    { relation: "same person", name: "Real Name", mbid: "p1" },
  ]);
});

test("parseGenres returns the top five by count", () => {
  const genres = parseGenres({ genres: [
    { name: "a", count: 1 }, { name: "b", count: 9 }, { name: "c", count: 5 },
    { name: "d", count: 4 }, { name: "e", count: 3 }, { name: "f", count: 2 },
  ] });
  assert.deepEqual(genres, ["b", "c", "d", "e", "f"]);
});

test("enrichMusicBrainz uses pins, records unmatched artists and never guesses", async () => {
  const responses = new Map([
    [searchUrl("Brian Fallon"), fixture("mb-search-brian-fallon.json")],
    [lookupUrl(FALLON_ID), fixture("mb-artist-brian-fallon.json")],
    [searchUrl("Valley"), { artists: [{ id: "1", name: "Valley", score: 100 }, { id: "2", name: "Valley", score: 100 }] }],
    [lookupUrl("pinned-id"), { relations: [], genres: [{ name: "indie pop", count: 2 }] }],
  ]);
  const fetcher = { getJson: async (url) => { if (!responses.has(url)) throw new Error(`unexpected ${url}`); return responses.get(url); } };
  const artists = [
    { id: "brian-fallon", name: "Brian Fallon" },
    { id: "valley", name: "Valley" },
    { id: "juice", name: "Juice" },
  ];
  const result = await enrichMusicBrainz(artists, { fetcher, pinned: { juice: "pinned-id" } });
  assert.equal(result.artists[0].mbid, FALLON_ID);
  assert.ok(result.artists[0].lineage.length > 0);
  assert.deepEqual(result.artists[1], { id: "valley", name: "Valley", mbid: null, mbGenres: [], lineage: [] });
  assert.deepEqual(result.artists[2].mbGenres, ["indie pop"]);
  assert.deepEqual(result.unmatched.map((item) => item.id), ["valley"]);
});
