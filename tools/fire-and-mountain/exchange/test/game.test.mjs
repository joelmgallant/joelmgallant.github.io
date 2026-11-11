import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameStage, validateGameAnswer, validateGuess, validateRuling, scoreGame, shapeGame, gameAnswerRecord } from '../src/game.mjs';

const D = '2026-11-20';
const OPEN = { valid: true, open: true, closed: false };
const CLOSED = { valid: true, open: false, closed: true };
const UPCOMING = { valid: true, open: false, closed: false };
const at = '2026-11-20T15:00:00.000Z';
const v = (value) => ({ value, at });

test('validateGameAnswer enforces each type and storage key ownership', () => {
  const meta = (type, extra = {}) => ({ type, ...extra });
  assert.equal(validateGameAnswer(meta('mind', { optionCount: 3 }), { pick: 2, guess: 0 }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('mind', { optionCount: 3 }), { pick: 3, guess: 0 }, D, 'joel'), /pick/);
  assert.equal(validateGameAnswer(meta('wrong'), { text: 'A hat' }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('wrong'), { text: 'x'.repeat(121) }, D, 'joel'), /120/);
  assert.equal(validateGameAnswer(meta('closest'), { number: 42 }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('closest'), { number: 'lots' }, D, 'joel'), /number/);
  assert.equal(validateGameAnswer(meta('lightning'), { picks: [0, 1, 1] }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('lightning'), { picks: [0, 2, 1] }, D, 'joel'), /picks/);
  assert.equal(validateGameAnswer(meta('tabloid'), { text: 'GLOWS' }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('tabloid'), { text: '' }, D, 'joel'), /empty/);
  assert.equal(validateGameAnswer(meta('closeup'), { photoKey: `${D}/joel/game-photo-1.jpg`, caption: 'Sock' }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('closeup'), { photoKey: `${D}/nancy/game-photo-1.jpg`, caption: 'Sock' }, D, 'joel'), /photoKey/);
  assert.match(validateGameAnswer(meta('closeup'), { photoKey: `${D}/joel/photo-1.jpg`, caption: 'Sock' }, D, 'joel'), /photoKey/);
  assert.match(validateGameAnswer(meta('closeup'), { photoKey: `${D}/joel/game-photo-1.jpg` }, D, 'joel'), /caption/);
  assert.equal(validateGameAnswer(meta('sound'), { audioKey: `${D}/joel/game-audio-1.webm`, audioType: 'audio/webm', caption: 'Kettle' }, D, 'joel'), null);
  assert.equal(validateGameAnswer(meta('emoji'), { emoji: '🦁👑', caption: 'The Lion King' }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('emoji'), { emoji: 'lion 🦁', caption: 'x' }, D, 'joel'), /emoji/);
  assert.equal(validateGameAnswer(meta('tales'), { facts: ['a', 'b', 'c'], caption: 1 }, D, 'joel'), null);
  assert.match(validateGameAnswer(meta('tales'), { facts: ['a', 'b'], caption: 1 }, D, 'joel'), /facts/);
  assert.match(validateGameAnswer(meta('tales'), { facts: ['a', 'b', 'c'], caption: 3 }, D, 'joel'), /caption/);
});

test('gameAnswerRecord keeps only the fields of the type', () => {
  const record = gameAnswerRecord('wrong', { text: ' A hat ', sneaky: 1 }, new Date(at));
  assert.deepEqual(record, { text: 'A hat', updatedAt: at });
});

test('validateGuess and validateRuling', () => {
  assert.equal(validateGuess('closeup', { guess: 'A sock' }), null);
  assert.match(validateGuess('closeup', { guess: '' }), /guess/);
  assert.equal(validateGuess('tales', { guess: 2 }), null);
  assert.match(validateGuess('tales', { guess: 'two' }), /guess/);
  assert.match(validateGuess('mind', { guess: 1 }), /guess round/);
  assert.equal(validateRuling({ ruling: 'close' }), null);
  assert.match(validateRuling({ ruling: 'maybe' }), /ruling/);
});

test('gameStage walks single- and two-stage games', () => {
  const a = { joel: { text: 'x' } };
  const both = { joel: { text: 'x' }, nancy: { text: 'y' } };
  assert.equal(gameStage('wrong', {}, OPEN), 'answer');
  assert.equal(gameStage('wrong', a, OPEN), 'answer');
  assert.equal(gameStage('wrong', both, OPEN), 'done');
  assert.equal(gameStage('wrong', a, CLOSED), 'closed');
  assert.equal(gameStage('wrong', {}, UPCOMING), 'upcoming');
  assert.equal(gameStage('closeup', both, OPEN), 'guess');
  assert.equal(gameStage('closeup', { ...both, guess_joel: v('a') }, OPEN), 'guess');
  const guessed = { ...both, guess_joel: v('a'), guess_nancy: v('b') };
  assert.equal(gameStage('closeup', guessed, OPEN), 'ruling');
  assert.equal(gameStage('closeup', { ...guessed, ruling_joel: v('yes') }, OPEN), 'ruling');
  assert.equal(gameStage('closeup', { ...guessed, ruling_joel: v('yes'), ruling_nancy: v('no') }, OPEN), 'done');
  assert.equal(gameStage('closeup', guessed, CLOSED), 'closed');
  assert.equal(gameStage('tales', { ...both, guess_joel: v(0), guess_nancy: v(2) }, OPEN), 'done');
});

