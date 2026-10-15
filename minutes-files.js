/* ═══════════════════════════════════════════════════════════
   📎 minutes-files.js — 회의록 사진 · 표 · 문서 (v-93)
   · 사진: 긴 쪽 1,600px · 한 장 약 0.2~0.4MB로 줄여 저장 (쪽지 사진과 같은 방식)
   · 문서: 5MB까지는 조각으로 나눠 그대로 보관 → «받기»로 원본 그대로 · 더 크면 드라이브 링크
   · PDF: 쪽마다 그림으로 펼쳐 회의록 안에서 바로 보이게
   · 표: Numbers · 엑셀에서 칸을 복사해 붙이면 칸 색 · 굵기 · 맞춤까지
   ═══════════════════════════════════════════════════════════ */
import { esc } from './minutes-core.js';

export const FILE_MAX = 5 * 1024 * 1024;     // 그대로 보관하는 문서 한 개 최대 크기
const CHUNK = 700000;                          // 조각 하나 (base64 글자 수 — 문서 한 장 1MB 한도 아래)
const IMG_SIDE = 1600, IMG_CAP = 400 * 1024;   // 사진
const PG_SIDE = 1500,  PG_CAP = 360 * 1024;    // PDF 쪽

/* ── 글자 다듬기 — 굵게 · 기울임 · 밑줄 · 형광펜 · 글자색 · 줄바꿈만 남긴다 ── */
function rgbHex(c){
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(String(c || ''));
  if(m){
    if(m[4] != null && +m[4] < 0.1) return '';
    return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if(h){ let v = h[1]; if(v.length === 3) v = v.split('').map(x => x + x).join(''); return '#' + v.toUpperCase(); }
  return '';
}
const rgbOf = hx => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
const isWhite = hx => { if(!hx) return true; const [r, g, b] = rgbOf(hx); return r > 0xF2 && g > 0xF2 && b > 0xF2; };
const isBlack = hx => { if(!hx) return true; const [r, g, b] = rgbOf(hx); return r < 0x40 && g < 0x40 && b < 0x40; };
function inlineOf(node, depth){
  depth = depth || 0;
  if(depth > 30) return '';
  let out = '';
  node.childNodes.forEach(n => {
    if(n.nodeType === 3){ out += esc(n.nodeValue.replace(/ /g, ' ')); return; }
    if(n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if(['script','style','meta','link','title','head'].includes(tag)) return;
    if(tag === 'br'){ out += '<br>'; return; }
    let inner = inlineOf(n, depth + 1);
    const st = n.getAttribute('style') || '';
    const bg = rgbHex((/background(?:-color)?\s*:\s*([^;]+)/i.exec(st) || [])[1] || n.getAttribute('bgcolor') || '');
    const fg = rgbHex((/(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(st) || [])[1] || n.getAttribute('color') || '');
    const bold = /font-weight\s*:\s*(bold|[6-9]00)/i.test(st);
    if(tag === 'b' || tag === 'strong' || bold) inner = inner ? `<b>${inner}</b>` : '';
    if(tag === 'i' || tag === 'em') inner = inner ? `<i>${inner}</i>` : '';
    if(tag === 'u') inner = inner ? `<u>${inner}</u>` : '';
    if(tag === 'mark' || (bg && !isWhite(bg))) inner = inner ? `<mark>${inner}</mark>` : '';
    if(fg && !isBlack(fg) && tag !== 'mark') inner = inner ? `<span style="color:${fg}">${inner}</span>` : '';
    if(['div','p','li','h1','h2','h3','h4','tr'].includes(tag) && out && !/<br>$/.test(out)) out += '<br>';
    out += inner;
  });
  return out;
}
export function sanitizeInline(html){
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html').body.firstChild;
  let s = d ? inlineOf(d) : '';
  s = s.replace(/(<br>\s*)+$/g, '').replace(/^(\s*<br>)+/g, '');
  s = s.replace(/<(b|i|u|mark)><\/\1>/g, '');
  return s;
}

/* ── 표 — 칸 색 · 굵기 · 맞춤 · 합친 칸을 살린다 (엑셀의 «클래스 색»까지 읽으려 보이지 않는 틀에서 계산) ── */
function cellStyle(cs){
  const parts = [];
  const bg = rgbHex(cs.backgroundColor); if(bg && !isWhite(bg)) parts.push('background-color:' + bg);
  const fg = rgbHex(cs.color); if(fg && !isBlack(fg)) parts.push('color:' + fg);
  const ta = cs.textAlign; if(ta === 'center' || ta === 'right' || ta === '-webkit-center') parts.push('text-align:' + (ta === 'right' ? 'right' : 'center'));
  const fw = String(cs.fontWeight); if(fw === 'bold' || +fw >= 600) parts.push('font-weight:700');
  return parts.join(';');
}
function tableFromDOM(tbl, styleOf){
  const rows = [...tbl.rows].slice(0, 400);
  if(!rows.length) return '';
  let html = '<table>';
  rows.forEach(tr => {
    html += '<tr>';
    [...tr.cells].slice(0, 60).forEach(td => {
      const tag = td.tagName.toLowerCase() === 'th' ? 'th' : 'td';
      const cs = Math.min(50, Math.max(1, parseInt(td.getAttribute('colspan') || '1', 10) || 1));
      const rs = Math.min(200, Math.max(1, parseInt(td.getAttribute('rowspan') || '1', 10) || 1));
      const st = styleOf(td);
      const inner = sanitizeInline(td.innerHTML);
      html += `<${tag}${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}${st ? ` style="${st}"` : ''}>${inner}</${tag}>`;
    });
    html += '</tr>';
  });
  return html + '</table>';
}
/* 붙여 넣은 HTML(엑셀·Numbers·웹)에서 첫 표 → 깨끗한 표 */
export function sanitizeTableHTML(html){
  return new Promise(resolve => {
    try{
      const fr = document.createElement('iframe');
      fr.setAttribute('sandbox', 'allow-same-origin');
      fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:800px;opacity:0;pointer-events:none';
      document.body.appendChild(fr);
      const d = fr.contentDocument;
      d.open(); d.write(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '')); d.close();
      setTimeout(() => {
        try{
          const t = d.querySelector('table');
          const out = t ? tableFromDOM(t, el => cellStyle(fr.contentWindow.getComputedStyle(el))) : '';
          fr.remove(); resolve(out);
        }catch(e){ fr.remove(); resolve(''); }
      }, 30);
    }catch(e){ resolve(''); }
  });
}
/* 고치는 중인 표(이미 깨끗한 표)를 다시 다듬기 — 칸 안의 군더더기만 */
export function cleanEditedTable(tableEl){
  const styleOf = el => {
    const s = el.getAttribute('style') || '';
    const parts = [];
    const bg = rgbHex((/background-color\s*:\s*([^;]+)/i.exec(s) || [])[1]); if(bg && !isWhite(bg)) parts.push('background-color:' + bg);
    const fg = rgbHex((/(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(s) || [])[1]); if(fg && !isBlack(fg)) parts.push('color:' + fg);
    const ta = (/text-align\s*:\s*(\w+)/i.exec(s) || [])[1]; if(ta === 'center' || ta === 'right') parts.push('text-align:' + ta);
    if(/font-weight\s*:\s*(bold|[6-9]00)/i.test(s)) parts.push('font-weight:700');
    return parts.join(';');
  };
  return tableFromDOM(tableEl, styleOf);
}

/* 🔒 보여 줄 때 한 번 더 다듬기 (저장된 글을 그대로 믿지 않는다) — 같은 글은 기억해 두고 다시 쓰기 */
const _ci = new Map(), _ct = new Map();
export function cleanInlineCached(h){
  h = String(h || ''); if(!h) return '';
  if(!/[<&]/.test(h)) return h;                      // 태그도 엔티티도 없으면 그대로 (대부분의 줄)
  let v = _ci.get(h); if(v == null){ v = sanitizeInline(h); if(_ci.size > 4000) _ci.clear(); _ci.set(h, v); }
  return v;
}
export function cleanTableCached(h){
  h = String(h || ''); if(!h) return '';
  let v = _ct.get(h);
  if(v == null){
    const t = new DOMParser().parseFromString(h, 'text/html').querySelector('table');
    v = t ? cleanEditedTable(t) : '';
    if(_ct.size > 400) _ct.clear(); _ct.set(h, v);
  }
  return v;
}

/* ── 사진 줄이기 ── */
function loadImg(src){
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('그림을 읽지 못했어요')); im.src = src; });
}
export function readAsDataURL(file){
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
}
export async function shrink(src, side, cap){
  const im = await loadImg(src);
  let w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  const k = Math.min(1, side / Math.max(w, h));
  w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
  let q = 0.82, data = cv.toDataURL('image/jpeg', q);
  while(data.length > cap * 1.37 && q > 0.42){ q -= 0.08; data = cv.toDataURL('image/jpeg', q); }
  if(data.length > cap * 1.37){            // 그래도 크면 한 번 더 작게
    const k2 = Math.sqrt((cap * 1.37) / data.length);
    const cv2 = document.createElement('canvas'); cv2.width = Math.round(w * k2); cv2.height = Math.round(h * k2);
    const g2 = cv2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, cv2.width, cv2.height); g2.drawImage(cv, 0, 0, cv2.width, cv2.height);
    data = cv2.toDataURL('image/jpeg', 0.7); w = cv2.width; h = cv2.height;
  }
  return { data, w, h, size: Math.round(data.length * 0.75) };
}

