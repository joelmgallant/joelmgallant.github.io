// Guest join box. Installed home-screen apps keep their own storage and can't open #join links,
// so a copied link is joined with one tap (clipboard), or pasted by hand as a fallback.
import { parsePastedLink } from './exchange-core.mjs';
import { element } from './exchange-ui.mjs';

export const BAD_LINK = "That link didn't work. Ask Joel for a fresh one.";
export const RESET_LINK = "This device's link was reset. Tap the new link Joel sent you, or paste it here.";
const NO_LINK_COPIED = 'No Exchange link on the clipboard. Copy your link first, then tap again.';

/** `join(key)` resolves to the joined identity or null; `onJoin` receives it. */
export function joinBox({ notice, join, onJoin }) {
  const status = element('p', { className: 'composer-status', textContent: notice ?? '', role: 'status' });
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

  const input = element('input', { type: 'url', className: 'answer-input', placeholder: 'Paste your Exchange link',
    ariaLabel: 'Your Exchange link', autocomplete: 'off' });
  const submit = element('button', { type: 'submit', className: 'chunky', textContent: 'Join' });
  const form = element('form', { className: 'join-form' }, input, submit);
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
