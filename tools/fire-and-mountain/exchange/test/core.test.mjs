import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashKey, personForKey, halifaxToday, addDays, dayStatus, normalizeAnswerText, isMatch,
  validateAnswer, shapeExchange } from '../src/core.mjs';

const HASHES = { joel: hashKey('joel-key'), nancy: hashKey('nancy-key') };
const BATCH = { firstDay: '2026-11-10', lastDay: '2027-11-09' };

test('personForKey maps keys to people by hash, rejects everything else', () => {
  assert.equal(personForKey('joel-key', HASHES), 'joel');
  assert.equal(personForKey('nancy-key', HASHES), 'nancy');
  assert.equal(personForKey('wrong', HASHES), null);
  assert.equal(personForKey('', HASHES), null);
  assert.equal(personForKey(undefined, HASHES), null);
});

test('halifaxToday uses Atlantic time, not UTC', () => {
  assert.equal(halifaxToday(new Date('2026-11-11T02:30:00Z')), '2026-11-10'); // 22:30 AST
  assert.equal(halifaxToday(new Date('2026-11-11T05:00:00Z')), '2026-11-11'); // 01:00 AST
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-11-10', -4), '2026-11-06');
});

test('dayStatus: open from today-4 to today+1, closed before, not yet after, invalid outside batch', () => {
  const today = '2026-11-20';
  assert.deepEqual(dayStatus('2026-11-20', today, BATCH), { valid: true, open: true, closed: false });
  assert.deepEqual(dayStatus('2026-11-16', today, BATCH), { valid: true, open: true, closed: false });
  assert.deepEqual(dayStatus('2026-11-21', today, BATCH), { valid: true, open: true, closed: false });
  assert.deepEqual(dayStatus('2026-11-15', today, BATCH), { valid: true, open: false, closed: true });
  assert.deepEqual(dayStatus('2026-11-22', today, BATCH), { valid: true, open: false, closed: false });
  assert.equal(dayStatus('2026-11-09', today, BATCH).valid, false);
  assert.equal(dayStatus('2027-11-10', today, BATCH).valid, false);
  assert.equal(dayStatus('not-a-date', today, BATCH).valid, false);
});

test('normalizeAnswerText ignores case, punctuation, spacing and a leading article', () => {
  assert.equal(normalizeAnswerText('  Cozy!! '), 'cozy');
  assert.equal(normalizeAnswerText('The Moon.'), 'moon');
  assert.equal(normalizeAnswerText('an   Owl'), 'owl');
  assert.equal(normalizeAnswerText("Don't  stop"), 'dont stop');
});

test('isMatch needs both texts and equal normalized values', () => {
  assert.equal(isMatch({ joel: { text: 'Cozy!' }, nancy: { text: 'cozy' } }), true);
  assert.equal(isMatch({ joel: { text: 'cozy' }, nancy: { text: 'warm' } }), false);
  assert.equal(isMatch({ joel: { text: 'cozy' } }), false);
  assert.equal(isMatch({ joel: { photoKey: 'x' }, nancy: { photoKey: 'y' } }), false);
});

test('validateAnswer requires content, limits text, and checks media ownership', () => {
  const date = '2026-11-20';
  assert.equal(validateAnswer({ text: 'hi' }, date, 'joel'), null);
  assert.match(validateAnswer({}, date, 'joel'), /empty/);
  assert.match(validateAnswer({ text: '   ' }, date, 'joel'), /empty/);
  assert.match(validateAnswer({ text: 'x'.repeat(501) }, date, 'joel'), /500/);
  assert.equal(validateAnswer({ photoKey: `${date}/joel/photo-abc.jpg` }, date, 'joel'), null);
  assert.match(validateAnswer({ photoKey: `${date}/nancy/photo-abc.jpg` }, date, 'joel'), /photoKey/);
  assert.match(validateAnswer({ audioKey: `2026-11-19/joel/audio-abc.webm`, audioType: 'audio/webm' }, date, 'joel'), /audioKey/);
  assert.match(validateAnswer({ audioKey: `${date}/joel/audio-abc.ogg`, audioType: 'audio/ogg' }, date, 'joel'), /audioType/);
  assert.equal(validateAnswer({ audioKey: `${date}/joel/audio-abc.m4a`, audioType: 'audio/mp4' }, date, 'joel'), null);
});

test('shapeExchange hides the other answer until revealed', () => {
  const open = { valid: true, open: true, closed: false };
  const onlyNancy = { date: '2026-11-20', nancy: { text: 'secret', updatedAt: 't' } };
  const forJoel = shapeExchange(onlyNancy, 'joel', open);
  assert.equal(forJoel.revealed, false);
  assert.equal(forJoel.me, null);
  assert.deepEqual(forJoel.them, { answered: true });
  assert.equal(JSON.stringify(forJoel).includes('secret'), false);

  const forNancy = shapeExchange(onlyNancy, 'nancy', open);
  assert.equal(forNancy.me.text, 'secret');
  assert.deepEqual(forNancy.them, { answered: false });
});

test('shapeExchange reveals both answers once both are in, and flags matches', () => {
  const open = { valid: true, open: true, closed: false };
  const both = { date: '2026-11-20', joel: { text: 'Cozy' }, nancy: { text: 'cozy!' } };
  const shaped = shapeExchange(both, 'joel', open);
  assert.equal(shaped.revealed, true);
  assert.equal(shaped.match, true);
  assert.equal(shaped.them.answer.text, 'cozy!');
});

test('shapeExchange reveals a lone answer once the day closes', () => {
  const closed = { valid: true, open: false, closed: true };
  const shaped = shapeExchange({ date: '2026-11-10', nancy: { text: 'late' } }, 'joel', closed);
  assert.equal(shaped.revealed, true);
  assert.equal(shaped.them.answer.text, 'late');
  assert.equal(shaped.match, false);
  assert.equal(shaped.open, false);
});
