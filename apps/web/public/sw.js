// Minimal Web Push service worker (ADR-0019 §6). Registered lazily only when
// the user opts in from /notifications/preferences — not on every page load.
self.addEventListener("push", (event) => {
  let payload = { title: "Examora", body: "" };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch {
    payload.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Examora", {
      body: payload.body ?? "",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(self.clients.openWindow(url));
});
