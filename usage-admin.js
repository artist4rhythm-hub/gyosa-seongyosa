/* ═══════════════════════════════════════════════════════════
   📊 usage-admin.js — 관리자 › 보안 · 기록 › 사용 현황 (v182 · 수퍼관리자만)
   usage.js 가 모아 보낸 usage/{uid}_{YYYY-MM} 를 한 달씩 읽어 그래프로.
   · 읽기 = 그 달에 쓴 선생님 수만큼(문서 하나 = 한 사람 한 달) + 지난달 비교 한 번
   · 날마다(기기별로 쌓은 막대) · 많이 쓴 화면(기기 비율 띠) · 요일 × 시간 · 많이 쓴 기능(탭) · 선생님별
   ═══════════════════════════════════════════════════════════ */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const DEV = [['phone', '폰', 'smartphone'], ['pad', '패드', 'tablet_mac'], ['pc', '컴퓨터', 'computer']];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const num = n => (+n || 0).toLocaleString('ko-KR');
const ymOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
function shiftYm(ym, k){ const [y, m] = ym.split('-').map(Number); return ymOf(new Date(y, m - 1 + k, 1)); }
function pageName(k){
  if(k === 'home') return ['홈', 'home'];
  try{ const it = window.menuFind && window.menuFind(k); if(it) return [(window.menuLabelOf ? window.menuLabelOf(it) : it.label) || k, it.icon || 'description']; }catch(e){}
  return [k, 'description'];
}

const ST = { ym: ymOf(new Date()), org: 'all', cache: {}, el: null, staff: {}, orgs: {}, tab: 'page' };

async function loadYm(ym){
  if(ST.cache[ym]) return ST.cache[ym];
  const db = getFirestore(getApp());
  const snap = await getDocs(query(collection(db, 'usage'), where('ym', '==', ym)));
  const rows = [];
  snap.forEach(d => { const x = d.data(); if(x && x.uid && x.d && typeof x.d === 'object') rows.push(x); });
  ST.cache[ym] = rows;
  return rows;
}
function staffOrgs(s){ return (s && Array.isArray(s.orgs) && s.orgs.length) ? s.orgs : [s && s.org].filter(Boolean); }
function inOrg(uid){
  if(ST.org === 'all') return true;
  const s = ST.staff[uid]; return !!s && staffOrgs(s).includes(ST.org);
}
/* 한 달 모으기 */
function crunch(rows, ym, maxDay){
  const [y, m] = ym.split('-').map(Number);
  const nDays = new Date(y, m, 0).getDate();
  const lim = maxDay || nDays;                              // 지난달과 비교할 때는 «같은 기간»(1일 ~ 오늘 날짜)만
  const A = { total:0, app:0, dev:{}, days:Array.from({ length:nDays }, () => ({ n:0, dev:{} })), page:{}, pageDev:{}, tab:{}, heat:Array.from({ length:7 }, () => new Array(24).fill(0)), users:{} };
  for(const r of rows){
    if(!inOrg(r.uid)) continue;
    const U = A.users[r.uid] = A.users[r.uid] || { n:0, days:0, dev:{}, page:{}, app:0 };
    for(const [dd, x] of Object.entries(r.d)){
      const di = (+dd) - 1; if(!(di >= 0 && di < nDays && di < lim) || !x || typeof x !== 'object') continue;
      const n = +x.n || 0;
      A.total += n; U.n += n; if(n > 0) U.days++;
      A.days[di].n += n;
      A.app += +x.a || 0; U.app += +x.a || 0;
      for(const [k, v] of Object.entries(x.dv || {})){ A.dev[k] = (A.dev[k] || 0) + (+v || 0); A.days[di].dev[k] = (A.days[di].dev[k] || 0) + (+v || 0); U.dev[k] = (U.dev[k] || 0) + (+v || 0); }
      for(const [k, v] of Object.entries(x.p || {})){ A.page[k] = (A.page[k] || 0) + (+v || 0); U.page[k] = (U.page[k] || 0) + (+v || 0); }
      for(const [k, v] of Object.entries(x.t || {})) A.tab[k] = (A.tab[k] || 0) + (+v || 0);
      const dow = new Date(y, m - 1, +dd).getDay();
      for(const [h, v] of Object.entries(x.h || {})){ const hi = +h; if(hi >= 0 && hi < 24) A.heat[dow][hi] += +v || 0; }
    }
    // 화면별 기기 비율 — 한 사람의 «주로 쓰는 기기» 비율로 그 사람의 화면 수를 나눠 어림 (기기 × 화면을 따로 세지 않아 보관이 작음)
    const ud = Object.values(U.dev).reduce((s, v) => s + v, 0) || 1;
    for(const [k, v] of Object.entries(U.page)){ const P = A.pageDev[k] = A.pageDev[k] || {}; for(const [dk, dv] of Object.entries(U.dev)) P[dk] = (P[dk] || 0) + v * dv / ud; }
  }
  A.nDays = nDays; A.y = y; A.m = m;
  A.nUsers = Object.values(A.users).filter(u => u.n > 0).length;
  A.nKnown = Object.keys(A.users).filter(uid => A.users[uid].n > 0 && ST.staff[uid]).length;   // 교직원 명단에 있는 분만 (지운 계정 · 시험 계정 빼고)
  return A;
}

