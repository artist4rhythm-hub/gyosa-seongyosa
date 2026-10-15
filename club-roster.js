/* ═══════════════════════════════════════════════════════════
   🎨 club-roster.js — 동아리 «오늘 수업» 공용 부품 (v-92)
   · 홈(동아리 실황)과 동아리 현황이 같은 규칙으로 보여 주도록 한 곳에 모았습니다
     - 교실: 관리자 배정(room)이 진실, 없으면 강사 희망(place)
     - 담당: 강사(instructorName) + 함께하는 강사(coInstructors)
     - 명단: 동아리 관리의 확정 명단(clubEnrollments) — 1차 확정(취소 반영) + 2차 배정
     - 차시: 휴강을 뺀 수업만 세어 n/총차시
   · 동아리를 누르면 참여 학생과 «오늘 출석부(결석·지각·조퇴)» · «동아리 출석(강사 기록)»을 함께 보여 줍니다
     (학생 안전·귀가 확인용 — 로그인한 교직원 화면에서만 씁니다)
   ═══════════════════════════════════════════════════════════ */
export const CLUB_PALETTE = ['#5B8DEF','#E8734A','#58B368','#9B6DD6','#E5A83B','#4FB3BF','#E06C9F','#7E9C3F','#6B7FD7','#C2924B'];
const WD = ['일','월','화','수','목','금','토'];
const pad = n => String(n).padStart(2,'0');
export const clubEsc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const esc = clubEsc;

export function addMin(hhmm, m){
  if(!hhmm) return '';
  const [h, mi] = String(hhmm).split(':').map(Number);
  const t = h*60 + mi + (Number(m) || 0);
  return `${pad(Math.floor(t/60) % 24)}:${pad(t % 60)}`;
}
export const roomOf  = c => String((c && (c.room || c.loc || c.place)) || '').trim();
export const instrOf = c => [String((c && c.instructorName) || (c && c.instr) || '').trim(), String((c && c.coInstructors) || '').trim()]
  .filter(Boolean).join(' · ');
export const dayLabel = ds => { const d = new Date(ds + 'T00:00:00'); return `${Number(ds.slice(5,7))}월 ${Number(ds.slice(8,10))}일 ${WD[d.getDay()]}요일`; };

