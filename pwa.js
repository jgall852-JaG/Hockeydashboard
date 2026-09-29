const installButton = document.getElementById('installAppBtn');
const status = document.getElementById('pwaStatus');
let installPrompt = null;
let hadController = Boolean(navigator.serviceWorker?.controller);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton?.classList.remove('hidden');
  if (status) status.textContent = 'Installable';
});

installButton?.addEventListener('click', async () => {
  if (!installPrompt) return;
  installButton.disabled = true;
  try {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.classList.add('hidden');
  } catch (error) {
    console.error('Dashboard installation prompt failed', error);
    if (status) status.textContent = 'Installation was not completed; use the browser install menu';
  } finally {
    installButton.disabled = false;
  }
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton?.classList.add('hidden');
  if (status) status.textContent = 'Installed; offline app ready';
});

if (!('serviceWorker' in navigator)) {
  if (status) status.textContent = 'Offline app support unavailable in this browser';
} else if (!window.isSecureContext) {
  if (status) status.textContent = 'Open over HTTPS to enable offline install';
} else {
  const checkForUpdates = (registration) => registration.update().catch((error) => {
    console.error('Dashboard update check failed; cached app remains available', error);
    if (navigator.onLine && status) status.textContent = 'Update check failed; cached app remains available';
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });
  navigator.serviceWorker.register('./service-worker.js')
    .then((registration) => {
      if (status && !installPrompt) status.textContent = 'Offline app ready after first load';
      if (navigator.onLine) void checkForUpdates(registration);
      window.addEventListener('online', () => {
        void checkForUpdates(registration);
      });
    })
    .catch((error) => {
      console.error('Service worker registration failed', error);
      if (status) status.textContent = 'Offline app cache unavailable';
    });
}
