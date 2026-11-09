import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tarotLinks, SPREAD_CARDS } from '../lib/tarot-cards.mjs';
import { libraryImages } from '../lib/vocab.mjs';

test('the deck has 78 uniquely named cards with unique Biddy Tarot URLs', () => {
  const links = tarotLinks();
  assert.equal(Object.keys(links).length, 78);
  assert.equal(new Set(Object.values(links)).size, 78);
  for (const url of Object.values(links)) {
    assert.match(url, /^https:\/\/biddytarot\.com\/tarot-card-meanings\/(major|minor)-arcana\/[a-z-/]+\/$/);
  }
});

test('every card from the spread is in the deck', () => {
  const links = tarotLinks();
  for (const card of SPREAD_CARDS) assert.ok(links[card], `missing ${card}`);
});

test('the published tarot-links.json matches the generator', () => {
  const published = JSON.parse(readFileSync(
    new URL('../../../static/fire-and-mountain/tarot-links.json', import.meta.url), 'utf8'));
  assert.deepEqual(published, tarotLinks());
});

test('the illustration library has 34 unique files', () => {
  const images = libraryImages();
  assert.equal(images.length, 34);
  assert.equal(new Set(images).size, 34);
});
