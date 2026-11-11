// Lambda entry point: wires the handler to DynamoDB, S3 and Web Push using environment configuration and games.json.
import { existsSync, readFileSync } from 'node:fs';
import webpush from 'web-push';
import { createHandler } from './handler.mjs';
import { createMedia } from './media.mjs';
import { createPush } from './push.mjs';
import { createStore } from './store.mjs';

const env = process.env;
const gamesFile = new URL('../games.json', import.meta.url);
const games = existsSync(gamesFile) ? JSON.parse(readFileSync(gamesFile, 'utf8')) : {};

const store = createStore(env.TABLE);
const vapid = { publicKey: env.VAPID_PUBLIC, privateKey: env.VAPID_PRIVATE, subject: env.VAPID_SUBJECT };

export const handler = createHandler({
  store,
  media: createMedia(env.BUCKET),
  hashes: { joel: env.KEY_HASH_JOEL, nancy: env.KEY_HASH_NANCY },
  batch: { firstDay: env.FIRST_DAY, lastDay: env.LAST_DAY },
  games,
  push: createPush({ store, vapid, send: webpush.sendNotification.bind(webpush) }),
});
