// Lambda entry point: wires the handler to DynamoDB and S3 using environment configuration and games.json.
import { existsSync, readFileSync } from 'node:fs';
import { createHandler } from './handler.mjs';
import { createMedia } from './media.mjs';
import { createStore } from './store.mjs';

const env = process.env;
const gamesFile = new URL('../games.json', import.meta.url);
const games = existsSync(gamesFile) ? JSON.parse(readFileSync(gamesFile, 'utf8')) : {};

export const handler = createHandler({
  store: createStore(env.TABLE),
  media: createMedia(env.BUCKET),
  hashes: { joel: env.KEY_HASH_JOEL, nancy: env.KEY_HASH_NANCY },
  batch: { firstDay: env.FIRST_DAY, lastDay: env.LAST_DAY },
  games,
});
