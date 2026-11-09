// Pure logic for the daily reading page. No DOM access; unit-tested in tools/fire-and-mountain/test.
export const FIRST_DAY = '2026-11-10';
export const LAST_DAY = '2027-11-09';

const CARD_TOKEN = /\[\[([^\]]+)\]\]/g;
const WAXING = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous'];

const pad = (number) => String(number).padStart(2, '0');

/** The device's local calendar date as YYYY-MM-DD. */
export function localIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DAY_SALT = 'fire-and-mountain-days-v1';

/**
 * Each day's reading lives in its own file with a hashed name, so the page downloads only
 * today's reading and future days can't be found by editing a URL. Used by build.mjs too.
 */
export async function dayFileName(isoDate) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${DAY_SALT}:${isoDate}`));
  const hex = [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex}.json`;
}

/** Which reading to show: dates before the batch show the first day; after it, nothing. */
export function resolveDay(isoDate) {
  if (isoDate > LAST_DAY) return { status: 'after' };
  return { status: 'ok', date: isoDate < FIRST_DAY ? FIRST_DAY : isoDate };
}

/** Split text into plain parts and [[Card]] links. Unknown cards become plain text. */
export function tokenizeCards(text, links) {
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(CARD_TOKEN)) {
    if (match.index > cursor) parts.push({ type: 'text', text: text.slice(cursor, match.index) });
    const name = match[1];
    parts.push(links[name] ? { type: 'card', name, url: links[name] } : { type: 'text', text: name });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ type: 'text', text: text.slice(cursor) });
  return parts;
}

export function isWaxing(phase) {
  return WAXING.includes(phase);
}

const round = (number) => Math.round(number * 10) / 10;

/**
 * SVG path for the lit part of the moon in a 100x100 box (centre 50, radius 48).
 * litFraction 0..1; waxing moons are lit on the right (northern hemisphere).
 */
export function moonPath(litFraction, waxing) {
  const radius = 48;
  const terminatorRadius = round(radius * Math.abs(1 - 2 * litFraction));
  const outerSweep = waxing ? 1 : 0;
  const crescent = litFraction <= 0.5;
  const terminatorSweep = waxing === crescent ? 0 : 1;
  return `M50 2 A${radius} ${radius} 0 0 ${outerSweep} 50 98 A${terminatorRadius} ${radius} 0 0 ${terminatorSweep} 50 2 Z`;
}

function seededRandom(seedText) {
  let hash = 2166136261;
  for (const character of seedText) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small constellation unique to each date: 5 to 8 points inside a 64x64 box (8..56). */
export function sigilPoints(isoDate) {
  const random = seededRandom(`fire-and-mountain:${isoDate}`);
  const count = 5 + Math.floor(random() * 4);
  return Array.from({ length: count }, () => [Math.round(8 + random() * 48), Math.round(8 + random() * 48)]);
}
