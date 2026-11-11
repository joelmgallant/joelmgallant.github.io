import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bellState, keyBytes } from '../../../static/fire-and-mountain/today/push-core.mjs';

const ready = { serviceWorker: true, pushManager: true, notification: true, ios: false, standalone: false };

test('bellState follows support, install state and permission', () => {
  assert.equal(bellState({ ...ready, permission: 'default', subscribed: false }), 'off');
  assert.equal(bellState({ ...ready, permission: 'granted', subscribed: true }), 'on');
  assert.equal(bellState({ ...ready, permission: 'granted', subscribed: false }), 'off');
  assert.equal(bellState({ ...ready, permission: 'denied', subscribed: false }), 'denied');
  assert.equal(bellState({ ...ready, pushManager: false, notification: false, ios: true, standalone: false }), 'install');
  assert.equal(bellState({ ...ready, pushManager: false, notification: false, ios: false }), 'none');
  assert.equal(bellState({ ...ready, pushManager: false, ios: true, standalone: true }), 'none');
});

test('keyBytes decodes a base64url VAPID key', () => {
  assert.deepEqual([...keyBytes('AQID_-8')], [1, 2, 3, 255, 239]);
  assert.equal(keyBytes('BAAA').length, 3);
});
