// 교사 선교사 PWA 서비스 워커 — v3
// v2 문제: 「실패 시 캐시」라면서 캐시에 저장(put)을 안 해 캐시가 늘 비어 있었다.
//          로고·폰트·SDK를 페이지를 넘길 때마다 새로 받던 원인.
// v3 정책:
//   · 화면(HTML)     → 네트워크 우선 (no-cache: 바뀐 코드 즉시 반영) + 받으면 저장 → 실패(오프라인) 시 캐시
//   · 그림·글꼴·JS·SDK → 캐시 우선, 뒤에서 조용히 갱신 (두 번째부터 즉시 뜬다)
//   · Firestore 등 실시간 자료 → 손대지 않음 (항상 실서버)
const CACHE = 'gyosa-v4';   // v4: 굳은 캐시 전부 정리 + 흰 화면 자가 복구

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));   // 옛 캐시 정리
    await clients.claim();
  })());
});

// 캐시해도 되는 정적 자산인지
function isStatic(req){
  const u = new URL(req.url);
  // 실시간 자료·인증은 절대 캐시하지 않는다
  if (u.hostname.includes('firestore.googleapis')) return false;
  if (u.hostname.includes('identitytoolkit') || u.hostname.includes('securetoken')) return false;
  if (u.hostname === 'api.ipify.org') return false;
  // 우리 사이트의 정적 파일
  if (u.origin === self.location.origin)
    return /\.(png|jpg|jpeg|webp|svg|ico|js|css|json|woff2?)$/i.test(u.pathname);
  // 글꼴·Firebase SDK (CDN)
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return true;
  if (u.hostname === 'www.gstatic.com' && u.pathname.includes('firebasejs')) return true;
  if (u.hostname === 'cdnjs.cloudflare.com' || u.hostname === 'cdn.jsdelivr.net') return true;
  return false;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // ── 화면(HTML): 네트워크 우선 + 저장 → 오프라인이면 캐시 ──
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        // 정상 문서만 저장 — 깨진 응답이 캐시에 굳는 것을 막는다
        if (res && res.ok && !res.redirected && res.type === 'basic') {
          const c = await caches.open(CACHE);
          c.put(req, res.clone());
        }
        return res;
      } catch (_) {
        const hit = await caches.match(req);
        if (hit) return hit;
        // ⛑ 흰 화면 대신 — 스스로 고치는 안내 화면
        return new Response(`<!DOCTYPE html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;background:#F2F0EB;
  display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="background:#fff;border-radius:16px;padding:28px 26px;max-width:340px;text-align:center;
  box-shadow:0 4px 20px rgba(0,0,0,.08)">
<div style="font-size:34px">🔌</div>
<div style="font-weight:900;font-size:16px;margin:10px 0 6px;color:#0C2A44">페이지를 불러오지 못했어요</div>
<div style="font-size:12.5px;color:#5A6560;line-height:1.7">네트워크가 잠시 막혔거나<br>임시 저장이 꼬였을 수 있어요.</div>
<button onclick="location.reload()" style="margin-top:14px;width:100%;padding:12px;border:0;border-radius:10px;
  background:#0C2A44;color:#fff;font-weight:800;font-size:14px;font-family:inherit;cursor:pointer">🔄 다시 시도</button>
<button onclick="(async()=>{try{const rs=await navigator.serviceWorker.getRegistrations();for(const r of rs)await r.unregister();
  const ks=await caches.keys();for(const k of ks)await caches.delete(k);}catch(e){};location.reload()})()"
  style="margin-top:8px;width:100%;padding:11px;border:1.5px solid #E3E1DA;border-radius:10px;background:#fff;
  color:#5A6560;font-weight:700;font-size:12.5px;font-family:inherit;cursor:pointer">🧹 임시 저장 비우고 새로 열기</button>
</div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // ── 정적 자산: 캐시 우선 + 뒤에서 조용히 갱신 ──
  if (isStatic(req)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      const refresh = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(refresh); return hit; }   // 캐시에 있으면 즉시, 갱신은 뒤에서
      const res = await refresh;
      return res || caches.match(req) || Response.error();
    })());
    return;
  }

  // ── 그 밖(실시간 자료 등): 그대로 네트워크 ──
});
