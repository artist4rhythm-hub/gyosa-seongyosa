/* ═══════════════════════════════════════════════════════════
   📦 archive-core.js — PDF 보관본의 «내용» (v195 → v196 책자형)
   · 기간 · 항목을 고르면 장(章)마다 «한눈에(요약) + 꼭지(회의 한 건 · 한 달 경비 · 한 반 출석)»를 만든다
     → 쪽 나누기 · 차례 · 머리글 · 쪽 번호는 archive-book.js 가 한다
   · 자료는 src(읽기 창구)로만 받는다
       화면 = 로그인한 수퍼관리자의 Firestore (archive.html)
       주 1회 자동 백업 = 서버가 넣어 주는 자료 — 같은 그림 · 같은 모양
     src = { query(col, [[칸, 비교, 값], …]) → [{id, …}], get(col, id) → {id, …}|null, sub([경로…]) → [{id, …}] }
     (값이 Date 이면 src 가 시각으로 바꿔서 묻는다)
   · 회의록 · 주임 회의록은 회의록 화면 인쇄와 같은 부품(minutes-core.js)을 그대로 쓴다
   · 경비 지급 요청서는 지급 요청서 화면의 «세부 내역표 · 영수증 취합»과 같은 번호 · 같은 합계
   ═══════════════════════════════════════════════════════════ */
import * as M from './minutes-core.js';
import { cleanInlineCached, cleanTableCached } from './minutes-files.js';

export const SECTIONS = [
  { k: 'mtg',  l: '회의록',          s: '회의록',   d: '기관 회의록 — 결정 · 임무 한눈에 + 전문 · 사진 · 댓글', folder: '교직원' },
  { k: 'lead', l: '주임 회의록',      s: '주임',     d: '주임 회의록 — 결정 · 임무 한눈에 + 전문 · 사진 · 댓글', folder: '주임' },
  { k: 'pay',  l: '경비 지급 요청서',  s: '경비',     d: '기관 · 달마다 세부 내역 → 영수증 사진', folder: '경비' },
  { k: 'att',  l: '출석부',          s: '출석부',   d: '반마다 날짜별 출결 표 · 결석 · 지각 · 조퇴 사유', folder: '교직원' },
  { k: 'act',  l: '활동 기록',        s: '활동',     d: '누가 언제 무엇을 넣고 · 고치고 · 지웠는지', folder: '관리자' },
];
export const LATER = ['수행성 · 활동 · 공사 경비', '학사일정 바뀐 것', '증명서 발급', '학부모 상담', '나학평', '학생 · 교직원 명부'];
/* NAS 폴더별 묶음 — 볼 사람이 다른 자료는 따로 만들어 그 폴더에 넣는다 */
export const PACKS = [
  { k: 'staff', l: '교직원용', s: ['mtg', 'att'] },
  { k: 'lead',  l: '주임용',   s: ['lead'] },
  { k: 'pay',   l: '경비용',   s: ['pay'] },
  { k: 'all',   l: '전부',     s: ['mtg', 'lead', 'pay', 'att', 'act'] },
];
const ORGS = { daniel: '다니엘아마츠학교', jihyebit: '그루터기 선교원', da: 'DA전체', lead: '주임 회의록' };
const ORG_SHORT = { daniel: '다니엘', jihyebit: '그루터기', da: 'DA전체', lead: '주임' };
export const ORG_PICK = [{ k: '', l: '두 기관 모두' }, { k: 'daniel', l: '다니엘아마츠학교' }, { k: 'jihyebit', l: '그루터기 선교원' }];
const PAY_MAX_DAYS = 92;   // 경비(영수증 사진)는 한 번에 3달까지 — 화면 메모리를 넘지 않게
const ORDER = ['daniel', 'jihyebit', 'da'];
const DAY = 864e5;