/* ── 그리기 ── */
function devBar(dev, h){
  const t = DEV.reduce((s, [k]) => s + (dev[k] || 0), 0);
  if(!t) return `<span class="ua-db empty" style="height:${h || 8}px"></span>`;
  return `<span class="ua-db" style="height:${h || 8}px">${DEV.map(([k]) => dev[k] ? `<i class="d-${k}" style="width:${(dev[k] / t * 100).toFixed(1)}%"></i>` : '').join('')}</span>`;
}
function pct(a, b){ return b ? Math.round(a / b * 100) : 0; }
function delta(cur, prev){
  if(!prev) return cur ? '<span class="ua-dl up">새로</span>' : '';
  const d = Math.round((cur - prev) / prev * 100);
  if(!d) return '<span class="ua-dl">지난달과 같음</span>';
  return `<span class="ua-dl ${d > 0 ? 'up' : 'dn'}">${ST.ym === ymOf(new Date()) ? '지난달 같은 기간보다' : '지난달보다'} ${d > 0 ? '+' : ''}${d}%</span>`;
}
function tiles(A, P){
  const devT = DEV.reduce((s, [k]) => s + (A.dev[k] || 0), 0);
  const allStaff = Object.values(ST.staff).filter(s => !s.noAuth && (s.acStatus || 'active') === 'active' && (ST.org === 'all' || staffOrgs(s).includes(ST.org))).length;
  const today = new Date(); const isNow = ST.ym === ymOf(today);
  const passed = isNow ? today.getDate() : A.nDays;
  const top = Object.entries(A.page).sort((a, b) => b[1] - a[1])[0];
  return `<div class="ua-tiles">
    <div class="ua-tile"><span>화면을 연 횟수</span><b>${num(A.total)}</b>${delta(A.total, P.total)}</div>
    <div class="ua-tile"><span>쓴 선생님</span><b>${A.nKnown}<small>${allStaff ? ` / ${allStaff}명` : '명'}</small></b>${allStaff ? `<em>${Math.min(100, pct(A.nKnown, allStaff))}%가 이 달에 열었어요${A.nUsers > A.nKnown ? ` · 명단에 없는 계정 ${A.nUsers - A.nKnown}` : ''}</em>` : ''}</div>
    <div class="ua-tile"><span>하루 평균</span><b>${num(Math.round(A.total / Math.max(1, passed)))}</b><em>${isNow ? `오늘까지 ${passed}일` : `${A.nDays}일`} 기준</em></div>
    <div class="ua-tile"><span>기기</span>${devBar(A.dev, 10)}<em class="ua-leg">${DEV.map(([k, l]) => `<i class="d-${k}"></i>${l} ${pct(A.dev[k] || 0, devT)}%`).join(' · ')}</em></div>
    <div class="ua-tile"><span>가장 많이 연 화면</span><b class="sm">${top ? esc(pageName(top[0])[0]) : '—'}</b>${top ? `<em>${num(top[1])}번</em>` : ''}</div>
    <div class="ua-tile"><span>홈 화면 앱으로</span><b>${pct(A.app, A.total)}<small>%</small></b><em>앱처럼 설치해서 연 비율</em></div>
  </div>`;
}
function dayChart(A){
  const max = Math.max(1, ...A.days.map(d => d.n));
  const today = new Date(); const isNow = ST.ym === ymOf(today);
  return `<div class="ua-days" style="--n:${A.nDays}">${A.days.map((d, i) => {
    const dow = new Date(A.y, A.m - 1, i + 1).getDay();
    const fut = isNow && i + 1 > today.getDate();
    const t = DEV.reduce((s, [k]) => s + (d.dev[k] || 0), 0) || 1;
    const h = d.n / max * 100;
    return `<div class="ua-day${dow === 0 || dow === 6 ? ' we' : ''}${fut ? ' fut' : ''}" title="${A.m}월 ${i + 1}일 (${DOW[dow]}) · ${num(d.n)}번${d.n ? ' — ' + DEV.map(([k, l]) => `${l} ${d.dev[k] || 0}`).join(' · ') : ''}">
      <span class="ua-col" style="height:${h.toFixed(1)}%">${DEV.slice().reverse().map(([k]) => d.dev[k] ? `<i class="d-${k}" style="height:${((d.dev[k] || 0) / t * 100).toFixed(1)}%"></i>` : '').join('')}</span>
      <b>${i + 1}</b></div>`; }).join('')}</div>
    <div class="ua-leg2">${DEV.map(([k, l]) => `<span><i class="d-${k}"></i>${l}</span>`).join('')}<span class="ua-mut">주말은 날짜가 흐리게</span></div>`;
}
function pageRank(A){
  const list = Object.entries(A.page).sort((a, b) => b[1] - a[1]).slice(0, 16);
  if(!list.length) return '<p class="ua-empty">아직 기록이 없어요</p>';
  const max = list[0][1] || 1;
  return `<ol class="ua-rank">${list.map(([k, v], i) => { const [nm, ic] = pageName(k); const P = A.pageDev[k] || {}; const t = DEV.reduce((s, [d]) => s + (P[d] || 0), 0) || 1; const ph = pct(P.phone || 0, t);
    return `<li><span class="ua-ri">${i + 1}</span><span class="ua-rn"><span class="material-symbols-rounded">${esc(ic)}</span>${esc(nm)}</span>
      <span class="ua-rb"><span style="width:${(v / max * 100).toFixed(1)}%">${devBar(P, 12)}</span></span>
      <span class="ua-rv">${num(v)}</span><span class="ua-rp${ph >= 50 ? ' hi' : ''}" title="이 화면을 폰으로 연 비율 (어림)">폰 ${ph}%</span></li>`; }).join('')}</ol>`;
}
function heat(A){
  const H0 = 6, H1 = 23;
  const max = Math.max(1, ...A.heat.map(r => r.slice(H0, H1 + 1)).flat());
  const night = A.heat.reduce((s, r) => s + r.slice(0, H0).reduce((a, v) => a + v, 0), 0);
  const lv = v => !v ? 0 : Math.min(5, 1 + Math.floor(v / max * 4.999));
  const order = [1, 2, 3, 4, 5, 6, 0];
  let peak = [0, 0, 0]; A.heat.forEach((r, d) => r.forEach((v, h) => { if(h >= H0 && h <= H1 && v > peak[0]) peak = [v, d, h]; }));
  return `<div class="ua-heat-w"><div class="ua-heat" style="--h:${H1 - H0 + 1}">
      <span></span>${Array.from({ length:H1 - H0 + 1 }, (_, i) => `<b>${(H0 + i) % 3 === 0 ? H0 + i : ''}</b>`).join('')}
      ${order.map(d => `<span class="${d === 0 || d === 6 ? 'we' : ''}">${DOW[d]}</span>${Array.from({ length:H1 - H0 + 1 }, (_, i) => { const v = A.heat[d][H0 + i]; return `<i class="l${lv(v)}" title="${DOW[d]}요일 ${H0 + i}시 · ${v}번"></i>`; }).join('')}`).join('')}
    </div></div>
    <p class="ua-mut">${peak[0] ? `가장 붐비는 때 — <b>${DOW[peak[1]]}요일 ${peak[2]}시</b>` : '6 ~ 23시 기록이 없어요'}${night ? ` · 새벽 0 ~ 5시 ${num(night)}번은 표에서 뺐어요` : ''}</p>`;
}
function tabRank(A){
  const list = Object.entries(A.tab).sort((a, b) => b[1] - a[1]).slice(0, 14);
  if(!list.length) return '<p class="ua-empty">아직 탭을 누른 기록이 없어요</p>';
  const max = list[0][1] || 1;
  return `<ol class="ua-rank tab">${list.map(([k, v], i) => { const [pk, tb] = k.split('›'); const [nm, ic] = pageName(pk);
    return `<li><span class="ua-ri">${i + 1}</span><span class="ua-rn"><span class="material-symbols-rounded">${esc(ic)}</span>${esc(nm)} <small>› ${esc(tb || '')}</small></span>
      <span class="ua-rb"><span class="one" style="width:${(v / max * 100).toFixed(1)}%"></span></span><span class="ua-rv">${num(v)}</span></li>`; }).join('')}</ol>`;
}
function people(A){
  const rows = Object.entries(A.users).filter(([, u]) => u.n > 0).sort((a, b) => b[1].n - a[1].n);
  const quiet = Object.values(ST.staff).filter(s => !s.noAuth && (s.acStatus || 'active') === 'active' && (ST.org === 'all' || staffOrgs(s).includes(ST.org)) && !(A.users[s.uid] && A.users[s.uid].n > 0));
  const max = rows.length ? rows[0][1].n : 1;
  const main = u => { const e = DEV.map(([k, l]) => [l, u.dev[k] || 0]).sort((a, b) => b[1] - a[1])[0]; return e && e[1] ? e[0] : '—'; };
  return `<div class="ua-tw"><table class="ua-tbl"><thead><tr><th>선생님</th><th>쓴 날</th><th>화면을 연 횟수</th><th>주로</th><th>많이 연 화면</th></tr></thead><tbody>
    ${rows.map(([uid, u]) => { const s = ST.staff[uid] || {}; const tops = Object.entries(u.page).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => esc(pageName(k)[0])).join(' · ');
      return `<tr><td><b>${esc(s.name || '(명단에 없음)')}</b><small>${esc(staffOrgs(s).map(o => ST.orgs[o] || o).join(' · '))}</small></td><td class="r">${u.days}일</td>
        <td><span class="ua-pb"><span style="width:${(u.n / max * 100).toFixed(1)}%"></span></span><span class="ua-pv">${num(u.n)}</span></td>
        <td>${devBar(u.dev, 8)}<small>${main(u)}${u.app ? ' · 앱' : ''}</small></td><td class="ua-tops">${tops}</td></tr>`; }).join('') || '<tr><td colspan="5" class="ua-empty">아직 기록이 없어요</td></tr>'}
    </tbody></table></div>
    ${quiet.length ? `<p class="ua-quiet"><b>이번 달 아직 안 연 분 ${quiet.length}명</b> — ${quiet.map(s => esc(s.name)).join(' · ')}</p>` : ''}`;
}

