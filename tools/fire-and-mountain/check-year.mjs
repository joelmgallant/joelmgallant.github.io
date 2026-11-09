// Read-only cross-year repetition check over months/*.json. Writes nothing.
// Usage: node tools/fire-and-mountain/check-year.mjs [YYYY-MM ...]   (limit output to those months)
import { readdirSync, readFileSync } from 'node:fs';
import { yearChecks } from './lib/validate.mjs';

const dir = new URL('./months/', import.meta.url);
const entries = readdirSync(dir).filter((name) => /^\d{4}-\d{2}\.json$/.test(name))
  .flatMap((name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8')));
const { errors } = yearChecks(entries, { desMin: 0, desMax: 999 });
const months = process.argv.slice(2);
const relevant = months.length ? errors.filter((line) => months.includes(line.slice(0, 7))) : errors;
for (const line of relevant) console.log(line);
console.log(`${relevant.length} cross-year repeat(s)${months.length ? ` in ${months.join(', ')}` : ''}`);
process.exit(relevant.length ? 1 : 0);
