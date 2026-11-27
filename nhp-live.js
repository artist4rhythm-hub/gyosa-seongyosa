/* 나학평 — 👥 지금 작업 중 · 조금 전 (v213)
   모든 선생님이 «누가 · 어디를 · 언제» 작업하는지 함께 보는 작은 창 (오른쪽에 따로 뜸 · 접을 수 있음)
   · 글 내용은 다루지 않음 — 칸 · 학생 줄 · 시각만
   · 보관함 nhpLive/<내 uid> 한 장 (보안 규칙 v58) — { uid, name, termId, sub, sid, at, last[] }
       sub  지금 열어 둔 칸 ('' = 칸 밖)   sid  지금 쓰는 학생 줄   last  내가 조금 전에 한 일 (최근 6개: { t, s, n, a })
   · 읽기를 아끼는 방법: 내 위치가 바뀔 때만 씀(20초에 한 번까지) · 쓰는 동안만 3분마다 «아직 있어요» ·
     화면이 가려지면 듣기를 끔 · 6분 넘게 소식이 없으면 저절로 사라짐
   · 막지 않음 — 같은 줄을 다른 분이 쓰고 있으면 알려만 줌
   · 규칙 v58 게시 전에는 조용히 쉼 (담당에게만 안내) */
let A, C, esc, FS;
const HB = 180000, STALE = 380000, GAP = 20000, ROWGAP = 75000, IDLE = 200000;      // ROWGAP: 같은 칸 안에서 학생 줄만 바뀐 때 (읽기를 아끼게 길게)
const ACT_L = { withdraw: '되가져옴', edit: '고침', submit: '작성 완료', ok: '검토 통과', approve: '승인', redo: '수정 요청', reopen: '다시 열기', restore: '되살림', frame: '평가 틀 고침' };
let ME = { sub: '', sid: '' }, LAST = [], GOT_LAST = false;
let lastW = 0, wT = 0, hbT = 0, tickT = 0, actAt = 0, SKEW = 0;      // SKEW: 이 기기 시계 − 서버 시계 (내 글이 돌아올 때 잼)
let OFF = false, unsub = null, LTERM = '', PEERS = [], READY = false, INIT = false;
let OPEN = null, SCOPE = '', DOCK = null, PREV_HTML = '', VIEW = { v: '', a: '' };
const cbs = [];

const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0);
const ago = m => { if(!m) return '방금'; const d = Date.now() - m; if(d < 90000) return '방금'; if(d < 3600000) return Math.round(d / 60000) + '분 전';
  const x = new Date(m), n = new Date(); const p = v => String(v).padStart(2, '0'); const hm = `${p(x.getHours())}:${p(x.getMinutes())}`;
  if(x.toDateString() === n.toDateString()) return hm; const y = new Date(n.getTime() - 864e5); if(x.toDateString() === y.toDateString()) return '어제 ' + hm; return `${x.getMonth() + 1}/${x.getDate()} ${hm}`; };
const uid = () => (A && A.CU && A.CU.uid) || '';
const termId = () => (A && A.TERM && A.TERM.id) || '';
const secName = s => { const sec = s && A.secOf && A.secOf(s.secId); return sec ? C.secLabel(sec) : ''; };
const whereOf = s => s ? [secName(s), A.subLabel(s)].filter(Boolean).join(' · ') : '';
const canOpen = s => !!s && !s.removed && (A.isMgr || (s.teacherUids || []).includes(uid()) || (s.rv || []).includes(uid()));

