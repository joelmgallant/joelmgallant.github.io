// Bonus Round display: items to guess, the guess and ruling forms, and the result view for each game.
import { NAMES, element } from './exchange-ui.mjs';
import { RULING_LABELS, fillHeadline, resultLine } from './game-core.mjs';

const other = (person) => (person === 'joel' ? 'nancy' : 'joel');
const card = (person, label, ...children) => element('div', { className: `answer-card ${person}` },
  element('p', { className: 'answer-name', textContent: label }), ...children);
const line = (className, textContent) => element('p', { className, textContent });
const empty = () => line('answer-empty', 'No answer this round.');

/** The thing being guessed: a photo, a sound, an emoji string or three facts. Caption only when allowed. */
export function itemView(type, answer, { showCaption = false } = {}) {
  if (!answer) return [empty()];
  const parts = [];
  if (answer.photoUrl) parts.push(element('img', { className: 'answer-photo closeup', src: answer.photoUrl, alt: 'An extreme close-up' }));
  if (answer.audioUrl) parts.push(element('audio', { className: 'answer-audio', src: answer.audioUrl, controls: true, preload: 'none' }));
  if (answer.emoji) parts.push(line('emoji-big', answer.emoji));
  if (answer.facts) {
    parts.push(element('ol', { className: 'facts' }, ...answer.facts.map((fact, index) =>
      element('li', { className: showCaption && answer.caption === index ? 'tale' : '', textContent: fact }))));
  }
  if (showCaption && type !== 'tales' && answer.caption) parts.push(line('caption', `Really: ${answer.caption}`));
  if (showCaption && type === 'tales') parts.push(line('caption', `The tall tale: fact ${answer.caption + 1}`));
  return parts;
}

/** Guess input: pick a fact for tales, otherwise one line of text. */
export function guessForm(type, theirAnswer, existing, onGuess) {
  if (type === 'tales') {
    const buttons = (theirAnswer?.facts ?? []).map((fact, index) => {
      const button = element('button', { type: 'button', className: 'choice', ariaPressed: String(existing === index), textContent: `${index + 1}. ${fact}` });
      button.addEventListener('click', () => onGuess(index, button));
      return button;
    });
    return element('div', { className: 'choice-group' }, line('choice-label', 'Which one is the tall tale?'), element('div', { className: 'choices stacked' }, ...buttons));
  }
  const input = element('input', { type: 'text', className: 'answer-input', maxLength: 80, value: existing ?? '', placeholder: 'Your guess', ariaLabel: 'Your guess' });
  const button = element('button', { type: 'button', className: 'big-button', textContent: 'Lock in guess', disabled: !input.value.trim() });
  input.addEventListener('input', () => { button.disabled = !input.value.trim(); });
  button.addEventListener('click', () => onGuess(input.value.trim(), button));
  return element('div', { className: 'guess-form' }, input, element('div', { className: 'composer-actions' }, button));
}

export function rulingForm(onRule) {
  const buttons = Object.entries(RULING_LABELS).map(([ruling, label]) => {
    const button = element('button', { type: 'button', className: 'choice', textContent: label });
    button.addEventListener('click', () => onRule(ruling, button));
    return button;
  });
  return element('div', { className: 'choice-group' }, line('choice-label', 'Your ruling is final:'), element('div', { className: 'choices' }, ...buttons));
}

function sides(me, render) {
  return element('div', { className: 'reveal-cards' }, render(me, `${NAMES[me]} (you)`), render(other(me), NAMES[other(me)]));
}

const answersOf = (shape, me) => ({ [me]: shape.me.answer, [other(me)]: shape.them.answer });
const guessesOf = (shape, me) => ({ [me]: shape.me.guess, [other(me)]: shape.them.guess });

const RESULT_VIEWS = {
  mind: (game, shape, me, answers) => sides(me, (person, label) => {
    const answer = answers[person];
    if (!answer) return card(person, label, empty());
    const right = shape.result?.points?.[person] === 1;
    return card(person, label, line('answer-text', game.options[answer.pick]),
      line('verdict', `Guessed ${game.options[answer.guess]} ${right ? '✅' : '❌'}`));
  }),
  wrong: (game, shape, me, answers) => element('div', {},
    shape.result ? element('div', { className: 'saturn-card' }, line('saturn-label', "Saturn's secret rule"), line('saturn-rule', shape.result.line)) : null,
    sides(me, (person, label) => card(person, `${label}${shape.result?.winner === person ? ' 🏆' : ''}`, answers[person] ? line('answer-text', answers[person].text) : empty()))),
  closest: (game, shape, me, answers) => element('div', {},
    shape.result ? line('true-value', `The answer: ${shape.result.value.toLocaleString()} ${game.unit}`) : null,
    sides(me, (person, label) => card(person, `${label}${shape.result?.winner === person ? ' 🏆' : ''}`,
      answers[person] ? line('answer-text', `${answers[person].number.toLocaleString()} ${game.unit}`) : empty(),
      shape.result?.bust?.[person] ? line('bust', 'BUST!') : null))),
  lightning: (game, shape, me, answers) => element('table', { className: 'lightning-table' },
    element('tr', {}, element('th', { textContent: '' }), element('th', { textContent: `${NAMES[me]} (you)` }), element('th', { textContent: NAMES[other(me)] })),
    ...game.pairs.map((pair, index) => {
      const mine = answers[me]?.picks?.[index];
      const theirs = answers[other(me)]?.picks?.[index];
      return element('tr', { className: mine !== undefined && mine === theirs ? 'match' : '' }, element('td', { textContent: mine === theirs ? '⚡' : '' }),
        element('td', { textContent: mine === undefined ? '—' : pair[mine] }), element('td', { textContent: theirs === undefined ? '—' : pair[theirs] }));
    })),
  tabloid: (game, shape, me, answers) => element('div', { className: 'front-page' }, line('masthead', 'THE COSMIC COURIER'),
    ...[me, other(me)].map((person) => element('div', { className: 'story' }, line('byline', `By ${NAMES[person]}`),
      line('headline', answers[person] ? fillHeadline(game.headline, answers[person].text) : 'STORY SPIKED: NO ANSWER')))),
};

function twoStageView(game, shape, me, answers) {
  const guesses = guessesOf(shape, me);
  const rulings = shape.result?.rulings ?? {};
  return sides(me, (person, label) => card(person, label, ...itemView(game.type, answers[person], { showCaption: true }),
    line('verdict', guesses[other(person)] !== null && guesses[other(person)] !== undefined
      ? `${NAMES[other(person)]} guessed: ${game.type === 'tales' ? `fact ${guesses[other(person)] + 1}` : guesses[other(person)]}` : `${NAMES[other(person)]} didn't guess.`),
    rulings[other(person)] ? line('ruling', RULING_LABELS[rulings[other(person)]]) : line('ruling', 'No ruling from the judges.')));
}

/** The finished (or closed) round. */
export function resultView(game, shape, me) {
  const answers = answersOf(shape, me);
  const view = (RESULT_VIEWS[game.type] ?? twoStageView)(game, shape, me, answers);
  const summary = shape.result ? line('host-line', resultLine(game.type, shape.result, me)) : line('host-line', 'The round closed before everyone played.');
  const stamp = shape.result?.des ? element('div', { className: 'des-stamp', textContent: 'ΔΕΣ!', title: "Don't even scream" }) : null;
  return element('div', { className: 'stage game-stage' }, summary, view, stamp);
}
