// Pure rules for push notifications: which nudge, if any, a successful write sends to the other person.
// Nudges carry names and the day only, never answers or game content.
import { addDays } from './core.mjs';
import { gameStage } from './game.mjs';

const NAMES = { joel: 'Joel', nancy: 'Nancy' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayPhrase(date, today) {
  if (date === today) return "today's";
  if (date === addDays(today, -1)) return "yesterday's";
  if (date === addDays(today, 1)) return "tomorrow's";
  const [, month, day] = date.split('-').map(Number);
  return `the ${MONTHS[month - 1]} ${day}`;
}

const exchange = (kind, body) => ({ kind, title: '🎤 The Exchange', body, url: './#exchange' });
const bonus = (kind, body) => ({ kind, title: '🎲 Bonus Round', body, url: './#bonus' });

/** The nudge for an Exchange answer by `actor`, or null for edits. */
export function exchangeNudge(before, after, actor, date, today) {
  if (before?.[actor]) return null;
  const other = actor === 'joel' ? 'nancy' : 'joel';
  const day = dayPhrase(date, today);
  return after?.[other]
    ? exchange('exchange-revealed', `${NAMES[actor]} answered. ${capitalize(day)} Exchange is revealed 🎤`)
    : exchange('exchange-answered', `${NAMES[actor]} locked in ${day} Exchange. Your move 🔥`);
}

const GAME_MESSAGES = {
  'answer>answer': ['game-answered', (name, day) => `${name} played ${day} Bonus Round. Your turn 🎲`],
  'answer>guess': ['game-guess', (name, day) => `Both in! Time to guess in ${day} Bonus Round 🎲`],
  'guess>guess': ['game-guessed', (name, day) => `${name} made a guess in ${day} Bonus Round. Your turn 🎲`],
  'guess>ruling': ['game-ruling', (name, day) => `Guesses are in. Time to rule on ${day} Bonus Round ⚖️`],
  'ruling>ruling': ['game-ruled', (name, day) => `${name} ruled on ${day} Bonus Round. Your call ⚖️`],
  done: ['game-done', (name, day) => `${capitalize(day)} Bonus Round results are in 🏆`],
};

/** The nudge for a Bonus Round write by `actor`, from the stage before and after it. */
export function gameNudge(type, before, after, actor, status, date, today) {
  const from = gameStage(type, before ?? {}, status);
  const to = gameStage(type, after ?? {}, status);
  const entry = to === 'done' ? GAME_MESSAGES.done : GAME_MESSAGES[`${from}>${to}`];
  if (!entry || from === 'done') return null;
  const [kind, message] = entry;
  return bonus(kind, message(NAMES[actor], dayPhrase(date, today)));
}

function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
