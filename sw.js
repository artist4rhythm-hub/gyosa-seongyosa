// 교사 선교사 PWA 서비스 워커
const CACHE = 'gyosa-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

/* 네트워크 우선, 실패 시 캐시
   · 화면(HTML)은 no-cache로 받아 브라우저 캐시(10분)를 건너뛰고
     서버에 «바뀌었나요?»를 물어본다 — 안 바뀌었으면 304라 가볍고,
     바뀌었으면 곧바로 새 코드가 온다 (업데이트 반영이 굼뜨던 문제 해결)
   · 그 밖의 파일은 지금처럼 네트워크 우선 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .catch(() => caches.match(req))
    );
    return;
  }
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
