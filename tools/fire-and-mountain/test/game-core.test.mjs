import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_NAMES, isTwoStage, stageSteps, stageIndex, fillHeadline, isEmojiOnly, resultLine, RULING_LABELS }
  from '../../../static/fire-and-mountain/today/game-core.mjs';

test('every game type has a show name', () => {
  for (const type of ['mind', 'wrong', 'closest', 'lightning', 'tabloid', 'closeup', 'sound', 'emoji', 'tales']) assert.ok(GAME_NAMES[type], type);
  assert.equal(isTwoStage('closeup'), true);
  assert.equal(isTwoStage('mind'), false);
});

test('stage steps and the current step', () => {
  assert.deepEqual(stageSteps('wrong'), ['Answer', 'Reveal']);
  assert.deepEqual(stageSteps('closeup'), ['Answer', 'Guess', 'Ruling', 'Reveal']);
  assert.deepEqual(stageSteps('tales'), ['Answer', 'Guess', 'Reveal']);
  assert.equal(stageIndex('closeup', 'ruling'), 2);
  assert.equal(stageIndex('closeup', 'done'), 3);
  assert.equal(stageIndex('wrong', 'answer'), 0);
  assert.equal(stageIndex('tales', 'closed'), 2);
});

test('fillHeadline puts the answer in the blank, in caps', () => {
  assert.equal(fillHeadline('LOCAL MOUNTAIN ___ AT MIDNIGHT', 'glows'), 'LOCAL MOUNTAIN GLOWS AT MIDNIGHT');
  assert.equal(fillHeadline('LOCAL MOUNTAIN ___ AT MIDNIGHT', ''), 'LOCAL MOUNTAIN ___ AT MIDNIGHT');
});

test('isEmojiOnly matches the server rule', () => {
  assert.equal(isEmojiOnly('🦁👑'), true);
  assert.equal(isEmojiOnly('❤️'), true);
  assert.equal(isEmojiOnly('lion 🦁'), false);
  assert.equal(isEmojiOnly('🦁2'), false);
  assert.equal(isEmojiOnly(''), false);
});

test('resultLine speaks to the viewer', () => {
  assert.equal(resultLine('wrong', { winner: 'joel' }, 'joel'), 'You win this one! 🏆');
  assert.equal(resultLine('wrong', { winner: 'joel' }, 'nancy'), 'Joel takes it.');
  assert.equal(resultLine('closest', { winner: 'tie', des: true }, 'joel'), 'Dead heat!');
  assert.equal(resultLine('closest', { winner: null }, 'joel'), 'Both bust! Saturn keeps the prize.');
  assert.equal(resultLine('mind', { points: { joel: 1, nancy: 0 } }, 'nancy'), 'Joel read your mind. You did not read theirs.');
  assert.equal(resultLine('mind', { points: { joel: 1, nancy: 1 } }, 'nancy'), 'You read each other like open books.');
  assert.equal(resultLine('lightning', { matches: 2 }, 'joel'), '2 out of 3 in sync.');
  assert.equal(resultLine('closeup', { rulings: { joel: 'yes', nancy: 'close' } }, 'joel'), 'You nailed it. Nancy got close.');
  assert.equal(resultLine('tabloid', { des: false }, 'joel'), 'Hot off the press.');
  assert.equal(RULING_LABELS.close, '🤏 Close');
});
