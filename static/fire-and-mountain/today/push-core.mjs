// Pure helpers for the notification bell. No DOM, so they can be tested in Node.

/**
 * on | off | denied | install (iPhone Safari: needs the home-screen app) | none (no push here).
 * features: { serviceWorker, pushManager, notification, ios, standalone, permission, subscribed }
 */
export function bellState({ serviceWorker, pushManager, notification, ios, standalone, permission, subscribed }) {
  if (!serviceWorker || !pushManager || !notification) return ios && !standalone ? 'install' : 'none';
  if (permission === 'denied') return 'denied';
  return permission === 'granted' && subscribed ? 'on' : 'off';
}

/** A base64url VAPID public key as the bytes pushManager.subscribe wants. */
export function keyBytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
