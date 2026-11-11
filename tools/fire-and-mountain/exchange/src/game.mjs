// Pure rules for the Bonus Round: answer validation, stages, scoring and the per-person response shape.
import { AUDIO_TYPES, PEOPLE, normalizeAnswerText, otherPerson } from './core.mjs';
import { SATURN_RULES, judge } from './saturn.mjs';

export const TWO_STAGE = new Set(['closeup', 'sound', 'emoji', 'tales']);
const RULINGS = ['yes', 'close', 'no'];
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const isIndex = (value, count) => Number.isInteger(value) && value >= 0 && value < count;
const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const textError = (value, max, name) => (isText(value, max) ? null : `${name} must be 1-${max} characters`);

function keyError(key, prefix, name) {
  return typeof key === 'string' && key.startsWith(prefix) ? null : `${name} does not belong to you for this date`;
}

const ANSWER_CHECKS = {
  mind: (body, meta) => (!isIndex(body.pick, meta.optionCount) ? 'pick must be one of the options'
    : !isIndex(body.guess, meta.optionCount) ? 'guess must be one of the options' : null),
  wrong: (body) => (body.text?.trim() ? textError(body.text, 120, 'text') : 'answer is empty'),
  closest: (body) => (Number.isFinite(body.number) ? null : 'number must be a number'),
  lightning: (body) => (Array.isArray(body.picks) && body.picks.length === 3 && body.picks.every((pick) => pick === 0 || pick === 1)
    ? null : 'picks must be three 0/1 choices'),
  tabloid: (body) => (body.text?.trim() ? textError(body.text, 60, 'text') : 'answer is empty'),
  closeup: (body, meta, prefix) => keyError(body.photoKey, `${prefix}game-photo-`, 'photoKey') ?? textError(body.caption, 80, 'caption'),
  sound: (body, meta, prefix) => keyError(body.audioKey, `${prefix}game-audio-`, 'audioKey')
    ?? (AUDIO_TYPES[body.audioType] ? null : 'audioType must be audio/webm or audio/mp4') ?? textError(body.caption, 80, 'caption'),
  emoji: (body) => {
    const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : '';
    const count = [...graphemes.segment(emoji)].length;
    if (!emoji || count > 16 || /[\p{L}\p{N}]/u.test(emoji.replace(/️|⃣/g, ''))) return 'emoji must be 1-16 emoji with no letters or digits';
    return textError(body.caption, 80, 'caption');
  },
  tales: (body) => (!Array.isArray(body.facts) || body.facts.length !== 3 || !body.facts.every((fact) => isText(fact, 100))
    ? 'facts must be three 1-100 character facts' : isIndex(body.caption, 3) ? null : 'caption must say which fact (0-2) is the tale'),
};

/** Error message for a game answer, or null. meta = { type, optionCount? } from games.json. */
export function validateGameAnswer(meta, body, date, person) {
  return ANSWER_CHECKS[meta.type](body ?? {}, meta, `${date}/${person}/`);
}

const trim = (text) => text.trim();
const RECORDS = {
  mind: ({ pick, guess }) => ({ pick, guess }),
  wrong: ({ text }) => ({ text: trim(text) }),
  closest: ({ number }) => ({ number }),
  lightning: ({ picks }) => ({ picks }),
  tabloid: ({ text }) => ({ text: trim(text) }),
  closeup: ({ photoKey, caption }) => ({ photoKey, caption: trim(caption) }),
  sound: ({ audioKey, audioType, caption }) => ({ audioKey, audioType, caption: trim(caption) }),
  emoji: ({ emoji, caption }) => ({ emoji: trim(emoji), caption: trim(caption) }),
  tales: ({ facts, caption }) => ({ facts: facts.map(trim), caption }),
};

/** The answer to store: only the fields of the type, plus a timestamp. */
export function gameAnswerRecord(type, body, now) {
  return { ...RECORDS[type](body), updatedAt: now.toISOString() };
}

export function validateGuess(type, body) {
  if (!TWO_STAGE.has(type)) return 'this game has no guess round';
  if (type === 'tales') return isIndex(body?.guess, 3) ? null : 'guess must be 0, 1 or 2';
  return isText(body?.guess, 80) ? null : 'guess must be 1-80 characters';
}

