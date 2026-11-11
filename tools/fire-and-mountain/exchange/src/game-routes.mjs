// HTTP routes for the Bonus Round. Each route gets (person, date, status, event) after the handler checks the key and date.
import { gameAnswerRecord, gameStage, shapeGame, validateGameAnswer, validateGuess, validateRuling } from './game.mjs';
import { fail, parseBody, respond, signAnswer } from './http.mjs';
import { halifaxToday, otherPerson } from './core.mjs';
import { gameNudge } from './nudges.mjs';

export const gameKey = (date) => `game#${date}`;

async function signGame(shape, media) {
  const signed = { ...shape, me: { ...shape.me, answer: await signAnswer(shape.me.answer, media) }, them: { ...shape.them } };
  if (shape.them.answer) signed.them.answer = await signAnswer(shape.them.answer, media);
  return signed;
}

export function createGameRoutes({ store, media, games, push, now }) {
  const load = async (date) => (await store.get(gameKey(date))) ?? { date: gameKey(date) };
  const reply = async (meta, item, person, status, date) => respond(200, await signGame(shapeGame(meta, item, person, status, date), media));

  /** Wraps a route: 404 for days without a game, 400 for bad JSON, 409 unless the round is at `stage` and open. */
  const route = (stage, write) => async (person, date, status, event) => {
    const meta = games[date];
    if (!meta) return fail(404, 'no game on this day');
    const item = await load(date);
    if (!write) return reply(meta, item, person, status, date);
    const body = parseBody(event);
    if (body === null) return fail(400, 'body must be JSON');
    if (!status.open || gameStage(meta.type, item, status) !== stage) return fail(409, 'this step of the round is closed');
    const result = await write({ meta, item, person, body, date });
    if (result.error) return fail(result.status ?? 400, result.error);
    await push.notify(otherPerson(person), date, gameNudge(meta.type, item, result.item, person, status, date, halifaxToday(now())));
    return reply(meta, result.item, person, status, date);
  };

  const answer = route('answer', async ({ meta, person, body, date }) => {
    const error = validateGameAnswer(meta, body, date, person);
    if (error) return { error };
    return { item: await store.setField(gameKey(date), person, gameAnswerRecord(meta.type, body, now())) };
  });

  const guess = route('guess', async ({ meta, person, body, date }) => {
    const error = validateGuess(meta.type, body);
    if (error) return { error };
    const value = typeof body.guess === 'string' ? body.guess.trim() : body.guess;
    return { item: await store.setField(gameKey(date), `guess_${person}`, { value, at: now().toISOString() }) };
  });

  const ruling = async (person, date, status, event) => {
    if (games[date]?.type === 'tales') return fail(400, 'Two Truths rules itself');
    return rule(person, date, status, event);
  };
  const rule = route('ruling', async ({ person, body, date }) => {
    const error = validateRuling(body);
    if (error) return { error };
    const item = await store.setField(gameKey(date), `ruling_${person}`, { value: body.ruling, at: now().toISOString() }, { ifAbsent: true });
    return item ? { item } : { error: 'you already ruled', status: 409 };
  });

  /** Whether game media may still be uploaded for this person and day. */
  async function canUpload(date, status) {
    const meta = games[date];
    return Boolean(meta) && status.open && gameStage(meta.type, await load(date), status) === 'answer';
  }

  /** The game view for history, or null when the day has no game round worth showing. */
  async function historyView(item, person, status, date) {
    const meta = games[date];
    if (!meta || !item) return null;
    const shape = shapeGame(meta, item, person, status, date);
    return shape.stage === 'done' || shape.stage === 'closed' ? signGame(shape, media) : null;
  }

  return { getGame: route(null, null), putGame: answer, putGuess: guess, putRuling: ruling, canUpload, historyView };
}
