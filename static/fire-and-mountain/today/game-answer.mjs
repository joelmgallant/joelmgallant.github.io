// Bonus Round answer composer: one small input per game type, plus the Lock it in button.
import { ApiError } from './exchange-api.mjs';
import { resizePhoto } from './exchange-composer.mjs';
import { attachRecorder } from './exchange-recorder.mjs';
import { playSting } from './exchange-sounds.mjs';
import { element } from './exchange-ui.mjs';
import { fillHeadline, isEmojiOnly } from './game-core.mjs';

const LIGHTNING_SECONDS = 10;
const textInput = (props) => element('input', { type: 'text', className: 'answer-input', autocomplete: 'off', ...props });
const captionInput = (value, placeholder) => textInput({ maxLength: 80, value: value ?? '', placeholder, ariaLabel: placeholder });

/** A row of toggle buttons; returns { node, value() }. */
function choiceRow(label, options, selected, onChange) {
  let value = selected ?? null;
  const buttons = options.map((option, index) => {
    const button = element('button', { type: 'button', className: 'choice', textContent: option, ariaPressed: String(index === value) });
    button.addEventListener('click', () => {
      value = index;
      buttons.forEach((other, otherIndex) => other.setAttribute('aria-pressed', String(otherIndex === index)));
      onChange();
    });
    return button;
  });
  return { node: element('div', { className: 'choice-group' }, element('p', { className: 'choice-label', textContent: label }), element('div', { className: 'choices' }, ...buttons)), value: () => value };
}

function lightningField(game, existing, onChange, otherName) {
  const picks = existing?.picks ? [...existing.picks] : [];
  const stage = element('div', { className: 'lightning' });
  let timer = null;
  const summary = () => {
    const redo = element('button', { type: 'button', className: 'mini', textContent: 'Run it again' });
    redo.addEventListener('click', () => { picks.length = 0; delete stage.dataset.note; onChange(); start(); });
    const note = stage.dataset.note ? element('p', { className: 'composer-status', textContent: stage.dataset.note }) : null;
    stage.replaceChildren(element('ol', { className: 'lightning-picks' }, ...game.pairs.map((pair, index) => element('li', { textContent: pair[picks[index]] }))), note, redo);
  };
  const ask = (index) => {
    if (index === 3) { summary(); onChange(); return; }
    let remaining = LIGHTNING_SECONDS;
    const clock = element('span', { className: 'countdown', textContent: String(remaining) });
    const choose = (pick, note = '') => { clearInterval(timer); picks[index] = pick; if (note) stage.dataset.note = note; ask(index + 1); };
    const buttons = game.pairs[index].map((option, pick) => {
      const button = element('button', { type: 'button', className: 'choice big', textContent: option });
      button.addEventListener('click', () => choose(pick));
      return button;
    });
    stage.replaceChildren(element('p', { className: 'choice-label', textContent: `${index + 1} of 3 · ` }, clock), element('div', { className: 'choices' }, ...buttons));
    timer = setInterval(() => {
      remaining -= 1;
      clock.textContent = String(remaining);
      if (remaining <= 3) playSting('tick');
      if (remaining <= 0) choose(Math.round(Math.random()), 'Too slow! Saturn picked for you.');
    }, 1000);
  };
  const start = () => ask(0);
  const begin = element('button', { type: 'button', className: 'chunky', textContent: `⚡ Start the clock (${LIGHTNING_SECONDS}s each)` });
  begin.addEventListener('click', start);
  if (picks.length === 3) summary(); else stage.replaceChildren(element('p', { className: 'choice-label', textContent: `Three quick picks. Gut only. ${otherName} is doing the same.` }), begin);
  return { node: stage, ready: () => picks.length === 3, body: async () => ({ picks }) };
}

function mediaField(kind, existing, onChange, api, date, status) {
  const draft = { blob: null, key: existing?.[`${kind}Key`] ?? null, type: existing?.audioType ?? null };
  const preview = element('div', { className: 'media-preview' });
  const show = (src) => preview.replaceChildren(kind === 'photo' ? element('img', { src, alt: 'Your close-up' }) : element('audio', { src, controls: true }));
  if (existing?.[`${kind}Url`]) show(existing[`${kind}Url`]);
  const button = element('button', { type: 'button', className: 'chunky', textContent: '📷 Take or pick a photo' });
  let tools = [button];
  if (kind === 'photo') {
    const file = element('input', { type: 'file', accept: 'image/*', hidden: true });
    button.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      status.textContent = 'Shrinking your photo…';
      try { draft.blob = await resizePhoto(file.files[0]); show(URL.createObjectURL(draft.blob)); status.textContent = ''; } catch { status.textContent = "Couldn't read that photo. Try another?"; }
      onChange();
    });
    tools = [button, file];
  } else {
    const supported = attachRecorder(button, { maxSeconds: 30, label: '🎙️ Record your sound',
      onRecorded: (blob, type) => { draft.blob = blob; draft.type = type; show(URL.createObjectURL(blob)); onChange(); },
      onError: () => { status.textContent = 'No microphone access, so no sound this round.'; } });
    if (!supported) status.textContent = "This browser can't record audio.";
  }
  const upload = async () => {
    if (!draft.blob) return kind === 'photo' ? { photoKey: draft.key } : { audioKey: draft.key, audioType: draft.type };
    const contentType = kind === 'photo' ? 'image/jpeg' : draft.type;
    const key = await api.upload(date, kind, draft.blob, contentType, 'game');
    return kind === 'photo' ? { photoKey: key } : { audioKey: key, audioType: contentType };
  };
  return { node: element('div', {}, element('div', { className: 'composer-tools' }, ...tools), preview), ready: () => Boolean(draft.blob || draft.key), upload };
}

