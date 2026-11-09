// Writes review.html: every day of the batch on one page, for proofreading. Not published.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const here = (path) => new URL(path, import.meta.url);
const sky = JSON.parse(readFileSync(here('./sky.json'), 'utf8'));
const months = [...new Set(Object.keys(sky).map((date) => date.slice(0, 7)))];
const escape = (text) => String(text).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
const prose = (text) => escape(text).replace(/\[\[([^\]]+)\]\]/g, '<u>$1</u>');

function person(name, card) {
  return `<div class="person"><h3>${name} <small>${card.emblem} · ${card.stone} (${escape(card.stoneWhy)}) · ${card.element} (${escape(card.elementWhy)})</small></h3>
    <p>${prose(card.reading[0])}</p><p>${prose(card.reading[1])}</p>
    <p><b>Mission:</b> ${prose(card.mission)}</p><p><b>Watch for:</b> ${prose(card.omen)}</p></div>`;
}

const days = months.flatMap((month) => {
  const path = here(`../../static/fire-and-mountain/today/data/${month}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
});

const body = days.map((entry) => `<section id="d${entry.date}" class="${entry.des ? 'des' : ''}">
  <h2>${entry.date} · ${escape(entry.title)} ${entry.des ? '<span class="seal">ΔΕΣ</span>' : ''}</h2>
  <p class="meta">${entry.sky.phaseName} · Moon in ${entry.sky.moonSign} · ${Math.round(entry.sky.illumination * 100)}% · mood: ${entry.together.mood}</p>
  <p class="story">${prose(entry.skyStory)}</p>
  <div class="people">${person('🔥 Joel', entry.joel)}${person('🏔️ Nancy', entry.nancy)}</div>
  <p class="together"><b>Together:</b> ${prose(entry.together.text)}</p>
</section>`).join('\n');

const index = days.map((entry) => `<a href="#d${entry.date}">${entry.date.slice(5)}</a>`).join(' ');

writeFileSync(here('./review.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Daily Reading Review</title>
<style>
  body { font: 16px/1.5 Georgia, serif; max-width: 1100px; margin: 0 auto; padding: 16px; background: #fbf7f2; color: #222; }
  nav { font: 12px/2 system-ui, sans-serif; position: sticky; top: 0; background: #fbf7f2; padding: 6px 0; border-bottom: 1px solid #ddd; max-height: 6em; overflow: auto; }
  nav a { color: #8a3b5c; margin-right: 4px; }
  section { border-bottom: 1px solid #ddd; padding: 14px 0; }
  section.des { background: #fff6dc; }
  h2 { font-size: 1.1rem; margin: 0; } h3 { font-size: 1rem; margin: 0 0 4px; } h3 small { font: 12px system-ui, sans-serif; color: #777; }
  .meta { font: 12px system-ui, sans-serif; color: #777; margin: 2px 0 8px; }
  .story { font-style: italic; } .people { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .seal { font: bold 12px system-ui; background: #f2c46d; padding: 2px 6px; border-radius: 8px; }
  u { text-decoration: underline dotted #b07d1a; }
  @media (max-width: 700px) { .people { grid-template-columns: 1fr; } }
</style></head><body>
<h1>Daily Reading Review (${days.length} days)</h1><nav>${index}</nav>
${body}
</body></html>
`);
console.log(`wrote review.html with ${days.length} days`);
