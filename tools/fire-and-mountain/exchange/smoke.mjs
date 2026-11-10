// End-to-end check of the deployed API with two test keys, then removes its own data.
// Usage: node smoke.mjs <function-url> <test-keys.json> <YYYY-MM-DD open date>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const [url, keysPath, date] = process.argv.slice(2);
const keys = JSON.parse(readFileSync(keysPath, 'utf8'));
const base = url.replace(/\/$/, '');
const aws = (...args) => execFileSync('aws', ['--profile', 'personal', '--region', 'ca-central-1', ...args], { encoding: 'utf8' });

async function api(method, path, { person, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (person) headers.authorization = `Bearer ${keys[person].key}`;
  const response = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

async function upload(person, kind, contentType, bytes) {
  const form = await api('POST', `/upload?date=${date}&kind=${kind}`, { person, body: { contentType } });
  assert.equal(form.status, 200, `upload form ${kind}: ${form.text}`);
  const data = new FormData();
  for (const [name, value] of Object.entries(form.body.fields)) data.append(name, value);
  data.append('file', new Blob([bytes], { type: contentType }));
  const response = await fetch(form.body.url, { method: 'POST', body: data });
  return { key: form.body.key, status: response.status, text: await response.text() };
}

const step = (name) => console.log(`✔ ${name}`);
try {
  assert.equal((await api('GET', '/whoami')).status, 401); step('no key -> 401');
  assert.equal((await api('GET', '/whoami', { person: 'joel' })).body.person, 'joel'); step('whoami joel');

  const nancyPost = await api('PUT', `/exchange?date=${date}`, { person: 'nancy', body: { text: 'The Lantern' } });
  assert.equal(nancyPost.status, 200, nancyPost.text); step('nancy posts');

  const sealed = await api('GET', `/exchange?date=${date}`, { person: 'joel' });
  assert.equal(sealed.body.revealed, false);
  assert.deepEqual(sealed.body.them, { answered: true });
  assert.equal(sealed.text.includes('Lantern'), false); step('joel sees it sealed, without its text');

  const photoBytes = readFileSync(new URL('../../../static/fire-and-mountain/today/icons/icon-192.png', import.meta.url));
  const photo = await upload('joel', 'photo', 'image/jpeg', photoBytes);
  assert.equal(photo.status, 204, photo.text); step('photo uploaded via presigned POST');
  const audio = await upload('joel', 'audio', 'audio/webm', Buffer.from('fake-webm-audio'));
  assert.equal(audio.status, 204, audio.text); step('audio uploaded via presigned POST');
  const tooBig = await upload('joel', 'photo', 'image/jpeg', Buffer.alloc(5 * 1024 * 1024 + 10));
  assert.equal(tooBig.status, 400); assert.match(tooBig.text, /EntityTooLarge/); step('oversized photo rejected by S3');

  const joelPost = await api('PUT', `/exchange?date=${date}`, { person: 'joel',
    body: { text: 'lantern!', photoKey: photo.key, audioKey: audio.key, audioType: 'audio/webm' } });
  assert.equal(joelPost.body?.revealed, true, `joel post ${joelPost.status}: ${joelPost.text}`);
  assert.equal(joelPost.body.match, true);
  assert.equal(joelPost.body.them.answer.text, 'The Lantern'); step('both in -> revealed with match');

  const nancyView = await api('GET', `/exchange?date=${date}`, { person: 'nancy' });
  const photoFetch = await fetch(nancyView.body.them.answer.photoUrl);
  assert.equal(photoFetch.status, 200);
  assert.equal(Buffer.from(await photoFetch.arrayBuffer()).equals(photoBytes), true);
  assert.equal((await fetch(nancyView.body.them.answer.audioUrl)).status, 200); step('nancy fetches both media via signed links');

  assert.equal((await api('PUT', `/exchange?date=${date}`, { person: 'joel', body: { text: 'again' } })).status, 409); step('no edits after reveal');

  const nextDay = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const history = await api('GET', `/history?before=${nextDay}`, { person: 'joel' });
  assert.ok(history.body.days.some((day) => day.date === date)); step('history includes the revealed day');

  const allowed = await fetch(`${base}/whoami`, { method: 'OPTIONS', headers: { origin: 'https://joelmgallant.com', 'access-control-request-method': 'GET' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://joelmgallant.com');
  const denied = await fetch(`${base}/whoami`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null); step('CORS allows the site and refuses other origins');
  console.log('SMOKE OK');
} finally {
  aws('dynamodb', 'delete-item', '--table-name', 'fm-exchanges', '--key', JSON.stringify({ date: { S: date } }));
  aws('s3', 'rm', `s3://fm-exchange-media-622206739165/${date}/`, '--recursive', '--quiet');
  console.log(`cleaned up test data for ${date}`);
}
