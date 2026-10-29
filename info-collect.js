/* ═══════════════════════════════════════════════
   info-collect.js — 📮 보호자 정보 수집 (v156 · 학생관리 › 📮 정보 수집 · 우리 반 학부모)
   · 학부모에게는 링크 하나 (학부모 사이트 info.html?org=…) — 교사 선교사 주소는 바깥에 나가지 않음
   · 학부모: 구글 로그인 → 자녀 연결(코드 · 없으면 이름 + 생년월일 → 담임 확인) → 어머니 · 아버지 · 가정 정보
   · 받은 내용(infoAns)은 학부모 출입 서버가 씀 · 교직원은 모두 볼 수 있음 · 학생관리에는 «반영하기»로만 들어감
   · 수집 만들기 · 고치기 · 반영은 관리자 · 학생관리 담당 (규칙 v43)
   · 학생 문서: guardians.{m,f,o} = {name, phone, gmail, gv, work, rel(그 외)} · address · emergency · homeTel · infoExtra{항목: 값}
     대표 보호자(guardian · guardianPhone)는 예전 그대로 — 반영할 때 «대표 보호자»를 고르면 그 분으로 맞춤
   ═══════════════════════════════════════════════ */
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { gateCall } from './gate-client.js?v=122';
import { families, classOfIn, gradeIn, writeXlsx, g as gv0 } from './parents-list.js?v=156';