let SEQ = 0;
async function paint(){
  const el = ST.el; if(!el) return;
  const my = ++SEQ;                                         // 달을 빨리 넘겨도 마지막으로 고른 달만 그림
  const [y, m] = ST.ym.split('-').map(Number);
  const now = ymOf(new Date());
  el.querySelector('.ua-body').innerHTML = '<p class="ua-empty">불러오는 중…</p>';
  el.querySelector('.ua-mo b').textContent = `${y}년 ${m}월`;
  el.querySelector('[data-ua="next"]').disabled = ST.ym >= now;
  let rows, prev;
  try{ [rows, prev] = await Promise.all([loadYm(ST.ym), loadYm(shiftYm(ST.ym, -1))]); }
  catch(e){
    if(my !== SEQ) return;
    el.querySelector('.ua-body').innerHTML = `<div class="ua-card"><p class="ua-empty">불러오지 못했어요 — ${/permission/i.test(String(e && (e.code || e.message))) ? '보안 규칙 v51을 게시했는지 확인해 주세요' : '잠시 뒤 다시 열어 주세요'}</p></div>`;
    return;
  }
  if(my !== SEQ) return;
  const isNow = ST.ym === ymOf(new Date());
  const A = crunch(rows, ST.ym), P = crunch(prev, shiftYm(ST.ym, -1), isNow ? new Date().getDate() : 0);
  if(!A.total){
    el.querySelector('.ua-body').innerHTML = `<div class="ua-card"><p class="ua-empty">${y}년 ${m}월에는 아직 모인 기록이 없어요.<br><small>사이트 v182부터 선생님들이 화면을 열면 10분에 한 번씩 모여요 (보안 규칙 v51 필요).</small></p></div>`;
    return;
  }
  el.querySelector('.ua-body').innerHTML = `
    ${tiles(A, P)}
    <div class="ua-card"><h4><span class="material-symbols-rounded">bar_chart</span>날마다 <small>막대 하나 = 하루 · 색 = 기기</small></h4>${dayChart(A)}</div>
    <div class="ua-grid">
      <div class="ua-card"><h4><span class="material-symbols-rounded">leaderboard</span>많이 연 화면 <small>띠 색 = 그 화면을 연 기기 (어림)</small></h4>${pageRank(A)}</div>
      <div class="ua-card"><h4><span class="material-symbols-rounded">calendar_view_week</span>요일 × 시간 <small>진할수록 많이</small></h4>${heat(A)}
        <h4 style="margin-top:22px"><span class="material-symbols-rounded">tab</span>많이 누른 기능(탭)</h4>${tabRank(A)}</div>
    </div>
    <div class="ua-card"><h4><span class="material-symbols-rounded">group</span>선생님별 <small>화면을 연 횟수 순</small></h4>${people(A)}</div>`;
}


