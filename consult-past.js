/* ═══ 📅 consult-past.js — 지난 상담 (보기만) · 예전 상담표 PDF · 인쇄 · PDF (v149) ═══
   · 끝난 상담: 확정본을 A4 일정표 모양으로 보기 · 인쇄 · PDF
   · 예전 상담표: 손으로 만든 일정표 PDF 를 담당이 올리면 쪽마다 그림으로 (선생님들은 보기만 · 원본 PDF 받기)
     저장: consultArchive/{id} (정보) + consultArchive/{id}/parts/{p쪽_조각 · c조각} — 문서 한 장 1MB 한도 아래로 나눠서 */
let A = null, C = null, esc = null;
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const CHUNK = 700000;            // 조각 하나 (base64 글자 수)
const PG_SIDE = 2000, PG_CAP = 650 * 1024;
const PDF_MAX = 5 * 1024 * 1024; // 원본 PDF 는 5MB 까지 그대로 보관
const IMG = {};                  // 'aid|p' → dataURL
let ZOOM = 1;

/* ═══ A4 일정표 (인쇄 · PDF · 지난 상담 보기) ═══ */
function famInfo(r, seats, nameOf){
  // 이번 상담은 화면 계산(A.fam) · 지난 상담은 문서 안 사진(stu.f)
  const live = A.R && r.id === A.R.id;
  const famOf = sid => live ? A.famOf(sid) : (((r.stu || {})[sid] || {}).f || sid);
  const members = {};
  Object.keys(seats).forEach(sid => { const k = famOf(sid); (members[k] = members[k] || []).push(sid); });
  const styles = C.famStyles(members, nameOf);
  return { famOf, styles };
}
export function a4Pages(a, r, seats, opt){
  A = a; C = a.C; esc = a.esc; opt = opt || {};
  const live = A.R && r.id === A.R.id;
  const nameOf = sid => live ? A.stuName(sid) : (((r.stu || {})[sid] || {}).n || (A.STU[sid] || {}).name || '');
  const colOf = sid => live ? A.colOf[sid] : (((r.stu || {})[sid] || {}).c || '');
  const kidOf = sid => live ? A.KIDS[sid] : ((r.stu || {})[sid] || {}).k;
  const inScope = sid => live ? A.inSet.has(sid) : true;
  const S = {}; Object.entries(seats || {}).forEach(([sid, st]) => { if(st && inScope(sid)) S[sid] = st; });
  const { famOf, styles } = famInfo(r, S, nameOf);
  const cols = r.cols || [], days = C.dayList(r);
  const n = cols.length;
  const tc = 92, cw = Math.floor((714 - tc) / Math.max(1, n));
  const fs = n > 10 ? 10.5 : n > 8 ? 11.5 : 12.5;
  const grid = `grid-template-columns:${tc}px repeat(${n},${cw}px)`;
  const occ = {}, etc = {};
  Object.entries(S).forEach(([sid, st]) => { const c = colOf(sid); if(st.k === 'face') occ[`${c}|${st.d}|${st.s}`] = sid; else (etc[`${c}|${st.k}`] = etc[`${c}|${st.k}`] || []).push(sid); });
  const nm = sid => { if(!sid) return ''; const f = styles[famOf(sid)]; const k = kidOf(sid); return `<div class="nm" style="${f ? `background:${f.bg};color:${f.fg};` : ''}${k ? 'border:1.5px dashed #00704A;' : ''}font-size:${fs}px">${esc(nameOf(sid))}${f ? ' ' + f.mark : ''}</div>`; };
  const headTb = `<div class="tb" style="${grid}"><div class="l h t0">학년</div>${cols.map(c => `<div class="h t0">${esc(c.grades || '')}<br><span style="font-weight:700;font-size:11px">${esc(c.name || '')}</span></div>`).join('')}
    <div class="l">상담 교사</div>${cols.map(c => `<div style="font-weight:800">${esc(c.tname || A.staffName(c.uid) || '')}</div>`).join('')}
    <div class="l">상담 교실</div>${cols.map(c => `<div style="font-size:11px">${esc(c.room || '')}</div>`).join('')}</div>`;
  const dayBlock = d => {
    const N = C.dayN(r, d);
    let h = `<div class="dl">${esc(C.dayLabel(days[d].date).replace(/(\d+)월 (\d+)일 \((.)\)/, (m0, mo, dd, w) => `${String(r.year).slice(-2)}. ${mo}. ${dd}. ${w}`))}</div><div class="tb" style="${grid}">`;
    for(let s = 0; s < N; s++){
      h += `<div class="l${s ? '' : ' t0'}" style="flex-direction:column;align-items:flex-start;gap:0;line-height:1.2"><b style="font-size:12px">${C.NO_KO[s]}</b><span style="font-size:11px;font-weight:600;color:#3E4944">${C.slotRange(r, d, s).replace('–', '~')}</span></div>`;
      cols.forEach(c => { h += `<div${s ? '' : ' class="t0"'} style="padding:2px">${nm(occ[`${c.key}|${d}|${s}`])}</div>`; });
    }
    return h + '</div>';
  };
  const etcBlock = () => {
    const any = Object.keys(etc).length; if(!any) return '';
    let h = `<div class="dl">그 외</div><div class="tb" style="${grid}">`;
    [['phone', '전화 상담'], ['sep', '별도 일정']].forEach(([k, l], i) => {
      h += `<div class="l${i ? '' : ' t0'}">${l}</div>`;
      cols.forEach(c => { const ids = etc[`${c.key}|${k}`] || []; h += `<div${i ? '' : ' class="t0"'} style="flex-direction:column;gap:2px;padding:2px">${ids.map(id => nm(id) + (S[id].note ? `<span style="font-size:10px;color:#3E4944;line-height:1.2">${esc(S[id].note)}</span>` : '')).join('')}</div>`; });
    });
    return h + '</div>';
  };
  // 쪽 나누기 — 높이 어림 (머리 170 · 날마다 32 + 칸 × 31 · 그 외 32 + 2 × 36)
  const budget = 1123 - 74 - 30;
  const blocks = days.map((x, d) => ({ h: 32 + C.dayN(r, d) * 31, html: dayBlock(d) }));
  const eb = etcBlock(); if(eb) blocks.push({ h: 32 + 2 * 40, html: eb });
  const pages = []; let cur = [], used = 0;
  const head = 90 + 26 + 100;
  blocks.forEach(b => { if(cur.length && used + b.h > budget - head){ pages.push(cur); cur = []; used = 0; } cur.push(b.html); used += b.h; });
  if(cur.length) pages.push(cur);
  const at = r.sentAt && r.sentAt.seconds ? new Date(r.sentAt.seconds * 1000) : (r.updatedAt && r.updatedAt.seconds ? new Date(r.updatedAt.seconds * 1000) : new Date());
  const p2 = v => String(v).padStart(2, '0');
  const stamp = `${opt.ver ? '판 ' + opt.ver + ' · ' : ''}${at.getFullYear()}. ${p2(at.getMonth() + 1)}. ${p2(at.getDate())}. ${p2(at.getHours())}:${p2(at.getMinutes())}`;
  return pages.map((blks, i) => `<div class="cs-a4"><div class="ttl"><div>다니엘 아마츠 · ${esc(r.year)}학년도 ${esc(r.term)}학기</div><b>학부모 상담 일정표</b></div>
    <div class="meta"><span>같은 색 · 같은 번호 = 한 가정 (이어진 시간) · 점선 = 교직원 자녀</span><span>${esc(stamp)}${pages.length > 1 ? ` · ${i + 1}/${pages.length}` : ''}</span></div>
    ${headTb}${blks.join('')}<div class="ft">상담 시간 ${C.tplOf(r).len}분 · 시간 변경은 담임 선생님께 · 교사 선교사</div></div>`).join('');
}
export async function printRound(a, r, seats){
  A = a; C = a.C; esc = a.esc;
  const ver = (A.isMgr && r.id === (A.R || {}).id) ? (r.ver || 0) : (r.sentVer || r.ver || 0);
  const html = a4Pages(A, r, seats, { ver });
  const m = A.modal('🖨 학부모 상담 일정표', `<div class="cs-desc" style="margin-bottom:10px">A4 세로 · ${A.isMgr && r.id === (A.R || {}).id ? '지금 표 (담당이 고치는 자리)' : '보낸 판'} 그대로예요. 흑백으로 뽑아도 같은 번호로 가정을 가를 수 있어요.</div><div data-pv style="overflow:auto">${html}</div>`,
    '<button class="cs-btn" data-x2>닫기</button><button class="cs-btn" data-pr>인쇄</button><button class="cs-btn g" data-pdf>PDF 저장</button>', 'wide');
  const fit = () => { const box = m.box.querySelector('[data-pv]'); const k = Math.min(1, (box.clientWidth - 8) / 794); box.querySelectorAll('.cs-a4').forEach(p => { p.style.transform = k < 1 ? `scale(${k})` : ''; p.style.transformOrigin = 'top left'; p.style.marginBottom = k < 1 ? `${-1123 * (1 - k) + 14}px` : ''; }); };
  setTimeout(fit, 0);
  m.box.querySelector('[data-x2]').onclick = () => m.close();
  const name = ['학부모상담일정표', r.title || '', ver ? '판' + ver : ''];
  m.box.querySelector('[data-pr]').onclick = () => {
    const pr = document.getElementById('cs-print'); pr.innerHTML = html; pr.style.display = 'block';
    const done = () => { pr.style.display = 'none'; pr.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    if(window.FN && FN.printAs) FN.printAs(name); else window.print();
    setTimeout(done, 60000);
  };
  m.box.querySelector('[data-pdf]').onclick = async () => {
    window.showLoading && showLoading('PDF를 만드는 중…');
    try{
      if(window.ensureH2C) await ensureH2C(); if(window.ensureJsPDF) await ensureJsPDF();
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px'; host.innerHTML = html; document.body.appendChild(host);
      const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pages = [...host.querySelectorAll('.cs-a4')];
      for(let i = 0; i < pages.length; i++){
        const cv = await window.html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        if(i) pdf.addPage();
        pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      }
      host.remove();
      pdf.save(window.FN ? FN.make(name, { ext: '.pdf' }) : '학부모상담일정표.pdf');
    }catch(e){ A.toast('PDF를 만들지 못했어요 — ' + (e.message || ''), 'err'); }
    window.hideLoading && hideLoading();
  };
}

/* ═══ 지난 상담 ═══ */
async function loadArch(){
  if(A.ARCH) return A.ARCH;
  const list = [];
  try{ const s = await A.FS.getDocs(A.FS.collection(A.db, 'consultArchive')); s.forEach(d => list.push(Object.assign({ id: d.id }, d.data()))); }catch(e){}
  list.sort((a, b) => ((b.year || 0) * 10 + (b.term || 0)) - ((a.year || 0) * 10 + (a.term || 0)) || String(a.title || '').localeCompare(String(b.title || ''), 'ko'));
  A.ARCH = list; return list;
}
const pastRounds = () => A.ROUNDS.filter(r => r.state === 'closed' || (r.state === 'final' && A.R && r.id !== A.R.id));
export function pastHTML(a, sub){
  A = a; C = a.C; esc = a.esc;
  if(sub && sub.startsWith('r:')) return roundView(sub.slice(2));
  if(sub && sub.startsWith('a:')) return archView(sub.slice(2));
  const rs = pastRounds();
  const arch = A.ARCH;
  const yt = x => `${x.year || '?'}학년도 ${x.term || '?'}학기`;
  return `<div style="margin-top:12px;display:flex;flex-direction:column;gap:14px">
    <div class="cs-card cs-desc">🗂 지난 상담은 <b>보기만</b> 할 수 있어요 — 예전엔 어떻게 잡았는지 참고하세요. 끝난 상담의 가정마다 자리(앞 · 가운데 · 뒤)는 다음 학기 순번 점검에 저절로 쓰여요.</div>
    <div><h3 style="margin:0 0 8px;font-size:15px;font-weight:900">교사 선교사에서 만든 상담</h3>
      <div class="cs-past">${rs.map(r => `<button class="cs-pc" data-pr="${esc(r.id)}"><b>${esc(r.title || r.id)}</b><span>${esc(C.dayList(r).map(d => C.dayLabel(d.date, true)).join(' · '))}</span><span>${Object.keys(r.sentSeats || r.seats || {}).length}명 · ${(r.cols || []).length}반 · ${r.state === 'closed' ? '끝남' : '확정'}${r.dir ? ' · ' + (r.dir === 'desc' ? 'ㅎ→ㄱ' : 'ㄱ→ㅎ') : ''}</span></button>`).join('') || '<div class="cs-mut">아직 끝난 상담이 없어요.</div>'}</div></div>
    <div><h3 style="margin:0 0 8px;font-size:15px;font-weight:900;display:flex;align-items:center;gap:10px;flex-wrap:wrap">예전 상담표 (PDF · 보기만) ${A.isMgr ? '<label class="cs-btn sm g" style="cursor:pointer">+ PDF 올리기 (여러 개)<input type="file" accept="application/pdf,.pdf" multiple data-up style="display:none"></label>' : ''}</h3>
      ${arch == null ? '<div class="cs-mut">불러오는 중…</div>' : `<div class="cs-past">${arch.map(x => `<button class="cs-pc" data-pa="${esc(x.id)}"><b>${esc(x.title || yt(x))}</b><span>${esc(yt(x))} · ${x.pages || 0}쪽</span><span class="cs-mut">${esc(x.name || '')}</span></button>`).join('') || `<div class="cs-mut">아직 올린 예전 상담표가 없어요.${A.isMgr ? ' 손으로 만든 일정표 PDF를 «+ PDF 올리기»로 여러 개 한꺼번에 올려 주세요 — 파일 이름에서 학년도 · 학기를 읽어요.' : ''}</div>`}</div>`}</div></div>`;
}
function roundView(id){
  const r = A.ROUNDS.find(x => x.id === id);
  if(!r) return '<div class="cs-card cs-empty" style="margin-top:12px">찾지 못했어요. <a href="#past">← 지난 상담</a></div>';
  const seats = r.sentSeats || r.seats || {};
  return `<div style="margin-top:12px;display:flex;flex-direction:column;gap:12px"><div class="cs-tools"><a class="cs-btn sm" href="#past">← 지난 상담</a><b style="font-size:16px">${esc(r.title || r.id)}</b><span class="cs-mut">${r.state === 'closed' ? '끝남 · 보기만' : '확정'} · 판 ${r.sentVer || r.ver || 0}</span><span class="sp"></span><button class="cs-btn sm" data-prp="${esc(r.id)}">🖨 인쇄 · PDF</button></div>
    <div data-a4w style="overflow:auto">${a4Pages(A, r, seats, { ver: r.sentVer || r.ver })}</div></div>`;
}
function archView(id){
  const x = (A.ARCH || []).find(v => v.id === id);
  if(!x) return '<div class="cs-card cs-empty" style="margin-top:12px">불러오는 중…</div>';
  const imgs = [...Array(x.pages || 0).keys()].map(p => `<img data-pg="${p}" alt="${esc(x.title || '')} ${p + 1}쪽" src="${IMG[x.id + '|' + p] || ''}" style="${IMG[x.id + '|' + p] ? '' : 'min-height:400px;width:100%;max-width:900px'}">`).join('');
  return `<div style="margin-top:12px;display:flex;flex-direction:column;gap:12px"><div class="cs-tools"><a class="cs-btn sm" href="#past">← 지난 상담</a><b style="font-size:16px">${esc(x.title || '')}</b><span class="cs-mut">${esc(x.year)}학년도 ${esc(x.term)}학기 · ${x.pages}쪽 · 보기만</span><span class="sp"></span>
    <div class="cs-seg"><button data-z="-">－</button><button data-z="0">맞춤</button><button data-z="+">＋</button></div>
    ${x.pdf ? '<button class="cs-btn sm" data-dl>원본 PDF 받기</button>' : ''}${A.isMgr ? '<button class="cs-btn sm" data-aed>이름 · 학기</button><button class="cs-btn sm r" data-adel>지우기</button>' : ''}</div>
    <div class="cs-pv${ZOOM !== 1 ? ' zoom' : ''}" style="--z:${ZOOM}">${imgs}</div></div>`;
}
async function loadPages(x){
  for(let p = 0; p < (x.pages || 0); p++){
    const key = x.id + '|' + p; if(IMG[key]) continue;
    const n = (x.pp || [])[p] || 1; let s = '';
    for(let k = 0; k < n; k++){ const d = await A.FS.getDoc(A.FS.doc(A.db, 'consultArchive', x.id, 'parts', `p${p}_${k}`)); s += d.exists() ? (d.data().data || '') : ''; }
    IMG[key] = s;
    const el = document.querySelector(`.cs-pv img[data-pg="${p}"]`); if(el){ el.src = s; el.style.minHeight = ''; el.style.width = ''; }
  }
}
export function after(a, sub){
  A = a; C = a.C; esc = a.esc;
  const root = document.getElementById('cs'); if(!root) return;
  if(A.ARCH == null) loadArch().then(() => { if(A.VIEW === 'past') A.render(true); });
  if(sub && sub.startsWith('a:') && A.ARCH){ const x = A.ARCH.find(v => v.id === sub.slice(2)); if(x) loadPages(x).catch(() => A.toast('쪽을 불러오지 못했어요', 'err')); }
  const w = root.querySelector('[data-a4w]');
  if(w){ const k = Math.min(1, (w.clientWidth - 8) / 794); w.querySelectorAll('.cs-a4').forEach(p => { p.style.transform = k < 1 ? `scale(${k})` : ''; p.style.transformOrigin = 'top left'; p.style.marginBottom = k < 1 ? `${-1123 * (1 - k) + 14}px` : ''; }); }
  root.onclick = async e => {
    const t = e.target;
    const pr = t.closest('[data-pr]'); if(pr){ A.go('past/r:' + pr.dataset.pr); return; }
    const pa = t.closest('[data-pa]'); if(pa){ A.go('past/a:' + pa.dataset.pa); return; }
    const pp = t.closest('[data-prp]'); if(pp){ const r = A.ROUNDS.find(x => x.id === pp.dataset.prp); if(r) printRound(A, r, r.sentSeats || r.seats || {}); return; }
    const z = t.closest('[data-z]'); if(z){ ZOOM = z.dataset.z === '0' ? 1 : Math.max(0.6, Math.min(3, ZOOM + (z.dataset.z === '+' ? 0.25 : -0.25))); A.render(true); return; }
    const x = (A.ARCH || []).find(v => sub && v.id === sub.slice(2));
    if(t.closest('[data-dl]') && x){ try{ await download(x); }catch(err){ A.toast('받지 못했어요 — ' + A.errText(err), 'err'); } return; }
    if(t.closest('[data-adel]') && x){ if(!(await A.confirm('예전 상담표 지우기', `«${esc(x.title)}»을(를) 지울까요? 되돌릴 수 없어요.`, '지우기', true))) return; try{ await delArch(x); A.ARCH = A.ARCH.filter(v => v.id !== x.id); A.go('past'); A.toast('지웠어요'); }catch(err){ A.toast('지우지 못했어요 — ' + A.errText(err), 'err'); } return; }
    if(t.closest('[data-aed]') && x){ const v = await A.prompt('이름 · 학기', '이름', x.title || '', { help: '학년도 · 학기는 아래 예처럼 이름에 넣으면 저절로 읽어요 (예: 2024학년도 2학기 학부모 상담 일정표)' }); if(v == null) return; const yt = C.yearTermFromName(v); const p = { title: v.trim() }; if(yt.year){ p.year = yt.year; p.term = yt.term; } try{ await A.FS.updateDoc(A.FS.doc(A.db, 'consultArchive', x.id), p); Object.assign(x, p); A.render(true); }catch(err){ A.toast('저장하지 못했어요 — ' + A.errText(err), 'err'); } return; }
  };
  root.onchange = async e => { if(e.target.matches('[data-up]')){ const files = [...e.target.files]; e.target.value = ''; if(files.length) uploadFlow(files); } };
}

/* ═══ 예전 상담표 올리기 ═══ */
function loadScript(src, ok){
  return new Promise((res, rej) => {
    if(ok()) return res();
    const s = document.createElement('script'); s.src = src;
    s.onload = () => ok() ? res() : rej(new Error('부품을 불러오지 못했어요'));
    s.onerror = () => rej(new Error('부품을 불러오지 못했어요 — 인터넷 연결을 확인해 주세요'));
    document.head.appendChild(s);
  });
}
function shrinkCanvas(cv){
  let q = 0.85, data = cv.toDataURL('image/jpeg', q);
  while(data.length > PG_CAP * 1.37 && q > 0.45){ q -= 0.08; data = cv.toDataURL('image/jpeg', q); }
  if(data.length > PG_CAP * 1.37){ const k = Math.sqrt((PG_CAP * 1.37) / data.length); const c2 = document.createElement('canvas'); c2.width = Math.round(cv.width * k); c2.height = Math.round(cv.height * k); const g = c2.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c2.width, c2.height); g.drawImage(cv, 0, 0, c2.width, c2.height); data = c2.toDataURL('image/jpeg', 0.72); return { data, w: c2.width, h: c2.height }; }
  return { data, w: cv.width, h: cv.height };
}
async function renderPdf(buf, onStep){
  await loadScript(PDFJS + 'pdf.min.js', () => !!window.pdfjsLib);
  if(window.pdfjsLib.GlobalWorkerOptions) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  const pdf = await window.pdfjsLib.getDocument({ data: buf, cMapUrl: PDFJS + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS + 'standard_fonts/' }).promise;
  const n = Math.min(pdf.numPages, 20), out = [];
  for(let i = 1; i <= n; i++){
    onStep && onStep(i, n);
    const pg = await pdf.getPage(i);
    const v0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(3, PG_SIDE / Math.max(v0.width, v0.height)) });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: g, viewport: vp }).promise;
    out.push(shrinkCanvas(cv));
  }
  return { pages: out, total: pdf.numPages };
}
const b64Of = buf => { const u8 = new Uint8Array(buf); let s = ''; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function uploadFlow(files){
  const rows = files.map(f => { const yt = C.yearTermFromName(f.name); return { f, year: yt.year || '', term: yt.term || '', title: yt.year ? `${yt.year}학년도 ${yt.term}학기 학부모 상담 일정표` : f.name.replace(/\.pdf$/i, '') }; });
  const m = A.modal('📤 예전 상담표 올리기', `<div class="cs-desc" style="margin-bottom:10px">파일 이름에서 학년도 · 학기를 읽었어요. 맞는지 보고 «올리기»를 눌러 주세요 — 쪽마다 그림으로 바꿔 보관하고, 원본 PDF도 함께 둬요 (5MB까지).</div>
    <div class="cs-tbl">${rows.map((x, i) => `<div class="cs-tr" style="grid-template-columns:minmax(0,1.4fr) 110px 90px minmax(0,1.6fr)"><span class="cs-mut" style="font-size:12px;overflow:hidden;text-overflow:ellipsis">${esc(x.f.name)}</span>
      <select class="cs-sel" data-y="${i}" style="height:32px"><option value="">학년도</option>${[...Array(12).keys()].map(k => 2018 + k).map(y => `<option value="${y}"${+x.year === y ? ' selected' : ''}>${y}</option>`).join('')}</select>
      <select class="cs-sel" data-t="${i}" style="height:32px"><option value="">학기</option><option value="1"${+x.term === 1 ? ' selected' : ''}>1학기</option><option value="2"${+x.term === 2 ? ' selected' : ''}>2학기</option></select>
      <input class="cs-in" data-n="${i}" value="${esc(x.title)}" style="height:32px"></div>`).join('')}</div><div data-st class="cs-mut" style="margin-top:10px"></div>`,
    '<button class="cs-btn" data-c>취소</button><button class="cs-btn g" data-go>올리기</button>', 'mid');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-go]').onclick = async () => {
    rows.forEach((x, i) => { x.year = +m.box.querySelector(`[data-y="${i}"]`).value || 0; x.term = +m.box.querySelector(`[data-t="${i}"]`).value || 0; x.title = m.box.querySelector(`[data-n="${i}"]`).value.trim() || x.f.name; });
    if(rows.some(x => !x.year || !x.term)){ A.toast('학년도 · 학기를 모두 골라 주세요', 'err'); return; }
    const go = m.box.querySelector('[data-go]'); go.disabled = true;
    const st = m.box.querySelector('[data-st]');
    let ok = 0;
    for(let i = 0; i < rows.length; i++){
      const x = rows[i];
      try{
        st.textContent = `${i + 1} / ${rows.length} · ${x.title} — 쪽 그림 만드는 중…`;
        const buf = await x.f.arrayBuffer();
        const { pages } = await renderPdf(buf.slice(0), (p, n) => { st.textContent = `${i + 1} / ${rows.length} · ${x.title} — ${p} / ${n}쪽`; });
        const ref = A.FS.doc(A.FS.collection(A.db, 'consultArchive'));
        const pp = [];
        for(let p = 0; p < pages.length; p++){
          const s = pages[p].data; const n = Math.max(1, Math.ceil(s.length / CHUNK)); pp.push(n);
          for(let k = 0; k < n; k++) await A.FS.setDoc(A.FS.doc(A.db, 'consultArchive', ref.id, 'parts', `p${p}_${k}`), { kind: 'page', p, k, data: s.slice(k * CHUNK, (k + 1) * CHUNK) });
          IMG[ref.id + '|' + p] = s;
        }
        let pdfN = 0;
        if(x.f.size <= PDF_MAX){
          st.textContent = `${i + 1} / ${rows.length} · ${x.title} — 원본 PDF 보관 중…`;
          const b64 = b64Of(buf); pdfN = Math.max(1, Math.ceil(b64.length / CHUNK));
          for(let k = 0; k < pdfN; k++) await A.FS.setDoc(A.FS.doc(A.db, 'consultArchive', ref.id, 'parts', `c${k}`), { kind: 'pdf', k, data: b64.slice(k * CHUNK, (k + 1) * CHUNK) });
        }
        await A.FS.setDoc(ref, { org: C.ORG, title: x.title, year: x.year, term: x.term, name: x.f.name, size: x.f.size, pages: pages.length, pp, pdf: pdfN,
          w: (pages[0] || {}).w || 0, h: (pages[0] || {}).h || 0, at: A.FS.serverTimestamp(), by: A.CU.uid, byName: A.CU.name || '' });
        ok++;
      }catch(e){ A.toast(`${x.f.name} — 올리지 못했어요 (${A.errText(e)})`, 'err'); console.error(e); }
    }
    m.close(); A.ARCH = null; await loadArch(); A.render(true);
    A.toast(`예전 상담표 ${ok}개를 올렸어요`);
  };
}
async function download(x){
  let b64 = '';
  for(let k = 0; k < (x.pdf || 0); k++){ const d = await A.FS.getDoc(A.FS.doc(A.db, 'consultArchive', x.id, 'parts', `c${k}`)); b64 += d.exists() ? (d.data().data || '') : ''; }
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })); a.download = x.name || ((x.title || '상담표') + '.pdf');
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function delArch(x){
  const s = await A.FS.getDocs(A.FS.collection(A.db, 'consultArchive', x.id, 'parts'));
  const ids = []; s.forEach(d => ids.push(d.id));
  for(let i = 0; i < ids.length; i += 400){ const bt = A.FS.writeBatch(A.db); ids.slice(i, i + 400).forEach(pid => bt.delete(A.FS.doc(A.db, 'consultArchive', x.id, 'parts', pid))); await bt.commit(); }
  await A.FS.deleteDoc(A.FS.doc(A.db, 'consultArchive', x.id));
}
