import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromeIntentUrl, isAndroidInAppBrowser, needsPaste, parseJoinKey, parsePastedLink, panelState, hostLine, pickRecordingType, scaledSize, nickname, otherName }
  from '../../../static/fire-and-mountain/today/exchange-core.mjs';

const KEY = 'a'.repeat(43);

test('parseJoinKey accepts a 43-character base64url key from the hash and rejects anything else', () => {
  assert.equal(parseJoinKey(`#join=${KEY}`), KEY);
  assert.equal(parseJoinKey(`#join=${'A1_-'.repeat(10)}abc`), `${'A1_-'.repeat(10)}abc`);
  assert.equal(parseJoinKey('#join=short'), null);
  assert.equal(parseJoinKey(`#other=${KEY}`), null);
  assert.equal(parseJoinKey(''), null);
});

test('parsePastedLink pulls the key out of a pasted invite link or a bare key', () => {
  assert.equal(parsePastedLink(`https://joelmgallant.com/fire-and-mountain/today/#join=${KEY}`), KEY);
  assert.equal(parsePastedLink(`  https://joelmgallant.com/fire-and-mountain/today/#join=${KEY}\n`), KEY);
  assert.equal(parsePastedLink(KEY), KEY);
  assert.equal(parsePastedLink('https://joelmgallant.com/fire-and-mountain/today/'), null);
  assert.equal(parsePastedLink(`#join=${KEY}extra`), null);
  assert.equal(parsePastedLink(''), null);
});

test('the link survives what messaging apps do to it', () => {
  const link = `https://joelmgallant.com/fire-and-mountain/today/#join=${KEY}`;
  assert.equal(parsePastedLink(`${link}.`), KEY, 'trailing period');
  assert.equal(parsePastedLink(`${link} 🙂`), KEY, 'trailing emoji');
  assert.equal(parsePastedLink(`Here is your new link: ${link} (only yours!)`), KEY, 'whole message copied');
  assert.equal(parsePastedLink(`${link}&fbclid=IwAR0abc`), KEY, 'tracking tag after the key');
  assert.equal(parsePastedLink(`https://l.facebook.com/l.php?u=${encodeURIComponent(link)}&h=AT0x`), KEY, 'facebook redirect');
  assert.equal(parsePastedLink('https://l.facebook.com/l.php?u=%ZZ'), null, 'malformed encoding');
  assert.equal(parseJoinKey(`#join=${KEY}&fbclid=IwAR0abc`), KEY, 'tapped link with a tracking tag');
  assert.equal(parseJoinKey(`#join%3D${KEY}`), KEY, 'tapped link with an encoded =');
  assert.equal(parseJoinKey(`#join=${KEY}x`), null, 'a longer key is still wrong');
});

const UA = {
  messenger: 'Mozilla/5.0 (Linux; Android 14; SM-S911W Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/480.0.0.40.109;]',
  facebook: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US;FBAV/400.0]',
  instagram: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 Instagram 350.0.0.0',
  androidChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneMessenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]',
};

test('isAndroidInAppBrowser spots Messenger, Facebook, Instagram and other Android webviews, not Chrome or iPhones', () => {
  for (const name of ['messenger', 'facebook', 'instagram']) assert.equal(isAndroidInAppBrowser(UA[name]), true, name);
  for (const name of ['androidChrome', 'iphone', 'iphoneMessenger']) assert.equal(isAndroidInAppBrowser(UA[name]), false, name);
});

test('chromeIntentUrl hands the exact link, #join included, to Chrome with the link itself as the fallback', () => {
  const link = `https://joelmgallant.com/fire-and-mountain/today/#join=${KEY}`;
  assert.equal(chromeIntentUrl(link),
    `intent://joelmgallant.com/fire-and-mountain/today/#join=${KEY}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(link)};end`);
});

test('needsPaste is true only for the iPhone home-screen app, which links cannot open', () => {
  assert.equal(needsPaste(UA.iphone, true), true);
  assert.equal(needsPaste(UA.iphone, false), false);
  assert.equal(needsPaste(UA.androidChrome, true), false);
  assert.equal(needsPaste(UA.androidChrome, false), false);
});

const response = (overrides) => ({ open: true, revealed: false, match: false, me: null, them: { answered: false }, ...overrides });

test('panelState covers every state of the panel', () => {
  assert.equal(panelState({ hasKey: false }), 'none');
  assert.equal(panelState({ hasKey: true, error: true }), 'offline');
  assert.equal(panelState({ hasKey: true, response: response() }), 'unanswered');
  assert.equal(panelState({ hasKey: true, response: response({ me: { text: 'x' } }) }), 'waiting');
  assert.equal(panelState({ hasKey: true, response: response({ open: false, revealed: true, me: { text: 'x' }, them: { answered: true, answer: { text: 'y' } } }) }), 'revealed');
  assert.equal(panelState({ hasKey: true, response: response({ open: false, revealed: true, me: { text: 'x' }, them: { answered: false } }) }), 'closed');
  assert.equal(panelState({ hasKey: true, response: response({ open: false, revealed: true, me: null, them: { answered: true, answer: { text: 'y' } } }) }), 'closed');
  assert.equal(panelState({ hasKey: true, response: response({ open: false }) }), 'closed');
});

test('names and nicknames', () => {
  assert.equal(nickname('joel'), 'Tiger');
  assert.equal(nickname('nancy'), 'Mountain');
  assert.equal(otherName('joel'), 'Nancy');
  assert.equal(otherName('nancy'), 'Joel');
});

test('hostLine is chosen per state, mentions the right people, and is stable for a date', () => {
  const waiting = hostLine('waiting', 'joel', '2026-11-20');
  assert.match(waiting, /Nancy/);
  assert.equal(waiting, hostLine('waiting', 'joel', '2026-11-20'));
  assert.match(hostLine('waiting', 'nancy', '2026-11-20'), /Joel/);
  for (const state of ['unanswered', 'waiting', 'revealed', 'match', 'closed']) {
    assert.ok(hostLine(state, 'joel', '2026-11-21').length > 5, state);
  }
});

test('pickRecordingType prefers webm/opus, falls back to mp4, else null', () => {
  assert.deepEqual(pickRecordingType((type) => type.startsWith('audio/webm')), { recorderType: 'audio/webm;codecs=opus', uploadType: 'audio/webm' });
  assert.deepEqual(pickRecordingType((type) => type.startsWith('audio/mp4')), { recorderType: 'audio/mp4', uploadType: 'audio/mp4' });
  assert.equal(pickRecordingType(() => false), null);
});

test('scaledSize fits the long side within the limit and never upscales', () => {
  assert.deepEqual(scaledSize(4032, 3024, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(scaledSize(3024, 4032, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(scaledSize(800, 600, 1600), { width: 800, height: 600 });
});
