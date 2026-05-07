self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'MIRA', {
      body:    data.body ?? '',
      icon:    '/icon.svg',
      badge:   '/icon.svg',
      vibrate: [200, 100, 200],
      data:    { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      const target = event.notification.data?.url ?? '/';
      if (existing) return existing.navigate(target).then(c => c.focus());
      return clients.openWindow(target);
    })
  );
});
