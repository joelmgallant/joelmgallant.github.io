// Keeps installed copies current: checks for a new service worker whenever the app comes to the
// foreground, and reloads once a new version takes over, but never while an answer is being written.
const hasDraft = () => [...document.querySelectorAll('.composer textarea, .composer input:not([type=file]), .guess-form input')]
  .some((field) => field.value.trim()) || Boolean(document.querySelector('.recording'));

export function watchForUpdates() {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let pendingReload = false;
  const reloadIfSafe = () => {
    if (!pendingReload) return;
    if (document.visibilityState === 'hidden' || !hasDraft()) { pendingReload = false; location.reload(); }
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install: the page is already current
    pendingReload = true;
    reloadIfSafe();
  });
  navigator.serviceWorker.register('sw.js').then((registration) => {
    document.addEventListener('visibilitychange', () => {
      reloadIfSafe();
      if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
    });
  }).catch((error) => console.warn('service worker not registered', error));
}