function loadScript(src, ok){
  return new Promise((res, rej) => {
    if(ok()) return res();
    const s = document.createElement('script'); s.src = src;
    s.onload = () => ok() ? res() : rej(new Error('부품을 불러오지 못했어요'));
    s.onerror = () => rej(new Error('부품을 불러오지 못했어요 — 인터넷 연결을 확인해 주세요'));
    document.head.appendChild(s);
  });
}
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
export async function pdfPages(file, onStep){
  await loadScript(PDFJS + 'pdf.min.js', () => !!window.pdfjsLib);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf, cMapUrl: PDFJS + 'cmaps/', cMapPacked: true,
    standardFontDataUrl: PDFJS + 'standard_fonts/' }).promise;
  const n = Math.min(pdf.numPages, 30);
  const out = [];
  for(let i = 1; i <= n; i++){
    onStep && onStep(i, n, pdf.numPages);
    const pg = await pdf.getPage(i);
    const v0 = pg.getViewport({ scale: 1 });
    const scale = Math.min(2.2, PG_SIDE / Math.max(v0.width, v0.height));
    const vp = pg.getViewport({ scale });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: g, viewport: vp }).promise;
    out.push(await shrink(cv.toDataURL('image/png'), PG_SIDE, PG_CAP));
  }
  return { pages: out, total: pdf.numPages };
}
export async function xlsxTable(file){
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => !!window.XLSX);
  const wb = window.XLSX.read(await file.arrayBuffer(), { type:'array', cellStyles:true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const html = window.XLSX.utils.sheet_to_html(ws, { editable:false });
  return sanitizeTableHTML(html);
}

/* ── 저장 · 꺼내기 (Firestore meetingFiles) ── */
export function makeStore(ctx){
  const { db } = ctx;
  const { doc, getDoc, setDoc, collection, serverTimestamp } = ctx.fs;
  const cache = new Map();
  const base = (org, mid) => ({ org, meetingId: mid, uid: ctx.me().uid, at: serverTimestamp() });
  async function putImage(org, mid, src, kind, name){
    const r = await shrink(src, kind === 'pdfpage' ? PG_SIDE : IMG_SIDE, kind === 'pdfpage' ? PG_CAP : IMG_CAP);
    const ref = doc(collection(db, 'meetingFiles'));
    await setDoc(ref, { ...base(org, mid), kind: kind || 'img', name: name || '', data: r.data, w: r.w, ht: r.h, size: r.size });
    cache.set(ref.id, r.data);
    return { fid: ref.id, w: r.w, ht: r.h, size: r.size, data: r.data };
  }
  async function putShrunk(org, mid, r, kind, name){   // 이미 줄인 그림 (PDF 쪽)
    const ref = doc(collection(db, 'meetingFiles'));
    await setDoc(ref, { ...base(org, mid), kind: kind || 'pdfpage', name: name || '', data: r.data, w: r.w, ht: r.h, size: r.size });
    cache.set(ref.id, r.data);
    return ref.id;
  }
  async function putFile(org, mid, file){
    if(file.size > FILE_MAX) throw new Error('too-big');
    const url = await readAsDataURL(file);
    const b64 = String(url).slice(String(url).indexOf(',') + 1);
    const n = Math.max(1, Math.ceil(b64.length / CHUNK));
    const ref = doc(collection(db, 'meetingFiles'));
    for(let i = 0; i < n; i++){
      await setDoc(doc(db, 'meetingFiles', `${ref.id}__c${i}`), { ...base(org, mid), kind:'chunk', parent: ref.id, i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
    await setDoc(ref, { ...base(org, mid), kind:'file', name: file.name, mime: file.type || '', size: file.size, chunks: n });
    return { fid: ref.id, size: file.size };
  }
  async function getImage(fid){
    if(cache.has(fid)) return cache.get(fid);
    const s = await getDoc(doc(db, 'meetingFiles', fid));
    const v = s.exists() ? (s.data().data || '') : '';
    cache.set(fid, v);
    return v;
  }
  async function download(fid, name){
    const s = await getDoc(doc(db, 'meetingFiles', fid));
    if(!s.exists()) throw new Error('파일을 찾지 못했어요');
    const f = s.data();
    let b64 = '';
    for(let i = 0; i < (f.chunks || 0); i++){
      const c = await getDoc(doc(db, 'meetingFiles', `${fid}__c${i}`));
      b64 += c.exists() ? (c.data().data || '') : '';
    }
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    saveBlob(new Blob([u8], { type: f.mime || 'application/octet-stream' }), name || f.name || '문서');
  }
  return { putImage, putShrunk, putFile, getImage, download, cache };
}
export function saveBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
