// Original synthesized sound stings for The Exchange. Off by default; the toggle is per device.
const STORAGE_KEY = 'fm-exchange-sound';
let context = null;

export function soundEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; }
}

export function setSoundEnabled(enabled) {
  try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* private mode: stay silent */ }
}

function tone(frequency, start, duration, { type = 'square', volume = 0.08 } = {}) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(volume, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.02);
}

const STINGS = {
  lock: () => { tone(220, 0, 0.06, { type: 'square' }); tone(330, 0.05, 0.08, { type: 'square' }); },
  reveal: () => { [262, 330, 392, 523].forEach((note, index) => tone(note, index * 0.09, 0.22, { type: 'sawtooth', volume: 0.06 })); },
  match: () => {
    [523, 659, 784, 1047].forEach((note, index) => tone(note, index * 0.07, 0.3, { type: 'triangle', volume: 0.1 }));
    tone(1568, 0.32, 0.5, { type: 'sine', volume: 0.07 });
  },
  buzz: () => tone(110, 0, 0.25, { type: 'sawtooth', volume: 0.07 }),
};

export function playSting(name) {
  if (!soundEnabled() || !STINGS[name]) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume();
    STINGS[name]();
  } catch { /* audio unavailable: silently skip */ }
}
