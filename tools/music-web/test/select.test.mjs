import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByArtist, loveScore, passesRule, selectArtists, missingForcedIn } from "../select.mjs";

const track = (artist, title, plays = 0, favourite = false, genre = "Alternative") =>
  ({ title, artist, album: "", genre, year: 2020, plays, favourite });

const tracks = [
  track("Noah Kahan", "Stick Season", 40, true),
  track("Noah Kahan", "Dial Drunk", 20),
  track("Noah Kahan", "Northern Attitude", 5, false, "Singer/Songwriter"),
  track("Noah Kahan & Hozier", "Northern Attitude (with Hozier)", 7),
  track("Hozier", "Take Me to Church", 1),
  track("Mumford & Sons", "The Cave", 2),
  track("Flo Rida", "Low", 1),
  track("", "Mystery", 99),
];

test("groupByArtist splits duet credits and totals per artist", () => {
  const groups = groupByArtist(tracks);
  const noah = groups.find((group) => group.key === "noah kahan");
  assert.equal(noah.name, "Noah Kahan");
  assert.equal(noah.songs, 4);
  assert.equal(noah.plays, 72);
  assert.equal(noah.favourites, 1);
  assert.deepEqual(noah.appleGenres, ["Alternative", "Singer/Songwriter"]);
  assert.equal(noah.tracks[0].title, "Stick Season");
  assert.equal(groups.find((group) => group.key === "hozier").songs, 2);
  assert.ok(groups.find((group) => group.key === "mumford and sons"), "Mumford & Sons stays whole");
  assert.equal(groups.some((group) => group.key === ""), false, "blank artists are skipped");
});

test("loveScore and passesRule use the configured weights and thresholds", () => {
  assert.equal(loveScore({ songs: 4, plays: 72, favourites: 1 }), 4 + 14.4 + 3);
  assert.equal(passesRule({ songs: 3, plays: 0, favourites: 0 }), true);
  assert.equal(passesRule({ songs: 1, plays: 10, favourites: 0 }), true);
  assert.equal(passesRule({ songs: 1, plays: 0, favourites: 1 }), true);
  assert.equal(passesRule({ songs: 2, plays: 9, favourites: 0 }), false);
});

test("selectArtists applies the rule, overrides and unique ids", () => {
  const groups = groupByArtist(tracks);
  const selected = selectArtists(groups, { forceIn: ["Mumford & Sons"], forceOut: ["Hozier"] });
  assert.deepEqual(selected.map((artist) => artist.id), ["mumford-and-sons", "noah-kahan"]);
  assert.equal(selected.find((artist) => artist.id === "noah-kahan").love, 21.4);
});

test("selectArtists de-duplicates colliding ids", () => {
  const groups = [
    { key: "a b", name: "A B", songs: 5, plays: 0, favourites: 0, appleGenres: [], tracks: [] },
    { key: "a and b", name: "A-B", songs: 5, plays: 0, favourites: 0, appleGenres: [], tracks: [] },
  ];
  assert.deepEqual(selectArtists(groups).map((artist) => artist.id).sort(), ["a-b", "a-b-2"]);
});

test("missingForcedIn lists override names that are not in the library", () => {
  assert.deepEqual(missingForcedIn(groupByArtist(tracks), ["Noah Kahan", "Nobody"]), ["Nobody"]);
});