/* ── 쓰기: 내 위치 · 내가 한 일 ── */
function payload(){
  const o = { uid: uid(), name: String((A.CU && A.CU.name) || '').slice(0, 40), termId: termId(), sub: String(ME.sub || '').slice(0, 200), sid: String(ME.sid || '').slice(0, 80), at: FS.serverTimestamp() };
  if(!GOT_LAST) return o;      // 아직 내 지난 기록을 못 읽었으면 «조금 전»은 건드리지 않음 (합쳐 쓰기)
  return Object.assign(o, { last: LAST.slice(0, 6).map(x => ({ t: Number(x.t) || 0, s: String(x.s || '').slice(0, 200), n: Math.round(Number(x.n) || 0), a: String(x.a || 'edit').slice(0, 12) })) });
}
async function writeNow(){
  clearTimeout(wT); wT = 0; wDue = 0;
  if(OFF || !uid() || !termId()) return;
  lastW = Date.now();
  try{ const d = payload(); await FS.setDoc(FS.doc(A.db, 'nhpLive', uid()), d, d.last ? undefined : { merge: true }); }
  catch(e){ if(/permission/.test((e && e.code) || '')){ OFF = true; stopListen(); draw(); } else console.warn('작업 중 표시', e); }
}
let wDue = 0;
function write(soon, gap0){
  if(OFF) return;
  const gap = soon ? 2500 : (gap0 || GAP); const due = Math.max(Date.now(), lastW + gap);
  if(due <= Date.now()) return void writeNow();
  if(wT && wDue <= due) return;      // 더 이른 쓰기가 이미 잡혀 있음
  clearTimeout(wT); wDue = due; wT = setTimeout(writeNow, due - Date.now());
}
function heartbeat(){
  clearInterval(hbT);
  hbT = setInterval(() => { if(document.visibilityState !== 'visible' || !ME.sub) return; if(Date.now() - actAt > IDLE) return; if(Date.now() - lastW >= HB - 5000) writeNow(); }, 30000);
}
/* 칸에 들어가거나 나올 때 (nhp.html route) */
export function route(r){
  if(!INIT) return;
  VIEW = { v: (r && r.v) || '', a: (r && r.a) || '' };
  const sub = VIEW.v === 's' && A.subOf(VIEW.a) ? VIEW.a : '';
  if(termId() !== LTERM) listen();
  if(sub !== ME.sub){ ME = { sub, sid: '' }; actAt = Date.now(); write(true); }
  if(SCOPE === 'cell' && !sub) SCOPE = '';
  draw(); setTimeout(draw, 0);      // 화면이 바뀐 뒤 한 번 더 (위 안내 줄)
}
/* 입력 화면이 값을 바꿀 때 — path = rows.<학생>.… */
export function touch(subId, path){
  if(!INIT || OFF || !subId) return;
  actAt = Date.now();
  const m = /^rows\.([^.]+)\./.exec(String(path || '')); const sid = m ? m[1] : ME.sid;
  if(subId === ME.sub && sid === ME.sid) return;
  if(VIEW.v === 's' && VIEW.a !== subId) return;      // 지금 보는 칸이 아니면(함께 쓰는 칸에 번지는 저장 등) 위치로 치지 않음
  const rowOnly = subId === ME.sub; ME = { sub: subId, sid: sid || '' }; write(false, rowOnly ? ROWGAP : GAP);
}
/* 내가 한 일 한 줄 — a: edit · submit · ok · approve · redo · reopen · restore · frame / n: 학생 수 */
export function did(subId, n, a){
  if(!INIT || OFF || !subId || a === 'cmt') return;
  const now = Date.now(); const top = LAST[0];
  if(top && top.s === subId && top.a === (a || 'edit') && now - top.t < 600000){ top.t = now; top.n = Math.max(Number(top.n) || 0, Number(n) || 0); }
  else LAST.unshift({ t: now, s: subId, n: Number(n) || 0, a: a || 'edit' });
  LAST = LAST.filter(x => now - x.t < 3 * 864e5).slice(0, 6);
  write(false); draw();
}
function leave(){ if(!INIT || OFF || !ME.sub) return; ME = { sub: '', sid: '' }; lastW = 0; writeNow(); }

