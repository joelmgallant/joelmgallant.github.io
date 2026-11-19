// Guest join box. Most devices join by tapping the link. Apple home-screen apps keep their own storage and
// can't open #join links, so there (canPaste) a copied link is joined with one tap, or pasted by hand.
import { parsePastedLink } from './exchange-core.mjs';
import { element } from './exchange-ui.mjs';

export const BAD_LINK = "That link didn't work. Ask Joel for a fresh one.";
export const RESET_LINK = "This device's link was reset. Tap the new link Joel sent you.";
const TAP_LINK = 'Tap the link Joel sent you on this phone and it brings you right in.';
const NO_LINK_COPIED = 'No Exchange link on the clipboard. Copy your link first, then tap again.';

/** `join(key)` resolves to the joined identity or null; `onJoin` receives it. */
export function joinBox({ notice, join, onJoin, canPaste = false }) {
  const status = element('p', { className: 'composer-status', textContent: notice ?? '', role: 'status' });
  if (!canPaste) {
    return element('div', {}, element('div', { className: 'join-row' }, element('p', { className: 'join-label', textContent: '🎤 Got an Exchange link?' })),
      element('p', { className: 'composer-status', textContent: notice ? `${notice}` : TAP_LINK, role: 'status' }));
  }
  const buttons = [];
  const busy = (isBusy) => buttons.forEach((button) => { button.disabled = isBusy; });

  async function tryJoin(text, missingMessage) {
    const key = parsePastedLink(text);
    if (!key) { status.textContent = missingMessage; return; }
    busy(true);
    status.textContent = 'Checking the guest list…';
    const joined = await join(key);
    busy(false);
    if (joined) onJoin(joined); else status.textContent = BAD_LINK;
  }

  // Plain text, not type=url: a pasted message with words around the link must reach our parser, not the browser's validator.
  const input = element('input', { type: 'text', inputMode: 'url', className: 'answer-input', placeholder: 'Paste your Exchange link',
    ariaLabel: 'Your Exchange link', autocomplete: 'off' });
  const submit = element('button', { type: 'submit', className: 'chunky', textContent: 'Join' });
  const form = element('form', { className: 'join-form', noValidate: true }, input, submit);
  form.addEventListener('submit', (event) => { event.preventDefault(); tryJoin(input.value, BAD_LINK); });
  buttons.push(submit);

  const header = element('div', { className: 'join-row' },
    element('p', { className: 'join-label', textContent: '🎤 Got an Exchange link?' }));
  if (navigator.clipboard?.readText) {
    const paste = element('button', { type: 'button', className: 'chunky join-paste', textContent: '📋 Paste & Join' });
    paste.addEventListener('click', async () => {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch { /* denied: fall through to the manual box */ }
      if (!text) manual.open = true;
      tryJoin(text, text ? NO_LINK_COPIED : 'Couldn\'t read the clipboard. Paste your link below instead.');
    });
    buttons.push(paste);
    header.append(paste);
  }
  const manual = element('details', { className: 'exchange-join', open: Boolean(notice) || !navigator.clipboard?.readText },
    element('summary', { textContent: 'Paste it by hand' }), form);
  return element('div', {}, header, manual, status);
}
