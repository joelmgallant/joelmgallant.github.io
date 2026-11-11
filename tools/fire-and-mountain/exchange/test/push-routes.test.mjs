import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/handler.mjs';
import { createPush } from '../src/push.mjs';
import { hashKey } from '../src/core.mjs';

const HASHES = { joel: hashKey('joel-key'), nancy: hashKey('nancy-key') };
const BATCH = { firstDay: '2026-11-10', lastDay: '2027-11-09' };
const NOW = new Date('2026-11-20T15:00:00Z');
const D = '2026-11-20';
const VAPID = { publicKey: 'BPUBLIC', privateKey: 'private', subject: 'https://joelmgallant.com/fire-and-mountain/' };
const SUB = (who) => ({ endpoint: `https://push.example/${who}`, keys: { p256dh: 'p256dh', auth: 'auth' } });

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

function setup() {
  const store = fakeStore();
  const sent = [];
  const push = createPush({ store, vapid: VAPID, now: () => NOW, send: async (subscription, payload) => { sent.push({ to: subscription.endpoint, ...JSON.parse(payload) }); } });
  const handler = createHandler({ store, media: { getUrl: async () => 'u' }, hashes: HASHES, batch: BATCH, games: { [D]: { type: 'wrong', secret: { rule: 'shortest' } } }, push, now: () => NOW });
  const call = async (method, path, key, { query = {}, body } = {}) => {
    const response = await handler({ requestContext: { http: { method } }, rawPath: path, queryStringParameters: query,
      headers: { authorization: `Bearer ${key}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.statusCode, body: JSON.parse(response.body) };
  };
  return { store, sent, call };
}

test('GET /push hands out the public key', async () => {
  const { call } = setup();
  assert.deepEqual((await call('GET', '/push', 'nancy-key')).body, { publicKey: 'BPUBLIC' });
  assert.equal((await call('GET', '/push', 'stranger')).status, 401);
});

test('PUT /push saves a valid subscription and rejects junk; PUT /push/off removes it', async () => {
  const { store, call } = setup();
  assert.equal((await call('PUT', '/push', 'nancy-key', { body: { subscription: { endpoint: 'http://x' } } })).status, 400);
  assert.equal((await call('PUT', '/push', 'nancy-key', { body: { subscription: SUB('nancy') } })).status, 200);
  assert.equal(store.items.get('push#nancy').subs.length, 1);
  assert.equal((await call('PUT', '/push/off', 'nancy-key', { body: { endpoint: SUB('nancy').endpoint } })).status, 200);
  assert.equal(store.items.get('push#nancy').subs.length, 0);
});

test('an Exchange answer nudges the other person only', async () => {
  const { sent, call } = setup();
  await call('PUT', '/push', 'joel-key', { body: { subscription: SUB('joel') } });
  await call('PUT', '/push', 'nancy-key', { body: { subscription: SUB('nancy') } });
  await call('PUT', '/exchange', 'nancy-key', { query: { date: D }, body: { text: 'Lighthouse' } });
  assert.deepEqual(sent.map((one) => [one.to, one.tag]), [[SUB('joel').endpoint, `${D}-exchange-answered`]]);
  await call('PUT', '/exchange', 'nancy-key', { query: { date: D }, body: { text: 'Harbour' } });
  assert.equal(sent.length, 1, 'an edit sends nothing');
  await call('PUT', '/exchange', 'joel-key', { query: { date: D }, body: { text: 'Tide' } });
  assert.deepEqual(sent.at(-1).to, SUB('nancy').endpoint);
  assert.equal(sent.at(-1).tag, `${D}-exchange-revealed`);
});

test('a Bonus Round answer nudges the other person, and failed writes send nothing', async () => {
  const { sent, call } = setup();
  await call('PUT', '/push', 'nancy-key', { body: { subscription: SUB('nancy') } });
  assert.equal((await call('PUT', '/game', 'joel-key', { query: { date: D }, body: { text: '' } })).status, 400);
  assert.equal(sent.length, 0);
  assert.equal((await call('PUT', '/game', 'joel-key', { query: { date: D }, body: { text: 'a cat' } })).status, 200);
  assert.deepEqual(sent.map((one) => one.tag), [`${D}-game-answered`]);
  assert.match(sent[0].body, /Joel/);
  assert.doesNotMatch(sent[0].body, /cat/);
});
