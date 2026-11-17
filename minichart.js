/* 📊 v187 작은 그래프 — 출석부 · 나학평 · 경비 지급 요청서가 함께 쓰는 막대 · 링 (그림만 · 자료를 새로 읽지 않음)
   window.MiniChart.hbars(rows, opt) · vbars(rows, opt) · ring(pct, opt) → HTML 문자열
   - 가로 막대 rows: [{ label, pct(0~100), right, sub, tone:'ok'|'mid'|'bad'|'info', title }]
   - 세로 막대 rows: [{ label, value, valueText, now }] (가장 큰 값 기준 높이)
   - 색: 밝은 화면 · 다크 모두 글자 대비 4.5 이상 */
(function(){
  if(window.MiniChart) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CSS = `
.mc{--mc-ok:#1F8A5B;--mc-mid:#C27C0E;--mc-bad:#C2410C;--mc-info:#2F6FB2;--mc-track:#EEF1EE;--mc-ink:#1F2320;--mc-ink2:#5A6560;--mc-line:#E3E6E1;font-family:inherit}
html[data-theme="dark"] .mc{--mc-ok:#57C79A;--mc-mid:#E3B24F;--mc-bad:#F08A6B;--mc-info:#7FB1E6;--mc-track:#26332D;--mc-ink:#E3EEE9;--mc-ink2:#A9BDB4;--mc-line:#2C3A33}
.mc-h{display:flex;align-items:baseline;gap:8px;margin:0 0 10px;flex-wrap:wrap}
.mc-h b{font-size:14px;font-weight:800;color:var(--mc-ink)}
.mc-h small{font-size:12px;color:var(--mc-ink2)}
.mc-hb{display:flex;flex-direction:column;gap:7px}
.mc-hr{display:grid;grid-template-columns:minmax(64px,var(--mc-lw,120px)) minmax(0,1fr) auto;align-items:center;gap:10px;min-height:24px}
.mc-hr .l{font-size:13px;font-weight:700;color:var(--mc-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-hr .l small{display:block;font-size:12px;font-weight:500;color:var(--mc-ink2)}
.mc-hr .t{position:relative;height:10px;border-radius:99px;background:var(--mc-track);overflow:hidden}
.mc-hr .t i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--mc-ok)}
.mc-hr.mid .t i{background:var(--mc-mid)}.mc-hr.bad .t i{background:var(--mc-bad)}.mc-hr.info .t i{background:var(--mc-info)}
.mc-hr .r{font-size:13px;font-weight:800;color:var(--mc-ink);font-variant-numeric:tabular-nums;text-align:right;min-width:44px;white-space:nowrap}
.mc-hr .r small{font-size:12px;font-weight:500;color:var(--mc-ink2);margin-left:4px}
.mc-vb{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px;align-items:end;height:var(--mc-h,150px)}
.mc-vc{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%;min-width:0}
.mc-vc .v{font-size:12px;font-weight:700;color:var(--mc-ink2);font-variant-numeric:tabular-nums;white-space:nowrap}
.mc-vc .p{width:min(100%,46px);border-radius:8px 8px 3px 3px;background:#A8D3C0;min-height:3px}
.mc-vc.now .p{background:var(--mc-ok)}.mc-vc.now .v{color:var(--mc-ink)}
html[data-theme="dark"] .mc-vc .p{background:#2E6B55}html[data-theme="dark"] .mc-vc.now .p{background:#57C79A}
.mc-vx{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px;margin-top:6px;border-top:1px solid var(--mc-line);padding-top:6px}
.mc-vx span{font-size:12px;color:var(--mc-ink2);text-align:center;white-space:nowrap}
.mc-vx span.now{color:var(--mc-ink);font-weight:800}
.mc-ring{--p:0;width:var(--mc-rs,92px);height:var(--mc-rs,92px);border-radius:50%;background:conic-gradient(var(--mc-c,var(--mc-ok)) calc(var(--p)*1%),var(--mc-track) 0);display:grid;place-items:center;flex:none}
.mc-ring::before{content:'';grid-area:1/1;width:72%;height:72%;border-radius:50%;background:var(--mc-hole,#fff)}
html[data-theme="dark"] .mc-ring::before{background:var(--mc-hole-d,#16211C)}
.mc-ring b{grid-area:1/1;position:relative;font-size:19px;font-weight:900;color:var(--mc-ink);font-variant-numeric:tabular-nums}
.mc-ring b small{font-size:12px;font-weight:700}
.mc-steps{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}
.mc-step{flex:1 1 90px;display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-radius:12px;background:var(--mc-track);min-width:0}
.mc-step b{font-size:20px;font-weight:900;color:var(--mc-ink);font-variant-numeric:tabular-nums;line-height:1.1}
.mc-step span{font-size:12.5px;font-weight:700;color:var(--mc-ink2)}
.mc-step.ok{background:#E3F2EA}.mc-step.ok b{color:#17643F}
.mc-step.warn{background:#FCEBDD}.mc-step.warn b{color:#9A3412}
html[data-theme="dark"] .mc-step.ok{background:#173326}html[data-theme="dark"] .mc-step.ok b{color:#7FD9B0}
html[data-theme="dark"] .mc-step.warn{background:#3A2418}html[data-theme="dark"] .mc-step.warn b{color:#F5A57E}
.mc-arrow{align-self:center;color:var(--mc-ink2);font-size:14px}
@media(max-width:600px){ .mc-hr{grid-template-columns:minmax(56px,var(--mc-lws,92px)) minmax(0,1fr) auto;gap:8px} .mc-arrow{display:none} .mc-vb{gap:5px} .mc-vx{gap:5px} .mc-vc .v{font-size:11.5px} }
@media print{ .mc-noprint{display:none !important} }`;
  function css(){ if(document.getElementById('mc-css')) return; const st = document.createElement('style'); st.id = 'mc-css'; st.textContent = CSS; document.head.appendChild(st); }
  const tone = (pct, ok, mid) => pct >= ok ? 'ok' : pct >= mid ? 'mid' : 'bad';
  function hbars(rows, opt){
    css(); opt = opt || {};
    const body = rows.map(r => { const p = Math.max(0, Math.min(100, Number(r.pct) || 0));
      return `<div class="mc-hr ${r.tone || 'ok'}"${r.title ? ` title="${esc(r.title)}"` : ''}><span class="l">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><span class="t" role="img" aria-label="${esc(r.label)} ${Math.round(p)}%"><i style="width:${p}%"></i></span><span class="r">${r.right != null ? r.right : Math.round(p) + '%'}</span></div>`; }).join('');
    return `<div class="mc"${opt.lw ? ` style="--mc-lw:${opt.lw}px"` : ''}>${opt.title ? `<div class="mc-h"><b>${esc(opt.title)}</b>${opt.note ? `<small>${esc(opt.note)}</small>` : ''}</div>` : ''}<div class="mc-hb">${body}</div></div>`;
  }
  function vbars(rows, opt){
    css(); opt = opt || {};
    const mx = Math.max(1, ...rows.map(r => Number(r.value) || 0));
    const cols = rows.map(r => { const h = Math.round((Number(r.value) || 0) / mx * 100);
      return `<div class="mc-vc${r.now ? ' now' : ''}" title="${esc(r.label)} · ${esc(r.valueText || r.value)}"><span class="v">${esc(r.valueText != null ? r.valueText : r.value)}</span><i class="p" style="height:${Math.max(r.value ? 4 : 2, h * .78)}%"></i></div>`; }).join('');
    const xs = rows.map(r => `<span class="${r.now ? 'now' : ''}">${esc(r.label)}</span>`).join('');
    return `<div class="mc"${opt.h ? ` style="--mc-h:${opt.h}px"` : ''}>${opt.title ? `<div class="mc-h"><b>${esc(opt.title)}</b>${opt.note ? `<small>${esc(opt.note)}</small>` : ''}</div>` : ''}<div class="mc-vb" role="img" aria-label="${esc(opt.title || '막대 그래프')}">${cols}</div><div class="mc-vx">${xs}</div></div>`;
  }
  function ring(pct, opt){
    css(); opt = opt || {}; const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const c = opt.color || (p >= (opt.ok || 95) ? 'var(--mc-ok)' : p >= (opt.mid || 85) ? 'var(--mc-mid)' : 'var(--mc-bad)');
    return `<div class="mc"><div class="mc-ring" style="--p:${p};--mc-c:${c}${opt.size ? `;--mc-rs:${opt.size}px` : ''}${opt.hole ? `;--mc-hole:${opt.hole}` : ''}" role="img" aria-label="${esc(opt.label || '')} ${p}%"><b>${opt.text != null ? opt.text : Math.round(p)}<small>${opt.unit != null ? opt.unit : '%'}</small></b></div></div>`;
  }
  function steps(list){
    css();
    return `<div class="mc"><div class="mc-steps">${list.map((x, i) => `${i ? '<span class="mc-arrow" aria-hidden="true">›</span>' : ''}<div class="mc-step ${x.tone || ''}"${x.title ? ` title="${esc(x.title)}"` : ''}><b>${esc(x.n)}</b><span>${esc(x.l)}</span></div>`).join('')}</div></div>`;
  }
  window.MiniChart = { hbars, vbars, ring, steps, tone, css };
})();
