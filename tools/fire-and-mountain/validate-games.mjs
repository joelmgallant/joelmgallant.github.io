// Checks Bonus Round game files without writing anything.
// Usage: node tools/fire-and-mountain/validate-games.mjs 2026-11   (one month, plus repeats against every other month present)
//        node tools/fire-and-mountain/validate-games.mjs --year     (all months; every date must be covered)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gameYearChecks, validateGamesMonth } from './lib/game-content.mjs';

const here = (path) => new URL(path, import.meta.url);
const sky = JSON.parse(readFileSync(here('./sky.json'), 'utf8'));
const datesFor = (month) => Object.keys(sky).filter((date) => date.startsWith(month));
const load = (month) => JSON.parse(readFileSync(here(`./games/${month}.json`), 'utf8'));
const present = readdirSync(here('./games/')).filter((name) => /^\d{4}-\d{2}\.json$/.test(name)).map((name) => name.slice(0, 7));

const arg = process.argv[2];
const year = arg === '--year';
if (!year && !/^\d{4}-\d{2}$/.test(arg ?? '')) { console.error('usage: validate-games.mjs YYYY-MM | --year'); process.exit(2); }
const months = year ? [...new Set(Object.keys(sky).map((date) => date.slice(0, 7)))] : [arg];

const errors = [];
for (const month of months) {
  if (!existsSync(here(`./games/${month}.json`))) { errors.push(`${month}: missing games file`); continue; }
  errors.push(...validateGamesMonth(load(month), datesFor(month)));
}
const everything = present.flatMap((month) => load(month));
const repeats = gameYearChecks(everything).filter((line) => year || line.startsWith(arg));

for (const line of [...errors, ...repeats]) console.log(line);
console.log(`${year ? 'year' : arg}: ${errors.length} errors, ${repeats.length} repeats`);
process.exit(errors.length || repeats.length ? 1 : 0);