/* ── 모양 (파스텔 · 라이트 / 다크) — 처음 열 때 한 번 붙임 ── */
const CSS = `
.ua-root{--ua-ph:#7FC8A9;--ua-pad:#8DB9E0;--ua-pc:#E6C68F;--ua-soft:#F3F1EC;--ua-h1:#E4F2EB;--ua-h2:#BFE0D0;--ua-h3:#86C6A9;--ua-h4:#3E9C77;--ua-h5:#00704A;max-width:var(--page-dash,1680px)}
html[data-theme="dark"] .ua-root{--ua-ph:#5BB592;--ua-pad:#6F9FCB;--ua-pc:#C9A869;--ua-soft:rgba(255,255,255,.05);--ua-h1:#1D3129;--ua-h2:#24503F;--ua-h3:#2F7559;--ua-h4:#47A27C;--ua-h5:#7FD1AC}
.ua-hd{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 18px;margin:0 0 14px}
.ua-hl{flex:1 1 320px;min-width:0}.ua-hl .actitle{margin:0}
.ua-sub{margin:4px 0 0;font-size:12.5px;color:var(--ink-2,var(--ts));line-height:1.55}
.ua-ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ua-mo{display:inline-flex;align-items:center;gap:6px}.ua-mo b{min-width:96px;text-align:center;font-size:14px;font-weight:800}
.ua-mo .bm{width:32px;padding:0;font-size:16px}
.ua-seg{display:inline-flex;border:1px solid var(--line,#E3E1DA);border-radius:10px;overflow:hidden;background:var(--surface,#fff)}
.ua-seg button{height:32px;padding:0 12px;border:0;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:var(--ink-2,#4D5852);cursor:pointer;white-space:nowrap}
.ua-seg button+button{border-left:1px solid var(--line,#E3E1DA)}
.ua-seg button.on{background:var(--sb-house,#1E3932);color:#fff}
html[data-theme="dark"] .ua-seg button.on{background:var(--sb-green);color:#06130E}
.ua-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}
@media(min-width:1680px){.ua-tiles{grid-template-columns:repeat(6,minmax(0,1fr))}}
.ua-tile{background:var(--surface,#fff);border:1px solid var(--line,#E3E1DA);border-radius:14px;padding:12px 14px;min-width:0;display:flex;flex-direction:column;gap:4px}
.ua-tile span{font-size:12px;font-weight:700;color:var(--ink-2,#5A6560)}
.ua-tile b{font-size:24px;font-weight:800;line-height:1.15;font-variant-numeric:tabular-nums;color:var(--ink,#1F2320)}
.ua-tile b.sm{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ua-tile b small{font-size:13px;font-weight:700;color:var(--ink-3,#93A09A);margin-left:2px}
.ua-tile em{font-style:normal;font-size:11.5px;color:var(--ink-3,#93A09A)}
.ua-leg i,.ua-leg2 i{display:inline-block;width:8px;height:8px;border-radius:2px;margin:0 3px 0 0;vertical-align:0}
.ua-dl{font-size:11.5px;font-weight:700;color:var(--ink-3,#93A09A)}.ua-dl.up{color:#2F8F66}.ua-dl.dn{color:#C0573E}
.ua-card{background:var(--surface,#fff);border:1px solid var(--line,#E3E1DA);border-radius:14px;padding:16px 18px;margin-bottom:12px;min-width:0}
.ua-card h4{display:flex;align-items:center;gap:6px;margin:0 0 12px;font-size:15px;font-weight:800;color:var(--ink,#1F2320);flex-wrap:wrap}
.ua-card h4 .material-symbols-rounded{font-size:19px;color:var(--sb-green,#00704A)}
.ua-card h4 small{font-size:12px;font-weight:600;color:var(--ink-3,#93A09A)}
.ua-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:12px;align-items:start}
.ua-grid .ua-card{margin-bottom:0}
.ua-grid + .ua-card{margin-top:12px}
.d-phone{background:var(--ua-ph)}.d-pad{background:var(--ua-pad)}.d-pc{background:var(--ua-pc)}
.ua-db{display:flex;width:100%;border-radius:99px;overflow:hidden;background:var(--ua-soft);min-width:40px}
.ua-db i{display:block;height:100%}
.ua-days{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:4px;height:180px;align-items:end;padding-bottom:20px;position:relative;border-bottom:1px solid var(--line,#E3E1DA)}
.ua-day{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0}
.ua-col{width:100%;max-width:26px;display:flex;flex-direction:column;border-radius:5px 5px 2px 2px;overflow:hidden;min-height:0;background:var(--ua-soft)}
.ua-col i{display:block;width:100%}
.ua-day b{position:absolute;bottom:-19px;font-size:10.5px;font-weight:600;color:var(--ink-2,#5A6560);font-variant-numeric:tabular-nums}
.ua-day.we b{color:var(--ink-3,#B3BCB7)}.ua-day.fut .ua-col{opacity:.25}
.ua-leg2{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:26px;font-size:12px;color:var(--ink-2,#5A6560);align-items:center}
.ua-mut{font-size:12px;color:var(--ink-3,#93A09A);margin:8px 0 0}
.ua-rank{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.ua-rank li{display:grid;grid-template-columns:22px minmax(110px,170px) minmax(0,1fr) 46px 58px;gap:8px;align-items:center;font-size:13px}
.ua-rank.tab li{grid-template-columns:22px minmax(150px,240px) minmax(0,1fr) 46px}
.ua-ri{font-size:11.5px;font-weight:800;color:var(--ink-3,#93A09A);text-align:right;font-variant-numeric:tabular-nums}
.ua-rn{display:flex;align-items:center;gap:6px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ua-rn small{font-weight:600;color:var(--ink-2,#5A6560)}
.ua-rn .material-symbols-rounded{font-size:17px;color:var(--ink-3,#93A09A);flex:none}
.ua-rb{display:block;min-width:0}.ua-rb > span{display:block;min-width:4px}
.ua-rb > span.one{height:12px;border-radius:99px;background:var(--ua-h3)}
.ua-rb .ua-db{min-width:4px}
.ua-rv{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.ua-rp{font-size:11.5px;font-weight:700;color:var(--ink-3,#93A09A);text-align:right;white-space:nowrap}.ua-rp.hi{color:#2F8F66}
.ua-heat-w{overflow-x:auto;scrollbar-width:thin}
.ua-heat{display:grid;grid-template-columns:22px repeat(var(--h),minmax(14px,1fr));gap:3px;min-width:360px}
.ua-heat > b{font-size:10px;font-weight:600;color:var(--ink-3,#93A09A);text-align:left;height:14px}
.ua-heat > span{font-size:11.5px;font-weight:700;color:var(--ink-2,#5A6560);display:flex;align-items:center}
.ua-heat > span.we{color:var(--ink-3,#B3BCB7)}
.ua-heat > i{display:block;aspect-ratio:1;border-radius:4px;background:var(--ua-soft);min-height:14px}
.ua-heat > i.l1{background:var(--ua-h1)}.ua-heat > i.l2{background:var(--ua-h2)}.ua-heat > i.l3{background:var(--ua-h3)}.ua-heat > i.l4{background:var(--ua-h4)}.ua-heat > i.l5{background:var(--ua-h5)}
.ua-tw{overflow-x:auto}
.ua-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
.ua-tbl th{font-size:12px;font-weight:700;color:var(--ink-3,#93A09A);text-align:left;padding:8px 10px;background:var(--ua-soft);white-space:nowrap}
.ua-tbl td{padding:9px 10px;border-bottom:1px solid var(--line-soft,#EEECE6);vertical-align:middle}
.ua-tbl td small{display:block;font-size:11.5px;color:var(--ink-3,#93A09A);margin-top:2px}
.ua-tbl td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ua-tbl td:nth-child(3){min-width:180px}.ua-tbl td:nth-child(4){min-width:110px}
.ua-pb{display:inline-block;vertical-align:middle;width:calc(100% - 48px);height:10px;border-radius:99px;background:var(--ua-soft);overflow:hidden}
.ua-pb > span{display:block;height:100%;background:var(--ua-h3);border-radius:99px}
.ua-pv{display:inline-block;width:44px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.ua-tops{font-size:12.5px;color:var(--ink-2,#5A6560)}
.ua-quiet{font-size:12.5px;color:var(--ink-2,#5A6560);line-height:1.7;margin:12px 0 0;padding:10px 12px;background:var(--ua-soft);border-radius:10px}
.ua-empty{color:var(--ink-3,#93A09A);font-size:13px;text-align:center;padding:26px 8px;margin:0}
@media(max-width:1180px){.ua-grid{grid-template-columns:minmax(0,1fr)}}
@media(max-width:640px){
  .ua-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ua-tile b{font-size:20px}
  .ua-days{height:140px;gap:2px}.ua-day b{font-size:9px}.ua-day:nth-child(even) b{visibility:hidden}
  .ua-rank li{grid-template-columns:18px minmax(0,1fr) 64px 40px;gap:6px}.ua-rank li .ua-rp{display:none}
  .ua-rank.tab li{grid-template-columns:18px minmax(0,1fr) 54px 40px}
  .ua-card{padding:14px 12px}
}
`;
function addCss(){ if(document.getElementById('ua-css')) return; const st = document.createElement('style'); st.id = 'ua-css'; st.textContent = CSS; document.head.appendChild(st); }

