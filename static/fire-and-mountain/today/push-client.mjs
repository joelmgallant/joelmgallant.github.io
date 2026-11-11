// The 🔔 bell in the Exchange header: opt in or out of nudges when it's the other person's move.
import { element } from './exchange-ui.mjs';
import { bellState, keyBytes } from './push-core.mjs';

const LABELS = {
  on: ['🔔', 'Notifications are on. Tap to turn them off.'],
  off: ['🔕', 'Tap to get a nudge when it is your move.'],
  denied: ['🔕', 'Notifications are blocked for this site. Allow them in your phone settings, then tap again.'],
  install: ['🔕', 'On iPhone: Share → Add to Home Screen, then open the app from there to turn on notifications.'],
};

function features(subscribed) {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return {
    serviceWorker: 'serviceWorker' in navigator, pushManager: 'PushManager' in window, notification: 'Notification' in window,
    ios, standalone: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
    permission: 'Notification' in window ? Notification.permission : 'default', subscribed,
  };
}

async function currentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Returns the bell node. It keeps its own state, so the header can re-append it on every render. */
export function createBell(api) {
  const button = element('button', { type: 'button', className: 'sound-toggle push-toggle' });
  const hint = element('p', { className: 'push-hint', hidden: true });
  const bell = element('span', { className: 'push-bell' }, button, hint);
  let state = bellState(features(false));
  let busy = false;

  const paint = () => {
    bell.hidden = state === 'none';
    const [icon, title] = LABELS[state] ?? LABELS.off;
    button.textContent = icon;
    button.title = title;
    button.ariaLabel = title;
    button.ariaPressed = String(state === 'on');
  };
  const say = (text) => { hint.textContent = text; hint.hidden = !text; };

  async function turnOn() {
    const permission = await Notification.requestPermission(); // first await, so iOS still sees the tap
    if (permission !== 'granted') {
      state = permission === 'denied' ? 'denied' : 'off';
      say(state === 'denied' ? LABELS.denied[1] : 'No problem. Tap the bell any time to turn nudges on.');
      return;
    }
    const [{ publicKey }, registration] = await Promise.all([api.pushKey(), navigator.serviceWorker.ready]);
    if (!publicKey) throw new Error('notifications are not set up yet');
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    await api.subscribe(subscription.toJSON());
    state = 'on';
    say("You're on. We'll nudge you when it's your move. 🔔");
  }

  async function turnOff() {
    const subscription = await currentSubscription();
    if (subscription) {
      await api.unsubscribe(subscription.endpoint).catch(() => undefined);
      await subscription.unsubscribe();
    }
    state = 'off';
    say('Notifications off.');
  }

  button.addEventListener('click', async () => {
    if (busy) return;
    if (state === 'install' || state === 'denied') { say(hint.hidden ? LABELS[state][1] : ''); return; }
    busy = true;
    say('');
    try { await (state === 'on' ? turnOff() : turnOn()); } catch (error) {
      say(`Couldn't change notifications: ${error.message}`);
    } finally { busy = false; paint(); }
  });

  // On open: reflect an existing subscription and re-send it, so the server always has the current one.
  currentSubscription().then(async (subscription) => {
    state = bellState(features(Boolean(subscription)));
    paint();
    if (subscription && state === 'on') await api.subscribe(subscription.toJSON()).catch(() => undefined);
  }).catch(() => undefined);

  paint();
  return bell;
}
