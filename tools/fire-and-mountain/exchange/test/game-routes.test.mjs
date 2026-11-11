import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/handler.mjs';
import { hashKey } from '../src/core.mjs';

const HASHES = { joel: hashKey('joel-key'), nancy: hashKey('nancy-key') };
const BATCH = { firstDay: '2026-11-10', lastDay: '2027-11-09' };
const NOW = new Date('2026-11-20T15:00:00Z');
const D = '2026-11-20';
const GAMES = {
  '2026-11-17': { type: 'mind', optionCount: 3 },
  '2026-11-19': { type: 'wrong', secret: { rule: 'shortest' } },
  '2026-11-20': { type: 'closeup' },
  '2026-11-21': { type: 'tales' },
  '2026-11-11': { type: 'closest', secret: { value: 88 } },
};

function fakeStore() {
  const items = new Map();
  return {
    items,
    async get(key) { return items.get(key) ?? null; },
    async putAnswer(key, person, answer) { return this.setField(key, person, answer); },
    async setField(key, field, value, { ifAbsent = false } = {}) {
      const item = items.get(key) ?? { date: key };
      if (ifAbsent && item[field] !== undefined) return null;
      const updated = { ...item, [field]: value };
      items.set(key, updated);
      return updated;
    },
    async scan() { return [...items.values()]; },
  };
}
const fakeMedia = {
  async getUrl(key) { return `https://signed.test/${key}`; },
  async presignPost({ key }) { return { url: 'https://upload.test/', fields: { key } }; },
};

