/* ═══════════════════════════════════════════════
   parents-list.js — 👪 학부모 명단 · 엑셀 (v156)
   · 학생관리 › 👪 학부모 명단 탭 (예전 «📞 연락처»를 넓힘) · 우리 반 학부모 › «⬇ 우리 반 학부모 명단»
   · 보호자는 학생 문서에 — 대표 보호자(guardian · guardianPhone · 예전 그대로) + guardians.m / .f / .o (어머니 · 아버지 · 그 외)
     집 주소(address) · 비상 연락처(emergency) · 집 전화(homeTel) · 정보 수집으로 받은 추가 항목(infoExtra)
   · 엑셀: 학생마다 · 가정마다(형제 한 줄) · 보호자마다(연락망 · 메일 돌리기) — 칸 묶음을 골라서
   · «학부모 사이트» 칸(연결 계정 · 마지막 접속)은 고를 때만 읽는다
   ═══════════════════════════════════════════════ */
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ORG_L = { daniel: '다니엘 아마츠', jihyebit: '지혜빛 선교원' };
const STATUS_L = { active: '재학', leave: '휴학', quit: '자퇴', grad: '졸업', egrad: '조기졸업' };
const REL = { m: '어머니', f: '아버지', o: '그 외' };
const nat = (a, b) => String(a || '').localeCompare(String(b || ''), 'ko', { numeric: true });
const stOf = s => (window.StuStatus && window.StuStatus.status) ? window.StuStatus.status(s) : (s.status || 'active');
const msOf = t => !t ? 0 : typeof t === 'number' ? t : typeof t.toMillis === 'function' ? t.toMillis() : (t.seconds != null ? t.seconds * 1000 : 0);
const ymd = t => { if(!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const g = (s, p, k) => ((s && s.guardians && s.guardians[p]) || {})[k] || '';

/* 학생의 지금 반 — 같은 기관 · 가장 최근 학년도 */
export function classOfIn(classes, s){
  const list = (classes || []).filter(c => c && !c.deleted && (c.students || []).includes(s.id) && (!c.org || !s.org || c.org === s.org));
  list.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  return list[0] || null;
}
export const gradeIn = (c, sid) => c ? String((c.grades && c.grades[sid]) || c.grade || '') : '';

/* 형제 묶기 (학생관리의 형제 연결) */
export function families(list, extraPairs){
  const ids = new Set(list.map(s => s.id));
  const par = new Map(list.map(s => [s.id, s.id]));
  const find = x => { while(par.get(x) !== x){ par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  const join = (a, b) => { if(!ids.has(a) || !ids.has(b)) return; const ra = find(a), rb = find(b); if(ra !== rb) par.set(ra, rb); };
  list.forEach(s => (s.siblings || []).forEach(b => join(s.id, b)));
  (extraPairs || []).forEach(([a, b]) => join(a, b));
  const m = new Map();
  list.forEach(s => { const r = find(s.id); if(!m.has(r)) m.set(r, []); m.get(r).push(s); });
  return [...m.values()].map(f => f.length > 1 ? f.slice().sort((a, b) => String(a.birth || '9').localeCompare(String(b.birth || '9'))) : f);   // 형제는 큰아이부터
}

/* ── 칸 ── */
function COLS(ctx){
  const cls = s => ctx.classOf(s), cn = s => { const c = cls(s); return c ? String(c.name || '') : ''; };
  const sib = s => (s.siblings || []).map(id => ctx.byId.get(id)).filter(Boolean).map(x => x.name).join(', ');
  const site = s => (ctx.site && ctx.site.get(s.id)) || null;
  return [
    { g: 'stu', k: 'name', l: '학생', w: 10, v: s => s.name || '' },
    { g: 'stu', k: 'gender', l: '성별', w: 5, v: s => s.gender || '' },
    { g: 'stu', k: 'birth', l: '생년월일', w: 11, v: s => s.birth || '' },
    { g: 'stu', k: 'no', l: '학번', w: 9, v: s => s.studentNo || '' },
    { g: 'stu', k: 'org', l: '기관', w: 12, v: s => ORG_L[s.org] || s.org || '' },
    { g: 'stu', k: 'grade', l: '학년', w: 7, v: s => gradeIn(cls(s), s.id) },
    { g: 'stu', k: 'cls', l: '반', w: 10, v: cn },
    { g: 'stu', k: 'st', l: '재적', w: 6, v: s => STATUS_L[stOf(s)] || '' },
    { g: 'rep', k: 'guardian', l: '대표 보호자', w: 10, v: s => s.guardian || '' },
    { g: 'rep', k: 'gphone', l: '대표 연락처', w: 14, v: s => s.guardianPhone || '' },
    ...['m', 'f'].flatMap(p => [
      { g: p, k: p + 'name', l: `${REL[p]} 성함`, w: 10, v: s => g(s, p, 'name') },
      { g: p, k: p + 'phone', l: `${REL[p]} 휴대폰`, w: 14, v: s => g(s, p, 'phone') },
      { g: p, k: p + 'gmail', l: `${REL[p]} 구글 메일`, w: 24, v: s => g(s, p, 'gmail') },
      { g: p, k: p + 'work', l: `${REL[p]} 직장`, w: 14, v: s => g(s, p, 'work') },
    ]),
    { g: 'o', k: 'orel', l: '그 외 보호자 관계', w: 9, v: s => g(s, 'o', 'rel') },
    { g: 'o', k: 'oname', l: '그 외 보호자 성함', w: 10, v: s => g(s, 'o', 'name') },
    { g: 'o', k: 'ophone', l: '그 외 보호자 휴대폰', w: 14, v: s => g(s, 'o', 'phone') },
    { g: 'o', k: 'ogmail', l: '그 외 보호자 메일', w: 22, v: s => g(s, 'o', 'gmail') },
    { g: 'home', k: 'addr', l: '집 주소', w: 34, v: s => s.address || '' },
    { g: 'home', k: 'emerg', l: '비상 연락처', w: 18, v: s => s.emergency || '' },
    { g: 'home', k: 'htel', l: '집 전화', w: 13, v: s => s.homeTel || '' },
    { g: 'home', k: 'sib', l: '형제', w: 14, v: sib },
    { g: 'site', k: 'acc', l: '학부모 사이트 연결 계정', w: 34, v: s => { const x = site(s); return x ? x.list.map(a => a.email + (a.rel ? ` (${a.rel})` : '')).join(', ') : ''; } },
    { g: 'site', k: 'accn', l: '연결 수', w: 7, v: s => { const x = site(s); return x ? x.list.length : 0; } },
    { g: 'site', k: 'seen', l: '마지막 접속', w: 11, v: s => { const x = site(s); return x && x.seen ? ymd(x.seen) : ''; } },
    ...(ctx.extraLabels || []).map((lb, i) => ({ g: 'extra', k: 'x' + i, l: lb, w: 16, v: s => { const e = (s.infoExtra || {})[lb]; return e == null ? '' : (typeof e === 'object' ? (e.v || '') : String(e)); } })),
  ];
}
export const GROUPS = [
  { g: 'stu', l: '학생', must: true }, { g: 'rep', l: '대표 보호자' }, { g: 'm', l: '어머니' }, { g: 'f', l: '아버지' },
  { g: 'o', l: '그 외 보호자' }, { g: 'home', l: '가정 (주소 · 비상 연락처 · 형제)' }, { g: 'site', l: '학부모 사이트 연결' }, { g: 'extra', l: '정보 수집 추가 항목' },
];
const PRESETS = {
  basic: { l: '기본', groups: ['stu', 'rep', 'm', 'f', 'home'], mode: 'stu' },
  call: { l: '📞 연락망', groups: ['stu', 'rep', 'm', 'f'], mode: 'stu' },
  mail: { l: '✉️ 메일 돌리기 (보호자마다)', groups: ['stu'], mode: 'grd' },
  all: { l: '전체', groups: GROUPS.map(x => x.g), mode: 'stu' },
};

/* 학부모 사이트 연결 — 기관마다 연결 문서 · 출입증(마지막 접속) */
async function loadSite(db, orgs, list){
  const out = new Map(); const want = new Set(list.map(s => s.id));
  for(const o of orgs){
    const [ls, pa] = await Promise.all([
      getDocs(query(collection(db, 'parentLinks'), where('org', '==', o))).catch(() => null),
      getDocs(query(collection(db, 'parentAccess'), where('orgs', 'array-contains', o))).catch(() => null),
    ]);
    const seen = new Map(); const rel = new Map();
    if(pa) pa.docs.forEach(d => { const v = d.data(); seen.set(d.id, msOf(v.lastSeenAt)); rel.set(d.id, v.relation || ''); });
    if(ls) ls.docs.forEach(d => { const l = d.data(); if(l.status !== 'active' || !want.has(l.studentId)) return;
      const e = out.get(l.studentId) || { list: [], seen: 0 };
      e.list.push({ email: l.parentEmail || '(메일 없음)', rel: rel.get(l.parentUid) || '' });
      e.seen = Math.max(e.seen, seen.get(l.parentUid) || 0); out.set(l.studentId, e); });
  }
  return out;
}

/* ── 행 만들기 ── */
export function build(list, opt, ctx){
  const cols = COLS(ctx).filter(c => opt.groups.includes(c.g));
  const sorted = list.slice().sort((a, b) => nat(a.org, b.org) || nat(gradeIn(ctx.classOf(a), a.id), gradeIn(ctx.classOf(b), b.id)) || nat((ctx.classOf(a) || {}).name, (ctx.classOf(b) || {}).name) || nat(a.name, b.name));
  if(opt.mode === 'grd'){
    // 보호자마다 한 줄 — 형제는 한 가정으로 (같은 분이 두 번 나오지 않게)
    const head = ['학생', '반', '관계', '성함', '휴대폰', '구글 메일', '직장', '대표', '집 주소'];
    const rows = [];
    families(sorted).forEach(fam => {
      const kids = fam.map(s => s.name).join(' · ');
      const cls = [...new Set(fam.map(s => [gradeIn(ctx.classOf(s), s.id), (ctx.classOf(s) || {}).name].filter(Boolean).join(' ')).filter(Boolean))].join(' · ');
      const src = fam.find(s => s.guardians && Object.keys(s.guardians).length) || fam[0];
      let n = 0; const names = [];
      ['m', 'f', 'o'].forEach(p => {
        const name = g(src, p, 'name'), phone = g(src, p, 'phone');
        if(!name && !phone) return;
        n++; names.push(String(name).replace(/\s/g, ''));
        rows.push([kids, cls, p === 'o' ? (g(src, 'o', 'rel') || '그 외') : REL[p], name, phone, g(src, p, 'gmail'), g(src, p, 'work'),
          (src.guardian && name && src.guardian === name) ? '대표' : '', src.address || '']);
      });
      // 어머니 · 아버지 칸에 없는 예전 «대표 보호자»도 한 줄 (빠뜨리지 않게)
      if((src.guardian || src.guardianPhone) && (!n || !names.includes(String(src.guardian || '').replace(/\s/g, ''))))
        rows.push([kids, cls, '대표 보호자', src.guardian || '', src.guardianPhone || '', '', '', '대표', src.address || '']);
    });
    return { head, rows, widths: [16, 16, 9, 10, 14, 24, 14, 6, 34] };
  }
  if(opt.mode === 'fam'){
    const head = cols.map(c => c.l);
    const rows = families(sorted).map(fam => {
      const src = fam.find(s => s.guardians && Object.keys(s.guardians).length) || fam.find(s => s.guardian || s.address) || fam[0];
      return cols.map(c => c.g === 'stu' ? [...new Set(fam.map(s => String(c.v(s) ?? '')).filter(Boolean))].join(' · ') : c.v(src));
    });
    return { head, rows, widths: cols.map(c => c.g === 'stu' ? c.w + 6 : c.w) };
  }
  return { head: cols.map(c => c.l), rows: sorted.map(s => cols.map(c => c.v(s))), widths: cols.map(c => c.w) };
}

function loadXLSX(){
  return new Promise((res, rej) => {
    if(window.XLSX) return res();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('엑셀 도구를 불러오지 못했어요 — 인터넷을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}
const today = () => ymd(Date.now());
export async function writeXlsx(sheets, nameParts){
  await loadXLSX();
  const wb = XLSX.utils.book_new();
  sheets.forEach(sh => {
    const ws = XLSX.utils.aoa_to_sheet([sh.head, ...sh.rows]);
    ws['!cols'] = (sh.widths || []).map(w => ({ wch: w }));
    if(sh.rows.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sh.rows.length, c: sh.head.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, String(sh.name || '명단').slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  });
  const fname = window.FN && window.FN.make ? window.FN.make([...nameParts, today()], { ext: '.xlsx' }) : nameParts.concat(today()).join('_') + '.xlsx';
  XLSX.writeFile(wb, fname);
  return fname;
}

/* ═══ 받기 창 ═══
   ctx: { db, list:[학생], classes:[반], title, nameParts:[…], orgs:[…], toast } */
const CSS = `
.pl-ov{position:fixed;inset:0;z-index:9000;background:rgba(20,30,26,.42);display:flex;align-items:center;justify-content:center;padding:16px}
.pl-box{background:var(--wh,#fff);border-radius:16px;width:min(620px,100%);max-height:92vh;overflow:auto;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.pl-t{font-size:17px;font-weight:900;color:var(--gd,#1E3932)}
.pl-s{font-size:12.5px;color:var(--tl,#7A857F);margin-top:3px;line-height:1.6}
.pl-h{font-size:12.5px;font-weight:800;color:var(--ts,#3E4843);margin:16px 0 7px}
.pl-chips{display:flex;gap:6px;flex-wrap:wrap}
.pl-chip{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 12px;border-radius:9px;border:1.5px solid var(--ivd,#E3E1DA);background:var(--wh,#fff);font:inherit;font-size:12.5px;font-weight:800;color:var(--ts,#5A6560);cursor:pointer}
.pl-chip.on{background:var(--gp,#E8F3EF);border-color:var(--gm,#00704A);color:var(--gm,#00704A)}
.pl-chip input{margin:0;accent-color:var(--gm,#00704A)}
.pl-chip.dis{opacity:.45;cursor:not-allowed}
.pl-row{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
.pl-btn{min-height:40px;padding:0 16px;border-radius:10px;border:1.5px solid var(--ivd,#E3E1DA);background:var(--wh,#fff);font:inherit;font-size:13px;font-weight:800;color:var(--ts,#3E4843);cursor:pointer}
.pl-btn.g{background:var(--gm,#00704A);border-color:var(--gm,#00704A);color:#fff}
.pl-btn:disabled{opacity:.5}
.pl-note{font-size:11.5px;color:var(--tl,#7A857F);background:var(--iv,#F2F0EB);border-radius:9px;padding:8px 11px;margin-top:12px;line-height:1.6}
.pl-cnt{font-size:12px;font-weight:800;color:var(--gm,#00704A)}
`;
function css(){ if(document.getElementById('pl-css')) return; const st = document.createElement('style'); st.id = 'pl-css'; st.textContent = CSS; document.head.appendChild(st); }
export function openExport(ctx){
  css();
  const list = ctx.list || [];
  const extraLabels = [...new Set(list.flatMap(s => Object.keys(s.infoExtra || {})))].sort(nat);
  const opt = { groups: PRESETS.basic.groups.slice(), mode: 'stu', preset: 'basic' };
  const ov = document.createElement('div'); ov.className = 'pl-ov';
  const paint = () => {
    const fams = families(list).length;
    ov.innerHTML = `<div class="pl-box" role="dialog" aria-label="학부모 명단 엑셀">
      <div class="pl-t">⬇ ${esc(ctx.title || '학부모 명단')} 엑셀</div>
      <div class="pl-s">학생 ${list.length}명 · 가정 ${fams}곳${ctx.scope ? ' · ' + esc(ctx.scope) : ''}</div>
      <div class="pl-h">빠르게 고르기</div>
      <div class="pl-chips">${Object.entries(PRESETS).map(([k, p]) => `<button type="button" class="pl-chip ${opt.preset === k ? 'on' : ''}" data-pre="${k}">${p.l}</button>`).join('')}</div>
      <div class="pl-h">한 줄에 누구</div>
      <div class="pl-chips">${[['stu', `학생마다 (${list.length}줄)`], ['fam', `가정마다 — 형제 한 줄 (${fams}줄)`], ['grd', '보호자마다 — 어머니 · 아버지 따로']].map(([k, l]) => `<button type="button" class="pl-chip ${opt.mode === k ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}</div>
      ${opt.mode === 'grd' ? '<div class="pl-note">보호자마다 한 줄: 학생 · 반 · 관계 · 성함 · 휴대폰 · 구글 메일 · 직장 · 집 주소 — 메일 돌리기 · 연락망에 좋아요 (형제는 한 번만).</div>' : `
      <div class="pl-h">넣을 칸</div>
      <div class="pl-chips">${GROUPS.map(x => { const dis = x.g === 'extra' && !extraLabels.length; const on = opt.groups.includes(x.g);
        return `<label class="pl-chip ${on ? 'on' : ''} ${x.must || dis ? 'dis' : ''}"><input type="checkbox" data-g="${x.g}" ${on ? 'checked' : ''} ${x.must || dis ? 'disabled' : ''}>${esc(x.l)}${x.g === 'extra' && extraLabels.length ? ` (${extraLabels.length})` : ''}</label>`; }).join('')}</div>`}
      <div class="pl-note">🔒 보호자 개인정보예요 — 받은 파일은 필요한 곳에만 쓰고, 다 쓰면 지워 주세요.</div>
      <div class="pl-row"><span class="pl-cnt" id="pl-msg" style="margin-right:auto;align-self:center"></span><button type="button" class="pl-btn" data-x>닫기</button><button type="button" class="pl-btn g" data-go>⬇ 엑셀로 받기</button></div>
    </div>`;
    ov.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const p = PRESETS[b.dataset.pre]; opt.preset = b.dataset.pre; opt.groups = p.groups.slice(); opt.mode = p.mode; paint(); });
    ov.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { opt.mode = b.dataset.mode; opt.preset = ''; paint(); });
    ov.querySelectorAll('[data-g]').forEach(b => b.onchange = () => { const k = b.dataset.g; if(b.checked){ if(!opt.groups.includes(k)) opt.groups.push(k); } else opt.groups = opt.groups.filter(x => x !== k); opt.preset = ''; paint(); });
    ov.querySelector('[data-x]').onclick = () => ov.remove();
    ov.querySelector('[data-go]').onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; const msg = ov.querySelector('#pl-msg');
      try{
        const byId = new Map(list.map(s => [s.id, s]));
        (ctx.allStudents || []).forEach(s => { if(!byId.has(s.id)) byId.set(s.id, s); });
        const C = { classOf: s => classOfIn(ctx.classes, s), byId, extraLabels, site: null };
        if(opt.mode !== 'grd' && opt.groups.includes('site')){ msg.textContent = '학부모 사이트 연결을 읽는 중…'; C.site = await loadSite(ctx.db, ctx.orgs || [...new Set(list.map(s => s.org || 'daniel'))], list); }
        const b = build(list, opt, C);
        const name = await writeXlsx([{ name: ctx.sheet || '학부모 명단', head: b.head, rows: b.rows, widths: b.widths }], ctx.nameParts || ['학부모명단']);
        ctx.toast && ctx.toast(`⬇ ${name}`, 'ok');
        ov.remove();
      }catch(err){ btn.disabled = false; msg.textContent = '받지 못했어요: ' + (err.message || err); }
    };
  };
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  paint(); document.body.appendChild(ov);
}

/* ═══ 학생관리 › 👪 학부모 명단 탭 ═══
   ctx: { el, db, students(), classes(), orgs(), orgNow(), toast } */
const V = { org: '', cls: '', st: 'active', q: '' };
export function renderTab(ctx){
  css();
  const el = ctx.el; if(!el) return;
  const orgs = ctx.orgs();
  const cur = ctx.orgNow ? ctx.orgNow() : '';
  if(cur && orgs.includes(cur)) V.org = cur; else if(V.org && !orgs.includes(V.org)) V.org = '';
  const all = ctx.students().filter(s => orgs.includes(s.org) && !s.deleted);
  const pool = all.filter(s => { const st = stOf(s); return V.st === 'all' ? (st === 'active' || st === 'leave') : st === V.st; })
    .filter(s => !V.org || s.org === V.org);
  const C = { classOf: s => classOfIn(ctx.classes(), s) };
  const clsList = [...new Map(pool.map(s => C.classOf(s)).filter(Boolean).map(c => [c.id, c])).values()]
    .sort((a, b) => nat(a.org, b.org) || nat(gradeIn(a, (a.students || [])[0]) || a.grade, gradeIn(b, (b.students || [])[0]) || b.grade) || nat(a.name, b.name));
  if(V.cls && !clsList.some(c => c.id === V.cls)) V.cls = '';
  let list = pool.filter(s => !V.cls || (C.classOf(s) || {}).id === V.cls);
  if(V.q){ const q = V.q.replace(/\s/g, '').toLowerCase(); list = list.filter(s => [s.name, s.guardian, g(s, 'm', 'name'), g(s, 'f', 'name'), s.guardianPhone, g(s, 'm', 'phone'), g(s, 'f', 'phone')].some(x => String(x || '').replace(/\s/g, '').toLowerCase().includes(q))); }
  list.sort((a, b) => nat(a.org, b.org) || nat(gradeIn(C.classOf(a), a.id), gradeIn(C.classOf(b), b.id)) || nat((C.classOf(a) || {}).name, (C.classOf(b) || {}).name) || nat(a.name, b.name));
  const has = s => ['m', 'f'].filter(p => g(s, p, 'name') || g(s, p, 'phone')).length;
  const filled = list.filter(s => has(s) > 0).length;
  const person = (s, p) => { const n = g(s, p, 'name'), ph = g(s, p, 'phone'), m = g(s, p, 'gmail');
    return n || ph || m ? `<b>${esc(n || '—')}</b>${ph ? `<br><span class="pt-sm">${esc(ph)}</span>` : ''}${m ? `<br><span class="pt-sm">${esc(m)}${s.guardians[p].gv ? ' <span class="pt-gv" title="학부모가 구글로 로그인해 확인한 메일">✓G</span>' : ''}</span>` : ''}` : '<span class="pt-no">—</span>'; };
  const rows = list.map(s => { const c = C.classOf(s);
    return `<tr><td><b>${esc(s.name)}</b>${stOf(s) === 'leave' ? ' <span class="pt-lv">휴학</span>' : ''}<br><span class="pt-sm">${esc([gradeIn(c, s.id), c ? c.name : ''].filter(Boolean).join(' ') || (ORG_L[s.org] || ''))}</span></td>
      <td>${s.guardian || s.guardianPhone ? `${esc(s.guardian || '—')}<br><span class="pt-sm">${esc(s.guardianPhone || '')}</span>` : '<span class="pt-no">—</span>'}</td>
      <td>${person(s, 'm')}</td><td>${person(s, 'f')}</td>
      <td class="pt-addr">${esc(s.address || '')}${s.emergency ? `<br><span class="pt-sm">비상 ${esc(s.emergency)}</span>` : ''}</td></tr>`; }).join('');
  const sel = 'height:38px;border:1.5px solid var(--ivd);border-radius:8px;padding:0 10px;font-size:13px;background:var(--iv);font-family:inherit';
  el.innerHTML = `
    <style>
      .pt-t{width:100%;border-collapse:collapse;font-size:13px}
      .pt-t th{text-align:left;padding:8px 10px;background:var(--iv);font-size:12px;color:var(--ts);white-space:nowrap;position:sticky;top:0}
      .pt-t td{padding:8px 10px;border-bottom:1px solid var(--ivd);vertical-align:top;line-height:1.5}
      .pt-sm{font-size:11.5px;color:var(--tl)}
      .pt-no{color:var(--tl)}
      .pt-gv{font-size:10px;font-weight:800;color:var(--gm);background:var(--gp);border-radius:4px;padding:0 4px}
      .pt-lv{font-size:10px;font-weight:800;color:var(--warn);background:var(--warn-bg);border-radius:100px;padding:1px 7px}
      .pt-addr{max-width:300px;font-size:12.5px}
      .pt-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
      .pt-sum{font-size:12px;color:var(--tl);margin:0 0 10px}
    </style>
    <div class="acard">
      <h3 class="actitle">👪 학부모 명단</h3>
      <p class="adesc">어머니 · 아버지 연락처와 집 주소를 한눈에 보고, 필요한 칸만 골라 엑셀로 받아요. 비어 있는 칸은 학생 «정보 수정»이나 «📮 정보 수집»으로 채울 수 있어요.</p>
      <div class="pt-bar">
        <select id="pt-org" style="${sel}"><option value="">전체 기관</option>${orgs.map(o => `<option value="${o}" ${V.org === o ? 'selected' : ''}>${ORG_L[o] || o}</option>`).join('')}</select>
        <select id="pt-cls" style="${sel}"><option value="">모든 반</option>${clsList.map(c => `<option value="${esc(c.id)}" ${V.cls === c.id ? 'selected' : ''}>${esc([gradeIn(c, (c.students || [])[0]) || c.grade, c.name].filter(Boolean).join(' '))}${!V.org && orgs.length > 1 ? ' · ' + esc(ORG_L[c.org] || '') : ''}</option>`).join('')}</select>
        <select id="pt-st" style="${sel}"><option value="active" ${V.st === 'active' ? 'selected' : ''}>재학생</option><option value="all" ${V.st === 'all' ? 'selected' : ''}>재학 + 휴학</option><option value="leave" ${V.st === 'leave' ? 'selected' : ''}>휴학생</option></select>
        <input id="pt-q" placeholder="🔍 학생 · 보호자 이름 · 번호" value="${esc(V.q)}" style="${sel};flex:1;min-width:150px;background:var(--wh)">
        <button class="bp" id="pt-dl" type="button">⬇ 엑셀로 받기</button>
      </div>
      <p class="pt-sum">학생 ${list.length}명 · 가정 ${families(list).length}곳 · 어머니 · 아버지 정보가 있는 학생 ${filled}명</p>
      <div style="overflow:auto;max-height:68vh;border:1px solid var(--ivd);border-radius:10px"><table class="pt-t">
        <thead><tr><th>학생</th><th>대표 보호자</th><th>👩 어머니</th><th>👨 아버지</th><th>🏠 집 주소</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--tl)">해당하는 학생이 없어요.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  const re = () => renderTab(ctx);
  el.querySelector('#pt-org').onchange = e => { V.org = e.target.value; V.cls = ''; re(); };
  el.querySelector('#pt-cls').onchange = e => { V.cls = e.target.value; re(); };
  el.querySelector('#pt-st').onchange = e => { V.st = e.target.value; re(); };
  const q = el.querySelector('#pt-q'); let tm = null;
  q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { V.q = q.value; re(); const n = el.querySelector('#pt-q'); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  el.querySelector('#pt-dl').onclick = () => {
    const c = V.cls ? clsList.find(x => x.id === V.cls) : null;
    openExport({ db: ctx.db, list, allStudents: all, classes: ctx.classes(), orgs: V.org ? [V.org] : orgs, toast: ctx.toast, title: '학부모 명단',
      scope: [V.org ? ORG_L[V.org] : '', c ? [gradeIn(c, (c.students || [])[0]) || c.grade, c.name].filter(Boolean).join(' ') : '', V.st === 'all' ? '재학 + 휴학' : V.st === 'leave' ? '휴학생' : '재학생'].filter(Boolean).join(' · '),
      nameParts: ['학부모명단', c ? c.name : '', V.org ? ORG_L[V.org] : (orgs.length > 1 ? 'DA 전체' : ORG_L[orgs[0]])] });
  };
}
