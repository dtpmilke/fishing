/* Service worker: офлайн-кэш оболочки + приём пушей */
const CACHE = 'fh-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // кэшируем только свои файлы; тайлы и API всегда из сети
  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached),
    ),
  );
});

self.addEventListener('push', (e) => {
  let data = { title: 'Помощник рыболова', body: 'Проверьте прогноз клёва' };
  try {
    if (e.data) data = e.data.json();
  } catch (_) {
    /* пустой пуш */
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => {
      for (const c of cs) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    }),
  );
});
