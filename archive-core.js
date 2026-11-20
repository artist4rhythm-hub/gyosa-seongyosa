/* ═══════════════════════════════════════════════════════════
   📦 archive-core.js — PDF 보관본 (v195)
   · 기간 · 항목을 고르면 «목차 + 항목별 쪽»을 한 문서로 그린다 → 브라우저 «PDF로 저장»
   · 자료는 src(읽기 창구)로만 받는다
       화면 = 로그인한 수퍼관리자의 Firestore (archive.html)
       주 1회 자동 백업(다음 단계) = 서버가 넣어 주는 자료 — 같은 그림 · 같은 모양
     src = { query(col, [[칸, 비교, 값], …]) → [{id, …}], get(col, id) → {id, …}|null, sub([경로…]) → [{id, …}] }
     (값이 Date 이면 src 가 시각으로 바꿔서 묻는다)
   · 회의록 · 주임 회의록은 회의록 화면 인쇄와 같은 부품(minutes-core.js)을 그대로 쓴다
   · 경비 지급 요청서는 지급 요청서 화면의 «세부 내역표 · 영수증 취합» 모양을 그대로 옮겼다
   ═══════════════════════════════════════════════════════════ */
import * as M from './minutes-core.js';
import { cleanInlineCached, cleanTableCached } from './minutes-files.js';

