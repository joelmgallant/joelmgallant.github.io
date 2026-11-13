// The Bonus Round: one small two-player game a day under the Exchange, played answer → (guess → ruling) → reveal.
import { ApiError, createApi } from './exchange-api.mjs';
import { otherName } from './exchange-core.mjs';
import { playSting } from './exchange-sounds.mjs';
import { element } from './exchange-ui.mjs';
import { createGameComposer } from './game-answer.mjs';
import { GAME_NAMES, isTwoStage, stageIndex, stageSteps } from './game-core.mjs';
import { guessForm, itemView, resultView, rulingForm } from './game-reveal.mjs';

const IDENTITY_KEY = 'fm-exchange-identity';
const SEEN_KEY = 'fm-game-seen-reveal';
const POLL_MS = 30_000;

function readStored(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function markSeen(date) {
  const seen = readStored(SEEN_KEY) ?? [];
  if (seen.includes(date)) return false;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.slice(-40), date])); } catch { /* private mode */ }
  return true;
}

const promptText = (game) => game.question ?? game.prompt ?? game.headline ?? 'Three this-or-that picks, ten seconds each. Gut only.';

function mySummary(game, answer) {
  if (isTwoStage(game.type)) return itemView(game.type, answer, { showCaption: true });
  const text = {
    mind: () => `You picked ${game.options[answer.pick]} and guessed ${game.options[answer.guess]}.`,
    closest: () => `${answer.number.toLocaleString()} ${game.unit}`,
    lightning: () => game.pairs.map((pair, index) => pair[answer.picks[index]]).join(' · '),
  }[game.type]?.() ?? answer.text;
  return [element('p', { className: 'answer-text', textContent: text })];
}

let teardown = () => {};

export function mountGame({ container, date, game }, identity = readStored(IDENTITY_KEY)) {
  teardown();
  const onJoined = (event) => mountGame({ container, date, game }, event.detail);
  // Remount whenever someone joins, including with a new link after the old one was reset.
  window.addEventListener('fm-exchange-joined', onJoined, { once: true });
  const stopListening = () => window.removeEventListener('fm-exchange-joined', onJoined);
  if (!game || !identity) { container.hidden = true; teardown = stopListening; return; }
  const api = createApi(identity.key);
  const me = identity.person;
  const them = otherName(me);
  let pollTimer = null;
  let editing = false;
  let live = true; // false once this mount is replaced, so late replies for the old key are ignored
  container.hidden = false;

  const header = (stage) => {
    const steps = stageSteps(game.type);
    const current = stageIndex(game.type, stage);
    return [
      element('div', { className: 'exchange-header' }, element('h2', { className: 'exchange-title bonus-title', textContent: `🎲 ${GAME_NAMES[game.type]}` })),
      element('ol', { className: 'stepper', ariaLabel: 'Round progress' }, ...steps.map((step, index) =>
        element('li', { className: index < current ? 'past' : index === current ? 'current' : '', textContent: step, ariaCurrent: index === current ? 'step' : null }))),
      element('p', { className: 'host-line', textContent: game.intro }),
      element('p', { className: 'exchange-prompt', textContent: promptText(game) }),
    ];
  };
  const sealed = (text) => element('p', { className: 'sealed', textContent: text });
  const act = (promise, button) => {
    if (button) button.disabled = true;
    promise.then((shape) => { playSting('lock'); editing = false; show(shape); })
      .catch((error) => { playSting('buzz'); if (button) button.disabled = false; if (error instanceof ApiError && error.status === 409) render(); });
  };

  function body(shape) {
    const { stage } = shape;
    if (stage === 'upcoming') return [sealed('This round opens soon.')];
    if (stage === 'done' || stage === 'closed') {
      if (shape.result && markSeen(date)) playSting(shape.result.des ? 'match' : 'reveal');
      return [resultView(game, shape, me)];
    }
    if (stage === 'answer') {
      if (!shape.me.answer || editing) {
        return [shape.them.answered ? sealed(`🔒 ${them} has locked in. Your move.`) : null, createGameComposer({ api, date, game, existing: editing ? shape.me.answer : null,
          otherName: them, onSaved: (updated) => { editing = false; show(updated); }, onCancel: editing ? () => { editing = false; show(shape); } : null })];
      }
      const change = element('button', { type: 'button', className: 'mini', textContent: 'Change my answer' });
      change.addEventListener('click', () => { editing = true; show(shape); });
      return [element('div', { className: `answer-card ${me}` }, element('p', { className: 'answer-name', textContent: 'Your locked-in answer' }), ...mySummary(game, shape.me.answer)),
        change, sealed(`🔒 ${them} hasn't answered yet. Sealed until you're both in.`)];
    }
    const theirItem = element('div', { className: `answer-card ${me === 'joel' ? 'nancy' : 'joel'}` },
      element('p', { className: 'answer-name', textContent: `${them}'s ${game.type === 'tales' ? 'three facts' : 'mystery'}` }), ...itemView(game.type, shape.them.answer, { showCaption: stage === 'ruling' }));
    if (stage === 'guess') {
      if (shape.me.guess === null || editing) return [theirItem, guessForm(game.type, shape.them.answer, shape.me.guess, (value, button) => act(api.guess(date, value), button))];
      const change = element('button', { type: 'button', className: 'mini', textContent: 'Change my guess' });
      change.addEventListener('click', () => { editing = true; show(shape); });
      return [theirItem, sealed(`Your guess: ${game.type === 'tales' ? `fact ${shape.me.guess + 1}` : shape.me.guess}`), change, sealed(`🔒 Waiting for ${them}'s guess.`)];
    }
    const mine = element('div', { className: `answer-card ${me}` }, element('p', { className: 'answer-name', textContent: 'Your item' }), ...itemView(game.type, shape.me.answer, { showCaption: true }),
      element('p', { className: 'verdict', textContent: `${them} guessed: ${shape.them.guess}` }));
    const judging = shape.me.ruling === null ? rulingForm((ruling, button) => act(api.rule(date, ruling), button)) : sealed(`🔒 You ruled. Waiting for ${them}'s ruling.`);
    return [theirItem, sealed(`Your guess: ${shape.me.guess}`), mine, judging];
  }

  function show(shape) {
    container.replaceChildren(...header(shape.stage), ...body(shape).filter(Boolean));
    clearInterval(pollTimer);
    const waiting = !editing && ['answer', 'guess', 'ruling'].includes(shape.stage) && !container.querySelector('.game-composer, .guess-form, .choice-group');
    if (waiting) pollTimer = setInterval(() => { if (document.visibilityState === 'visible') render(); }, POLL_MS);
  }

  async function render() {
    if (editing) return;
    try {
      const response = await api.game(date);
      if (live) show(response);
    } catch (error) {
      if (!live) return;
      if (error instanceof ApiError && error.status === 404) { container.hidden = true; return; }
      if (error instanceof ApiError && error.status === 401) { container.hidden = true; return; } // the Exchange panel offers the rejoin
      const retry = element('button', { type: 'button', className: 'chunky', textContent: 'Retry' });
      retry.addEventListener('click', render);
      container.replaceChildren(...header('answer'), element('p', { className: 'host-line', textContent: 'Connect to play 📡' }), retry);
    }
  }

  const onVisible = () => { if (document.visibilityState === 'visible' && !container.querySelector('.game-composer, .guess-form, .choice-group')) render(); };
  document.addEventListener('visibilitychange', onVisible);
  teardown = () => { live = false; clearInterval(pollTimer); document.removeEventListener('visibilitychange', onVisible); stopListening(); };
  render();
}
