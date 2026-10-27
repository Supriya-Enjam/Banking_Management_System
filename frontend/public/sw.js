
self.addEventListener("push", (event) => {
  let data = {
    title: "VaultBank",
    body: "You have a new message from a colleague.",
    url: "/",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      // Keep the safe default notification.
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "vaultbank-chat-message",
      data: {
        url: data.url || "/",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  console.log(
    "Windows notification clicked:",
    event.notification.data?.url
  );

  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an existing VaultBank window and navigate to the target.
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          await client.navigate(targetUrl);
          return;
        }
      }

      // Open VaultBank if no existing window is available.
      await self.clients.openWindow(targetUrl);
    })()
  );
});