export const SECTIONS = [
  { k: 'mtg',  l: '회의록',          d: '세 기관 회의록 — 결정 · 임무 요약 + 전문 · 사진 · 댓글', folder: '교직원' },
  { k: 'lead', l: '주임 회의록',      d: '주임 회의록 전문 · 사진 · 댓글', folder: '주임' },
  { k: 'pay',  l: '경비 지급 요청서',  d: '기관별 세부 내역 · 영수증 사진', folder: '경비' },
  { k: 'att',  l: '출석부',          d: '반별 출결 표 · 결석 · 지각 · 조퇴 사유', folder: '교직원' },
  { k: 'act',  l: '활동 기록',        d: '누가 언제 무엇을 넣고 · 고치고 · 지웠는지', folder: '관리자' },
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
export const ORG_PICK = [{ k: '', l: '두 기관 모두' }, { k: 'daniel', l: '다니엘아마츠학교' }, { k: 'jihyebit', l: '그루터기 선교원' }];
const PAY_MAX_DAYS = 92;   // 경비(영수증 사진)는 한 번에 3달까지 — 화면 메모리를 넘지 않게
const ORDER = ['daniel', 'jihyebit', 'da'];
const DAY = 864e5;

/* ── 작은 도구 ── */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tsMs = v => (v && typeof v === 'object' && v._seconds != null) ? v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6) : M.tsMs(v);   // 서버(Admin SDK)가 넘긴 시각 모양도
const fmtDT = v => { const ms = tsMs(v); if(!ms) return ''; const d = new Date(ms); return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const won = n => (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR');
const orgName = o => ORGS[o] || o || '';
const orgRank = o => { const i = ORDER.indexOf(o); return i < 0 ? 9 : i; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const inR = (ds, R) => isDate(ds) && ds >= R.from && ds <= R.to;
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
const emptyBox = t => `<p class="arc-none">${esc(t)}</p>`;
const secHead = (title, sub) => `<header class="arc-sh"><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</header>`;
const warnLine = ws => ws.length ? ` · <b class="arc-warn">⚠️ ${esc(ws.join(' · '))}</b>` : '';
/* 사진을 끝내 못 읽으면 «불러오는 중…» 대신 */
const noPh = h => h.replace(/(<div class="md-ph"[^>]*>)([^<]*?)불러오는 중…/g, '$1$2(사진을 읽지 못했어요)');

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
  if(fails.length) warn.unshift(`읽지 못한 기관: ${fails.join(', ')}`);
  const cctx = { clean: cleanInlineCached, cleanTbl: cleanTableCached, print: true, tasks, files, opts: { att: true, img: true, tbl: true } };
  const rows = M.summaryRows(list, tasks);
  const head = secHead(title, `${esc(rangeLabel(R))}${!lead && R.org ? ' · ' + esc(orgName(R.org)) + ' + DA전체' : ''} · ${list.length}건${warnLine(warn)}`);
  if(!list.length) return { count: 0, warn, html: `<section class="arc-sec">${head}${emptyBox('이 기간에 적힌 회의록이 없어요.')}</section>` };
  const sum = `<table class="arc-t arc-sum"><thead><tr><th style="width:74px">날짜</th><th style="width:96px">기관</th><th style="width:26%">주제</th><th>결정</th><th style="width:30%">임무 (담당 · 기한 · 상태)</th></tr></thead><tbody>
    ${rows.length ? rows.map(r => `<tr><td>${esc(M.fmtMD(r.m.date))}</td><td>${esc(orgName(r.m.org))}</td><td>${r.i + 1}. ${esc(r.t.title || '')}</td><td>${r.dec.map(esc).join('<br>')}</td>
      <td>${r.tk.map(k => `${esc(k.h)}${k.who ? ' · <b>' + esc(k.who) + '</b>' : ''}${k.due ? ' · ' + esc(M.fmtMD(k.due)) + '까지' : ''} · ${(M.STATUS[k.st] || M.STATUS.todo).l}`).join('<br>')}</td></tr>`).join('')
      : `<tr><td colspan="5" class="arc-c">이 기간 회의록에는 적힌 결정 · 임무가 없어요.</td></tr>`}</tbody></table>`;
  const docs = list.map(m => {
    let h = `<div class="arc-pg"><div class="arc-tag">${esc(orgName(m.org))}</div>${M.renderDoc(m, cctx)}`;
    const cm = cmts[m.id] || [];
    if(cm.length){
      const roots = cm.filter(c => !c.root).sort((a, b) => a.at - b.at);
      const tn = c => c.tgt === 'm' ? '회의록' : String(c.tgt || '').startsWith('t:') ? (() => { const i = (m.topics || []).findIndex(t => 't:' + t.id === c.tgt); return i >= 0 ? `${i + 1}. ${m.topics[i].title || ''}` : '주제'; })() : '임무';
      h += `<div class="pcm"><h3>댓글 ${cm.length}</h3>${roots.map(r => `<div class="pc"><b>${esc(r.name)}</b> <small>${esc(M.fmtStamp(r.at))} · ${esc(tn(r))}</small><div>${esc(r.text)}</div>
        ${cm.filter(c => c.root === r.id).sort((a, b) => a.at - b.at).map(c => `<div class="pc rp"><b>↳ ${esc(c.name)}</b> <small>${esc(M.fmtStamp(c.at))}</small><div>${esc(c.text)}</div></div>`).join('')}</div>`).join('')}</div>`;
    }
    return h + '</div>';
  }).join('');
  return { count: list.length, warn, html: noPh(`<section class="arc-sec">${head}<h3 class="arc-h3">결정 · 임무 한눈에</h3>${sum}${docs}</section>`) };
}

/* ═══ 3  경비 지급 요청서 — 지급 요청서 화면의 세부 내역표 · 영수증 취합 모양 ═══
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
function payDetail(list, noMap, wholeMonth){
  const COLS = 9; let body = '', expTotal = 0, incTotal = 0;
  list.forEach(r => {
    const no = noMap[r.id] || 'P000', rows = r.rows || [];
    const sum = rows.reduce((s, x) => s + (Number(x.sub) || 0), 0);
    const eff = isCorr(r) ? corrDiff(r) : sum;
    if(r.status !== 'rejected'){ if(r.mode === 'income') incTotal += eff; else expTotal += eff; }
    const chain = (r.chain || []).map(c => `${c.name || ''}${c.status === 'approved' ? '✓' : ''}`).filter(Boolean).join(' → ');
    const bank = r.bank && (r.bank.bank || r.bank.account) ? `${r.bank.bank || ''} ${r.bank.account || ''} ${r.bank.holder ? '(' + r.bank.holder + ')' : ''}` : '';
    body += `<tr class="ps-req"><td colspan="${COLS}"><span class="ps-no">${esc(no)}</span>&nbsp;${esc(r.purpose || '(용도 미기재)')}
      <span class="ps-meta">&nbsp;·&nbsp;${esc(r.applicantName || r.createdByName || '')}&nbsp;·&nbsp;${esc(r.dept || '-')}&nbsp;·&nbsp;${esc(r.date || '')}&nbsp;·&nbsp;${payChip(r)}
      ${r.paidAt ? `&nbsp;·&nbsp;지급 ${esc(fmtDT(r.paidAt))}` : ''}${chain ? `&nbsp;·&nbsp;결재 ${esc(chain)}` : ''}</span>
      ${bank ? `<div class="ps-bank">💳 ${esc(bank)}</div>` : ''}</td></tr>`;
    if(!rows.length) body += `<tr><td colspan="${COLS}" class="ps-empty">입력된 항목이 없습니다</td></tr>`;
    else rows.forEach((row, i) => {
      const rc = row.receiptCount != null ? row.receiptCount : (row.receipts ? row.receipts.length : '');
      body += `<tr><td class="ps-c">${i + 1}</td><td>${esc(row.cat_major || '')}</td><td>${esc(row.cat_item || '')}</td><td>${esc(row.name || '')}</td>
        <td class="ps-c">${esc(row.qty || '')}</td><td class="ps-amt">${row.price ? '₩' + won(row.price) : ''}</td><td class="ps-amt">${row.sub ? '₩' + won(row.sub) : ''}</td>
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
      return `<table class="ps-sum"><thead><tr><th style="width:60%">${head}</th><th>금액</th></tr></thead><tbody>${ks.map(k => `<tr><td>${esc(k)}</td><td class="ps-r">₩${won(map[k])}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>합계</td><td class="ps-r">₩${won(ks.reduce((s, k) => s + map[k], 0))}</td></tr></tfoot></table>`; };
    const a = tbl('계정과목 (대분류)', bymap), b = tbl('신청자', bywho);
    extra = (a ? `<div class="ps-secttl">계정과목별 집계</div>${a}` : '') + (b ? `<div class="ps-secttl">신청자별 집계</div>${b}` : '');
  }
  return `<table class="ps-tbl"><colgroup><col style="width:32px"><col style="width:104px"><col style="width:118px"><col><col style="width:44px"><col style="width:88px"><col style="width:96px"><col style="width:150px"><col style="width:52px"></colgroup>
    <thead><tr><th>#</th><th>대분류</th><th>세부</th><th>품목 · 내용</th><th>수량</th><th>단가</th><th>소계</th><th>비고</th><th>영수증</th></tr></thead>
    <tbody>${body || `<tr><td colspan="${COLS}" class="ps-empty">요청서가 없습니다</td></tr>`}</tbody>
    <tfoot><tr><td colspan="${COLS}">지출 합계 &nbsp; ₩${won(expTotal)}${incTotal ? ` &nbsp;&nbsp;|&nbsp;&nbsp; 수입 합계 &nbsp; ₩${won(incTotal)}` : ''}</td></tr>
    <tr class="ps-fn"><td colspan="${COLS}">반려된 요청서는 목록에 표시되지만 합계에서는 제외됩니다.</td></tr></tfoot></table>${extra}`;
}
async function buildPay(src, R, step){
  if(dayList(R.from, R.to).length > PAY_MAX_DAYS){
    const msg = '경비(영수증 사진)는 한 번에 3달까지만 담아요 — 달마다(또는 분기마다) 따로 만들어 주세요';
    return { count: 0, warn: [msg], html: `<section class="arc-sec">${secHead('경비 지급 요청서', esc(rangeLabel(R)))}<p class="arc-err">${esc(msg)}</p></section>` };
  }
  const all = (await src.query('payRequests', [])).filter(r => !r.deleted && isDate(r.date) && (!R.org || (r.org || '') === R.org));
  const sel = all.filter(r => inR(r.date, R));
  const warn = [];
  const head0 = `${esc(rangeLabel(R))}${R.org ? ' · ' + esc(orgName(R.org)) : ''} · ${sel.length}건`;
  if(!sel.length) return { count: 0, warn, html: `<section class="arc-sec">${secHead('경비 지급 요청서', head0)}${emptyBox('이 기간에 올라온 지급 요청서가 없어요.')}</section>` };
  step && step(`경비 지급 요청서 ${sel.length}건 — 영수증 읽는 중`);
  const rcs = {};
  const rFail = await pool(sel, 4, async r => {
    const arr = await src.query('payReceipts', [['requestId', '==', r.id]]);
    rcs[r.id] = arr.filter(x => x.requestId === r.id && okImg(x.dataUrl)).sort((a, b) => (a.rowIdx - b.rowIdx) || (a.idx - b.idx));
  });
  if(rFail) warn.push(`요청서 ${rFail}건의 영수증을 읽지 못함`);
  const head = secHead('경비 지급 요청서', head0 + warnLine(warn));
  const orgs = [...new Set(sel.map(r => r.org || ''))].sort((a, b) => orgRank(a) - orgRank(b) || String(a).localeCompare(String(b)));
  let html = '', nRc = 0;
  for(const o of orgs){
    for(const mo of monthsOf(R)){
      const monthPool = all.filter(r => (r.org || '') === o && r.date.startsWith(mo));
      const { noMap, ordered } = monthNumbering(monthPool);
      const chosen = ordered.filter(r => inR(r.date, R));
      if(!chosen.length) continue;
      const [y, m] = mo.split('-').map(Number);
      const last = `${mo}-${pad(new Date(y, m, 0).getDate())}`;
      const whole = R.from <= `${mo}-01` && R.to >= last;
      html += `<div class="arc-pg"><div class="ps-head"><div class="ps-title">${esc(orgName(o) || '(기관 없음)')} 경비 지급 세부 내역</div>
        <div class="ps-sub">${y}년 ${m}월${whole ? ' (1일~말일)' : ` 가운데 ${esc(M.fmtMD(chosen[0].date))} ~ ${esc(M.fmtMD(chosen[chosen.length - 1].date))}`} · 요청서 ${chosen.length}건 · 번호는 그 달 전체 기준</div></div>
        ${payDetail(chosen, noMap, whole)}</div>`;
      let cards = '';
      for(const r of chosen){
        const list = rcs[r.id] || []; if(!list.length) continue;
        let cells = '';
        const types = await Promise.all(list.map(rc => classify(rc.dataUrl)));
        for(const [ri, rc] of list.entries()){
          const type = types[ri];
          const row = (r.rows || [])[rc.rowIdx];
          const label = row ? `${row.cat_major || ''}${row.cat_item ? ' › ' + row.cat_item : ''} · ${row.name || ''}` : '';
          cells += `<div class="prc-cell ${type}"><div class="prc-no">${esc(noMap[r.id] || '')}-${(+rc.rowIdx || 0) + 1}.${esc(rc.idx)}</div><img src="${rc.dataUrl}" alt="영수증">${label ? `<div class="prc-lbl">${esc(label)}</div>` : ''}</div>`;
          nRc++;
        }
        cards += `<div class="prc-card"><div class="prc-hd"><span class="prc-seq">${esc(noMap[r.id] || '')}</span><span class="prc-purpose">${esc(r.purpose || '(용도 미기재)')}</span>
          <span class="prc-meta">${esc(r.applicantName || '')} · ${esc(r.dept || '')} · ${esc(r.date || '')} · <b>₩${won(r.total)}</b> · 영수증 ${list.length}장</span></div><div class="prc-grid">${cells}</div></div>`;
      }
      if(cards) html += `<div class="arc-pg"><div class="prc-head"><div class="prc-title">${esc(orgName(o) || '(기관 없음)')} 경비 지급 영수증</div><div class="prc-sub">${y}년 ${m}월 · 위 세부 내역의 번호(P###-항목.장)와 대조하세요</div></div>${cards}</div>`;
    }
  }
  return { count: sel.length, warn, html: `<section class="arc-sec arc-wide">${head}<p class="arc-note">요청서 ${sel.length}건 · 영수증 ${nRc}장 · 기관 · 달마다 세부 내역 뒤에 영수증</p>${html}</section>` };
}

/* ═══ 4  출석부 — 반별 표 (기간이 한 달을 넘으면 학생별 합계) ═══ */
async function buildAtt(src, R, step){
  const [classes, students, types, recs0] = await Promise.all([
    src.query('classes', []), src.query('students', []), src.query('attendTypes', []).catch(() => []),
    src.query('studentAttendance', [['date', '>=', R.from], ['date', '<=', R.to]]),
  ]);
  const recs = recs0.filter(r => inR(r.date, R));
  const T = {}; types.forEach(t => { T[t.id] = t; });
  const S = {}; students.forEach(s => { S[s.id] = s; });
  const y = +R.from.slice(0, 4);
  let cls = classes.filter(c => +c.year === y);
  if(!cls.length) cls = classes.filter(c => +c.year === y - 1);
  if(R.org) cls = cls.filter(c => c.org === R.org);
  cls = cls.filter(c => (c.students || []).length).sort((a, b) => orgRank(a.org) - orgRank(b.org) || String(a.grade || '').localeCompare(String(b.grade || ''), 'ko', { numeric: true }) || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  const clsIds = new Set(cls.map(c => c.id));
  const nRec = recs.filter(r => clsIds.has(r.classId)).length;
  const head = secHead('출석부', `${esc(rangeLabel(R))}${R.org ? ' · ' + esc(orgName(R.org)) : ''} · 반 ${cls.length}개 · 기록 ${nRec}건`);
  if(!cls.length) return { count: 0, html: `<section class="arc-sec">${head}${emptyBox('이 해의 반 편성이 없어요.')}</section>` };
  step && step(`출석부 반 ${cls.length}개 · 기록 ${recs.length}건`);
  const tids = r => (Array.isArray(r.typeIds) && r.typeIds.length) ? r.typeIds : (r.typeId ? [r.typeId] : []);
  const tname = id => (T[id] && T[id].name) || '';
  const isPresent = id => !!(T[id] && (T[id].isPresent || T[id].name === '출석'));
  /* 학생 · 날짜 → 기록 (한 아이 · 한 날에 둘이면 그 반 것) */
  const at = {};
  recs.forEach(r => { const k = r.studentId + '|' + r.date; const cur = at[k]; if(!cur || r.classId) at[k] = r; });
  const days = dayList(R.from, R.to);
  const hasRec = new Set(recs.map(r => r.date));
  const cols = days.filter(d => { const w = new Date(d + 'T00:00:00').getDay(); return (w !== 0 && w !== 6) || hasRec.has(d); });
  const grid = cols.length <= 31;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const typeUsed = new Set();
  let body = '';
  for(const c of cls){
    /* 지금 명단 + 이 기간에 이 반 기록이 있는 학생(기간 중에 반을 옮기거나 그만둔 학생도 기록이 남게) */
    const ids = new Set(c.students || []); recs.forEach(r => { if(r.classId === c.id && r.studentId) ids.add(r.studentId); });
    const kids = [...ids].map(id => S[id]).filter(Boolean).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    if(!kids.length) continue;
    const notes = [];
    let tbl;
    if(grid){
      const th = cols.map(d => `<th>${+d.slice(8)}<br><small>${WD[new Date(d + 'T00:00:00').getDay()]}</small></th>`).join('');
      const trs = kids.map(s => `<tr><td class="arc-nm">${esc(s.name || '')}${s.status && s.status !== 'active' ? ` <small>(${esc({ leave: '휴학', quit: '자퇴', grad: '졸업', egrad: '조기졸업' }[s.status] || s.status)})</small>` : ''}</td>${cols.map(d => {
        const r = at[s.id + '|' + d]; if(!r) return '<td></td>';
        const ids = tids(r); if(!ids.length) return '<td></td>';
        ids.forEach(i => typeUsed.add(i));
        if(ids.every(isPresent)) return '<td class="ok">○</td>';
        const nm = ids.map(tname).filter(Boolean).join('·');
        if(r.reason || nm) notes.push(`${esc(s.name || '')} ${esc(M.fmtMD(d))} ${esc(nm)}${r.reason ? ' — ' + esc(r.reason) : ''}`);
        return `<td class="x">${esc((ids.map(tname).find(n => n && n !== '출석') || '?').slice(0, 1))}</td>`;
      }).join('')}</tr>`).join('');
      tbl = `<table class="arc-t arc-att"><thead><tr><th class="arc-nm">이름</th>${th}</tr></thead><tbody>${trs}</tbody></table>`;
    } else {
      const used = [...new Set(recs.flatMap(tids))].filter(i => !isPresent(i));
      used.forEach(i => typeUsed.add(i));
      const trs = kids.map(s => {
        const mine = days.map(d => at[s.id + '|' + d]).filter(Boolean);   // 한 아이 · 한 날은 한 번만
        mine.forEach(r => { const nm = tids(r).filter(i => !isPresent(i)).map(tname).filter(Boolean).join('·'); if(nm && notes.length < 40) notes.push(`${esc(s.name || '')} ${esc(M.fmtMD(r.date))} ${esc(nm)}${r.reason ? ' — ' + esc(r.reason) : ''}`); });
        return `<tr><td class="arc-nm">${esc(s.name || '')}</td><td class="arc-c">${mine.filter(r => tids(r).some(isPresent)).length}</td>${used.map(i => `<td class="arc-c">${mine.filter(r => tids(r).includes(i)).length || ''}</td>`).join('')}</tr>`;
      }).join('');
      tbl = `<table class="arc-t arc-att"><thead><tr><th class="arc-nm">이름</th><th>출석 기록</th>${used.map(i => `<th>${esc(tname(i))}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table>`;
    }
    body += `<div class="arc-cls"><h4>${esc(orgName(c.org))} · ${c.grade ? esc(c.grade) + ' ' : ''}${esc(c.name || '')} <small>${kids.length}명</small></h4>${tbl}
      ${notes.length ? `<div class="arc-notes">${notes.join('<br>')}</div>` : ''}</div>`;
  }
  const legend = grid ? `○ = 출석 · 글자 = 출결 항목 첫 글자 (${[...typeUsed].filter(i => !isPresent(i)).map(i => esc(tname(i))).join(' · ') || '없음'}) · 빈칸 = 기록 없음` : '기간이 한 달을 넘어 학생별 합계로 보여요';
  return { count: nRec, html: `<section class="arc-sec arc-wide">${head}<p class="arc-note">${legend}</p>${body}</section>` };
}

/* ═══ 5  활동 기록 ═══ */
async function buildAct(src, R, step){
  const a = new Date(R.from + 'T00:00:00'), b = new Date(new Date(R.to + 'T00:00:00').getTime() + DAY);
  const PAGE = { actexp: '활동 경비', family: '가정통신문', club: '동아리' };
  const logs = (await src.query('activityLogs', [['at', '>=', a], ['at', '<', b]]))
    .map(l => ({ ...l, ms: tsMs(l.at) })).filter(l => l.ms >= a.getTime() && l.ms < b.getTime() && (!R.org || !l.org || l.org === R.org)).sort((x, y) => x.ms - y.ms);
  const head = secHead('활동 기록', `${esc(rangeLabel(R))}${R.org ? ' · ' + esc(orgName(R.org)) : ''} · ${logs.length}건`);
  if(!logs.length) return { count: 0, html: `<section class="arc-sec">${head}${emptyBox('이 기간 활동 기록이 없어요.')}</section>` };
  step && step(`활동 기록 ${logs.length}건`);
  const rows = logs.map(l => `<tr><td>${esc(fmtDT(l.ms))}</td><td>${esc(l.name || l.byName || '')}</td><td>${esc(l.category || PAGE[l.page] || l.page || l.kind || '')}</td><td>${esc(l.action || '')}</td><td>${esc(l.target || l.ledgerName || '')}</td><td>${esc(l.detail || '')}</td></tr>`).join('');
  return { count: logs.length, html: `<section class="arc-sec">${head}<table class="arc-t arc-act"><thead><tr><th style="width:118px">때</th><th style="width:70px">누가</th><th style="width:80px">분류</th><th style="width:70px">작업</th><th style="width:22%">대상</th><th>내용</th></tr></thead><tbody>${rows}</tbody></table></section>` };
}

const BUILD = { mtg: (s, R, st) => buildMinutes(s, R, st, false), lead: (s, R, st) => buildMinutes(s, R, st, true), pay: buildPay, att: buildAtt, act: buildAct };

/* ═══ 전체 — 표지 · 목차 + 항목들 ═══ */
export async function buildArchive(src, opt, onStep){
  const R = { from: opt.from, to: opt.to, org: ORG_PICK.some(o => o.k === opt.org) ? opt.org : '' };
  if(!isDate(R.from) || !isDate(R.to) || R.from > R.to) throw new Error('기간을 확인해 주세요');
  if(dayList(R.from, R.to).length > 370) throw new Error('한 번에 1년까지만 만들 수 있어요');
  const keys = SECTIONS.map(s => s.k).filter(k => (opt.sections || []).includes(k));
  if(!keys.length) throw new Error('항목을 하나 이상 골라 주세요');
  const out = [];
  for(const k of keys){
    const meta = SECTIONS.find(s => s.k === k);
    onStep && onStep(`${meta.l} 읽는 중…`);
    try{ out.push({ k, l: meta.l, warn: [], ...(await BUILD[k](src, R, onStep)) }); }
    catch(e){ out.push({ k, l: meta.l, count: 0, err: String((e && (e.code || e.message)) || e), html: `<section class="arc-sec">${secHead(meta.l, '')}<p class="arc-err">읽지 못했어요 — ${esc((e && (e.code || e.message)) || e)}</p></section>` }); }
  }
  const made = new Date();
  const toc = out.map((s, i) => `<tr><td class="arc-c">${i + 1}</td><td><b>${esc(s.l)}</b><div class="arc-d">${esc(SECTIONS.find(x => x.k === s.k).d)}</div></td>
    <td class="arc-c">${s.err ? '<span class="arc-warn">읽지 못함</span>' : esc(s.count) + '건' + ((s.warn || []).length ? '<br><span class="arc-warn">⚠️ 일부 못 읽음</span>' : '')}</td></tr>`).join('');
  const cover = `<section class="arc-cover">
    <div class="arc-brand">교사 선교사</div>
    <h1>보관본</h1>
    <div class="arc-range">${esc(rangeLabel(R))}${R.org ? `<div class="arc-org">${esc(orgName(R.org))}</div>` : ''}</div>
    <table class="arc-t arc-toc"><thead><tr><th style="width:40px">#</th><th>항목</th><th style="width:90px">건수</th></tr></thead><tbody>${toc}</tbody></table>
    <div class="arc-meta">만든 때 ${esc(fmtDT(made.getTime()))}${opt.by ? ` · 만든 사람 ${esc(opt.by)}` : ''}${opt.auto ? ' · 자동 백업' : ''}<br>
      이 문서는 그 시점의 기록을 옮긴 사본이에요. 원본은 교사 선교사 사이트에 있어요.</div>
  </section>`;
  return { html: cover + out.map(s => s.html).join(''), sections: out.map(({ k, l, count, err, warn }) => ({ k, l, count, err: err || '', warn: (warn || []).slice(0, 4) })), made: made.getTime(), org: R.org };
}

/* ═══ 모양 — 화면 미리 보기 · 인쇄가 같은 규칙 ═══ */
const PS_CSS = `
.ps-head{text-align:center;margin-bottom:14px}.ps-title{font-size:19px;font-weight:800;color:#1b4332}.ps-sub{font-size:11.5px;color:#6b8579;margin-top:5px}
.ps-tbl{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}
.ps-tbl th,.ps-tbl td{border:1px solid #d9e2dd;padding:5px 6px;word-break:break-all}
.ps-tbl thead th{background:#2d6a4f;color:#fff;font-weight:700;text-align:center;font-size:10.5px}
.ps-tbl tr{break-inside:avoid}.ps-tbl tr.ps-req{break-after:avoid}
.ps-req td{background:#eef5f1;font-weight:800;color:#1b4332;padding:6px 8px;font-size:11.5px}
.ps-req .ps-no{color:#2d6a4f;font-weight:900}.ps-req .ps-meta{font-weight:600;color:#5a7267;font-size:10.5px}
.ps-bank{font-size:10px;color:#6b8579;font-weight:500}
.ps-c{text-align:center}.ps-r{text-align:right}.ps-amt{text-align:right;font-variant-numeric:tabular-nums}
.ps-sub2 td{background:#f7f9f8;font-weight:800;color:#2f5c48;text-align:right;font-size:11px}
.ps-corr{color:#5b21b6;font-weight:700}.ps-rejn{color:#991b1b;font-weight:700}
.ps-st{display:inline-block;padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:800}
.ps-st.paid{background:#dcfce7;color:#166534}.ps-st.wait{background:#fef3c7;color:#92400e}.ps-st.apv{background:#dbeafe;color:#1e40af}
.ps-st.inc{background:#ede9fe;color:#5b21b6}.ps-st.rej{background:#fee2e2;color:#991b1b}
.ps-tbl tfoot,.ps-sum tfoot{display:table-row-group}
.ps-tbl tfoot tr.ps-fn td{background:#fff;border:0;color:#8a9a91;font-size:10px;font-weight:500;padding:6px 0 0}
.ps-tbl tfoot td{background:#f0e4c4;font-weight:900;color:#8a6410;text-align:right;border-top:2px solid #b08d3c;font-size:12.5px;padding:8px}
.ps-empty{text-align:center;color:#999;padding:20px}
.ps-secttl{font-size:13px;font-weight:800;color:#1b4332;margin:18px 0 7px;padding-left:8px;border-left:4px solid #2d6a4f}
.ps-sum{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:4px}.ps-sum th,.ps-sum td{border:1px solid #d9e2dd;padding:6px 9px}
.ps-sum thead th{background:#eef5f1;color:#1b4332;font-weight:800}.ps-sum td.ps-r{text-align:right;font-variant-numeric:tabular-nums}
.ps-sum tfoot td{background:#f0e4c4;font-weight:900;color:#8a6410}.ps-foot{margin-top:12px;font-size:10px;color:#8a9a91;text-align:right}
.prc-head{text-align:center;border-bottom:2.5px solid #2d6a4f;padding-bottom:10px;margin-bottom:14px}.prc-title{font-size:18px;font-weight:800;color:#1b4332}.prc-sub{font-size:11.5px;color:#6b8579;margin-top:5px}
.prc-card{border:1px solid #d9e2dd;border-radius:10px;margin-bottom:14px;overflow:hidden;break-inside:avoid}
.prc-hd{background:#E8F3EF;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:1px solid #d9e2dd}
.prc-seq{background:#2d6a4f;color:#fff;font-size:12px;font-weight:800;padding:2px 9px;border-radius:10px}
.prc-purpose{font-size:14px;font-weight:800;color:#1b4332}.prc-meta{font-size:11px;color:#5a7267}.prc-meta b{color:#8a6410}
.prc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px}
.prc-cell{border:1px solid #e2e8e5;border-radius:10px;background:#F7F6F2;position:relative;overflow:hidden;text-align:center;padding:6px;break-inside:avoid}
.prc-cell.wide{grid-column:1 / -1}.prc-cell img{max-width:100%;object-fit:contain;display:block;margin:0 auto}
.prc-cell.tall img{max-height:400px}.prc-cell.short img{max-height:220px}.prc-cell.wide img{max-height:290px}
.prc-no{position:absolute;top:4px;left:4px;background:rgba(45,106,79,.9);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;z-index:1}
.prc-lbl{font-size:9.5px;color:#5a7267;margin-top:4px;line-height:1.3}`;

export const ARC_CSS = M.DOC_CSS + PS_CSS + `
.arc-doc{font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1F2320;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.arc-cover{min-height:240mm;display:flex;flex-direction:column;align-items:center;padding-top:28mm;text-align:center}
.arc-brand{font-size:14px;font-weight:800;letter-spacing:.3em;color:#00704A}
.arc-cover h1{font-size:44px;font-weight:900;letter-spacing:.3em;margin:10px 0 6px;color:#1E3932}
.arc-range{font-size:17px;font-weight:700;margin-bottom:26px}.arc-org{font-size:14px;color:#00704A;margin-top:4px}
.arc-toc{width:100%;max-width:150mm;text-align:left}
.arc-d{font-size:11px;color:#6B7670;font-weight:500;margin-top:2px}
.arc-meta{margin-top:auto;font-size:11px;color:#6B7670;line-height:1.8;padding-top:20px}
.arc-sec{break-before:page}
.arc-sh{border-bottom:2.5px solid #1E3932;padding-bottom:6px;margin-bottom:12px}
.arc-sh h2{font-size:20px;font-weight:900;margin:0;color:#1E3932}.arc-sh p{font-size:12px;color:#5A6560;margin:3px 0 0}
.arc-h3{font-size:13.5px;font-weight:800;margin:4px 0 6px}
.arc-pg{break-before:page}
.arc-sh + .arc-pg, .arc-note + .arc-pg, .arc-sum + .arc-pg{break-before:auto}
.arc-sum{margin-bottom:22px}
.arc-tag{display:inline-block;font-size:11px;font-weight:800;color:#fff;background:#00704A;border-radius:100px;padding:1px 10px;margin-bottom:4px}
.arc-t{width:100%;border-collapse:collapse;font-size:11px}
.arc-t th{background:#1E3932;color:#fff;padding:5px 6px;text-align:left;font-weight:700}
.arc-t td{border:1px solid #C9C5B9;padding:4px 6px;vertical-align:top;line-height:1.5;word-break:keep-all;overflow-wrap:anywhere}
.arc-t tr{break-inside:avoid}
.arc-c{text-align:center}
.arc-none{color:#6B7670;text-align:center;padding:24px 0;font-size:13px}
.arc-err{color:#B42318;font-weight:700;padding:12px 0}.arc-warn{color:#B42318}
.arc-note{font-size:11px;color:#5A6560;margin:0 0 8px}
.arc-cls{break-inside:avoid;margin-bottom:12px}
.arc-cls h4{font-size:12.5px;margin:0 0 4px}.arc-cls h4 small{color:#6B7670;font-weight:600}
.arc-att th,.arc-att td{text-align:center;padding:3px 2px;font-size:10px}.arc-att th small{font-weight:500;opacity:.8}
.arc-att .arc-nm{text-align:left;white-space:nowrap;padding-left:6px;min-width:70px}
.arc-att td.ok{color:#00704A}.arc-att td.x{color:#B42318;font-weight:800;background:#FDF1F0}
.arc-notes{font-size:10px;color:#5A6560;margin-top:4px;line-height:1.6}
.arc-act td{font-size:10px}
.md-th{break-after:avoid}.md-dec,.md-task,.md-img,.md-pg,.md-file,.md-link{break-inside:avoid}
.md-img img{max-height:300px}.md-pg img{max-width:100%}
.pcm{margin-top:18px;border-top:1px solid #C9C5B9;padding-top:8px}.pcm h3{font-size:12pt;margin:0 0 6px}
.pc{font-size:10pt;margin:0 0 7px;break-inside:avoid}.pc small{color:#6B7670}.pc.rp{margin:5px 0 0 18px}
@page{size:A4;margin:14mm 13mm 16mm;@bottom-center{content:counter(page) " / " counter(pages);font-size:8.5pt;color:#93A09A}}
@page wide{size:A4 landscape;margin:10mm 11mm 13mm;@bottom-center{content:counter(page) " / " counter(pages);font-size:8.5pt;color:#93A09A}}
.arc-wide{page:wide}
`;
