// 교사 선교사 PWA 서비스 워커 — v3
// v2 문제: 「실패 시 캐시」라면서 캐시에 저장(put)을 안 해 캐시가 늘 비어 있었다.
//          로고·폰트·SDK를 페이지를 넘길 때마다 새로 받던 원인.
// v3 정책:
//   · 화면(HTML)     → 네트워크 우선 (no-cache: 바뀐 코드 즉시 반영) + 받으면 저장 → 실패(오프라인) 시 캐시
//   · 그림·글꼴·JS·SDK → 캐시 우선, 뒤에서 조용히 갱신 (두 번째부터 즉시 뜬다)
//   · Firestore 등 실시간 자료 → 손대지 않음 (항상 실서버)
const CACHE = 'gyosa-v6';
/* ⚡ v180 우리 사이트 코드(JS · CSS · JSON) — «버전 확인 + 저장본» (패드 · 폰에서 화면이 늦게 뜨던 것)
   예전(v5~): 화면을 열 때마다 코드 파일 10~20개를 하나씩 서버에 «바뀌었나요?» 물어본 뒤에야 그렸다 (파일이 서로를 부르면 그만큼 줄줄이 기다림)
   이제: 화면(HTML)을 받을 때 version.json 을 한 번 함께 확인 —
         · 버전이 그대로면 코드 파일은 저장본을 바로 씀 (묻지 않음 → 두 번째부터 즉시)
         · 버전이 바뀌었으면 저장본을 통째로 비우고 새로 받음 → «새 화면 + 옛 부품» 섞임(백지)은 예전처럼 생기지 않음
         · 확인을 못 하면(인터넷이 약함) 예전처럼 하나씩 물어봄 */
//         · 저장본을 쓴 뒤에는 뒤에서 조용히 한 번 확인해 바뀐 파일만 고쳐 둠 (다음 번에 반영 — 예전처럼 저절로 낫게)
const CODE = 'gyosa-code';
let TRUST = null;          // null = 아직 모름(서비스 워커가 다시 깨어남) · true = 이번 버전 확인됨 · false = 확인 못 함
const REVAL = new Map();   // 파일마다 마지막으로 서버에 물어본 때 (15초 안에는 거듭 묻지 않게)   // v6 (v166): 로고(logo-jihyebit.png)가 그루터기로 바뀜 — 그림은 캐시 우선이라 옛 보라 로고가 남지 않게 한 번 비움
//   // v5: 우리 사이트 JS·CSS·JSON도 네트워크 우선 — 업데이트 직후 «새 화면+옛 부품» 혼합(백지 원인) 원천 차단

/* 🔔 v134 — 알림(푸시)도 이 서비스 워커가 받는다.
   예전: 알림을 켤 때는 firebase-messaging-sw.js 를, 화면을 열 때마다 이 sw.js 를 «같은 자리(범위)»에 등록해서
         화면을 한 번 열면 알림 받는 부분이 이 파일로 바뀌었다 — 이 파일에는 푸시를 받는 곳이 없어
         휴대폰 · 컴퓨터 알림이 뜨지 않았다(크롬은 «백그라운드에서 업데이트됨» 알림, 아이폰은 구독이 끊길 수 있음).
   이제: 알림 받는 부분을 여기로 불러와 어느 쪽이 등록돼 있어도 알림이 뜬다 (못 불러와도 화면 저장 기능은 그대로). */
try { importScripts('firebase-messaging-sw.js'); } catch (e) { /* 연결이 끊긴 채 설치될 때 등 — 다음 업데이트 때 다시 */ }

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== CODE).map(k => caches.delete(k)));   // 옛 캐시 정리 (⚡ v180 코드 저장본은 버전으로 따로 관리)
    // ⚡ v180 예전(v5~v6)에 그림 저장소(CACHE)에 넣어 둔 코드 파일은 지움 — 이제 코드는 CODE 에만 (얼어붙은 옛 부품이 남지 않게)
    try {
      const c = await caches.open(CACHE);
      for (const r of await c.keys()) {
        const u = new URL(r.url);
        if (u.origin === self.location.origin && /\.(js|css|json)$/i.test(u.pathname)) await c.delete(r);
      }
    } catch (_) {}
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
    return /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(u.pathname);   // js·css·json은 아래 «코드 파일» 분기로
  // 글꼴·Firebase SDK (CDN)
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return true;
  if (u.hostname === 'www.gstatic.com' && u.pathname.includes('firebasejs')) return true;
  if (u.hostname === 'cdnjs.cloudflare.com' || u.hostname === 'cdn.jsdelivr.net') return true;
  return false;
}

