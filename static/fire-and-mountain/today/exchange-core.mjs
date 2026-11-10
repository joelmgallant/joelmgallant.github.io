// Pure logic for The Exchange panel. No DOM access; unit-tested in tools/fire-and-mountain/test.
const NAMES = { joel: 'Joel', nancy: 'Nancy' };
const NICKNAMES = { joel: 'Tiger', nancy: 'Mountain' };

export const nickname = (person) => NICKNAMES[person];
export const otherName = (person) => NAMES[person === 'joel' ? 'nancy' : 'joel'];

/** The personal key from a `#join=<key>` link, or null. Keys are 32 bytes in base64url. */
export function parseJoinKey(hash) {
  const match = /^#join=([A-Za-z0-9_-]{43})$/.exec(hash ?? '');
  return match ? match[1] : null;
}

/** Which panel to show: none, offline, unanswered, waiting, revealed or closed. */
export function panelState({ hasKey, error, response }) {
  if (!hasKey) return 'none';
  if (error || !response) return 'offline';
  if (response.revealed) return response.me && response.them.answer ? 'revealed' : 'closed';
  if (!response.open) return 'closed';
  return response.me ? 'waiting' : 'unanswered';
}

const LINES = {
  unanswered: [
    "Today's round, {me}. No conferring, no peeking, no refunds.",
    'The buzzer is warm. The stage is yours, {me}.',
    'Contestant {me}, step up to the podium. Answer like nobody is grading. (Saturn is grading.)',
    "Clock's ticking, {me}. Well, it isn't. But act like it is.",
  ],
  waiting: [
    "Locked in. {other}'s still thinking. Don't rush a {otherSign}.",
    'Your answer is in the vault. {other} has not hit the buzzer yet.',
    "Sealed and sitting pretty. Now we wait for {other}. Hum the waiting music.",
    "Final answer received. {other}'s up next. No hints. We see you.",
  ],
  revealed: [
    'BOTH ANSWERS ARE IN. Let us see what you have got…',
    'The envelopes, please!',
    'Drumroll for the Fire and the Mountain…',
  ],
  match: [
    'Same answer. Don\'t even scream.',
    'Identical. The universe is showing off again.',
    'A perfect match. Somewhere, a candle just flickered on purpose.',
  ],
  closed: [
    "This round's over. The cards have moved on.",
    'Buzzer silent. Here is what made it in before the lights went down.',
  ],
};

const SIGNS = { joel: 'Aries', nancy: 'Capricorn' };

function seedFor(text) {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

/** A host line for a panel state, stable for a given date and person. */
export function hostLine(state, person, date) {
  const options = LINES[state] ?? LINES.closed;
  const other = person === 'joel' ? 'nancy' : 'joel';
  const line = options[seedFor(`${state}:${person}:${date}`) % options.length];
  return line.replaceAll('{me}', NICKNAMES[person]).replaceAll('{other}', NAMES[other]).replaceAll('{otherSign}', SIGNS[other]);
}

/** The best supported recording type; the upload type is what the API stores. */
export function pickRecordingType(isTypeSupported) {
  if (isTypeSupported('audio/webm;codecs=opus')) return { recorderType: 'audio/webm;codecs=opus', uploadType: 'audio/webm' };
  if (isTypeSupported('audio/webm')) return { recorderType: 'audio/webm', uploadType: 'audio/webm' };
  if (isTypeSupported('audio/mp4')) return { recorderType: 'audio/mp4', uploadType: 'audio/mp4' };
  return null;
}

/** Dimensions that fit the long side within maxSide, never enlarging. */
export function scaledSize(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
