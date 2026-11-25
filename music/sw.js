/* BODYBOX Music: keeps the page and the (locked) song files on the phone after the first play. */
const SHELL='bbm-shell-v13', SONGS='bbm-songs-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method !== 'GET') return;
  if(u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/music-files/')){
    e.respondWith(caches.open(SONGS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if(r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if(u.origin === location.origin && u.pathname.startsWith(new URL('./', self.registration.scope).pathname)){
    e.respondWith(fetch(e.request).then(r => { const cp=r.clone(); caches.open(SHELL).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
  }
});
