// Pure rules for the exchange API: identity, day window, reveal, matching, validation, response shape.
import { createHash, timingSafeEqual } from 'node:crypto';

export const PEOPLE = ['joel', 'nancy'];
export const AUDIO_TYPES = { 'audio/webm': 'webm', 'audio/mp4': 'm4a' };
const MAX_TEXT = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function hashKey(key) {
  return createHash('sha256').update(key).digest('hex');
}

/** Which person a key belongs to, comparing SHA-256 hashes in constant time. */
export function personForKey(key, hashes) {
  if (typeof key !== 'string' || !key) return null;
  const candidate = Buffer.from(hashKey(key), 'hex');
  for (const person of PEOPLE) {
    const expected = Buffer.from(hashes[person] ?? '', 'hex');
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return person;
  }
  return null;
}

export const otherPerson = (person) => (person === 'joel' ? 'nancy' : 'joel');

const halifaxDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Halifax', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Today's date in Halifax as YYYY-MM-DD. */
export function halifaxToday(now) {
  return halifaxDate.format(now);
}

export function addDays(isoDate, days) {
  const time = Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

/** Whether a date is in the batch, open for answers (today-4 .. today+1), or closed (older). */
export function dayStatus(date, today, { firstDay, lastDay }) {
  const valid = ISO_DATE.test(date ?? '') && !Number.isNaN(Date.parse(date)) && date >= firstDay && date <= lastDay;
  if (!valid) return { valid: false, open: false, closed: false };
  const closed = date < addDays(today, -4);
  const open = !closed && date <= addDays(today, 1);
  return { valid, open, closed };
}

export function normalizeAnswerText(text) {
  return String(text).toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim().split(/\s+/).filter(Boolean).join(' ').replace(/^(a|an|the) /, '');
}

export function isMatch(item) {
  const [first, second] = PEOPLE.map((person) => item[person]?.text);
  if (!first || !second) return false;
  const normalized = normalizeAnswerText(first);
  return normalized.length > 0 && normalized === normalizeAnswerText(second);
}

/** Error message for an answer body, or null when it is acceptable. */
export function validateAnswer(body, date, person) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text && !body?.photoKey && !body?.audioKey) return 'answer is empty';
  if (text.length > MAX_TEXT) return `text is longer than ${MAX_TEXT} characters`;
  const prefix = `${date}/${person}/`;
  if (body.photoKey && !String(body.photoKey).startsWith(`${prefix}photo-`)) return 'photoKey does not belong to you for this date';
  if (body.audioKey) {
    if (!String(body.audioKey).startsWith(`${prefix}audio-`)) return 'audioKey does not belong to you for this date';
    if (!AUDIO_TYPES[body.audioType]) return 'audioType must be audio/webm or audio/mp4';
  }
  return null;
}

/** The answer record to store from a validated body. */
export function answerFromBody(body, now) {
  const answer = { updatedAt: now.toISOString() };
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text) answer.text = text;
  if (body.photoKey) answer.photoKey = body.photoKey;
  if (body.audioKey) { answer.audioKey = body.audioKey; answer.audioType = body.audioType; }
  return answer;
}

export function isRevealed(item, status) {
  return status.closed || PEOPLE.every((person) => Boolean(item?.[person]));
}

/** Response for one person. The other answer is included only once revealed. */
export function shapeExchange(item, person, status) {
  const revealed = isRevealed(item, status);
  const theirs = item?.[otherPerson(person)];
  const them = { answered: Boolean(theirs) };
  if (revealed && theirs) them.answer = theirs;
  return {
    date: item?.date,
    open: status.open && !revealed,
    revealed,
    match: revealed && isMatch(item ?? {}),
    me: item?.[person] ?? null,
    them,
  };
}
