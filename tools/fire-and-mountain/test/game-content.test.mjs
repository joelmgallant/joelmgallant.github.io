import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleFor, validateGame, validateGamesMonth, gameYearChecks } from '../lib/game-content.mjs';
import { SATURN_RULES, judge } from '../exchange/src/saturn.mjs';

const valid = {
  mind: { type: 'mind', intro: 'Mind reading hour.', question: 'Best soup?', options: ['Chowder', 'Pea'] },
  wrong: { type: 'wrong', intro: 'Get it wrong.', question: 'What is a moose?', secret: { rule: 'shortest' } },
  closest: { type: 'closest', intro: 'Guess low.', question: 'Keys on a piano?', unit: 'keys', secret: { value: 88 }, source: 'Standard piano' },
  lightning: { type: 'lightning', intro: 'Go fast.', pairs: [['Tea', 'Coffee'], ['Owl', 'Lark'], ['Sea', 'Hill']] },
  tabloid: { type: 'tabloid', intro: 'Hold the presses.', headline: 'LOCAL MOUNTAIN ___ AT MIDNIGHT' },
  closeup: { type: 'closeup', intro: 'Zoom in.', prompt: 'Something in your kitchen drawer.' },
  sound: { type: 'sound', intro: 'Mic check.', prompt: 'Do your best kettle.' },
  emoji: { type: 'emoji', intro: 'No words.', prompt: 'A movie.' },
  tales: { type: 'tales', intro: 'Spot the fib.', prompt: 'Three things about your Tuesday.' },
};

test('scheduleFor follows the weekly rhythm with alternating weekends', () => {
  assert.equal(scheduleFor('2026-11-16'), 'lightning'); // Monday
  assert.equal(scheduleFor('2026-11-17'), 'mind');
  assert.equal(scheduleFor('2026-11-18'), 'closeup');
  assert.equal(scheduleFor('2026-11-19'), 'wrong');
  assert.equal(scheduleFor('2026-11-20'), 'sound');
  const saturdays = [scheduleFor('2026-11-21'), scheduleFor('2026-11-28')];
  const sundays = [scheduleFor('2026-11-22'), scheduleFor('2026-11-29')];
  assert.deepEqual([...saturdays].sort(), ['emoji', 'tabloid']);
  assert.deepEqual([...sundays].sort(), ['closest', 'tales']);
});

test('validateGame accepts every well-formed type', () => {
  for (const [type, game] of Object.entries(valid)) assert.deepEqual(validateGame(game, 'd', type), [], type);
});

test('validateGame rejects the wrong type for the day, bad shapes and leaks', () => {
  assert.match(validateGame(valid.mind, 'd', 'wrong').join(), /scheduled/);
  assert.match(validateGame({ ...valid.mind, options: ['Only'] }, 'd', 'mind').join(), /options/);
  assert.match(validateGame({ ...valid.tabloid, headline: 'NO BLANK HERE' }, 'd', 'tabloid').join(), /___/);
  assert.match(validateGame({ ...valid.wrong, secret: { rule: 'loudest' } }, 'd', 'wrong').join(), /rule/);
  assert.match(validateGame({ ...valid.closest, source: '' }, 'd', 'closest').join(), /source/);
  assert.match(validateGame({ ...valid.closest, secret: { value: 'many' } }, 'd', 'closest').join(), /value/);
  assert.match(validateGame({ ...valid.lightning, pairs: [['a', 'b']] }, 'd', 'lightning').join(), /pairs/);
  assert.match(validateGame({ ...valid.sound, secret: { value: 1 } }, 'd', 'sound').join(), /secret/);
  assert.match(validateGame({ ...valid.emoji, intro: 'x'.repeat(141) }, 'd', 'emoji').join(), /intro/);
  assert.match(validateGame({ ...valid.closeup, prompt: 'Photograph your casino chips.' }, 'd', 'closeup').join(), /banned/);
});

test('validateGamesMonth checks exact date coverage', () => {
  const entries = [{ date: '2026-11-17', game: valid.mind }];
  assert.deepEqual(validateGamesMonth(entries, ['2026-11-17']), []);
  assert.match(validateGamesMonth(entries, ['2026-11-17', '2026-11-18']).join(), /missing date 2026-11-18/);
});

test('gameYearChecks flags repeated prompts and lightning pairs', () => {
  const entries = [
    { date: '2026-11-18', game: valid.closeup }, { date: '2026-11-25', game: { ...valid.closeup, prompt: 'something in your KITCHEN drawer!' } },
    { date: '2026-11-16', game: valid.lightning }, { date: '2026-11-23', game: { ...valid.lightning, pairs: [['coffee', 'tea'], ['A', 'B'], ['C', 'D']] } },
  ];
  const errors = gameYearChecks(entries);
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /2026-11-25 repeats/);
  assert.match(errors.join('\n'), /2026-11-23 repeats lightning pair/);
});

test('Saturn rules judge both answers and report ties', () => {
  assert.equal(judge('shortest', 'hi', 'hello'), 'joel');
  assert.equal(judge('longest', 'hi', 'hello'), 'nancy');
  assert.equal(judge('mostVowels', 'aeiou', 'xyz'), 'joel');
  assert.equal(judge('firstAlphabetically', 'banana', 'Apple'), 'nancy');
  assert.equal(judge('lastAlphabetically', 'banana', 'Apple'), 'joel');
  assert.equal(judge('mostWords', 'one two three', 'one'), 'joel');
  assert.equal(judge('fewestWords', 'one two three', 'one'), 'nancy');
  assert.equal(judge('shortest', 'abc', 'xyz'), 'tie');
  assert.equal(judge('firstAlphabetically', 'Same', 'same'), 'tie');
  for (const rule of Object.values(SATURN_RULES)) assert.ok(rule.line.length > 5);
});
