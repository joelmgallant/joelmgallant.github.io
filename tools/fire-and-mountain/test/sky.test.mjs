import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noonHalifaxUtc, phaseBucket, skyForDate, dateRange } from '../lib/sky-core.mjs';

test('noon in Halifax is 16:00Z in winter (AST) and 15:00Z in summer (ADT)', () => {
  assert.equal(noonHalifaxUtc('2026-02-17').toISOString(), '2026-02-17T16:00:00.000Z');
  assert.equal(noonHalifaxUtc('2026-08-12').toISOString(), '2026-08-12T15:00:00.000Z');
});

test('phase buckets are 45-degree bands centred on the eight phases', () => {
  assert.equal(phaseBucket(0), 'new');
  assert.equal(phaseBucket(22.4), 'new');
  assert.equal(phaseBucket(22.5), 'waxing-crescent');
  assert.equal(phaseBucket(90), 'first-quarter');
  assert.equal(phaseBucket(180), 'full');
  assert.equal(phaseBucket(270), 'last-quarter');
  assert.equal(phaseBucket(337.5), 'new');
  assert.equal(phaseBucket(359.9), 'new');
});

// Ground truth: lunar eclipses happen only at full moon, solar eclipses only at new moon.
// 2026-03-03 total lunar eclipse (Sun in Pisces, so Moon opposite in Virgo).
// 2026-08-28 partial lunar eclipse (Sun in Virgo, so Moon in Pisces).
// 2026-08-12 total solar eclipse (Moon with the Sun in Leo).
test('eclipse dates land on the right phase and sign', () => {
  const march = skyForDate('2026-03-03');
  assert.equal(march.phase, 'full');
  assert.equal(march.moonSign, 'Virgo');
  assert.ok(march.illumination > 0.98);

  const lateAug = skyForDate('2026-08-28');
  assert.equal(lateAug.phase, 'full');
  assert.equal(lateAug.moonSign, 'Pisces');

  const midAug = skyForDate('2026-08-12');
  assert.equal(midAug.phase, 'new');
  assert.equal(midAug.moonSign, 'Leo');
  assert.ok(midAug.illumination < 0.02);
});

test('sky entries carry a display name and a rounded illumination', () => {
  const sky = skyForDate('2026-03-03');
  assert.equal(sky.phaseName, 'Full Moon');
  assert.equal(sky.illumination, Math.round(sky.illumination * 100) / 100);
});

test('the reading year is 365 consecutive dates', () => {
  const dates = dateRange('2026-11-10', '2027-11-09');
  assert.equal(dates.length, 365);
  assert.equal(dates[0], '2026-11-10');
  assert.equal(dates.at(-1), '2027-11-09');
  assert.equal(new Set(dates).size, 365);
});