function setup() {
  const store = fakeStore();
  const handler = createHandler({ store, media: fakeMedia, hashes: HASHES, batch: BATCH, games: GAMES, now: () => NOW });
  const call = async (method, path, key, query = {}, body) => {
    const response = await handler({
      requestContext: { http: { method } }, rawPath: path, queryStringParameters: query,
      headers: { authorization: `Bearer ${key}` }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.statusCode, body: JSON.parse(response.body), raw: response.body };
  };
  return { store, call };
}

test('Read My Mind: sealed until both answer, then scored', async () => {
  const { call } = setup();
  const date = '2026-11-17';
  const first = await call('PUT', '/game', 'joel-key', { date }, { pick: 2, guess: 1 });
  assert.equal(first.status, 200);
  assert.equal(first.body.stage, 'answer');
  const peek = await call('GET', '/game', 'nancy-key', { date });
  assert.equal(peek.body.them.answered, true);
  assert.equal(peek.body.them.answer, undefined);
  assert.equal((await call('PUT', '/game', 'nancy-key', { date }, { pick: 9, guess: 2 })).status, 400);
  const done = await call('PUT', '/game', 'nancy-key', { date }, { pick: 1, guess: 2 });
  assert.equal(done.body.stage, 'done');
  assert.deepEqual(done.body.result, { points: { joel: 1, nancy: 1 }, des: true });
  assert.equal((await call('PUT', '/game', 'joel-key', { date }, { pick: 0, guess: 0 })).status, 409);
});

test('Wrong Answers Only keeps Saturn\'s rule secret until the reveal', async () => {
  const { call } = setup();
  const date = '2026-11-19';
  const sealed = await call('PUT', '/game', 'joel-key', { date }, { text: 'A sandwich' });
  assert.equal(sealed.raw.includes('shortest'), false);
  const revealed = await call('PUT', '/game', 'nancy-key', { date }, { text: 'A very long sandwich' });
  assert.equal(revealed.body.result.winner, 'joel');
  assert.equal(revealed.body.result.rule, 'shortest');
});

test('Extreme Close-Up: upload, answer, guess, rule, done', async () => {
  const { call } = setup();
  const upload = await call('POST', '/upload', 'joel-key', { date: D, kind: 'photo', round: 'game' }, { contentType: 'image/jpeg' });
  assert.equal(upload.status, 200);
  assert.match(upload.body.key, /^2026-11-20\/joel\/game-photo-/);
  assert.equal((await call('PUT', '/game/guess', 'joel-key', { date: D }, { guess: 'x' })).status, 409);
  await call('PUT', '/game', 'joel-key', { date: D }, { photoKey: upload.body.key, caption: 'My sock drawer' });
  const nancyKey = `${D}/nancy/game-photo-abc.jpg`;
  const guessing = await call('PUT', '/game', 'nancy-key', { date: D }, { photoKey: nancyKey, caption: 'A spoon' });
  assert.equal(guessing.body.stage, 'guess');
  assert.equal(guessing.body.them.answer.caption, undefined);
  assert.equal(guessing.body.them.answer.photoUrl, `https://signed.test/${upload.body.key}`);
  assert.equal((await call('POST', '/upload', 'joel-key', { date: D, kind: 'photo', round: 'game' }, { contentType: 'image/jpeg' })).status, 409);
  await call('PUT', '/game/guess', 'joel-key', { date: D }, { guess: 'a spoon' });
  const ruling = await call('PUT', '/game/guess', 'nancy-key', { date: D }, { guess: 'socks' });
  assert.equal(ruling.body.stage, 'ruling');
  assert.equal(ruling.body.them.answer.caption, 'My sock drawer');
  assert.equal(ruling.body.them.guess, 'a spoon');
  assert.equal((await call('PUT', '/game/guess', 'nancy-key', { date: D }, { guess: 'changed' })).status, 409);
  assert.equal((await call('PUT', '/game/ruling', 'joel-key', { date: D }, { ruling: 'yes' })).status, 200);
  assert.equal((await call('PUT', '/game/ruling', 'joel-key', { date: D }, { ruling: 'no' })).status, 409);
  const done = await call('PUT', '/game/ruling', 'nancy-key', { date: D }, { ruling: 'yes' });
  assert.equal(done.body.stage, 'done');
  assert.deepEqual(done.body.result, { rulings: { joel: 'yes', nancy: 'yes' }, des: true });
});

test('Two Truths rules itself and refuses manual rulings', async () => {
  const { call } = setup();
  const date = '2026-11-21';
  await call('PUT', '/game', 'joel-key', { date }, { facts: ['a', 'b', 'c'], caption: 1 });
  await call('PUT', '/game', 'nancy-key', { date }, { facts: ['d', 'e', 'f'], caption: 0 });
  await call('PUT', '/game/guess', 'joel-key', { date }, { guess: 0 });
  const done = await call('PUT', '/game/guess', 'nancy-key', { date }, { guess: 2 });
  assert.equal(done.body.stage, 'done');
  assert.deepEqual(done.body.result.rulings, { joel: 'yes', nancy: 'no' });
  assert.equal((await call('PUT', '/game/ruling', 'joel-key', { date }, { ruling: 'yes' })).status, 400);
});

test('closed and unknown days', async () => {
  const { call } = setup();
  const closed = await call('PUT', '/game', 'joel-key', { date: '2026-11-11' }, { number: 3 });
  assert.equal(closed.status, 409);
  const view = await call('GET', '/game', 'joel-key', { date: '2026-11-11' });
  assert.equal(view.body.stage, 'closed');
  assert.equal(view.raw.includes('88'), false);
  assert.equal((await call('GET', '/game', 'joel-key', { date: '2026-11-18' })).status, 404);
});

test('history attaches game results without listing game items as days', async () => {
  const { call } = setup();
  const date = '2026-11-19';
  await call('PUT', '/exchange', 'joel-key', { date }, { text: 'cat' });
  await call('PUT', '/exchange', 'nancy-key', { date }, { text: 'dog' });
  await call('PUT', '/game', 'joel-key', { date }, { text: 'hi' });
  await call('PUT', '/game', 'nancy-key', { date }, { text: 'hello' });
  const { days } = (await call('GET', '/history', 'joel-key')).body;
  assert.deepEqual(days.map((day) => day.date), [date]);
  assert.equal(days[0].game.result.winner, 'joel');
});
