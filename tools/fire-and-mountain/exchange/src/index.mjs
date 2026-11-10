// Lambda entry point: wires the handler to DynamoDB and S3 using environment configuration.
import { createHandler } from './handler.mjs';
import { createMedia } from './media.mjs';
import { createStore } from './store.mjs';

const env = process.env;

export const handler = createHandler({
  store: createStore(env.TABLE),
  media: createMedia(env.BUCKET),
  hashes: { joel: env.KEY_HASH_JOEL, nancy: env.KEY_HASH_NANCY },
  batch: { firstDay: env.FIRST_DAY, lastDay: env.LAST_DAY },
});