async function codeVer(){
  try { const c = await caches.open(CODE); const r = await c.match('__ver__'); return r ? await r.text() : ''; } catch (_) { return ''; }
}
// 다시 깨어났을 때 — 마지막 확인이 성공했고(«__unsure__» 없음) 버전 이름이 있으면 그 저장본을 믿음
async function codeTrusted(){
  try { const c = await caches.open(CODE); return !!(await c.match('__ver__')) && !(await c.match('__unsure__')); } catch (_) { return false; }
}
async function syncVer(){
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const tm = setTimeout(() => { try { ctl && ctl.abort(); } catch (_) {} }, 2500);
  try {
    // 화면(HTML)과 같은 길로 묻는다 (cache:'no-cache' · 주소 그대로) — 화면 · 버전 · 부품이 서버의 같은 판에서 오게
    const r = await fetch('version.json', { cache: 'no-cache', signal: ctl ? ctl.signal : undefined });
    if (!r.ok) throw new Error('ver ' + r.status);
    const j = await r.json(); const v = String((j && j.v) || '');
    if (!v) throw new Error('no ver');
    if ((await codeVer()) !== v) {
      await caches.delete(CODE);
      const c = await caches.open(CODE);
      await c.put('__ver__', new Response(v, { headers: { 'Content-Type': 'text/plain' } }));
      REVAL.clear();
    } else {
      const c = await caches.open(CODE); await c.delete('__unsure__');
    }
    TRUST = true;
  } catch (_) {
    TRUST = false;
    try { const c = await caches.open(CODE); await c.put('__unsure__', new Response('1')); } catch (__) {}
  }
  finally { clearTimeout(tm); }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // ── 화면(HTML): 네트워크 우선 + 저장 → 오프라인이면 캐시 ──
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      const ver = syncVer();   // ⚡ v180 화면과 함께 버전 확인 (둘 다 받은 뒤 화면을 넘겨서, 그 화면의 코드는 확인된 버전으로)
      try {
        const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        await ver;
        // 정상 문서만 저장 — 깨진 응답이 캐시에 굳는 것을 막는다
        if (res && res.ok && !res.redirected && res.type === 'basic') {
          const c = await caches.open(CACHE);
          c.put(req, res.clone());
        }
        return res;
      } catch (_) {
        await ver;
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

  // ── 코드 파일(우리 사이트 JS·CSS·JSON): 네트워크 우선 + 저장 → 오프라인이면 캐시 ──
  //    HTML은 새것인데 JS는 옛 캐시가 나가는 «혼합 상태»가 업데이트 직후 백지의 주범이었다.
  const cu = new URL(req.url);
  if (cu.origin === self.location.origin && /\.(js|css|json)$/i.test(cu.pathname) && !/\/(version\.json|sw\.js|firebase-messaging-sw\.js)$/i.test(cu.pathname)) {
    e.respondWith((async () => {
      if (TRUST === null) TRUST = await codeTrusted();   // 다시 깨어났으면 — 마지막으로 확인한 버전의 저장본을 믿음 (그 화면이 그 버전이라)
      const c = await caches.open(CODE);
      if (TRUST) {
        const hit = await c.match(req);
        if (hit) {                                         // ⚡ 버전이 그대로 — 묻지 않고 바로
          if (Date.now() - (REVAL.get(req.url) || 0) > 15000) {   // 뒤에서 한 번 확인 — 바뀌었으면 고쳐 둠 (다음 번에 반영)
            REVAL.set(req.url, Date.now());
            e.waitUntil(fetch(req, { cache: 'no-cache' }).then(res => { if (res && res.ok && res.type === 'basic') return c.put(req, res); }).catch(() => {}));
          }
          return hit;
        }
      }
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok && res.type === 'basic') { c.put(req, res.clone()); REVAL.set(req.url, Date.now()); }
        return res;
      } catch (_) {
        const hit = await c.match(req);                    // 인터넷이 끊겼을 때 — 코드 저장본에서만
        return hit || Response.error();
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
