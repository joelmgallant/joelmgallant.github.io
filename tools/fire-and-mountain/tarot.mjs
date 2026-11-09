// Writes static/fire-and-mountain/tarot-links.json from lib/tarot-cards.mjs.
import { writeFileSync } from 'node:fs';
import { tarotLinks } from './lib/tarot-cards.mjs';

const outPath = new URL('../../static/fire-and-mountain/tarot-links.json', import.meta.url);
writeFileSync(outPath, `${JSON.stringify(tarotLinks(), null, 1)}\n`);
console.log(`wrote ${Object.keys(tarotLinks()).length} cards to static/fire-and-mountain/tarot-links.json`);
