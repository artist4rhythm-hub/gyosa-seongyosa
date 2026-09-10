/* ═══════════════════════════════════════════════════════════
   🖨 print-core.js — 인쇄·PDF 공용 원장 (재정비 운영리듬: 복붙 3곳 트리거)
   · 수행성 경비·경비 지급 요청서에 복붙돼 있던 유틸을 그대로 옮겨 담았습니다.
   · 페이지 나눔 기준(카드 단위 분할 금지·제목은 새 페이지 시작)이 전 모듈 공통이 됩니다.
   ═══════════════════════════════════════════════════════════ */
(function(){
function loadH2C(){ if(window.html2canvas||document.getElementById('h2c-script'))return; const sc=document.createElement('script'); sc.id='h2c-script'; sc.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; document.head.appendChild(sc); }
loadH2C();
function ensureJsPDF(){
  return new Promise((resolve,reject)=>{
    if(window.jspdf&&window.jspdf.jsPDF) return resolve();
    let sc=document.getElementById('jspdf-script');
    if(sc){ const chk=setInterval(()=>{ if(window.jspdf&&window.jspdf.jsPDF){clearInterval(chk);resolve();} },100); setTimeout(()=>{clearInterval(chk); if(!(window.jspdf&&window.jspdf.jsPDF))reject(new Error('PDF 모듈 로드 실패'));},8000); return; }
    sc=document.createElement('script'); sc.id='jspdf-script'; sc.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    sc.onload=()=>resolve(); sc.onerror=()=>reject(new Error('PDF 모듈을 불러올 수 없습니다.')); document.head.appendChild(sc);
  });
}

function ensureJsPDF(){
  return new Promise((resolve,reject)=>{
    if(window.jspdf&&window.jspdf.jsPDF) return resolve();
    let sc=document.getElementById('jspdf-script');
    if(sc){ const chk=setInterval(()=>{ if(window.jspdf&&window.jspdf.jsPDF){clearInterval(chk);resolve();} },100); setTimeout(()=>{clearInterval(chk); if(!(window.jspdf&&window.jspdf.jsPDF))reject(new Error('PDF 모듈 로드 실패'));},8000); return; }
    sc=document.createElement('script'); sc.id='jspdf-script'; sc.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    sc.onload=()=>resolve(); sc.onerror=()=>reject(new Error('PDF 모듈을 불러올 수 없습니다.')); document.head.appendChild(sc);
  });
}

function ensureH2C(){
  return new Promise((resolve,reject)=>{
    if(window.html2canvas) return resolve();
    loadH2C();
    const chk=setInterval(()=>{ if(window.html2canvas){clearInterval(chk);resolve();} },100);
    setTimeout(()=>{clearInterval(chk); if(!window.html2canvas)reject(new Error('이미지 모듈 로드 실패'));},8000);
  });
}

function collectBreakPoints(node, canvas, breakSelectors){
  const scale  = canvas.width / (node.offsetWidth || 1);
  const docTop = node.getBoundingClientRect().top;
  const cuts   = new Set([0]);
  (breakSelectors||[]).forEach(sel=>{
    node.querySelectorAll(sel).forEach(el=>{
      const r = el.getBoundingClientRect();
      cuts.add(Math.round((r.top    - docTop) * scale));
      cuts.add(Math.round((r.bottom - docTop) * scale));
    });
  });
  return [...cuts].filter(v=>v>=0).sort((a,b)=>a-b);
}

/* 반드시 새 페이지 맨 위에서 시작해야 하는 요소들의 위치
   (요청서 제목이 페이지 아래에 홀로 남지 않도록)
   첫 번째 요소는 제외한다 — 문서 제목 다음에 바로 오므로 첫 장에 함께 둔다. */
function collectHardBreaks(node, canvas, selector, padPx){
  const scale  = canvas.width / (node.offsetWidth || 1);
  const docTop = node.getBoundingClientRect().top;
  const pad    = (padPx==null ? 10 : padPx) * scale;
  return [...node.querySelectorAll(selector)].slice(1).map(el=>{
    const t = (el.getBoundingClientRect().top - docTop) * scale;
    return Math.max(0, Math.round(t - pad));
  });
}




function addCanvasToPDF(pdf, canvas, points, opt){
  const o  = Object.assign({ margin:6, quality:0.9, minFill:0.12 }, opt||{});
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const iw = pw - o.margin*2;
  const pageH = Math.floor(canvas.width * (ph - o.margin*2) / iw);
  const total = canvas.height;

  // 한 장에 다 들어가면 그대로 (단, 새 페이지로 보낼 지점이 없을 때만)
  if(canvas.height * iw / canvas.width <= ph - o.margin*2 && !(o.hard && o.hard.length)){
    pdf.addImage(canvas.toDataURL('image/jpeg', o.quality), 'JPEG',
      o.margin, o.margin, iw, canvas.height*iw/canvas.width);
    return 1;
  }

  const pts = (points && points.length) ? points : [];
  const hardPts = (o.hard && o.hard.length) ? o.hard.slice().sort((a,b)=>a-b) : [];
  const slices = [];
  let pos = 0;
  while(pos < total){
    let end = pos + pageH;
    // ⓐ 새 페이지에서 시작해야 하는 지점이 이 페이지 안에 있으면, 거기서 먼저 끊는다
    const hard = hardPts.filter(t => t > pos + pageH*0.04 && t < end);
    if(hard.length){
      end = Math.min(...hard);
    } else if(end >= total){
      end = total;
    } else {
      // ⓑ 그 외에는 잘리면 안 되는 요소의 경계 중 가장 아래 지점에서 끊는다
      const cand = pts.filter(t => t > pos + pageH*o.minFill && t <= end);
      if(cand.length) end = Math.max(...cand);
      // 후보가 없으면(덩어리 하나가 페이지보다 큰 경우) 어쩔 수 없이 페이지 끝에서 자른다
    }
    if(end <= pos) end = Math.min(pos + pageH, total);
    slices.push({ y:pos, h:end-pos });
    pos = end;
  }

  slices.forEach((sl,i)=>{
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = sl.h;
    c.getContext('2d').drawImage(canvas, 0, sl.y, canvas.width, sl.h, 0, 0, canvas.width, sl.h);
    if(i>0) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', o.quality), 'JPEG',
      o.margin, o.margin, iw, sl.h*iw/canvas.width);
  });
  return slices.length;
}
const RCCOL_CSS = `
.rc-doc{width:794px;background:var(--wh);padding:30px;box-sizing:border-box;font-family:'Noto Sans KR',sans-serif;color:#1a1a1a;}
.rc-head{text-align:center;border-bottom:2.5px solid #2d6a4f;padding-bottom:12px;margin-bottom:16px;}
.rc-title{font-size:19px;font-weight:800;color:#1b4332;}
.rc-sub{font-size:11.5px;color:#8ba396;margin-top:5px;}
.rc-card{border:1px solid #d9e2dd;border-radius:10px;margin-bottom:14px;overflow:hidden;break-inside:avoid;page-break-inside:avoid;}
.rc-chd{background:var(--gp);padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:1px solid #d9e2dd;}
.rc-seq{background:#2d6a4f;color:#fff;font-size:12px;font-weight:800;padding:2px 9px;border-radius:10px;}
.rc-subj{font-size:14px;font-weight:800;color:#1b4332;}
.rc-meta{font-size:11px;color:#5a7267;}
.rc-meta b{color:#8a6410;}
.rc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;}
.rc-cell{border:1px solid #e2e8e5;border-radius:10px;background:var(--iv);position:relative;overflow:hidden;text-align:center;padding:6px;break-inside:avoid;}
.rc-cell.wide{grid-column:1 / -1;}
.rc-cell img{max-width:100%;object-fit:contain;display:block;margin:0 auto;}
.rc-cell.tall img{max-height:420px;}
.rc-cell.short img{max-height:230px;}
.rc-cell.wide img{max-height:300px;}
.rc-no{position:absolute;top:4px;left:4px;background:rgba(45,106,79,.9);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;z-index:1;}
.rc-foot{text-align:center;font-size:10px;color:#a8b5ac;margin-top:14px;}
`;

window.ensureJsPDF = ensureJsPDF;
window.ensureH2C = ensureH2C;
window.loadH2C = window.loadH2C || loadH2C;
window.collectBreakPoints = collectBreakPoints;
window.collectHardBreaks = collectHardBreaks;
window.addCanvasToPDF = addCanvasToPDF;
window.RCCOL_CSS = RCCOL_CSS;
})();