/* 휴강을 뺀 수업들 — {date, time, end, no, total} */
export function liveSessions(c, sem){
  const bm = {}; ((sem && sem.blocked) || []).forEach(b => { if(b.date) bm[b.date] = b.reason || '운영 불가'; });
  const off = x => x.skip || (!x.extra && !x.override && (x.blocked || bm[x.date]));
  const arr = ((c && c.sessions) || []).filter(x => x && x.date && !off(x))
    .map(x => ({ date:x.date, time:x.time || c.start || '', end:addMin(x.time || c.start || '', c.durMin || 60) }))
    .sort((a,b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
  const total = arr.length;
  return arr.map((s,i) => ({ ...s, no:i+1, total }));
}

/* 색 — 게시 도장 색이 있으면 그것, 없으면 제목 순서대로 (동아리 현황과 같은 색) */
export function colorMap(clubs, snapColors){
  const out = {};
  const order = (clubs || []).slice().sort((a,b) => String(a.title).localeCompare(String(b.title), 'ko')).map(c => c.id);
  order.forEach((id, i) => { out[id] = (snapColors && snapColors[id]) || CLUB_PALETTE[i % CLUB_PALETTE.length]; });
  return out;
}

/* 확정 명단 — [{id, n, g, c}] (학년 → 이름 순) */
export function rosterOf(enr, cid){
  const out = [];
  (enr || []).forEach(e => {
    if(!e || e.deleted) return;
    const r1 = new Set(e.r1Final || []);
    Object.entries(e.r2Cancel || {}).forEach(([k,v]) => { if(v) r1.delete(k); });
    const a1 = e.r1Final ? r1.has(cid)
      : (e.result || []).some(r => r.clubId === cid && r.state === 'assigned' && (e.final || {})[r.clubId] !== false);
    const a2 = (e.result2 || []).some(r => r.clubId === cid && r.state === 'assigned');
    if(a1 || a2) out.push({ id:e.studentId || '', n:e.studentName || '', g:e.grade || '', c:e.className || '' });
  });
  return out.sort((a,b) => (parseInt(a.g) || 99) - (parseInt(b.g) || 99) || String(a.n).localeCompare(String(b.n), 'ko'));
}

/* 그날 수업 목록 — [{c, s}] 시각 → 제목 순 */
export function sessionsOn(clubs, sem, ds){
  const out = [];
  (clubs || []).forEach(c => liveSessions(c, sem).forEach(s => { if(s.date === ds) out.push({ c, s }); }));
  return out.sort((a,b) => a.s.time.localeCompare(b.s.time) || String(a.c.title).localeCompare(String(b.c.title), 'ko'));
}

/* ── 명단 창 ───────────────────────────────────────────── */
let _css = false;
function css(){
  if(_css) return; _css = true;
  const st = document.createElement('style');
  st.textContent = `
  .crp-bg{position:fixed;inset:0;background:rgba(20,26,32,.45);z-index:1300;display:flex;align-items:center;justify-content:center;padding:16px}
  .crp{background:var(--wh,#fff);border-radius:14px;overflow:hidden;max-width:420px;width:100%;max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    box-shadow:0 10px 30px rgba(20,30,40,.25);font-family:inherit;color:var(--gd,#1E3932)}
  .crp-h{padding:12px 16px;color:#fff;font-weight:900;font-size:14px;display:flex;align-items:center;gap:8px}
  .crp-h .x{margin-left:auto;background:rgba(255,255,255,.22);border:0;color:#fff;width:26px;height:26px;border-radius:50%;font-size:14px;cursor:pointer;font-family:inherit}
  .crp-m{padding:11px 16px 4px;font-size:12px;line-height:1.75;color:var(--ts,#5A6560)}
  .crp-m b{color:var(--gd,#1E3932)}
  .crp-sum{display:flex;gap:6px;flex-wrap:wrap;padding:6px 16px 10px;border-bottom:1px solid var(--ivd,#E3E1DA)}
  .crp-sum span{font-size:11px;font-weight:800;border-radius:100px;padding:3px 9px;background:var(--iv,#F2F0EB);color:var(--ts,#5A6560)}
  .crp-sum span.w{background:#FDE8E8;color:#B91C1C}
  .crp-list{overflow-y:auto;padding:4px 0}
  .crp-r{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--iv,#F2F0EB);font-size:12.5px}
  .crp-r:last-child{border-bottom:0}
  .crp-r b{font-weight:800;color:var(--gd,#1E3932)}
  .crp-r i{font-style:normal;font-size:11px;font-weight:700;color:var(--tl,#93A09A)}
  .crp-r .sp{flex:1}
  .crp-r.warn{background:#FFF7F5}
  .crp-t{font-size:10.5px;font-weight:900;border-radius:7px;padding:2px 7px;white-space:nowrap}
  .crp-t.abs{background:#FDE8E8;color:#B91C1C} .crp-t.lat{background:#FEF3D9;color:#B45309}
  .crp-t.ear{background:#E5EDFC;color:#1D4ED8} .crp-t.etc{background:#EEF0F2;color:#4B5563}
  .crp-t.co{background:#E8F3EF;color:#00704A} .crp-t.cx{background:#B91C1C;color:#fff} .crp-t.cn{background:transparent;color:var(--tl,#93A09A);font-weight:700}
  .crp-none{padding:18px 16px;font-size:12px;color:var(--tl,#93A09A);text-align:center}
  .crp-f{border-top:1px dashed var(--ivd,#E3E1DA);padding:9px 16px;font-size:10.5px;color:var(--tl,#93A09A);line-height:1.6}
  .crp-f a{color:var(--gm,#00704A);font-weight:800;text-decoration:none}
  html[data-theme="dark"] .crp-r.warn{background:rgba(185,28,28,.12)}`;
  document.head.appendChild(st);
}
const _types = {};   // db별 출결 유형 캐시
function bucket(nm){ const n = String(nm || ''); return n.includes('결석') ? 'abs' : n.includes('지각') ? 'lat' : n.includes('조퇴') ? 'ear' : 'etc'; }

/* 동아리 하나의 그날 명단 창
   o = { db, fs:{doc,getDoc,getDocs,collection,query,where}, club, sem, session, roster, color, org, link } */
export async function openClubRoster(o){
  css();
  const { club:c, session:s, roster = [], color = '#00704A' } = o;
  document.querySelector('.crp-bg')?.remove();
  const bg = document.createElement('div'); bg.className = 'crp-bg';
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = ev => { if(ev.key === 'Escape'){ ev.stopPropagation(); close(); } };
  bg.addEventListener('click', ev => { if(ev.target === bg) close(); });
  document.addEventListener('keydown', onKey, true);
  const room = roomOf(c), who = instrOf(c);
  const head = `<div class="crp-h" style="background:${color}">${esc(c.title || '')}${s ? ` · ${s.no}/${s.total}차시` : ''}
      <button class="x" type="button" aria-label="닫기">✕</button></div>
    <div class="crp-m">${s ? `<b>${esc(dayLabel(s.date))} ${esc(s.time)} – ${esc(s.end)}</b><br>` : ''}🏫 ${room ? esc(room) : '교실 미정'}${who ? ` · 👤 ${esc(who)}` : ''}</div>`;
  const paint = (flags, marks, note) => {
    const rows = roster.map(st => {
      const f = flags && flags[st.id];
      const m = marks ? marks[st.id] : undefined;
      const school = f ? f.map(t => `<span class="crp-t ${bucket(t)}" title="오늘 출석부">${esc(t)}</span>`).join('') : '';
      const clubMk = marks ? (m === 'x' ? '<span class="crp-t cx">동아리 결석</span>' : (m === 'o' ? '<span class="crp-t co">✓ 출석</span>' : '')) : '';
      const warn = !!(f && f.some(t => bucket(t) !== 'lat')) || m === 'x';
      return `<div class="crp-r${warn ? ' warn' : ''}"><b>${esc(st.n)}</b><i>${esc(st.g || '')}${st.c ? ' · ' + esc(st.c) : ''}</i>
        <span class="sp"></span>${school}${clubMk}</div>`;
    }).join('');
    const nAbs = roster.filter(st => flags && flags[st.id] && flags[st.id].some(t => bucket(t) !== 'lat')).length;
    const nX = marks ? roster.filter(st => marks[st.id] === 'x').length : 0;
    const nO = marks ? roster.filter(st => marks[st.id] !== 'x').length : 0;
    bg.innerHTML = `<div class="crp" role="dialog" aria-modal="true">${head}
      <div class="crp-sum"><span>👥 참여 ${roster.length}명</span>${nAbs ? `<span class="w">출석부 결석·조퇴 ${nAbs}명</span>` : ''}${marks ? `<span>동아리 출석 ${nO}${nX ? ` · 결석 ${nX}` : ''}</span>` : '<span>동아리 출석 기록 전</span>'}</div>
      <div class="crp-list">${rows || '<div class="crp-none">확정된 참여 학생이 아직 없어요</div>'}</div>
      <div class="crp-f">${note || ''}명단은 동아리 관리의 확정 명단이에요 · 빨간 표시는 오늘 출석부에 결석·조퇴가 있거나 강사가 결석으로 기록한 학생이에요${o.link ? ` · <a href="${o.link}">동아리 현황 ›</a>` : ''}</div></div>`;
    bg.querySelector('.x').onclick = close;
  };
  paint(null, null, '출석 확인 중… · ');
  document.body.appendChild(bg);
  if(!o.db || !o.fs || !s) { paint(null, null, ''); return; }
  const F = o.fs;
  let flags = null, marks = null;
  await Promise.all([
    (async () => {                                   // 🏫 그날 출석부 — 결석·지각·조퇴만
      try {
        const k = o.org || '';
        if(!_types.list){ const ts = await F.getDocs(F.collection(o.db, 'attendTypes')); _types.list = ts.docs.map(d => ({ id:d.id, ...d.data() })); }
        const qs = await F.getDocs(F.query(F.collection(o.db, 'studentAttendance'), F.where('org', '==', k), F.where('date', '==', s.date)));
        const want = new Set(roster.map(st => st.id));
        flags = {};
        qs.forEach(d => { const m = d.data(); if(!want.has(m.studentId)) return;
          const ids = (m.typeIds && m.typeIds.length) ? m.typeIds : (m.typeId ? [m.typeId] : []);
          const names = ids.map(id => _types.list.find(x => x.id === id)).filter(t => t && !t.isPresent).map(t => t.name);
          if(names.length) flags[m.studentId] = names; });
      } catch(e){ flags = null; }
    })(),
    (async () => {                                   // 📋 동아리 출석 — 강사가 기록한 그 회차
      try {
        const d = await F.getDoc(F.doc(o.db, 'clubAttendance', `${o.sem && o.sem.id}_${c.id}_${s.date}`));
        marks = d.exists() ? (d.data().marks || {}) : null;
      } catch(e){ marks = null; }
    })(),
  ]);
  if(document.body.contains(bg)) paint(flags, marks, '');
}
