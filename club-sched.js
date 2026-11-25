/* ═══════════════════════════════════════════════════════════
   🗓 club-sched.js — 동아리 «일정 바꾸기» (v204) · 동아리 관리(club-admin.html)의 한 도구
   · 예전엔 휴강 · 보강 · 그날만 시간 변경을 학부모 사이트의 강사 화면에서만 할 수 있어 다시 로그인해야 했음 → 여기서 바로
   · 휴강으로 바꾸면 반드시 뒤처리를 고름: 보강 날짜 / 환불 / 나중에 정하기(«처리 필요»로 남아 계속 보임)
   · 저장하는 곳 (보안 규칙 그대로 — 교직원은 개설 신청서를 고칠 수 있음)
       clubApplications/<id>.sessions      강사 화면과 같은 모양 (skip · skipReason · extra · extraLabel · start · durMin · override)
       clubApplications/<id>.skipPlans     { '휴강 날짜': { plan:'makeup'|'refund'|'todo', makeup:'보강 날짜', refundDone, refundAt, at } }
                                           — 회차표 밖에 두어, 강사 화면이 회차표를 다시 만들어도 지워지지 않게 · 누가 했는지는 여기에 쓰지 않음(공고된 신청서는 로그인 없이 읽힘)
       clubApplications/<id>.planOff       ['처음 계획부터 쉬는 날', …] (v205) — 확정 때 적어 둠 · 이 날들은 휴강이 아니라 수업이 없는 날 (뒤처리를 묻지 않음)
       clubAppPrivate/<id>.schedLog        [{ at, name, act, date, note }] 최근 80개 — 교직원 · 그 강사만 읽는 문서
   ═══════════════════════════════════════════════════════════ */
import { liveSessions, offSessions, planOf, planText, sessTime, addMin, roomOf, instrOf, isPlanOff } from './club-roster.js?v=205';

let E = null, SEL = '', BUSY = false; const LOGS = {};
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const dl = ds => { const d = new Date(ds + 'T00:00:00'); return `${Number(ds.slice(5, 7))}월 ${Number(ds.slice(8, 10))}일 (${WD[d.getDay()]})`; };
const md = ds => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const won = n => Number(n || 0).toLocaleString() + '원';
const bmOf = () => { const m = {}; ((E.SEM && E.SEM.blocked) || []).forEach(b => { if(b.date) m[b.date] = b.reason || '운영 불가'; }); return m; };
const apps = () => E.apps().filter(a => a.status === 'approved' && !a.cancelled && (a.sessions || []).length)
  .sort((a, b) => (Math.min(...(a.weekdays || [9]).map(Number)) - Math.min(...(b.weekdays || [9]).map(Number))) || String(a.start || '').localeCompare(String(b.start || '')) || String(a.title).localeCompare(String(b.title), 'ko'));
const renumber = list => { let no = 0; list.forEach(s => { if(!s.blocked && !s.skip){ no++; s.no = no; } else delete s.no; }); return list; };

