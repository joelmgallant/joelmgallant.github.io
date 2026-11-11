// Validates months/YYYY-MM.json and games/YYYY-MM.json (subagent output), merges in sky data and the
// public half of each game, and writes one hashed file per day into static/fire-and-mountain/today/days/
// plus the secret half of the games to exchange/games.json (only when everything passes, so the site
// never gets a partial year). Writes build-report.json. Exits 1 on failure.
// Usage: node build.mjs [--partial]   (--partial: skip year-wide checks while months are missing)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dayFileName } from '../../static/fire-and-mountain/today/today-core.mjs';
import { tarotLinks } from './lib/tarot-cards.mjs';
import { gameYearChecks, validateGamesMonth } from './lib/game-content.mjs';
import { validateMonth, yearChecks } from './lib/validate.mjs';

const here = (path) => new URL(path, import.meta.url);
const sky = JSON.parse(readFileSync(here('./sky.json'), 'utf8'));
const cardNames = new Set(Object.keys(tarotLinks()));
const outDir = here('../../static/fire-and-mountain/today/days/');

const datesByMonth = new Map();
for (const date of Object.keys(sky)) {
  const month = date.slice(0, 7);
  datesByMonth.set(month, [...(datesByMonth.get(month) ?? []), date]);
}

const report = { months: {}, year: [], flaggedDates: [] };
const allGames = [];
const publicGame = ({ secret, source, ...rest }) => rest;
const secretGame = ({ type, secret, options }) => ({ type, ...(secret ? { secret } : {}), ...(options ? { optionCount: options.length } : {}) });
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
  const gamesPath = here(`./games/${month}.json`);
  const games = existsSync(gamesPath) ? JSON.parse(readFileSync(gamesPath, 'utf8')) : [];
  const gameErrors = validateGamesMonth(games, dates);
  if (gameErrors.length) { report.months[month] = gameErrors; failed = true; continue; }
  const gameByDate = new Map(games.map(({ date, game }) => [date, game]));
  allGames.push(...games);
  const merged = [...entries].sort((first, second) => first.date.localeCompare(second.date))
    .map(({ date, ...rest }) => ({ date, sky: sky[date], ...rest, game: publicGame(gameByDate.get(date)) }));
  passedEntries.push(...merged);
}

if (!process.argv.includes('--partial')) {
  const { errors, flaggedDates } = yearChecks(passedEntries);
  report.year = [...errors, ...gameYearChecks(allGames)];
  report.flaggedDates = flaggedDates;
  if (report.year.length) failed = true;
}

if (!failed) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const entry of passedEntries) {
    writeFileSync(new URL(await dayFileName(entry.date), outDir), `${JSON.stringify(entry)}\n`);
  }
  const secrets = Object.fromEntries(allGames.map(({ date, game }) => [date, secretGame(game)]));
  writeFileSync(here('./exchange/games.json'), `${JSON.stringify(secrets, null, 1)}\n`);
  console.log(`wrote ${passedEntries.length} day files to static/fire-and-mountain/today/days/ and ${allGames.length} games to exchange/games.json`);
}

writeFileSync(here('./build-report.json'), `${JSON.stringify(report, null, 1)}\n`);
for (const [month, errors] of Object.entries(report.months)) {
  console.log(`${month}: ${errors.length ? `${errors.length} error(s)` : 'ok'}`);
}
console.log(`entries passing: ${passedEntries.length}/${Object.keys(sky).length}`);
if (report.year.length) console.log(`year checks: ${report.year.length} problem(s), ${report.flaggedDates.length} date(s) flagged`);
console.log(failed ? 'BUILD FAILED (see build-report.json)' : 'BUILD OK');
process.exit(failed ? 1 : 0);
