import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/handler.mjs';
import { hashKey } from '../src/core.mjs';

const HASHES = { joel: hashKey('joel-key'), nancy: hashKey('nancy-key') };
const BATCH = { firstDay: '2026-11-10', lastDay: '2027-11-09' };
const NOW = new Date('2026-11-20T15:00:00Z'); // 11:00 in Halifax on 2026-11-20

function fakeStore() {
  const items = new Map();
  return {
    items,
    async get(date) { return items.get(date) ?? null; },
    async putAnswer(date, person, answer) {
      const item = { ...(items.get(date) ?? { date }), [person]: answer };
      items.set(date, item);
      return item;
    },
    async scan() { return [...items.values()]; },
  };
}

const fakeMedia = {
  async getUrl(key) { return `https://signed.test/${key}`; },
  async presignPost({ key, contentType, maxBytes }) { return { url: 'https://upload.test/', fields: { key, 'Content-Type': contentType, maxBytes: String(maxBytes) } }; },
};

function setup() {
  const store = fakeStore();
  const handler = createHandler({ store, media: fakeMedia, hashes: HASHES, batch: BATCH, now: () => NOW });
  const call = async (method, path, { key, query = {}, body } = {}) => {
    const response = await handler({
      requestContext: { http: { method } }, rawPath: path, queryStringParameters: query,
      headers: key ? { authorization: `Bearer ${key}` } : {}, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.statusCode, body: JSON.parse(response.body), raw: response.body };
  };
  return { store, call };
}

test('requests without a valid key get 401', async () => {
  const { call } = setup();
  assert.equal((await call('GET', '/whoami')).status, 401);
  assert.equal((await call('GET', '/whoami', { key: 'nope' })).status, 401);
});

test('whoami names the person behind the key', async () => {
  const { call } = setup();
  assert.deepEqual((await call('GET', '/whoami', { key: 'nancy-key' })).body, { person: 'nancy' });
});

test('an answer stays sealed from the other person until they answer too', async () => {
  const { call } = setup();
  const posted = await call('PUT', '/exchange', { key: 'nancy-key', query: { date: '2026-11-20' }, body: { text: 'Lighthouse' } });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.me.text, 'Lighthouse');

  const joelView = await call('GET', '/exchange', { key: 'joel-key', query: { date: '2026-11-20' } });
  assert.equal(joelView.status, 200);
  assert.equal(joelView.body.revealed, false);
  assert.deepEqual(joelView.body.them, { answered: true });
  assert.equal(joelView.raw.includes('Lighthouse'), false);
});

test('both answers reveal together, with signed media links and match detection', async () => {
  const { call } = setup();
  const date = '2026-11-20';
  await call('PUT', '/exchange', { key: 'nancy-key', query: { date }, body: { text: 'the lighthouse', photoKey: `${date}/nancy/photo-1.jpg` } });
  const joel = await call('PUT', '/exchange', { key: 'joel-key', query: { date }, body: { text: 'Lighthouse!' } });
  assert.equal(joel.body.revealed, true);
  assert.equal(joel.body.match, true);
  assert.equal(joel.body.them.answer.text, 'the lighthouse');
  assert.equal(joel.body.them.answer.photoUrl, `https://signed.test/${date}/nancy/photo-1.jpg`);
  assert.equal(joel.body.them.answer.photoKey, `${date}/nancy/photo-1.jpg`);
});

test('answers are refused once revealed, on closed days, and too far ahead', async () => {
  const { call } = setup();
  const date = '2026-11-20';
  await call('PUT', '/exchange', { key: 'nancy-key', query: { date }, body: { text: 'a' } });
  await call('PUT', '/exchange', { key: 'joel-key', query: { date }, body: { text: 'b' } });
  assert.equal((await call('PUT', '/exchange', { key: 'joel-key', query: { date }, body: { text: 'c' } })).status, 409);
  assert.equal((await call('PUT', '/exchange', { key: 'joel-key', query: { date: '2026-11-15' }, body: { text: 'late' } })).status, 409);
  assert.equal((await call('PUT', '/exchange', { key: 'joel-key', query: { date: '2026-11-22' }, body: { text: 'early' } })).status, 409);
});

