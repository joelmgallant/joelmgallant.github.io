import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, validateMonth, yearChecks, wordCount, isDesText } from '../lib/validate.mjs';

const CARDS = new Set(['Knight of Wands', 'Six of Pentacles', 'Death']);
const words = (count, word = 'spark') => Array.from({ length: count }, (_, index) => `${word}${index}`).join(' ');

function goodEntry(date = '2026-11-10', overrides = {}) {
  return {
    date,
    title: 'The Day of the Missing Pen',
    skyStory: words(50, `sky${date}x`),
    joel: { emblem: 'fire-tiger', reading: [words(60, `jA${date}x`), words(50, `jB${date}x`)],
      mission: words(12, `jm${date}x`), omen: words(12, `jo${date}x`),
      stone: 'onyx', stoneWhy: 'moon in an earth sign', element: 'earth', elementWhy: 'feet on the floor' },
    nancy: { emblem: 'shore', reading: [words(60, `nA${date}x`), words(50, `nB${date}x`)],
      mission: words(12, `nm${date}x`), omen: words(12, `no${date}x`),
      stone: 'pearl', stoneWhy: 'moonlight on the shore', element: 'water', elementWhy: 'let it flow' },
    together: { mood: 'mischief', text: words(40, `t${date}x`) },
    des: false,
    ...overrides,
  };
}

test('wordCount counts card tokens as their words', () => {
  assert.equal(wordCount('Ask the [[Knight of Wands]] nicely.'), 6);
});

test('isDesText matches the phrase, DES and the Greek letters, not ordinary words', () => {
  assert.ok(isDesText("Don't even scream."));
  assert.ok(isDesText('Don’t even scream'));
  assert.ok(isDesText('Pure DES energy.'));
  assert.ok(isDesText('ΔΕΣ, obviously.'));
  assert.ok(!isDesText('The desk designs destiny.'));
});

test('a good entry has no errors', () => {
  assert.deepEqual(validateEntry(goodEntry(), CARDS), []);
});

test('missing fields, bad enums and wrong emblem owner are errors', () => {
  const entry = goodEntry();
  delete entry.title;
  entry.joel.stone = 'emerald';
  entry.nancy.emblem = 'fire-tiger';
  entry.together.mood = 'gloom';
  const errors = validateEntry(entry, CARDS).join('\n');
  assert.match(errors, /title/);
  assert.match(errors, /joel\.stone/);
  assert.match(errors, /nancy\.emblem/);
  assert.match(errors, /together\.mood/);
});

test('length limits are enforced per field', () => {
  const entry = goodEntry();
  entry.joel.reading = [words(20), words(20)];
  entry.together.text = words(90);
  const errors = validateEntry(entry, CARDS).join('\n');
  assert.match(errors, /joel\.reading/);
  assert.match(errors, /together\.text/);
});

test('reading must be exactly two paragraphs', () => {
  const entry = goodEntry();
  entry.nancy.reading = [words(110)];
  assert.match(validateEntry(entry, CARDS).join('\n'), /nancy\.reading/);
});

test('unknown tarot cards are errors, known ones are fine', () => {
  const entry = goodEntry();
  entry.joel.omen = `The [[Knight of Wands]] and the [[Knight of Wand]] argue about lunch today.`;
  const errors = validateEntry(entry, CARDS).join('\n');
  assert.match(errors, /Knight of Wand\b/);
  assert.doesNotMatch(errors, /Knight of Wands/);
});

test('banned topics are caught, but tarot names and zodiac signs are not', () => {
  const entry = goodEntry();
  entry.joel.mission = 'Put your savings into crypto before the moon notices you, quickly now.';
  entry.nancy.omen = 'The [[Death]] card waves hello while the moon sits in Cancer all afternoon.';
  const errors = validateEntry(entry, CARDS).join('\n');
  assert.match(errors, /banned.*crypto/);
  assert.doesNotMatch(errors, /Death|Cancer/);
});

test('heritage references are banned in reading text', () => {
  const entry = goodEntry();
  entry.skyStory = `${words(45)} remember your past life by the sea`;
  assert.match(validateEntry(entry, CARDS).join('\n'), /banned/);
});

test('DES flag must match the text', () => {
  const flaggedButSilent = goodEntry('2026-11-10', { des: true });
  assert.match(validateEntry(flaggedButSilent, CARDS).join('\n'), /des/);

  const silentButSaysIt = goodEntry();
  silentButSaysIt.together.text = `${words(35)} don't even scream`;
  assert.match(validateEntry(silentButSaysIt, CARDS).join('\n'), /des/);
});

test('validateMonth requires exactly the expected dates', () => {
  const entries = [goodEntry('2026-11-10'), goodEntry('2026-11-10')];
  const errors = validateMonth(entries, ['2026-11-10', '2026-11-11'], CARDS).join('\n');
  assert.match(errors, /duplicate.*2026-11-10/);
  assert.match(errors, /missing.*2026-11-11/);
});

test('yearChecks flags repeated openings and shared mission phrases', () => {
  const first = goodEntry('2026-11-10');
  const second = goodEntry('2026-11-11');
  second.joel.reading[0] = first.joel.reading[0];
  second.nancy.mission = first.joel.mission;
  const { errors, flaggedDates } = yearChecks([first, second], { desMin: 0, desMax: 10 });
  assert.match(errors.join('\n'), /opening/);
  assert.match(errors.join('\n'), /phrase/);
  assert.deepEqual(flaggedDates, ['2026-11-11']);
});

test('yearChecks enforces the DES day range', () => {
  const entries = [goodEntry('2026-11-10'), goodEntry('2026-11-11')];
  const { errors } = yearChecks(entries, { desMin: 1, desMax: 5 });
  assert.match(errors.join('\n'), /DES days/);
});
