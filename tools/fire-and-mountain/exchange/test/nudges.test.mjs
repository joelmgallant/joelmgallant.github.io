import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayPhrase, exchangeNudge, gameNudge } from '../src/nudges.mjs';

const TODAY = '2026-11-20';
const OPEN = { valid: true, open: true, closed: false };
const answer = (text) => ({ text, updatedAt: '2026-11-20T12:00:00Z' });

test('dayPhrase names the day relative to today', () => {
  assert.equal(dayPhrase('2026-11-20', TODAY), "today's");
  assert.equal(dayPhrase('2026-11-19', TODAY), "yesterday's");
  assert.equal(dayPhrase('2026-11-21', TODAY), "tomorrow's");
  assert.equal(dayPhrase('2026-11-17', TODAY), 'the Nov 17');
});

test('a first Exchange answer tells the other person it is their move', () => {
  const nudge = exchangeNudge({ date: TODAY }, { date: TODAY, nancy: answer('Lighthouse') }, 'nancy', TODAY, TODAY);
  assert.equal(nudge.kind, 'exchange-answered');
  assert.match(nudge.body, /Nancy locked in today's Exchange/);
  assert.equal(nudge.url, './#exchange');
});

test('the answer that completes the pair announces the reveal', () => {
  const before = { date: TODAY, joel: answer('Tide') };
  const nudge = exchangeNudge(before, { ...before, nancy: answer('Lighthouse') }, 'nancy', TODAY, TODAY);
  assert.equal(nudge.kind, 'exchange-revealed');
  assert.match(nudge.body, /revealed/);
});

test('editing an answer sends nothing', () => {
  const before = { date: TODAY, nancy: answer('Lighthouse') };
  assert.equal(exchangeNudge(before, { date: TODAY, nancy: answer('Harbour') }, 'nancy', TODAY, TODAY), null);
});

test('Exchange nudges never carry the answer text', () => {
  const before = { date: TODAY, joel: answer('SECRET-ONE') };
  const nudge = exchangeNudge(before, { ...before, nancy: answer('SECRET-TWO') }, 'nancy', TODAY, TODAY);
  assert.doesNotMatch(JSON.stringify(nudge), /SECRET/);
});

const game = (fields) => ({ date: `game#${TODAY}`, ...fields });
const g = (value) => ({ value, at: '2026-11-20T12:00:00Z' });

test('game nudges follow the stage the write moved the round to', () => {
  const one = (type, before, after, actor = 'joel') => gameNudge(type, before, after, actor, OPEN, TODAY, TODAY)?.kind ?? null;
  const a = { text: 'x' };
  assert.equal(one('wrong', game({}), game({ joel: a })), 'game-answered');
  assert.equal(one('wrong', game({ nancy: a }), game({ nancy: a, joel: a })), 'game-done');
  assert.equal(one('closeup', game({ nancy: a }), game({ nancy: a, joel: a })), 'game-guess');
  assert.equal(one('closeup', game({ nancy: a, joel: a }), game({ nancy: a, joel: a, guess_joel: g('cat') })), 'game-guessed');
  assert.equal(one('closeup', game({ nancy: a, joel: a, guess_nancy: g('d') }), game({ nancy: a, joel: a, guess_nancy: g('d'), guess_joel: g('c') })), 'game-ruling');
  const guessed = { nancy: a, joel: a, guess_nancy: g('d'), guess_joel: g('c') };
  assert.equal(one('closeup', game(guessed), game({ ...guessed, ruling_joel: g('yes') })), 'game-ruled');
  assert.equal(one('closeup', game({ ...guessed, ruling_nancy: g('no') }), game({ ...guessed, ruling_nancy: g('no'), ruling_joel: g('yes') })), 'game-done');
  assert.equal(one('tales', game({ nancy: a, joel: a, guess_nancy: g(1) }), game({ nancy: a, joel: a, guess_nancy: g(1), guess_joel: g(2) })), 'game-done');
});

test('game nudges name the actor, link to the Bonus Round and carry no game content', () => {
  const nudge = gameNudge('wrong', game({}), game({ nancy: { text: 'SECRET' } }), 'nancy', OPEN, TODAY, TODAY);
  assert.match(nudge.body, /Nancy/);
  assert.equal(nudge.url, './#bonus');
  assert.doesNotMatch(JSON.stringify(nudge), /SECRET/);
});
