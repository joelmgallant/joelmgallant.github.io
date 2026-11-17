import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, slugify, splitCredit } from "../lib/names.mjs";

test("normalizeName folds case, accents, ampersands and a leading 'the'", () => {
  assert.equal(normalizeName("The Menzingers"), "menzingers");
  assert.equal(normalizeName("Måneskin"), "maneskin");
  assert.equal(normalizeName("Mumford & Sons"), "mumford and sons");
  assert.equal(normalizeName("  half•alive "), "half alive");
  assert.equal(normalizeName("Panic! At the Disco"), "panic at the disco");
});

test("slugify keeps 'the' and makes URL-safe ids", () => {
  assert.equal(slugify("The Menzingers"), "the-menzingers");
  assert.equal(slugify("Aaron West and The Roaring Twenties"), "aaron-west-and-the-roaring-twenties");
  assert.equal(slugify("Mumford & Sons"), "mumford-and-sons");
  assert.equal(slugify("!!!"), "artist");
});

test("splitCredit splits only when every part is a known artist", () => {
  const known = new Set(["noah kahan", "hozier", "mumford and sons", "kristin chenoweth", "idina menzel"]);
  assert.deepEqual(splitCredit("Noah Kahan & Hozier", known), ["Noah Kahan", "Hozier"]);
  assert.deepEqual(splitCredit("Kristin Chenoweth & Idina Menzel", known), ["Kristin Chenoweth", "Idina Menzel"]);
  assert.deepEqual(splitCredit("Mumford & Sons", known), ["Mumford & Sons"]);
  assert.deepEqual(splitCredit("Noah Kahan & Kacey Musgraves", known), ["Noah Kahan & Kacey Musgraves"]);
  assert.deepEqual(splitCredit("Aaron West and The Roaring Twenties", known), ["Aaron West and The Roaring Twenties"]);
  assert.deepEqual(splitCredit("Hozier", known), ["Hozier"]);
});
