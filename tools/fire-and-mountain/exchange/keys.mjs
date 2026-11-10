// Generates a personal key and its SHA-256 hash. Prints JSON; never writes files.
// Usage: node keys.mjs <person>
import { randomBytes } from 'node:crypto';
import { hashKey } from './src/core.mjs';

const person = process.argv[2];
if (!['joel', 'nancy'].includes(person)) { console.error('usage: node keys.mjs joel|nancy'); process.exit(2); }
const key = randomBytes(32).toString('base64url');
console.log(JSON.stringify({
  person, hash: hashKey(key), link: `https://joelmgallant.com/fire-and-mountain/today/#join=${key}`, key,
}));
