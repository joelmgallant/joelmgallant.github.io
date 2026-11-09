// Content checks for daily readings. Pure functions: entries in, error strings out.
import { STONES, ELEMENTS, EMBLEMS, MOODS } from './vocab.mjs';

const CARD_TOKEN = /\[\[([^\]]+)\]\]/g;
const PEOPLE = ['joel', 'nancy'];

const LIMITS = {
  title: [2, 8], skyStory: [40, 80], reading: [90, 150], mission: [8, 35], omen: [8, 35],
  stoneWhy: [2, 10], elementWhy: [2, 10], together: [30, 60],
};

// Never-list topics. Tarot card tokens are removed before matching, so [[Death]] is allowed.
// "Cancer" is deliberately absent: it is a zodiac sign.
const BANNED = [
  /\b(diagnos\w*|doctor|hospital|illness|sick|disease|surgery|medication|meds|diet|calories|weight loss)\b/i,
  /\b(invest\w*|stocks?|crypto|lottery|gambl\w*|casino|loans?|mortgage)\b/i,
  /\b(die|dies|died|death|dead|funeral|accident|injur\w*|crash\w*)\b/i,
  /\b(exes|boyfriend|girlfriend|husband|wife|divorce|break ?up|jealous\w*|cheat\w*)\b/i,
  /(mi'?km\w*|acadian|past[- ]life|1755|expulsion)/i,
  /(the power is yours|planeteers)/i,
];

export function wordCount(text) {
  return text.replace(CARD_TOKEN, '$1').trim().split(/\s+/).filter(Boolean).length;
}

export function isDesText(text) {
  return /don['’]t even scream/i.test(text) || /\bDES\b/.test(text) || /ΔΕΣ/.test(text);
}

/** Every free-text field of an entry as [path, text] pairs. */
function textFields(entry) {
  const fields = [['title', entry.title], ['skyStory', entry.skyStory], ['together.text', entry.together?.text]];
  for (const person of PEOPLE) {
    const card = entry[person] ?? {};
    (card.reading ?? []).forEach((paragraph, index) => fields.push([`${person}.reading.${index}`, paragraph]));
    for (const key of ['mission', 'omen', 'stoneWhy', 'elementWhy']) fields.push([`${person}.${key}`, card[key]]);
  }
  return fields;
}

function checkLength(errors, path, text, [min, max]) {
  const count = typeof text === 'string' ? wordCount(text) : 0;
  if (count < min || count > max) errors.push(`${path}: ${count} words (allowed ${min}-${max})`);
}

function checkEnum(errors, path, value, allowed) {
  if (!allowed.includes(value)) errors.push(`${path}: "${value}" is not one of ${allowed.join(', ')}`);
}

function checkPerson(errors, person, card = {}) {
  checkEnum(errors, `${person}.emblem`, card.emblem, EMBLEMS[person]);
  checkEnum(errors, `${person}.stone`, card.stone, STONES);
  checkEnum(errors, `${person}.element`, card.element, ELEMENTS);
  if (!Array.isArray(card.reading) || card.reading.length !== 2) {
    errors.push(`${person}.reading: must be exactly 2 paragraphs`);
  } else {
    checkLength(errors, `${person}.reading`, card.reading.join(' '), LIMITS.reading);
  }
  for (const key of ['mission', 'omen', 'stoneWhy', 'elementWhy']) {
    checkLength(errors, `${person}.${key}`, card[key], LIMITS[key]);
  }
}

/** Errors for one entry; cardNames is a Set of valid tarot card names. */
export function validateEntry(entry, cardNames) {
  const errors = [];
  const fields = textFields(entry);
  for (const [path, text] of fields) {
    if (typeof text !== 'string' || !text.trim()) { errors.push(`${path}: missing`); continue; }
    for (const [, card] of text.matchAll(CARD_TOKEN)) {
      if (!cardNames.has(card)) errors.push(`${path}: unknown tarot card "${card}"`);
    }
    const plain = text.replace(CARD_TOKEN, '');
    for (const pattern of BANNED) {
      const match = plain.match(pattern);
      if (match) errors.push(`${path}: banned topic "${match[0]}"`);
    }
  }
  checkLength(errors, 'title', entry.title, LIMITS.title);
  checkLength(errors, 'skyStory', entry.skyStory, LIMITS.skyStory);
  checkLength(errors, 'together.text', entry.together?.text, LIMITS.together);
  checkEnum(errors, 'together.mood', entry.together?.mood, MOODS);
  for (const person of PEOPLE) checkPerson(errors, person, entry[person]);

  const mentionsDes = fields.some(([, text]) => typeof text === 'string' && isDesText(text));
  if (typeof entry.des !== 'boolean') errors.push('des: must be true or false');
  else if (entry.des && !mentionsDes) errors.push('des: flagged true but text never says DES / ΔΕΣ / don\'t even scream');
  else if (!entry.des && mentionsDes) errors.push('des: text says DES but des is false');
  return errors.map((error) => `${entry.date ?? '?'} ${error}`);
}

/** Errors for one month file: exact date coverage plus every entry's own errors. */
export function validateMonth(entries, expectedDates, cardNames) {
  const errors = [];
  const seen = new Map();
  for (const entry of entries) seen.set(entry.date, (seen.get(entry.date) ?? 0) + 1);
  for (const [date, count] of seen) {
    if (count > 1) errors.push(`duplicate date ${date} (${count} entries)`);
    if (!expectedDates.includes(date)) errors.push(`unexpected date ${date}`);
  }
  for (const date of expectedDates) if (!seen.has(date)) errors.push(`missing date ${date}`);
  for (const entry of entries) errors.push(...validateEntry(entry, cardNames));
  return errors;
}

const normalize = (text) => text.replace(CARD_TOKEN, '$1').toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ')
  .split(/\s+/).filter(Boolean);

function openings(entry) {
  const texts = [entry.skyStory, entry.together.text, ...entry.joel.reading, ...entry.nancy.reading];
  return texts.map((text) => normalize(text).slice(0, 8)).filter((first) => first.length === 8).map((first) => first.join(' '));
}

function shingles(text, size = 8) {
  const tokens = normalize(text);
  const result = [];
  for (let index = 0; index + size <= tokens.length; index += 1) result.push(tokens.slice(index, index + size).join(' '));
  return result;
}

/** Cross-year repetition and DES-frequency checks. Later date of each repeat is flagged for rewrite. */
export function yearChecks(entries, { desMin = 40, desMax = 70 } = {}) {
  const errors = [];
  const flagged = new Set();
  const sorted = [...entries].sort((first, second) => first.date.localeCompare(second.date));
  const openingSeen = new Map();
  const phraseSeen = new Map();
  for (const entry of sorted) {
    for (const opening of openings(entry)) {
      const earlier = openingSeen.get(opening);
      if (earlier && earlier !== entry.date) { errors.push(`${entry.date} repeats opening "${opening}" from ${earlier}`); flagged.add(entry.date); }
      else openingSeen.set(opening, entry.date);
    }
    const phrases = new Set(['joel', 'nancy'].flatMap((person) =>
      [entry[person].mission, entry[person].omen].flatMap((text) => shingles(text))));
    for (const phrase of phrases) {
      const earlier = phraseSeen.get(phrase);
      if (earlier && earlier !== entry.date) { errors.push(`${entry.date} repeats mission/omen phrase "${phrase}" from ${earlier}`); flagged.add(entry.date); }
      else phraseSeen.set(phrase, entry.date);
    }
  }
  const desDays = entries.filter((entry) => entry.des === true).length;
  if (desDays < desMin || desDays > desMax) errors.push(`${desDays} DES days (allowed ${desMin}-${desMax})`);
  return { errors, flaggedDates: [...flagged].sort() };
}