/* ── 작은 도구 ── */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tsMs = v => (v && typeof v === 'object' && v._seconds != null) ? v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6) : M.tsMs(v);   // 서버(Admin SDK)가 넘긴 시각 모양도
export const fmtDT = v => { const ms = tsMs(v); if(!ms) return ''; const d = new Date(ms); return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const won = n => (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR');
const orgName = o => ORGS[o] || o || '';
const orgShort = o => ORG_SHORT[o] || o || '';
const orgRank = o => { const i = ORDER.indexOf(o); return i < 0 ? 9 : i; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const inR = (ds, R) => isDate(ds) && ds >= R.from && ds <= R.to;
const safeId = s => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
export function dayList(from, to){
  const out = []; const d = new Date(from + 'T00:00:00'), e = new Date(to + 'T00:00:00');
  for(; d <= e && out.length < 400; d.setDate(d.getDate() + 1)) out.push(ymd(d));
  return out;
}
const monthsOf = R => [...new Set(dayList(R.from, R.to).map(d => d.slice(0, 7)))];
const semsOf = R => [...new Set(dayList(R.from, R.to).map(M.semOf).filter(Boolean))];
export function rangeLabel(R){
  const [y1, m1, d1] = R.from.split('-').map(Number), [y2, m2, d2] = R.to.split('-').map(Number);
  return y1 === y2 ? `${y1}년 ${m1}월 ${d1}일 ~ ${m2}월 ${d2}일` : `${y1}년 ${m1}월 ${d1}일 ~ ${y2}년 ${m2}월 ${d2}일`;
}
/* 한꺼번에 너무 많이 묻지 않게 — n개씩 */
async function pool(items, n, fn){
  let i = 0, fail = 0;
  const run = async () => { while(i < items.length){ const k = i++; try{ await fn(items[k], k); }catch(e){ fail++; } } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return fail;   // 읽지 못한 수
}
const okImg = s => /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(s || ''));
const emptyBox = t => `<p class="bk-none">${esc(t)}</p>`;
/* 사진을 끝내 못 읽으면 «불러오는 중…» 대신 */
const noPh = h => h.replace(/(<div class="md-ph"[^>]*>)([^<]*?)불러오는 중…/g, '$1$2(사진을 읽지 못했어요)');
/* 꼭지 = 차례 한 줄 · 새 쪽에서 시작 (brk) · 머리 띠(head) */
const part = (id, title, html, o = {}) => ({ id: safeId(id), title, short: o.short || title, sub: o.sub || '', html, brk: o.brk !== false, head: o.head !== false });
const stat = (l, v, u) => ({ l, v: String(v), u: u || '' });
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
const stChip = st => { const s = M.STATUS[st] || M.STATUS.todo; return `<span class="bk-st" style="color:${s.c};background:${s.bg}">${s.l}</span>`; };

/* ═══ 1 · 2  회의록 · 주임 회의록 — 회의록 화면 인쇄와 같은 부품 ═══ */
async function buildMinutes(src, R, step, lead){
  const COL = lead ? { m: 'leadMeetings', t: 'leadTasks', c: 'leadComments', f: 'leadFiles' }
                   : { m: 'meetings', t: 'meetingTasks', c: 'meetingComments', f: 'meetingFiles' };
  const orgs = lead ? ['lead'] : R.org ? [R.org, 'da'] : ORDER;   // 기관을 고르면 그 기관 + DA전체
  const title = lead ? '주임 회의록' : '회의록';
  const byId = new Map(), tasks = {}, fails = [], warn = [];
  for(const o of orgs) for(const s of semsOf(R)){
    try{ (await src.query(COL.m, [['org', '==', o], ['sem', '==', s]])).forEach(m => byId.set(m.id, m)); }
    catch(e){ fails.push(orgName(o)); }
    try{ (await src.query(COL.t, [['org', '==', o], ['sem', '==', s]])).forEach(t => { tasks[t.id] = t; }); }catch(e){}
  }
  const list = [...byId.values()].filter(m => !m.deleted && inR(m.date, R))
    .map(m => (m.type ? { ...m, type: M.typeFix(m.type) } : m))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || '').localeCompare(String(b.time || '')) || orgRank(a.org) - orgRank(b.org));
  if(fails.length) warn.push(`읽지 못한 기관: ${fails.join(', ')}`);
  if(!list.length) return { count: 0, warn, stats: [stat('회의', 0, '건')], intro: emptyBox(`이 기간에 적힌 ${title}이 없어요.`), parts: [] };
  step && step(`${title} ${list.length}건 — 사진 · 댓글 읽는 중`);
  /* 사진 · PDF 쪽 */
  const fids = [];
  list.forEach(m => (m.topics || []).forEach(t => (t.body || []).forEach(b => { if(b.k === 'img' && b.fid) fids.push(b.fid); if(b.k === 'pdf') fids.push(...(b.fids || [])); })));
  const files = {}, uf = [...new Set(fids)];
  await pool(uf, 6, async fid => { const f = await src.get(COL.f, fid); if(f && okImg(f.data)) files[fid] = f.data; });
  const missing = uf.filter(f => !files[f]).length;
  if(missing) warn.push(`사진 ${missing}장을 읽지 못함`);
  /* 댓글 */
  const cmts = {}; let cFail = 0;
  await pool(list, 4, async m => {
    let arr = [];
    try{ arr = (await src.query(COL.c, [['meetingId', '==', m.id], ['org', '==', m.org]])).filter(c => c.meetingId === m.id); }catch(e){ cFail++; }
    if(lead) for(const t of m.topics || []){ try{ arr = arr.concat(await src.sub(['leadTopicCmts', `${m.id}_${t.id}`, 'c'])); }catch(e){ cFail++; } }
    cmts[m.id] = arr.map(c => ({ ...c, at: tsMs(c.at) })).filter(c => !c.del);
  });
  if(cFail) warn.push(`댓글 묶음 ${cFail}개를 읽지 못함`);
  const cctx = { clean: cleanInlineCached, cleanTbl: cleanTableCached, print: true, tasks, files, opts: { att: true, img: true, tbl: true } };
  /* 한눈에 — 결정 · 임무 (회의마다 묶어서, 쪽이 넘어가도 날짜가 보이게 줄마다) */
  const rows = M.summaryRows(list, tasks);
  let nDec = 0, nTask = 0, nDone = 0, nDoing = 0, nLate = 0;
  const today = ymd(new Date());
  rows.forEach(r => { nDec += r.dec.length; nTask += r.tk.length; nDone += r.tk.filter(k => k.st === 'done').length; nDoing += r.tk.filter(k => k.st === 'doing').length;
    nLate += r.tk.filter(k => k.st !== 'done' && isDate(k.due) && k.due < today).length; });
  const brief = [nTask ? `임무 ${nTask}개 — 완료 ${nDone} · 진행 중 ${nDoing} · 진행 전 ${nTask - nDone - nDoing}` : '적힌 임무가 없어요',
    nLate ? `기한이 지났는데 끝나지 않은 임무 ${nLate}개` : ''].filter(Boolean);
  const sum = rows.length ? `<h3 class="bk-h3 bk-kwn">결정 · 임무 한눈에</h3>
    <table class="bk-t bk-sum"><colgroup><col style="width:15%"><col style="width:24%"><col style="width:29%"><col style="width:32%"></colgroup>
    <thead><tr><th>회의</th><th>주제</th><th>결정</th><th>임무 · 담당 · 기한</th></tr></thead><tbody>
    ${rows.map((r, i) => { const first = i === 0 || rows[i - 1].m !== r.m;
      return `<tr class="${first ? 'g1' : 'g2'}"><td class="bk-when"><b>${esc(M.fmtMD(r.m.date))}</b><small>${esc(orgShort(r.m.org))}</small></td>
      <td>${r.i + 1}. ${esc(r.t.title || '')}</td><td>${r.dec.map(d => `<div class="bk-li">${esc(d)}</div>`).join('')}</td>
      <td>${r.tk.map(k => `<div class="bk-li">${esc(k.h)}${k.who ? ' · <b>' + esc(k.who) + '</b>' : ''}${k.due ? ' · ' + esc(M.fmtMD(k.due)) + '까지' : ''} ${stChip(k.st)}</div>`).join('')}</td></tr>`; }).join('')}
    </tbody></table>` : emptyBox('이 기간 회의록에는 적힌 결정 · 임무가 없어요.');
  const parts = list.map(m => {
    let h = `<div class="arc-tag">${esc(orgName(m.org))}</div>${M.renderDoc(m, cctx)}`;
    const cm = cmts[m.id] || [];
    if(cm.length){
      const roots = cm.filter(c => !c.root).sort((a, b) => a.at - b.at);
      const tn = c => c.tgt === 'm' ? '회의록' : String(c.tgt || '').startsWith('t:') ? (() => { const i = (m.topics || []).findIndex(t => 't:' + t.id === c.tgt); return i >= 0 ? `${i + 1}. ${m.topics[i].title || ''}` : '주제'; })() : '임무';
      h += `<div class="pcm"><h3 class="bk-kwn">댓글 ${cm.length}</h3>${roots.map(r => `<div class="pc-th"><div class="pc"><b>${esc(r.name)}</b> <small>${esc(M.fmtStamp(r.at))} · ${esc(tn(r))}</small><div>${esc(r.text)}</div></div>
        ${cm.filter(c => c.root === r.id).sort((a, b) => a.at - b.at).map(c => `<div class="pc rp"><b>↳ ${esc(c.name)}</b> <small>${esc(M.fmtStamp(c.at))}</small><div>${esc(c.text)}</div></div>`).join('')}</div>`).join('')}</div>`;
    }
    const nt = (m.topics || []).length, tt = M.titleOf(m);
    const label = tt.includes(orgName(m.org)) || tt.includes(orgShort(m.org)) ? tt : `${orgShort(m.org)} ${tt}`;   // «다니엘 다니엘아마츠학교 회의록»처럼 겹치지 않게
    return part((lead ? 'lm-' : 'm-') + m.id, `${M.fmtMD(m.date)} ${label}`, noPh(h),
      { short: `${M.fmtMD(m.date)} ${M.titleOf(m)}`, sub: [m.time, m.place, nt ? `주제 ${nt}` : ''].filter(Boolean).join(' · '), head: false });
  });
  return { count: list.length, warn, intro: sum, parts, brief,
    stats: [stat('회의', list.length, '건'), stat('결정', nDec), stat('임무', nTask, nTask ? `· 완료 ${nDone}` : '')] };
}

/* ═══ 3  경비 지급 요청서 — 지급 요청서 화면의 세부 내역표 · 영수증 취합과 같은 번호 · 합계 ═══
   번호(P001)는 그 달 전체 요청서 기준 (달마다 새로) — 월 취합표 · 화면의 번호와 같게 */
const isCorr = r => !!(r && r.correctionOf);
const corrDiff = r => isCorr(r) ? (Number(r.total) || 0) - (Number(r.origTotal) || 0) : 0;
function payChip(r){
  if(r.mode === 'income') return '<span class="ps-st inc">수입</span>';
  if(r.status === 'rejected') return '<span class="ps-st rej">반려</span>';
  if(r.paid) return '<span class="ps-st paid">지급완료</span>';
  if(r.status === 'approving') return '<span class="ps-st apv">결재중</span>';
  return '<span class="ps-st wait">지급대기</span>';
}
function monthNumbering(monthPool){
  const pool = monthPool.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.applicantName || '').localeCompare(b.applicantName || '', 'ko'));
  const noMap = {}; let seq = 0;
  pool.forEach(r => { if(!isCorr(r)){ seq++; noMap[r.id] = 'P' + String(seq).padStart(3, '0'); } });
  pool.forEach(r => {
    if(!isCorr(r)) return;
    const base = noMap[r.correctionOf];
    if(base) noMap[r.id] = `${base}-${r.correctionSeq || 1}`;
    else { seq++; noMap[r.id] = 'P' + String(seq).padStart(3, '0') + '-' + (r.correctionSeq || 1); }
  });
  const ordered = [];
  pool.forEach(r => {
    if(isCorr(r)) return;
    ordered.push(r);
    pool.filter(k => k.correctionOf === r.id).sort((a, b) => (a.correctionSeq || 0) - (b.correctionSeq || 0)).forEach(k => ordered.push(k));
  });
  pool.forEach(r => { if(isCorr(r) && !ordered.includes(r)) ordered.push(r); });
  return { noMap, ordered };
}
const classify = s => new Promise(res => {
  if(typeof Image === 'undefined') return res('short');
  const im = new Image(); const t = setTimeout(() => res('short'), 4000);
  im.onload = () => { clearTimeout(t); const ra = im.naturalWidth / (im.naturalHeight || 1); res(ra > 1.15 ? 'wide' : ra < 0.72 ? 'tall' : 'short'); };
  im.onerror = () => { clearTimeout(t); res('short'); };
  im.src = s;
});
/* 합계 — 반려는 빼고 · 정정은 원본과의 차액만 */
function payTotals(list){
  let exp = 0, inc = 0;
  list.forEach(r => {
    if(r.status === 'rejected') return;
    const sum = (r.rows || []).reduce((s, x) => s + (Number(x.sub) || 0), 0);
    const eff = isCorr(r) ? corrDiff(r) : sum;
    if(r.mode === 'income') inc += eff; else exp += eff;
  });
  return { exp, inc };
}
function payDetail(list, noMap, wholeMonth){
  const COLS = 9; let body = '';
  const { exp: expTotal, inc: incTotal } = payTotals(list);
  list.forEach(r => {
    const no = noMap[r.id] || 'P000', rows = r.rows || [];
    const sum = rows.reduce((s, x) => s + (Number(x.sub) || 0), 0);
    const eff = isCorr(r) ? corrDiff(r) : sum;
    const chain = (r.chain || []).map(c => `${c.name || ''}${c.status === 'approved' ? '✓' : ''}`).filter(Boolean).join(' → ');
    const bank = r.bank && (r.bank.bank || r.bank.account) ? `${r.bank.bank || ''} ${r.bank.account || ''} ${r.bank.holder ? '(' + r.bank.holder + ')' : ''}` : '';
    body += `<tr class="ps-req bk-kwn"><td colspan="${COLS}"><div class="ps-rq1"><span class="ps-no">${esc(no)}</span> <b>${esc(r.purpose || '(용도 미기재)')}</b> ${payChip(r)}</div>
      <div class="ps-meta">${esc(r.applicantName || r.createdByName || '')} · ${esc(r.dept || '-')} · ${esc(r.date || '')}${r.paidAt ? ` · 지급 ${esc(fmtDT(r.paidAt))}` : ''}${chain ? ` · 결재 ${esc(chain)}` : ''}${bank ? ` · 💳 ${esc(bank)}` : ''}</div></td></tr>`;
    if(!rows.length) body += `<tr><td colspan="${COLS}" class="ps-empty">입력된 항목이 없습니다</td></tr>`;
    else rows.forEach((row, i) => {
      const rc = row.receiptCount != null ? row.receiptCount : (row.receipts ? row.receipts.length : '');
      body += `<tr><td class="ps-c">${i + 1}</td><td>${esc(row.cat_major || '')}</td><td>${esc(row.cat_item || '')}</td><td>${esc(row.name || '')}</td>
        <td class="ps-c">${esc(row.qty || '')}</td><td class="ps-amt">${row.price ? won(row.price) : ''}</td><td class="ps-amt">${row.sub ? won(row.sub) : ''}</td>
        <td>${esc(row.note || '')}</td><td class="ps-c">${rc ? esc(rc) + '장' : ''}</td></tr>`;
    });
    const corr = isCorr(r) ? ` <span class="ps-corr">(정정 ${esc(r.correctionSeq || 1)}차 — 원본 ₩${won(r.origTotal)} 대비 차액 ${eff >= 0 ? '+' : '−'}₩${won(Math.abs(eff))}만 합계 반영)</span>` : '';
    body += `<tr class="ps-sub2"><td colspan="${COLS}">${esc(no)} 소계 &nbsp; ₩${won(sum)}${corr}${r.status === 'rejected' ? ' <span class="ps-rejn">(반려 — 합계에서 제외)</span>' : ''}</td></tr>`;
  });
  let extra = '';
  if(wholeMonth){
    const bymap = {}, bywho = {};
    list.filter(r => r.mode !== 'income' && r.status !== 'rejected').forEach(r => {
      const rows = r.rows || []; const sum = rows.reduce((s, x) => s + (Number(x.sub) || 0), 0) || 1;
      const eff = isCorr(r) ? corrDiff(r) : sum;
      rows.forEach(row => { const k = row.cat_major || '미분류'; bymap[k] = (bymap[k] || 0) + (isCorr(r) ? eff * ((Number(row.sub) || 0) / sum) : (Number(row.sub) || 0)); });
      const w = r.applicantName || r.createdByName || '(이름 없음)';
      bywho[w] = (bywho[w] || 0) + (isCorr(r) ? corrDiff(r) : rows.reduce((s, x) => s + (Number(x.sub) || 0), 0));
    });
    const tbl = (head, map) => { const ks = Object.keys(map).sort((a, b) => map[b] - map[a]); if(!ks.length) return '';
      return `<table class="bk-t ps-sum"><colgroup><col style="width:62%"><col></colgroup><thead><tr><th>${head}</th><th>금액</th></tr></thead><tbody>${ks.map(k => `<tr><td>${esc(k)}</td><td class="ps-amt">₩${won(map[k])}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>합계</td><td class="ps-amt">₩${won(ks.reduce((s, k) => s + map[k], 0))}</td></tr></tfoot></table>`; };
    const a = tbl('계정과목 (대분류)', bymap), b = tbl('신청자', bywho);
    extra = (a ? `<h3 class="bk-h3 bk-kwn">계정과목별 집계</h3>${a}` : '') + (b ? `<h3 class="bk-h3 bk-kwn">신청자별 집계</h3>${b}` : '');
  }
  return `<table class="bk-t ps-tbl"><colgroup><col style="width:4.5%"><col style="width:11%"><col style="width:11%"><col style="width:25.5%"><col style="width:6%"><col style="width:10.5%"><col style="width:11.5%"><col style="width:13%"><col style="width:7%"></colgroup>
    <thead><tr><th>#</th><th>대분류</th><th>세부</th><th>품목 · 내용</th><th>수량</th><th>단가(원)</th><th>소계(원)</th><th>비고</th><th>영수증</th></tr></thead>
    <tbody>${body || `<tr><td colspan="${COLS}" class="ps-empty">요청서가 없습니다</td></tr>`}</tbody>
    <tfoot><tr class="ps-tot"><td colspan="${COLS}">지출 합계 &nbsp; ₩${won(expTotal)}${incTotal ? ` &nbsp;&nbsp;|&nbsp;&nbsp; 수입 합계 &nbsp; ₩${won(incTotal)}` : ''}</td></tr>
    <tr class="ps-fn"><td colspan="${COLS}">반려된 요청서는 목록에 표시되지만 합계에서는 제외됩니다.</td></tr></tfoot></table>${extra}`;
}
async function buildPay(src, R, step){
  if(dayList(R.from, R.to).length > PAY_MAX_DAYS){
    const msg = '경비(영수증 사진)는 한 번에 3달까지만 담아요 — 달마다(또는 분기마다) 따로 만들어 주세요';
    return { count: 0, warn: [msg], stats: [], intro: `<p class="bk-err">${esc(msg)}</p>`, parts: [] };
  }
  const all = (await src.query('payRequests', [])).filter(r => !r.deleted && isDate(r.date) && (!R.org || (r.org || '') === R.org));
  const sel = all.filter(r => inR(r.date, R));
  const warn = [];
  if(!sel.length) return { count: 0, warn, stats: [stat('요청서', 0, '건')], intro: emptyBox('이 기간에 올라온 지급 요청서가 없어요.'), parts: [] };
  step && step(`경비 지급 요청서 ${sel.length}건 — 영수증 읽는 중`);
  const rcs = {};
  const rFail = await pool(sel, 4, async r => {
    const arr = await src.query('payReceipts', [['requestId', '==', r.id]]);
    rcs[r.id] = arr.filter(x => x.requestId === r.id && okImg(x.dataUrl)).sort((a, b) => (a.rowIdx - b.rowIdx) || (a.idx - b.idx));
  });
  if(rFail) warn.push(`요청서 ${rFail}건의 영수증을 읽지 못함`);
  const orgs = [...new Set(sel.map(r => r.org || ''))].sort((a, b) => orgRank(a) - orgRank(b) || String(a).localeCompare(String(b)));
  const parts = [], sumRows = []; let nRc = 0, expAll = 0;
  for(const o of orgs){
    for(const mo of monthsOf(R)){
      const monthPool = all.filter(r => (r.org || '') === o && r.date.startsWith(mo));
      const { noMap, ordered } = monthNumbering(monthPool);
      const chosen = ordered.filter(r => inR(r.date, R));
      if(!chosen.length) continue;
      const [y, m] = mo.split('-').map(Number);
      const last = `${mo}-${pad(new Date(y, m, 0).getDate())}`;
      const whole = R.from <= `${mo}-01` && R.to >= last;
      const on = orgName(o) || '(기관 없음)';
      const span = whole ? `${m}월 1일 ~ 말일` : `${M.fmtMD(chosen[0].date)} ~ ${M.fmtMD(chosen[chosen.length - 1].date)}`;
      const tot = payTotals(chosen); expAll += tot.exp;
      let cards = '', nThis = 0;
      for(const r of chosen){
        const list = rcs[r.id] || []; if(!list.length) continue;
        let cells = '';
        const types = await Promise.all(list.map(rc => classify(rc.dataUrl)));
        for(const [ri, rc] of list.entries()){
          const row = (r.rows || [])[rc.rowIdx];
          const label = row ? `${row.cat_major || ''}${row.cat_item ? ' › ' + row.cat_item : ''} · ${row.name || ''}` : '';
          cells += `<div class="prc-cell ${types[ri]}"><div class="prc-no">${esc(noMap[r.id] || '')}-${(+rc.rowIdx || 0) + 1}.${esc(rc.idx)}</div><img src="${rc.dataUrl}" alt="영수증">${label ? `<div class="prc-lbl">${esc(label)}</div>` : ''}</div>`;
          nRc++; nThis++;
        }
        cards += `<div class="prc-card"><div class="prc-hd bk-kwn"><span class="prc-seq">${esc(noMap[r.id] || '')}</span><span class="prc-purpose">${esc(r.purpose || '(용도 미기재)')}</span>
          <span class="prc-meta">${esc(r.applicantName || '')} · ${esc(r.dept || '')} · ${esc(r.date || '')} · <b>₩${won(r.total)}</b> · 영수증 ${list.length}장</span></div><div class="prc-grid">${cells}</div></div>`;
      }
      sumRows.push(`<tr><td>${esc(on)}</td><td class="ps-c">${y}년 ${m}월</td><td class="ps-c">${chosen.length}건</td><td class="ps-amt">₩${won(tot.exp)}</td><td class="ps-amt">${tot.inc ? '₩' + won(tot.inc) : '-'}</td><td class="ps-c">${nThis}장</td></tr>`);
      parts.push(part(`pay-${o || 'x'}-${mo}`, `${on} · ${m}월 세부 내역`, `<p class="bk-lead">${esc(span)} · 요청서 ${chosen.length}건 · 번호는 그 달 전체 기준 (P###-항목.장 = 영수증 번호)</p>${payDetail(chosen, noMap, whole)}`,
        { short: `${orgShort(o)} ${m}월 세부 내역`, sub: span }));
      if(cards) parts.push(part(`rc-${o || 'x'}-${mo}`, `${on} · ${m}월 영수증`, `<p class="bk-lead">${y}년 ${m}월 · 영수증 ${nThis}장 · 세부 내역의 번호(P###-항목.장)와 대조하세요</p>${cards}`,
        { short: `${orgShort(o)} ${m}월 영수증`, sub: `${nThis}장` }));
    }
  }
  const stN = { paid: 0, wait: 0, apv: 0, rej: 0, inc: 0 }, byCat = {};
  sel.forEach(r => { stN[r.mode === 'income' ? 'inc' : r.status === 'rejected' ? 'rej' : r.paid ? 'paid' : r.status === 'approving' ? 'apv' : 'wait']++;
    if(r.mode !== 'income' && r.status !== 'rejected' && !isCorr(r)) (r.rows || []).forEach(x => { const k = x.cat_major || '미분류'; byCat[k] = (byCat[k] || 0) + (Number(x.sub) || 0); }); });
  const topCat = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0];
  const brief = [[stN.paid && `지급완료 ${stN.paid}`, stN.wait && `지급대기 ${stN.wait}`, stN.apv && `결재중 ${stN.apv}`, stN.rej && `반려 ${stN.rej}`, stN.inc && `수입 ${stN.inc}`].filter(Boolean).join(' · '),
    topCat ? `가장 많이 쓴 곳 — ${topCat} ₩${won(byCat[topCat])}` : ''].filter(Boolean);
  const intro = `<h3 class="bk-h3 bk-kwn">기관 · 달마다</h3><table class="bk-t"><colgroup><col style="width:26%"><col style="width:16%"><col style="width:13%"><col style="width:18%"><col style="width:15%"><col style="width:12%"></colgroup>
    <thead><tr><th>기관</th><th>달</th><th>요청서</th><th>지출 합계</th><th>수입</th><th>영수증</th></tr></thead><tbody>${sumRows.join('')}</tbody></table>
    <p class="bk-note">반려된 요청서는 합계에서 빼고, 정정 요청서는 원본과의 차액만 더했어요.</p>`;
  return { count: sel.length, warn, intro, parts, brief, stats: [stat('요청서', sel.length, '건'), stat('지출', '₩' + won(expAll)), stat('영수증', nRc, '장')] };
}

