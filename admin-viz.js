/* ═══════════════════════════════════════════════════════════
   📊 admin-viz.js — 관리자 화면 그래프 (v194)
   «사용 현황»(usage-admin.js)과 같은 모양 · 같은 색으로
   로그인 기록 · 접속 현황 · 활동 로그 · 조회 기록 · 오류 알림판 · 인사정보를 한눈에.
   그림만 그린다 (자료를 새로 읽지 않음) — window.AV.*(…) → HTML 문자열

   색 (밝은 화면 / 다크 — 검사 도구로 색약 · 대비 확인함)
     · 하나짜리 막대: 초록 한 가지
     · 기관:  다니엘아마츠학교 = 파랑 · 그루터기 = 주황   (색은 기관을 따라감 — 거르기로 하나만 남아도 그대로)
     · 활동:  입력 = 청록 · 수정 = 파랑 · 삭제 = 주황
     · 기기:  폰 · 패드 · 컴퓨터 = 사용 현황과 같은 파스텔
     · 진하기(요일 × 시간): 초록 한 가지, 옅음 → 진함
   마우스를 올리거나(키보드로 옮겨도) 값이 뜨고, 모든 값은 «표로 보기»에도 있어요.
   ═══════════════════════════════════════════════════════════ */
(function(){
  if(window.AV) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = n => (+n || 0).toLocaleString('ko-KR');
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const CSS = `
.av{--av-1:#2F8F66;--av-a:#2A7FBF;--av-b:#D9742B;--av-c:#1FA37F;--av-gray:#A3ABA7;
  --av-ph:#7FC8A9;--av-pad:#8DB9E0;--av-pc:#E6C68F;
  --av-h1:#E4F2EB;--av-h2:#BFE0D0;--av-h3:#86C6A9;--av-h4:#3E9C77;--av-h5:#00704A;
  --av-track:#EEF1EE;--av-soft:#F4F5F2;--av-grid:#E6E9E4;--av-ink:#1F2320;--av-ink2:#56615B;--av-ink3:#7F8B85;--av-surf:var(--surface,#fff);--av-line:var(--line,#E3E1DA);
  --av-warn-bg:#FDF3E1;--av-warn:#8A5A00;--av-bad-bg:#FDECE7;--av-bad:#A93A1C;--av-ok-bg:#E6F4EC;--av-ok:#17643F;
  font-family:inherit;min-width:0}
html[data-theme="dark"] .av{--av-1:#47A27C;--av-a:#3987E5;--av-b:#D9672B;--av-c:#2E9E72;--av-gray:#6E7A74;
  --av-ph:#5BB592;--av-pad:#6F9FCB;--av-pc:#C9A869;
  --av-h1:#1D3129;--av-h2:#24503F;--av-h3:#2F7559;--av-h4:#47A27C;--av-h5:#7FD1AC;
  --av-track:#22302A;--av-soft:rgba(255,255,255,.05);--av-grid:#2A3832;--av-ink:#E3EEE9;--av-ink2:#B2C3BB;--av-ink3:#8FA29A;
  --av-warn-bg:#3A2E14;--av-warn:#F2C56B;--av-bad-bg:#3A2018;--av-bad:#F5A07E;--av-ok-bg:#173326;--av-ok:#7FD9B0}
.av i{font-style:normal}
.s-1{background:var(--av-1)}.s-daniel{background:var(--av-a)}.s-jihyebit{background:var(--av-b)}.s-etc{background:var(--av-gray)}
.s-in{background:var(--av-c)}.s-up{background:var(--av-a)}.s-del{background:var(--av-b)}
.s-phone{background:var(--av-ph)}.s-pad{background:var(--av-pad)}.s-pc{background:var(--av-pc)}
/* 숫자 칸 */
.av-tc{container-type:inline-size;margin:0 0 12px}
.av-tiles{display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr));gap:10px}
@container (max-width:920px){.av-tiles.n5,.av-tiles.n6{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container (max-width:620px){.av-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}
.av-tile{background:var(--av-surf);border:1px solid var(--av-line);border-radius:14px;padding:12px 14px;min-width:0;display:flex;flex-direction:column;gap:4px;text-align:left;font:inherit;color:inherit}
button.av-tile{cursor:pointer}button.av-tile:hover{border-color:var(--av-1)}
.av-tile > span{font-size:12px;font-weight:700;color:var(--av-ink2)}
.av-tile > b{font-size:24px;font-weight:800;line-height:1.15;color:var(--av-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.av-tile > b.sm{font-size:18px}
.av-tile > b small{font-size:13px;font-weight:700;color:var(--av-ink3);margin-left:2px}
.av-tile > em{font-style:normal;font-size:12px;color:var(--av-ink3);line-height:1.45}
.av-tile.warn{background:var(--av-warn-bg);border-color:transparent}.av-tile.warn > b{color:var(--av-warn)}
.av-tile.bad{background:var(--av-bad-bg);border-color:transparent}.av-tile.bad > b{color:var(--av-bad)}
.av-tile.ok{background:var(--av-ok-bg);border-color:transparent}.av-tile.ok > b{color:var(--av-ok)}
.av-tile .av-meter{margin-top:4px}
.av-dl{font-size:12px;font-weight:700;color:var(--av-ink3)}.av-dl.up{color:#2F8F66}.av-dl.dn{color:#B4532F}
html[data-theme="dark"] .av-dl.up{color:#7FD9B0}html[data-theme="dark"] .av-dl.dn{color:#F5A07E}
/* 카드 */
.av-card{background:var(--av-surf);border:1px solid var(--av-line);border-radius:14px;padding:16px 18px;margin:0 0 12px;min-width:0}
.av-card > h4,.av-h4{display:flex;align-items:center;gap:6px;margin:0 0 12px;font-size:15px;font-weight:800;color:var(--av-ink);flex-wrap:wrap}
.av-h4 .material-symbols-rounded,.av-card > h4 .material-symbols-rounded{font-size:19px;color:var(--av-1)}
.av-h4 small,.av-card > h4 small{font-size:12px;font-weight:600;color:var(--av-ink3)}
.av-g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
.av-g2 > *{min-width:0}
@media(max-width:1180px){.av-g2{grid-template-columns:minmax(0,1fr)}}
.av-sub{font-size:12.5px;color:var(--av-ink2);line-height:1.55;margin:0 0 10px}
.av-mut{font-size:12px;color:var(--av-ink3);margin:8px 0 0;line-height:1.6}
.av-empty{color:var(--av-ink3);font-size:13px;text-align:center;padding:22px 8px;margin:0}
/* 거르기 줄 */
.av-ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}
.av-seg2{display:inline-flex;border:1px solid var(--av-line);border-radius:10px;overflow:hidden;background:var(--av-surf)}
.av-seg2 button{height:32px;padding:0 12px;border:0;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:var(--av-ink2);cursor:pointer;white-space:nowrap}
.av-seg2 button+button{border-left:1px solid var(--av-line)}
.av-seg2 button.on{background:var(--sb-house,#1E3932);color:#fff}
html[data-theme="dark"] .av-seg2 button.on{background:var(--sb-green,#47A27C);color:#06130E}
/* 범례 */
.av-leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:12px;color:var(--av-ink2);align-items:center}
.av-leg > span{display:inline-flex;align-items:center;gap:5px}
.av-leg i{display:inline-block;width:10px;height:10px;border-radius:3px}
.av-leg b{color:var(--av-ink);font-weight:800}
/* 세로 막대 (날마다 · 시간대) */
.av-colw{--h:160px}
.av-plot{position:relative;height:var(--h);margin-left:30px}
.av-grid{position:absolute;inset:0;pointer-events:none}
.av-grid > i{position:absolute;left:0;right:0;height:0;border-top:1px solid var(--av-grid);font-style:normal}
.av-grid > i b{position:absolute;right:calc(100% + 6px);top:-8px;font-size:11px;font-weight:600;color:var(--av-ink3);font-variant-numeric:tabular-nums;white-space:nowrap}
.av-cols{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:var(--g,2px);height:100%;align-items:end}
.av-c{position:relative;height:100%;display:flex;align-items:flex-end;justify-content:center;min-width:0;outline:none;cursor:default}
.av-c:focus-visible{box-shadow:inset 0 0 0 2px var(--av-1);border-radius:4px}
.av-st{display:flex;flex-direction:column-reverse;gap:2px;width:min(72%,22px);min-width:2px;border-radius:4px 4px 0 0;overflow:hidden;min-height:0}
.av-st > i{display:block;width:100%;flex:none}
.av-c:hover .av-st,.av-c:focus-visible .av-st{filter:brightness(1.12) saturate(1.05)}
.av-c.fut .av-st{opacity:.3}
.av-c.zero .av-st{display:none}
.av-c .av-cap{position:absolute;left:50%;transform:translateX(-50%);font-size:11.5px;font-weight:800;color:var(--av-ink);white-space:nowrap;font-variant-numeric:tabular-nums;pointer-events:none}
.av-x{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:var(--g,2px);margin:5px 0 0 30px;border-top:1px solid var(--av-grid);padding-top:5px}
.av-x > span{font-size:11px;font-weight:600;color:var(--av-ink2);text-align:center;white-space:nowrap;overflow:visible;font-variant-numeric:tabular-nums;min-width:0}
.av-x > span.we{color:var(--av-ink3)}.av-x > span.now{color:var(--av-ink);font-weight:800}
/* 가로 막대 (순위) */
.av-hb{display:grid;gap:7px}
.av-hr{display:grid;grid-template-columns:minmax(70px,var(--lw,150px)) minmax(0,1fr) auto;gap:10px;align-items:center;font-size:13px;min-height:24px;border-radius:8px;padding:0 4px;margin:0 -4px}
.av-hr.go{cursor:pointer}.av-hr.go:hover{background:var(--av-soft)}
.av-hr:focus-visible{outline:2px solid var(--av-1);outline-offset:1px}
.av-hr .l{font-weight:700;color:var(--av-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.av-hr .l small{font-weight:600;color:var(--av-ink3);margin-left:5px;font-size:12px}
.av-hr .t{display:flex;gap:2px;height:10px;min-width:0}
.av-hr .t > i{display:block;height:100%;min-width:2px}
.av-hr .t > i:last-child{border-radius:0 4px 4px 0}
.av-hr .v{font-weight:800;color:var(--av-ink);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.av-hr .v small{font-size:12px;font-weight:600;color:var(--av-ink3);margin-left:4px}
.av-hr:hover .t > i{filter:brightness(1.1)}
/* 나눔 띠 (한 덩어리를 나눠서) */
.av-seg{display:flex;gap:2px;height:8px;border-radius:99px;overflow:hidden;background:var(--av-track)}
.av-seg > i{display:block;height:100%}
.av-seg.empty{background:var(--av-track)}
/* 채움 막대 (비율 하나) */
.av-meter{display:block;height:8px;border-radius:99px;background:var(--av-h1);overflow:hidden}
.av-meter > i{display:block;height:100%;border-radius:99px;background:var(--av-1)}
.av-meter.warn{background:#F6E6C8}.av-meter.warn > i{background:#C48A1A}
html[data-theme="dark"] .av-meter{background:var(--av-h2)}html[data-theme="dark"] .av-meter.warn{background:#4A3B1B}html[data-theme="dark"] .av-meter.warn > i{background:#E3B24F}
.av-ml{display:grid;gap:9px}
.av-mr{display:grid;grid-template-columns:minmax(64px,var(--lw,110px)) minmax(0,1fr) auto;gap:10px;align-items:center;font-size:13px}
.av-mr .l{font-weight:700;color:var(--av-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.av-mr .v{font-weight:800;color:var(--av-ink);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.av-mr .v small{font-weight:600;color:var(--av-ink3);font-size:12px;margin-left:4px}
/* 진하기 (요일 × 시간) */
.av-heat-w{overflow-x:auto;scrollbar-width:thin}
.av-heat{display:grid;grid-template-columns:22px repeat(var(--h),minmax(13px,1fr));gap:3px;min-width:330px}
.av-heat > b{font-size:10.5px;font-weight:600;color:var(--av-ink3);height:14px;white-space:nowrap;font-variant-numeric:tabular-nums}
.av-heat > span{font-size:11.5px;font-weight:700;color:var(--av-ink2);display:flex;align-items:center}
.av-heat > span.we{color:var(--av-ink3)}
.av-heat > i{display:block;aspect-ratio:1;border-radius:4px;background:var(--av-soft);min-height:13px;outline:none}
.av-heat > i:hover,.av-heat > i:focus-visible{box-shadow:0 0 0 2px var(--av-ink2)}
.av-heat > i.l1{background:var(--av-h1)}.av-heat > i.l2{background:var(--av-h2)}.av-heat > i.l3{background:var(--av-h3)}.av-heat > i.l4{background:var(--av-h4)}.av-heat > i.l5{background:var(--av-h5)}
.av-scale{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;color:var(--av-ink3);margin-top:8px}
.av-scale i{width:12px;height:12px;border-radius:3px;display:inline-block}
/* 이름표 */
.av-chips{display:flex;flex-wrap:wrap;gap:6px}
.av-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:99px;background:var(--av-soft);border:1px solid var(--av-line);font-size:12.5px;font-weight:700;color:var(--av-ink);white-space:nowrap}
.av-chip i{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.av-chip small{font-weight:600;color:var(--av-ink3)}
.av-chip.warn{background:var(--av-warn-bg);border-color:transparent}.av-chip.warn small{color:var(--av-warn)}
/* 표 */
.av-tv{margin-top:10px}
.av-tv > summary{cursor:pointer;font-size:12px;font-weight:700;color:var(--av-ink2);list-style:none;display:inline-flex;align-items:center;gap:4px}
.av-tv > summary::-webkit-details-marker{display:none}
.av-tv > summary::before{content:'▸';font-size:11px}.av-tv[open] > summary::before{content:'▾'}
.av-tw{overflow-x:auto;margin-top:8px;max-height:320px;overflow-y:auto}
.av-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.av-tbl th{font-size:12px;font-weight:700;color:var(--av-ink3);text-align:left;padding:6px 9px;background:var(--av-soft);white-space:nowrap;position:sticky;top:0}
.av-tbl td{padding:6px 9px;border-bottom:1px solid var(--av-grid);color:var(--av-ink);vertical-align:middle}
.av-tbl td.r,.av-tbl th.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.av-tbl td small{display:block;font-size:11.5px;color:var(--av-ink3)}
.av-pb{display:flex;gap:2px;height:10px;min-width:60px}
.av-pb > i{display:block;height:100%}.av-pb > i:last-child{border-radius:0 4px 4px 0}
.av-pill{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--av-soft);color:var(--av-ink2);white-space:nowrap}
.av-pill.ok{background:var(--av-ok-bg);color:var(--av-ok)}.av-pill.warn{background:var(--av-warn-bg);color:var(--av-warn)}.av-pill.bad{background:var(--av-bad-bg);color:var(--av-bad)}
/* 말풍선 */
.av-tip{position:fixed;z-index:2147483100;pointer-events:none;background:#1F2320;color:#fff;border-radius:10px;padding:8px 11px;font-size:12.5px;line-height:1.5;box-shadow:0 6px 18px rgba(0,0,0,.22);max-width:260px;opacity:0;transition:opacity .08s}
.av-tip.on{opacity:1}
.av-tip .tv{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.av-tip .tl{color:#C9D3CE;font-weight:600}
.av-tip .tr{display:flex;align-items:center;gap:7px;color:#E8EEEB}
.av-tip .tr i{width:12px;height:3px;border-radius:2px;display:inline-block;flex:none}
.av-tip .tr b{margin-left:auto;padding-left:10px;font-variant-numeric:tabular-nums}
html[data-theme="dark"] .av-tip{background:#EAF2EE;color:#13201A}html[data-theme="dark"] .av-tip .tl{color:#4A5A52}html[data-theme="dark"] .av-tip .tr{color:#1F2D26}
@media(max-width:640px){
  .av-tile > b{font-size:20px}
  .av-card{padding:14px 12px}
  .av-hr{grid-template-columns:minmax(60px,var(--lws,96px)) minmax(0,1fr) auto;gap:8px}
  .av-mr{grid-template-columns:minmax(56px,90px) minmax(0,1fr) auto;gap:8px}
  .av-colw.many .av-x > span.odd{visibility:hidden}
  .av-plot,.av-x{margin-left:26px}
}
@media print{.av-tv,.av-ctl{display:none !important}}`;
  function css(){ if(document.getElementById('av-css')) return; const st = document.createElement('style'); st.id = 'av-css'; st.textContent = CSS; document.head.appendChild(st); tipInit(); }

  /* ── 말풍선 (값이 먼저 · 이름은 뒤) — 글자는 textContent 로만 넣음 ── */
  let TIP = null, TIPON = null;
  function tipShow(el, x, y){
    let d; try{ d = JSON.parse(el.getAttribute('data-tip') || '{}'); }catch(e){ d = {}; }
    if(!TIP){ TIP = document.createElement('div'); TIP.className = 'av-tip'; TIP.setAttribute('role', 'tooltip'); document.body.appendChild(TIP); }
    TIP.textContent = '';
    if(d.v != null){ const v = document.createElement('div'); v.className = 'tv'; v.textContent = String(d.v); TIP.appendChild(v); }
    if(d.t){ const t = document.createElement('div'); t.className = 'tl'; t.textContent = String(d.t); TIP.appendChild(t); }
    (d.r || []).forEach(r => { const row = document.createElement('div'); row.className = 'tr'; const k = document.createElement('i'); k.className = 's-' + String(r[0] || '1').replace(/[^\w-]/g, ''); const n = document.createElement('span'); n.textContent = String(r[1] || ''); const b = document.createElement('b'); b.textContent = String(r[2] == null ? '' : r[2]); row.append(k, n, b); TIP.appendChild(row); });
    const av = el.closest('.av'); if(av){ const cs = getComputedStyle(av); ['--av-1','--av-a','--av-b','--av-c','--av-gray','--av-ph','--av-pad','--av-pc'].forEach(p => TIP.style.setProperty(p, cs.getPropertyValue(p))); }
    TIP.querySelectorAll('.tr i').forEach(i => { const c = { 's-1':'--av-1', 's-daniel':'--av-a', 's-jihyebit':'--av-b', 's-etc':'--av-gray', 's-in':'--av-c', 's-up':'--av-a', 's-del':'--av-b', 's-phone':'--av-ph', 's-pad':'--av-pad', 's-pc':'--av-pc' }[i.className]; if(c) i.style.background = `var(${c})`; });
    if(x == null){ const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    TIP.classList.add('on');
    const w = TIP.offsetWidth, h = TIP.offsetHeight;
    let L = x + 14, T = y - h - 12;
    if(L + w > innerWidth - 8) L = Math.max(8, x - w - 14);
    if(T < 8) T = Math.min(innerHeight - h - 8, y + 18);
    TIP.style.left = L + 'px'; TIP.style.top = T + 'px';
    TIPON = el;
  }
  function tipHide(){ if(TIP) TIP.classList.remove('on'); TIPON = null; }
  let TIPI = false;
  function tipInit(){
    if(TIPI) return; TIPI = true;
    document.addEventListener('pointermove', e => { const el = e.target && e.target.closest ? e.target.closest('.av [data-tip]') : null; if(el) tipShow(el, e.clientX, e.clientY); else if(TIPON) tipHide(); }, { passive:true });
    setInterval(() => { if(TIPON && !TIPON.isConnected) tipHide(); }, 800);   // 가리킨 칸이 다시 그려져 사라졌으면 닫기
    document.addEventListener('focusin', e => { const el = e.target && e.target.closest ? e.target.closest('.av [data-tip]') : null; if(el) tipShow(el); else tipHide(); });
    document.addEventListener('focusout', () => tipHide());
    addEventListener('scroll', tipHide, { passive:true, capture:true });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') tipHide(); });
  }
  const tipAttr = d => ` data-tip="${esc(JSON.stringify(d))}"`;

  /* 눈금 — 1 · 2 · 5 × 10ⁿ 로 올림 */
  function niceMax(m){ if(m <= 0) return 1; if(m <= 4) return Math.ceil(m); const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  const tickTxt = v => v >= 10000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'K' : num(v);

  function legend(series, totals){
    if(!series || series.length < 2) return '';
    return `<div class="av-leg">${series.map(s => `<span><i class="s-${esc(s.k)}"></i>${esc(s.l)}${totals && totals[s.k] != null ? ` <b>${num(totals[s.k])}</b>` : ''}</span>`).join('')}</div>`;
  }
  /* 세로 막대 — rows [{ x, t(말풍선 제목), v, parts:{k:n}, we, now, fut, tick }] · opt { series:[{k,l}], h, unit, cap:'max'|'none', label } */
  function cols(rows, opt){
    css(); opt = opt || {};
    const series = opt.series || [{ k:'1', l:opt.unit || '' }];
    const unit = opt.unit || '';
    const vmax = Math.max(0, ...rows.map(r => +r.v || 0));
    const top = niceMax(vmax);
    const half = top / 2;
    const ticks = [0, half, top].filter((v, i, a) => a.indexOf(v) === i && (v === 0 || Number.isInteger(v)));
    const maxI = rows.reduce((b, r, i) => (+r.v || 0) > (+rows[b].v || 0) ? i : b, 0);
    const html = rows.map((r, i) => {
      const v = +r.v || 0, h = v / top * 100;
      const parts = series.map(s => [s, series.length === 1 && !r.parts ? v : ((r.parts || {})[s.k] || 0)]).filter(x => x[1] > 0);
      const segs = parts.map(([s, n]) => `<i class="s-${esc(s.k)}" style="height:calc((100% - ${(parts.length - 1) * 2}px) * ${(n / (v || 1)).toFixed(4)})"></i>`).join('');
      const tip = { v: num(v) + unit, t: r.t || r.x, r: series.length > 1 ? series.map(s => [s.k, s.l, num((r.parts || {})[s.k] || 0)]) : [] };
      const cap = opt.cap !== 'none' && i === maxI && v > 0 ? `<span class="av-cap" style="bottom:calc(${h.toFixed(2)}% + 3px)">${num(v)}</span>` : '';
      return `<div class="av-c${r.we ? ' we' : ''}${r.now ? ' now' : ''}${r.fut ? ' fut' : ''}${v ? '' : ' zero'}" tabindex="${rows.length > 31 ? -1 : 0}"${tipAttr(tip)} aria-label="${esc((r.t || r.x) + ' ' + num(v) + unit)}"><span class="av-st" style="height:${h.toFixed(2)}%">${segs}</span>${cap}</div>`;
    }).join('');
    const xs = rows.map((r, i) => `<span class="${r.we ? 'we' : ''}${r.now ? ' now' : ''}${i % 2 ? ' odd' : ''}">${r.tick === false ? '' : esc(r.x)}</span>`).join('');
    const grid = ticks.map(v => `<i style="bottom:${(v / top * 100).toFixed(2)}%"><b>${tickTxt(v)}</b></i>`).join('');
    const totals = {}; series.forEach(s => { totals[s.k] = rows.reduce((a, r) => a + (series.length === 1 && !r.parts ? (+r.v || 0) : ((r.parts || {})[s.k] || 0)), 0); });
    return `<div class="av av-colw${rows.length > 12 ? ' many' : ''}" style="--n:${rows.length};--h:${opt.h || 160}px${rows.length > 45 ? ';--g:1px' : ''}"><div class="av-plot"><div class="av-grid">${grid}</div><div class="av-cols" role="group" aria-label="${esc(opt.label || '막대 그래프')}">${html}</div></div><div class="av-x" aria-hidden="true">${xs}</div>${legend(series, opt.totals ? totals : null)}</div>`;
  }
  /* 가로 막대 — rows [{ l, sub, v, vt, parts:{k:n}, k(색 · 하나일 때), t, go(누르면: data-av-go 값) }] · opt { series, lw, max, label } */
  function hbars(rows, opt){
    css(); opt = opt || {};
    if(!rows.length) return `<div class="av"><p class="av-empty">${esc(opt.empty || '아직 기록이 없어요')}</p></div>`;
    const series = opt.series || null;
    const max = opt.max || Math.max(1, ...rows.map(r => +r.v || 0));
    const body = rows.map(r => {
      const v = +r.v || 0, w = v / max * 100;
      const parts = series ? series.map(s => [s.k, (r.parts || {})[s.k] || 0]).filter(x => x[1] > 0) : [[r.k || '1', v]];
      const segs = parts.map(([k, n]) => `<i class="s-${esc(k)}" style="width:calc(${w.toFixed(2)}% * ${(n / (v || 1)).toFixed(4)})"></i>`).join('');
      const tip = { v: r.vt != null ? r.vt : num(v), t: r.t || r.l, r: series ? series.map(s => [s.k, s.l, num((r.parts || {})[s.k] || 0)]).filter(x => x[2] !== '0') : [] };
      return `<div class="av-hr${r.go != null ? ' go' : ''}"${r.go != null ? ` data-av-go="${esc(r.go)}" role="button"` : ''} tabindex="0"${tipAttr(tip)}><span class="l">${esc(r.l)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><span class="t">${segs}</span><span class="v">${r.vt != null ? esc(r.vt) : num(v)}${r.vs ? `<small>${esc(r.vs)}</small>` : ''}</span></div>`;
    }).join('');
    return `<div class="av"${opt.lw ? ` style="--lw:${opt.lw}px"` : ''}><div class="av-hb" role="list" aria-label="${esc(opt.label || '')}">${body}</div>${series ? legend(series) : ''}</div>`;
  }
  /* 나눔 띠 — parts [{ k, l, v }] · 범례에 % · 개수 */
  function seg(parts, opt){
    css(); opt = opt || {};
    const t = parts.reduce((a, p) => a + (+p.v || 0), 0);
    const pc = v => t ? Math.round(v / t * 100) : 0;
    const bar = t ? `<div class="av-seg" role="img" aria-label="${esc((opt.label || '') + ' ' + parts.map(p => `${p.l} ${pc(p.v)}%`).join(', '))}">${parts.filter(p => p.v > 0).map(p => `<i class="s-${esc(p.k)}" style="flex:${p.v} 1 0"${tipAttr({ v: pc(p.v) + '%', t: p.l, r: [[p.k, p.l, num(p.v) + (opt.unit || '')]] })} tabindex="-1"></i>`).join('')}</div>` : '<div class="av-seg empty"></div>';
    return `<div class="av">${bar}<div class="av-leg">${parts.map(p => `<span><i class="s-${esc(p.k)}"></i>${esc(p.l)} <b>${pc(p.v)}%</b>${opt.counts ? ` <small style="color:var(--av-ink3)">${num(p.v)}${esc(opt.unit || '')}</small>` : ''}</span>`).join('')}</div></div>`;
  }
  function meter(pct, opt){ css(); opt = opt || {}; const p = Math.max(0, Math.min(100, +pct || 0)); return `<span class="av-meter${opt.warn ? ' warn' : ''}" role="img" aria-label="${esc(opt.label || '')} ${Math.round(p)}%"><i style="width:${p.toFixed(1)}%"></i></span>`; }
  /* 채움 목록 — rows [{ l, have, all, warn }] */
  function meters(rows, opt){
    css(); opt = opt || {};
    return `<div class="av"${opt.lw ? ` style="--lw:${opt.lw}px"` : ''}><div class="av-ml">${rows.map(r => { const p = r.all ? r.have / r.all * 100 : 0;
      return `<div class="av-mr" tabindex="0"${tipAttr({ v: Math.round(p) + '%', t: r.l, r: [['1', '채움', `${num(r.have)} / ${num(r.all)}`]] })}><span class="l">${esc(r.l)}</span>${meter(p, { warn: r.warn != null ? r.warn : p < 100, label: r.l })}<span class="v">${Math.round(p)}%<small>${num(r.have)}/${num(r.all)}</small></span></div>`; }).join('')}</div></div>`;
  }
  /* 숫자 칸 — list [{ l, v, u, em, d:{t,c}, tone, meter, go, sm }] */
  function tiles(list){
    css();
    const L = list.filter(Boolean);
    return `<div class="av av-tc"><div class="av-tiles n${L.length}" style="--n:${L.length}">${L.map(x => {
      const tag = x.go != null ? 'button' : 'div';
      return `<${tag} class="av-tile${x.tone ? ' ' + x.tone : ''}"${x.go != null ? ` type="button" data-av-go="${esc(x.go)}"` : ''}><span>${esc(x.l)}</span><b class="${x.sm ? 'sm' : ''}">${esc(x.v)}${x.u ? `<small>${esc(x.u)}</small>` : ''}</b>${x.meter != null ? meter(x.meter, { label:x.l }) : ''}${x.d && x.d.t ? `<span class="av-dl ${x.d.c || ''}">${esc(x.d.t)}</span>` : ''}${x.em ? `<em>${esc(x.em)}</em>` : ''}</${tag}>`; }).join('')}</div></div>`;
  }
  /* 앞 기간과 견주기 */
  function delta(cur, prev, what){
    if(prev == null) return null;
    if(!prev) return cur ? { t:`${what} 없었는데 새로`, c:'up' } : null;
    const d = Math.round((cur - prev) / prev * 100);
    if(!d) return { t:`${what}과 같음`, c:'' };
    return { t:`${what}보다 ${d > 0 ? '+' : ''}${d}%`, c: d > 0 ? 'up' : 'dn' };
  }
  /* 요일 × 시간 — m[7][24] · from ~ to 시 */
  function heat(m, opt){
    css(); opt = opt || {};
    const H0 = opt.from != null ? opt.from : 6, H1 = opt.to != null ? opt.to : 23, unit = opt.unit || '번';
    const max = Math.max(1, ...m.map(r => r.slice(H0, H1 + 1)).flat());
    const lv = v => !v ? 0 : Math.min(5, 1 + Math.floor(v / max * 4.999));
    const order = [1, 2, 3, 4, 5, 6, 0];
    let peak = [0, 0, 0]; m.forEach((r, d) => r.forEach((v, h) => { if(h >= H0 && h <= H1 && v > peak[0]) peak = [v, d, h]; }));
    const out = m.reduce((s, r) => s + r.filter((v, h) => h < H0 || h > H1).reduce((a, v) => a + v, 0), 0);
    return `<div class="av"><div class="av-heat-w"><div class="av-heat" style="--h:${H1 - H0 + 1}" role="group" aria-label="${esc(opt.label || '요일 × 시간')}">
      <span></span>${Array.from({ length:H1 - H0 + 1 }, (_, i) => `<b>${(H0 + i) % 3 === 0 ? H0 + i : ''}</b>`).join('')}
      ${order.map(d => `<span class="${d === 0 || d === 6 ? 'we' : ''}">${DOW[d]}</span>${Array.from({ length:H1 - H0 + 1 }, (_, i) => { const v = m[d][H0 + i]; return `<i class="l${lv(v)}" tabindex="-1"${tipAttr({ v: num(v) + unit, t: `${DOW[d]}요일 ${H0 + i}시` })}></i>`; }).join('')}`).join('')}
    </div></div>
    <div class="av-scale">적음 <i style="background:var(--av-h1)"></i><i style="background:var(--av-h2)"></i><i style="background:var(--av-h3)"></i><i style="background:var(--av-h4)"></i><i style="background:var(--av-h5)"></i> 많음</div>
    <p class="av-mut">${peak[0] ? `가장 많은 때 — <b>${DOW[peak[1]]}요일 ${peak[2]}시</b> (${num(peak[0])}${esc(unit)})` : `${H0} ~ ${H1}시 기록이 없어요`}${out ? ` · ${H1 + 1}시 ~ 다음 날 ${H0 - 1}시 ${num(out)}${esc(unit)}은 표에서 뺐어요` : ''}</p></div>`;
  }
  /* 표로 보기 — head [[글, 'r'?]] · rows [[칸…]] (칸은 이미 이스케이프된 HTML) */
  function table(head, rows, opt){
    opt = opt || {};
    return `<details class="av-tv"${opt.open ? ' open' : ''}><summary>${esc(opt.label || '표로 보기')}</summary><div class="av-tw"><table class="av-tbl"><thead><tr>${head.map(h => `<th class="${h[1] || ''}">${esc(h[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${(head[i] || [])[1] || ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  /* 날짜 도우미 */
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  /* 최근 n일 날마다 — tsList [{ts, k}] → cols 의 rows */
  function daysRows(items, n, keyOf){
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = [];
    for(let i = n - 1; i >= 0; i--){ const d = new Date(today); d.setDate(d.getDate() - i); days.push(d); }
    const idx = {}; days.forEach((d, i) => idx[dkey(d)] = i);
    const rows = days.map((d, i) => ({ x: String(d.getDate()), t: `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`, v: 0, parts: {}, we: d.getDay() === 0 || d.getDay() === 6, now: i === n - 1 }));
    items.forEach(it => { const i = idx[dkey(new Date(it.ts))]; if(i == null) return; const r = rows[i]; r.v++; const k = keyOf ? keyOf(it) : '1'; r.parts[k] = (r.parts[k] || 0) + 1; });
    // 눈금 글자: 14일까지는 모두 · 그보다 길면 1일 · 오늘 · 5일마다
    if(n > 16) rows.forEach((r, i) => { const d = days[i]; r.tick = i === n - 1 || d.getDate() === 1 || (d.getDate() % 5 === 0 && n - 1 - i > 1); if(d.getDate() === 1) r.x = `${d.getMonth() + 1}/1`; });
    else rows.forEach((r, i) => { if(i === 0 || days[i].getDate() === 1) r.x = `${days[i].getMonth() + 1}/${days[i].getDate()}`; });
    return rows;
  }
  /* «얼마 전» */
  function ago(ts, now){
    if(!ts) return '기록 없음';
    now = now || Date.now();
    const m = Math.floor((now - ts) / 60000);
    if(m < 3) return '지금';
    if(m < 60) return `${m}분 전`;
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    if(ts >= t0.getTime()) return `${Math.floor(m / 60)}시간 전`;
    const days = Math.ceil((t0.getTime() - ts) / 86400000);
    if(days <= 1) return '어제';
    if(days < 31) return `${days}일 전`;
    if(days < 365) return `${Math.floor(days / 30)}달 전`;
    return `${Math.floor(days / 365)}년 넘게`;
  }
  /* 마지막 접속 묶음 (순서 있는 묶음) */
  const RECENCY = [['now', '지금 접속 중', 3 * 60000], ['today', '오늘', 'today'], ['w1', '1 ~ 7일 전', 7], ['w2', '8 ~ 14일 전', 14], ['m1', '15 ~ 30일 전', 30], ['old', '30일 넘게', Infinity], ['none', '기록 없음', null]];
  function recencyOf(ts, now){
    now = now || Date.now();
    if(!ts) return 'none';
    if(now - ts < 3 * 60000) return 'now';
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    if(ts >= t0.getTime()) return 'today';
    const days = Math.ceil((t0.getTime() - ts) / 86400000);
    return days <= 7 ? 'w1' : days <= 14 ? 'w2' : days <= 30 ? 'm1' : 'old';
  }
  /* 기기 낱말 → 폰 · 패드 · 컴퓨터 */
  function devKind(s){ s = String(s || ''); return /태블릿|iPad|tablet/i.test(s) ? 'pad' : /휴대폰|모바일|iPhone|Android.*Mobile|Mobi|폰/i.test(s) ? 'phone' : s ? 'pc' : ''; }
  const DEV = [['phone', '폰'], ['pad', '패드'], ['pc', '컴퓨터']];

  /* 누르면 (숫자 칸 · 순위 줄) — data-av-go 를 받는 곳에 한 번 */
  function onGo(root, fn){
    if(!root || root.__avGo) return; root.__avGo = true;
    root.addEventListener('click', e => { const b = e.target.closest('[data-av-go]'); if(b && root.contains(b)) fn(b.getAttribute('data-av-go'), b); });
    root.addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return; const b = e.target.closest('.av-hr[data-av-go]'); if(b && root.contains(b)){ e.preventDefault(); fn(b.getAttribute('data-av-go'), b); } });
  }
  window.AV = { css, cols, hbars, seg, meter, meters, tiles, delta, heat, table, legend, daysRows, ago, recencyOf, RECENCY, devKind, DEV, onGo, esc, num, DOW, niceMax, tipHide };
})();