test('an answer can be replaced before the reveal', async () => {
  const { call } = setup();
  const date = '2026-11-19';
  await call('PUT', '/exchange', { key: 'joel-key', query: { date }, body: { text: 'first' } });
  const second = await call('PUT', '/exchange', { key: 'joel-key', query: { date }, body: { text: 'second' } });
  assert.equal(second.status, 200);
  assert.equal(second.body.me.text, 'second');
});

test('invalid answers and dates are rejected with 400', async () => {
  const { call } = setup();
  assert.equal((await call('PUT', '/exchange', { key: 'joel-key', query: { date: '2026-11-20' }, body: {} })).status, 400);
  assert.equal((await call('PUT', '/exchange', { key: 'joel-key', query: { date: '2026-11-20' }, body: { photoKey: '2026-11-20/nancy/photo-x.jpg' } })).status, 400);
  assert.equal((await call('GET', '/exchange', { key: 'joel-key', query: { date: '2030-01-01' } })).status, 400);
  assert.equal((await call('PUT', '/exchange', { key: 'joel-key', query: { date: '2026-11-20' }, body: 'not json' })).status, 400);
});

test('upload returns a presigned form under the caller\'s own folder with a size cap', async () => {
  const { call } = setup();
  const photo = await call('POST', '/upload', { key: 'joel-key', query: { date: '2026-11-20', kind: 'photo' }, body: { contentType: 'image/jpeg' } });
  assert.equal(photo.status, 200);
  assert.match(photo.body.key, /^2026-11-20\/joel\/photo-[0-9a-f-]+\.jpg$/);
  assert.equal(photo.body.fields.maxBytes, String(5 * 1024 * 1024));

  const audio = await call('POST', '/upload', { key: 'nancy-key', query: { date: '2026-11-20', kind: 'audio' }, body: { contentType: 'audio/mp4' } });
  assert.match(audio.body.key, /^2026-11-20\/nancy\/audio-[0-9a-f-]+\.m4a$/);
  assert.equal(audio.body.fields.maxBytes, String(3 * 1024 * 1024));

  assert.equal((await call('POST', '/upload', { key: 'joel-key', query: { date: '2026-11-20', kind: 'photo' }, body: { contentType: 'image/png' } })).status, 400);
  assert.equal((await call('POST', '/upload', { key: 'joel-key', query: { date: '2026-11-20', kind: 'video' }, body: { contentType: 'video/mp4' } })).status, 400);
  assert.equal((await call('POST', '/upload', { key: 'joel-key', query: { date: '2026-11-12', kind: 'photo' }, body: { contentType: 'image/jpeg' } })).status, 409);
});

test('history lists only revealed or closed past days, newest first', async () => {
  const { store, call } = setup();
  store.items.set('2026-11-12', { date: '2026-11-12', nancy: { text: 'lonely but closed' } });
  store.items.set('2026-11-18', { date: '2026-11-18', joel: { text: 'j' }, nancy: { text: 'n' } });
  store.items.set('2026-11-19', { date: '2026-11-19', nancy: { text: 'still sealed' } });
  store.items.set('2026-11-20', { date: '2026-11-20', joel: { text: 'j' }, nancy: { text: 'n' } });
  const history = await call('GET', '/history', { key: 'joel-key', query: { before: '2026-11-20' } });
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.days.map((day) => day.date), ['2026-11-18', '2026-11-12']);
  assert.equal(history.raw.includes('still sealed'), false);
});

test('unknown routes get 404', async () => {
  const { call } = setup();
  assert.equal((await call('GET', '/nope', { key: 'joel-key' })).status, 404);
});
