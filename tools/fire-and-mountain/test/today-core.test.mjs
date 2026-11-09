import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localIsoDate, monthKey, resolveDay, pickEntry, tokenizeCards, isWaxing, moonPath, sigilPoints,
  FIRST_DAY, LAST_DAY } from '../../../static/fire-and-mountain/today/today-core.mjs';

test('localIsoDate uses the local calendar date, zero-padded', () => {
  assert.equal(localIsoDate(new Date(2026, 10, 9, 23, 59)), '2026-11-09');
  assert.equal(localIsoDate(new Date(2027, 0, 5, 0, 1)), '2027-01-05');
});

test('monthKey is YYYY-MM', () => {
  assert.equal(monthKey('2027-03-21'), '2027-03');
});

test('resolveDay: inside, before and after the batch', () => {
  assert.deepEqual(resolveDay('2027-03-21'), { status: 'ok', date: '2027-03-21' });
  assert.deepEqual(resolveDay('2026-11-09'), { status: 'ok', date: FIRST_DAY });
  assert.deepEqual(resolveDay(LAST_DAY), { status: 'ok', date: LAST_DAY });
  assert.deepEqual(resolveDay('2027-11-10'), { status: 'after' });
});

test('pickEntry finds the entry for a date or returns null', () => {
  const entries = [{ date: '2027-03-20' }, { date: '2027-03-21' }];
  assert.equal(pickEntry(entries, '2027-03-21'), entries[1]);
  assert.equal(pickEntry(entries, '2027-03-22'), null);
});

test('tokenizeCards splits text into plain parts and known card links', () => {
  const links = { 'Knight of Wands': 'https://example.test/kow/' };
  assert.deepEqual(tokenizeCards('Ask the [[Knight of Wands]] nicely, not [[Knight of Wand]].', links), [
    { type: 'text', text: 'Ask the ' },
    { type: 'card', name: 'Knight of Wands', url: 'https://example.test/kow/' },
    { type: 'text', text: ' nicely, not ' },
    { type: 'text', text: 'Knight of Wand' },
    { type: 'text', text: '.' },
  ]);
  assert.deepEqual(tokenizeCards('no cards here', links), [{ type: 'text', text: 'no cards here' }]);
});

test('isWaxing covers new through waxing gibbous', () => {
  assert.ok(isWaxing('waxing-crescent'));
  assert.ok(isWaxing('first-quarter'));
  assert.ok(!isWaxing('waning-gibbous'));
  assert.ok(!isWaxing('last-quarter'));
});

// Moon drawn in a 100x100 box, radius 48, centre 50. Screen y points down, so a clockwise arc
// from the top passes through the right-hand side. Northern hemisphere: waxing is lit on the right.
test('moonPath: waxing crescent is lit on the right with a terminator bulging right', () => {
  assert.equal(moonPath(0.25, true), 'M50 2 A48 48 0 0 1 50 98 A24 48 0 0 0 50 2 Z');
});

test('moonPath: waxing gibbous terminator bulges left', () => {
  assert.equal(moonPath(0.75, true), 'M50 2 A48 48 0 0 1 50 98 A24 48 0 0 1 50 2 Z');
});

test('moonPath: waning crescent is the mirror image, lit on the left', () => {
  assert.equal(moonPath(0.25, false), 'M50 2 A48 48 0 0 0 50 98 A24 48 0 0 1 50 2 Z');
});

test('moonPath: quarter moon has a straight terminator', () => {
  assert.equal(moonPath(0.5, true), 'M50 2 A48 48 0 0 1 50 98 A0 48 0 0 0 50 2 Z');
});

test('sigilPoints is deterministic per date and differs between dates', () => {
  const first = sigilPoints('2026-11-10');
  assert.deepEqual(first, sigilPoints('2026-11-10'));
  assert.notDeepEqual(first, sigilPoints('2026-11-11'));
  assert.ok(first.length >= 5 && first.length <= 8);
  for (const [x, y] of first) assert.ok(x >= 8 && x <= 56 && y >= 8 && y <= 56);
});
