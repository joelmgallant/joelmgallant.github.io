// Web Push for the exchange: per-person subscriptions in DynamoDB (item push#<person>) and nudge delivery.
// `send` is web-push's sendNotification, injected so this can be tested without the network.
// Each (date, person, kind) is sent at most once, recorded in item pushlog#<date>.
import { fail, parseBody, respond } from './http.mjs';

const MAX_SUBSCRIPTIONS = 5;
const TTL_SECONDS = 12 * 60 * 60;
const SEND_TIMEOUT_MS = 3000;
const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

const subsKey = (person) => `push#${person}`;

export function validateSubscription(subscription) {
  const { endpoint, keys } = subscription ?? {};
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !endpoint.startsWith('https://')) return 'endpoint must be an https URL';
  try { new URL(endpoint); } catch { return 'endpoint must be an https URL'; }
  const keyOk = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200 && BASE64URL.test(value);
  return keyOk(keys?.p256dh) && keyOk(keys?.auth) ? null : 'keys must hold base64url p256dh and auth';
}

export function createPush({ store, vapid, send, now = () => new Date(), log = console }) {
  const enabled = Boolean(vapid?.publicKey && vapid?.privateKey && vapid?.subject);
  const list = async (person) => (await store.get(subsKey(person)))?.subs ?? [];
  const save = (person, subs) => store.setField(subsKey(person), 'subs', subs);

  async function subscribe(person, subscription) {
    const { endpoint, keys } = subscription;
    const others = (await list(person)).filter((saved) => saved.endpoint !== endpoint);
    await save(person, [...others, { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, addedAt: now().toISOString() }].slice(-MAX_SUBSCRIPTIONS));
  }

  async function unsubscribe(person, endpoint) {
    const subs = await list(person);
    const kept = subs.filter((saved) => saved.endpoint !== endpoint);
    if (kept.length !== subs.length) await save(person, kept);
  }

  /** Sends `nudge` to every device of `person`, once per day and kind. Never throws. */
  async function notify(person, date, nudge) {
    if (!enabled || !nudge) return;
    try {
      const first = await store.setField(`pushlog#${date}`, `${person}_${nudge.kind}`, now().toISOString(), { ifAbsent: true });
      if (!first) return;
      const subs = await list(person);
      const payload = JSON.stringify({ title: nudge.title, body: nudge.body, url: nudge.url, tag: `${date}-${nudge.kind}` });
      const options = { vapidDetails: vapid, TTL: TTL_SECONDS, timeout: SEND_TIMEOUT_MS };
      const gone = [];
      await Promise.all(subs.map(async (saved) => {
        try { await send(saved, payload, options); } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) gone.push(saved.endpoint);
          else log.warn('push send failed', error.statusCode ?? error.message);
        }
      }));
      if (gone.length) await save(person, subs.filter((saved) => !gone.includes(saved.endpoint)));
    } catch (error) {
      log.warn('push notify failed', error.message);
    }
  }

  return { publicKey: enabled ? vapid.publicKey : null, subscribe, unsubscribe, notify };
}

export const NO_PUSH = { publicKey: null, subscribe: async () => {}, unsubscribe: async () => {}, notify: async () => {} };

/** Routes for managing subscriptions; they need a key but no date. `push` defaults to a no-op. */
export function createPushRoutes(push = NO_PUSH) {
  return {
    'GET /push': async () => respond(200, { publicKey: push.publicKey }),
    'PUT /push': async (person, event) => {
      const subscription = parseBody(event)?.subscription;
      const error = validateSubscription(subscription);
      if (error) return fail(400, error);
      await push.subscribe(person, subscription);
      return respond(200, { subscribed: true });
    },
    'PUT /push/off': async (person, event) => {
      const endpoint = parseBody(event)?.endpoint;
      if (typeof endpoint !== 'string') return fail(400, 'endpoint is required');
      await push.unsubscribe(person, endpoint);
      return respond(200, { subscribed: false });
    },
  };
}