/* ── 듣기 ── */
function stopListen(){ if(unsub){ try{ unsub(); }catch(e){} unsub = null; } }
function listen(){
  stopListen(); LTERM = termId(); PEERS = []; READY = false;
  if(OFF || !LTERM || !uid() || document.visibilityState !== 'visible') return;
  try{
    unsub = FS.onSnapshot(FS.query(FS.collection(A.db, 'nhpLive'), FS.where('termId', '==', LTERM)), snap => {
      const L = []; snap.forEach(d => L.push(Object.assign({ id: d.id, _got: Date.now() }, d.data())));
      PEERS = L; READY = true;
      const mineD = L.find(x => x.id === uid()); if(mineD && ms(mineD.at) && !(snap.metadata && snap.metadata.hasPendingWrites) && Date.now() - lastW < 15000){ const k = Date.now() - ms(mineD.at); SKEW = Math.abs(k) > 45000 ? k : 0; }      // 내 글이 막 돌아옴 → 시계 차이
      if(!GOT_LAST){ GOT_LAST = true; const mine = L.find(x => x.id === uid());      // 새로 고쳐도 «내가 조금 전에 한 일»이 이어지게
        if(mine && Array.isArray(mine.last) && !LAST.length) LAST = mine.last.filter(x => x && Date.now() - (Number(x.t) || 0) < 3 * 864e5).slice(0, 6); }
      draw(); cbs.forEach(f => { try{ f(); }catch(e){} });
    }, e => { if(/permission/.test((e && e.code) || '')) OFF = true; stopListen(); draw(); });
  }catch(e){ console.warn('작업 중 듣기', e); }
}
/* 지금 작업 중인 사람들 (나 포함) — 칸이 살아 있고, 소식이 6분 안쪽 */
function liveList(){
  const now = Date.now() - SKEW;
  return PEERS.filter(p => p.sub && A.subOf(p.sub) && now - (ms(p.at) || (p._got - SKEW) || now) < STALE)
    .map(p => ({ uid: p.id, name: p.id === uid() ? `${p.name || ''} (나)` : (p.name || A.staffName(p.id) || ''), sub: A.subOf(p.sub), sid: p.sid || '', at: ms(p.at) || p._got, me: p.id === uid() }))
    .sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) || String(a.name).localeCompare(String(b.name), 'ko'));
}
/* 이 칸에 함께 있는 다른 선생님 — [{ name, sid }] */
export function others(subId){ return liveList().filter(p => !p.me && p.sub.id === subId); }
export function onChange(f){ cbs.push(f); }
export function isOff(){ return OFF; }

