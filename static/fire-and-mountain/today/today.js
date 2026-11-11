// Renders today's reading. Pure logic lives in today-core.mjs.
import { localIsoDate, resolveDay, dayFileName, tokenizeCards, isWaxing, moonPath, sigilPoints }
  from './today-core.mjs';
import { mountExchange } from './exchange.js';
import { mountGame } from './game.js';

const STONE_NAMES = { ruby: 'Ruby', onyx: 'Black onyx', pearl: 'Mother of pearl',
  'diamonds-stacked': 'Stacked diamonds', diamond: 'Diamond' };
const EMBLEM_NAMES = { 'fire-tiger': 'Fire Tiger', cabin: 'The cabin', 'wood-rat': 'Wood Rat', shore: 'The shore' };
const PEOPLE = [
  { key: 'joel', label: '🔥 Joel' },
  { key: 'nancy', label: '🏔️ Nancy', star: true },
];
const SVG_NS = 'http://www.w3.org/2000/svg';
const byId = (id) => document.getElementById(id);
const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

let tarotLinks = {};
let shownDate = null;

function fillText(element, text) {
  element.replaceChildren(...tokenizeCards(text, tarotLinks).map((part) => {
    if (part.type === 'text') return document.createTextNode(part.text);
    const link = document.createElement('a');
    link.className = 'tarot-link';
    link.href = part.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = part.name;
    return link;
  }));
}

function eightPointStar() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('class', 'star8');
  svg.setAttribute('aria-hidden', 'true');
  const points = ['10,0 12,8 10,10 8,8', '20,10 12,12 10,10 12,8', '10,20 8,12 10,10 12,12', '0,10 8,8 10,10 8,12',
    '17,3 12,9 10,10 11,8', '17,17 11,12 10,10 12,11', '3,17 8,11 10,10 9,12', '3,3 9,8 10,10 8,9'];
  points.forEach((shape, index) => {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', shape);
    polygon.setAttribute('class', index < 4 ? 'star8-main' : 'star8-diagonal');
    svg.append(polygon);
  });
  return svg;
}

function renderPerson({ key, label, star }, reading) {
  const card = byId('person-card').content.firstElementChild.cloneNode(true);
  card.classList.add(key);
  card.querySelector('.emblem').src = `img/emblem-${reading.emblem}.webp`;
  const who = card.querySelector('.who');
  if (star) who.append(eightPointStar());
  who.append(label);
  fillText(card.querySelector('.reading-1'), reading.reading[0]);
  fillText(card.querySelector('.reading-2'), reading.reading[1]);
  fillText(card.querySelector('.mission'), reading.mission);
  fillText(card.querySelector('.omen'), reading.omen);
  card.querySelector('.stone-image').src = `img/stone-${reading.stone}.webp`;
  card.querySelector('.stone-name').textContent = STONE_NAMES[reading.stone];
  card.querySelector('.stone-why').textContent = reading.stoneWhy;
  card.querySelector('.orb').classList.add(reading.element);
  card.querySelector('.element-name').textContent = capitalize(reading.element);
  card.querySelector('.element-why').textContent = reading.elementWhy;
  card.querySelector('.banner').title = EMBLEM_NAMES[reading.emblem];
  return card;
}

function renderSigil(isoDate) {
  const svg = byId('sigil');
  const points = sigilPoints(isoDate);
  const ring = document.createElementNS(SVG_NS, 'circle');
  Object.entries({ cx: 32, cy: 32, r: 30, class: 'sigil-ring' }).forEach(([name, value]) => ring.setAttribute(name, value));
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', points.map((point) => point.join(',')).join(' '));
  line.setAttribute('class', 'sigil-line');
  const stars = points.map(([x, y], index) => {
    const dot = document.createElementNS(SVG_NS, 'circle');
    Object.entries({ cx: x, cy: y, r: index % 3 === 0 ? 2.4 : 1.7, class: 'sigil-star' })
      .forEach(([name, value]) => dot.setAttribute(name, value));
    return dot;
  });
  svg.replaceChildren(ring, line, ...stars);
}

function renderEntry(entry) {
  const { sky } = entry;
  const [year, month, day] = entry.date.split('-').map(Number);
  byId('date').textContent = new Date(year, month - 1, day)
    .toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  byId('day-title').textContent = entry.title;

  const scene = byId('moon-scene');
  scene.src = `img/moon-${sky.phase}.webp`;
  scene.alt = `Airbrush painting of the coast under a ${sky.phaseName.toLowerCase()}`;
  const litPath = moonPath(sky.illumination, isWaxing(sky.phase));
  byId('moon-overlay').hidden = sky.phase === 'full';
  byId('moon-overlay-lit').setAttribute('d', litPath);
  byId('sky-moon-lit').setAttribute('d', litPath);
  renderSigil(entry.date);
  byId('des-seal').hidden = !entry.des;

  byId('sky-line').replaceChildren(
    Object.assign(document.createElement('b'), { textContent: sky.phaseName }),
    ` · Moon in ${sky.moonSign} · ${Math.round(sky.illumination * 100)}% lit`,
  );
  fillText(byId('sky-story'), entry.skyStory);
  byId('cards').replaceChildren(...PEOPLE.map((person) => renderPerson(person, entry[person.key])));

  byId('mood-image').src = `img/mood-${entry.together.mood}.webp`;
  byId('mood-label').textContent = `Together today · ${entry.together.mood}`;
  fillText(byId('together-text'), entry.together.text);
  mountExchange({ container: byId('exchange'), date: entry.date, prompt: entry.together.text })
    .catch((error) => console.warn('exchange unavailable', error));
  mountGame({ container: byId('bonus'), date: entry.date, game: entry.game });

  byId('status-box').hidden = true;
  byId('reading').hidden = false;
}

function showStatus(message, { retry = false } = {}) {
  byId('reading').hidden = true;
  byId('status').textContent = message;
  byId('retry').hidden = !retry;
  byId('status-box').hidden = false;
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function render() {
  const today = localIsoDate(new Date());
  shownDate = today;
  const day = resolveDay(today);
  if (day.status === 'after') {
    showStatus('The cards are being reshuffled for a new year… check back soon. 🔮');
    return;
  }
  try {
    const [links, entry] = await Promise.all([
      fetchJson('/fire-and-mountain/tarot-links.json'),
      fetchJson(`days/${await dayFileName(day.date)}`),
    ]);
    tarotLinks = links ?? {};
    if (!entry) { showStatus('The stars are quiet today. Try again a little later. ✨', { retry: true }); return; }
    renderEntry(entry);
  } catch (error) {
    console.warn('reading unavailable', error);
    showStatus('The stars are out of reach right now. Check your connection and try again. 🌙', { retry: true });
  }
}

byId('retry').addEventListener('click', render);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && localIsoDate(new Date()) !== shownDate) render();
});
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.warn('service worker not registered', error));
}
