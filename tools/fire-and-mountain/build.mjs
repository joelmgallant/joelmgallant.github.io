// Validates months/YYYY-MM.json (subagent output), merges in sky data, and writes
// static/fire-and-mountain/today/data/YYYY-MM.json for every month that passes.
// Writes build-report.json. Exits 1 if anything fails.
// Usage: node build.mjs [--partial]   (--partial: skip year-wide checks while months are missing)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tarotLinks } from './lib/tarot-cards.mjs';
import { validateMonth, yearChecks } from './lib/validate.mjs';

const here = (path) => new URL(path, import.meta.url);
const sky = JSON.parse(readFileSync(here('./sky.json'), 'utf8'));
const cardNames = new Set(Object.keys(tarotLinks()));
const outDir = here('../../static/fire-and-mountain/today/data/');
mkdirSync(outDir, { recursive: true });

const datesByMonth = new Map();
for (const date of Object.keys(sky)) {
  const month = date.slice(0, 7);
  datesByMonth.set(month, [...(datesByMonth.get(month) ?? []), date]);
}

const report = { months: {}, year: [], flaggedDates: [] };
const passedEntries = [];
let failed = false;

for (const [month, dates] of datesByMonth) {
  const sourcePath = here(`./months/${month}.json`);
  if (!existsSync(sourcePath)) { report.months[month] = ['missing month file']; failed = true; continue; }
  let entries;
  try { entries = JSON.parse(readFileSync(sourcePath, 'utf8')); } catch (error) {
    report.months[month] = [`invalid JSON: ${error.message}`]; failed = true; continue;
  }
  const errors = Array.isArray(entries) ? validateMonth(entries, dates, cardNames) : ['file must be a JSON array'];
  report.months[month] = errors;
  if (errors.length) { failed = true; continue; }
  const merged = [...entries].sort((first, second) => first.date.localeCompare(second.date))
    .map(({ date, ...rest }) => ({ date, sky: sky[date], ...rest }));
  writeFileSync(new URL(`${month}.json`, outDir), `${JSON.stringify(merged)}\n`);
  passedEntries.push(...merged);
}

if (!process.argv.includes('--partial')) {
  const { errors, flaggedDates } = yearChecks(passedEntries);
  report.year = errors;
  report.flaggedDates = flaggedDates;
  if (errors.length) failed = true;
}

writeFileSync(here('./build-report.json'), `${JSON.stringify(report, null, 1)}\n`);
for (const [month, errors] of Object.entries(report.months)) {
  console.log(`${month}: ${errors.length ? `${errors.length} error(s)` : 'ok'}`);
}
console.log(`entries passing: ${passedEntries.length}/${Object.keys(sky).length}`);
if (report.year.length) console.log(`year checks: ${report.year.length} problem(s), ${report.flaggedDates.length} date(s) flagged`);
console.log(failed ? 'BUILD FAILED (see build-report.json)' : 'BUILD OK');
process.exit(failed ? 1 : 0);
