import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPush, validateSubscription } from '../src/push.mjs';

const VAPID = { publicKey: 'BPUBLIC', privateKey: 'private', subject: 'https://joelmgallant.com/fire-and-mountain/' };
const sub = (n) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: `p256dh-${n}`, auth: `auth${n}` } });
const NUDGE = { kind: 'exchange-answered', title: 'T', body: 'B', url: './#exchange' };

function fakeStore() {
  const items = new Map();
  return {
    items,
    async get(key) { return items.get(key) ?? null; },
    async setField(key, field, value, { ifAbsent = false } = {}) {
      const item = items.get(key) ?? { date: key };
      if (ifAbsent && item[field] !== undefined) return null;
      const next = { ...item, [field]: value };
      items.set(key, next);
      return next;
    },
  };
}

function setup({ vapid = VAPID, failWith = {} } = {}) {
  const store = fakeStore();
  const sent = [];
  const send = async (subscription, payload, options) => {
    sent.push({ subscription, payload: JSON.parse(payload), options });
    const statusCode = failWith[subscription.endpoint];
    if (statusCode) throw Object.assign(new Error('push failed'), { statusCode });
    return { statusCode: 201 };
  };
  const push = createPush({ store, vapid, send, now: () => new Date('2026-11-20T15:00:00Z'), log: { warn() {} } });
  return { store, sent, push };
}

test('validateSubscription accepts a browser subscription and rejects junk', () => {
  assert.equal(validateSubscription(sub(1)), null);
  assert.ok(validateSubscription(null));
  assert.ok(validateSubscription({ ...sub(1), endpoint: 'http://push.example/1' }));
  assert.ok(validateSubscription({ ...sub(1), endpoint: `https://x/${'a'.repeat(1000)}` }));
  assert.ok(validateSubscription({ endpoint: sub(1).endpoint, keys: { p256dh: 'has spaces', auth: 'a' } }));
});

test('subscribing stores the subscription once per endpoint and keeps the newest five', async () => {
  const { store, push } = setup();
  await push.subscribe('nancy', sub(1));
  await push.subscribe('nancy', sub(1));
  assert.equal(store.items.get('push#nancy').subs.length, 1);
  for (let n = 2; n <= 7; n += 1) await push.subscribe('nancy', sub(n));
  const endpoints = store.items.get('push#nancy').subs.map((saved) => saved.endpoint);
  assert.deepEqual(endpoints, [3, 4, 5, 6, 7].map((n) => sub(n).endpoint));
});

test('unsubscribing removes only that endpoint', async () => {
  const { store, push } = setup();
  await push.subscribe('joel', sub(1));
  await push.subscribe('joel', sub(2));
  await push.unsubscribe('joel', sub(1).endpoint);
  assert.deepEqual(store.items.get('push#joel').subs.map((saved) => saved.endpoint), [sub(2).endpoint]);
});

test('notify sends the nudge to every subscription of that person, signed with the VAPID keys', async () => {
  const { sent, push } = setup();
  await push.subscribe('nancy', sub(1));
  await push.subscribe('nancy', sub(2));
  await push.subscribe('joel', sub(3));
  await push.notify('nancy', '2026-11-20', NUDGE);
  assert.deepEqual(sent.map((one) => one.subscription.endpoint), [sub(1).endpoint, sub(2).endpoint]);
  assert.deepEqual(sent[0].payload, { title: 'T', body: 'B', url: './#exchange', tag: '2026-11-20-exchange-answered' });
  assert.deepEqual(sent[0].options.vapidDetails, VAPID);
  assert.ok(sent[0].options.TTL > 0);
});

test('the same nudge is sent at most once per day and person', async () => {
  const { sent, push } = setup();
  await push.subscribe('nancy', sub(1));
  await push.notify('nancy', '2026-11-20', NUDGE);
  await push.notify('nancy', '2026-11-20', NUDGE);
  await push.notify('nancy', '2026-11-21', NUDGE);
  assert.equal(sent.length, 2);
});

test('subscriptions the push service says are gone get pruned; other failures are swallowed', async () => {
  const { store, push } = setup({ failWith: { [sub(1).endpoint]: 410, [sub(2).endpoint]: 500 } });
  await push.subscribe('nancy', sub(1));
  await push.subscribe('nancy', sub(2));
  await push.subscribe('nancy', sub(3));
  await push.notify('nancy', '2026-11-20', NUDGE);
  assert.deepEqual(store.items.get('push#nancy').subs.map((saved) => saved.endpoint), [sub(2).endpoint, sub(3).endpoint]);
});

test('without VAPID keys, push is a quiet no-op', async () => {
  const { sent, store, push } = setup({ vapid: null });
  assert.equal(push.publicKey, null);
  await push.subscribe('nancy', sub(1));
  await push.notify('nancy', '2026-11-20', NUDGE);
  assert.equal(sent.length, 0);
  assert.equal(store.items.has('pushlog#2026-11-20'), false);
});

test('a null nudge sends nothing', async () => {
  const { sent, push } = setup();
  await push.subscribe('nancy', sub(1));
  await push.notify('nancy', '2026-11-20', null);
  assert.equal(sent.length, 0);
});

test('real web-push encryption: the browser-side keys decrypt the exact nudge, with a VAPID header for our key', async () => {
  const { createECDH, randomBytes } = await import('node:crypto');
  const webpush = (await import('web-push')).default;
  const ece = (await import('http_ece')).default;
  const browserKeys = createECDH('prime256v1');
  browserKeys.generateKeys();
  const authSecret = randomBytes(16);
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: browserKeys.getPublicKey('base64url'), auth: authSecret.toString('base64url') } };
  const realVapid = { ...webpush.generateVAPIDKeys(), subject: VAPID.subject };
  const requests = [];
  const store = fakeStore();
  const push = createPush({ store, vapid: realVapid, send: async (sub, payload, options) => { requests.push(webpush.generateRequestDetails(sub, payload, options)); } });
  await push.subscribe('nancy', subscription);
  await push.notify('nancy', '2026-11-20', NUDGE);

  const [request] = requests;
  assert.equal(request.endpoint, subscription.endpoint);
  assert.equal(request.headers['Content-Encoding'], 'aes128gcm');
  assert.match(request.headers.Authorization, new RegExp(`^vapid t=.+, k=${realVapid.publicKey}$`));
  const plain = ece.decrypt(request.body, { version: 'aes128gcm', privateKey: browserKeys, authSecret: authSecret.toString('base64url') });
  assert.deepEqual(JSON.parse(plain.toString('utf8')), { title: 'T', body: 'B', url: './#exchange', tag: '2026-11-20-exchange-answered' });
});
