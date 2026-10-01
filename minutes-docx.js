/* ═══════════════════════════════════════════════════════════
   📄 minutes-docx.js — 회의록 → 워드(.docx) (v-93)
   · 브라우저 안에서 바로 만든다 (밖으로 보내지 않음) · 한글(HWP)에서도 열림
   · 지금 회의록 모양 그대로: 날짜 · 가운데 제목 · 노란 형광펜 주제 · 번호 개요 · 표 · 사진
   ═══════════════════════════════════════════════════════════ */
import * as C from './minutes-core.js';

/* ── 압축 없는 zip (워드 파일 = xml 몇 장을 묶은 zip) ── */
const CRC_T = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for(let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
export function zipStore(files){
  const enc = new TextEncoder();
  const parts = [], central = []; let off = 0;
  const T = 0x6000, D = ((2026 - 1980) << 9) | (10 << 5) | 1;
  for(const f of files){
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, T, true); h.setUint16(12, D, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, T, true); c.setUint16(14, D, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
    c.setUint32(38, 0, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, a) => s + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
  let p = 0; for(const a of all){ out.set(a, p); p += a.length; }
  return out;
}

/* ── xml 조각 ── */
const X = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = '맑은 고딕';
function rPr(p){
  p = p || {};
  let s = '';                                   // ⚠ 워드는 순서를 따진다: b · i · color · spacing · sz · highlight · u
  if(p.b) s += '<w:b/><w:bCs/>';
  if(p.i) s += '<w:i/>';
  if(p.color) s += `<w:color w:val="${X(p.color.replace('#', ''))}"/>`;
  if(p.spacing) s += `<w:spacing w:val="${p.spacing}"/>`;
  if(p.sz) s += `<w:sz w:val="${p.sz}"/><w:szCs w:val="${p.sz}"/>`;
  if(p.hl) s += '<w:highlight w:val="yellow"/>';
  if(p.u) s += '<w:u w:val="single"/>';
  return s ? `<w:rPr>${s}</w:rPr>` : '';
}
const run = (t, p) => `<w:r>${rPr(p)}<w:t xml:space="preserve">${X(t)}</w:t></w:r>`;
const tabRun = p => `<w:r>${rPr(p)}<w:tab/></w:r>`;
function para(runs, o){
  o = o || {};
  let pp = '';
  if(o.keep) pp += '<w:keepNext/>';
  if(o.pageBefore) pp += '<w:pageBreakBefore/>';
  if(o.shd) pp += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
  if(o.before != null || o.after != null) pp += `<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 60 : o.after}"/>`;
  if(o.left != null || o.hanging != null) pp += `<w:ind w:left="${o.left || 0}"${o.hanging ? ` w:hanging="${o.hanging}"` : ''}/>`;
  if(o.jc) pp += `<w:jc w:val="${o.jc}"/>`;
  return `<w:p>${pp ? `<w:pPr>${pp}</w:pPr>` : ''}${runs || ''}</w:p>`;
}
/* 다듬어 둔 글(굵게·형광펜·색·줄바꿈) → 글토막들 */
function inlineRuns(html, base){
  base = base || {};
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html').body.firstChild;
  let out = '';
  const walk = (node, p) => {
    node.childNodes.forEach(n => {
      if(n.nodeType === 3){ if(n.nodeValue) out += run(n.nodeValue.replace(/ /g, ' '), p); return; }
      if(n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if(tag === 'br'){ out += '<w:r><w:br/></w:r>'; return; }
      const q = { ...p };
      if(tag === 'b' || tag === 'strong') q.b = true;
      if(tag === 'i' || tag === 'em') q.i = true;
      if(tag === 'u') q.u = true;
      if(tag === 'mark') q.hl = true;
      const st = n.getAttribute && (n.getAttribute('style') || '');
      const cm = /(?:^|;)\s*color\s*:\s*(#[0-9a-f]{6})/i.exec(st || ''); if(cm) q.color = cm[1];
      walk(n, q);
    });
  };
  if(d) walk(d, base);
  return out;
}

/* ── 표: 합친 칸까지 격자로 펼쳐 워드 표로 ── */
function tableXml(html, width){
  const d = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const t = d.querySelector('table'); if(!t) return '';
  const rows = [...t.rows];
  const grid = [];
  rows.forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    [...tr.cells].forEach(td => {
      while(grid[r][c]) c++;
      const cs = Math.max(1, +td.getAttribute('colspan') || 1), rs = Math.max(1, +td.getAttribute('rowspan') || 1);
      for(let dr = 0; dr < rs; dr++) for(let dc = 0; dc < cs; dc++){
        grid[r + dr] = grid[r + dr] || [];
        grid[r + dr][c + dc] = { td, top: dr === 0, left: dc === 0, cs, rs };
      }
      c += cs;
    });
  });
  const ncol = Math.max(1, ...grid.map(g => g ? g.length : 0));
  const cw = Math.floor(width / ncol);
  let x = `<w:tbl><w:tblPr><w:tblW w:w="${cw * ncol}" w:type="dxa"/><w:tblInd w:w="440" w:type="dxa"/>
    <w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="C9C5B9"/>`).join('')}</w:tblBorders>
    <w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid>${Array.from({ length: ncol }, () => `<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid>`;
  grid.forEach(row => {
    x += '<w:tr>';
    let c = 0;
    while(c < ncol){
      const g = row && row[c];
      if(!g){ x += `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`; c++; continue; }
      if(!g.left){ c++; continue; }
      const st = g.td.getAttribute('style') || '';
      const bg = (/background-color\s*:\s*#([0-9a-f]{6})/i.exec(st) || [])[1] || (g.td.tagName === 'TH' ? 'EEECE6' : '');
      const fg = (/(?:^|;)\s*color\s*:\s*(#[0-9a-f]{6})/i.exec(st) || [])[1] || '';
      const b = /font-weight\s*:\s*700/.test(st) || g.td.tagName === 'TH';
      const jc = /text-align\s*:\s*center/.test(st) ? 'center' : /text-align\s*:\s*right/.test(st) ? 'right' : '';
      let pr = `<w:tcW w:w="${cw * g.cs}" w:type="dxa"/>`;
      if(g.cs > 1) pr += `<w:gridSpan w:val="${g.cs}"/>`;
      if(g.rs > 1) pr += g.top ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>';
      if(bg) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`;
      const body = g.top ? inlineRuns(g.td.innerHTML, { b, color: fg, sz: 19 }) : '';
      x += `<w:tc><w:tcPr>${pr}</w:tcPr>${para(body, { jc, after: 0 })}</w:tc>`;
      c += g.cs;
    }
    x += '</w:tr>';
  });
  return x + '</w:tbl>' + para('', { after: 60 });
}

/* ── 사진 ── */
const EMU = 9525;
function dataBytes(url){
  const i = String(url).indexOf(',');
  const bin = atob(String(url).slice(i + 1));
  const u8 = new Uint8Array(bin.length);
  for(let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
  return u8;
}
function imgXml(rid, id, w, h, maxW){
  const k = Math.min(1, maxW / (w * EMU));
  const cx = Math.round(w * EMU * k), cy = Math.round(h * EMU * k);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>
    <wp:docPr id="${id}" name="그림 ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>
    <pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr>
    <pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
    <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
    </pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

/* ═══ 만들기 ═══
   list  = 회의록 배열 (날짜순)
   opts  = { sum, att, img, cmt, head, title }
   ctx   = { tasks:{key:doc}, files:{fid:dataURL}, sizes:{fid:{w,h}}, comments:{mid:[...]} } */
export function buildDocx(list, opts, ctx){
  opts = opts || {}; ctx = ctx || {};
  const PAGE_W = 11906, MARG = 1000, BODY_W = PAGE_W - MARG * 2;
  const media = []; let pid = 1;
  const addImg = (fid, kind) => {
    const url = (ctx.files || {})[fid]; if(!url) return '';
    const sz = (ctx.sizes || {})[fid] || { w: 800, h: 600 };
    const rid = 'rIdM' + (media.length + 1);
    const ext = /^data:image\/png/.test(url) ? 'png' : 'jpeg';
    media.push({ rid, name: `media/image${media.length + 1}.${ext}`, bytes: dataBytes(url), ext });
    return imgXml(rid, pid++, sz.w || 800, sz.h || 600, Math.round((BODY_W - 440) * 635 * (kind === 'pg' ? 0.9 : 0.62)));
  };
  let body = '';
  /* 맨 앞 요약표 */
  if(opts.sum && list.length){
    body += para(run(opts.title || '회의록 모음', { b: true, sz: 30 }), { jc: 'center', after: 120 });
    body += para(run(`${C.fmtLong(list[0].date)} ~ ${C.fmtLong(list[list.length - 1].date)} · ${list.length}건`, { color: '#5A6560', sz: 19 }), { jc: 'center', after: 200 });
    const rows = C.summaryRows(list, ctx.tasks);
    if(rows.length){
      const cols = [1300, 2600, 2800, BODY_W - 1300 - 2600 - 2800];
      const hcell = (t, w) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="1E3932"/></w:tcPr>${para(run(t, { b: true, color: '#FFFFFF', sz: 19 }), { after: 0 })}</w:tc>`;
      const cell = (inner, w) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner || para('', { after: 0 })}</w:tc>`;
      let t = `<w:tbl><w:tblPr><w:tblW w:w="${BODY_W}" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="C9C5B9"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>
        <w:tblGrid>${cols.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
        <w:tr><w:trPr><w:tblHeader/></w:trPr>${hcell('날짜', cols[0])}${hcell('주제', cols[1])}${hcell('결정', cols[2])}${hcell('임무 (담당 · 기한 · 상태)', cols[3])}</w:tr>`;
      for(const r of rows){
        t += '<w:tr>' + cell(para(run(C.fmtMD(r.m.date), { sz: 19 }), { after: 0 }), cols[0])
          + cell(para(run(`${r.i + 1}. ${r.t.title || ''}`, { sz: 19 }), { after: 0 }), cols[1])
          + cell(r.dec.map(d => para(run(d, { sz: 19 }), { after: 0 })).join(''), cols[2])
          + cell(r.tk.map(k => para(run(`${k.h}${k.who ? ' · ' + k.who : ''}${k.due ? ' · ' + C.fmtMD(k.due) + '까지' : ''} · ${(C.STATUS[k.st] || C.STATUS.todo).l}`, { sz: 19 }), { after: 0 })).join(''), cols[3])
          + '</w:tr>';
      }
      body += t + '</w:tbl>';
    } else {
      body += para(run('이 기간에는 적힌 결정 · 임무가 없어요.', { color: '#5A6560' }));
    }
  }
  list.forEach((m, mi) => {
    const first = !(opts.sum && list.length) && mi === 0;
    body += para(run(C.fmtLong(m.date, m.time), { b: true }), { pageBefore: !first, after: 80 });
    body += para(run(C.titleOf(m), { b: true, sz: 32, spacing: 60 }), { jc: 'center', before: 120, after: 200 });
    /* 머리 표 — 장소 · 쓴 사람 · 참석 · 불참 */
    const info = [];
    if(m.place) info.push(['장소', m.place]);
    if(m.writerName) info.push(['쓴 사람', m.writerName]);
    if(opts.att !== false){
      const { on, off } = C.attSplit(m);
      if(on.length) info.push(['참석', `${on.length}명 — ${on.map(a => a.name).join(' · ')}`]);
      if(off.length) info.push(['불참', `${off.length}명 — ${off.map(a => a.name + (a.r ? ` (${a.r})` : '')).join(' · ')}`]);
      if(m.guests) info.push(['그 외', m.guests]);
    }
    if(info.length){
      let t = `<w:tbl><w:tblPr><w:tblW w:w="${BODY_W}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="C9C5B9"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="C9C5B9"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E3E1DA"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>
        <w:tblGrid><w:gridCol w:w="1200"/><w:gridCol w:w="${BODY_W - 1200}"/></w:tblGrid>`;
      for(const [k, v] of info){
        t += `<w:tr><w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr>${para(run(k, { b: true, color: '#5A6560', sz: 19 }), { after: 0 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="${BODY_W - 1200}" w:type="dxa"/></w:tcPr>${para(run(v, { sz: 19 }), { after: 0 })}</w:tc></w:tr>`;
      }
      body += t + '</w:tbl>' + para('', { after: 120 });
    }
    /* 주제 */
    (m.topics || []).forEach((tp, ti) => {
      body += para(run(`${ti + 1}.`, { b: true }) + tabRun({}) + run(tp.title || '', { b: true, hl: true }), { left: 440, hanging: 440, before: 160, after: 60, keep: true });
      const labels = C.numberBody(tp.body);
      (tp.body || []).forEach((b, bi) => {
        if(b.k === 'l'){
          const lv = C.clampLv(b.lv), left = 440 + lv * 420;
          const lab = labels[bi];
          body += lab ? para(run(lab) + tabRun() + inlineRuns(b.h), { left, hanging: 480, after: 20 })
                      : para(inlineRuns(b.h), { left: left - 60, after: 20 });
        } else if(b.k === 'tbl' && opts.img !== false){
          body += tableXml(b.h, BODY_W - 440);
          if(b.cap) body += para(run(b.cap, { color: '#6B7670', sz: 18 }), { left: 440 });
        } else if(b.k === 'img' && opts.img !== false){
          const x = addImg(b.fid); if(x) body += para(x, { left: 440, after: 40 });
          if(b.cap) body += para(run(b.cap, { color: '#6B7670', sz: 18 }), { left: 440 });
        } else if(b.k === 'pdf'){
          body += para(run(`📕 ${b.name || 'PDF'} (${(b.fids || []).length}쪽)`, { b: true, sz: 19 }), { left: 440 });
          if(opts.img !== false) for(const fid of b.fids || []){ const x = addImg(fid, 'pg'); if(x) body += para(x, { left: 440, after: 40 }); }
        } else if(b.k === 'file'){
          body += para(run(`📎 ${b.name || '문서'}${b.size ? ' (' + C.fmtSize(b.size) + ')' : ''}${b.link ? ' — ' + b.link : ''}`, { sz: 19 }), { left: 440 });
        } else if(b.k === 'link'){
          body += para(run(`🔗 ${b.title || b.url}`, { sz: 19 }) + (b.title ? run(' — ' + b.url, { color: '#2B6CB0', sz: 18 }) : ''), { left: 440 });
        }
      });
      for(const d of (tp.dec || []).filter(d => C.textOf(d.h).trim())){
        body += para(run('결정', { b: true, color: '#00704A', sz: 18 }) + tabRun() + inlineRuns(d.h), { left: 1300, hanging: 760, shd: 'EEF6F2', before: 40, after: 20 });
      }
      for(const k of (tp.tasks || []).filter(k => C.textOf(k.h).trim())){
        const d = (ctx.tasks || {})[C.taskKey(m.id, k.id)] || {};
        const who = (k.uids || []).map(u => (k.names || {})[u] || '').filter(Boolean).join(', ');
        const tail = `${who ? ' · ' + who : ''}${k.due ? ' · ' + C.fmtMD(k.due) + '까지' : ''}${m.imported ? '' : ' · ' + (C.STATUS[d.status] || C.STATUS.todo).l}`;
        body += para(run('임무', { b: true, color: '#8A6D00', sz: 18 }) + tabRun() + inlineRuns(k.h) + run(tail, { color: '#5A6560' }), { left: 1300, hanging: 760, shd: 'FBF6E6', before: 40, after: 20 });
      }
    });
    /* 댓글 */
    const cm = opts.cmt ? ((ctx.comments || {})[m.id] || []).filter(c => !c.del) : [];
    if(cm.length){
      body += para(run('댓글', { b: true, sz: 22 }), { before: 240, after: 80, keep: true });
      const roots = cm.filter(c => !c.root).sort((a, b) => a.at - b.at);
      const tName = c => {
        if(c.tgt === 'm') return '회의록';
        if(c.tgt.startsWith('t:')){ const i = (m.topics || []).findIndex(t => 't:' + t.id === c.tgt); return i >= 0 ? `${i + 1}. ${m.topics[i].title || ''}` : '주제'; }
        return '임무';
      };
      for(const r of roots){
        body += para(run(`${r.name} · ${C.fmtStamp(r.at)} · ${tName(r)}`, { b: true, sz: 18, color: '#5A6560' }), { left: 440, after: 0 });
        body += para(run(r.text, { sz: 19 }), { left: 440, after: 60 });
        for(const rp of cm.filter(c => c.root === r.id).sort((a, b) => a.at - b.at)){
          body += para(run(`↳ ${rp.name} · ${C.fmtStamp(rp.at)}`, { b: true, sz: 18, color: '#5A6560' }), { left: 900, after: 0 });
          body += para(run(rp.text, { sz: 19 }), { left: 900, after: 60 });
        }
      }
    }
  });

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const head = opts.head !== false;
  const sect = `<w:sectPr>${head ? '<w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/>' : ''}
    <w:pgSz w:w="${PAGE_W}" w:h="16838"/><w:pgMar w:top="1134" w:right="${MARG}" w:bottom="1134" w:left="${MARG}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:eastAsia="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
  const hdrXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${para(run(opts.title || '회의록', { color: '#93A09A', sz: 16 }), { jc: 'right', after: 0 })}</w:hdr>`;
  const ftrXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:color w:val="93A09A"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="93A09A"/><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:rPr><w:color w:val="93A09A"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="93A09A"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="93A09A"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${head ? '<Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ''}
${media.map(m => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.name}"/>`).join('')}
</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
${head ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${X(opts.title || '회의록')}</dc:title><dc:creator>교사 선교사</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const files = [
    { name: '[Content_Types].xml', data: ct },
    { name: '_rels/.rels', data: rootRels },
    { name: 'docProps/core.xml', data: core },
    { name: 'word/document.xml', data: docXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/_rels/document.xml.rels', data: rels },
  ];
  if(head) files.push({ name: 'word/header1.xml', data: hdrXml }, { name: 'word/footer1.xml', data: ftrXml });
  for(const m of media) files.push({ name: 'word/' + m.name, data: m.bytes });
  return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
