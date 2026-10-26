/* ═══ 📅 consult-reqs.js — 변경 요청 · 답글 · 교직원 자녀 (v149) ═══
   · 담임: 이름 → «변경 요청» (사유 · 원하는 때 · 형제 함께) · 답글
   · 편성 담당: 들어갈 자리 찾기 → «이 자리로 옮기기» 한 번에 (판 저장 · 선생님께 보냄 · 처리됨 · 알림)
   · 교직원 자녀: 선생님이 «내 자녀 잇기» · 담당은 누구 것이든 */
let A = null, C = null, esc = null;
const REPL = {};   // reqId → [답글]
let unRep = null, repFor = '';
const ST = { new: ['새 요청', 'red'], answered: ['답함', 'blue'], done: ['처리됨', 'ok'], no: ['못 함', ''], cancel: ['거둠', ''] };
const when = ts => { const s = ts && ts.seconds; if(!s) return ''; const d = new Date(s * 1000); const now = Date.now(); const m = Math.round((now - d.getTime()) / 60000); if(m < 1) return '방금'; if(m < 60) return m + '분 전'; if(m < 60 * 24) return Math.round(m / 60) + '시간 전'; return `${d.getMonth() + 1}/${d.getDate()}`; };
const posTxt = (r, st) => !st ? '자리 없음' : st.k !== 'face' ? C.KINDS[st.k] : `${C.dayLabel((C.dayList(r)[st.d] || {}).date, true)} ${C.slotTime(r, st.d, st.s)}`;
const wantTxt = (r, q) => (q.want || []).map(w => w.s == null ? `${C.dayLabel((C.dayList(r)[w.d] || {}).date, true)} 아무 때나` : `${C.dayLabel((C.dayList(r)[w.d] || {}).date, true)} ${C.slotTime(r, w.d, w.s)}`).concat(q.wantText ? [q.wantText] : []);