function fieldFor({ type, game, existing, onChange, api, date, status, otherName }) {
  if (type === 'mind') {
    const pick = choiceRow('Your pick', game.options, existing?.pick, onChange);
    const guess = choiceRow(`What will ${otherName} pick?`, game.options, existing?.guess, onChange);
    return { node: element('div', {}, pick.node, guess.node), ready: () => pick.value() !== null && guess.value() !== null, body: async () => ({ pick: pick.value(), guess: guess.value() }) };
  }
  if (type === 'wrong' || type === 'tabloid') {
    const max = type === 'wrong' ? 120 : 60;
    const input = textInput({ maxLength: max, value: existing?.text ?? '', placeholder: type === 'wrong' ? 'Your most gloriously wrong answer' : 'Fill the blank' });
    const preview = type === 'tabloid' ? element('p', { className: 'tabloid-preview', textContent: fillHeadline(game.headline, input.value) }) : null;
    input.addEventListener('input', () => { if (preview) preview.textContent = fillHeadline(game.headline, input.value); onChange(); });
    return { node: element('div', {}, preview, input), ready: () => input.value.trim().length > 0, body: async () => ({ text: input.value.trim() }) };
  }
  if (type === 'closest') {
    const input = element('input', { type: 'number', inputMode: 'decimal', className: 'answer-input number', value: existing?.number ?? '', placeholder: 'Your number', ariaLabel: 'Your number' });
    input.addEventListener('input', onChange);
    return { node: element('div', { className: 'number-row' }, input, element('span', { className: 'unit', textContent: game.unit })), ready: () => input.value !== '' && Number.isFinite(Number(input.value)), body: async () => ({ number: Number(input.value) }) };
  }
  if (type === 'lightning') return lightningField(game, existing, onChange, otherName);
  if (type === 'tales') {
    const facts = [0, 1, 2].map((index) => textInput({ maxLength: 100, value: existing?.facts?.[index] ?? '', placeholder: `Fact ${index + 1}` }));
    facts.forEach((input) => input.addEventListener('input', onChange));
    const tale = choiceRow('Which one is the tall tale? (sealed)', ['Fact 1', 'Fact 2', 'Fact 3'], existing?.caption, onChange);
    return { node: element('div', { className: 'tales-fields' }, ...facts, tale.node), ready: () => facts.every((input) => input.value.trim()) && tale.value() !== null,
      body: async () => ({ facts: facts.map((input) => input.value.trim()), caption: tale.value() }) };
  }
  const caption = captionInput(existing?.caption, type === 'emoji' ? 'What it spells (sealed until you both guess)' : 'What is it really? (sealed until you both guess)');
  caption.addEventListener('input', onChange);
  if (type === 'emoji') {
    const emoji = textInput({ maxLength: 64, value: existing?.emoji ?? '', placeholder: '🦁👑🌅', className: 'answer-input emoji-input', ariaLabel: 'Your emoji' });
    emoji.addEventListener('input', onChange);
    return { node: element('div', {}, emoji, caption), ready: () => isEmojiOnly(emoji.value) && caption.value.trim().length > 0, body: async () => ({ emoji: emoji.value.trim(), caption: caption.value.trim() }) };
  }
  const media = mediaField(type === 'closeup' ? 'photo' : 'audio', existing, onChange, api, date, status);
  return { node: element('div', {}, media.node, caption), ready: () => media.ready() && caption.value.trim().length > 0, body: async () => ({ ...(await media.upload()), caption: caption.value.trim() }) };
}

/** The answer form for today's game. onSaved gets the API response; onCancel (optional) abandons an edit. */
export function createGameComposer({ api, date, game, existing, otherName, onSaved, onCancel }) {
  const status = element('p', { className: 'composer-status', role: 'status' });
  const lock = element('button', { type: 'button', className: 'big-button lock', textContent: 'Lock it in' });
  const refresh = () => { lock.disabled = !field.ready(); };
  const field = fieldFor({ type: game.type, game, existing, onChange: () => refresh(), api, date, status, otherName });
  refresh();
  lock.addEventListener('click', async () => {
    lock.disabled = true;
    status.textContent = 'Locking it in…';
    try {
      const updated = await api.putGame(date, await field.body());
      playSting('lock');
      onSaved(updated);
    } catch (error) {
      playSting('buzz');
      status.textContent = error instanceof ApiError && error.status === 409 ? "Too late, this round's moved on." : `${error.message} Try again?`;
      refresh();
    }
  });
  const cancel = onCancel ? element('button', { type: 'button', className: 'mini', textContent: 'Never mind' }) : null;
  cancel?.addEventListener('click', onCancel);
  return element('div', { className: 'composer game-composer' }, field.node, element('div', { className: 'composer-actions' }, lock, cancel), status);
}
