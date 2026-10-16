/* ═══════════════════════════════════════════════
   live-push.js — 🔔 v131 앱을 열어 둔 동안 온 알림을 화면 위 «알림 띠»로
   · 앱(또는 탭)이 화면에 떠 있으면 FCM은 휴대폰 · 컴퓨터 알림을 띄우지 않고 열린 화면에 넘긴다.
     예전에는 받는 곳이 없어 그대로 사라졌다 → 여기서 받아 띠로 보여 준다.
   · 이 기기에서 «🔔 알림 켜기»를 한 사람만 (sidebar.js 가 localStorage staff_push_on 을 보고 불러옴)
   · Firestore 읽기는 하나도 늘지 않는다 (푸시로 온 글자만 쓴다). 띠가 뜨면 사이드바 숫자만 다시 센다.
   · 쪽지 내용은 글자(textContent)로만 넣는다 — HTML로 해석하지 않음
   ═══════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';

const MAX = 3;            // 한 번에 보이는 띠 수 (넘치면 오래된 것부터 닫힘)
const LIFE = 9000;        // 9초 뒤 저절로 닫힘 (마우스를 올리거나 누르고 있으면 기다림)
const KIND = {
  msg:      { l: '쪽지',      c: 'var(--sb-green,#00704A)' },
  approval: { l: '결재 요청', c: 'var(--purple-tx,#6D28D9)' },
  result:   { l: '결재 결과', c: 'var(--info,#2563EB)' },
  pay:      { l: '경비',      c: 'var(--gold,#B08D3C)' },
  board:    { l: '게시판',    c: 'var(--sb-green,#00704A)' },
  etc:      { l: '알림',      c: 'var(--sb-green,#00704A)' },
};

function kindOf(d, title){
  const k = String(d.kind || '');
  if(k === 'msg') return 'msg';
  if(k === 'approval') return 'approval';
  if(k === 'approval_result') return 'result';
  if(k === 'pay') return 'pay';
  if(k === 'board') return 'board';
  if(/^✉️/.test(title)) return 'msg';
  if(/^📋/.test(title)) return 'approval';
  if(/^(✅|❌)/.test(title)) return 'result';
  if(/^💰/.test(title)) return 'pay';
  if(/^📢/.test(title)) return 'board';
  return 'etc';
}

// 열 수 있는 주소만 — 같은 사이트(교사 선교사) 안의 http(s) 주소
function safeLink(s){
  if(!s) return '';
  try{
    const u = new URL(String(s), location.href);
    if(u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if(u.origin === location.origin) return u.href;
    if(u.hostname === 'artist4rhythm-hub.github.io' && /^\/gyosa-seongyosa\//.test(u.pathname)) return u.href;
  }catch(e){}
  return '';
}

function css(){
  if(document.getElementById('lp-css')) return;
  const st = document.createElement('style'); st.id = 'lp-css';
  st.textContent = `
#lp-stack{position:fixed;top:calc(var(--hd-h,56px) + 10px);right:16px;z-index:4500;display:flex;flex-direction:column;gap:8px;
  width:min(380px,calc(100vw - 24px));pointer-events:none}
.lp-card{pointer-events:auto;position:relative;display:flex;gap:11px;align-items:flex-start;background:var(--surface,#fff);color:var(--tx,#1F2320);
  border:1px solid var(--line,#E3E1DA);border-left:4px solid var(--lp-c);border-radius:12px;padding:11px 12px 11px 13px;
  box-shadow:0 10px 30px rgba(0,0,0,.18);font-family:inherit;cursor:default;animation:lpIn .22s ease;overflow:hidden}
.lp-card.out{animation:lpOut .2s ease forwards}
@keyframes lpIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes lpOut{to{opacity:0;transform:translateY(-6px)}}
.lp-bd{flex:1;min-width:0}
.lp-k{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:var(--lp-c);margin-bottom:2px}
.lp-k i{font-style:normal;font-weight:600;color:var(--tl,#93A09A)}
.lp-t{font-size:14px;font-weight:900;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-b{font-size:12.5px;color:var(--ts,#5A6560);line-height:1.45;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.lp-a{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex:none}
.lp-go{border:0;border-radius:9px;background:var(--lp-c);color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;padding:7px 12px;cursor:pointer;white-space:nowrap}
.lp-x{border:0;background:none;color:var(--tl,#93A09A);font-size:14px;line-height:1;padding:2px 4px;cursor:pointer}
.lp-x:hover{color:var(--tx,#1F2320)}
.lp-bar{position:absolute;left:0;bottom:0;height:2px;background:var(--lp-c);opacity:.35;width:100%;transform-origin:left;animation:lpBar ${LIFE}ms linear forwards}
.lp-card:hover .lp-bar{animation-play-state:paused}
@keyframes lpBar{to{transform:scaleX(0)}}
@media(max-width:768px){
  #lp-stack{top:calc(env(safe-area-inset-top,0px) + 8px);left:10px;right:10px;width:auto}
  .lp-t{font-size:14.5px}
}
@media print{#lp-stack{display:none}}`;
  document.head.appendChild(st);
}

function stack(){
  let s = document.getElementById('lp-stack');
  if(!s){ s = document.createElement('div'); s.id = 'lp-stack'; s.setAttribute('role', 'status'); s.setAttribute('aria-live', 'polite'); document.body.appendChild(s); }
  return s;
}

function close(card){
  if(!card || card.__closed) return;
  card.__closed = true; clearTimeout(card.__t);
  card.classList.add('out');
  setTimeout(()=>card.remove(), 220);
}

// 띠 하나 보여 주기 — FCM onMessage 의 payload 그대로 받는다
export function show(p){
  p = p || {};
  const n = p.notification || {}, d = p.data || {};
  const title = String(n.title || d.title || '새 알림').slice(0, 90);
  const body  = String(n.body  || d.body  || '').slice(0, 240);
  const link  = safeLink(d.link || (p.fcmOptions && p.fcmOptions.link) || n.click_action || '');
  const k = KIND[kindOf(d, title)];
  css();
  const s = stack();
  const card = document.createElement('div');
  card.className = 'lp-card';
  card.style.setProperty('--lp-c', k.c);
  const bd = document.createElement('div'); bd.className = 'lp-bd';
  const kk = document.createElement('div'); kk.className = 'lp-k'; kk.textContent = k.l;
  const now = document.createElement('i'); now.textContent = '· 지금'; kk.appendChild(now);
  const t = document.createElement('div'); t.className = 'lp-t'; t.textContent = title; t.title = title;
  bd.appendChild(kk); bd.appendChild(t);
  if(body){ const b = document.createElement('div'); b.className = 'lp-b'; b.textContent = body; bd.appendChild(b); }
  const a = document.createElement('div'); a.className = 'lp-a';
  const x = document.createElement('button'); x.className = 'lp-x'; x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.textContent = '✕';
  x.onclick = ev => { ev.stopPropagation(); close(card); };
  a.appendChild(x);
  if(link){
    const go = document.createElement('button'); go.className = 'lp-go'; go.type = 'button'; go.textContent = '열기';
    go.dataset.href = link;
    go.onclick = ev => { ev.stopPropagation(); location.href = link; };
    a.appendChild(go);
    bd.style.cursor = 'pointer';
    bd.onclick = () => { location.href = link; };
  }
  card.appendChild(bd); card.appendChild(a);
  const bar = document.createElement('div'); bar.className = 'lp-bar'; card.appendChild(bar);
  // 저절로 닫기 — 마우스를 올려 두면 기다렸다가 떼면 다시 센다
  const arm = () => { clearTimeout(card.__t); card.__t = setTimeout(()=>close(card), LIFE); };
  card.addEventListener('mouseenter', () => clearTimeout(card.__t));
  card.addEventListener('mouseleave', arm);
  arm();
  s.insertBefore(card, s.firstChild);                 // 새것이 맨 위
  [...s.children].filter(c => !c.__closed).slice(MAX).forEach(close);
  try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){}
  // 사이드바 숫자 다시 세기 (쪽지 · 결재 · 지급)
  try{ if(window.refreshBadges) window.refreshBadges(); else if(window.clearBadgeCache) window.clearBadgeCache(); }catch(e){}
  return card;
}
window.__liveNotify = show;      // 진단 · 시험용

function waitForApp(){
  return new Promise(resolve => {
    let tries = 0;
    const tick = () => {
      if(getApps().length) return resolve(getApp());
      if(++tries > 60) return resolve(null);
      setTimeout(tick, 150);
    };
    tick();
  });
}

let started = false;
export async function start(){
  if(started) return; started = true;
  try{
    const app = await waitForApp(); if(!app) return;
    const m = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
    if(m.isSupported && !(await m.isSupported())) return;     // 알림을 못 쓰는 브라우저 (아이폰 사파리 탭 등)
    const messaging = m.getMessaging(app);
    m.onMessage(messaging, p => { try{ show(p); }catch(e){} });
    window.__liveNotifyOn = true;
  }catch(e){ /* 조용히 — 띠가 없을 뿐 다른 것은 그대로 */ }
}
start();