export function validateRuling(body) {
  return RULINGS.includes(body?.ruling) ? null : `ruling must be one of ${RULINGS.join(', ')}`;
}

const has = (item, field) => item?.[field] !== undefined && item[field] !== null;
const bothHave = (item, prefix = '') => PEOPLE.every((person) => has(item, `${prefix}${person}`));

/** answer | guess | ruling | done, or closed when the window shut before the round finished. */
export function gameStage(type, item, status) {
  let stage = 'done';
  if (!bothHave(item)) stage = 'answer';
  else if (TWO_STAGE.has(type) && !bothHave(item, 'guess_')) stage = 'guess';
  else if (TWO_STAGE.has(type) && type !== 'tales' && !bothHave(item, 'ruling_')) stage = 'ruling';
  return stage !== 'done' && !status.open ? 'closed' : stage;
}

function closestResult(item, value) {
  const bust = Object.fromEntries(PEOPLE.map((person) => [person, item[person].number > value]));
  const gap = (person) => value - item[person].number;
  let winner = null;
  if (!bust.joel && !bust.nancy) winner = gap('joel') === gap('nancy') ? 'tie' : gap('joel') < gap('nancy') ? 'joel' : 'nancy';
  else if (bust.joel !== bust.nancy) winner = bust.joel ? 'nancy' : 'joel';
  return { value, bust, winner, des: item.joel.number === item.nancy.number };
}

function rulingFor(type, item, person) {
  const other = otherPerson(person);
  if (type !== 'tales') return item[`ruling_${other}`]?.value ?? null;
  const guess = item[`guess_${person}`];
  return guess ? (guess.value === item[other].caption ? 'yes' : 'no') : null;
}

/** The result once both answers exist. Uses the secret, so only call it when the result may be shown. */
export function scoreGame(type, item, secret = {}) {
  const { joel, nancy } = item;
  if (type === 'mind') {
    const points = { joel: Number(joel.guess === nancy.pick), nancy: Number(nancy.guess === joel.pick) };
    return { points, des: points.joel + points.nancy === 2 };
  }
  if (type === 'wrong') {
    const winner = judge(secret.rule, joel.text, nancy.text);
    return { rule: secret.rule, line: SATURN_RULES[secret.rule].line, winner, des: winner === 'tie' };
  }
  if (type === 'closest') return closestResult(item, secret.value);
  if (type === 'lightning') {
    const matches = joel.picks.filter((pick, index) => pick === nancy.picks[index]).length;
    return { matches, des: matches === 3 };
  }
  if (type === 'tabloid') return { des: normalizeAnswerText(joel.text) === normalizeAnswerText(nancy.text) };
  const rulings = Object.fromEntries(PEOPLE.map((person) => [person, rulingFor(type, item, person)]));
  return { rulings, des: rulings.joel === 'yes' && rulings.nancy === 'yes' };
}

const withoutCaption = ({ caption, ...rest }) => rest;

/** One person's view. Hides the other's answer, captions, guesses and the secret until each may be seen. */
export function shapeGame(meta, item, person, status, date) {
  const { type } = meta;
  const other = otherPerson(person);
  const stage = gameStage(type, item ?? {}, status);
  const bothAnswered = bothHave(item);
  const bothGuessed = bothHave(item, 'guess_');
  const theirs = item?.[other];
  const shape = {
    date, type, stage, open: status.open,
    me: { answer: item?.[person] ?? null, guess: item?.[`guess_${person}`]?.value ?? null, ruling: item?.[`ruling_${person}`]?.value ?? null },
    them: { answered: Boolean(theirs), guessed: has(item, `guess_${other}`), ruled: has(item, `ruling_${other}`) },
  };
  if (theirs && (bothAnswered || status.closed)) {
    shape.them.answer = TWO_STAGE.has(type) && !bothGuessed && !status.closed ? withoutCaption(theirs) : theirs;
  }
  if (has(item, `guess_${other}`) && (bothGuessed || status.closed)) shape.them.guess = item[`guess_${other}`].value;
  if (has(item, `ruling_${other}`)) shape.them.ruling = item[`ruling_${other}`].value;
  if (bothAnswered && (!TWO_STAGE.has(type) || stage === 'done' || stage === 'closed')) shape.result = scoreGame(type, item, meta.secret);
  return shape;
}
