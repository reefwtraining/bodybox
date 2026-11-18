/* BODYBOX Admin service worker: lets the admin page install as an app. Always loads fresh from the network. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { if(e.request.method === 'GET' && e.request.mode === 'navigate') e.respondWith(fetch(e.request).catch(() => new Response('<h1 style="font-family:sans-serif">No connection. Try again when you are back online.</h1>', { headers: { 'Content-Type': 'text/html' } }))); });