function css(){
  if(document.getElementById('csd-css')) return;
  const st = document.createElement('style'); st.id = 'csd-css';
  st.textContent = `
  .csd{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px;align-items:start}
  @media(max-width:900px){.csd{grid-template-columns:minmax(0,1fr)}}
  .csd-l{border:1px solid var(--ivd);border-radius:14px;background:var(--wh,#fff);overflow:hidden}
  .csd-lh{padding:9px 13px;background:var(--gp);font-size:12px;font-weight:800;color:var(--ts)}
  .csd-c{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:9px 13px;border:0;border-top:1px solid var(--ivd);background:transparent;font-family:inherit;color:inherit;cursor:pointer;min-height:44px}
  .csd-c b{font-size:13px;font-weight:900;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .csd-c small{font-size:11.5px;color:var(--ts)}
  .csd-c .mid{flex:1;min-width:0}
  .csd-c.on{background:var(--gd);color:#fff}.csd-c.on small{color:#D9EFE6}
  .csd-tag{font-size:10.5px;font-weight:900;border-radius:100px;padding:2px 8px;white-space:nowrap}
  .csd-tag.todo{background:#FDE8E8;color:#B91C1C}.csd-tag.mk{background:#EDE9FE;color:#5B21B6}.csd-tag.rf{background:#FEF3C7;color:#92400E}
  .csd-tag.ok{background:#DCFCE7;color:#15803D}.csd-tag.tm{background:#FFEDD5;color:#C2410C}.csd-tag.sc{background:#F1F0EC;color:#4B5563}
  .csd-m{display:flex;flex-direction:column;gap:10px;min-width:0}
  .csd-need{background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;padding:10px 14px;font-size:12.5px;line-height:1.7;color:#7F1D1D}
  .csd-need b{color:#B91C1C}.csd-need button{margin-left:6px}
  .csd-t{width:100%;border-collapse:collapse;font-size:12.5px}
  .csd-t th{background:var(--gp);color:var(--ts);font-size:11.5px;font-weight:800;text-align:left;padding:7px 10px}
  .csd-t td{padding:8px 10px;border-top:1px solid var(--ivd);vertical-align:middle}
  .csd-t tr.past td{color:var(--tl,#93A09A)}
  .csd-t tr.off td{background:#FFF7F5}.csd-t tr.sch td{background:#FAFAF8}.csd-t tr.ex td{background:#F6F2FF}.csd-t tr.tod td{box-shadow:inset 3px 0 0 var(--gm,#00704A)}
  .csd-t .acts{text-align:right;white-space:nowrap}
  .csd-t .acts button{margin-left:4px}
  .csd-b{border:1px solid var(--ivd);background:var(--wh,#fff);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;color:var(--gd);min-height:32px}
  .csd-b.w{color:#B91C1C;border-color:#F3B4A8}.csd-b.g{color:#15803D;border-color:#9CC9B5}.csd-b.p{background:var(--gd);border-color:var(--gd);color:#fff}
  .csd-b:disabled{opacity:.5;cursor:default}
  .csd-ex{display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#F6F2FF;border:1px solid #DDD3F5;border-radius:12px;padding:10px 12px;font-size:12.5px}
  .csd-ex input,.csd-ex select,.csd-dlg input,.csd-dlg select{padding:8px 10px;border:1.5px solid var(--ivd);border-radius:9px;font-size:13px;font-family:inherit;background:var(--wh,#fff);color:inherit}
  .csd-log{font-size:12px;line-height:1.7;color:var(--ts)}.csd-log b{color:var(--gd)}
  .csd-bg{position:fixed;inset:0;background:rgba(20,26,32,.45);z-index:1400;display:flex;align-items:center;justify-content:center;padding:16px}
  .csd-dlg{background:var(--wh,#fff);color:var(--gd);border-radius:16px;max-width:520px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:18px 20px;box-shadow:0 12px 32px rgba(20,30,40,.28);display:flex;flex-direction:column;gap:12px}
  .csd-dlg h4{margin:0;font-size:15.5px;font-weight:900}
  .csd-dlg label.k{display:block;font-size:11.5px;font-weight:800;color:var(--ts);margin-bottom:5px}
  .csd-ch{display:flex;gap:6px;flex-wrap:wrap}
  .csd-ch button{border:1.5px solid var(--ivd);background:var(--wh,#fff);border-radius:100px;padding:7px 13px;font-size:12.5px;font-weight:800;font-family:inherit;cursor:pointer;color:var(--ts);min-height:36px}
  .csd-ch button.on{background:var(--gd);border-color:var(--gd);color:#fff}
  .csd-opt{border:1.5px solid var(--ivd);border-radius:12px;padding:10px 12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start}
  .csd-opt.on{border-color:var(--gm,#00704A);background:var(--gp)}
  .csd-opt input[type=radio]{margin-top:3px;accent-color:var(--gm,#00704A);width:17px;height:17px}
  .csd-opt b{font-size:13.5px}.csd-opt .d{font-size:12px;color:var(--ts);line-height:1.6;margin-top:2px}
  .csd-note{background:#FBF3DC;border:1px solid #E6CF8C;border-radius:10px;padding:9px 12px;font-size:12px;line-height:1.7;color:#5C4A12}
  .csd-err{color:#B91C1C;font-size:12.5px;font-weight:800;min-height:18px}`;
  document.head.appendChild(st);
}