/* ═══ 4  출석부 — 반마다 날짜별 표 (기간이 31일을 넘으면 학생별 합계) ═══
   · 묶음은 이름으로 (지각 · 조퇴 · 체험학습을 «출석으로 셈»으로 둔 학교도 있어 isPresent 로 묶지 않음 — 출석부 · 홈 위젯과 같은 규칙)
     ○ = 기본 «출석»만 · 그 밖은 첫 글자 (빨강 = 출석으로 안 셈 · 주황 = 출석으로 셈)
   · 출석률 = 출석으로 세는 항목이 하나라도 있는 날 / 기록된 날
   · 반마다 그 반 기록만 (기간 중에 반을 옮긴 학생은 옮기기 전 · 뒤 반에 나뉘어 — 두 번 세지 않음) */
const bucketOf = n => { n = String(n || ''); return n.includes('체험') ? 'tr' : (n.includes('결석') || n.includes('병결') || n === '결') ? 'ab' : n.includes('지각') ? 'lt' : n.includes('조퇴') ? 'ea' : 'ot'; };
async function buildAtt(src, R, step){
  const [classes, students, types, recs0] = await Promise.all([
    src.query('classes', []), src.query('students', []), src.query('attendTypes', []).catch(() => []),
    src.query('studentAttendance', [['date', '>=', R.from], ['date', '<=', R.to]]),
  ]);
  const recs = recs0.filter(r => inR(r.date, R));
  const T = {}; types.forEach(t => { T[t.id] = t; });
  const S = {}; students.forEach(s => { S[s.id] = s; });
  const sorted = types.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const defT = sorted.find(t => t.name === '출석') || sorted.find(t => t.isPresent) || null;
  const y = +R.from.slice(0, 4);
  let cls = classes.filter(c => +c.year === y);
  if(!cls.length) cls = classes.filter(c => +c.year === y - 1);
  if(R.org) cls = cls.filter(c => c.org === R.org);
  cls = cls.filter(c => (c.students || []).length).sort((a, b) => orgRank(a.org) - orgRank(b.org) || String(a.grade || '').localeCompare(String(b.grade || ''), 'ko', { numeric: true }) || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  if(!cls.length) return { count: 0, warn: [], stats: [stat('반', 0, '개')], intro: emptyBox('이 해의 반 편성이 없어요.'), parts: [] };
  step && step(`출석부 반 ${cls.length}개 · 기록 ${recs.length}건`);
  const tids = r => (Array.isArray(r.typeIds) && r.typeIds.length) ? r.typeIds : (r.typeId ? [r.typeId] : []);
  const tname = id => (T[id] && T[id].name) || '';
  const isPresent = id => !!(T[id] && (T[id].isPresent || T[id].name === '출석'));
  const plain = id => defT ? id === defT.id : T[id] && T[id].name === '출석';
  /* 기록이 이 반 것인지 — 반이 적힌 기록은 그 반 · 반이 없는 옛 기록은 지금 명단에 있는 반 */
  const roster = new Map(cls.map(c => [c.id, new Set(c.students || [])]));
  const belongs = (r, c) => r.classId ? r.classId === c.id : roster.get(c.id).has(r.studentId);
  const days = dayList(R.from, R.to);
  const hasRec = new Set(recs.map(r => r.date));
  const cols = days.filter(d => { const w = new Date(d + 'T00:00:00').getDay(); return (w !== 0 && w !== 6) || hasRec.has(d); });
  const grid = cols.length <= 31;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const typeUsed = new Set();
  const NOTE_MAX = 400;
  const parts = [], sumRows = [], rates = []; let allP = 0, allN = 0, nRec = 0; const allKids = new Set(), allC = { ab: 0, lt: 0, ea: 0, tr: 0, ot: 0 };
  for(const c of cls){
    /* 이 반 기록 — 학생 · 날짜마다 하나 (같은 날 둘이면 반이 적힌 것) */
    const at = {};
    recs.forEach(r => { if(!belongs(r, c)) return; const k = r.studentId + '|' + r.date; const cur = at[k]; if(!cur || (r.classId && !cur.classId)) at[k] = r; });
    const ids = new Set(c.students || []); Object.values(at).forEach(r => { if(r.studentId) ids.add(r.studentId); });
    const kids = [...ids].map(id => S[id]).filter(Boolean).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    if(!kids.length) continue;
    const notes = []; let nNotes = 0;
    const cnt = { p: 0, n: 0, ab: 0, lt: 0, ea: 0, tr: 0, ot: 0 };
    const mineOf = s => days.map(d => at[s.id + '|' + d]).filter(r => r && tids(r).length);
    kids.forEach(s => mineOf(s).forEach(r => {
      const ids2 = tids(r); cnt.n++;
      if(ids2.some(isPresent)) cnt.p++;
      const odd = ids2.filter(i => !plain(i));
      if(!odd.length) return;
      odd.forEach(i => typeUsed.add(i));
      const nm = odd.map(tname).filter(Boolean);
      new Set(nm.map(bucketOf)).forEach(b => { cnt[b]++; });
      nNotes++;
      if(notes.length < NOTE_MAX) notes.push({ d: r.date, n: s.name || '', t: nm.join('·') || '?', r: r.reason || '', ok: ids2.some(isPresent) });
    }));
    nRec += cnt.n;
    let tbl;
    const nm = s => `${esc(s.name || '')}${s.status && s.status !== 'active' ? ` <small>(${esc({ leave: '휴학', quit: '자퇴', grad: '졸업', egrad: '조기졸업' }[s.status] || s.status)})</small>` : ''}`;
    if(grid){
      const wNm = 19, wSum = 9, wDay = Math.max(4.2, Math.min(14, (100 - wNm - wSum) / Math.max(cols.length, 1)));
      const th = cols.map(d => { const w = new Date(d + 'T00:00:00').getDay(); return `<th class="${w === 0 || w === 6 ? 'we' : ''}">${+d.slice(8)}<small>${WD[w]}</small></th>`; }).join('');
      const trs = kids.map(s => { let p = 0, n = 0;
        const tds = cols.map(d => {
          const w = new Date(d + 'T00:00:00').getDay(), we = w === 0 || w === 6 ? ' we' : '';
          const r = at[s.id + '|' + d]; const ids2 = r ? tids(r) : [];
          if(!ids2.length) return `<td class="${we.trim()}"></td>`;
          n++; const pr = ids2.some(isPresent); if(pr) p++;
          const odd = ids2.filter(i => !plain(i));
          if(!odd.length) return `<td class="ok${we}">○</td>`;
          return `<td class="${pr ? 'y' : 'x'}${we}">${esc((tname(odd[0]) || '?').slice(0, 1))}</td>`;
        }).join('');
        return `<tr><td class="bk-nm">${nm(s)}</td>${tds}<td class="bk-tot">${n ? `${p}/${n}` : ''}</td></tr>`; }).join('');
      tbl = `<table class="bk-t bk-att"><colgroup><col style="width:${wNm}%">${cols.map(() => `<col style="width:${wDay.toFixed(2)}%">`).join('')}<col style="width:${wSum}%"></colgroup>
        <thead><tr><th class="bk-nm">이름</th>${th}<th>출석</th></tr></thead><tbody>${trs}</tbody></table>`;
    } else {
      const used = [...new Set(Object.values(at).flatMap(tids))].filter(i => !plain(i)).sort((a, b) => ((T[a] || {}).order || 0) - ((T[b] || {}).order || 0));
      const w = Math.max(6, Math.min(14, 62 / Math.max(used.length, 1)));
      const trs = kids.map(s => {
        const mine = mineOf(s);
        return `<tr><td class="bk-nm">${nm(s)}</td><td class="ps-c">${mine.filter(r => tids(r).some(isPresent)).length}</td><td class="ps-c">${mine.length}</td>${used.map(i => `<td class="ps-c">${mine.filter(r => tids(r).includes(i)).length || ''}</td>`).join('')}</tr>`;
      }).join('');
      tbl = `<table class="bk-t bk-att2"><colgroup><col style="width:20%"><col style="width:9%"><col style="width:9%">${used.map(() => `<col style="width:${w.toFixed(1)}%">`).join('')}</colgroup>
        <thead><tr><th class="bk-nm">이름</th><th>출석</th><th>기록</th>${used.map(i => `<th>${esc(tname(i))}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table>`;
    }
    const noteTbl = notes.length ? `<h3 class="bk-h3 bk-kwn">출석 말고 적힌 날 · 사유 (${nNotes > notes.length ? `${nNotes}건 가운데 ${notes.length}건` : nNotes + '건'})</h3><table class="bk-t bk-notes"><colgroup><col style="width:13%"><col style="width:15%"><col style="width:24%"><col></colgroup>
      <thead><tr><th>날짜</th><th>이름</th><th>출결</th><th>사유</th></tr></thead><tbody>${notes.sort((a, b) => a.d.localeCompare(b.d) || a.n.localeCompare(b.n, 'ko')).map(x => `<tr><td>${esc(M.fmtMD(x.d))}</td><td>${esc(x.n)}</td><td>${esc(x.t)}${x.ok ? ' <small class="bk-okc">출석으로 셈</small>' : ''}</td><td>${esc(x.r)}</td></tr>`).join('')}</tbody></table>` : '';
    const cname = `${c.grade ? c.grade + ' ' : ''}${c.name || ''}`;
    kids.forEach(s => allKids.add(s.id)); allP += cnt.p; allN += cnt.n; ['ab', 'lt', 'ea', 'tr', 'ot'].forEach(k => { allC[k] += cnt[k]; });
    if(cnt.n) rates.push({ l: cname, r: pct(cnt.p, cnt.n) });
    sumRows.push(`<tr><td>${esc(orgShort(c.org))} · ${esc(cname)}</td><td class="ps-c">${kids.length}</td><td class="ps-c">${cnt.n}</td><td class="ps-c"><b>${cnt.n ? pct(cnt.p, cnt.n) + '%' : '-'}</b></td><td class="ps-c">${cnt.ab || ''}</td><td class="ps-c">${cnt.lt || ''}</td><td class="ps-c">${cnt.ea || ''}</td><td class="ps-c">${(cnt.tr + cnt.ot) || ''}</td></tr>`);
    parts.push(part(`att-${c.id}`, `${orgName(c.org)} · ${cname}`, `<p class="bk-lead">학생 ${kids.length}명 · 출결 기록 ${cnt.n}건 · 출석률 ${cnt.n ? pct(cnt.p, cnt.n) + '%' : '-'}</p>${tbl}${noteTbl}`,
      { short: `${orgShort(c.org)} ${cname}`, sub: `${kids.length}명` }));
  }
  const usedNames = [...typeUsed].sort((a, b) => ((T[a] || {}).order || 0) - ((T[b] || {}).order || 0)).map(tname).filter(Boolean);
  const legend = grid ? `○ 출석 · 글자 = 그 밖의 출결 첫 글자 (${usedNames.map(esc).join(' · ') || '없음'}) — <b class="bk-xr">빨강</b> 출석으로 안 셈 · <b class="bk-xy">주황</b> 출석으로 셈 · 빈칸 = 기록 없음 · 회색 = 주말 · «출석» = 출석으로 센 날 / 기록된 날`
    : `기간이 31일을 넘어 학생마다 합계로 보여요 · «출석» = 출석으로 센 날 · 그 밖의 칸 = 출결 항목마다 날 수`;
  const intro = `<p class="bk-note">${legend}</p><h3 class="bk-h3 bk-kwn">반마다</h3><table class="bk-t"><colgroup><col style="width:30%"><col style="width:9%"><col style="width:11%"><col style="width:12%"><col style="width:9.5%"><col style="width:9.5%"><col style="width:9.5%"><col style="width:9.5%"></colgroup>
    <thead><tr><th>반</th><th>학생</th><th>기록</th><th>출석률</th><th>결석</th><th>지각</th><th>조퇴</th><th>그 외</th></tr></thead><tbody>${sumRows.join('')}</tbody></table>
    <p class="bk-note">결석 · 지각 · 조퇴 · 그 외(체험학습 등)는 그 항목이 적힌 날 수예요. 지각 · 조퇴 · 체험학습을 «출석으로 셈»으로 둔 항목은 출석률에도 출석으로 들어가요.</p>`;
  const low = rates.length > 1 ? rates.slice().sort((a, b) => a.r - b.r)[0] : null;
  const brief = [`결석 ${allC.ab} · 지각 ${allC.lt} · 조퇴 ${allC.ea}${allC.tr ? ` · 체험학습 ${allC.tr}` : ''}`, low ? `출석률이 가장 낮은 반 — ${low.l} ${low.r}%` : ''].filter(Boolean);
  return { count: nRec, warn: [], intro, parts, brief, stats: [stat('반', parts.length, '개'), stat('학생', allKids.size, '명'), stat('출석률', allN ? pct(allP, allN) + '%' : '-')] };
}

/* ═══ 5  활동 기록 ═══ */
async function buildAct(src, R, step){
  const a = new Date(R.from + 'T00:00:00'), b = new Date(new Date(R.to + 'T00:00:00').getTime() + DAY);
  const PAGE = { actexp: '활동 경비', family: '가정통신문', club: '동아리' };
  const twoYears = R.from.slice(0, 4) !== R.to.slice(0, 4);
  const logs = (await src.query('activityLogs', [['at', '>=', a], ['at', '<', b]]))
    .map(l => ({ ...l, ms: tsMs(l.at) })).filter(l => l.ms >= a.getTime() && l.ms < b.getTime() && (!R.org || !l.org || l.org === R.org)).sort((x, y) => x.ms - y.ms);
  if(!logs.length) return { count: 0, warn: [], stats: [stat('기록', 0, '건')], intro: emptyBox('이 기간 활동 기록이 없어요.'), parts: [] };
  step && step(`활동 기록 ${logs.length}건`);
  const catOfL = l => PAGE[l.category] || l.category || PAGE[l.page] || l.page || l.kind || '기타';
  const byCat = {};
  const kindOf = a => { a = String(a || ''); return /삭제|지움|빼기|delete|remove/i.test(a) ? 'del' : /수정|고침|변경|정정|되돌림|복원|update|edit|restore/i.test(a) ? 'ed' : /입력|추가|만듦|만들기|등록|올림|게시|create|add|publish/i.test(a) ? 'in' : 'ot'; };
  logs.forEach(l => { const c = catOfL(l); const k = kindOf(l.action);
    byCat[c] = byCat[c] || { in: 0, ed: 0, del: 0, ot: 0, n: 0 }; byCat[c][k]++; byCat[c].n++; });
  const cats = Object.keys(byCat).sort((x, y) => byCat[y].n - byCat[x].n);
  const tot = k => cats.reduce((s, c) => s + byCat[c][k], 0);
  const intro = `<h3 class="bk-h3 bk-kwn">분류마다</h3><table class="bk-t"><colgroup><col style="width:32%"><col style="width:13.6%"><col style="width:13.6%"><col style="width:13.6%"><col style="width:13.6%"><col style="width:13.6%"></colgroup>
    <thead><tr><th>분류</th><th>입력</th><th>수정</th><th>삭제</th><th>그 외</th><th>합계</th></tr></thead><tbody>${cats.map(c => `<tr><td>${esc(c)}</td>${['in', 'ed', 'del', 'ot'].map(k => `<td class="ps-c">${byCat[c][k] || ''}</td>`).join('')}<td class="ps-c"><b>${byCat[c].n}</b></td></tr>`).join('')}</tbody>
    <tfoot><tr><td>합계</td>${['in', 'ed', 'del', 'ot'].map(k => `<td class="ps-c">${tot(k) || ''}</td>`).join('')}<td class="ps-c">${logs.length}</td></tr></tfoot></table>`;
  const rows = logs.map(l => `<tr><td>${esc(twoYears ? fmtDT(l.ms) : fmtDT(l.ms).slice(5))}</td><td>${esc(l.name || l.byName || '')}</td><td>${esc(catOfL(l))}</td><td>${esc(l.action || '')}</td><td>${esc(l.target || l.ledgerName || '')}</td><td>${esc(l.detail || '')}</td></tr>`).join('');
  const html = `<table class="bk-t bk-act"><colgroup><col style="width:13%"><col style="width:11%"><col style="width:11%"><col style="width:8%"><col style="width:24%"><col style="width:33%"></colgroup>
    <thead><tr><th>때</th><th>누가</th><th>분류</th><th>작업</th><th>대상</th><th>내용</th></tr></thead><tbody>${rows}</tbody></table>`;
  const brief = [`입력 ${tot('in')} · 수정 ${tot('ed')} · 삭제 ${tot('del')}`, cats[0] ? `가장 많이 바뀐 곳 — ${cats[0]} ${byCat[cats[0]].n}건` : ''].filter(Boolean);
  return { count: logs.length, warn: [], intro, brief, parts: [part('act-all', `활동 기록 ${logs.length}건 (시간 순)`, html, { short: '활동 기록 전체', sub: rangeLabel(R) })],
    stats: [stat('기록', logs.length, '건'), stat('입력', tot('in')), stat('수정 · 삭제', tot('ed') + tot('del'))] };
}

const BUILD = { mtg: (s, R, st) => buildMinutes(s, R, st, false), lead: (s, R, st) => buildMinutes(s, R, st, true), pay: buildPay, att: buildAtt, act: buildAct };

/* ═══ 전체 — 장(章)들 + 책 정보 ═══
   반환 { meta, chapters:[{k, l, s, d, no, count, err, warn, stats, intro, parts}], sections(기록용), made, org } */
export async function buildArchive(src, opt, onStep){
  const R = { from: opt.from, to: opt.to, org: ORG_PICK.some(o => o.k === opt.org) ? opt.org : '' };
  if(!isDate(R.from) || !isDate(R.to) || R.from > R.to) throw new Error('기간을 확인해 주세요');
  if(dayList(R.from, R.to).length > 370) throw new Error('한 번에 1년까지만 만들 수 있어요');
  const keys = SECTIONS.map(s => s.k).filter(k => (opt.sections || []).includes(k));
  if(!keys.length) throw new Error('항목을 하나 이상 골라 주세요');
  const out = [];
  for(const k of keys){
    const meta = SECTIONS.find(s => s.k === k);
    const base = { k, l: meta.l, s: meta.s, d: meta.d, no: out.length + 1 };
    onStep && onStep(`${meta.l} 읽는 중…`);
    try{ out.push({ ...base, warn: [], err: '', ...(await BUILD[k](src, R, onStep)) }); }
    catch(e){ const why = String((e && (e.code || e.message)) || e); out.push({ ...base, count: 0, err: why, warn: [], stats: [], intro: `<p class="bk-err">읽지 못했어요 — ${esc(why)}</p>`, parts: [] }); }
  }
  const made = new Date();
  const pk = PACKS.find(p => p.k === opt.pack && p.s.slice().sort().join() === keys.slice().sort().join());
  const og = ORG_PICK.find(o => o.k === R.org && o.k);
  return {
    meta: { from: R.from, to: R.to, range: rangeLabel(R), org: R.org, orgLabel: og ? og.l : '', pack: pk ? pk.k : '', packLabel: pk ? pk.l : '',
      by: opt.by || '', auto: !!opt.auto, made: made.getTime(), madeLabel: fmtDT(made.getTime()) },
    chapters: out,
    sections: out.map(({ k, l, count, err, warn }) => ({ k, l, count, err: err || '', warn: (warn || []).slice(0, 4) })),
    made: made.getTime(), org: R.org,
  };
}
