// The Exchange: sealed daily answers between Joel and Nancy, revealed together quiz-show style.
import { createApi, ApiError } from './exchange-api.mjs';
import { createComposer } from './exchange-composer.mjs';
import { parseJoinKey, panelState, hostLine, nickname, otherName } from './exchange-core.mjs';
import { NAMES, answerCard, element, plainPrompt } from './exchange-ui.mjs';
import { playSting, soundEnabled, setSoundEnabled } from './exchange-sounds.mjs';
import { dayFileName } from './today-core.mjs';
import { BAD_LINK, joinBox } from './exchange-join.mjs';
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

async function joinWithKey(key) {
  try {
    const { person } = await createApi(key).whoami();
    const identity = { key, person };
    writeStored(IDENTITY_KEY, identity);
    window.dispatchEvent(new CustomEvent('fm-exchange-joined', { detail: identity }));
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

export async function mountExchange({ container, date, prompt }, joined = null) {
  teardown();
  const { identity, notice } = joined ?? await joinFromHash();
  if (!identity) {
    container.hidden = false;
    container.classList.add('exchange-guest');
    container.replaceChildren(joinBox({ notice, join: joinWithKey,
      onJoin: (joinedNow) => mountExchange({ container, date, prompt }, joinedNow) }));
    return;
  }
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
        container.replaceChildren(element('p', { className: 'exchange-notice', textContent: "This device's link stopped working. Ask Joel for a fresh one." }));
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