export const PARENT_URL = 'https://artist4rhythm-hub.github.io/daniel-parents';
export const linkOf = org => `${PARENT_URL}/info.html?org=${org === 'jihyebit' ? 'jihyebit' : 'daniel'}`;
const ORG_L = { daniel: '다니엘 아마츠', jihyebit: '지혜빛 선교원' };
const REL = { m: '어머니', f: '아버지', o: '그 외 보호자', h: '가정' };
const FL = { name: '성함', phone: '휴대폰', gmail: '구글 메일', work: '직장', rel: '관계', addr: '집 주소', addr2: '상세 주소', emerg: '비상 연락처', homeTel: '집 전화' };
const PERSON = { m: ['name', 'phone', 'gmail', 'work'], f: ['name', 'phone', 'gmail', 'work'], o: ['rel', 'name', 'phone', 'gmail', 'work'] };
const HOME = ['addr', 'addr2', 'emerg', 'homeTel'];
const MATRIX = [
  ['name', '성함', ['m', 'f', 'o']], ['phone', '휴대폰', ['m', 'f', 'o']], ['gmail', '구글 메일 (Gmail · 로그인한 메일은 저절로 ✓)', ['m', 'f', 'o']],
  ['work', '직장', ['m', 'f', 'o']], ['rel', '관계 (할머니 · 이모 …)', ['o']],
  ['addr', '집 주소 (주소 찾기)', ['h']], ['addr2', '상세 주소 (동 · 호수)', ['h']], ['emerg', '비상 연락처 (부모님 외)', ['h']], ['homeTel', '집 전화', ['h']],
];
const DEF_FIELDS = () => ({ m: { name: 2, phone: 2, gmail: 2, work: 1 }, f: { name: 2, phone: 2, gmail: 2, work: 1 }, o: { rel: 2, name: 2, phone: 2, gmail: 1, work: 0 }, h: { addr: 2, addr2: 1, emerg: 1, homeTel: 0 } });
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const msOf = t => !t ? 0 : typeof t === 'number' ? t : typeof t.toMillis === 'function' ? t.toMillis() : (t.seconds != null ? t.seconds * 1000 : 0);
const pad = n => String(n).padStart(2, '0');
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const today = () => ymd(Date.now());
const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
const WK = ['일', '월', '화', '수', '목', '금', '토'];
const dueText = s => { if(!s) return ''; const d = new Date(s + 'T00:00:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일(${WK[d.getDay()]})`; };
const dday = s => { if(!s) return ''; const n = Math.round((new Date(s + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5); return n > 0 ? `D-${n}` : n === 0 ? '오늘 마감' : '마감 지남'; };
const nat = (a, b) => String(a || '').localeCompare(String(b || ''), 'ko', { numeric: true });
const stOf = s => (window.StuStatus && window.StuStatus.status) ? window.StuStatus.status(s) : (s.status || 'active');
const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const same = (a, b) => norm(a).replace(/[\s-]/g, '').toLowerCase() === norm(b).replace(/[\s-]/g, '').toLowerCase();

let C = null;   // { db, CU, canManage(), students(), classes(), orgs(), orgNow(), toast(msg, type), logActivity?, el? }
export function init(ctx){ C = ctx; css(); }
const S = { forms: [], ans: new Map(), claims: [], at: 0, view: 'list', cur: null, open: new Set(), filter: 'all' };

/* ═══ 읽기 ═══ */
async function loadAll(force){
  if(!force && S.at && Date.now() - S.at < 60e3) return;
  const orgs = C.orgs();
  const fs = [], cl = [];
  for(const o of orgs){
    const [f, c] = await Promise.all([
      getDocs(query(collection(C.db, 'infoForms'), where('org', '==', o))).catch(e => { console.warn('[정보 수집]', e.message); return null; }),
      getDocs(query(collection(C.db, 'parentClaims'), where('org', '==', o))).catch(() => null),
    ]);
    if(f) f.docs.forEach(d => { const v = d.data(); if(!v.deleted) fs.push(Object.assign({ id: d.id }, v)); });
    if(c) c.docs.forEach(d => { const v = d.data(); if(v.status === 'pending') cl.push(Object.assign({ id: d.id }, v)); });
  }
  S.forms = fs.sort((a, b) => msOf(b.createdAt) - msOf(a.createdAt));
  S.claims = cl.sort((a, b) => msOf(a.at) - msOf(b.at));
  S.ans = new Map();
  await Promise.all(S.forms.map(async f => {
    const q = await getDocs(query(collection(C.db, 'infoAns'), where('formId', '==', f.id))).catch(() => null);
    S.ans.set(f.id, q ? q.docs.map(d => Object.assign({ id: d.id }, d.data())) : []);
  }));
  S.at = Date.now();
}
const isOpen = f => f.status === 'open' && (!f.until || f.until >= today());
const answersOf = fid => (S.ans.get(fid) || []).filter(a => a.state !== 'void');
const verifiedOf = a => (a.sids || []).filter(x => !(a.pend || []).includes(x));   // 담임 확인을 마친 자녀만 (확인 전 요청자가 보낸 것은 반영 · 형제 묶기에 쓰지 않음)

/* ═══ 가정 · 상태 ═══ */
const classOf = s => classOfIn(C.classes(), s);
function targets(f){
  const ids = Array.isArray(f.classIds) ? f.classIds : [];
  return C.students().filter(s => !s.deleted && (s.org || 'daniel') === f.org && ['active', 'leave'].includes(stOf(s)))
    .filter(s => !ids.length || ids.includes((classOf(s) || {}).id));
}
export function famsOf(f, list){
  const ans = answersOf(f.id);
  const stus = list || targets(f);
  const pairs = []; ans.forEach(a => verifiedOf(a).forEach((x, i, arr) => { if(i) pairs.push([arr[0], x]); }));
  return families(stus, pairs).map(ss => {
    ss.sort((a, b) => nat(a.birth, b.birth));
    const sids = ss.map(s => s.id);
    const docs = ans.filter(a => (a.sids || []).some(x => sids.includes(x)) || (a.pend || []).some(x => sids.includes(x)));
    return Object.assign({ stus: ss, sids, docs, key: sids.slice().sort().join('+') }, famState(docs));
  });
}
function famState(docs){
  const parts = {};
  // 받은 칸 표시는 확인을 마친 몫만
  docs.filter(d => verifiedOf(d).length).forEach(d => Object.keys(d.parts || {}).forEach(p => { const at = msOf(d.updatedAt || d.at); if(!parts[p] || parts[p].at < at) parts[p] = { at, gv: !!(d.parts[p] && d.parts[p].gv), email: d.email || '' }; }));
  const state = !docs.length ? 'none' : docs.some(d => d.state === 'new') ? 'todo' : 'done';
  return { parts, state, pend: docs.some(d => (d.pend || []).length) };
}
function stats(f){
  const fams = famsOf(f);
  const c = { fam: fams.length, m: 0, f: 0, o: 0, h: 0, none: 0, todo: 0, done: 0 };
  fams.forEach(x => { ['m', 'f', 'o', 'h'].forEach(p => { if(x.parts[p]) c[p]++; }); c[x.state === 'none' ? 'none' : x.state]++; });
  return c;
}

/* ═══ 문구 · 링크 · QR ═══ */
function kakaoText(org, f, names){
  const who = names ? `${names} 보호자님, ` : '';
  return `[${ORG_L[org]}] ${who}${f ? `«${f.title}»` : '보호자 정보 확인'}을 부탁드려요${f && f.until ? ` (${dueText(f.until)}까지)` : ''}.
어머님 · 아버님께서 각자 아래 링크에서 써 주세요 — 1~2분이면 돼요.
① 링크를 열고 «구글로 계속하기» (카카오톡에서 열렸으면 오른쪽 위 ⋯ → «다른 브라우저로 열기»)
② 우리 아이 연결 (자녀 코드, 없으면 이름 · 생년월일)
③ 정보를 쓰고 «보내기»
${linkOf(org)}`;
}
async function copy(t, ok){
  try{ await navigator.clipboard.writeText(t); C.toast(ok || '복사했어요', 'ok'); }
  catch(e){ window.prompt('아래 글을 복사해 주세요', t); }
}
function loadQR(){
  return new Promise(res => {
    if(window.QR && window.QR.svg) return res(true);
    const s = document.createElement('script'); s.src = 'qr.js?v=122';
    s.onload = () => res(!!(window.QR && window.QR.svg)); s.onerror = () => res(false); document.head.appendChild(s);
  });
}
async function printFlyer(org, f){
  if(!(await loadQR())) return C.toast('QR 도구를 불러오지 못했어요', 'err');
  const link = linkOf(org), qr = window.QR.svg(link, { px: 230 });
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보호자 정보 확인 안내</title><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:'Noto Sans KR','Malgun Gothic',sans-serif;color:#1F2320;margin:0}
    .org{font-size:14px;font-weight:800;color:#5A6560;letter-spacing:.04em}h1{font-size:30px;margin:6px 0 4px;font-weight:900}
    .due{display:inline-block;background:#1E3932;color:#fff;border-radius:100px;padding:5px 14px;font-weight:800;font-size:15px;margin-top:6px}
    .lead{font-size:15px;line-height:1.8;margin:18px 0;color:#3E4843}.box{display:flex;gap:26px;align-items:center;border:2px solid #1E3932;border-radius:18px;padding:22px 26px;margin:20px 0}
    .qr svg{display:block}.steps{flex:1}.st{display:flex;gap:12px;margin:12px 0;font-size:16px;line-height:1.6}.n{flex:none;width:30px;height:30px;border-radius:50%;background:#1E3932;color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center}
    .url{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#5A6560;word-break:break-all;margin-top:10px}.note{font-size:13px;color:#5A6560;line-height:1.7;border-top:1px solid #E3E1DA;padding-top:14px;margin-top:24px}
  </style></head><body>
    <div class="org">${esc(ORG_L[org])} · 가정통신</div>
    <h1>📮 ${esc(f ? f.title : '보호자 정보 확인')}</h1>
    ${f && f.until ? `<div class="due">${esc(dueText(f.until))}까지 부탁드려요</div>` : ''}
    <div class="lead">${esc((f && f.intro) || '학사 안내 · 비상 연락을 위해 보호자 정보를 확인합니다.')}<br>어머님 · 아버님께서 <b>각자</b> 휴대폰으로 써 주세요 (한 분이 함께 쓰셔도 돼요).</div>
    <div class="box"><div class="qr">${qr}</div><div class="steps">
      <div class="st"><span class="n">1</span><span>휴대폰 카메라로 QR을 찍고 <b>«구글로 계속하기»</b></span></div>
      <div class="st"><span class="n">2</span><span>우리 아이 연결 — 가정통신문의 <b>자녀 코드</b>, 없으면 <b>이름 · 생년월일</b></span></div>
      <div class="st"><span class="n">3</span><span>보호자 정보를 쓰고 <b>«보내기»</b> — 마감 전까지 고칠 수 있어요</span></div>
      <div class="url">${esc(link)}</div></div></div>
    <div class="note">· 받은 정보는 학교 선생님이 확인한 뒤 학생 기록에 반영해요. 졸업 후에도 졸업생 명부로 학교가 보관합니다.<br>· 카카오톡에서 링크가 열리면 오른쪽 위 ⋯ → «다른 브라우저로 열기»를 눌러 주세요 (카카오톡 안에서는 구글 로그인이 막혀 있어요).<br>· 궁금한 점은 담임 선생님께 말씀해 주세요.</div>
  </body></html>`;
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(fr);
  fr.srcdoc = html;
  fr.onload = () => {
    const go = () => { try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(e){} setTimeout(() => fr.remove(), 60e3); };
    if(window.FN && window.FN.printAs) window.FN.printAs(['보호자정보확인안내', f ? f.title : '', ORG_L[org]], go); else go();
  };
}

/* ═══ 학부모 사이트 홈의 «부탁 카드» — parentConfig/info_기관 ═══ */
async function syncHome(org){
  const open = S.forms.filter(f => f.org === org && !f.deleted && isOpen(f)).sort((a, b) => String(a.until || '9').localeCompare(String(b.until || '9')));
  const f = open[0];
  try{ await setDoc(doc(C.db, 'parentConfig', 'info_' + org), f ? { open: true, title: f.title || '', until: f.until || '', formId: f.id, at: Timestamp.now() } : { open: false, at: Timestamp.now() }); }
  catch(e){ console.warn('[정보 수집] 홈 카드', e.message); }
}

/* ═══ 그리기 ═══ */
const CSS = `
.ic-link{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--iv);border:1px solid var(--ivd);border-radius:12px;padding:10px 12px;margin-top:8px}
.ic-link code{font-size:12.5px;color:var(--gd);font-weight:700;word-break:break-all;flex:1;min-width:200px}
.ic-link .org{font-size:11px;font-weight:800;color:var(--gm);background:var(--gp);border-radius:100px;padding:2px 9px;white-space:nowrap}
.ic-b{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 12px;border-radius:9px;border:1.5px solid var(--ivd);background:var(--wh);font:inherit;font-size:12.5px;font-weight:800;color:var(--ts);cursor:pointer;white-space:nowrap}
.ic-b:hover{border-color:var(--gm);color:var(--gm)}
.ic-b.g{background:var(--gm);border-color:var(--gm);color:#fff}
.ic-b.dg{color:var(--danger)}
.ic-b:disabled{opacity:.5;cursor:not-allowed}
.ic-forms{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(440px,100%),1fr));gap:10px}
.ic-f{border:1px solid var(--ivd);border-radius:14px;padding:14px 16px;background:var(--wh);display:flex;flex-direction:column;gap:8px}
.ic-f.on{border-color:var(--gm);box-shadow:0 2px 10px rgba(0,112,74,.08)}
.ic-ft{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ic-ft b{font-size:15px;font-weight:900;color:var(--gd)}
.ic-pill{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:11px;font-size:11px;font-weight:800;white-space:nowrap}
.ic-pill.y{background:var(--ok-bg);color:var(--ok)}.ic-pill.n{background:var(--iv);color:var(--tl)}.ic-pill.w{background:var(--warn-bg);color:var(--warn)}.ic-pill.b{background:var(--info-bg,#DBEAFE);color:var(--info,#2563EB)}
.ic-st{display:flex;gap:0;border:1px solid var(--ivd);border-radius:12px;overflow:hidden;background:var(--wh)}
.ic-st div{flex:1;padding:9px 12px;border-right:1px solid var(--ivd);min-width:0}
.ic-st div:last-child{border-right:0}
.ic-st span{display:block;font-size:11px;color:var(--tl);font-weight:700;white-space:nowrap}
.ic-st b{font-size:18px;font-weight:900}
.ic-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ic-dr{border:1px solid var(--ivd);border-radius:12px;background:var(--wh);margin-top:8px;overflow:hidden}
.ic-dh{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;font-size:13.5px;flex-wrap:wrap}
.ic-dh:hover{background:var(--iv)}
.ic-dh .ar{display:inline-block;transition:transform .12s;color:var(--tl)}
.ic-dh.on .ar{transform:rotate(90deg)}
.ic-pg{width:110px;height:6px;border-radius:3px;background:var(--iv);overflow:hidden}.ic-pg i{display:block;height:100%;background:var(--gm)}
.ic-fam{display:grid;grid-template-columns:minmax(150px,1.3fr) repeat(4,minmax(78px,.8fr)) minmax(250px,1.5fr);gap:8px;align-items:center;padding:8px 14px;border-top:1px solid var(--ivd);font-size:13px}
.ic-fam.hd{font-size:11.5px;color:var(--tl);font-weight:800;background:var(--iv)}
.ic-fam .acts{display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap}
.ic-sub{font-size:11px;color:var(--tl);font-weight:600}
@media (max-width:900px){.ic-fam{grid-template-columns:1fr 1fr 1fr}.ic-fam.hd{display:none}.ic-fam .acts{grid-column:1/-1;justify-content:flex-start}}
.ic-claim{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--warn-bg);background:#FFFBEB;border-radius:11px;margin-top:8px;font-size:13px}
.ic-claim .tx{flex:1;min-width:220px;line-height:1.55}
.ic-ov{position:fixed;inset:0;z-index:9000;background:rgba(20,30,26,.42);display:flex;align-items:center;justify-content:center;padding:14px}
.ic-box{background:var(--wh);border-radius:16px;width:min(980px,100%);max-height:94vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.ic-bh{position:sticky;top:0;z-index:2;background:var(--wh);display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--ivd);flex-wrap:wrap}
.ic-bh b{font-size:17px;font-weight:900;color:var(--gd)}
.ic-bb{padding:16px 20px}
.ic-bf{position:sticky;bottom:0;background:var(--wh);display:flex;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--ivd);flex-wrap:wrap}
.ic-sec{border:1px solid var(--ivd);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.ic-sh{font-size:14px;font-weight:900;display:flex;align-items:center;gap:8px;margin-bottom:10px;color:var(--gd)}
.ic-sh .n{width:22px;height:22px;border-radius:7px;background:var(--gp);color:var(--gm);font-size:12px;display:flex;align-items:center;justify-content:center}
.ic-in{box-sizing:border-box;height:40px;border:1.5px solid var(--ivd);border-radius:9px;padding:0 11px;font:inherit;font-size:14px;background:var(--wh);color:inherit;width:100%}
textarea.ic-in{height:auto;padding:9px 11px;line-height:1.6;resize:vertical}
.ic-chip{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 11px;border-radius:9px;border:1.5px solid var(--ivd);background:var(--wh);font:inherit;font-size:12.5px;font-weight:700;color:var(--ts);cursor:pointer}
.ic-chip.on{background:var(--gp);border-color:var(--gm);color:var(--gm)}
.ic-mx{width:100%;border-collapse:collapse;font-size:13px}
.ic-mx th{font-size:12px;color:var(--tl);font-weight:800;padding:6px;border-bottom:1px solid var(--ivd);text-align:center}
.ic-mx th:first-child,.ic-mx td:first-child{text-align:left}
.ic-mx td{padding:5px 6px;border-bottom:1px solid var(--iv);text-align:center}
.ic-m{display:inline-flex;align-items:center;justify-content:center;min-width:58px;height:28px;border-radius:7px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;font-family:inherit}
.ic-m.v2{background:var(--gm);color:#fff}.ic-m.v1{background:var(--gp);color:var(--gm)}.ic-m.v0{background:var(--iv);color:var(--tl)}
.ic-m:disabled{cursor:not-allowed;opacity:.7}
.ic-cmp{width:100%;border-collapse:collapse;font-size:13px}
.ic-cmp th{font-size:12px;color:var(--tl);font-weight:800;text-align:left;padding:7px 10px;border-bottom:1px solid var(--ivd);background:var(--iv)}
.ic-cmp td{padding:8px 10px;border-bottom:1px solid var(--iv);vertical-align:top}
.ic-cmp tr.ch td{background:#FFF9E6}
.ic-cmp tr.grp td{background:var(--iv);font-size:12px;font-weight:900;color:var(--ts);padding:6px 10px}
.ic-cmp td.k{font-weight:800;white-space:nowrap}
.ic-cmp .old{color:var(--tl)}.ic-cmp .new{font-weight:700}.ic-cmp .sm{color:var(--tl);font-size:12px}
.ic-gv{display:inline-block;margin-left:4px;font-size:10.5px;font-weight:800;color:var(--gm);background:var(--gp);border-radius:5px;padding:0 5px}
.ic-left{border-right:1px solid var(--ivd);min-width:230px;max-width:280px;overflow:auto}
.ic-li{padding:10px 14px;border-bottom:1px solid var(--iv);cursor:pointer;font-size:13px}
.ic-li:hover{background:var(--iv)}.ic-li.on{background:var(--gp);box-shadow:inset 3px 0 0 var(--gm)}
.ic-li small{display:block;color:var(--tl);font-size:11.5px}
.ic-note{font-size:12px;color:var(--ts);background:var(--iv);border-radius:10px;padding:9px 12px;line-height:1.65;margin-top:10px}
.ic-warn{font-size:12.5px;color:#7A4A00;background:var(--warn-bg);border-radius:10px;padding:10px 12px;line-height:1.6;margin-bottom:12px}
.ic-empty{text-align:center;color:var(--tl);padding:28px 10px;font-size:13px;line-height:1.7}
`;
function css(){ if(document.getElementById('ic-css')) return; const st = document.createElement('style'); st.id = 'ic-css'; st.textContent = CSS; document.head.appendChild(st); }
const pill = (on, txt, kind) => `<span class="ic-pill ${on ? (kind || 'y') : 'n'}">${txt}</span>`;
function partPill(fam, p){
  const x = fam.parts[p];
  return x ? pill(true, `${p === 'h' ? '가정' : REL[p].replace(' 보호자', '')} ✓ ${md(x.at)}${x.gv ? ' · G' : ''}`) : pill(false, `${p === 'h' ? '가정' : REL[p].replace(' 보호자', '')} —`);
}
function statePill(fam){
  if(fam.state === 'none') return pill(true, '아직 안 씀', 'w');
  if(fam.pend) return pill(true, '⏳ 연결 확인 전', 'b');
  if(fam.state === 'todo') return pill(true, '반영할 것', 'b');
  const d = fam.docs.map(x => msOf(x.appliedAt)).sort((a, b) => b - a)[0];
  return pill(true, fam.docs.every(x => x.state === 'skipped') ? '넘김' : `반영함${d ? ' ' + md(d) : ''}`, 'n');
}
const famName = fam => fam.stus.map(s => s.name).join(' · ');
const clsLabel = c => c ? [gradeIn(c, (c.students || [])[0]) || c.grade, c.name].filter(Boolean).join(' ') : '반편성에 없음';

export async function render(el, force){
  C.el = el || C.el; css();
  const host = C.el; if(!host) return;
  if(!S.at || force) host.innerHTML = '<div class="acard"><div class="ic-empty">불러오는 중…</div></div>';
  try{ await loadAll(force); }catch(e){ host.innerHTML = `<div class="acard"><div class="ic-empty">불러오지 못했어요: ${esc(e.message || '')}<br>보안 규칙 v43을 게시했는지 확인해 주세요.</div></div>`; return; }
  if(S.view === 'board' && S.forms.some(f => f.id === S.cur)) return renderBoard(host);
  S.view = 'list'; renderList(host);
}
function scopeOrgs(){ const cur = C.orgNow ? C.orgNow() : ''; const orgs = C.orgs(); return cur && orgs.includes(cur) ? [cur] : orgs; }
function linkBoxes(f){
  const orgs = f ? [f.org] : scopeOrgs();
  return orgs.map(o => `<div class="ic-link"><span class="org">${esc(ORG_L[o])}</span><code>${esc(linkOf(o))}</code>
    <button type="button" class="ic-b" data-copy-link="${o}">🔗 링크 복사</button><button type="button" class="ic-b g" data-copy-kakao="${o}">💬 카톡 문구 복사</button><button type="button" class="ic-b" data-flyer="${o}">🖨 QR 안내지</button></div>`).join('');
}
function claimsHTML(){
  const orgs = scopeOrgs();
  const list = S.claims.filter(c => orgs.includes(c.org || 'daniel'));
  if(!list.length) return '';
  const mine = c => { const cl = C.classes().find(x => x.id === c.classId); return C.canManage() || (cl && (cl.teacherUid === C.CU.uid || (cl.deputies || []).includes(C.CU.uid))); };
  return `<div class="acard"><h3 class="actitle">🙋 자녀 연결 확인 요청 <span style="font-size:13px;color:var(--warn)">${list.length}건</span></h3>
    <p class="adesc">코드 없이 <b>자녀 이름 · 생년월일</b>로 찾은 분들이에요. 우리 학생의 보호자가 맞으면 «맞아요»를 눌러 주세요 — 그때 학부모 사이트가 연결되고, 보낸 정보도 반영할 수 있게 돼요. (담임 · 부담임은 «우리 반 학부모»에서도 할 수 있어요)</p>
    ${list.map(c => `<div class="ic-claim"><div class="tx"><b>${esc(c.studentName || '')}</b> <span class="ic-sub">${esc([c.grade, c.className].filter(Boolean).join(' ') || ORG_L[c.org] || '')}</span><br>
      ${esc(c.relText || '보호자')}${c.pname ? ' · ' + esc(c.pname) : ''} · <span style="font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(c.email || '')}</span> <span class="ic-sub">· ${md(msOf(c.at))} 요청${c.full ? ' · ⚠ 보호자 두 분이 이미 연결됨 (관리자만 승인)' : ''}</span></div>
      ${mine(c) ? `<button type="button" class="ic-b g" data-claim="${esc(c.id)}" data-ok="1">✔ 맞아요 — 연결</button><button type="button" class="ic-b dg" data-claim="${esc(c.id)}" data-ok="0">아니에요</button>` : '<span class="ic-sub">담임 · 관리자가 확인해요</span>'}</div>`).join('')}</div>`;
}
function renderList(host){
  const orgs = scopeOrgs();
  const forms = S.forms.filter(f => orgs.includes(f.org));
  const card = f => { const st = stats(f), op = isOpen(f);
    return `<div class="ic-f ${op ? 'on' : ''}">
      <div class="ic-ft"><b>${esc(f.title)}</b>${op ? pill(true, `받는 중 · ${dday(f.until) || '마감 없음'}`) : pill(true, f.status === 'closed' ? '마감함' : '마감 지남', 'n')}${orgs.length > 1 || C.orgs().length > 1 ? `<span class="ic-sub">${esc(ORG_L[f.org])}</span>` : ''}</div>
      <div class="ic-sub">${f.until ? esc(dueText(f.until)) + '까지 · ' : ''}${(f.classIds || []).length ? `반 ${f.classIds.length}개` : '모든 반'} · ${esc(f.createdBy || '')} ${f.createdAt ? md(msOf(f.createdAt)) : ''}</div>
      <div class="ic-st"><div><span>가정</span><b>${st.fam}</b></div><div><span>어머니</span><b style="color:var(--gm)">${st.m}</b></div><div><span>아버지</span><b style="color:var(--gm)">${st.f}</b></div><div><span>아직</span><b style="color:var(--warn)">${st.none}</b></div><div><span>반영할 것</span><b style="color:var(--info,#2563EB)">${st.todo}</b></div></div>
      <div class="ic-bar"><button type="button" class="ic-b g" data-board="${esc(f.id)}">열기 ›</button>
        ${C.canManage() ? `<button type="button" class="ic-b" data-edit="${esc(f.id)}">⚙️ 고치기</button>${op ? `<button type="button" class="ic-b" data-close="${esc(f.id)}">마감하기</button>` : `<button type="button" class="ic-b" data-reopen="${esc(f.id)}">다시 열기</button>`}` : ''}</div>
    </div>`; };
  host.innerHTML = `<div class="acard">
      <h3 class="actitle">📮 보호자 정보 수집</h3>
      <p class="adesc">학부모님께 <b>링크 하나</b>를 보내면, 학부모 사이트에서 구글로 로그인해 우리 아이를 연결하고 <b>어머니 · 아버지 정보를 각자</b> 써 주세요. 받은 내용은 여기서 확인한 뒤 «반영하기»로 학생관리에 넣어요. (교사 선교사 주소는 학부모께 나가지 않아요)</p>
      ${linkBoxes(null)}
      ${C.canManage() ? `<div class="ic-bar" style="margin-top:12px"><button type="button" class="bp" data-new="1">＋ 새 정보 수집</button><span class="ic-sub">받을 항목 · 마감 · 대상 반 · 동의 문구를 정해요</span></div>` : '<div class="ic-note">새 정보 수집 만들기 · 반영하기는 관리자와 학생관리 담당이 해요. 받은 내용은 모든 선생님이 볼 수 있어요.</div>'}
    </div>
    ${claimsHTML()}
    <div class="acard"><h3 class="actitle">수집 목록</h3>
      ${forms.length ? `<div class="ic-forms">${forms.map(card).join('')}</div>` : '<div class="ic-empty">아직 만든 정보 수집이 없어요.</div>'}</div>`;
  bindCommon(host);
}
function bindCommon(host){
  host.querySelectorAll('[data-copy-link]').forEach(b => b.onclick = () => copy(linkOf(b.dataset.copyLink), '🔗 링크를 복사했어요'));
  host.querySelectorAll('[data-copy-kakao]').forEach(b => b.onclick = () => { const o = b.dataset.copyKakao; const f = S.view === 'board' ? S.forms.find(x => x.id === S.cur) : S.forms.filter(x => x.org === o && isOpen(x))[0]; copy(kakaoText(o, f), '💬 카톡 문구를 복사했어요 — 반 단톡방에 붙여 넣으세요'); });
  host.querySelectorAll('[data-flyer]').forEach(b => b.onclick = () => { const o = b.dataset.flyer; const f = S.view === 'board' ? S.forms.find(x => x.id === S.cur) : S.forms.filter(x => x.org === o && isOpen(x))[0]; printFlyer(o, f); });
  host.querySelectorAll('[data-board]').forEach(b => b.onclick = () => { S.view = 'board'; S.cur = b.dataset.board; S.open = new Set(); render(); });
  host.querySelectorAll('[data-new]').forEach(b => b.onclick = () => openEditor(null));
  host.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEditor(S.forms.find(f => f.id === b.dataset.edit)));
  host.querySelectorAll('[data-close]').forEach(b => b.onclick = () => setStatus(b.dataset.close, 'closed'));
  host.querySelectorAll('[data-reopen]').forEach(b => b.onclick = () => setStatus(b.dataset.reopen, 'open'));
  host.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => decideClaim(b.dataset.claim, b.dataset.ok === '1', b));
}
async function setStatus(fid, st){
  const f = S.forms.find(x => x.id === fid); if(!f) return;
  if(st === 'open' && f.until && f.until < today()) return C.toast('마감일이 지났어요 — «⚙️ 고치기»에서 마감일을 먼저 바꿔 주세요', 'err');
  if(st === 'closed' && !confirm(`«${f.title}»을 마감할까요?\n학부모 화면에서 더 이상 보낼 수 없어요 (다시 열 수 있어요).`)) return;
  try{
    await updateDoc(doc(C.db, 'infoForms', fid), { status: st, updatedAt: Timestamp.now(), updatedBy: C.CU.name || '' });
    f.status = st; await syncHome(f.org);
    C.toast(st === 'closed' ? '마감했어요' : '다시 열었어요', 'ok'); render();
  }catch(e){ C.toast('바꾸지 못했어요: ' + e.message, 'err'); }
}
async function decideClaim(id, ok, btn){
  const c = S.claims.find(x => x.id === id); if(!c) return;
  if(!ok && !confirm(`${c.studentName} — ${c.email} 요청을 «아니에요»로 거절할까요?\n이 분이 보낸 정보도 함께 무효가 돼요.`)) return;
  if(btn) btn.disabled = true;
  const j = await gateCall('claimDecide', { id, ok });
  if(j && j.ok){ C.toast(ok ? '✔ 연결했어요' : '거절했어요', 'ok'); S.at = 0; render(); if(C.onClaims) C.onClaims(); return; }
  if(btn) btn.disabled = false;
  const m = { 'full-admin': '보호자 두 분이 이미 연결되어 있어 관리자만 승인할 수 있어요.', 'not-your-class': '우리 반 학생이 아니에요 (담임 · 부담임 · 학생관리 담당 · 관리자만).', done: '이미 처리된 요청이에요.', ended: '졸업 · 자퇴한 학생이에요.', 'no-gate': '출입 서버 주소가 아직 없어요 (학부모 관리 › 연결 현황).' }[j && j.error];
  C.toast(m || ('처리하지 못했어요: ' + ((j && j.error) || '')), 'err');
}

/* ═══ 한 수집의 현황판 ═══ */
function renderBoard(host){
  const f = S.forms.find(x => x.id === S.cur); if(!f){ S.view = 'list'; return renderList(host); }
  const st = stats(f), op = isOpen(f);
  const fams = famsOf(f);
  const byCls = new Map();
  fams.forEach(fam => { const cs = [...new Set(fam.stus.map(s => (classOf(s) || {}).id || ''))];
    cs.forEach(cid => { if(!byCls.has(cid)) byCls.set(cid, []); byCls.get(cid).push(fam); }); });
  const classes = [...byCls.keys()].map(cid => ({ cid, c: C.classes().find(x => x.id === cid) || null }))
    .sort((a, b) => (a.c ? 0 : 1) - (b.c ? 0 : 1) || nat(gradeIn(a.c, ((a.c || {}).students || [])[0]) || (a.c || {}).grade, gradeIn(b.c, ((b.c || {}).students || [])[0]) || (b.c || {}).grade) || nat((a.c || {}).name, (b.c || {}).name));
  const flt = fam => S.filter === 'all' || (S.filter === 'todo' ? fam.state === 'todo' : fam.state === 'none');
  const staffName = uid => { const s = (C.staff ? C.staff() : []).find(x => x.uid === uid); return s ? s.name : ''; };
  const famRow = (fam, cid) => {
    const others = fam.stus.filter(s => ((classOf(s) || {}).id || '') !== cid);
    return `<div class="ic-fam"><div><b>${esc(fam.stus.filter(s => ((classOf(s) || {}).id || '') === cid).map(s => s.name).join(' · '))}</b>${others.length ? `<div class="ic-sub">+ 형제 ${esc(others.map(s => `${clsLabel(classOf(s))} ${s.name}`).join(', '))}</div>` : ''}</div>
      ${partPill(fam, 'm')}${partPill(fam, 'f')}${fam.parts.o ? partPill(fam, 'o') : '<span></span>'}${partPill(fam, 'h')}
      <div class="acts">${statePill(fam)}<button type="button" class="ic-b" data-fam-kakao="${esc(fam.key)}" title="이 가정에 보낼 문구">💬 문구</button>
        ${C.canManage() && fam.state === 'todo' ? `<button type="button" class="ic-b g" data-apply="${esc(fam.key)}">반영 ›</button>` : ''}
        ${C.canManage() && fam.state === 'done' ? `<button type="button" class="ic-b" data-apply="${esc(fam.key)}">보기</button>` : ''}</div></div>`;
  };
  const drawers = classes.map(({ cid, c }) => {
    const list = byCls.get(cid).filter(flt);
    const all = byCls.get(cid), got = all.filter(x => x.state !== 'none').length;
    const on = S.open.has(cid);
    if(!list.length && S.filter !== 'all') return '';
    const cnt = k => all.filter(x => x.parts[k]).length;
    return `<div class="ic-dr"><div class="ic-dh ${on ? 'on' : ''}" data-dr="${esc(cid)}"><span class="ar">›</span><b>${esc(clsLabel(c))}</b><span class="ic-sub">${c && c.teacherUid ? esc(staffName(c.teacherUid)) + ' · ' : ''}${all.length}가정</span>
      <span style="flex:1"></span><span class="ic-sub">어머니 ${cnt('m')} · 아버지 ${cnt('f')} · 가정 ${cnt('h')}</span><div class="ic-pg"><i style="width:${all.length ? Math.round(got / all.length * 100) : 0}%"></i></div>
      <button type="button" class="ic-b" data-cls-kakao="${esc(cid)}">💬 아직인 가정 문구</button></div>
      ${on ? `<div class="ic-fam hd"><span>가정</span><span>어머니</span><span>아버지</span><span>그 외</span><span>가정</span><span></span></div>${list.map(x => famRow(x, cid)).join('') || '<div class="ic-empty" style="padding:12px">없어요</div>'}` : ''}</div>`;
  }).join('');
  host.innerHTML = `<div class="acard">
      <div class="ic-bar" style="margin-bottom:6px"><button type="button" class="ic-b" data-back="1">← 목록</button><span class="ic-sub">📮 정보 수집 ›</span>
        <b style="font-size:18px;font-weight:900;color:var(--gd)">${esc(f.title)}</b>${op ? pill(true, `받는 중 · ${dday(f.until) || '마감 없음'}`) : pill(true, f.status === 'closed' ? '마감함' : '마감 지남', 'n')}
        <span style="flex:1"></span>
        ${C.canManage() ? `<button type="button" class="ic-b" data-edit="${esc(f.id)}">⚙️ 고치기</button>${op ? `<button type="button" class="ic-b" data-close="${esc(f.id)}">마감하기</button>` : `<button type="button" class="ic-b" data-reopen="${esc(f.id)}">다시 열기</button>`}` : ''}
        <button type="button" class="ic-b" data-xls="1">⬇ 받은 내용 엑셀</button>
        ${C.canManage() ? `<button type="button" class="ic-b g" data-apply-next="1" ${st.todo ? '' : 'disabled'}>✔ 반영할 것 ${st.todo}가정</button>` : ''}</div>
      <div class="ic-sub" style="margin-bottom:8px">${f.until ? esc(dueText(f.until)) + '까지 · ' : ''}${(f.classIds || []).length ? `대상 반 ${f.classIds.length}개` : '모든 반'} · ${esc(ORG_L[f.org])}${f.intro ? ' · ' + esc(f.intro) : ''}</div>
      ${linkBoxes(f)}
      <div class="ic-st" style="margin-top:12px"><div><span>가정</span><b>${st.fam}</b></div><div><span>어머니 보냄</span><b style="color:var(--gm)">${st.m}</b></div><div><span>아버지 보냄</span><b style="color:var(--gm)">${st.f}</b></div><div><span>가정 정보</span><b style="color:var(--gm)">${st.h}</b></div><div><span>아무도 안 씀</span><b style="color:var(--warn)">${st.none}</b></div><div><span>반영할 것</span><b style="color:var(--info,#2563EB)">${st.todo}</b></div><div><span>반영함</span><b>${st.done}</b></div></div>
      ${C.canManage() && st.todo ? `<div class="ic-bar" style="margin-top:10px"><button type="button" class="ic-b" data-bulk="1">비어 있는 칸만 한꺼번에 채우기</button><span class="ic-sub">학생관리에 아직 없는 칸만 받은 값으로 채워요 (있는 값은 그대로 · 연결 확인 전 요청자가 보낸 것은 빼고)</span></div>` : ''}
    </div>
    ${claimsHTML()}
    <div class="acard"><div class="ic-bar"><b style="font-size:14px">반마다</b><span class="ic-sub">서랍을 열면 가정마다 · 형제는 한 가정</span><span style="flex:1"></span>
      ${[['all', '모두'], ['none', '아직 안 쓴 가정'], ['todo', '반영할 것']].map(([k, l]) => `<button type="button" class="ic-chip ${S.filter === k ? 'on' : ''}" data-flt="${k}">${l}</button>`).join('')}
      <button type="button" class="ic-b" data-all-open="1">${S.open.size ? '모두 접기' : '모두 펼치기'}</button></div>
      ${drawers || '<div class="ic-empty">대상 학생이 없어요.</div>'}</div>`;
  bindCommon(host);
  host.querySelector('[data-back]').onclick = () => { S.view = 'list'; render(); };
  host.querySelectorAll('[data-dr]').forEach(b => b.onclick = e => { if(e.target.closest('button')) return; const k = b.dataset.dr; if(S.open.has(k)) S.open.delete(k); else S.open.add(k); renderBoard(host); });
  host.querySelectorAll('[data-flt]').forEach(b => b.onclick = () => { S.filter = b.dataset.flt; if(S.filter !== 'all') S.open = new Set(classes.map(x => x.cid)); renderBoard(host); });
  host.querySelector('[data-all-open]').onclick = () => { S.open = S.open.size ? new Set() : new Set(classes.map(x => x.cid)); renderBoard(host); };
  host.querySelectorAll('[data-fam-kakao]').forEach(b => b.onclick = () => { const fam = fams.find(x => x.key === b.dataset.famKakao); copy(kakaoText(f.org, f, famName(fam)), '💬 이 가정 문구를 복사했어요'); });
  host.querySelectorAll('[data-cls-kakao]').forEach(b => b.onclick = () => { const list = (byCls.get(b.dataset.clsKakao) || []).filter(x => x.state === 'none');
    if(!list.length) return C.toast('이 반은 모든 가정이 보냈어요 🎉', 'ok');
    copy(kakaoText(f.org, f, list.map(famName).join(', ')), `💬 아직인 ${list.length}가정 문구를 복사했어요`); });
  host.querySelector('[data-xls]').onclick = () => exportAns(f);
  host.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => openApply(f, b.dataset.apply));
  const nx = host.querySelector('[data-apply-next]'); if(nx) nx.onclick = () => { const t = fams.find(x => x.state === 'todo'); if(t) openApply(f, t.key); };
  const bk = host.querySelector('[data-bulk]'); if(bk) bk.onclick = () => bulkFill(f);
}

/* ═══ 받은 내용 엑셀 ═══ */
async function exportAns(f){
  const ans = answersOf(f.id).slice().sort((a, b) => msOf(a.at) - msOf(b.at));
  if(!ans.length) return C.toast('아직 받은 내용이 없어요', 'err');
  const byId = new Map(C.students().map(s => [s.id, s]));
  const custom = Array.isArray(f.custom) ? f.custom : [];
  const head = ['학생', '반', '보낸 계정', '보낸 때', '쓴 분', '어머니 성함', '어머니 휴대폰', '어머니 구글 메일', '어머니 메일 확인', '어머니 직장',
    '아버지 성함', '아버지 휴대폰', '아버지 구글 메일', '아버지 메일 확인', '아버지 직장', '그 외 관계', '그 외 성함', '그 외 휴대폰', '그 외 메일',
    '집 주소', '상세 주소', '비상 연락처', '집 전화', ...custom.map(c => c.label), '상태', '연결 확인'];
  const P = (a, p, k) => ((a.parts || {})[p] || {})[k] || '';
  const rows = ans.map(a => {
    const kids = (a.sids || []).map(id => byId.get(id) || (a.kids || []).find(k => k.sid === id) || { name: id });
    return [kids.map(k => k.name).join(' · '), [...new Set(kids.map(k => { const c = k.id ? classOf(k) : null; return c ? clsLabel(c) : [k.grade, k.className].filter(Boolean).join(' '); }))].join(' · '),
      a.email || '', ymd(msOf(a.updatedAt || a.at)) + ' ' + new Date(msOf(a.updatedAt || a.at)).toTimeString().slice(0, 5), REL[a.who] || '',
      P(a, 'm', 'name'), P(a, 'm', 'phone'), P(a, 'm', 'gmail'), P(a, 'm', 'gv') ? '구글 확인' : '', P(a, 'm', 'work'),
      P(a, 'f', 'name'), P(a, 'f', 'phone'), P(a, 'f', 'gmail'), P(a, 'f', 'gv') ? '구글 확인' : '', P(a, 'f', 'work'),
      P(a, 'o', 'rel'), P(a, 'o', 'name'), P(a, 'o', 'phone'), P(a, 'o', 'gmail'),
      a.skipH ? '(다른 보호자가 보낸 것)' : P(a, 'h', 'addr'), P(a, 'h', 'addr2'), P(a, 'h', 'emerg'), P(a, 'h', 'homeTel'),
      ...custom.map(c => (((a.parts || {}).h || {}).custom || {})[c.id] || ''),
      a.state === 'applied' ? '반영함' : a.state === 'skipped' ? '넘김' : '새로', (a.pend || []).length ? '확인 전' : ''];
  });
  try{
    const name = await writeXlsx([{ name: '받은 내용', head, rows, widths: head.map((h, i) => i === 0 ? 16 : /메일|주소|계정/.test(h) ? 24 : /휴대폰|연락처|전화|때/.test(h) ? 15 : 11) }], ['보호자정보수집', f.title, ORG_L[f.org]]);
    C.toast('⬇ ' + name, 'ok');
  }catch(e){ C.toast(e.message, 'err'); }
}

/* ═══ 만들기 · 고치기 ═══ */
function consentText(org, fields, custom){
  const pick = (p, ks) => ks.filter(k => Number((fields[p] || {})[k] || 0)).map(k => FL[k] + (Number(fields[p][k]) === 1 ? '(선택)' : ''));
  const ppl = [...new Set(['m', 'f', 'o'].flatMap(p => pick(p, PERSON[p])))];
  const home = pick('h', HOME).filter(x => !/상세 주소/.test(x));
  const items = [ppl.length ? `보호자(어머니 · 아버지 · 그 외) ${ppl.join(' · ')}` : '', home.join(' · '), (custom || []).map(c => c.label).filter(Boolean).join(' · '), '로그인한 계정의 메일 주소'].filter(Boolean).join(' / ');
  return `[개인정보 수집 · 이용 동의]
■ 수집하는 곳: ${ORG_L[org]}
■ 수집 항목: ${items}
■ 이용 목적: 학사 안내 · 비상 연락 · 학부모 사이트(가정통신문 · 게시판) · 학교 공유 문서와 캘린더 안내
■ 보관 기간: 재학 중 보관하며, 졸업 후에도 졸업생 명부로 학교가 계속 보관합니다.
■ 동의하지 않을 권리: 동의하지 않으셔도 됩니다. 다만 이 경우 학교 안내 · 비상 연락이 늦어지거나 학부모 사이트 · 공유 문서를 쓰기 어려울 수 있습니다.
■ 내 정보 확인 · 고치기: 담임 선생님이나 학교로 말씀해 주시면 바로 확인 · 고쳐 드립니다.`;
}
function openEditor(f0){
  if(!C.canManage()) return;
  const orgs = C.orgs();
  const locked = !!(f0 && (S.ans.get(f0.id) || []).length);
  const E = f0 ? { org: f0.org, title: f0.title || '', intro: f0.intro || '', until: f0.until || '', classIds: (f0.classIds || []).slice(), fields: JSON.parse(JSON.stringify(f0.fields || DEF_FIELDS())), custom: (f0.custom || []).map(c => Object.assign({}, c)), consent: f0.consent || '' }
    : { org: scopeOrgs()[0] || orgs[0] || 'daniel', title: `${new Date().getMonth() < 7 ? '1' : '2'}학기 보호자 정보 확인`, intro: '학사 안내 · 비상 연락을 위해 보호자 정보를 확인합니다. 어머님 · 아버님께서 각자 써 주세요.', until: ymd(Date.now() + 9 * 864e5), classIds: [], fields: DEF_FIELDS(), custom: [], consent: '' };
  let consentTouched = !!(f0 && f0.consent);
  if(!E.consent) E.consent = consentText(E.org, E.fields, E.custom);
  const ov = document.createElement('div'); ov.className = 'ic-ov';
  const yearCls = () => { const all = C.classes().filter(c => !c.deleted && (c.org || 'daniel') === E.org); const y = Math.max(0, ...all.map(c => Number(c.year || 0))); return all.filter(c => Number(c.year || 0) === y).sort((a, b) => nat(gradeIn(a, (a.students || [])[0]) || a.grade, gradeIn(b, (b.students || [])[0]) || b.grade) || nat(a.name, b.name)); };
  const save = () => {
    ov.querySelectorAll('[data-e]').forEach(el => { E[el.dataset.e] = el.value; });
    ov.querySelectorAll('[data-cl]').forEach(el => { const i = +el.dataset.cl; if(E.custom[i]) E.custom[i].label = el.value; });
  };
  const paint = () => {
    const cls = yearCls();
    const fakeF = { id: '__', org: E.org, classIds: E.classIds };
    const stus = targets(fakeF), fams = families(stus).length;
    ov.innerHTML = `<div class="ic-box" role="dialog" aria-label="정보 수집 만들기">
      <div class="ic-bh"><b>${f0 ? '⚙️ 정보 수집 고치기' : '＋ 새 정보 수집'}</b><span class="ic-sub">학부모 화면: ${esc(linkOf(E.org))}</span><span style="flex:1"></span><button type="button" class="ic-b" data-x>닫기</button></div>
      <div class="ic-bb">
        <div class="ic-sec"><div class="ic-sh"><span class="n">1</span>제목 · 마감 · 안내 글</div>
          ${orgs.length > 1 && !f0 ? `<div class="ic-bar" style="margin-bottom:8px">${orgs.map(o => `<button type="button" class="ic-chip ${E.org === o ? 'on' : ''}" data-org="${o}">${esc(ORG_L[o])}</button>`).join('')}</div>` : ''}
          <div style="display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:10px"><input class="ic-in" data-e="title" value="${esc(E.title)}" placeholder="제목 (학부모 화면 맨 위)" maxlength="40"><input class="ic-in" type="date" data-e="until" value="${esc(E.until)}" title="마감일 (그날까지 받아요)"></div>
          <textarea class="ic-in" data-e="intro" rows="2" style="margin-top:8px" placeholder="안내 글 (학부모 화면 제목 아래)" maxlength="300">${esc(E.intro)}</textarea></div>
        <div class="ic-sec"><div class="ic-sh"><span class="n">2</span>대상 — 반편성의 반 <span class="ic-sub">(아무것도 안 고르면 모든 반 · 형제는 한 가정)</span></div>
          <div class="ic-bar"><button type="button" class="ic-chip ${!E.classIds.length ? 'on' : ''}" data-cls="*">✓ 모든 반</button>${cls.map(c => `<button type="button" class="ic-chip ${E.classIds.includes(c.id) ? 'on' : ''}" data-cls="${esc(c.id)}">${E.classIds.includes(c.id) ? '✓ ' : ''}${esc(clsLabel(c))} <span class="ic-sub">${(c.students || []).length}</span></button>`).join('')}</div>
          <div class="ic-sub" style="margin-top:8px">재학 · 휴학 <b>${stus.length}명</b> → <b>가정 ${fams}곳</b></div></div>
        <div class="ic-sec"><div class="ic-sh"><span class="n">3</span>받을 항목 <span class="ic-sub">칸을 누르면 받기 → 필수 → 안 받기${locked ? ' · 🔒 이미 받은 내용이 있어 바꿀 수 없어요' : ''}</span></div>
          <table class="ic-mx"><thead><tr><th>항목</th><th>어머니</th><th>아버지</th><th>그 외 보호자</th><th>가정 (한 번)</th></tr></thead><tbody>
          ${MATRIX.map(([k, l, ps]) => `<tr><td>${esc(l)}</td>${['m', 'f', 'o', 'h'].map(p => { if(!ps.includes(p)) return '<td></td>'; const v = Number((E.fields[p] || {})[k] || 0);
            return `<td><button type="button" class="ic-m v${v}" data-mx="${p}.${k}" ${locked ? 'disabled' : ''}>${v === 2 ? '필수' : v === 1 ? '받기' : '안 받기'}</button></td>`; }).join('')}</tr>`).join('')}
          </tbody></table>
          <div style="margin-top:10px">${E.custom.map((c, i) => `<div class="ic-bar" style="margin-bottom:6px"><input class="ic-in" style="flex:1" data-cl="${i}" value="${esc(c.label)}" placeholder="예: 등하교 차량 이용 (예 · 아니오)" maxlength="60" ${locked ? 'disabled' : ''}><button type="button" class="ic-chip ${c.req ? 'on' : ''}" data-creq="${i}" ${locked ? 'disabled' : ''}>${c.req ? '필수' : '선택'}</button>${locked ? '' : `<button type="button" class="ic-b dg" data-cdel="${i}">✕</button>`}</div>`).join('')}
            ${locked ? '' : '<button type="button" class="ic-chip" data-cadd="1">＋ 항목 직접 더하기</button> <span class="ic-sub">가정마다 한 번 · 글 한 줄로 받아요</span>'}</div>
          <div class="ic-note">어머니 · 아버지 칸은 <b>쓰는 분이 고른 칸만</b> 필수가 돼요 (어머니가 자기 정보만 보내도 돼요). 그 외 보호자는 할머니 · 이모 등이 쓸 때만.</div></div>
        <div class="ic-sec"><div class="ic-sh"><span class="n">4</span>개인정보 수집 · 이용 동의 <span class="ic-sub">학부모 화면 맨 아래 · 동의해야 보낼 수 있어요</span><span style="flex:1"></span><button type="button" class="ic-b" data-regen="1">↻ 고른 항목으로 다시 쓰기</button></div>
          <textarea class="ic-in" data-e="consent" rows="8" style="font-size:12.5px">${esc(E.consent)}</textarea></div>
      </div>
      <div class="ic-bf"><span class="ic-sub" id="ic-emsg">${f0 ? '고친 내용은 학부모 화면에 바로 반영돼요.' : '만들면 바로 «받는 중» — 링크는 기관마다 하나 그대로예요.'}</span><span style="flex:1"></span><button type="button" class="ic-b" data-x>취소</button><button type="button" class="ic-b g" data-save="1">${f0 ? '저장' : '만들기 (받기 시작)'}</button></div>
    </div>`;
    ov.querySelectorAll('[data-x]').forEach(b => b.onclick = () => ov.remove());
    ov.querySelectorAll('[data-org]').forEach(b => b.onclick = () => { save(); E.org = b.dataset.org; E.classIds = []; if(!consentTouched) E.consent = consentText(E.org, E.fields, E.custom); paint(); });
    ov.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { save(); const id = b.dataset.cls; if(id === '*') E.classIds = []; else E.classIds = E.classIds.includes(id) ? E.classIds.filter(x => x !== id) : [...E.classIds, id]; paint(); });
    ov.querySelectorAll('[data-mx]').forEach(b => b.onclick = () => { save(); const [p, k] = b.dataset.mx.split('.'); E.fields[p] = E.fields[p] || {}; E.fields[p][k] = ((Number(E.fields[p][k] || 0)) + 1) % 3; if(!consentTouched) E.consent = consentText(E.org, E.fields, E.custom); paint(); });
    ov.querySelectorAll('[data-creq]').forEach(b => b.onclick = () => { save(); const c = E.custom[+b.dataset.creq]; c.req = !c.req; paint(); });
    ov.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => { save(); E.custom.splice(+b.dataset.cdel, 1); if(!consentTouched) E.consent = consentText(E.org, E.fields, E.custom); paint(); });
    const ca = ov.querySelector('[data-cadd]'); if(ca) ca.onclick = () => { save(); E.custom.push({ id: 'c' + Date.now().toString(36), label: '', req: false }); paint(); setTimeout(() => { const l = ov.querySelectorAll('[data-cl]'); if(l.length) l[l.length - 1].focus(); }, 30); };
    ov.querySelector('[data-regen]').onclick = () => { save(); E.consent = consentText(E.org, E.fields, E.custom.filter(c => c.label.trim())); consentTouched = false; paint(); };
    ov.querySelector('[data-e=consent]').oninput = () => { consentTouched = true; };
    ov.querySelector('[data-save]').onclick = async e => {
      save();
      const msg = ov.querySelector('#ic-emsg'); const bad = t => { msg.textContent = '⚠ ' + t; msg.style.color = 'var(--danger)'; };
      E.title = E.title.trim(); E.custom = E.custom.map(c => ({ id: c.id, label: String(c.label || '').trim(), req: !!c.req })).filter(c => c.label);
      if(!E.title) return bad('제목을 써 주세요.');
      if(!E.until) return bad('마감일을 골라 주세요.');
      if(!f0 && E.until < today()) return bad('마감일이 이미 지났어요.');
      if(!['m', 'f', 'o'].some(p => Object.values(E.fields[p] || {}).some(v => Number(v) > 0))) return bad('받을 항목을 하나 이상 골라 주세요.');
      if(!E.consent.trim()) return bad('동의 문구를 써 주세요.');
      const btn = e.currentTarget; btn.disabled = true;
      const data = { title: E.title, intro: E.intro.trim(), until: E.until, classIds: E.classIds, consent: E.consent.trim(), updatedAt: Timestamp.now(), updatedBy: C.CU.name || '' };
      if(!locked){ data.fields = E.fields; data.custom = E.custom; }
      try{
        if(f0){ await updateDoc(doc(C.db, 'infoForms', f0.id), data); Object.assign(f0, data); }
        else {
          const ref = doc(collection(C.db, 'infoForms'));
          const full = Object.assign({ org: E.org, status: 'open', fields: E.fields, custom: E.custom, createdAt: Timestamp.now(), createdBy: C.CU.name || '', createdByUid: C.CU.uid }, data);
          await setDoc(ref, full); S.forms.unshift(Object.assign({ id: ref.id }, full)); S.ans.set(ref.id, []);
          S.view = 'board'; S.cur = ref.id;
          try{ C.logActivity && C.logActivity('입력', '정보 수집', E.title); }catch(err){}
        }
        await syncHome(f0 ? f0.org : E.org);
        ov.remove(); C.toast(f0 ? '저장했어요' : '📮 만들었어요 — 링크 · 카톡 문구를 보내 주세요', 'ok'); render();
      }catch(err){ btn.disabled = false; bad('저장하지 못했어요: ' + err.message + (err.code === 'permission-denied' ? ' (보안 규칙 v43 게시 · 학생관리 담당인지 확인)' : '')); }
    };
  };
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  paint(); document.body.appendChild(ov);
}

/* ═══ 반영하기 ═══ */
const curPerson = (s, p, k) => gv0(s, p, k);
const curHome = (s, k, label) => k === 'addr' ? (s.address || '') : k === 'emerg' ? (s.emergency || '') : k === 'homeTel' ? (s.homeTel || '') : k === 'x' ? (((s.infoExtra || {})[label]) || '') : '';
const addrOf = h => [h.addr, h.addr2].filter(Boolean).join(', ');
/* 한 가정의 비교 줄 — 받은 문서가 여럿이면 최근 것을 먼저 · 같은 칸은 최근 것만 체크 */
function compareRows(f, fam, onlyEmpty){
  // 받은 문서마다 «확인을 마친 자녀»에게만 — 확인 전 요청자가 보낸 값은 줄로 나오지 않음
  const ready = fam.docs.filter(d => d.state !== 'void').map(d => ({ d, vs: verifiedOf(d).filter(x => fam.sids.includes(x)) })).filter(x => x.vs.length);
  const sids = [...new Set(ready.flatMap(x => x.vs))];
  const stus = sids.map(id => fam.stus.find(s => s.id === id)).filter(Boolean);
  const rows = [];
  const pickCur = (vs, fn) => { const vals = [...new Set(vs.map(id => fam.stus.find(s => s.id === id)).filter(Boolean).map(fn).map(norm))]; return { v: vals[0] || '', diff: vals.length > 1 }; };
  const sorted = ready.slice().sort((a, b) => msOf(b.d.updatedAt || b.d.at) - msOf(a.d.updatedAt || a.d.at));
  const firstOf = {};   // 칸마다 가장 최근 문서만 미리 체크
  ['m', 'f', 'o'].forEach(p => {
    sorted.filter(x => x.d.parts && x.d.parts[p]).forEach(({ d, vs }) => {
      const at = msOf(d.updatedAt || d.at);
      const glabel = `${REL[p]} · ${d.email} · ${md(at)}${d.who === p ? ' (본인)' : ''}${vs.length < fam.sids.length && fam.sids.length > 1 ? ' — ' + vs.map(id => (fam.stus.find(s => s.id === id) || {}).name).join(' · ') + '만' : ''}`;
      PERSON[p].forEach(k => {
        const v = norm(d.parts[p][k]); if(!v) return;
        const cur = pickCur(vs, s => curPerson(s, p, k));
        const eq = same(cur.v, v) && !cur.diff;
        const key = p + '.' + k, first = !firstOf[key]; firstOf[key] = 1;
        rows.push({ grp: `${p}:${d.id}`, glabel, kind: 'p', p, k, label: FL[k], cur: cur.v, curDiff: cur.diff, val: v, sids: vs,
          gv: k === 'gmail' && !!d.parts[p].gv, eq, on: !eq && first && (!onlyEmpty || (!cur.v && !cur.diff)) && d.state === 'new' });
      });
    });
  });
  sorted.filter(x => x.d.parts && x.d.parts.h).forEach(({ d, vs }) => {
    const h = d.parts.h, at = msOf(d.updatedAt || d.at);
    const glabel = `가정 · ${d.email} · ${md(at)}`;
    const push = (k, label, v, curFn, extra) => { v = norm(v); if(!v) return; const cur = pickCur(vs, curFn); const eq = same(cur.v, v) && !cur.diff;
      const key = 'h.' + k + (extra && extra.xlabel ? extra.xlabel : ''), first = !firstOf[key]; firstOf[key] = 1;
      rows.push(Object.assign({ grp: `h:${d.id}`, glabel, kind: 'h', k, label, cur: cur.v, curDiff: cur.diff, val: v, sids: vs, eq, on: !eq && first && (!onlyEmpty || (!cur.v && !cur.diff)) && d.state === 'new' }, extra || {})); };
    push('addr', '집 주소', addrOf(h), s => s.address || '');
    push('emerg', '비상 연락처', h.emerg, s => s.emergency || '');
    push('homeTel', '집 전화', h.homeTel, s => s.homeTel || '');
    (f.custom || []).forEach(c => push('x', c.label, (h.custom || {})[c.id], s => curHome(s, 'x', c.label), { xlabel: c.label }));
  });
  return { rows, stus, sids };
}
function repDefault(stus, rows){
  const s = stus[0]; if(!s) return 'keep';
  const nameOf = p => { const r = rows.find(x => x.kind === 'p' && x.p === p && x.k === 'name' && x.on); return r ? r.val : curPerson(s, p, 'name'); };
  if(!norm(s.guardian)) return ['m', 'f', 'o'].find(p => nameOf(p)) || 'keep';
  const hit = ['m', 'f', 'o'].find(p => nameOf(p) && same(nameOf(p), s.guardian));
  return hit || 'keep';
}
/* 학생 한 명에게 고른 줄 반영 → 바뀐 것 (updateDoc 데이터 · 이력 글) */
function patchFor(s, rows, rep, f){
  const gds = JSON.parse(JSON.stringify(s.guardians || {}));
  const up = {}, ch = [];
  rows.filter(r => r.on && (!r.sids || r.sids.includes(s.id))).forEach(r => {   // 그 문서가 확인을 마친 자녀에게만
    if(r.kind === 'p'){
      gds[r.p] = gds[r.p] || {};
      const old = gds[r.p][r.k] || '';
      if(same(old, r.val) && !(r.k === 'gmail' && !!gds[r.p].gv !== r.gv)) return;
      gds[r.p][r.k] = r.val; if(r.k === 'gmail') gds[r.p].gv = r.gv;
      gds[r.p].at = Date.now(); gds[r.p].src = 'info';
      ch.push(`${REL[r.p]} ${FL[r.k]}: ${old || '(없음)'} → ${r.val}`);
    } else if(r.k === 'x'){
      const ex = Object.assign({}, up.infoExtra || s.infoExtra || {}); const old = ex[r.xlabel] || '';
      if(same(old, r.val)) return; ex[r.xlabel] = r.val; up.infoExtra = ex; ch.push(`${r.xlabel}: ${old || '(없음)'} → ${r.val}`);
    } else {
      const field = r.k === 'addr' ? 'address' : r.k === 'emerg' ? 'emergency' : 'homeTel';
      const old = s[field] || ''; if(same(old, r.val)) return;
      up[field] = r.val; ch.push(`${r.label}: ${old || '(없음)'} → ${r.val}`);
    }
  });
  if(rep && rep !== 'keep' && gds[rep]){
    const nm = gds[rep].name || '', ph = gds[rep].phone || '';
    if(nm && (!same(nm, s.guardian) || (ph && !same(ph, s.guardianPhone)))){
      ch.push(`대표 보호자: ${s.guardian || '(없음)'}${s.guardianPhone ? ' ' + s.guardianPhone : ''} → ${nm}${ph ? ' ' + ph : ''} (${REL[rep]})`);
      up.guardian = nm; if(ph) up.guardianPhone = ph;
    }
    if(s.guardianMain !== rep){ up.guardianMain = rep; }
  }
  if(ch.length || JSON.stringify(gds) !== JSON.stringify(s.guardians || {})) up.guardians = gds;
  if(ch.length) up.history = [...(s.history || []), { at: Date.now(), by: C.CU.name || '', changes: [`📮 정보 수집 반영 «${f.title}»`, ...ch] }];
  return { up, ch };
}
async function applyFam(f, fam, rows, rep, sids){
  let n = 0, changed = 0;
  for(const sid of sids){
    const s = C.students().find(x => x.id === sid); if(!s) continue;
    const { up, ch } = patchFor(s, rows, rep, f);
    if(Object.keys(up).length){ await updateDoc(doc(C.db, 'students', sid), up); Object.assign(s, up); }
    if(ch.length) changed += ch.length; n++;
  }
  // 받은 문서 — 확인 기다림이 없는 것은 «반영함»
  for(const d of fam.docs.filter(x => x.state === 'new')){
    const done = verifiedOf(d).filter(x => sids.includes(x));
    if(!done.length) continue;   // 확인 전 자녀 몫만 있는 문서는 그대로 (담임 확인 뒤에 반영)
    const data = { appliedAt: Timestamp.now(), appliedBy: C.CU.name || '', appliedByUid: C.CU.uid, appliedSids: done };
    if(!(d.pend || []).length) data.state = 'applied';
    await updateDoc(doc(C.db, 'infoAns', d.id), data); Object.assign(d, data);
  }
  return { n, changed };
}
function openApply(f, key){
  let fams = famsOf(f);
  let fam = fams.find(x => x.key === key); if(!fam) return;
  const ov = document.createElement('div'); ov.className = 'ic-ov';
  let R = null, rep = 'keep';
  const load = () => { const c = compareRows(f, fam, false); R = c; rep = repDefault(c.stus, c.rows); };
  load();
  const paint = () => {
    const todo = fams.filter(x => x.state === 'todo');
    const pendSids = [...new Set(fam.docs.flatMap(d => d.pend || []))];
    const claims = S.claims.filter(c => pendSids.includes(c.studentId) && fam.docs.some(d => d.uid === c.uid));
    const groups = []; R.rows.forEach(r => { if(!groups.includes(r.grp)) groups.push(r.grp); });
    const cnt = R.rows.filter(r => r.on).length;
    const avail = ['m', 'f', 'o'].filter(p => R.rows.some(r => r.kind === 'p' && r.p === p && r.k === 'name') || (R.stus[0] && curPerson(R.stus[0], p, 'name')));
    const s0 = R.stus[0] || fam.stus[0];
    ov.innerHTML = `<div class="ic-box" style="width:min(1180px,100%)">
      <div class="ic-bh"><b>✔ 반영하기</b><span class="ic-sub">${esc(f.title)}</span><span style="flex:1"></span><button type="button" class="ic-b" data-x>닫기</button></div>
      <div style="display:flex;min-height:420px">
        <div class="ic-left">${(todo.length ? todo : [fam]).map(x => `<div class="ic-li ${x.key === fam.key ? 'on' : ''}" data-pick="${esc(x.key)}"><b>${esc(famName(x))}</b><small>${['m', 'f', 'o', 'h'].filter(p => x.parts[p]).map(p => REL[p].replace(' 보호자', '')).join(' · ')}${x.pend ? ' · ⏳ 확인 전' : ''}</small></div>`).join('')}
          ${!todo.some(x => x.key === fam.key) ? '' : ''}</div>
        <div style="flex:1;min-width:0;padding:16px 20px">
          <div class="ic-bar" style="margin-bottom:10px"><b style="font-size:16px">${esc(famName(fam))} 가정</b><span class="ic-sub">${esc([...new Set(fam.stus.map(s => clsLabel(classOf(s))))].join(' · '))}${R.stus.length > 1 ? ` — 형제 ${R.stus.length}명 모두 같은 값으로` : ''}</span></div>
          ${claims.length ? `<div class="ic-warn">⏳ <b>자녀 연결 확인 전</b>이에요 — 이름 · 생년월일로 찾은 분이라, 우리 학생 보호자가 맞는지 먼저 확인해 주세요. 확인 전 학생에게는 반영하지 않아요.
            ${claims.map(c => `<div class="ic-bar" style="margin-top:8px"><span>${esc(c.studentName)} ← ${esc(c.relText || '보호자')}${c.pname ? ' ' + esc(c.pname) : ''} · ${esc(c.email)}</span><button type="button" class="ic-b g" data-claim2="${esc(c.id)}" data-ok="1">✔ 맞아요 — 연결</button><button type="button" class="ic-b dg" data-claim2="${esc(c.id)}" data-ok="0">아니에요</button></div>`).join('')}</div>` : ''}
          ${!R.stus.length ? '<div class="ic-empty">반영할 학생이 없어요 (연결 확인 전).</div>' : `
          <table class="ic-cmp"><thead><tr><th style="width:34px"></th><th style="width:120px">칸</th><th>학생관리 지금</th><th>받은 값</th></tr></thead><tbody>
          ${groups.map(gk => { const rs = R.rows.filter(r => r.grp === gk);
            return `<tr class="grp"><td colspan="4">${esc(rs[0].glabel)}</td></tr>` + rs.map(r => { const i = R.rows.indexOf(r);
              return `<tr class="${r.on ? 'ch' : ''}"><td><input type="checkbox" data-row="${i}" ${r.on ? 'checked' : ''} ${r.eq ? 'disabled' : ''} aria-label="${esc(r.label)} 반영"></td><td class="k">${esc(r.label)}</td>
                <td class="old">${r.curDiff ? '<span class="sm">형제마다 다름</span>' : esc(r.cur || '—')}</td><td>${r.eq ? '<span class="sm">같아요</span>' : `<span class="new">${esc(r.val)}</span>`}${r.gv ? '<span class="ic-gv">✓ 구글 확인</span>' : ''}</td></tr>`; }).join(''); }).join('')}
          <tr class="grp"><td colspan="4">대표 보호자 — 연락처 명단 · 상담 · 학부모 연결 화면이 쓰는 분</td></tr>
          <tr><td></td><td class="k">대표 보호자</td><td class="old">${esc(s0.guardian || '—')}${s0.guardianPhone ? ' · ' + esc(s0.guardianPhone) : ''}</td>
            <td><div class="ic-bar"><button type="button" class="ic-chip ${rep === 'keep' ? 'on' : ''}" data-rep="keep">지금 그대로</button>${avail.map(p => `<button type="button" class="ic-chip ${rep === p ? 'on' : ''}" data-rep="${p}">${REL[p].replace(' 보호자', '')}${rep === p ? '로' : ''}</button>`).join('')}</div></td></tr>
          </tbody></table>`}
        </div></div>
      <div class="ic-bf"><span class="ic-sub">고른 칸 ${cnt}개 · 학생관리 «변경 이력»에 «📮 정보 수집 반영»으로 남아요</span><span style="flex:1"></span>
        ${fam.state === 'todo' ? '<button type="button" class="ic-b" data-skip="1">이번엔 넘기기</button>' : ''}
        <button type="button" class="ic-b g" data-go="1" ${R.stus.length ? '' : 'disabled'}>✔ 고른 것 반영${R.stus.length > 1 ? ` (형제 ${R.stus.length}명)` : ''}</button></div>
    </div>`;
    ov.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { ov.remove(); render(); });
    ov.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { fam = fams.find(x => x.key === b.dataset.pick) || fam; load(); paint(); });
    ov.querySelectorAll('[data-row]').forEach(b => b.onchange = () => { R.rows[+b.dataset.row].on = b.checked; b.closest('tr').classList.toggle('ch', b.checked); ov.querySelector('.ic-bf .ic-sub').textContent = `고른 칸 ${R.rows.filter(r => r.on).length}개 · 학생관리 «변경 이력»에 «📮 정보 수집 반영»으로 남아요`; });
    ov.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { rep = b.dataset.rep; paint(); });
    ov.querySelectorAll('[data-claim2]').forEach(b => b.onclick = async () => { await decideClaim(b.dataset.claim2, b.dataset.ok === '1', b); await loadAll(true); fams = famsOf(f); fam = fams.find(x => x.key === fam.key) || fams.find(x => x.sids.some(id => fam.sids.includes(id))) || fam; load(); paint(); });
    const sk = ov.querySelector('[data-skip]'); if(sk) sk.onclick = async () => {
      for(const d of fam.docs.filter(x => x.state === 'new')){ const data = { state: 'skipped', appliedAt: Timestamp.now(), appliedBy: C.CU.name || '', appliedByUid: C.CU.uid }; await updateDoc(doc(C.db, 'infoAns', d.id), data); Object.assign(d, data); }
      C.toast('넘겼어요 — 학생관리는 그대로예요', 'ok'); next();
    };
    const go = ov.querySelector('[data-go]'); if(go) go.onclick = async () => {
      go.disabled = true;
      try{ const r = await applyFam(f, fam, R.rows, rep, R.sids); C.toast(`✔ 반영했어요 — ${r.n}명 · 바뀐 칸 ${r.changed}개`, 'ok'); next(); }
      catch(e){ go.disabled = false; C.toast('반영하지 못했어요: ' + e.message, 'err'); }
    };
  };
  const next = () => { fams = famsOf(f); const t = fams.find(x => x.state === 'todo' && x.key !== fam.key && !x.sids.some(id => fam.sids.includes(id)));
    if(t){ fam = t; load(); paint(); } else { ov.remove(); if(!fams.some(x => x.state === 'todo')) C.toast('🎉 반영할 것이 더 없어요', 'ok'); render(); } };
  ov.addEventListener('click', e => { if(e.target === ov){ ov.remove(); render(); } });
  paint(); document.body.appendChild(ov);
}
/* 비어 있는 칸만 한꺼번에 — 담임 확인 전 요청자가 보낸 것은 빼고 (그 몫은 줄로 나오지 않음) */
async function bulkFill(f){
  const plan = famsOf(f).filter(x => x.state === 'todo').map(fam => { const c = compareRows(f, fam, true); const rep = !norm((c.stus[0] || {}).guardian) ? repDefault(c.stus, c.rows) : 'keep'; return { fam, c, rep, n: c.rows.filter(r => r.on).length }; })
    .filter(x => x.c.sids.length);
  const fams = plan.map(x => x.fam);
  if(!fams.length) return C.toast('한꺼번에 채울 가정이 없어요 (연결 확인 전 가정은 확인부터)', 'err');
  const cells = plan.reduce((a, x) => a + x.n, 0);
  if(!confirm(`${fams.length}가정 — 학생관리에 비어 있는 칸 ${cells}개를 받은 값으로 채울까요?\n이미 있는 값은 그대로 두고, 받은 문서는 «반영함»으로 바뀌어요.`)) return;
  let done = 0, ch = 0;
  try{
    for(const x of plan){ const r = await applyFam(f, x.fam, x.c.rows, x.rep, x.c.sids); done++; ch += r.changed; }
    C.toast(`✔ ${done}가정 · 칸 ${ch}개를 채웠어요`, 'ok');
  }catch(e){ C.toast(`${done}가정까지 채웠어요 — 멈춤: ${e.message}`, 'err'); }
  render();
}

/* ═══ 우리 반 학부모 — 담임 칸 (연결 확인 요청 · 이 반 정보 수집 현황) ═══
   ctx: init 과 같고 students() = 이 반 학생 · classes() = [이 반] */
export async function renderClassPanel(el, cls){
  css(); if(!el || !cls) return;
  const org = cls.org || 'daniel';
  let forms = [], claims = [];
  try{
    const [fq, cq] = await Promise.all([
      getDocs(query(collection(C.db, 'infoForms'), where('org', '==', org))).catch(() => null),
      getDocs(query(collection(C.db, 'parentClaims'), where('classId', '==', cls.id))).catch(() => null),
    ]);
    forms = fq ? fq.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(f => !f.deleted && isOpen(f) && (!(f.classIds || []).length || f.classIds.includes(cls.id))) : [];
    claims = cq ? cq.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(c => c.status === 'pending') : [];
    for(const f of forms){ const q = await getDocs(query(collection(C.db, 'infoAns'), where('formId', '==', f.id))).catch(() => null); S.ans.set(f.id, q ? q.docs.map(d => Object.assign({ id: d.id }, d.data())) : []); }
  }catch(e){ el.innerHTML = ''; return; }
  S.claims = claims;
  if(!forms.length && !claims.length){ el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  const stus = C.students().filter(s => ['active', 'leave'].includes(stOf(s)));
  const fHTML = forms.map(f => { const fams = famsOf(f, stus); const cnt = k => fams.filter(x => x.parts[k]).length; const none = fams.filter(x => x.state === 'none');
    return `<div class="ic-sec" style="margin:10px 0 0"><div class="ic-bar"><b style="font-size:14.5px">📮 ${esc(f.title)}</b>${pill(true, dday(f.until) || '받는 중')}<span style="flex:1"></span><span class="ic-sub">어머니 ${cnt('m')} · 아버지 ${cnt('f')} · 가정 ${cnt('h')} / ${fams.length}가정</span></div>
      <div class="ic-bar" style="margin:8px 0"><button type="button" class="ic-b g" data-cp-kakao="${esc(f.id)}" ${none.length ? '' : 'disabled'}>💬 아직인 가정 문구 복사 (${none.length}가정)</button><button type="button" class="ic-b" data-cp-flyer="${esc(f.id)}">🖨 QR 안내지</button><button type="button" class="ic-b" data-cp-link="1">🔗 링크</button></div>
      ${fams.sort((a, b) => (a.state === 'none' ? 0 : 1) - (b.state === 'none' ? 0 : 1) || nat(famName(a), famName(b))).map(x => `<div class="ic-fam" style="grid-template-columns:minmax(120px,1.2fr) repeat(3,minmax(70px,.8fr)) 140px"><b>${esc(famName(x))}</b>${partPill(x, 'm')}${partPill(x, 'f')}${partPill(x, 'h')}<div class="acts">${x.pend ? pill(true, '⏳ 확인 전', 'b') : ''}<button type="button" class="ic-b" data-cp-fam="${esc(f.id)}|${esc(x.key)}">💬</button></div></div>`).join('')}
      <div class="ic-note">담임은 보냈는지 보고 문구만 보내요 — 받은 내용 확인 · 학생관리 반영은 학생관리 담당 · 관리자가 해요 (학생관리 › 📮 정보 수집).</div></div>`; }).join('');
  el.innerHTML = `<div class="cp-ch"><b>📮 보호자 정보 · 🙋 연결 확인</b></div>
    ${claims.length ? `<div class="ic-warn" style="margin:6px 0 0">🙋 코드 없이 <b>이름 · 생년월일</b>로 우리 반 학생을 찾은 분이에요. 보호자가 맞으면 «맞아요»를 눌러 주세요.</div>
      ${claims.map(c => `<div class="ic-claim"><div class="tx"><b>${esc(c.studentName || '')}</b> ← ${esc(c.relText || '보호자')}${c.pname ? ' ' + esc(c.pname) : ''}<br><span class="ic-sub" style="font-family:ui-monospace,Menlo,monospace">${esc(c.email || '')}</span> <span class="ic-sub">· ${md(msOf(c.at))}${c.full ? ' · ⚠ 보호자 두 분이 이미 연결 (관리자만)' : ''}</span></div>
        <button type="button" class="ic-b g" data-claim="${esc(c.id)}" data-ok="1">✔ 맞아요</button><button type="button" class="ic-b dg" data-claim="${esc(c.id)}" data-ok="0">아니에요</button></div>`).join('')}` : ''}
    ${fHTML}`;
  const redraw = () => renderClassPanel(el, cls);
  C.onClaims = () => { redraw(); };
  el.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => { await decideClaim(b.dataset.claim, b.dataset.ok === '1', b); });
  el.querySelectorAll('[data-cp-kakao]').forEach(b => b.onclick = () => { const f = forms.find(x => x.id === b.dataset.cpKakao); const none = famsOf(f, stus).filter(x => x.state === 'none'); copy(kakaoText(org, f, none.map(famName).join(', ')), `💬 아직인 ${none.length}가정 문구를 복사했어요`); });
  el.querySelectorAll('[data-cp-flyer]').forEach(b => b.onclick = () => printFlyer(org, forms.find(x => x.id === b.dataset.cpFlyer)));
  el.querySelectorAll('[data-cp-link]').forEach(b => b.onclick = () => copy(linkOf(org), '🔗 링크를 복사했어요'));
  el.querySelectorAll('[data-cp-fam]').forEach(b => b.onclick = () => { const [fid, key] = b.dataset.cpFam.split('|'); const f = forms.find(x => x.id === fid); const x = famsOf(f, stus).find(y => y.key === key); copy(kakaoText(org, f, x ? famName(x) : ''), '💬 이 가정 문구를 복사했어요'); });
}
// 시험용
export const _t = { S, famsOf, compareRows, patchFor, consentText, kakaoText, stats };