test('scoreGame: mind, wrong, closest, lightning, tabloid', () => {
  assert.deepEqual(scoreGame('mind', { joel: { pick: 1, guess: 0 }, nancy: { pick: 0, guess: 1 } }, {}),
    { points: { joel: 1, nancy: 1 }, des: true });
  assert.deepEqual(scoreGame('mind', { joel: { pick: 1, guess: 1 }, nancy: { pick: 0, guess: 0 } }, {}),
    { points: { joel: 0, nancy: 0 }, des: false });
  const wrong = scoreGame('wrong', { joel: { text: 'hi' }, nancy: { text: 'hello' } }, { rule: 'shortest' });
  assert.equal(wrong.winner, 'joel'); assert.equal(wrong.rule, 'shortest'); assert.ok(wrong.line); assert.equal(wrong.des, false);
  assert.equal(scoreGame('wrong', { joel: { text: 'abc' }, nancy: { text: 'xyz' } }, { rule: 'shortest' }).des, true);
  const closest = (joel, nancy) => scoreGame('closest', { joel: { number: joel }, nancy: { number: nancy } }, { value: 88 });
  assert.deepEqual(closest(80, 70), { value: 88, bust: { joel: false, nancy: false }, winner: 'joel', des: false });
  assert.equal(closest(90, 70).winner, 'nancy');
  assert.equal(closest(90, 100).winner, null);
  assert.equal(closest(88, 88).winner, 'tie');
  assert.equal(closest(88, 88).des, true);
  assert.deepEqual(scoreGame('lightning', { joel: { picks: [0, 1, 1] }, nancy: { picks: [0, 1, 0] } }, {}), { matches: 2, des: false });
  assert.equal(scoreGame('lightning', { joel: { picks: [0, 1, 1] }, nancy: { picks: [0, 1, 1] } }, {}).des, true);
  assert.equal(scoreGame('tabloid', { joel: { text: 'The Moose' }, nancy: { text: 'moose!' } }, {}).des, true);
});

test('scoreGame: two-stage rulings, automatic for tales', () => {
  const closeup = { joel: { caption: 'Sock' }, nancy: { caption: 'Spoon' }, guess_joel: v('spoon'), guess_nancy: v('glove'),
    ruling_joel: v('no'), ruling_nancy: v('yes') };
  // ruling_nancy is Nancy's ruling on Joel's guess about her item
  assert.deepEqual(scoreGame('closeup', closeup, {}), { rulings: { joel: 'yes', nancy: 'no' }, des: false });
  const tales = { joel: { facts: ['a', 'b', 'c'], caption: 2 }, nancy: { facts: ['d', 'e', 'f'], caption: 0 }, guess_joel: v(0), guess_nancy: v(2) };
  assert.deepEqual(scoreGame('tales', tales, {}), { rulings: { joel: 'yes', nancy: 'yes' }, des: true });
});

test('shapeGame never leaks the other answer, captions or secrets early', () => {
  const meta = { type: 'closeup' };
  const item = { joel: { photoKey: 'p1', caption: 'Sock' } };
  let shape = shapeGame(meta, item, 'nancy', OPEN, D);
  assert.equal(shape.stage, 'answer');
  assert.equal(shape.them.answered, true);
  assert.equal(shape.them.answer, undefined);
  item.nancy = { photoKey: 'p2', caption: 'Spoon' };
  shape = shapeGame(meta, item, 'nancy', OPEN, D);
  assert.equal(shape.stage, 'guess');
  assert.equal(shape.them.answer.photoKey, 'p1');
  assert.equal(shape.them.answer.caption, undefined, 'caption sealed during guessing');
  assert.equal(shape.me.answer.caption, 'Spoon', 'own caption visible');
  item.guess_joel = v('spoon');
  shape = shapeGame(meta, item, 'nancy', OPEN, D);
  assert.equal(shape.them.guessed, true);
  assert.equal(shape.them.guess, undefined, 'their guess sealed until both guess');
  item.guess_nancy = v('glove');
  shape = shapeGame(meta, item, 'nancy', OPEN, D);
  assert.equal(shape.stage, 'ruling');
  assert.equal(shape.them.answer.caption, 'Sock');
  assert.equal(shape.them.guess, 'spoon');
  assert.equal(shape.result, undefined);

  const wrongMeta = { type: 'wrong', secret: { rule: 'shortest' } };
  const wrongItem = { joel: { text: 'hi' } };
  const sealed = shapeGame(wrongMeta, wrongItem, 'joel', OPEN, D);
  assert.equal(JSON.stringify(sealed).includes('shortest'), false, 'rule hidden before reveal');
  wrongItem.nancy = { text: 'hello' };
  const revealed = shapeGame(wrongMeta, wrongItem, 'joel', OPEN, D);
  assert.equal(revealed.result.rule, 'shortest');
  assert.equal(revealed.them.answer.text, 'hello');

  const closestMeta = { type: 'closest', secret: { value: 88 } };
  assert.equal(JSON.stringify(shapeGame(closestMeta, { joel: { number: 5 } }, 'joel', OPEN, D)).includes('88'), false);
  const closedOne = shapeGame(closestMeta, { joel: { number: 5 } }, 'joel', CLOSED, D);
  assert.equal(closedOne.stage, 'closed');
  assert.equal(closedOne.result, undefined, 'no result without both answers');
});
