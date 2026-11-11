// Pure logic for the Bonus Round panel. No DOM access; unit-tested in tools/fire-and-mountain/test.
const NAMES = { joel: 'Joel', nancy: 'Nancy' };
const other = (person) => (person === 'joel' ? 'nancy' : 'joel');

export const GAME_NAMES = {
  mind: 'Read My Mind', wrong: 'Wrong Answers Only', closest: 'Closest Without Going Over', lightning: 'Lightning Round',
  tabloid: 'Tabloid Front Page', closeup: 'Extreme Close-Up', sound: 'Sound Off', emoji: 'Emoji Charades', tales: 'Two Truths and a Tall Tale',
};

export const RULING_LABELS = { yes: '✅ Nailed it', close: '🤏 Close', no: '❌ Nope' };
const RULING_WORDS = { yes: 'nailed it', close: 'got close', no: 'missed' };

export const isTwoStage = (type) => ['closeup', 'sound', 'emoji', 'tales'].includes(type);

export function stageSteps(type) {
  if (!isTwoStage(type)) return ['Answer', 'Reveal'];
  return type === 'tales' ? ['Answer', 'Guess', 'Reveal'] : ['Answer', 'Guess', 'Ruling', 'Reveal'];
}

/** Index of the current step in stageSteps; done and closed both land on Reveal. */
export function stageIndex(type, stage) {
  const steps = stageSteps(type);
  if (stage === 'done' || stage === 'closed') return steps.length - 1;
  return Math.max(0, steps.indexOf(stage.charAt(0).toUpperCase() + stage.slice(1)));
}

export function fillHeadline(headline, text) {
  return text?.trim() ? headline.replace('___', text.trim().toUpperCase()) : headline;
}

const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

/** 1-16 emoji with no letters or digits (the server enforces the same rule). */
export function isEmojiOnly(text) {
  const emoji = (text ?? '').trim();
  const count = graphemes ? [...graphemes.segment(emoji)].length : [...emoji].length;
  return emoji.length > 0 && count <= 16 && !/[\p{L}\p{N}]/u.test(emoji.replace(/️|⃣/g, ''));
}

function winnerLine(winner, me) {
  if (winner === 'tie') return 'Dead heat!';
  if (!winner) return 'Both bust! Saturn keeps the prize.';
  return winner === me ? 'You win this one! 🏆' : `${NAMES[winner]} takes it.`;
}

/** One line summing up a finished round, from the viewer's side. */
export function resultLine(type, result, me) {
  const them = other(me);
  if (type === 'wrong' || type === 'closest') return winnerLine(result.winner, me);
  if (type === 'mind') {
    const mine = result.points[me];
    const theirs = result.points[them];
    if (mine && theirs) return 'You read each other like open books.';
    if (!mine && !theirs) return 'Two closed books. Saturn is fascinated.';
    return mine ? `You read ${NAMES[them]}'s mind. They did not read yours.` : `${NAMES[them]} read your mind. You did not read theirs.`;
  }
  if (type === 'lightning') return `${result.matches} out of 3 in sync.`;
  if (type === 'tabloid') return result.des ? 'Same headline. The presses are melting.' : 'Hot off the press.';
  const yours = result.rulings?.[me];
  const theirs = result.rulings?.[them];
  const part = (ruling, subject) => (ruling ? `${subject} ${RULING_WORDS[ruling]}` : `${subject} got no ruling`);
  return `${part(yours, 'You')}. ${part(theirs, NAMES[them])}.`;
}
