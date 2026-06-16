// 교사 선교사 PWA 서비스 워커
const CACHE = 'gyosa-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// 네트워크 우선, 실패 시 캐시 (항상 최신 코드 유지)
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
