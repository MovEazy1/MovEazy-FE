/*
 * The CRM's service worker (moveazy.co.in/crm, scope /crm/; registered by
 * src/pages/crm/mobile/crmInstall.js). Like partners-sw.js it caches nothing:
 * every request goes to the network, so a deploy is never held back. It only
 * answers a screen opened with no internet with a page saying so — which is
 * also what lets "MovEazy CRM" install on Android.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0E7C68"><title>MovEazy CRM</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;font-family:system-ui,-apple-system,sans-serif;color:#10221E;text-align:center}
main{padding:24px;max-width:320px}h1{font-size:20px;margin:0 0 8px}p{color:#475854;line-height:1.5;margin:0 0 20px}
button{border:0;border-radius:999px;background:#0E7C68;color:#fff;font:inherit;font-weight:700;font-size:15px;padding:13px 26px}</style></head>
<body><main><h1>You're offline</h1><p>MovEazy CRM needs the internet. Check your connection and try again.</p>
<button onclick="location.reload()">Try again</button></main></body></html>`;

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
