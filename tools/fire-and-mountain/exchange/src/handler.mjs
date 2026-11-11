// HTTP routing for the exchange API (Lambda function URL, payload v2).
// Storage and media are injected so the rules can be tested without AWS.
import { randomUUID } from 'node:crypto';
import { createGameRoutes, gameKey } from './game-routes.mjs';
import { fail, parseBody, respond, signShape } from './http.mjs';
import { exchangeNudge } from './nudges.mjs';
import { NO_PUSH, createPushRoutes } from './push.mjs';
import { AUDIO_TYPES, PEOPLE, addDays, answerFromBody, dayStatus, halifaxToday, isRevealed, otherPerson, personForKey,
  shapeExchange, validateAnswer } from './core.mjs';

const UPLOADS = {
  photo: { types: { 'image/jpeg': 'jpg' }, maxBytes: 5 * 1024 * 1024 },
  audio: { types: AUDIO_TYPES, maxBytes: 3 * 1024 * 1024 },
};

export function createHandler({ store, media, hashes, batch, games = {}, push = NO_PUSH, now = () => new Date() }) {
  const game = createGameRoutes({ store, media, games, push, now });
  const pushRoutes = createPushRoutes(push);
  async function getExchange(person, date, status) {
    const item = (await store.get(date)) ?? { date };
    return respond(200, await signShape(shapeExchange(item, person, status), media));
  }

  async function putExchange(person, date, status, event) {
    const body = parseBody(event);
    if (body === null) return fail(400, 'body must be JSON');
    const error = validateAnswer(body, date, person);
    if (error) return fail(400, error);
    const existing = (await store.get(date)) ?? { date };
    if (!status.open || isRevealed(existing, status)) return fail(409, 'this round is closed');
    const item = await store.putAnswer(date, person, answerFromBody(body, now()));
    await push.notify(otherPerson(person), date, exchangeNudge(existing, item, person, date, halifaxToday(now())));
    return respond(200, await signShape(shapeExchange(item, person, status), media));
  }

  async function createUpload(person, date, status, event) {
    const upload = UPLOADS[event.queryStringParameters?.kind];
    if (!upload) return fail(400, 'kind must be photo or audio');
    const body = parseBody(event);
    const extension = upload.types[body?.contentType];
    if (!extension) return fail(400, `contentType must be one of ${Object.keys(upload.types).join(', ')}`);
    const forGame = event.queryStringParameters?.round === 'game';
    const allowed = forGame ? await game.canUpload(date, status) : status.open && !isRevealed((await store.get(date)) ?? { date }, status);
    if (!allowed) return fail(409, 'this round is closed');
    const kind = `${forGame ? 'game-' : ''}${event.queryStringParameters.kind}`;
    const key = `${date}/${person}/${kind}-${randomUUID()}.${extension}`;
    const form = await media.presignPost({ key, contentType: body.contentType, maxBytes: upload.maxBytes });
    return respond(200, { key, ...form });
  }

  async function history(person, today, event) {
    const before = event.queryStringParameters?.before ?? addDays(today, 2);
    const limit = Math.min(Number(event.queryStringParameters?.limit) || 30, 60);
    const items = await store.scan();
    const byKey = new Map(items.map((item) => [item.date, item]));
    const days = [];
    for (const item of items) {
      const status = dayStatus(item.date, today, batch);
      if (!status.valid || item.date >= before || !isRevealed(item, status)) continue;
      days.push({ shape: shapeExchange(item, person, status), status });
    }
    days.sort((first, second) => second.shape.date.localeCompare(first.shape.date));
    return respond(200, { days: await Promise.all(days.slice(0, limit).map(async ({ shape, status }) => ({
      ...(await signShape(shape, media)),
      game: await game.historyView(byKey.get(gameKey(shape.date)), person, status, shape.date),
    }))) });
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method;
    const path = event.rawPath ?? '/';
    const header = event.headers?.authorization ?? '';
    const person = personForKey(header.startsWith('Bearer ') ? header.slice(7) : '', hashes);
    if (!person || !PEOPLE.includes(person)) return fail(401, 'unknown key');

    const today = halifaxToday(now());
    if (method === 'GET' && path === '/whoami') return respond(200, { person });
    if (method === 'GET' && path === '/history') return history(person, today, event);
    const pushRoute = pushRoutes[`${method} ${path}`];
    if (pushRoute) return pushRoute(person, event);

    const date = event.queryStringParameters?.date;
    const status = dayStatus(date, today, batch);
    const routes = {
      'GET /exchange': getExchange, 'PUT /exchange': putExchange, 'POST /upload': createUpload,
      'GET /game': game.getGame, 'PUT /game': game.putGame, 'PUT /game/guess': game.putGuess, 'PUT /game/ruling': game.putRuling,
    };
    const route = routes[`${method} ${path}`];
    if (!route) return fail(404, 'not found');
    if (!status.valid) return fail(400, 'date is outside the reading year');
    return route(person, date, status, event);
  };
}
