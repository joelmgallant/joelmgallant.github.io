// Writes sky.json: real moon data for every date in the reading year.
// Usage: node sky.mjs [start] [end]   (defaults to the current batch)
import { writeFileSync } from 'node:fs';
import { dateRange, skyForDate } from './lib/sky-core.mjs';

const [start = '2026-11-10', end = '2027-11-09'] = process.argv.slice(2);
const sky = Object.fromEntries(dateRange(start, end).map((date) => [date, skyForDate(date)]));
const outPath = new URL('./sky.json', import.meta.url);
writeFileSync(outPath, `${JSON.stringify(sky, null, 1)}\n`);
console.log(`wrote ${Object.keys(sky).length} dates (${start} .. ${end}) to sky.json`);