/* ── 그리기 ── */
function curSec(){
  if(VIEW.v === 's'){ const s = A.subOf(VIEW.a); return s ? s.secId || '' : ''; }
  if(VIEW.v === 'print' && VIEW.a) return VIEW.a;
  return '';
}
function inScope(s, sc){
  if(!s) return false;
  if(sc === 'cell') return VIEW.v === 's' && s.id === VIEW.a;
  if(sc === 'sec'){ const c = curSec(); return !!c && s.secId === c; }
  return true;
}
function html(){
  const L = liveList(); const n = L.length;
  if(OFF) return A.isMgr ? `<div class="nhl-tab off" data-nhl="info" title="보안 규칙 v58을 게시하면 켜져요">👥 작업 중 표시 — 규칙 v58 게시 뒤 켜져요</div>` : '';
  if(!OPEN) return `<button type="button" class="nhl-tab${n ? ' on' : ''}" data-nhl="open" title="지금 누가 어디를 작업하는지 보기"><i></i>지금 작업 중 <b>${n}</b>명</button>`;
  const cell = VIEW.v === 's' && A.subOf(VIEW.a) ? VIEW.a : ''; const sec = curSec();
  let sc = SCOPE || (cell ? 'cell' : 'all'); if((sc === 'cell' && !cell) || (sc === 'sec' && !sec)) sc = 'all';
  const shown = L.filter(p => inScope(p.sub, sc));
  const tagOf = p => cell && p.sub.id === cell ? ['이 칸', 'here'] : (sec && p.sub.secId === sec ? ['같은 반', 'near'] : ['', '']);
  const liveH = shown.map(p => { const [t, c] = tagOf(p); const go = canOpen(p.sub) && p.sub.id !== cell;
    return `<div class="nhl-p${p.me ? ' me' : ''}${go ? ' go' : ''}"${go ? ` data-nhlgo="${esc(p.sub.id)}"` : ''}><div class="nhl-l1"><i class="${p.me ? 'me' : c === 'here' ? 'here' : ''}"></i><b>${esc(p.name)}</b><span class="nhl-sp"></span>${t ? `<em class="${c}">${t}</em>` : ''}</div>
      <div class="nhl-l2">${esc(whereOf(p.sub))}${p.sid ? ` · <b>${esc(A.stuName(p.sid))}</b> 줄` : ''}</div></div>`; }).join('');
  // 조금 전 — 모든 선생님이 남긴 «한 일»을 모아 최근 순
  const now = Date.now(); const acts = [];
  PEERS.forEach(p => (Array.isArray(p.last) ? p.last : []).forEach(x => { const s = x && A.subOf(x.s); if(!s || !inScope(s, sc) || now - (Number(x.t) || 0) > 3 * 864e5) return;
    acts.push({ t: Number(x.t) || 0, who: p.id === uid() ? '나' : (p.name || A.staffName(p.id) || ''), s, n: Number(x.n) || 0, a: x.a || 'edit' }); }));
  acts.sort((a, b) => b.t - a.t);
  const actH = acts.slice(0, 8).map(x => `<div class="nhl-a"><span class="nhl-at">${esc(ago(x.t))}</span><div><div><b>${esc(x.who)}</b> ${esc(ACT_L[x.a] || '고침')}${x.n > 0 ? ` <small>학생 ${x.n}명</small>` : ''}</div><small>${esc(whereOf(x.s))}</small></div></div>`).join('');
  // 칸마다 마지막 저장 (이 반 · 이 칸 범위에서)
  let cellsH = '';
  if(sc !== 'all'){
    const liveIds = {}; L.forEach(p => { (liveIds[p.sub.id] = liveIds[p.sub.id] || []).push(p.name); });
    const cells = A.SUBS.filter(s => !s.removed && inScope(s, sc)).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt)).slice(0, 14);
    cellsH = cells.map(s => `<div class="nhl-c${liveIds[s.id] ? ' live' : ''}${canOpen(s) && s.id !== cell ? ' go' : ''}"${canOpen(s) && s.id !== cell ? ` data-nhlgo="${esc(s.id)}"` : ''}><b>${esc(A.subLabel(s))}</b><small>${liveIds[s.id] ? '● ' + esc(liveIds[s.id].join(', ')) + ' 작업 중' : (s.updatedBy ? esc(A.staffName(s.updatedBy) || '') + ' · ' : '') + esc(ms(s.updatedAt) ? ago(ms(s.updatedAt)) : '—')}</small></div>`).join('');
  }
  const tabs = [cell ? ['cell', '이 칸만'] : null, sec ? ['sec', '이 반'] : null, ['all', '전체']].filter(Boolean);
  return `<div class="nhl-box" role="complementary" aria-label="지금 작업 중">
    <div class="nhl-h"><i></i><b>지금 작업 중</b><span>${shown.length}명</span><span class="nhl-sp"></span><button type="button" data-nhl="close" title="접기">접기</button></div>
    <div class="nhl-b">
      ${liveH || `<div class="nhl-e">${READY ? '지금 이 범위에서 작업 중인 선생님이 없어요.' : '불러오는 중…'}</div>`}
      ${actH ? `<div class="nhl-t">조금 전</div>${actH}` : ''}
      ${cellsH ? `<div class="nhl-t">칸마다 마지막 저장</div>${cellsH}` : ''}
    </div>
    ${tabs.length > 1 ? `<div class="nhl-f">${tabs.map(([k, l]) => `<button type="button" class="${sc === k ? 'on' : ''}" data-nhlsc="${k}">${l}</button>`).join('')}</div>` : ''}
    <div class="nhl-n">글 내용은 보이지 않아요 — 누가 · 어디를 · 언제만. 6분 넘게 쉬면 저절로 빠져요.</div></div>`;
}
/* 입력 화면 위 한 줄 — 이 칸에 함께 있는 선생님 (칸 화면을 다시 그리지 않고 이 줄만 바꿈) */
function strip(){
  let el = document.getElementById('nhl-strip');
  const body = document.getElementById('nh-body');
  const O = VIEW.v === 's' && !OFF ? others(VIEW.a) : [];
  if(!O.length || !body){ if(el) el.remove(); return; }
  const h = `👥 <b>${O.map(p => esc(p.name) + (p.sid ? ` <small>(${esc(A.stuName(p.sid))} 줄)</small>` : '')).join(', ')}</b> 선생님도 지금 이 칸을 쓰고 있어요 — 같은 학생 줄은 잠깐 기다렸다 쓰면 서로 덮어쓰지 않아요.`;
  if(!el){ el = document.createElement('div'); el.id = 'nhl-strip'; el.className = 'nhl-strip'; }
  if(el.parentNode !== body.parentNode || el.nextSibling !== body) body.parentNode.insertBefore(el, body);
  if(el.innerHTML !== h) el.innerHTML = h;
}
function draw(){
  if(!INIT || !DOCK) return;
  let h = ''; try{ h = html(); }catch(e){ console.warn('작업 중 창', e); }
  if(h !== PREV_HTML){ const sc = DOCK.querySelector('.nhl-b'); const y = sc ? sc.scrollTop : 0; DOCK.innerHTML = h; PREV_HTML = h; const s2 = DOCK.querySelector('.nhl-b'); if(s2) s2.scrollTop = y; }
  document.body.classList.toggle('nhl-open', !!OPEN && !OFF);
  try{ strip(); }catch(e){}
}
export function init(a){
  if(INIT) return; A = a; C = a.C; esc = a.esc; FS = a.FS; INIT = true;
  try{ const v = localStorage.getItem('nhp_live_open'); OPEN = v === null ? window.innerWidth >= 1500 : v === '1'; }catch(e){ OPEN = window.innerWidth >= 1500; }
  DOCK = document.createElement('div'); DOCK.id = 'nhl'; document.body.appendChild(DOCK);
  DOCK.addEventListener('click', e => {
    const t = e.target.closest('[data-nhl],[data-nhlsc],[data-nhlgo]'); if(!t) return;
    if(t.dataset.nhl === 'open' || t.dataset.nhl === 'close'){ OPEN = t.dataset.nhl === 'open'; try{ localStorage.setItem('nhp_live_open', OPEN ? '1' : '0'); }catch(e2){} draw(); return; }
    if(t.dataset.nhlsc){ SCOPE = t.dataset.nhlsc; draw(); return; }
    if(t.dataset.nhlgo){ A.go('s/' + t.dataset.nhlgo); }
  });
  ['keydown', 'pointerdown'].forEach(ev => document.addEventListener(ev, () => { const was = actAt; actAt = Date.now(); if(ME.sub && !OFF && was && actAt - was > IDLE && actAt - lastW > HB) write(true); }, { passive: true, capture: true }));      // 쉬다가 돌아오면 바로 «있어요»
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ listen(); if(ME.sub){ actAt = Date.now(); write(true); } } else stopListen(); });
  window.addEventListener('pagehide', () => { try{ leave(); }catch(e){} });
  clearInterval(tickT); tickT = setInterval(draw, 30000);
  heartbeat(); listen(); draw();
}
