// The Exchange: sealed daily answers between Joel and Nancy, revealed together quiz-show style.
import { createApi, ApiError } from './exchange-api.mjs';
import { createComposer } from './exchange-composer.mjs';
import { chromeIntentUrl, isAndroidInAppBrowser, needsPaste, parseJoinKey, panelState, hostLine, nickname, otherName } from './exchange-core.mjs';
import { NAMES, answerCard, element, plainPrompt } from './exchange-ui.mjs';
import { playSting, soundEnabled, setSoundEnabled } from './exchange-sounds.mjs';
import { dayFileName } from './today-core.mjs';
import { BAD_LINK, RESET_LINK, joinBox } from './exchange-join.mjs';
import { createBell } from './push-client.mjs';

const IDENTITY_KEY = 'fm-exchange-identity';
const SEEN_KEY = 'fm-exchange-seen-reveal';
const POLL_MS = 30_000;


function readStored(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

/** Tells the other panels (the Bonus Round) to remount with this identity. */
const announceJoin = (identity) => window.dispatchEvent(new CustomEvent('fm-exchange-joined', { detail: identity }));

async function joinWithKey(key) {
  try {
    const { person } = await createApi(key).whoami();
    const identity = { key, person };
    writeStored(IDENTITY_KEY, identity);
    announceJoin(identity);
    return { identity, notice: `Welcome, ${nickname(person)}. You're on the show. 🎤` };
  } catch {
    return null;
  }
}

async function joinFromHash() {
  const key = parseJoinKey(location.hash);
  if (!key) return { identity: readStored(IDENTITY_KEY), notice: null };
  history.replaceState(null, '', location.pathname + location.search);
  return (await joinWithKey(key)) ?? { identity: readStored(IDENTITY_KEY), notice: BAD_LINK };
}

let teardown = () => {};

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

/** Inside Messenger's (or another app's) browser on Android: send the link to Chrome, where the app's storage lives. */
function openInChrome(container) {
  const intent = chromeIntentUrl(location.href);
  container.hidden = false;
  container.classList.add('exchange-guest');
  container.replaceChildren(
    element('p', { className: 'join-label', textContent: '🎤 Almost there!' }),
    element('p', { className: 'composer-status', textContent: 'This link opened inside another app. Tap below to open it in Chrome, where your Fire & Mountain app lives.' }),
    element('a', { className: 'chunky', href: intent, textContent: 'Open in Chrome' }));
  location.href = intent; // most in-app browsers allow this; the button covers the rest
}

/** No usable key on this device: offer the join box, and pick up a key joined elsewhere (e.g. in Chrome) on return. */
function showGuest(args, notice) {
  const { container } = args;
  container.hidden = false;
  container.classList.add('exchange-guest');
  container.replaceChildren(joinBox({ notice, join: joinWithKey, canPaste: needsPaste(navigator.userAgent, standalone()),
    onJoin: (joinedNow) => mountExchange(args, joinedNow) }));
  const onReturn = () => {
    const identity = document.visibilityState === 'visible' && readStored(IDENTITY_KEY);
    if (!identity) return;
    mountExchange(args, { identity, notice: null });
    announceJoin(identity);
  };
  document.addEventListener('visibilitychange', onReturn);
  teardown = () => document.removeEventListener('visibilitychange', onReturn);
}

export async function mountExchange({ container, date, prompt }, joined = null) {
  teardown();
  if (!joined && parseJoinKey(location.hash) && isAndroidInAppBrowser(navigator.userAgent)) { openInChrome(container); return; }
  const { identity, notice } = joined ?? await joinFromHash();
  if (!identity) { showGuest({ container, date, prompt }, notice); return; }
  container.classList.remove('exchange-guest');
  const api = createApi(identity.key);
  const me = identity.person;
  let pollTimer = null;
  let editing = false;
  const bell = createBell(api);
  container.hidden = false;

  const header = () => {
    const toggle = element('button', { type: 'button', className: 'sound-toggle', textContent: soundEnabled() ? '🔊' : '🔇',
      title: 'Sound effects', ariaLabel: soundEnabled() ? 'Turn sound effects off' : 'Turn sound effects on' });
    toggle.addEventListener('click', () => { setSoundEnabled(!soundEnabled()); playSting('lock'); render(); });
    return element('div', { className: 'exchange-header' },
      element('h2', { className: 'exchange-title', textContent: '🎤 The Exchange' }),
      element('div', { className: 'header-tools' }, bell, toggle));
  };

  const promptBlock = () => element('p', { className: 'exchange-prompt', textContent: plainPrompt(prompt) });
  const host = (state) => element('p', { className: 'host-line', textContent: hostLine(state, me, date) });

  function stage(response) {
    const seen = readStored(SEEN_KEY) ?? [];
    const firstTime = !seen.includes(date);
    if (firstTime) { writeStored(SEEN_KEY, [...seen.slice(-40), date]); playSting(response.match ? 'match' : 'reveal'); }
    const cards = element('div', { className: 'reveal-cards' },
      answerCard(me, response.me, { label: `${NAMES[me]} (you)` }), answerCard(me === 'joel' ? 'nancy' : 'joel', response.them.answer));
    const stageNode = element('div', { className: `stage${firstTime ? ' animate' : ''}` },
      element('div', { className: 'spotlight', ariaHidden: 'true' }), cards);
    if (response.match) stageNode.append(element('div', { className: 'des-stamp', textContent: 'ΔΕΣ!', title: "Don't even scream" }));
    return stageNode;
  }

  async function scrapbook(list) {
    list.replaceChildren(element('p', { className: 'host-line', textContent: 'Rewinding the tapes…' }));
    try {
      const { days } = await api.history(date);
      if (!days.length) { list.replaceChildren(element('p', { className: 'host-line', textContent: 'No past rounds yet. Tomorrow, this becomes a scrapbook.' })); return; }
      const items = await Promise.all(days.map(async (day) => {
        const reading = await fetch(`days/${await dayFileName(day.date)}`).then((response) => (response.ok ? response.json() : null)).catch(() => null);
        const other = me === 'joel' ? 'nancy' : 'joel';
        return element('article', { className: 'scrap' },
          element('p', { className: 'scrap-date', textContent: `${day.date}${day.match ? '  ·  ΔΕΣ!' : ''}` }),
          reading ? element('p', { className: 'scrap-prompt', textContent: plainPrompt(reading.together.text) }) : null,
          element('div', { className: 'reveal-cards' }, answerCard(me, day.me, { label: NAMES[me] }), answerCard(other, day.them.answer)));
      }));
      list.replaceChildren(...items);
    } catch { list.replaceChildren(element('p', { className: 'host-line', textContent: "Couldn't load the tapes. Try again later." })); }
  }

  function footer() {
    const list = element('div', { className: 'scrapbook', hidden: true });
    const button = element('button', { type: 'button', className: 'chunky past', textContent: '📼 Past exchanges' });
    button.addEventListener('click', () => {
      list.hidden = !list.hidden;
      if (!list.hidden) scrapbook(list);
    });
    return element('div', { className: 'exchange-footer' }, button, list);
  }

  function schedulePoll(state) {
    clearInterval(pollTimer);
    if (state === 'waiting') pollTimer = setInterval(() => { if (document.visibilityState === 'visible') render(); }, POLL_MS);
  }

  function show(response, error = false) {
    const state = panelState({ hasKey: true, error, response });
    const body = [];
    if (state === 'offline') {
      const retry = element('button', { type: 'button', className: 'chunky', textContent: 'Retry' });
      retry.addEventListener('click', render);
      body.push(element('p', { className: 'host-line', textContent: 'Connect to play 📡' }), retry);
    } else if (state === 'unanswered' || editing) {
      body.push(host('unanswered'), promptBlock());
      if (!editing && response?.them?.answered) body.push(element('p', { className: 'sealed', textContent: `🔒 ${otherName(me)} has locked in. Your move.` }));
      body.push(createComposer({ api, date, existing: editing ? response.me : null,
        onSaved: (updated) => { editing = false; show(updated); },
        onCancel: editing ? () => { editing = false; show(response); } : null }));
    } else if (state === 'waiting') {
      const change = element('button', { type: 'button', className: 'mini', textContent: 'Change my answer' });
      change.addEventListener('click', () => { editing = true; show(response); });
      body.push(host('waiting'), promptBlock(), answerCard(me, response.me, { label: 'Your locked-in answer' }), change,
        element('p', { className: 'sealed', textContent: response.them.answered ? `🔒 ${otherName(me)} has answered. Sealed until you're both in.` : `🔒 ${otherName(me)} hasn't answered yet.` }));
    } else if (state === 'revealed') {
      body.push(host(response.match ? 'match' : 'revealed'), promptBlock(), stage(response));
    } else {
      body.push(host('closed'), promptBlock(), element('div', { className: 'reveal-cards' },
        answerCard(me, response?.me, { label: NAMES[me] }), answerCard(me === 'joel' ? 'nancy' : 'joel', response?.them?.answer)));
    }
    container.replaceChildren(header(), ...(notice ? [element('p', { className: 'exchange-notice', textContent: notice })] : []), ...body, footer());
    schedulePoll(editing ? 'editing' : state);
  }

  async function render() {
    if (editing) return;
    try { show(await api.get(date)); } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // The key was reissued: forget it and offer the join box so a new link can be tapped or pasted.
        try { localStorage.removeItem(IDENTITY_KEY); } catch { /* private mode */ }
        teardown();
        showGuest({ container, date, prompt }, RESET_LINK);
        return;
      }
      show(null, true);
    }
  }

  const onVisible = () => { if (document.visibilityState === 'visible') render(); };
  document.addEventListener('visibilitychange', onVisible);
  teardown = () => { clearInterval(pollTimer); document.removeEventListener('visibilitychange', onVisible); };
  await render();
}
