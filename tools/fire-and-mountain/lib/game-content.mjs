// Content checks for Bonus Round games (games/YYYY-MM.json). Pure functions: entries in, error strings out.
import { SATURN_RULES } from '../exchange/src/saturn.mjs';
import { BANNED } from './validate.mjs';

export const GAME_TYPES = ['mind', 'wrong', 'closest', 'lightning', 'tabloid', 'closeup', 'sound', 'emoji', 'tales'];
const WEEKDAY_TYPES = { 1: ['lightning'], 2: ['mind'], 3: ['closeup'], 4: ['wrong'], 5: ['sound'], 6: ['tabloid', 'emoji'], 0: ['closest', 'tales'] };
const MONDAY_EPOCH = Date.UTC(1970, 0, 5);
const DAY_MS = 86_400_000;

/** The game type scheduled for an ISO date: fixed by weekday, weekends alternate by week. */
export function scheduleFor(isoDate) {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  const options = WEEKDAY_TYPES[new Date(time).getUTCDay()];
  const week = Math.floor((time - MONDAY_EPOCH) / DAY_MS / 7);
  return options[week % options.length];
}

const PUBLIC_TEXT = { question: 160, prompt: 140, headline: 90, unit: 30 };
const FIELDS = {
  mind: ['question', 'options'], wrong: ['question'], closest: ['question', 'unit'], lightning: ['pairs'],
  tabloid: ['headline'], closeup: ['prompt'], sound: ['prompt'], emoji: ['prompt'], tales: ['prompt'],
};

function checkText(errors, path, text, max) {
  if (typeof text !== 'string' || !text.trim()) { errors.push(`${path}: missing`); return; }
  if (text.length > max) errors.push(`${path}: ${text.length} chars (max ${max})`);
  for (const pattern of BANNED) {
    const match = text.match(pattern);
    if (match) errors.push(`${path}: banned topic "${match[0]}"`);
  }
}

function checkTypeFields(errors, game) {
  for (const field of FIELDS[game.type]) {
    if (PUBLIC_TEXT[field]) checkText(errors, `game.${field}`, game[field], PUBLIC_TEXT[field]);
  }
  if (game.type === 'mind') {
    if (!Array.isArray(game.options) || game.options.length < 2 || game.options.length > 4) errors.push('game.options: need 2-4 options');
    else game.options.forEach((option, index) => checkText(errors, `game.options.${index}`, option, 40));
  }
  if (game.type === 'lightning') {
    const pairsOk = Array.isArray(game.pairs) && game.pairs.length === 3 && game.pairs.every((pair) => Array.isArray(pair) && pair.length === 2);
    if (!pairsOk) errors.push('game.pairs: need exactly 3 pairs of 2 choices');
    else game.pairs.flat().forEach((choice, index) => checkText(errors, `game.pairs.${index}`, choice, 24));
  }
  if (game.type === 'tabloid' && typeof game.headline === 'string' && game.headline.split('___').length !== 2) {
    errors.push('game.headline: must contain exactly one ___');
  }
}

function checkSecret(errors, game) {
  const expectsSecret = game.type === 'wrong' || game.type === 'closest';
  if (!expectsSecret) {
    if (game.secret !== undefined || game.source !== undefined) errors.push('game.secret/source: only wrong and closest games have these');
    return;
  }
  if (game.type === 'wrong' && !SATURN_RULES[game.secret?.rule]) errors.push(`game.secret.rule: must be one of ${Object.keys(SATURN_RULES).join(', ')}`);
  if (game.type === 'closest') {
    if (!Number.isFinite(game.secret?.value)) errors.push('game.secret.value: must be a number');
    if (typeof game.source !== 'string' || !game.source.trim()) errors.push('game.source: say where the number comes from');
  }
}

/** Errors for one day's game; scheduledType is what the weekly rhythm expects. */
export function validateGame(game, date, scheduledType = scheduleFor(date)) {
  const errors = [];
  if (!game || !GAME_TYPES.includes(game.type)) return [`${date} game.type: must be one of ${GAME_TYPES.join(', ')}`];
  if (game.type !== scheduledType) errors.push(`game.type: "${game.type}" but ${scheduledType} is scheduled`);
  checkText(errors, 'game.intro', game.intro, 140);
  checkTypeFields(errors, game);
  checkSecret(errors, game);
  return errors.map((error) => `${date} ${error}`);
}

/** Errors for one games month file: exact date coverage plus every game's own errors. */
export function validateGamesMonth(entries, expectedDates) {
  const errors = [];
  const seen = new Map();
  for (const entry of entries) seen.set(entry.date, (seen.get(entry.date) ?? 0) + 1);
  for (const [date, count] of seen) {
    if (count > 1) errors.push(`duplicate date ${date} (${count} entries)`);
    if (!expectedDates.includes(date)) errors.push(`unexpected date ${date}`);
  }
  for (const date of expectedDates) if (!seen.has(date)) errors.push(`missing date ${date}`);
  for (const entry of entries) errors.push(...validateGame(entry.game, entry.date));
  return errors;
}

const normalize = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function fingerprints(game) {
  const main = game.question ?? game.prompt ?? game.headline;
  const prints = main ? [['', normalize(main)]] : [];
  for (const pair of game.pairs ?? []) prints.push(['lightning pair ', pair.map(normalize).sort().join(' / ')]);
  return prints;
}

/** Cross-year repeats of questions, prompts, headlines and lightning pairs. The later date is flagged. */
export function gameYearChecks(entries) {
  const errors = [];
  const seen = new Map();
  for (const entry of [...entries].sort((first, second) => first.date.localeCompare(second.date))) {
    for (const [label, print] of fingerprints(entry.game ?? {})) {
      const key = `${label}${print}`;
      const earlier = seen.get(key);
      if (earlier) errors.push(`${entry.date} repeats ${label}"${print}" from ${earlier}`);
      else seen.set(key, entry.date);
    }
  }
  return errors;
}
