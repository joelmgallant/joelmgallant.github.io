import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJoinKey, panelState, hostLine, pickRecordingType, scaledSize, nickname, otherName }
  from '../../../static/fire-and-mountain/today/exchange-core.mjs';

const KEY = 'a'.repeat(43);

test('parseJoinKey accepts a 43-character base64url key from the hash and rejects anything else', () => {
  assert.equal(parseJoinKey(`#join=${KEY}`), KEY);
  assert.equal(parseJoinKey(`#join=${'A1_-'.repeat(10)}abc`), `${'A1_-'.repeat(10)}abc`);
  assert.equal(parseJoinKey('#join=short'), null);
  assert.equal(parseJoinKey(`#other=${KEY}`), null);
  assert.equal(parseJoinKey(''), null);
});

const response = (overrides) => ({ open: true, revealed: false, match: false, me: null, them: { answered: false }, ...overrides });

test('panelState covers every state of the panel', () => {
  assert.equal(panelState({ hasKey: false }), 'none');
  assert.equal(panelState({ hasKey: true, error: true }), 'offline');
  assert.equal(panelState({ hasKey: true, response: response() }), 'unanswered');
  assert.equal(panelState({ hasKey: true, response: response({ me: { text: 'x' } }) }), 'waiting');
  assert.equal(panelState({ hasKey: true, response: response({ open: false, revealed: true, me: { text: 'x' }, them: { answered: true, answer: { text: 'y' } } }) }), 'revealed');
  assert.equal(panelState({ hasKey: true, response: response({ open: false, revealed: true, me: { text: 'x' }, them: { answered: false } }) }), 'closed');
  assert.equal(panelState({ hasKey: true, response: response({ open: false, revealed: true, me: null, them: { answered: true, answer: { text: 'y' } } }) }), 'closed');
  assert.equal(panelState({ hasKey: true, response: response({ open: false }) }), 'closed');
});

test('names and nicknames', () => {
  assert.equal(nickname('joel'), 'Tiger');
  assert.equal(nickname('nancy'), 'Mountain');
  assert.equal(otherName('joel'), 'Nancy');
  assert.equal(otherName('nancy'), 'Joel');
});

test('hostLine is chosen per state, mentions the right people, and is stable for a date', () => {
  const waiting = hostLine('waiting', 'joel', '2026-11-20');
  assert.match(waiting, /Nancy/);
  assert.equal(waiting, hostLine('waiting', 'joel', '2026-11-20'));
  assert.match(hostLine('waiting', 'nancy', '2026-11-20'), /Joel/);
  for (const state of ['unanswered', 'waiting', 'revealed', 'match', 'closed']) {
    assert.ok(hostLine(state, 'joel', '2026-11-21').length > 5, state);
  }
});

test('pickRecordingType prefers webm/opus, falls back to mp4, else null', () => {
  assert.deepEqual(pickRecordingType((type) => type.startsWith('audio/webm')), { recorderType: 'audio/webm;codecs=opus', uploadType: 'audio/webm' });
  assert.deepEqual(pickRecordingType((type) => type.startsWith('audio/mp4')), { recorderType: 'audio/mp4', uploadType: 'audio/mp4' });
  assert.equal(pickRecordingType(() => false), null);
});

test('scaledSize fits the long side within the limit and never upscales', () => {
  assert.deepEqual(scaledSize(4032, 3024, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(scaledSize(3024, 4032, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(scaledSize(800, 600, 1600), { width: 800, height: 600 });
});
