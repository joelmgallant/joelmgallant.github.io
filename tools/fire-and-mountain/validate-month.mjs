// Checks one subagent month file without writing anything.
// Usage: node tools/fire-and-mountain/validate-month.mjs 2026-11
import { readFileSync } from 'node:fs';
import { tarotLinks } from './lib/tarot-cards.mjs';
import { validateMonth, yearChecks } from './lib/validate.mjs';

const month = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(month ?? '')) { console.error('usage: validate-month.mjs YYYY-MM'); process.exit(2); }

const sky = JSON.parse(readFileSync(new URL('./sky.json', import.meta.url), 'utf8'));
const dates = Object.keys(sky).filter((date) => date.startsWith(month));
const entries = JSON.parse(readFileSync(new URL(`./months/${month}.json`, import.meta.url), 'utf8'));
const errors = validateMonth(entries, dates, new Set(Object.keys(tarotLinks())));
const repeats = yearChecks(entries, { desMin: 0, desMax: 99 }).errors;
const desDays = entries.filter((entry) => entry.des === true).length;

for (const line of [...errors, ...repeats]) console.log(line);
console.log(`${month}: ${entries.length}/${dates.length} entries, ${desDays} DES days, ${errors.length} errors, ${repeats.length} repeats within the month`);
process.exit(errors.length || repeats.length ? 1 : 0);
