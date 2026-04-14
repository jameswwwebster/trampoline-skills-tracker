self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Trampoline Life', {
      body: data.body || '',
      icon: '/favicon-root.png',
      badge: '/favicon-root.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => 'focus' in c);
        if (existing) {
          existing.navigate(url);
          return existing.focus();
        }
        return clients.openWindow(url);
      })
  );
});