/* ═══ 변경 요청 ═══ */
export function reqsHTML(a, sub){
  A = a; C = a.C; esc = a.esc;
  const r = A.R;
  const mineCols = A.myCols();
  const canNew = ['review', 'final'].includes(r.state) && (mineCols.length || A.isMgr);
  const f = A.lsGet('cs_rqf', A.isMgr ? 'new' : 'mine');
  const all = A.REQS.filter(q => q.state !== 'cancel' || q.byUid === A.CU.uid);
  const cnt = k => all.filter(q => k === 'mine' ? q.byUid === A.CU.uid : k === 'all' ? true : (k === 'done' ? ['done', 'no'].includes(q.state) : q.state === k)).length;
  const list = all.filter(q => f === 'all' ? true : f === 'mine' ? q.byUid === A.CU.uid : (f === 'done' ? ['done', 'no'].includes(q.state) : q.state === f));
  const cur = A.REQS.find(q => q.id === sub) || list[0] || null;
  // 담임 확인 현황 (담당)
  let top = '';
  if(A.isMgr && r.sentVer){
    const tu = A.colTeachers();
    const chip = u => { const ok = A.ackOk(u); const rq = all.some(q => q.byUid === u && q.state === 'new'); return `<span class="ch ${rq ? 'red' : ok ? 'ok' : ''}">${esc(A.staffName(u) || '?')} · ${rq ? '요청 있음' : ok ? '확인함' : '아직'}</span>`; };
    const nOk = tu.filter(A.ackOk).length;
    top = `<div class="cs-card" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:12px 0"><b style="font-size:13.5px">담임 확인 ${nOk} / ${tu.length}</b><span class="cs-mut">보낸 판 ${r.sentVer}</span><div style="display:flex;flex-wrap:wrap;gap:6px">${tu.map(chip).join('')}</div><span style="flex:1"></span>${tu.length - nOk ? '<button class="cs-btn sm" data-rq="nudge">아직인 분께 알림</button>' : ''}</div>`;
  } else top = '<div style="height:12px"></div>';
  if(!A.teacherSees()) return top + '<div class="cs-card cs-empty">아직 선생님들께 보내지 않은 상담이에요 — «담임 확인»으로 보낸 뒤에 변경 요청을 받을 수 있어요.</div>';
  const fb = (k, l) => `<button class="cs-btn sm${f === k ? ' p' : ''}" data-rqf="${k}">${l} ${cnt(k)}</button>`;
  return `${top}<div class="cs-rq">
    <div class="cs-rql"><div style="display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap;align-items:center">
      ${A.isMgr ? fb('new', '새 요청') + fb('answered', '답함') + fb('done', '처리됨') : fb('mine', '내 요청')}${fb('all', '모두')}
      ${canNew ? '<span style="flex:1"></span><button class="cs-btn sm g" data-rq="new">+ 새 요청</button>' : ''}</div>
      ${list.map(q => { const s = ST[q.state] || ST.new; const fs = A.styleOf((q.sids || [])[0]); return `<div class="cs-rqi${cur && cur.id === q.id ? ' on' : ''}" data-rqid="${esc(q.id)}" tabindex="0" role="button"><div class="h"><span class="ch ${s[1]}">${s[0]}</span><b>${esc((q.sids || []).map(A.stuName).join(' · '))}</b>${fs ? `<span style="width:10px;height:10px;border-radius:3px;background:${fs.bg};border:1px solid ${fs.fg}"></span>` : ''}<span class="at">${esc(when(q.lastAt || q.at))}</span></div>
        <span class="cs-mut" style="color:var(--ink);font-size:12.5px">${esc(String(q.text || '').slice(0, 70))}</span><span class="cs-mut">${esc(q.byName || '')} 요청${q.nRep ? ` · 답글 ${q.nRep}` : ''}</span></div>`; }).join('') || '<div class="cs-empty">요청이 없어요.</div>'}
    </div>
    <div class="cs-rqd">${cur ? detailHTML(cur) : `<div class="cs-card cs-empty">${A.isMgr ? '이 칸에 해당하는 요청이 없어요 — «처리됨 · 모두»에서 지난 요청을 볼 수 있어요.' : canNew ? `<div style="text-align:left;max-width:520px;margin:0 auto;line-height:1.75"><b style="font-size:14px">💬 변경 요청하는 법</b> <span class="cs-mut">(우리 반 학생만)</span><br>
        ① 여기 왼쪽 위 <b>«+ 새 요청»</b><br>② <b>이번 상담</b> 오른쪽 «우리 반» 목록에서 학생 옆 <b>«변경 요청»</b><br>③ 표에서 우리 반 학생 <b>이름을 눌러 «💬 변경 요청»</b><br>
        <span class="cs-mut">학생 · 형제도 함께 · 사유 · 원하는 때(칸 고르기 / 글)를 적어 보내면 편성 담당 선생님이 자리를 찾아 바꾸고 답글로 알려 드려요.</span></div>` : !['review', 'final'].includes(r.state) ? '고를 요청이 없어요.' : '이 상담에 담임 · 부담임으로 맡은 반이 없어서 변경 요청은 할 수 없어요 — 다른 분 요청은 «모두»에서 볼 수 있어요.<br><span class="cs-mut">반이 빠졌으면 편성 담당 선생님께 알려 주세요.</span>'}</div>`}</div></div>`;
}
function detailHTML(q){
  const r = A.R, seats = A.isMgr ? (r.seats || {}) : A.viewSeats();
  const s = ST[q.state] || ST.new;
  const ids = (q.sids || []).filter(Boolean);
  const fs = A.styleOf(ids[0]);
  const reps = REPL[q.id] || [];
  const mine = q.byUid === A.CU.uid;
  let spot = '';
  if(A.isMgr && ['new', 'answered'].includes(q.state) && r.state !== 'closed'){
    const live = A.inSet ? ids.filter(id => A.inSet.has(id)) : ids;
    const plan = C.findSpot(r, A.colOf, live, q.want || []);
    spot = plan ? `<div class="cs-spot"><b style="font-size:13.5px">✔ 들어갈 자리를 찾았어요 — ${plan.length > 1 ? '형제 함께 · ' : ''}다른 가정은 그대로</b>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${plan.map(([id, d, s2]) => { const c = A.colByKey(A.colOf[id]); return `<span class="ch" style="height:32px;padding:0 10px;background:${fs ? fs.bg : 'var(--sb-mint-2)'};color:${fs ? fs.fg : 'var(--sb-green)'}">${esc(C.dayLabel(C.dayList(r)[d].date, true))} ${C.slotTime(r, d, s2)} · ${esc(A.stuName(id))} · ${esc(c ? c.tname || c.name : '')}</span>`; }).join('')}</div>
        ${(() => { const offHit = plan.filter(([id, d, s2]) => { const c = A.colByKey(A.colOf[id]); return c && (c.off || []).includes(d + '_' + s2); }); return offHit.length ? '<div class="cs-isl">선생님 «못 하는 시간»과 겹쳐요</div>' : ''; })()}
        <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="cs-btn g" data-rq="apply" data-plan="${esc(JSON.stringify(plan))}">이 자리로 옮기기 (${plan.length}명)</button><button class="cs-btn" data-rq="board">표에서 직접 고르기</button><button class="cs-btn r" data-rq="no">어려워요 (답글로 이유)</button></div></div>`
      : `<div class="cs-spot" style="border-color:#D97706;background:#FFFBF0"><b style="font-size:13.5px">원하시는 때에 ${ids.length > 1 ? '형제가 함께 ' : ''}들어갈 빈 자리가 없어요</b><span class="cs-mut">표에서 다른 가정과 바꾸거나 · 날짜 · 칸을 늘리거나 · 답글로 다른 시간을 여쭤 보세요.</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="cs-btn" data-rq="board">표에서 직접 고르기</button><button class="cs-btn r" data-rq="no">어려워요 (답글로 이유)</button></div></div>`;
  }
  return `<div class="cs-card" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px"><span class="ch ${s[1]}">${s[0]}</span><b style="font-size:17px">${esc(ids.length > 1 ? `${String(A.stuName(ids[0])).slice(0, 1)} 가정 — ${ids.map(A.stuName).join(' · ')}` : A.stuName(ids[0]))}</b>${fs ? `<span style="width:14px;height:14px;border-radius:4px;background:${fs.bg}"></span>` : ''}
      <span style="flex:1"></span>${mine && q.state === 'new' ? '<button class="cs-btn xs" data-rq="edit">고치기</button><button class="cs-btn xs r" data-rq="cancel">거두기</button>' : ''}${A.isMgr && ['done', 'no'].includes(q.state) ? '<button class="cs-btn xs" data-rq="reopen">다시 열기</button>' : ''}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">${ids.map(id => { const c = A.colByKey(A.colOf[id]); return `<div class="cs-fr" style="grid-template-columns:1fr;margin:0"><b>${esc(A.stuName(id))} <span class="cs-mut">${esc(C.colLabel(c))} · ${esc(c ? c.tname || '' : '')}</span></b><span style="font-variant-numeric:tabular-nums">지금 ${esc(posTxt(r, seats[id]))}</span></div>`; }).join('')}</div>
    <div class="cs-msg"><span class="cs-av">${esc(String(q.byName || '?').slice(0, 1))}</span><div class="cs-bub"><div class="w"><b>${esc(q.byName || '')}</b> · ${esc(when(q.at))}</div><div class="tx">${esc(q.text || '')}</div>
      ${wantTxt(r, q).length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span class="cs-mut">원하는 때</span>${wantTxt(r, q).map(t => `<span class="ch mint">${esc(t)}</span>`).join('')}${ids.length > 1 ? '<span class="ch">형제 함께</span>' : ''}</div>` : ''}</div></div>
    ${reps.map(p => { const m = A.mgrUids().includes(p.uid); return `<div class="cs-msg"><span class="cs-av${m ? ' m' : ''}">${esc(String(p.name || '?').slice(0, 1))}</span><div class="cs-bub"><div class="w"><b>${esc(p.name || '')}</b>${m ? ' · 편성 담당' : ''} · ${esc(when(p.at))}${p.uid === A.CU.uid && !p.del ? ` <button class="cs-btn xs" data-rdel="${esc(p.id)}" style="margin-left:6px">지우기</button>` : ''}</div><div class="tx">${p.del ? '<span class="cs-mut">(지운 답글)</span>' : esc(p.text || '')}</div></div></div>`; }).join('')}
    ${spot}
    ${q.state !== 'cancel' ? `<div class="cs-msg"><span class="cs-av${A.isMgr ? ' m' : ''}">${esc(String(A.CU.name || '?').slice(0, 1))}</span><div style="flex:1;display:flex;flex-direction:column;gap:8px"><label class="cs-mut"><b style="color:var(--ink)">${esc(A.CU.name || '')}</b>${A.isMgr ? ' · 편성 담당' : ''} · 답글</label>
      <textarea class="cs-ta" data-rtx placeholder="${A.isMgr ? '예: 화요일 16:30부터 이어서 잡았어요. 어머님께 안내 부탁드려요.' : '예: 수요일이면 아무 때나 괜찮다고 하세요.'}"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="cs-btn p" data-rq="reply">답글 달기</button></div></div></div>` : ''}
  </div>`;
}
function watchReplies(id){
  if(repFor === id) return;
  if(unRep){ unRep(); unRep = null; }
  repFor = id; if(!id) return;
  unRep = A.FS.onSnapshot(A.FS.query(A.FS.collection(A.db, 'consultReplies'), A.FS.where('reqId', '==', id)), snap => {
    const l = []; snap.forEach(d => l.push(Object.assign({ id: d.id }, d.data())));
    l.sort((a, b) => ((a.at && a.at.seconds) || 0) - ((b.at && b.at.seconds) || 0));
    const changed = JSON.stringify(REPL[id] || []) !== JSON.stringify(l);
    REPL[id] = l;
    if(changed && A.VIEW === 'reqs') A.render(true);
  }, () => {});
}
async function reply(q, text, quiet, keepState){
  text = String(text || '').trim(); if(!text) return false;
  const bt = A.FS.writeBatch(A.db);
  bt.set(A.FS.doc(A.FS.collection(A.db, 'consultReplies')), { reqId: q.id, rid: A.R.id, uid: A.CU.uid, name: A.CU.name || '', text, at: A.FS.serverTimestamp() });
  const up = { nRep: A.FS.increment(1), lastAt: A.FS.serverTimestamp(), lastBy: A.CU.uid };
  if(A.isMgr && q.state === 'new' && !keepState) up.state = 'answered';
  bt.update(A.FS.doc(A.db, 'consultReqs', q.id), up);
  await bt.commit();
  if(!quiet){
    const to = A.isMgr ? [q.byUid] : C.uniq([q.byUid].concat(A.mgrUids()));
    A.notify(to, 'reply', '↩️ 상담 변경 요청 답글', `${(q.sids || []).map(A.stuName).join(' · ')} — ${text.slice(0, 80)}`, 'consult.html#reqs/' + q.id, { reqId: q.id });
  }
  return true;
}
export function after(a){
  A = a; C = a.C; esc = a.esc;
  const root = document.getElementById('cs'); if(!root) return;
  const sel = root.querySelector('.cs-rqi.on');
  watchReplies(sel ? sel.dataset.rqid : '');
  root.onclick = async e => {
    const t = e.target;
    const f = t.closest('[data-rqf]'); if(f){ A.lsSet('cs_rqf', f.dataset.rqf); A.go('reqs'); return; }
    const it = t.closest('[data-rqid]'); if(it){ A.go('reqs/' + it.dataset.rqid); return; }
    const rd = t.closest('[data-rdel]'); if(rd){ if(!(await A.confirm('답글 지우기', '이 답글을 지울까요? «지운 답글»로 남아요.', '지우기', true))) return; try{ await A.FS.updateDoc(A.FS.doc(A.db, 'consultReplies', rd.dataset.rdel), { del: true, text: '' }); }catch(err){ A.toast('지우지 못했어요 — ' + A.errText(err), 'err'); } return; }
    const b = t.closest('[data-rq]'); if(!b) return;
    const k = b.dataset.rq;
    const q = A.REQS.find(x => x.id === (root.querySelector('.cs-rqi.on') || {}).dataset?.rqid);
    if(k === 'new'){ newReq(A, ''); return; }
    if(k === 'nudge'){
      const r = A.R; const wait = A.colTeachers().filter(u => !A.ackOk(u) && !A.REQS.some(x => x.byUid === u && x.state === 'new'));
      await A.notify(wait, 'sent', '📅 학부모 상담 일정 확인 부탁', `${r.title} — 판 ${r.sentVer} · 우리 반 시간을 확인해 주세요`, 'consult.html#board');
      A.toast(`${wait.length}분께 알림을 보냈어요`); return;
    }
    if(!q) return;
    if(k === 'reply'){ const tx = root.querySelector('[data-rtx]'); try{ if(await reply(q, tx.value)){ tx.value = ''; A.toast('답글을 달았어요'); } }catch(err){ A.toast('답글을 달지 못했어요 — ' + A.errText(err), 'err'); } return; }
    if(k === 'board'){ A.FAM_SEL = A.famOf((q.sids || [])[0]); A.go('board'); return; }
    if(k === 'cancel'){ if(!(await A.confirm('요청 거두기', '이 변경 요청을 거둘까요?', '거두기'))) return; try{ await A.FS.updateDoc(A.FS.doc(A.db, 'consultReqs', q.id), { state: 'cancel', updatedAt: A.FS.serverTimestamp() }); A.toast('요청을 거뒀어요'); }catch(err){ A.toast('거두지 못했어요 — ' + A.errText(err), 'err'); } return; }
    if(k === 'edit'){ newReq(A, (q.sids || [])[0], q); return; }
    if(k === 'reopen'){ try{ await A.FS.updateDoc(A.FS.doc(A.db, 'consultReqs', q.id), { state: 'answered', updatedAt: A.FS.serverTimestamp() }); }catch(err){ A.toast('열지 못했어요 — ' + A.errText(err), 'err'); } return; }
    if(k === 'no'){
      const tx = root.querySelector('[data-rtx]');
      const why = (tx && tx.value.trim()) || await A.prompt('어려워요', '이유 (요청한 선생님께 보여요)', '', { multi: true, ph: '예: 화요일은 모두 차 있어요 — 수요일 16:00은 어떠세요?', required: '이유를 적어 주세요' });
      if(!why) return;
      try{ await reply(q, why, true, true); await A.FS.updateDoc(A.FS.doc(A.db, 'consultReqs', q.id), { state: 'no', doneAt: A.FS.serverTimestamp(), doneBy: A.CU.uid });
        A.notify([q.byUid], 'no', '🙏 상담 변경 요청 — 어려워요', `${(q.sids || []).map(A.stuName).join(' · ')} — ${why.slice(0, 80)}`, 'consult.html#reqs/' + q.id, { reqId: q.id }); A.toast('답글을 달고 «못 함»으로 바꿨어요'); }
      catch(err){ A.toast('저장하지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    if(k === 'apply'){
      const plan = JSON.parse(b.dataset.plan || '[]'); if(!plan.length) return;
      const r0 = A.R;
      const otherUnsent = r0.sentSeats ? C.diffSeats(r0.sentSeats, r0.seats).filter(id => !plan.some(p => p[0] === id)).length : 0;
      const tx = root.querySelector('[data-rtx]');
      const msg = (tx && tx.value.trim()) || `${plan.map(([id, d, s]) => `${A.stuName(id)} ${C.dayLabel(C.dayList(r0)[d].date, true)} ${C.slotTime(r0, d, s)}`).join(' · ')}(으)로 옮겼어요.`;
      if(!(await A.confirm('이 자리로 옮기기', `${esc(msg)}<br><span class="cs-mut">판으로 저장하고 선생님들께 바로 보내요 · 요청은 «처리됨»${otherUnsent ? ` · 보내지 않은 다른 변경 ${otherUnsent}명도 함께 보내져요` : ''}</span>`, '옮기고 보내기'))) return;
      try{
        const patch = {}; plan.forEach(([id, d, s]) => { patch[id] = Object.assign({}, (r0.seats || {})[id] || {}, { k: 'face', d, s, pin: true }); });
        await A.applySeats(patch, '옮겼어요', { noUndo: true });
        const r = A.R;   // 옮긴 뒤 상태 (그사이 새로 받은 문서일 수 있음)
        const n = (Number(r.ver) || 0) + 1;
        const bt = A.FS.writeBatch(A.db);
        bt.set(A.FS.doc(A.db, 'consultRounds', r.id, 'vers', String(n)), { n, seats: r.seats || {}, days: r.days || [], tpl: C.tplOf(r), note: '변경 요청 처리', reqId: q.id, at: A.FS.serverTimestamp(), by: A.CU.uid, byName: A.CU.name || '' });
        const colVer = A.colVerPatch(n, r.sentSeats || null, r.seats || {});
        bt.update(A.roundRef(), { ver: n, sentVer: n, sentSeats: r.seats || {}, colVer, sentAt: A.FS.serverTimestamp(), updatedAt: A.FS.serverTimestamp(), updatedBy: A.CU.uid });
        bt.update(A.FS.doc(A.db, 'consultReqs', q.id), { state: 'done', doneVer: n, doneAt: A.FS.serverTimestamp(), doneBy: A.CU.uid });
        await bt.commit();
        r.ver = n; r.sentVer = n; r.colVer = colVer; r.sentSeats = JSON.parse(JSON.stringify(r.seats || {}));
        await reply(q, msg, true, true);
        const cols = C.uniq(plan.map(p => A.colOf[p[0]]));
        const tUids = C.uniq([q.byUid].concat((r.cols || []).filter(c => cols.includes(c.key)).flatMap(c => [c.uid].concat((A.CBYID[c.classId || c.key] || {}).deputies || []))));
        A.notify(tUids, 'done', '✅ 상담 시간이 바뀌었어요', `${msg} (판 ${n})`, 'consult.html#reqs/' + q.id, { reqId: q.id });
        A.toast(`옮기고 판 ${n}을(를) 보냈어요 · 📌 고정됨`);
        if(tx) tx.value = '';
        A.go('reqs/' + q.id);
      }catch(err){ A.toast('옮기지 못했어요 — ' + A.errText(err), 'err'); console.error(err); }
    }
  };
  root.onkeydown = e => { if(e.key === 'Enter' && e.target.matches('[data-rqid]')) A.go('reqs/' + e.target.dataset.rqid); };
}
/* 새 요청 · 고치기 */
export async function newReq(a, sid, old){
  A = a; C = a.C; esc = a.esc;
  const r = A.R;
  if(!['review', 'final'].includes(r.state)){ A.toast('담임 확인으로 보낸 뒤에 요청할 수 있어요', 'err'); return; }
  const mine = A.myCols();
  const pool = A.scope.filter(x => x.in && (A.isMgr || mine.includes(x.col)));
  if(!pool.length){ A.toast('요청할 수 있는 우리 반 학생이 없어요', 'err'); return; }
  let cur = sid || (old && old.sids[0]) || '';
  const seats = A.viewSeats();
  let want = (old && old.want ? old.want.map(w => w.s == null ? `${w.d}` : `${w.d}_${w.s}`) : []);
  let sibs = old ? (old.sids || []).length > 1 : true;
  const days = C.dayList(r);
  const maxN = Math.max(1, ...days.map((x, d) => C.dayN(r, d)));
  const body = () => {
    const fam = cur ? A.famIds(cur).filter(id => A.inSet.has(id)) : [];
    const ids = sibs ? fam : [cur];
    const curSlots = new Set(ids.map(id => seats[id]).filter(st => st && st.k === 'face').map(st => `${st.d}_${st.s}`));
    return `<div style="display:flex;flex-direction:column;gap:12px">
      <label class="cs-fl">학생<select class="cs-sel" data-s>${!cur ? '<option value="">— 고르기 —</option>' : ''}${pool.map(x => `<option value="${esc(x.sid)}"${x.sid === cur ? ' selected' : ''}>${esc(x.name)} · ${esc(C.colLabel(A.colByKey(x.col)))} · 지금 ${esc(posTxt(r, seats[x.sid]))}</option>`).join('')}</select></label>
      ${fam.length > 1 ? `<label class="ck"><input type="checkbox" data-sib${sibs ? ' checked' : ''}> 형제도 함께 옮기기 — ${esc(fam.filter(id => id !== cur).map(id => `${A.stuName(id)} (${posTxt(r, seats[id])})`).join(' · '))}</label>` : ''}
      <label class="cs-fl">사유 · 학부모 사정<textarea class="cs-ta" data-t placeholder="예: 어머님이 월요일은 퇴근이 늦으셔서 화요일 4시 이후로 부탁하셨어요.">${esc(old ? old.text || '' : '')}</textarea></label>
      <div class="cs-fl">원하는 때 (누르면 고름 · 날짜를 누르면 «그날 아무 때나» · 노란 칸 = 지금 자리)
        <div class="cs-want" style="grid-template-columns:90px repeat(${maxN},minmax(0,1fr))"><span></span>${[...Array(maxN).keys()].map(s => `<span class="hd">${C.NO_KO[s]}</span>`).join('')}
        ${days.map((x, d) => `<button data-w="${d}" class="${want.includes(String(d)) ? 'on' : ''}" style="font-size:12px">${esc(C.dayLabel(x.date, true))}</button>${[...Array(maxN).keys()].map(s => s < C.dayN(r, d) ? `<button data-w="${d}_${s}" class="${want.includes(d + '_' + s) ? 'on' : curSlots.has(d + '_' + s) ? 'cur' : ''}">${C.slotTime(r, d, s)}</button>` : '<span></span>').join('')}`).join('')}</div></div>
      <label class="cs-fl">원하는 때 (글로)<input class="cs-in" data-wt value="${esc(old ? old.wantText || '' : '')}" placeholder="예: 16시 이후 · 수요일이면 아무 때나"></label></div>`;
  };
  const m = A.modal(old ? '💬 변경 요청 고치기' : '💬 변경 요청', `<div data-b>${body()}</div>`, `<button class="cs-btn" data-n>취소</button><button class="cs-btn g" data-y>${old ? '고치기' : '요청 보내기'}</button>`, 'mid');
  const keep = () => { const t = m.box.querySelector('[data-t]'), w = m.box.querySelector('[data-wt]'); return { t: t ? t.value : '', w: w ? w.value : '' }; };
  const redraw = () => { const k = keep(); m.box.querySelector('[data-b]').innerHTML = body(); m.box.querySelector('[data-t]').value = k.t; m.box.querySelector('[data-wt]').value = k.w; };
  m.box.addEventListener('change', e => { if(e.target.matches('[data-s]')){ cur = e.target.value; redraw(); } if(e.target.matches('[data-sib]')){ sibs = e.target.checked; redraw(); } });
  m.box.addEventListener('click', e => { const b = e.target.closest('[data-w]'); if(!b) return; const k = b.dataset.w; want = want.includes(k) ? want.filter(x => x !== k) : want.concat([k]); redraw(); });
  m.box.querySelector('[data-n]').onclick = () => m.close();
  m.box.querySelector('[data-y]').onclick = async () => {
    if(!cur){ A.toast('학생을 골라 주세요', 'err'); return; }
    const text = m.box.querySelector('[data-t]').value.trim(), wantText = m.box.querySelector('[data-wt]').value.trim();
    if(!text){ A.toast('사유를 적어 주세요', 'err'); return; }
    const ids = sibs ? A.famIds(cur).filter(id => A.inSet.has(id)) : [cur];
    const w = want.map(k => { const [d, s] = k.split('_'); return s == null ? { d: +d } : { d: +d, s: +s }; });
    try{
      if(old){ await A.FS.updateDoc(A.FS.doc(A.db, 'consultReqs', old.id), { text, want: w, wantText, sibs: ids.length > 1, updatedAt: A.FS.serverTimestamp() }); m.close(); A.toast('요청을 고쳤어요'); return; }
      const ref = await A.FS.addDoc(A.FS.collection(A.db, 'consultReqs'), { org: C.ORG, rid: r.id, sids: ids, col: A.colOf[cur] || '', byUid: A.CU.uid, byName: A.CU.name || '', text, want: w, wantText,
        sibs: ids.length > 1, state: 'new', nRep: 0, ver: r.sentVer || 0, at: A.FS.serverTimestamp(), lastAt: A.FS.serverTimestamp() });
      m.close();
      A.notify(A.mgrUids(), 'req', '💬 상담 변경 요청', `${A.CU.name || ''} — ${ids.map(A.stuName).join(' · ')}: ${text.slice(0, 80)}`, 'consult.html#reqs/' + ref.id, { reqId: ref.id });
      A.toast('요청을 보냈어요 — 편성 담당 선생님이 답글로 알려 드려요');
      A.go('reqs/' + ref.id);
    }catch(e){ A.toast('보내지 못했어요 — ' + A.errText(e), 'err'); }
  };
}

/* ═══ 교직원 자녀 ═══ */
function stuClass(sid){
  const y = A.R ? Number(A.R.year) : Number(A.today().slice(0, 4));
  const c = A.CLASSES.find(x => !x.deleted && (x.org || C.ORG) === C.ORG && Number(x.year) === y && (x.students || []).includes(sid))
    || A.CLASSES.filter(x => !x.deleted && (x.students || []).includes(sid)).sort((a, b) => b.year - a.year)[0];
  if(!c) return '';
  const g = (c.grades && c.grades[sid]) || C.gradesLabel(C.classGrades(c));
  return `${g || ''} ${c.name || ''}`.trim();
}
export function kidsHTML(a){
  A = a; C = a.C; esc = a.esc;
  const mine = (A.KIDDOCS.find(d => d.uid === A.CU.uid) || { kids: [] }).kids || [];
  const row = (uid, sid, canDel) => `<div class="cs-tr" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto"><span><b>${esc(A.stuName(sid))}</b> <span class="cs-mut">${esc(stuClass(sid))}</span></span><span class="cs-mut">${esc(A.staffName(uid) || '(교직원)')} 선생님 자녀</span>${canDel ? `<button class="cs-btn xs r" data-kdel="${esc(uid)}|${esc(sid)}">끊기</button>` : '<span></span>'}</div>`;
  const others = A.KIDDOCS.filter(d => d.uid !== A.CU.uid && (d.kids || []).length);
  return `<div style="max-width:1000px;margin:12px 0 0;display:flex;flex-direction:column;gap:12px">
    <div class="cs-card cs-desc">🧑‍🏫 학교에 다니는 자녀가 있는 선생님은 여기서 자녀를 이어 주세요. 상담 일정을 잡을 때 <b>선생님이 상담하는 시간과 겹치지 않게 — 선생님 상담이 끝난 뒤</b>로 잡아요 (편성 담당이 «별도 일정»으로 바꿀 수도 있어요).<br>
      학부모 상담 안에서만 쓰고, 한 번 이어 두면 다음 학기에도 그대로예요.</div>
    <div class="cs-card"><h3 style="margin:0 0 8px;font-size:14px;font-weight:900;display:flex;justify-content:space-between;align-items:center"><span>내 자녀</span><button class="cs-btn sm g" data-k="mine">+ 내 자녀 잇기</button></h3>
      <div class="cs-tbl">${mine.map(sid => row(A.CU.uid, sid, true)).join('') || '<div class="cs-tr" style="grid-template-columns:1fr"><span class="cs-mut">이어 둔 자녀가 없어요.</span></div>'}</div></div>
    ${A.isMgr ? `<div class="cs-card"><h3 style="margin:0 0 8px;font-size:14px;font-weight:900;display:flex;justify-content:space-between;align-items:center"><span>다른 선생님 자녀 (편성 담당)</span><button class="cs-btn sm" data-k="other">+ 다른 선생님 자녀 잇기</button></h3>
      <div class="cs-tbl">${others.flatMap(d => d.kids.map(sid => row(d.uid, sid, true))).join('') || '<div class="cs-tr" style="grid-template-columns:1fr"><span class="cs-mut">없어요.</span></div>'}</div></div>`
      : (others.length ? `<div class="cs-card"><h3 style="margin:0 0 8px;font-size:14px;font-weight:900">이어진 교직원 자녀</h3><div class="cs-tbl">${others.flatMap(d => d.kids.map(sid => row(d.uid, sid, false))).join('')}</div></div>` : '')}
  </div>`;
}
async function pickStudent(title, exclude){
  return new Promise(res => {
    const all = Object.values(A.STU).filter(s => !s.deleted && (s.org || C.ORG) === C.ORG && (!window.StuStatus || StuStatus.enrolled(s)) && !(exclude || []).includes(s.id))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    const m = A.modal(esc(title), `<input class="cs-in" data-q placeholder="이름 찾기" style="width:100%;margin-bottom:10px"><div data-l style="max-height:52vh;overflow:auto"></div>`, '<button class="cs-btn" data-n>취소</button>', 'sm');
    const draw = () => { const q = m.box.querySelector('[data-q]').value.trim(); const l = all.filter(s => !q || String(s.name || '').includes(q)).slice(0, 80);
      m.box.querySelector('[data-l]').innerHTML = l.map(s => `<button class="cs-iss" data-p="${esc(s.id)}" style="width:100%;border:0;background:transparent;font-family:inherit;text-align:left;margin:0"><span><b>${esc(s.name || '')}</b> <span class="cs-mut">${esc(stuClass(s.id))}</span></span><span class="cs-mut">${esc(s.birth ? String(s.birth).slice(0, 4) + '년생' : '')}</span></button>`).join('') || '<div class="cs-mut">찾는 학생이 없어요.</div>'; };
    let done = false;
    m.onClose = () => { if(!done) res(null); };
    m.box.querySelector('[data-q]').addEventListener('input', draw);
    m.box.querySelector('[data-l]').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if(!b) return; done = true; m.close(); res(b.dataset.p); });
    m.box.querySelector('[data-n]').onclick = () => m.close();
    draw(); setTimeout(() => m.box.querySelector('[data-q]').focus(), 30);
  });
}
async function pickStaff(){
  return new Promise(res => {
    const list = A.staffPick();
    const m = A.modal('선생님 고르기', `<select class="cs-sel" data-s style="width:100%"><option value="">— 고르기 —</option>${list.map(s => `<option value="${esc(s.uid)}">${esc(s.name || '')}</option>`).join('')}</select>`, '<button class="cs-btn" data-n>취소</button><button class="cs-btn p" data-y>다음</button>', 'sm');
    let done = false;
    m.onClose = () => { if(!done) res(null); };
    m.box.querySelector('[data-n]').onclick = () => m.close();
    m.box.querySelector('[data-y]').onclick = () => { const v = m.box.querySelector('[data-s]').value; if(!v){ A.toast('선생님을 골라 주세요', 'err'); return; } done = true; m.close(); res(v); };
  });
}
async function setKids(uid, kids){
  await A.FS.setDoc(A.FS.doc(A.db, 'consultKids', uid), { uid, org: C.ORG, kids: C.uniq(kids), updatedAt: A.FS.serverTimestamp(), updatedBy: A.CU.uid });
}
export function afterKids(a){
  A = a; C = a.C; esc = a.esc;
  const root = document.getElementById('cs'); if(!root) return;
  root.onclick = async e => {
    const t = e.target;
    const k = t.closest('[data-k]');
    if(k){
      let uid = A.CU.uid;
      if(k.dataset.k === 'other'){ uid = await pickStaff(); if(!uid) return; }
      const cur = (A.KIDDOCS.find(d => d.uid === uid) || { kids: [] }).kids || [];
      const sid = await pickStudent(uid === A.CU.uid ? '내 자녀 고르기' : `${A.staffName(uid)} 선생님 자녀 고르기`, cur);
      if(!sid) return;
      const owner = A.KIDDOCS.find(d => d.uid !== uid && (d.kids || []).includes(sid));
      if(owner && !(await A.confirm('이미 이어진 학생', `${esc(A.stuName(sid))}은(는) ${esc(A.staffName(owner.uid))} 선생님 자녀로 이어져 있어요. 그래도 이을까요? (부모 두 분이 모두 교직원일 때)`, '잇기'))) return;
      try{ await setKids(uid, cur.concat([sid])); A.toast(`${A.stuName(sid)} — ${A.staffName(uid)} 선생님 자녀로 이었어요`);
        if(uid !== A.CU.uid) A.notify([uid], 'kid', '🧑‍🏫 학부모 상담 — 자녀 연결', `${A.stuName(sid)}을(를) 선생님 자녀로 이었어요 (상담 시간을 선생님 상담 뒤로 잡아요)`, 'consult.html#kids');
      }catch(err){ A.toast('잇지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    const d = t.closest('[data-kdel]');
    if(d){
      const [uid, sid] = d.dataset.kdel.split('|');
      if(!(await A.confirm('연결 끊기', `${esc(A.stuName(sid))} — ${esc(A.staffName(uid))} 선생님 자녀 연결을 끊을까요?`, '끊기', true))) return;
      const cur = (A.KIDDOCS.find(x => x.uid === uid) || { kids: [] }).kids || [];
      try{ const left = cur.filter(x => x !== sid); if(left.length) await setKids(uid, left); else await A.FS.deleteDoc(A.FS.doc(A.db, 'consultKids', uid)); A.toast('끊었어요'); }
      catch(err){ A.toast('끊지 못했어요 — ' + A.errText(err), 'err'); }
    }
  };
}