export function mount(el, opt){
  if(!el) return;
  addCss();
  ST.el = el; ST.staff = (opt && opt.staff) || {}; ST.orgs = (opt && opt.orgs) || {};
  const orgKeys = Object.keys(ST.orgs);
  if(!el.querySelector('.ua-root')){
    el.innerHTML = `<div class="ua-root">
      <div class="ua-hd">
        <div class="ua-hl"><h3 class="actitle">📊 사용 현황</h3>
          <p class="ua-sub">어느 화면을 · 언제 · 무슨 기기로 열었는지만 세어요 — 글 내용이나 입력한 값은 남기지 않아요 · 수퍼관리자만 봐요</p></div>
        <div class="ua-ctl">
          <div class="ua-mo"><button type="button" class="bm" data-ua="prev" aria-label="지난달">‹</button><b></b><button type="button" class="bm" data-ua="next" aria-label="다음 달">›</button></div>
          ${orgKeys.length > 1 ? `<div class="ua-seg" role="group" aria-label="기관">${[['all', '모두'], ...orgKeys.map(k => [k, ST.orgs[k]])].map(([k, l]) => `<button type="button" data-org="${esc(k)}" class="${ST.org === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>` : ''}
          <button type="button" class="bm" data-ua="reload" title="다시 불러오기">↻ 새로</button>
        </div>
      </div>
      <div class="ua-body"></div></div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-ua],[data-org]'); if(!b || !el.contains(b)) return;
      if(b.dataset.ua === 'prev'){ ST.ym = shiftYm(ST.ym, -1); paint(); }
      else if(b.dataset.ua === 'next'){ const n = shiftYm(ST.ym, 1); if(n <= ymOf(new Date())){ ST.ym = n; paint(); } }
      else if(b.dataset.ua === 'reload'){ delete ST.cache[ST.ym]; delete ST.cache[shiftYm(ST.ym, -1)]; paint(); }
      else if(b.dataset.org){ ST.org = b.dataset.org; el.querySelectorAll('[data-org]').forEach(x => x.classList.toggle('on', x === b)); paint(); }
    });
  }
  paint();
}
export const __test = { crunch, shiftYm };