/* env = { el, SEM, apps(), db, FS:{doc,updateDoc,Timestamp}, me:{uid,name}, canEdit, toast, esc, snap(label), feeOf(a), semTotal(a), countOf(cid), after() } */
export function renderSched(env){
  E = env; css();
  const L = apps();
  if(!L.find(a => a.id === SEL)) SEL = (L[0] && L[0].id) || '';
  draw();
}
const esc = t => E.esc(t);
function tagsOf(a){
  const off = offSessions(a, E.SEM).filter(o => o.kind === 'skip');
  const todo = off.filter(o => o.plan.st === 'todo').length, rf = off.filter(o => o.plan.st === 'refund').length;
  const live = liveSessions(a, E.SEM); const ex = live.filter(s => s.extra).length, tm = live.filter(s => s.tchg).length;
  return { off: off.length, todo, rf, ex, tm };
}
function draw(){
  const el = E.el; const L = apps();
  if(!L.length){ el.innerHTML = '<div class="card"><div class="small">확정(승인)된 동아리가 아직 없어요 — 개설이 확정되면 여기서 휴강 · 보강 · 시간을 바꿀 수 있어요.</div></div>'; return; }
  const a = L.find(x => x.id === SEL) || L[0];
  const left = `<div class="csd-l"><div class="csd-lh">동아리 ${L.length} · 요일 순</div>${L.map(c => { const t = tagsOf(c);
    return `<button type="button" class="csd-c${c.id === a.id ? ' on' : ''}" data-csd-sel="${esc(c.id)}"><span class="mid"><b>${esc(c.title || '')}</b><small>${(c.weekdays || []).filter(w => WD[w]).map(w => WD[w]).join('·')} ${esc(c.start || '')} · ${esc(roomOf(c) || '교실 미정')}</small></span>
      ${t.todo ? `<span class="csd-tag todo">처리 필요 ${t.todo}</span>` : t.rf ? `<span class="csd-tag rf">환불 전 ${t.rf}</span>` : t.off ? `<span class="csd-tag sc">휴강 ${t.off}</span>` : ''}</button>`; }).join('')}</div>`;
  el.innerHTML = `<div class="csd">${left}<div class="csd-m">${needHTML(L)}${clubHTML(a)}</div></div>`;
  el.onclick = onClick;
}
/* 뒤처리가 남은 휴강 (모든 동아리) */
function needHTML(L){
  const N = []; L.forEach(c => offSessions(c, E.SEM).forEach(o => { if(o.kind === 'skip' && (o.plan.st === 'todo' || o.plan.st === 'refund')) N.push({ c, o }); }));
  if(!N.length) return '';
  N.sort((x, y) => x.o.date.localeCompare(y.o.date));
  return `<div class="csd-need"><b>뒤처리가 남은 휴강 ${N.length}건</b> — 휴강한 수업은 보강하거나 환불해야 해요.<br>${N.slice(0, 8).map(({ c, o }) =>
    `${esc(c.title || '')} ${md(o.date)} — ${o.plan.st === 'refund' ? '환불하기로 함 · 아직 처리 전' : '보강 · 환불을 정하지 않음'}${E.canEdit ? `<button type="button" class="csd-b" data-csd-plan="${esc(o.date)}" data-id="${esc(c.id)}">정하기</button>` : ''}`).join('<br>')}${N.length > 8 ? `<br>… 외 ${N.length - 8}건` : ''}</div>`;
}
function clubHTML(a){
  const bm = bmOf(); const td = today(); const cnt = E.countOf(a.id);
  const live = liveSessions(a, E.SEM); const t = tagsOf(a);
  const noOf = {}; live.forEach(s => { noOf[s.date] = s.no; });
  const rows = (a.sessions || []).slice().filter(x => x && x.date).sort((x, y) => x.date.localeCompare(y.date)).map(x => {
    const tm = sessTime(a, x); const past = x.date < td; const school = !x.extra && !x.override && (x.blocked || bm[x.date]);
    const B = (act, label, cls) => E.canEdit ? `<button type="button" class="csd-b ${cls || ''}" data-csd-${act}="${esc(x.date)}">${label}</button>` : '';
    let cls = past ? 'past' : '', when = `${dl(x.date)}${x.date === td ? ' · 오늘' : ''}`, timeTx = `${esc(tm.time)} – ${esc(tm.end)}`, state = '', acts = '';
    if(school){ cls += ' sch'; timeTx = '<span class="csd-tag sc">학사 휴강</span>'; state = esc(bm[x.date] || x.reason || ''); acts = B('over', '그래도 진행', 'g'); }
    else if(x.skip && isPlanOff(a, x)){ cls += ' sch'; timeTx = '<span class="csd-tag sc">수업 없는 날</span>'; state = '처음 계획부터 쉬는 날 — 보강 · 환불 없음';
      acts = B('plan', '휴강으로 처리', '') + B('unskip', '수업하는 날로'); }
    else if(x.skip){ const pl = planOf(a, E.SEM, x.date); cls += ' off';
      timeTx = '<span class="csd-tag todo" style="background:#FBE9E3;color:#9A3412">휴강</span>';
      state = `${esc(x.skipReason || '사유 없음')} · <span class="csd-tag ${pl.st === 'makeup' ? 'mk' : pl.st === 'refunded' ? 'ok' : pl.st === 'refund' ? 'rf' : 'todo'}">${esc(planText(pl))}</span>`;
      acts = (pl.st === 'refund' ? B('rfdone', '환불 처리함', 'g') : pl.st === 'refunded' ? B('rfundo', '환불 표시 취소') : '') + B('plan', pl.st === 'todo' ? '보강 · 환불 정하기' : '뒤처리 바꾸기', pl.st === 'todo' ? 'p' : '') + B('unskip', '휴강 되돌리기'); }
    else if(x.extra){ cls += ' ex'; state = `<span class="csd-tag mk">${esc(x.extraLabel || '보강')}</span>`; acts = B('time', '시간') + B('delex', '지우기', 'w'); }
    else { const tch = live.find(s => s.date === x.date && s.tchg);
      state = (x.override ? '<span class="csd-tag rf">학사 휴강일인데 진행</span> ' : '') + (tch ? `<span class="csd-tag tm">이 날만 시간 바뀜 (평소 ${esc(a.start || '')})</span>` : '');
      acts = B('time', '시간 바꾸기') + (x.override ? B('overoff', '휴강으로', 'w') : B('skip', '휴강', 'w')); }
    if(x.date === td) cls += ' tod';
    return `<tr class="${cls.trim()}"><td style="width:44px;font-weight:900">${noOf[x.date] && !school && !x.skip ? noOf[x.date] : '—'}</td><td style="white-space:nowrap"><b>${when}</b></td><td style="white-space:nowrap">${timeTx}</td><td>${state}</td><td class="acts">${acts}</td></tr>`;
  }).join('');
  const log = (LOGS[a.id] || []).slice(-6).reverse(); loadLog(a);
  return `<div class="card" style="margin-bottom:0"><div class="row" style="margin-bottom:8px"><h3 style="margin:0">${esc(a.title || '')}</h3>
      <span class="small">${esc(instrOf(a))} · ${(a.weekdays || []).filter(w => WD[w]).map(w => WD[w]).join('·')} ${esc(a.start || '')}–${esc(addMin(a.start || '', a.durMin || 60))} · ${esc(roomOf(a) || '교실 미정')} · ${cnt}명</span>
      <span class="small" style="margin-left:auto"><b>수업 ${live.length}회</b>${t.off ? ` · 휴강 ${t.off}` : ''}${t.ex ? ` · 보강 ${t.ex}` : ''} · 1인 학기 회비 ${won(E.semTotal(a))}</span></div>
    <div style="overflow-x:auto"><table class="csd-t"><tr><th>차시</th><th>날짜</th><th>시간</th><th>상태</th><th></th></tr>${rows}</table></div>
    ${E.canEdit ? `<div class="csd-ex" style="margin-top:10px"><b style="color:#5B21B6">보강 · 특별 회차 넣기</b>
      <input type="date" id="csd-xd" min="${esc(E.SEM.rangeFrom || '')}" max="${esc(E.SEM.rangeTo || '')}" aria-label="보강 날짜">
      <select id="csd-xs" aria-label="시작 시간"><option value="">시간 평소대로 (${esc(a.start || '')})</option>${times().map(x => `<option>${x}</option>`).join('')}</select>
      <select id="csd-xu" aria-label="길이"><option value="">길이 평소대로</option>${DURS.map(m => `<option value="${m}">${m}분</option>`).join('')}</select>
      <input type="text" id="csd-xl" placeholder="이름 (비우면 «보강»)" style="width:150px" aria-label="회차 이름">
      <button type="button" class="csd-b p" data-csd-addex="1">넣기</button>
      <span class="small">회차 · 회비에 함께 세요. 휴강의 보강은 그 휴강 줄의 «보강 · 환불 정하기»로 넣으면 서로 이어져요.</span></div>` : '<div class="small" style="margin-top:8px">일정은 동아리 담당이 바꿔요.</div>'}
    <div class="small" style="margin-top:10px;line-height:1.7">바꾸면 홈 · 동아리 현황 · 학부모 공유 화면에 바로 보여요. 강사가 강사 화면에서 바꾼 것도 여기에 그대로 보여요.</div>
    ${log.length ? `<div class="csd-log" style="margin-top:8px;border-top:1px dashed var(--ivd);padding-top:8px"><b>바꾼 기록</b><br>${log.map(l => `${esc(new Date(l.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))} · ${esc(l.name || '')} — ${esc(l.note || '')}`).join('<br>')}</div>` : ''}</div>`;
}
async function loadLog(a){
  if(LOGS[a.id] !== undefined) return; LOGS[a.id] = [];
  try{ const pd = await E.FS.getDoc(E.FS.doc(E.db, 'clubAppPrivate', a.id)); const l = (pd.exists() && pd.data().schedLog) || []; if(l.length){ LOGS[a.id] = l; if(SEL === a.id && !BUSY && !document.querySelector('.csd-bg')) draw(); } }catch(e){}
}
const DURS = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 150, 180];
function times(){ const out = []; for(let t = 8 * 60; t <= 19 * 60 + 50; t += 10) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`); return out; }

/* ── 저장 — 회차표 · 뒤처리 · 기록을 한 번에 ── */
async function save(a, mut, note, act, date){
  if(BUSY) return false; BUSY = true;
  try{
    await E.snap('일정 변경 전');
    // 강사가 방금 강사 화면에서 저장한 회차 내용을 덮어쓰지 않게 — 지금 저장된 것을 다시 읽어 그 위에 고친다
    const ref = E.FS.doc(E.db, 'clubApplications', a.id);
    const cur = await E.FS.getDoc(ref); if(!cur.exists()){ BUSY = false; E.toast('이 동아리를 찾지 못했어요 — 새로 고쳐 주세요.'); return false; }
    const d0 = cur.data();
    const sessions = JSON.parse(JSON.stringify(d0.sessions || [])); const plans = JSON.parse(JSON.stringify(d0.skipPlans || {}));
    // 처음 계획부터 쉬는 날 — 아직 적어 둔 것이 없으면 «지금 뒤처리 없이 쉬는 날 전부»를 처음 계획으로 삼는다 (고치기 전 모습 기준)
    const off = { list: Array.isArray(d0.planOff) ? d0.planOff.slice() : (d0.sessions || []).filter(x => x && x.skip && !x.extra && !(d0.skipPlans || {})[x.date]).map(x => x.date) };
    const r = mut(sessions, plans, off);
    if(r === false){ BUSY = false; Object.assign(a, { sessions: d0.sessions || [], skipPlans: d0.skipPlans || {}, ...(Array.isArray(d0.planOff) ? { planOff: d0.planOff } : {}) }); draw(); E.toast('그 사이 일정이 바뀌었어요 — 다시 확인해 주세요.'); return false; }
    // 뒤처리 정리 — 휴강이 아닌 날의 뒤처리(강사가 강사 화면에서 휴강을 되돌린 것)와 거기에 이어 둔 보강은 뺀다
    Object.keys(plans).forEach(k => { const s = sessions.find(x => x.date === k && !x.extra); if(!s || !s.skip) delete plans[k]; });
    for(let i = sessions.length - 1; i >= 0; i--){ const x = sessions[i]; if(x.extra && x.extraFor && !(plans[x.extraFor] && plans[x.extraFor].plan === 'makeup' && plans[x.extraFor].makeup === x.date)) sessions.splice(i, 1); }
    sessions.sort((x, y) => String(x.date).localeCompare(String(y.date))); renumber(sessions);
    const planOff = [...new Set(off.list)].filter(k => { const s = sessions.find(x => x.date === k && !x.extra); return s && s.skip && !plans[k]; }).sort();
    const upd = { sessions, sessionCount: sessions.filter(s => !s.blocked && !s.skip).length, skipPlans: plans, adminAt: E.FS.Timestamp.now() };
    if(Array.isArray(d0.planOff) || ['confirmed', 'running', 'settling', 'locked'].includes(E.SEM.status)) upd.planOff = planOff;      // 확정 전에는 적지 않음 (그때는 뒤처리 없는 쉬는 날이 모두 계획)
    await E.FS.updateDoc(ref, upd);
    Object.assign(a, upd);
    // 바꾼 기록 — 교직원 · 그 강사만 읽는 문서에 (실패해도 일정은 이미 저장됨)
    try{ const pref = E.FS.doc(E.db, 'clubAppPrivate', a.id); const pd = await E.FS.getDoc(pref); const old = (pd.exists() && pd.data().schedLog) || [];
      const log = old.slice(-79).concat([{ at: Date.now(), name: E.me.name || '', act, date: date || '', note }]);
      await E.FS.setDoc(pref, pd.exists() ? { schedLog: log } : { uid: d0.uid || '', semId: d0.semId || E.SEM.id, org: d0.org || E.SEM.org || '', schedLog: log }, { merge: true });
      LOGS[a.id] = log; }catch(e){ console.warn('[일정 바꾸기] 기록', e && e.code); }
    E.toast(note);
    BUSY = false; draw(); if(E.after) E.after();
    return true;
  }catch(e){ BUSY = false; E.toast('저장하지 못했어요: ' + ((e && e.message) || e)); return false; }
}
const sOf = (list, date) => list.find(x => x.date === date);
/* 그 회차 1회 요금 — 그날만 길이가 다르면 그 길이로 (학기 회비 계산과 같게) */
const feeAt = (a, x) => E.feeOf(Object.assign({}, a, { durMin: Number(x && x.durMin) || Number(a.durMin) || 0 }));
const stamp = () => ({ at: Date.now() });

/* 그 시간에 같은 교실을 쓰는 다른 동아리 */
function roomClash(a, date, time, dur){
  const room = roomOf(a); if(!room || !time) return [];
  const toM = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const s0 = toM(time), e0 = s0 + (Number(dur) || 60);
  return apps().filter(c => c.id !== a.id && roomOf(c) === room).filter(c => liveSessions(c, E.SEM).some(s => s.date === date && toM(s.time) < e0 && toM(s.end) > s0)).map(c => c.title || '');
}
function dlg(html){
  document.querySelector('.csd-bg')?.remove();
  const bg = document.createElement('div'); bg.className = 'csd-bg'; bg.innerHTML = `<div class="csd-dlg" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = ev => { if(ev.key === 'Escape'){ ev.stopPropagation(); close(); } };
  bg.addEventListener('mousedown', ev => { if(ev.target === bg) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(bg); bg.close = close;
  return bg;
}
function ask(title, body, okLabel, danger){
  return new Promise(res => { const bg = dlg(`<h4>${title}</h4><div style="font-size:13px;line-height:1.7">${body}</div><div class="row" style="justify-content:flex-end"><button type="button" class="csd-b" data-n>취소</button><button type="button" class="csd-b ${danger ? 'w' : 'p'}" data-y>${okLabel}</button></div>`);
    bg.querySelector('[data-n]').onclick = () => { bg.close(); res(false); }; bg.querySelector('[data-y]').onclick = () => { bg.close(); res(true); }; });
}
/* 다음 같은 요일 가운데 아직 회차가 없는 가장 가까운 날 (보강 날짜 제안) */
function suggest(a, date){
  const have = new Set((a.sessions || []).map(x => x.date)); const bm = bmOf(); const to = E.SEM.rangeTo || '';
  const last = (a.sessions || []).map(x => x.date).sort().pop() || date;
  const d = new Date((last > date ? last : date) + 'T00:00:00');
  for(let i = 0; i < 8; i++){ d.setDate(d.getDate() + 7); const ds = ymd(d); if(to && ds > to) break; if(!have.has(ds) && !bm[ds]) return ds; }
  return '';
}
/* 🚫 휴강 창 — 사유 + 뒤처리(보강 / 환불 / 나중에) · mode 'skip' = 새로 휴강 · 'plan' = 이미 휴강인 날의 뒤처리만 */
function skipDlg(a, date, mode){
  const x = sOf(a.sessions || [], date); if(!x) return;
  const cur = (a.skipPlans || {})[date] || {}; const pl = mode === 'plan' ? planOf(a, E.SEM, date) : null;
  const cnt = E.countOf(a.id), fee = feeAt(a, x); const sug = suggest(a, date); const past = date < today();
  const reasons = ['강사 사정', '학교 행사', '교실 사용 겹침', '날씨 · 안전'];
  let reason = x.skipReason || '', plan = pl ? (pl.st === 'makeup' ? 'makeup' : (pl.st === 'refund' || pl.st === 'refunded') ? 'refund' : '') : '';
  const bg = dlg(`<h4>${esc(a.title || '')} · ${dl(date)} ${mode === 'plan' ? '휴강 뒤처리' : '휴강'}</h4>
    ${past && mode !== 'plan' ? '<div class="csd-note">이미 지난 날짜예요 — 실제로 수업을 하지 않았을 때만 휴강으로 바꿔 주세요. 그날 출석 기록은 지워지지 않아요.</div>' : ''}
    <div><label class="k">사유</label><div class="csd-ch" id="csd-rs">${reasons.map(r => `<button type="button" data-r="${r}" class="${reason === r ? 'on' : ''}">${r}</button>`).join('')}</div>
      <input type="text" id="csd-rt" value="${esc(reasons.includes(reason) ? '' : reason)}" placeholder="직접 쓰기 (선택)" style="width:100%;margin-top:6px;box-sizing:border-box"></div>
    <div><label class="k">뒤처리 — 휴강한 수업은 보강하거나 환불해야 해요</label>
      <label class="csd-opt" data-o="makeup"><input type="radio" name="csd-pl" value="makeup"><span style="flex:1"><b>보강해요</b>
        <div class="d">보강 날짜 <input type="date" id="csd-md" value="${esc(pl && pl.st === 'makeup' ? pl.makeup : sug)}" min="${esc(E.SEM.rangeFrom || '')}" max="${esc(E.SEM.rangeTo || '')}">
          <select id="csd-ms"><option value="">평소 시간 (${esc(a.start || '')})</option>${times().map(t => `<option>${t}</option>`).join('')}</select>
          <select id="csd-mu"><option value="">평소 길이</option>${DURS.map(m => `<option value="${m}">${m}분</option>`).join('')}</select></div>
        <div class="d" id="csd-mn"></div></span></label>
      <label class="csd-opt" data-o="refund" style="margin-top:6px"><input type="radio" name="csd-pl" value="refund"><span><b>환불해요</b>
        <div class="d">수업이 한 번 줄어요. 1회 ${won(fee)} × ${cnt}명 = <b>${won(fee * cnt)}</b> 을(를) 학부모에게 돌려줘요 (강사 지급액도 그만큼 줄어요). 환불을 마치면 이 줄에서 «환불 처리함»을 눌러요.</div></span></label>
      <label class="csd-opt" data-o="todo" style="margin-top:6px"><input type="radio" name="csd-pl" value="todo"><span><b>아직 못 정했어요</b>
        <div class="d">«처리 필요»로 남아 동아리 관리 · 동아리 현황에 계속 보여요. 정해지면 이 줄에서 고르면 돼요.</div></span></label>
      ${mode === 'plan' ? `<label class="csd-opt" data-o="planned" style="margin-top:6px"><input type="radio" name="csd-pl" value="planned"><span><b>처음 계획부터 쉬는 날이에요</b>
        <div class="d">계획을 짤 때부터 수업이 없던 날 — 휴강이 아니에요. 보강 · 환불 없이 «수업 없는 날»로 두고, 현황에도 휴강으로 띄우지 않아요.</div></span></label>` : ''}</div>
    <div class="csd-err" id="csd-e"></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="csd-b" data-n>취소</button><button type="button" class="csd-b p" data-y>${mode === 'plan' ? '뒤처리 저장' : '휴강으로 저장'}</button></div>`);
  const $ = q => bg.querySelector(q);
  const paint = () => { bg.querySelectorAll('.csd-opt').forEach(o => { const on = o.dataset.o === plan; o.classList.toggle('on', on); o.querySelector('input[type=radio]').checked = on; });
    bg.querySelectorAll('#csd-rs button').forEach(b => b.classList.toggle('on', b.dataset.r === reason && !$('#csd-rt').value.trim()));
    const d = $('#csd-md').value; let n = '';
    if(plan === 'makeup' && isDate(d)){ const clash = roomClash(a, d, $('#csd-ms').value || a.start, Number($('#csd-mu').value) || a.durMin);
      n = `${dl(d)} ${esc($('#csd-ms').value || a.start || '')}` + (bmOf()[d] ? ` — <b style="color:#B91C1C">학사 휴강일(${esc(bmOf()[d])})이에요</b>` : '') + (clash.length ? ` — <b style="color:#B45309">${esc(roomOf(a))}을(를) 그 시간에 ${esc(clash.join(' · '))}이(가) 써요</b>` : (roomOf(a) ? ` — ${esc(roomOf(a))} 비어 있어요` : '')); }
    $('#csd-mn').innerHTML = n; };
  bg.querySelectorAll('.csd-opt').forEach(o => o.addEventListener('click', () => { plan = o.dataset.o; paint(); }));
  bg.querySelectorAll('#csd-rs button').forEach(b => b.onclick = () => { reason = b.dataset.r; $('#csd-rt').value = ''; paint(); });
  ['#csd-md', '#csd-ms', '#csd-mu', '#csd-rt'].forEach(q => $(q).addEventListener('input', paint));
  paint();
  $('[data-n]').onclick = () => bg.close();
  $('[data-y]').onclick = async () => {
    const rs = $('#csd-rt').value.trim() || reason; const err = t => { $('#csd-e').textContent = t; };
    if(!plan) return err('뒤처리를 골라 주세요 — 보강 · 환불 · 아직 못 정함.');
    if(!rs && plan !== 'planned') return err('사유를 골라 주세요.');
    const mdv = $('#csd-md').value, ms = $('#csd-ms').value, mu = Number($('#csd-mu').value) || 0;
    const oldMk = cur.plan === 'makeup' ? cur.makeup : '';
    const muTx = mu && mu !== (Number(x.durMin) || Number(a.durMin) || 60) ? ` (길이 ${mu}분 — 회비가 그만큼 달라져요)` : '';
    if(plan === 'makeup'){
      if(!isDate(mdv)) return err('보강 날짜를 골라 주세요.');
      if(mdv === date) return err('보강 날짜가 휴강 날짜와 같아요.');
      if((E.SEM.rangeFrom && mdv < E.SEM.rangeFrom) || (E.SEM.rangeTo && mdv > E.SEM.rangeTo)) return err(`학기 기간(${E.SEM.rangeFrom} ~ ${E.SEM.rangeTo}) 안에서 골라 주세요.`);
      const dup = sOf(a.sessions || [], mdv);
      if(dup && !(dup.extra && dup.extraFor === date)) return err(dup.skip ? '그 날짜는 이 동아리가 휴강한 날이에요 — 그 줄에서 «휴강 되돌리기»를 쓰세요.' : (dup.blocked || bmOf()[mdv]) && !dup.override ? '그 날짜는 학사 휴강일로 회차표에 있어요 — 그 줄의 «그래도 진행»을 쓰세요.' : '그 날짜에는 이미 수업이 있어요.');
    }
    if(plan === 'planned' && (cur.plan === 'makeup' || (cur.plan === 'refund' && cur.refundDone))){ bg.close();
      if(!(await ask('처음 계획부터 쉬는 날로', cur.plan === 'makeup' ? `이어 둔 <b>${dl(cur.makeup)} 보강</b>도 함께 빠져요.` : '<b>환불 처리함</b> 표시가 지워져요.', '그렇게 바꾸기'))) return; }
    bg.close();
    const note = plan === 'planned' ? `${a.title || ''} ${md(date)} — 처음 계획부터 쉬는 날로` : `${a.title || ''} ${md(date)} 휴강(${rs}) — ${plan === 'makeup' ? md(mdv) + ' 보강' + muTx : plan === 'refund' ? '환불' : '보강 · 환불 미정'}`;
    await save(a, (S, P, O) => {
      const s = sOf(S, date); if(!s) return false;
      if(plan === 'planned'){ if(!s.skip) return false; const i = S.findIndex(y => y.extra && y.extraFor === date); if(i >= 0) S.splice(i, 1); delete P[date]; O.list.push(date); return; }
      if(s.blocked || (plan === 'makeup' && S.some(y => y.date === mdv && !(y.extra && y.extraFor === date)))) return false;      // 그 사이 바뀜
      s.skip = true; s.skipReason = rs;                                             // 그날만 바꾼 시간(start · durMin)은 그대로 둠 — 되돌리면 살아남
      if(oldMk && oldMk !== (plan === 'makeup' ? mdv : '')){ const i = S.findIndex(y => y.date === oldMk && y.extra && y.extraFor === date); if(i >= 0) S.splice(i, 1); }   // 보강 날짜를 바꾸거나 환불로 돌리면 이어 둔 예전 보강만 뺌
      if(plan === 'makeup'){
        let ex = S.find(y => y.date === mdv && y.extra && y.extraFor === date);
        if(!ex){ ex = { date: mdv, extra: true, blocked: false, skip: false, ctitle: '', content: '', materials: '', cost: '', note: '', sameAct: false, matSame: false, sameCost: false, sameNote: false }; S.push(ex); }
        ex.extraLabel = `보강 (${md(date)} 휴강분)`; ex.extraFor = date;
        if(ms) ex.start = ms; else delete ex.start; if(mu) ex.durMin = mu; else delete ex.durMin;
        P[date] = Object.assign({ plan: 'makeup', makeup: mdv }, stamp());
      } else if(plan === 'refund') P[date] = Object.assign({ plan: 'refund', refundDone: !!(mode === 'plan' && (P[date] || {}).plan === 'refund' && (P[date] || {}).refundDone) }, stamp());
      else P[date] = Object.assign({ plan: 'todo' }, stamp());
    }, note, plan === 'planned' ? 'planned' : 'skip', date);
  };
}
function timeDlg(a, date){
  const x = sOf(a.sessions || [], date); if(!x) return;
  const bg = dlg(`<h4>${esc(a.title || '')} · ${dl(date)} — 이 날만 시간</h4>
    <div class="small">평소 시간은 ${esc(a.start || '')} · ${Number(a.durMin) || 60}분이에요. «평소대로»로 두면 표시가 사라져요.</div>
    <div class="row"><select id="csd-ts"><option value="">시작 평소대로</option>${times().map(t => `<option${t === x.start ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <select id="csd-tu"><option value="">길이 평소대로</option>${DURS.map(m => `<option value="${m}"${m === Number(x.durMin) ? ' selected' : ''}>${m}분</option>`).join('')}</select></div>
    <div class="csd-err" id="csd-e"></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="csd-b" data-n>취소</button><button type="button" class="csd-b p" data-y>저장</button></div>`);
  const $ = q => bg.querySelector(q);
  const chk = () => { const st = $('#csd-ts').value || a.start, du = Number($('#csd-tu').value) || a.durMin; const c = roomClash(a, date, st, du); $('#csd-e').textContent = c.length ? `${roomOf(a)}을(를) 그 시간에 ${c.join(' · ')}이(가) 써요 (저장은 돼요)` : ''; };
  $('#csd-ts').onchange = chk; $('#csd-tu').onchange = chk;
  $('[data-n]').onclick = () => bg.close();
  $('[data-y]').onclick = async () => { const st = $('#csd-ts').value, du = Number($('#csd-tu').value) || 0; bg.close();
    await save(a, S => { const s = sOf(S, date); if(!s) return false; if(st) s.start = st; else delete s.start; if(du) s.durMin = du; else delete s.durMin; },
      `${a.title || ''} ${md(date)} 시간 — ${st || du ? `${st || a.start}${du ? ' · ' + du + '분' : ''}` : '평소대로'}`, 'time', date); };
}
async function onClick(e){
  const t = e.target.closest('button'); if(!t || BUSY) return;
  const d = t.dataset;
  if(d.csdSel){ SEL = d.csdSel; draw(); return; }
  if(!E.canEdit) return;
  if(d.csdPlan && d.id){ SEL = d.id; draw(); const a0 = apps().find(x => x.id === d.id); if(a0) skipDlg(a0, d.csdPlan, 'plan'); return; }
  const a = apps().find(x => x.id === SEL); if(!a) return;
  if(d.csdSkip) return skipDlg(a, d.csdSkip, 'skip');
  if(d.csdPlan) return skipDlg(a, d.csdPlan, 'plan');
  if(d.csdTime) return timeDlg(a, d.csdTime);
  if(d.csdUnskip){ const date = d.csdUnskip; const p = (a.skipPlans || {})[date] || {}; const mk = p.plan === 'makeup' && p.makeup && (a.sessions || []).find(y => y.date === p.makeup && y.extra && y.extraFor === date);
    const x0 = sOf(a.sessions || [], date); const wasPlan = x0 && isPlanOff(a, x0);
    if(!(await ask(wasPlan ? '수업하는 날로' : '휴강 되돌리기', wasPlan ? `${dl(date)}은(는) 처음 계획부터 쉬는 날이에요. 수업하는 날로 바꾸면 <b>수업이 한 번 늘고 1인 회비도 1회 ${won(feeAt(a, x0))}만큼 늘어요.</b>` : `${dl(date)} 수업을 다시 하는 것으로 돌려요.${mk ? `<br>이어 둔 <b>${dl(p.makeup)} 보강</b>도 함께 빼요.` : ''}${p.plan === 'refund' && p.refundDone ? '<br><b>이미 환불 처리함으로 표시된 휴강이에요</b> — 환불을 다시 받아야 하는지 확인해 주세요.' : ''}`, wasPlan ? '수업하는 날로' : '되돌리기'))) return;
    return save(a, (S, P) => { const s = sOf(S, date); if(!s) return false; s.skip = false; s.skipReason = '';
      const i = S.findIndex(y => y.extra && y.extraFor === date); if(i >= 0) S.splice(i, 1); delete P[date]; }, `${a.title || ''} ${md(date)} ${wasPlan ? '수업하는 날로' : '휴강 되돌림'}`, 'unskip', date); }
  if(d.csdRfdone || d.csdRfundo){ const date = d.csdRfdone || d.csdRfundo; const on = !!d.csdRfdone;
    if(on && !(await ask('환불 처리함', `${dl(date)} 휴강분 — 1회 ${won(feeAt(a, sOf(a.sessions || [], date)))} × ${E.countOf(a.id)}명 = <b>${won(feeAt(a, sOf(a.sessions || [], date)) * E.countOf(a.id))}</b> 환불을 마쳤다고 표시해요.`, '환불 처리함'))) return;
    return save(a, (S, P) => { P[date] = Object.assign({}, P[date] || { plan: 'refund' }, { plan: 'refund', refundDone: on, refundAt: on ? Date.now() : 0 }); },
      `${a.title || ''} ${md(date)} 휴강분 ${on ? '환불 처리함' : '환불 표시 취소'}`, on ? 'refund' : 'refund-undo', date); }
  if(d.csdOver){ const date = d.csdOver;
    if(!(await ask('학사 휴강일에 진행', `${dl(date)}은(는) 학사 휴강${bmOf()[date] ? `(${esc(bmOf()[date])})` : ''}이지만 이 동아리는 수업해요. 회차 · 회비에 한 번 더 세요.`, '그래도 진행'))) return;
    return save(a, S => { const s = sOf(S, date); if(!s) return false; s.override = true; s.blocked = false; s.skip = false; if(bmOf()[date]) s.schoolNote = bmOf()[date]; delete s.reason; }, `${a.title || ''} ${md(date)} 학사 휴강일에 진행`, 'override', date); }
  if(d.csdOveroff){ const date = d.csdOveroff;
    return save(a, S => { const s = sOf(S, date); if(!s) return false; delete s.override; delete s.schoolNote; delete s.start; delete s.durMin; if(bmOf()[date]){ s.blocked = true; s.reason = bmOf()[date]; } }, `${a.title || ''} ${md(date)} 학사 휴강으로 되돌림`, 'override-off', date); }
  if(d.csdDelex){ const date = d.csdDelex; const x = sOf(a.sessions || [], date); if(!x || !x.extra) return;
    const src = Object.keys(a.skipPlans || {}).find(k => a.skipPlans[k].plan === 'makeup' && a.skipPlans[k].makeup === date);
    if(!(await ask('보강 지우기', `${dl(date)} «${esc(x.extraLabel || '보강')}»을(를) 지워요.${src ? `<br><b>${dl(src)} 휴강</b>이 다시 «보강 · 환불 미정»이 돼요.` : ''}`, '지우기', true))) return;
    return save(a, (S, P) => { const i = S.findIndex(y => y.date === date && y.extra); if(i < 0) return false; S.splice(i, 1); if(src && P[src]) P[src] = Object.assign({ plan: 'todo' }, stamp()); }, `${a.title || ''} ${md(date)} 보강 지움`, 'del-extra', date); }
  if(d.csdAddex){ const ds = document.getElementById('csd-xd').value, st = document.getElementById('csd-xs').value, du = Number(document.getElementById('csd-xu').value) || 0, lb = document.getElementById('csd-xl').value.trim() || '보강';
    if(!isDate(ds)) return E.toast('보강 날짜를 골라 주세요.');
    if((E.SEM.rangeFrom && ds < E.SEM.rangeFrom) || (E.SEM.rangeTo && ds > E.SEM.rangeTo)) return E.toast('학기 기간 안에서 골라 주세요.');
    if(sOf(a.sessions || [], ds)) return E.toast('그 날짜에는 이미 회차가 있어요 (휴강 · 학사 휴강이면 그 줄의 단추를 쓰세요).');
    const clash = roomClash(a, ds, st || a.start, du || a.durMin);
    if((bmOf()[ds] || clash.length) && !(await ask('보강 넣기', `${dl(ds)}${bmOf()[ds] ? `은(는) 학사 휴강일(${esc(bmOf()[ds])})이에요.` : ''}${clash.length ? `<br>${esc(roomOf(a))}을(를) 그 시간에 ${esc(clash.join(' · '))}이(가) 써요.` : ''}<br>그래도 넣을까요?`, '넣기'))) return;
    return save(a, S => { if(S.some(y => y.date === ds)) return false; S.push({ date: ds, extra: true, extraLabel: lb.slice(0, 30), blocked: false, skip: false, ...(st ? { start: st } : {}), ...(du ? { durMin: du } : {}),
      ctitle: '', content: '', materials: '', cost: '', note: '', sameAct: false, matSame: false, sameCost: false, sameNote: false }); }, `${a.title || ''} ${md(ds)} ${lb} 넣음`, 'extra', ds); }
}
