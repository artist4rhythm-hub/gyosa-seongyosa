/* ═══════════════════════════════════════════════
   parent-board.js — 💬 학부모 «반 게시판» 교사 쪽 (v124)
   · 반 게시판 = 반편성 한 칸 (열쇠 c:<반 문서 id>) — 이름이 같은 반(초등부 닛시반 · 중등부 닛시반)도 따로
   · 담임 · 부담임 · 관리자가: 공지 쓰기(📌 고정 · 💬 댓글 받기) · 답글 · 고정 풀기 · 댓글 닫기
     · 🙈 가리기(원래 내용은 parentHidden 에 교직원만 보게 옮겨 둠) · 가리기 풀기 · 지우기
   · «새 글 · 새 댓글» = 이 반 게시판을 마지막으로 연 뒤 다른 사람이 쓴 것 (이 기기 기준)
   · 사이드바 «우리 반 학부모» 숫자(badges.js)와 같은 기준으로 «본 것»을 적어 둔다
   읽기: 열 때 이 반 글 전부 + 위 20개 글의 댓글 (반 게시판은 해마다 새 반이라 많지 않음)
   · 학부모 관리 › 게시판 관리에서도 같은 화면 (📢 기관 전체 게시판은 board.scope = 'org')
   ═══════════════════════════════════════════════ */
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, Timestamp, deleteField, increment }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { notifyParents } from './push-client.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msOf = t => !t ? 0 : typeof t === 'number' ? t : typeof t.toMillis === 'function' ? t.toMillis() : (t.seconds != null ? t.seconds * 1000 : 0);
const fmt = t => { const ms = msOf(t); if(!ms) return ''; const d = new Date(ms), p = n => String(n).padStart(2, '0');
  const today = new Date(); const same = d.toDateString() === today.toDateString();
  return same ? `오늘 ${p(d.getHours())}:${p(d.getMinutes())}` : `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const nat = (a, b) => String(a).localeCompare(String(b), 'ko', { numeric: true });
const linkify = t => String(t ?? '').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
export const PARENT_URL = 'https://artist4rhythm-hub.github.io/daniel-parents';
const FIRST = 20;       // 처음 그리는 글 수 (그 뒤는 «더 보기»)

let C = null;           // { db, auth, CU, $I, onSeen() }
export function init(ctx){ C = ctx; }

/* ═══ 반 목록 — 학부모 반 게시판 하나씩 ═══ */
export const subOf = c => [c && c.dept && c.dept !== '전체' ? c.dept : '', (c && c.grade) || ''].filter(Boolean).join(' · ');
// 반편성의 반 (올해 · 없으면 작년) — 이름이 같은 반은 부서 · 학년으로 구별되게 꼬리표를 붙인다
export async function rosterBoards(org){
  const y = new Date().getFullYear();
  for(const yy of [y, y - 1]){
    const q = await getDocs(query(collection(C.db, 'classes'), where('year', '==', yy)));
    const list = q.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(c => (c.org || 'daniel') === org && !c.deleted && String(c.name || '').trim());
    if(list.length) return decorate(list);
  }
  return [];
}
export function decorate(list){
  const out = list.map(c => Object.assign({}, c, { key: 'c:' + c.id, name: String(c.name || '').trim(), year: Number(c.year || 0) }));
  out.forEach(c => { const dup = out.filter(x => x.name === c.name && (x.org || 'daniel') === (c.org || 'daniel')).length > 1;
    c.dup = dup;
    c.label = dup ? [subOf(c).replace(' · ', ' '), c.name].filter(Boolean).join(' ') : [c.grade, c.name].filter(Boolean).join(' '); });
  return out.sort((a, b) => nat(a.name, b.name) || nat(a.grade || '', b.grade || '') || nat(a.dept || '', b.dept || ''));
}

/* ═══ 본 것 (이 기기) — 새 글 · 새 댓글 표시와 사이드바 숫자 (pb-badge.js 와 같은 셈) ═══ */
const SEEN_KEY = () => 'gs_pb_seen_' + (C.CU && C.CU.uid);
function seenMap(){ try{ return JSON.parse(localStorage.getItem(SEEN_KEY()) || '{}') || {}; }catch(e){ return {}; }
}
async function markSeen(key){
  try{ const m = seenMap(); m[key] = Date.now(); localStorage.setItem(SEEN_KEY(), JSON.stringify(m)); }catch(e){}
  if(!String(key).startsWith('c:')) return;             // 기관 전체 게시판은 «본 때»만 (사이드바 숫자는 반 게시판만)
  try{   // 사이드바 «우리 반 학부모» 숫자 — 따로 불러와서, 숫자가 안 돼도 게시판은 그대로 돌게
    const PBB = await import('./pb-badge.js?v=124');
    await PBB.rebase(C.db, C.CU.uid, key);
    if(window.setBadges){ const n = await PBB.badgeFor(C.db, C.CU.uid, true); window.setBadges({ myparents: n }); }
  }catch(e){}
  try{ if(C.onSeen) C.onSeen(); }catch(e){}
}

/* ═══ 게시판 한 개 ═══ */
const B = { board: null, posts: [], cmts: new Map(), hid: new Map(), seen: 0, show: FIRST, el: null, open: new Set(), opt: null };
export const state = B;
const isMine = x => C.CU && x.authorUid === C.CU.uid;
const isNew = x => !isMine(x) && !x.hidden && msOf(x.createdAt) > B.seen;   // 가린 것은 «새»로 세지 않음

export async function load(board){
  B.board = board; B.show = FIRST; B.open = new Set();
  B.seen = Number(seenMap()[board.key || ('org:' + (board.org || 'daniel'))] || 0);
  const ps = board.scope === 'org'
    ? await getDocs(query(collection(C.db, 'parentPosts'), where('org', '==', board.org || 'daniel'), where('scope', '==', 'org')))
    : await getDocs(query(collection(C.db, 'parentPosts'), where('org', '==', board.org || 'daniel'), where('scope', '==', 'class'), where('classKey', '==', board.key)));
  B.posts = ps.docs.map(d => Object.assign({ id: d.id }, d.data()));
  // 🔀 학교가 옛 반 게시글을 반편성 반으로 옮기기 전(«↻ 지금 점검» 전) — 반 이름으로 올라간 글도 함께 보여 준다
  B.before = false;
  if(board.scope !== 'org' && board.id && board.name && !board.arch){   // 지난 학년도 반은 옛 이름 글을 섞지 않음 (올해 글이 섞이므로)
    try{ const m = await getDoc(doc(C.db, 'parentConfig', 'mig124')); B.before = !(m.exists() && m.data().first); }catch(e){}
    if(B.before){
      // 이름이 같은 반이 있나 (그 반 글이 섞여 보일 수 있다고 알려 드리려고)
      try{ const sn = await getDocs(query(collection(C.db, 'classes'), where('name', '==', board.name)));
        B.dupName = sn.docs.map(d => d.data()).filter(c => !c.deleted && (c.org || 'daniel') === (board.org || 'daniel') && Number(c.year || 0) === Number(board.year || 0)).length > 1; }catch(e){ B.dupName = !!board.dup; }
      try{
        const old = await getDocs(query(collection(C.db, 'parentPosts'), where('org', '==', board.org || 'daniel'), where('scope', '==', 'class'), where('classKey', '==', board.name)));
        old.docs.forEach(d => { if(!B.posts.some(x => x.id === d.id)) B.posts.push(Object.assign({ id: d.id, _old: true }, d.data())); });
      }catch(e){}
    }
  }
  B.posts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || msOf(b.createdAt) - msOf(a.createdAt));
  B.cmts = new Map(); B.hid = new Map();
  await loadCmts(B.posts.slice(0, B.show).map(p => p.id));
  // 가린 글의 원래 내용 (교직원만)
  const hidP = B.posts.filter(p => p.hidden);
  await Promise.all(hidP.map(p => getDoc(doc(C.db, 'parentHidden', 'p_' + p.id)).then(s => { if(s.exists()) B.hid.set('p_' + p.id, s.data()); }).catch(() => {})));
  return B;
}
async function loadCmts(ids){
  ids = ids.filter(id => !B.cmts.has(id));
  for(let i = 0; i < ids.length; i += 30){
    const part = ids.slice(i, i + 30);
    const cs = await getDocs(query(collection(C.db, 'parentComments'), where('postId', 'in', part)));
    part.forEach(id => B.cmts.set(id, []));
    cs.docs.forEach(d => { const v = Object.assign({ id: d.id }, d.data()); if(B.cmts.has(v.postId)) B.cmts.get(v.postId).push(v); });
    part.forEach(id => B.cmts.get(id).sort((a, b) => msOf(a.createdAt) - msOf(b.createdAt)));
    const hidC = cs.docs.filter(d => d.data().hidden);
    await Promise.all(hidC.map(d => getDoc(doc(C.db, 'parentHidden', 'c_' + d.id)).then(s => { if(s.exists()) B.hid.set('c_' + d.id, s.data()); }).catch(() => {})));
  }
  // 새 댓글이 있는 글은 펼쳐 둔다
  ids.forEach(id => { if((B.cmts.get(id) || []).some(isNew)) B.open.add(id); });
}
export function counts(){
  const newPosts = B.posts.filter(isNew).length;
  let newCmts = 0; B.cmts.forEach(a => { newCmts += a.filter(isNew).length; });
  return { newPosts, newCmts };
}

/* ── 그리기 ── */
export function render(el, opt){
  if(el) B.el = el; if(opt) B.opt = opt; opt = B.opt || {}; el = B.el; if(!el || !B.board) return;
  // 다시 그려도 쓰던 글 · 답글은 그대로 (고정 · 가리기 같은 단추를 눌러도 지워지지 않게)
  const keep = {};
  el.querySelectorAll('#pb-title, #pb-body, .pb-ci input').forEach(i => { if(i.value) keep[i.id] = i.value; });
  const chk = { pin: el.querySelector('#pb-pin'), cmt: el.querySelector('#pb-cmt') };
  const chkV = { pin: chk.pin ? chk.pin.checked : null, cmt: chk.cmt ? chk.cmt.checked : null };
  const b = B.board, n = counts();
  const head = `<div class="pb-ch"><b>${b.scope === 'org' ? '📢 기관 전체 게시판' : (opt.title || '💬 우리 반 게시판')}</b>${n.newCmts || n.newPosts ? `<span class="pb-new">${[n.newCmts ? '새 댓글 ' + n.newCmts : '', n.newPosts ? '새 글 ' + n.newPosts : ''].filter(Boolean).join(' · ')}</span>` : ''}
    <span class="pb-sp"></span><span class="pb-mut">${b.scope === 'org' ? '이 기관 학부모 모두에게 보여요' : `학부모 화면에서 «${esc([b.grade || b.dept, b.name].filter(Boolean).join(' '))}»으로 보여요`}</span></div>`;
  const writer = opt.readOnly ? '' : `<div class="pb-w">
    <input type="text" id="pb-title" maxlength="60" placeholder="제목">
    <textarea id="pb-body" maxlength="2000" placeholder="${b.scope === 'org' ? '기관 학부모님께 알릴 글을 써 주세요…' : '우리 반 학부모님께 알릴 글을 써 주세요…'}"></textarea>
    <div class="pb-tb"><label><input type="checkbox" id="pb-pin" ${opt.pinDefault ? 'checked' : ''}> 📌 공지로 고정</label><label><input type="checkbox" id="pb-cmt" checked> 💬 댓글 받기</label>
      <span class="pb-sp"></span><button class="btn" id="pb-go" onclick="pbPost()">올리기</button></div>
    <div class="msg" id="pb-msg"></div></div>`;
  const list = B.posts.slice(0, B.show);
  const oldN = B.posts.filter(p => p._old).length;
  const beforeNote = oldN ? `<div class="pb-note">🔀 아직 옮기기 전 — 반 이름(«${esc(b.name)}»)으로 올라간 예전 글 ${oldN}개를 함께 보여 줘요. 관리자가 학부모 관리 › 연결 현황에서 «↻ 지금 점검»을 누르면 이 반 게시판으로 옮겨져요${(B.dupName || b.dup) ? ' — 이름이 같은 반 글이 섞여 있을 수 있어요' : ''}.</div>` : '';
  el.innerHTML = head + beforeNote + writer + `<div id="pb-list">${list.length ? list.map(postHTML).join('') : '<div class="pb-empty">아직 이 반 게시판에 글이 없어요.<br>첫 공지를 올려 보세요.</div>'}</div>`
    + (B.posts.length > B.show ? `<button class="pb-more" onclick="pbMore()">글 ${B.posts.length - B.show}개 더 보기</button>` : '');
  Object.entries(keep).forEach(([id, v]) => { const i = el.querySelector('#' + CSS.escape(id)); if(i) i.value = v; });
  if(chkV.pin !== null && el.querySelector('#pb-pin')) el.querySelector('#pb-pin').checked = chkV.pin;
  if(chkV.cmt !== null && el.querySelector('#pb-cmt')) el.querySelector('#pb-cmt').checked = chkV.cmt;
}
// 글을 올린 뒤 — 쓰기 칸 비우기
function clearWriter(){ ['pb-title', 'pb-body'].forEach(id => { const i = C.$I(id); if(i) i.value = ''; }); }
function who(x){
  return x.byStaff ? `<b>${esc(x.authorName || '선생님')}</b> 선생님` : `<b>${esc(x.authorName || '학부모')}</b>${x.childLabel ? ` · ${esc(x.childLabel)} 학부모` : ' 학부모'}`;
}
function postHTML(p){
  const cs = B.cmts.get(p.id), nC = cs ? cs.filter(isNew).length : 0;
  const H = p.hidden ? B.hid.get('p_' + p.id) : null;
  const title = p.hidden ? (H ? H.title : '(가린 글)') : p.title;
  const body = p.hidden ? (H ? H.body : '') : p.body;
  const open = B.open.has(p.id);
  return `<div class="pb-p${p.hidden ? ' hid' : ''}" id="pbp-${esc(p.id)}">
    <div class="pb-t">${p.pinned ? '<span class="pb-pin">📌 공지</span>' : ''}<span class="pb-tt">${esc(title)}</span>${p._old ? '<span class="pb-tag">옮기기 전 글</span>' : ''}
      ${isNew(p) ? '<span class="pb-new">새 글</span>' : ''}${nC ? `<span class="pb-new">새 댓글 ${nC}</span>` : ''}
      ${p.noComment ? '<span class="pb-tag">댓글 안 받음</span>' : ''}${p.hidden ? '<span class="pb-tag hd">🙈 가림 — 학부모에게 안 보여요</span>' : ''}</div>
    <div class="pb-m">${who(p)} · ${fmt(p.createdAt)} · 💬 ${p.commentCount || 0}</div>
    ${body ? `<div class="pb-b">${linkify(esc(body))}</div>` : ''}
    <div class="pb-cs" ${open ? '' : 'style="display:none"'} id="pbc-${esc(p.id)}">${cs ? cmtsHTML(p, cs) : '<div class="pb-mut">불러오는 중…</div>'}</div>
    <div class="pb-ac">
      <button class="pb-x" onclick="pbToggle('${esc(p.id)}')">${open ? '댓글 접기' : `💬 댓글 ${p.commentCount || 0}${nC ? ' · 새 ' + nC : ''}`}</button>
      ${p.hidden ? '' : `<button class="pb-x" onclick="pbReply('${esc(p.id)}')">답글</button>`}
      <button class="pb-x" onclick="pbPin('${esc(p.id)}', ${p.pinned ? 'false' : 'true'})">${p.pinned ? '고정 풀기' : '📌 고정'}</button>
      <button class="pb-x" onclick="pbNoCmt('${esc(p.id)}', ${p.noComment ? 'false' : 'true'})">${p.noComment ? '댓글 열기' : '댓글 닫기'}</button>
      <span class="pb-sp"></span>
      ${p.hidden ? `<button class="pb-x" onclick="pbUnhide('${esc(p.id)}')">가리기 풀기</button>` : (isMine(p) ? '' : `<button class="pb-x" onclick="pbHide('${esc(p.id)}')">🙈 가리기</button>`)}
      <button class="pb-x dg" onclick="pbDel('${esc(p.id)}')">지우기</button>
    </div></div>`;
}
function cmtsHTML(p, cs){
  return cs.map(c => {
    const H = c.hidden ? B.hid.get('c_' + c.id) : null;
    const body = c.hidden ? (H ? H.body : '(가린 댓글)') : c.body;
    return `<div class="pb-c${isNew(c) ? ' nw' : ''}${c.hidden ? ' hid' : ''}">
      <div class="pb-cw">${who(c)} · ${fmt(c.createdAt)}${isNew(c) ? ' <span class="pb-new">새</span>' : ''}${c.hidden ? ' <span class="pb-tag hd">🙈 가림</span>' : ''}
        <span class="pb-sp"></span>${c.hidden ? `<button class="pb-x sm" onclick="pbCmtUnhide('${esc(p.id)}','${esc(c.id)}')">풀기</button>` : (isMine(c) ? '' : `<button class="pb-x sm" onclick="pbCmtHide('${esc(p.id)}','${esc(c.id)}')">가리기</button>`)}
        <button class="pb-x sm dg" onclick="pbCmtDel('${esc(p.id)}','${esc(c.id)}')">지우기</button></div>
      <div class="pb-cb">${esc(body)}</div></div>`;
  }).join('') + (p.hidden ? '' : `<div class="pb-ci"><input type="text" id="pbi-${esc(p.id)}" maxlength="500" placeholder="선생님 답글…" onkeydown="if(event.key==='Enter')pbSendCmt('${esc(p.id)}')"><button class="btn sub" onclick="pbSendCmt('${esc(p.id)}')">등록</button></div>`)
    + (!cs.length ? '<div class="pb-mut" style="padding:4px 0">아직 댓글이 없어요.</div>' : '');
}
// 처음 그린 뒤 «본 것»으로 적는다 (다음에 열면 그 뒤 것만 «새»)
const seenKey = () => B.board ? (B.board.key || ('org:' + (B.board.org || 'daniel'))) : '';
export async function seen(){ if(B.board) await markSeen(seenKey()); }

/* ── 동작 ── */
const say = (ok, t) => { const m = C.$I('pb-msg'); if(!m){ if(!ok) alert(t.replace(/<[^>]+>/g, '')); return; } m.className = 'msg ' + (ok ? 'ok' : 'err'); m.innerHTML = t; };
const P = id => B.posts.find(p => p.id === id);
const me = () => ({ authorUid: C.CU.uid, authorName: C.CU.name || '선생님', authorAvatar: C.CU.avatar || '',
  authorPhoto: (typeof C.CU.photo === 'string' && C.CU.photo.startsWith('data:image/')) ? C.CU.photo : '' });
async function rebase(){ try{ if(B.board) await markSeen(seenKey()); }catch(e){} }   // 내가 쓴 것은 «새»로 세지 않게

window.pbPost = async () => {
  const title = (C.$I('pb-title').value || '').trim(), body = (C.$I('pb-body').value || '').trim();
  if(!title || !body){ say(false, '제목과 내용을 써 주세요.'); return; }
  const b = B.board, btn = C.$I('pb-go'); if(btn) btn.disabled = true;
  try{
    const where_ = b.scope === 'org' ? { scope: 'org', classKey: '' } : { scope: 'class', classKey: b.key, classId: b.id, className: b.name, classYear: b.year || 0 };
    const data = Object.assign({ org: b.org || 'daniel' }, where_, {
      title, body, childLabel: '', byStaff: true, pinned: !!C.$I('pb-pin').checked, noComment: !C.$I('pb-cmt').checked,
      commentCount: 0, createdAt: Timestamp.now() }, me());
    const ref = await addDoc(collection(C.db, 'parentPosts'), data);
    B.posts.unshift(Object.assign({ id: ref.id }, data)); B.cmts.set(ref.id, []);
    B.posts.sort((a, c) => (c.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || msOf(c.createdAt) - msOf(a.createdAt));
    // 🔔 학부모 알림 (알림 서버는 반 이름으로 받는 사람을 찾는다 — 설정이 없으면 조용히 건너뜀)
    let note = '';
    try{
      const j = await notifyParents(C.auth, C.db, b.scope === 'org'
        ? { org: b.org || 'daniel', classKeys: null, title: '📢 학교 공지', body: title, link: `${PARENT_URL}/board.html?org=${b.org || 'daniel'}&scope=org` }
        : { org: b.org || 'daniel', classKeys: [b.name], classIds: [b.id], title: `📢 ${b.label || b.name} 선생님 공지`, body: title,
            link: `${PARENT_URL}/board.html?org=${b.org || 'daniel'}&scope=class&cls=${encodeURIComponent(b.key)}` });
      if(j && j.sent != null) note = ` · 🔔 알림 ${j.sent}명`;
    }catch(e){}
    clearWriter(); render(); say(true, '✅ 올렸어요' + note);
    await rebase();
  }catch(e){ say(false, '올리지 못했어요: ' + esc(e.message || '')); }
  finally{ const b2 = C.$I('pb-go'); if(b2) b2.disabled = false; }
};
window.pbMore = async () => { B.show += FIRST; await loadCmts(B.posts.slice(0, B.show).map(p => p.id)); render(); };
window.pbToggle = async id => {
  if(B.open.has(id)) B.open.delete(id); else { B.open.add(id); if(!B.cmts.has(id)) await loadCmts([id]); }
  render();
};
window.pbReply = async id => { B.open.add(id); if(!B.cmts.has(id)) await loadCmts([id]); render(); const i = C.$I('pbi-' + id); if(i) i.focus(); };
window.pbPin = async (id, on) => { try{ await updateDoc(doc(C.db, 'parentPosts', id), { pinned: !!on }); P(id).pinned = !!on;
  B.posts.sort((a, c) => (c.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || msOf(c.createdAt) - msOf(a.createdAt)); render(); }catch(e){ alert('바꾸지 못했어요: ' + (e.message || '')); } };
window.pbNoCmt = async (id, on) => { try{ await updateDoc(doc(C.db, 'parentPosts', id), { noComment: !!on }); P(id).noComment = !!on; render(); }catch(e){ alert('바꾸지 못했어요: ' + (e.message || '')); } };
// 🙈 가리기 — 원래 제목 · 내용을 교직원만 보는 곳(parentHidden)에 옮기고, 학부모에게 보이는 글은 비운다
window.pbHide = async id => {
  const p = P(id); if(!p) return;
  if(!confirm(`«${p.title}» 글을 가릴까요?\n학부모 화면에서 바로 사라져요 (원래 내용은 선생님만 볼 수 있게 남겨 두고, «가리기 풀기»로 되돌릴 수 있어요).`)) return;
  try{
    const src = { kind: 'post', postId: id, org: p.org || 'daniel', classKey: p.classKey || '', title: p.title || '', body: p.body || '',
      authorUid: p.authorUid || '', authorName: p.authorName || '', by: C.CU.name || '', byUid: C.CU.uid, at: Timestamp.now() };
    await setDoc(doc(C.db, 'parentHidden', 'p_' + id), src);
    await updateDoc(doc(C.db, 'parentPosts', id), { hidden: true, title: '', body: '', hiddenBy: C.CU.name || '', hiddenAt: Timestamp.now() });
    Object.assign(p, { hidden: true, title: '', body: '' }); B.hid.set('p_' + id, src); render();
  }catch(e){ alert('가리지 못했어요: ' + (e.message || '')); }
};
window.pbUnhide = async id => {
  const p = P(id); if(!p) return;
  try{
    const s = await getDoc(doc(C.db, 'parentHidden', 'p_' + id)); const src = s.exists() ? s.data() : null;
    if(!src){ alert('원래 내용을 찾지 못했어요.'); return; }
    await updateDoc(doc(C.db, 'parentPosts', id), { hidden: false, title: src.title || '', body: src.body || '', hiddenBy: deleteField(), hiddenAt: deleteField() });
    try{ await deleteDoc(doc(C.db, 'parentHidden', 'p_' + id)); }catch(e){}
    Object.assign(p, { hidden: false, title: src.title || '', body: src.body || '' }); B.hid.delete('p_' + id); render();
  }catch(e){ alert('되돌리지 못했어요: ' + (e.message || '')); }
};
window.pbDel = async id => {
  const p = P(id); if(!p) return;
  if(!confirm(`«${p.title || (B.hid.get('p_' + id) || {}).title || '이 글'}»을(를) 지울까요? 댓글도 함께 지워져요.`)) return;
  try{
    const cs = await getDocs(query(collection(C.db, 'parentComments'), where('postId', '==', id)));
    for(const d of cs.docs){ try{ await deleteDoc(d.ref); }catch(e){} try{ if(d.data().hidden) await deleteDoc(doc(C.db, 'parentHidden', 'c_' + d.id)); }catch(e){} }
    await deleteDoc(doc(C.db, 'parentPosts', id));
    try{ if(p.hidden) await deleteDoc(doc(C.db, 'parentHidden', 'p_' + id)); }catch(e){}
    B.posts = B.posts.filter(x => x.id !== id); B.cmts.delete(id); render();
    await rebase();
  }catch(e){ alert('지우지 못했어요: ' + (e.message || '')); }
};
window.pbSendCmt = async id => {
  const p = P(id); const inp = C.$I('pbi-' + id); const body = (inp && inp.value || '').trim(); if(!p || !body) return;
  try{
    const data = Object.assign({ postId: id, org: p.org || 'daniel', scope: p.scope || 'class', classKey: p.scope === 'org' ? '' : (p.classKey || ''), body, childLabel: '', byStaff: true, createdAt: Timestamp.now() }, me());
    const ref = await addDoc(collection(C.db, 'parentComments'), data);
    try{ await updateDoc(doc(C.db, 'parentPosts', id), { commentCount: increment(1) }); }catch(e){}
    p.commentCount = (p.commentCount || 0) + 1;
    (B.cmts.get(id) || B.cmts.set(id, []).get(id)).push(Object.assign({ id: ref.id }, data));
    if(inp) inp.value = '';
    B.open.add(id); render();
    await rebase();
  }catch(e){ alert('등록하지 못했어요: ' + (e.message || '')); }
};
const CM = (pid, cid) => (B.cmts.get(pid) || []).find(c => c.id === cid);
window.pbCmtHide = async (pid, cid) => {
  const c = CM(pid, cid); if(!c) return;
  if(!confirm('이 댓글을 가릴까요? 학부모 화면에서 바로 사라져요.')) return;
  try{
    const src = { kind: 'comment', postId: pid, commentId: cid, org: c.org || 'daniel', classKey: c.classKey || '', body: c.body || '',
      authorUid: c.authorUid || '', authorName: c.authorName || '', by: C.CU.name || '', byUid: C.CU.uid, at: Timestamp.now() };
    await setDoc(doc(C.db, 'parentHidden', 'c_' + cid), src);
    await updateDoc(doc(C.db, 'parentComments', cid), { hidden: true, body: '' });
    const p = P(pid); if(p && (p.commentCount || 0) > 0){ try{ await updateDoc(doc(C.db, 'parentPosts', pid), { commentCount: increment(-1) }); p.commentCount = p.commentCount - 1; }catch(e){} }
    Object.assign(c, { hidden: true, body: '' }); B.hid.set('c_' + cid, src); render();
  }catch(e){ alert('가리지 못했어요: ' + (e.message || '')); }
};
window.pbCmtUnhide = async (pid, cid) => {
  const c = CM(pid, cid); if(!c) return;
  try{
    const s = await getDoc(doc(C.db, 'parentHidden', 'c_' + cid)); const src = s.exists() ? s.data() : null;
    if(!src){ alert('원래 내용을 찾지 못했어요.'); return; }
    await updateDoc(doc(C.db, 'parentComments', cid), { hidden: false, body: src.body || '' });
    try{ await deleteDoc(doc(C.db, 'parentHidden', 'c_' + cid)); }catch(e){}
    const p = P(pid); if(p){ try{ await updateDoc(doc(C.db, 'parentPosts', pid), { commentCount: increment(1) }); p.commentCount = (p.commentCount || 0) + 1; }catch(e){} }
    Object.assign(c, { hidden: false, body: src.body || '' }); B.hid.delete('c_' + cid); render();
  }catch(e){ alert('되돌리지 못했어요: ' + (e.message || '')); }
};
window.pbCmtDel = async (pid, cid) => {
  const c = CM(pid, cid); if(!c) return;
  if(!confirm('이 댓글을 지울까요?')) return;
  try{
    await deleteDoc(doc(C.db, 'parentComments', cid));
    try{ if(c.hidden) await deleteDoc(doc(C.db, 'parentHidden', 'c_' + cid)); }catch(e){}
    const p = P(pid); if(p && !c.hidden && (p.commentCount || 0) > 0){ try{ await updateDoc(doc(C.db, 'parentPosts', pid), { commentCount: increment(-1) }); p.commentCount = p.commentCount - 1; }catch(e){} }
    B.cmts.set(pid, (B.cmts.get(pid) || []).filter(x => x.id !== cid)); render();
    await rebase();
  }catch(e){ alert('지우지 못했어요: ' + (e.message || '')); }
};
