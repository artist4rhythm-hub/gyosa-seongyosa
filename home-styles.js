/* ═══════════════════════════════════════════════════════════
   🏠 home-styles.js — 홈 모양 두 가지 (v185 · 현우님 «추천안으로» 2026-11-17)
   · A «오늘 한 장»  — 인사 그림 · 지금 할 일(하나로 합침) · 오늘 일정 · 숫자 카드 3개(출석 링 · 교직원 출근 · 학기 진행)
   · B «대시보드»    — 숫자 카드 4개 · 최근 10일 결석+지각 막대 · 다음 일정 · 할 일 · 오늘 출근 · 학기 반원 · 생일
   · 둘 다: 자주 여는 방 + «더 보기»(공지 · 생일 · 학사일정 · 출결 자세히 · 동아리 · 회의 · 시간표 · 할 일 · 메모 · 날씨 · 세계 시계 …)
   · 기본: 선생님 A · 관리자(수퍼 · 기관 · 부서장) · 원장 · 교장 · 교감 · 주임 회의 멤버 B — «홈 고르기»에서 A · B · 예전 모양 중 고름
   · 예전 위젯은 «더 보기» 칸 안에 그대로 두어 실시간 갱신 · 고르기 · 편집이 예전처럼 움직인다 (새 카드는 그 자료를 함께 씀)
   index.html 이 installHomeStyles(문맥) 로 설치 → window.HN
   ═══════════════════════════════════════════════════════════ */
export function installHomeStyles(ctx){
  const { db, $I, esc } = ctx;
  const { collection, query, where, getDocs } = ctx.fs;
  const G = () => ctx.get();                       // { CU, STAFF_CACHE, TODOS, TT_TODAY, TT_OFF, WX_DATA, WX_PLACE, WX_LIST }
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const minOf = s => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const LS = {
    get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  };
  const MS = n => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;

  /* ── 홈 모양 ── */
  const STYLES = ['a', 'b', 'classic'];
  const LEAD_POS = /원장|교장|교감|행정실장/;
  function defaultStyle(CU){
    if(!CU) return 'a';
    if(['super', 'org_admin', 'tab_admin'].includes(CU.role)) return 'b';
    if(LEAD_POS.test(String(CU.position || ''))) return 'b';
    try{ if(window.leadMenuState && leadMenuState(CU) === 'm') return 'b'; }catch(e){}
    return 'a';
  }
  const styleOf = (CU, acc) => { const s = acc && acc.style; return STYLES.includes(s) ? s : defaultStyle(CU); };
  const STYLE_INFO = {
    a: { l: '오늘 한 장', d: '할 일 · 오늘 일정 · 숫자 카드 셋 — 차분하게 (선생님 기본)' },
    b: { l: '대시보드', d: '숫자 카드 · 막대 · 반원 그래프로 한눈에 (관리자 · 원장 · 주임 기본)' },
    classic: { l: '예전 모양', d: '위젯을 모두 펼쳐 두는 지금까지의 홈 (차례 · 배치 바꾸기)' },
  };

  let STY = 'a', P = null, CLOCK = null, WIRED = false;
  const moreKey = () => { const cu = G().CU; return 'gyosa_hnmore:' + ((cu && cu.uid) || '_'); };

  /* ── 인사 그림 (GPT 그림이 오기 전 · 시간대마다) ── */
  function tod(){ const h = new Date().getHours(); return h >= 5 && h < 11 ? 'am' : h >= 11 && h < 17 ? 'day' : 'pm'; }
  function artSVG(t){
    const sky = t === 'pm' ? '#1E3932' : t === 'day' ? '#E8F3EF' : '#F7EFD8';
    const h1 = t === 'pm' ? '#244A40' : '#D4E9E2', h2 = t === 'pm' ? '#2C5A4D' : '#B9DACD';
    const sun = t === 'pm' ? '<path d="M290 52a20 20 0 1 0 12 36 16 16 0 1 1-12-36z" fill="#E3C878"/>'
      : t === 'day' ? '<circle cx="292" cy="58" r="22" fill="#FFFFFF" opacity=".9"/><path d="M196 70c6-10 22-10 28 0 10-2 16 8 10 14h-44c-8-2-6-14 6-14z" fill="#FFFFFF"/>'
      : '<circle cx="282" cy="104" r="30" fill="#E9C46A" opacity=".55"/><circle cx="282" cy="104" r="20" fill="#F2D587"/>';
    const stars = t === 'pm' ? '<circle cx="60" cy="40" r="1.6" fill="#F7EFD8"/><circle cx="120" cy="26" r="1.2" fill="#F7EFD8"/><circle cx="210" cy="44" r="1.4" fill="#F7EFD8"/><circle cx="330" cy="30" r="1.2" fill="#F7EFD8"/><circle cx="246" cy="20" r="1" fill="#F7EFD8"/>' : '';
    return `<svg viewBox="0 0 360 230" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><rect width="360" height="230" fill="${sky}"/>${stars}${sun}
      <path d="M0 168 C80 128 160 148 240 138 C300 130 330 118 360 110 V230 H0z" fill="${h1}"/>
      <path d="M0 198 C90 172 190 188 360 160 V230 H0z" fill="${h2}"/>
      <path d="M96 196 h48 l-4 -18 h-40z" fill="#8A6410" opacity=".85"/><ellipse cx="120" cy="178" rx="20" ry="5" fill="#B08D3C"/>
      <path d="M120 176 V146" stroke="#00704A" stroke-width="3" stroke-linecap="round"/>
      <path d="M120 160 C104 156 98 144 100 134 C112 136 120 146 120 160z" fill="#00704A"/>
      <path d="M120 154 C134 148 142 136 140 126 C128 128 120 140 120 154z" fill="#1F6B4A"/>
      <path d="M176 64l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="${t === 'pm' ? '#E3C878' : '#8A6410'}"/></svg>`;
  }

  /* ── CSS (한 번) ── */
  function css(){
    if(document.getElementById('hn-css')) return;
    const st = document.createElement('style'); st.id = 'hn-css';
    st.textContent = `
.hn{--hn-card:var(--surface,#fff);--hn-line:var(--line,#E3E1DA);--hn-soft:var(--line-soft,#EFEDE7);--hn-ink:var(--ink,#1F2320);--hn-ink2:var(--ink-2,#5A6560);
  --hn-mint:var(--sb-mint-2,#E8F3EF);--hn-green:var(--sb-green,#00704A);--hn-house:#1E3932;--hn-pri:#1E3932;--hn-pri-ink:#fff;--hn-pri-sub:#D4E9E2;
  --hn-warm:#F7EFD8;--hn-warm-ink:#6B5212;--hn-red:#FBE7DF;--hn-red-ink:#9A3A16;--hn-bar:#8FC3AE;
  margin:0 auto;width:100%;color:var(--hn-ink)}
html[data-theme="dark"] .hn{--hn-house:#DCEFE6;--hn-pri:#123326;--hn-pri-sub:#A9D5C2;--hn-warm:#2A2416;--hn-warm-ink:#E3C878;--hn-red:#3A1B1B;--hn-red-ink:#F8A08A;--hn-bar:#2E6B55}
.hn.hn-a{max-width:1240px}.hn.hn-b{max-width:1440px}
.hn *{box-sizing:border-box}
.hn h1,.hn h2,.hn p{margin:0}
.hn a{color:inherit}
.hn .hn-sp{flex:1 1 auto}
.hn .hn-card{background:var(--hn-card);border:1px solid var(--hn-line);border-radius:16px;padding:18px 20px;min-width:0;display:flex;flex-direction:column;gap:12px}
.hn .hn-h{display:flex;align-items:center;gap:8px;min-height:28px}
.hn .hn-h h2{font-size:16px;font-weight:800;letter-spacing:-.2px}
.hn .hn-h .hn-a2{font-size:13px;font-weight:700;color:var(--hn-green);text-decoration:none;white-space:nowrap}
.hn .hn-h .hn-a2:hover{text-decoration:underline}
.hn .hn-cnt{min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:var(--hn-house);color:var(--surface,#fff);font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.hn .hn-dim{font-size:13px;color:var(--hn-ink2)}
.hn .hn-btn{height:32px;padding:0 12px;border:1px solid var(--hn-line);border-radius:10px;background:var(--hn-card);color:var(--hn-ink);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.hn .hn-btn:hover{border-color:var(--hn-green);color:var(--hn-green)}
.hn .hn-btn .material-symbols-rounded{font-size:17px}
.hn .hn-pill{height:40px;padding:0 18px;border-radius:999px;border:1px solid var(--hn-house);background:var(--hn-card);color:var(--hn-house);font:inherit;font-size:14px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;white-space:nowrap}
.hn .hn-pill.p{background:var(--hn-pri);border-color:var(--hn-pri);color:#fff}
.hn .hn-pill.ghost{border-color:var(--hn-line);color:var(--hn-ink2)}
.hn .hn-pill .material-symbols-rounded{font-size:18px}
.hn .hn-tag{height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:800;display:inline-flex;align-items:center;white-space:nowrap;flex:none}
.hn .hn-tag.c1{background:var(--gx-c1b);color:var(--gx-c1)}.hn .hn-tag.c2{background:var(--gx-c2b);color:var(--gx-c2)}
.hn .hn-tag.c3{background:var(--hn-warm);color:var(--hn-warm-ink)}.hn .hn-tag.c4{background:var(--gx-c4b);color:var(--gx-c4)}
.hn .hn-tag.c5{background:var(--gx-c5b);color:var(--gx-c5)}.hn .hn-tag.hot{background:var(--hn-red);color:var(--hn-red-ink)}
.hn .hn-tag.warm{background:var(--hn-warm);color:var(--hn-warm-ink)}
.hn .hn-ic{width:36px;height:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.hn .hn-ic .material-symbols-rounded{font-size:19px}
/* ─ A 인사 ─ */
.hn .hn-hero{display:flex;gap:22px;background:var(--hn-card);border:1px solid var(--hn-line);border-radius:20px;padding:24px;margin-bottom:16px;position:relative;overflow:hidden}
.hn .hn-ht{flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:12px}
.hn .hn-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hn .hn-date{font-size:13px;color:var(--hn-ink2)}
.hn .hn-hi{font-size:28px;line-height:1.3;font-weight:800;color:var(--hn-house);letter-spacing:-.5px;word-break:keep-all}
.hn .hn-sum{font-size:15px;line-height:1.6;color:var(--hn-ink2);word-break:keep-all}
.hn .hn-sum b{color:var(--hn-ink)}
.hn .hn-verse{margin:0;padding:12px 16px;border-radius:12px;background:var(--hn-warm);color:var(--hn-ink);font-family:var(--font-read,'MaruBuri',serif);font-size:15px;line-height:1.65;word-break:keep-all}
.hn .hn-verse cite{display:block;margin-top:4px;font-style:normal;font-family:inherit;font-size:12px;font-weight:700;color:var(--hn-warm-ink);font-family:var(--font-ui,inherit)}
.hn .hn-chips{display:flex;flex-wrap:wrap;gap:8px}
.hn .hn-chip{height:32px;padding:0 12px;border-radius:999px;background:var(--hn-mint);color:var(--hn-house);font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.hn .hn-chip .material-symbols-rounded{font-size:17px}
.hn .hn-chip[hidden]{display:none}
.hn .hn-art{flex:0 1 340px;min-width:220px;min-height:220px;margin:0;border-radius:16px;overflow:hidden;position:relative;background:var(--hn-mint)}
.hn .hn-art svg,.hn .hn-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
html[data-theme="dark"] .hn .hn-art:not([data-tod="pm"]){filter:brightness(.82) saturate(.9)}
.hn .hn-art picture{display:contents}
/* 빈 칸 그림 */
.hn .hn-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px 4px 4px;text-align:center;font-size:13px;color:var(--hn-ink2);word-break:keep-all}
.hn .hn-empty img{width:64px;height:64px;object-fit:contain;flex:none}
.hn .hn-empty.big{flex:1 1 auto;padding:14px 4px 10px}
.hn .hn-empty.big img{width:88px;height:88px}
.hn .hn-empty.ok span{font-size:14px;font-weight:700;color:var(--hn-green)}
html[data-theme="dark"] .hn .hn-empty img{opacity:.9}
/* ─ 줄 ─ */
.hn .hn-g2{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:16px;margin-bottom:16px}
.hn .hn-g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(270px,100%),1fr));gap:16px;margin-bottom:16px}
/* ─ 지금 할 일 ─ */
.hn .hn-tl{display:flex;flex-direction:column}
.hn .hn-tr{display:flex;align-items:center;gap:12px;padding:10px 2px;border-top:1px solid var(--hn-soft);text-decoration:none;color:inherit;min-height:56px;cursor:pointer;background:none;border-left:0;border-right:0;border-bottom:0;font:inherit;text-align:left;width:100%}
.hn .hn-tr:first-child{border-top:0}
.hn .hn-tr:hover .hn-tt{color:var(--hn-green)}
.hn .hn-tb{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.hn .hn-tt{font-size:14px;font-weight:700}
.hn .hn-tm{font-size:12px;color:var(--hn-ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hn .hn-done{display:flex;align-items:center;gap:10px;padding:14px 4px;font-size:14px;font-weight:700;color:var(--hn-green)}
.hn .hn-zero{display:flex;flex-wrap:wrap;gap:6px;padding-top:4px}
.hn .hn-zero a{font-size:12px;color:var(--hn-ink2);text-decoration:none;border:1px solid var(--hn-line);border-radius:999px;padding:4px 10px}
.hn .hn-zero a:hover{border-color:var(--hn-green);color:var(--hn-green)}
/* ─ 오늘 일정 ─ */
.hn .hn-now{align-self:flex-start;height:24px;padding:0 10px;border-radius:999px;background:var(--hn-mint);color:var(--hn-green);font-size:12px;font-weight:800;display:inline-flex;align-items:center}
.hn .hn-tlx{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.hn .hn-tlx li{display:flex;gap:12px}
.hn .hn-tlx .t{width:46px;flex:none;font-size:13px;font-weight:800;padding-top:1px;font-variant-numeric:tabular-nums}
.hn .hn-tlx .ln{width:12px;flex:none;display:flex;flex-direction:column;align-items:center}
.hn .hn-tlx .ln i{width:10px;height:10px;margin-top:4px;border-radius:50%;background:var(--hn-green);flex:none}
.hn .hn-tlx .ln b{flex:1 1 auto;width:2px;background:var(--hn-line)}
.hn .hn-tlx li:last-child .ln b{display:none}
.hn .hn-tlx .x{flex:1 1 auto;min-width:0;padding-bottom:14px;display:flex;flex-direction:column;gap:2px}
.hn .hn-tlx .x b{font-size:14px;font-weight:700;word-break:keep-all}
.hn .hn-tlx .x span{font-size:12px;color:var(--hn-ink2)}
.hn .hn-tlx li.past{opacity:.5}
.hn .hn-tlx li.nowln .t{color:var(--hn-green)}
.hn .hn-tlx li.nowln .x{padding-bottom:10px}
.hn .hn-tlx li.nowln .x b{font-size:12px;color:var(--hn-green)}
.hn .hn-tlx li.nowln .ln i{width:8px;height:8px;margin-top:5px;background:none;border:2px solid var(--hn-green)}
.hn .hn-foot{display:flex;flex-wrap:wrap;gap:14px;margin-top:auto}
.hn .hn-foot a{font-size:13px;font-weight:700;color:var(--hn-green);text-decoration:none}
.hn .hn-foot a:hover{text-decoration:underline}
.hn .hn-lk{border:0;background:none;padding:0;font:inherit;font-size:13px;font-weight:700;color:var(--hn-green);cursor:pointer}
.hn .hn-lk:hover{text-decoration:underline}
.hn button.hn-chip{border:0;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
/* ─ 숫자 카드 ─ */
.hn .hn-big{display:flex;align-items:baseline;gap:6px}
.hn .hn-big b{font-size:34px;font-weight:800;line-height:1;color:var(--hn-house);font-variant-numeric:tabular-nums}
.hn .hn-big span{font-size:14px;color:var(--hn-ink2)}
.hn .hn-ringrow{display:flex;align-items:center;gap:18px}
.hn .hn-ring{position:relative;width:112px;height:112px;flex:none}
.hn .hn-ring svg{display:block;width:100%;height:100%}
.hn .hn-ring .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.hn .hn-ring .c b{font-size:23px;font-weight:800;color:var(--hn-house);line-height:1.1}
.hn .hn-ring .c span{font-size:11px;color:var(--hn-ink2)}
.hn .hn-lg{list-style:none;margin:0;padding:0;flex:1 1 auto;display:flex;flex-direction:column;gap:7px;font-size:13px}
.hn .hn-lg li{display:flex;align-items:center;gap:8px}
.hn .hn-lg li i{width:10px;height:10px;border-radius:3px;flex:none}
.hn .hn-lg li span{flex:1 1 auto}
.hn .hn-seg{display:flex;gap:3px;height:12px}
.hn .hn-seg i{display:block;min-width:4px;border-radius:2px}
.hn .hn-seg i:first-child{border-radius:6px 2px 2px 6px}.hn .hn-seg i:last-child{border-radius:2px 6px 6px 2px}.hn .hn-seg i:only-child{border-radius:6px}
.hn .hn-lgl{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--hn-ink2)}
.hn .hn-lgl span{display:inline-flex;align-items:center;gap:5px}
.hn .hn-lgl i{width:9px;height:9px;border-radius:3px}
.hn .hn-av{display:flex;align-items:center}
.hn .hn-av span{width:30px;height:30px;border-radius:50%;border:2px solid var(--hn-card);margin-left:-8px;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.hn .hn-av span:first-child{margin-left:0}
.hn .hn-pbar{height:12px;border-radius:6px;background:var(--hn-mint);overflow:hidden}
.hn .hn-pbar i{display:block;height:100%;border-radius:6px;background:var(--hn-house)}
.hn .hn-dd{display:flex;flex-direction:column;gap:8px}
.hn .hn-dd a{display:flex;align-items:center;gap:10px;font-size:13px;text-decoration:none}
.hn .hn-dd a span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hn .hn-dd a em{font-style:normal;color:var(--hn-ink2);font-size:12px}
.hn .hn-dd .hn-tag{min-width:48px;justify-content:center}
.hn .hn-mine{font-size:12.5px;font-weight:700;color:var(--gx-c1)}
.hn .hn-mine a{color:var(--hn-green)}
/* ─ 자주 여는 방 (예전 칸을 작게) ─ */
.hn .hn-rooms{background:var(--hn-card);border:1px solid var(--hn-line);border-radius:16px;padding:16px 20px;margin-bottom:16px}
.hn .hn-rooms .hm-sec{margin-top:0}
@media(min-width:761px){
  .hn .hn-rooms .hm-rooms{display:flex;flex-wrap:wrap;gap:10px}
  .hn .hn-rooms .hm-rooms .hm-rm{flex:0 1 auto;flex-direction:row;align-items:center;gap:10px;min-height:48px;padding:6px 16px 6px 8px;border-radius:12px}
  .hn .hn-rooms .hm-rooms .hm-rm-ic{width:34px;height:34px;margin:0;border-radius:10px}
  .hn .hn-rooms .hm-rooms .hm-rm-ic .material-symbols-rounded{font-size:19px}
  .hn .hn-rooms .hm-rooms .hm-rm-s{display:none}
  .hn .hn-rooms .hm-rooms .hm-rm-t{font-size:14px}
  .hn .hn-rooms .hm-rooms.editing .hm-rm{padding-right:30px}
}
.hn .hn-rooms .hm-allrooms{margin-top:12px}
/* ─ 더 보기 ─ */
.hn .hn-more{margin-bottom:8px}
.hn .hn-more > .hn-h{margin-bottom:10px}
.hn .hn-note{font-size:13px;color:var(--hn-ink2)}
.hn .hn-mbar{display:flex;flex-wrap:wrap;gap:8px}
.hn .hn-mc{height:40px;padding:0 14px;border:1px solid var(--hn-line);border-radius:12px;background:var(--hn-card);color:var(--hn-ink);font:inherit;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.hn .hn-mc .material-symbols-rounded{font-size:18px;color:var(--hn-ink2)}
.hn .hn-mc:hover{border-color:var(--hn-green)}
.hn .hn-mc.on{background:var(--hn-house);border-color:var(--hn-house);color:var(--surface,#fff)}
.hn .hn-mc.on .material-symbols-rounded{color:inherit}
html[data-theme="dark"] .hn .hn-mc.on{background:var(--sb-green);border-color:var(--sb-green);color:#06130E}
.hn .hn-mpans{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(460px,100%),1fr));gap:16px;margin-top:14px;align-items:start}
.hn .hn-mpans:empty{display:none}
.hn .hn-pn{background:var(--hn-card);border:1px solid var(--hn-line);border-radius:16px;padding:16px 18px;min-width:0}
.hn .hn-pn[hidden]{display:none !important}
.hn .hn-pn.wide{grid-column:1 / -1}
.hn .hn-pn.bare{background:none;border:0;padding:0}
.hn .hn-pn #hm-tt:empty::before{content:'오늘 내 수업이 없거나 게시된 시간표가 없어요.';font-size:13px;color:var(--hn-ink2)}
.hn .hn-pn #home-boards:empty::before{content:'새 글이 없어요.';font-size:13px;color:var(--hn-ink2)}
.hn .hn-pn #home-boards{margin-top:0 !important}
.hn .hn-pn > .hm-sec:first-child{margin-top:0}
.hn .hn-pnh{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;margin-bottom:10px}
.hn .hn-pnh .material-symbols-rounded{font-size:19px;color:var(--hn-green)}
.hn .hn-pn #home-notice,.hn .hn-pn #home-schedule,.hn .hn-pn #home-birthday{display:block !important;padding:0 !important}
/* ─ B 머리 ─ */
.hn .hn-bh{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin-bottom:16px}
.hn .hn-bh-l{flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:4px}
.hn .hn-bh-l h1{font-size:28px;font-weight:800;color:var(--hn-house);letter-spacing:-.5px}
.hn .hn-bh-l p{font-size:14px;color:var(--hn-ink2);word-break:keep-all}
.hn .hn-bh-r{display:flex;flex-wrap:wrap;gap:8px}
/* ─ B 숫자 카드 ─ */
.hn .hn-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px}
.hn .hn-kpi{position:relative;overflow:hidden;min-height:160px;padding:18px 20px;border-radius:18px;border:1px solid var(--hn-line);background:var(--hn-card);text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px;min-width:0}
.hn .hn-kpi .kh{position:relative;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700}
.hn .hn-kpi .kh > span:first-child{flex:1 1 auto;min-width:0}
.hn .hn-kpi .kgo{width:32px;height:32px;border-radius:50%;border:1px solid var(--hn-line);display:inline-flex;align-items:center;justify-content:center;flex:none}
.hn .hn-kpi .kgo .material-symbols-rounded{font-size:18px}
.hn .hn-kpi .kv{position:relative;font-size:40px;font-weight:800;line-height:1.1;color:var(--hn-house);font-variant-numeric:tabular-nums}
.hn .hn-kpi .kv small{font-size:16px;font-weight:700;color:var(--hn-ink2)}
.hn .hn-kpi .ks{position:relative;font-size:13px;color:var(--hn-ink2)}
.hn .hn-kpi .kt{position:relative;align-self:flex-start;margin-top:4px}
.hn .hn-kpi .hn-tag.kt{background:var(--hn-mint);color:var(--hn-house)}
.hn .hn-kpi:hover{border-color:var(--hn-green)}
.hn .hn-kpi.pri{background:var(--hn-pri) url(img/card-wave.webp) right bottom / cover no-repeat;border-color:var(--hn-pri);color:var(--hn-pri-ink)}
.hn .hn-kpi.pri .kart{display:none}
.hn .hn-kpi.pri .kv{color:#fff}.hn .hn-kpi.pri .ks{color:var(--hn-pri-sub)}
.hn .hn-kpi.pri .kgo{background:#fff;border-color:#fff;color:#1E3932}
.hn .hn-kpi.pri .hn-tag.kt{background:rgba(212,233,226,.18);color:#E8F3EF}
.hn .hn-kpi .kart{position:absolute;right:-40px;bottom:-30px;width:300px;height:170px;pointer-events:none}
.hn .hn-b3{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.1fr);gap:16px;margin-bottom:16px}
/* 막대 */
.hn .hn-bars{display:flex;align-items:flex-end;gap:6px}
.hn .hn-bars > div{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.hn .hn-bars .v{font-size:12px;font-weight:700;color:var(--hn-ink2)}
.hn .hn-bars .p{height:120px;width:100%;display:flex;align-items:flex-end;justify-content:center}
.hn .hn-bars .p i{display:block;width:min(30px,80%);border-radius:15px;background:var(--hn-bar);min-height:6px}
.hn .hn-bars .d{font-size:12px;color:var(--hn-ink2)}
.hn .hn-bars .on .v,.hn .hn-bars .on .d{color:var(--hn-house);font-weight:800}
.hn .hn-bars .on .p i{background:var(--hn-house)}
/* 다음 일정 */
.hn .hn-nx-t{font-size:22px;font-weight:800;line-height:1.3;color:var(--hn-house);word-break:keep-all}
.hn .hn-nx-m{font-size:14px;color:var(--hn-ink2)}
.hn .hn-nx-go{margin-top:auto;height:44px;border-radius:999px;background:var(--hn-pri);color:#fff;text-decoration:none;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px}
.hn .hn-nx-go .material-symbols-rounded{font-size:18px}
.hn .hn-nx-s{font-size:12px;color:var(--hn-ink2);text-align:center}
/* 출근 목록 */
.hn .hn-sl{display:flex;flex-direction:column}
.hn .hn-sl > div{display:flex;align-items:center;gap:12px;min-height:46px}
.hn .hn-sl .av{width:34px;height:34px;border-radius:50%;font-size:13px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
.hn .hn-sl .nm{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}
.hn .hn-sl .nm b{font-size:14px;font-weight:700}
.hn .hn-sl .nm span{font-size:12px;color:var(--hn-ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hn .hn-sl .tm{font-size:13px;color:var(--hn-ink2);width:46px;flex:none;font-variant-numeric:tabular-nums}
.hn .hn-sl .hn-tag{width:58px;justify-content:center}
/* 반원 */
.hn .hn-gauge{position:relative;width:200px;max-width:100%;margin:4px auto 0}
.hn .hn-gauge svg{display:block;width:100%;height:auto}
.hn .hn-gauge .c{position:absolute;left:0;right:0;bottom:2px;display:flex;flex-direction:column;align-items:center}
.hn .hn-gauge .c b{font-size:28px;font-weight:800;line-height:1;color:var(--hn-house)}
.hn .hn-gauge .c span{font-size:12px;color:var(--hn-ink2)}
/* 생일 */
.hn .hn-bdl{display:flex;flex-direction:column;gap:10px}
.hn .hn-bdl > div{display:flex;align-items:center;gap:10px}
.hn .hn-bdl .av{width:40px;height:40px;border-radius:50%;background:var(--hn-warm);color:var(--hn-warm-ink);font-size:14px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
.hn .hn-bdl .nm{display:flex;flex-direction:column;min-width:0}
.hn .hn-bdl .nm b{font-size:14px;font-weight:700}
.hn .hn-bdl .nm span{font-size:12px;color:var(--hn-ink2)}
.hn .hn-bdl > div.past{opacity:.55}
/* ─ 넓이 ─ */
@media(max-width:1180px){
  .hn .hn-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .hn .hn-b3{grid-template-columns:repeat(2,minmax(0,1fr))}
  .hn .hn-b3 > :first-child{grid-column:1 / -1}
}
@media(max-width:900px){
  .hn .hn-g2{grid-template-columns:minmax(0,1fr)}
  .hn .hn-art{flex-basis:260px;min-width:200px}
}
@media(max-width:760px){
  .hn .hn-hero{padding:18px;gap:10px;border-radius:18px}
  .hn .hn-hero .hn-art{position:absolute;top:0;right:0;width:118px;min-width:0;height:104px;min-height:0;border-radius:0 0 0 18px}
  .hn .hn-hero .hn-ht{gap:10px}
  .hn .hn-hero .hn-top{padding-right:110px}
  .hn .hn-hero .hn-hi{font-size:22px;padding-right:96px}
  .hn .hn-hero .hn-sum{padding-right:0}
  .hn .hn-verse{font-size:14px;padding:10px 12px}
  .hn .hn-card{padding:16px}
  .hn .hn-b3{grid-template-columns:minmax(0,1fr)}
  .hn .hn-kpis{gap:8px;grid-template-columns:repeat(3,minmax(0,1fr))}
  .hn .hn-kpi{min-height:0;padding:14px}
  .hn .hn-kpi .kv{font-size:30px}
  .hn .hn-kpi.pri{grid-column:1 / -1}
  .hn .hn-kpi:not(.pri){padding:12px;gap:4px;border-radius:14px}
  .hn .hn-kpi:not(.pri) .kgo,.hn .hn-kpi:not(.pri) .kt{display:none}
  .hn .hn-kpi:not(.pri) .kh{font-size:12px;color:var(--hn-ink2)}
  .hn .hn-kpi:not(.pri) .kv{font-size:24px}
  .hn .hn-kpi:not(.pri) .kv small{font-size:12px}
  .hn .hn-kpi:not(.pri) .ks{font-size:11px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .hn .hn-kpi .kart{width:240px}
  .hn .hn-bh-l h1{font-size:24px}
  .hn .hn-bh-r{width:100%}
  .hn .hn-bh-r .hn-pill{flex:1 1 0;justify-content:center;height:44px;padding:0 10px}
  .hn .hn-bh-r .hn-pill.ghost{flex:0 0 auto}
  .hn .hn-bars .p{height:90px}
  .hn .hn-bars{gap:3px}
  .hn .hn-mpans{grid-template-columns:minmax(0,1fr)}
  .hn .hn-mc{height:40px;padding:0 12px}
  .hn .hn-rooms{padding:14px 16px}
}
@media print{ .hn .hn-more,.hn .hn-btn,.hn .hn-pill{display:none !important} }
`;
    document.head.appendChild(st);
  }

  /* ═══ 그리기 — renderHome 이 부름 ═══
     p = { todos, block(k) → 예전 위젯 HTML(못 쓰면 ''), dateStr, greet, V, orgLine, attendOk, quickOn } */
  function html(sty, p){
    STY = sty; P = p; css();
    const { CU } = G();
    const name = esc((CU && CU.name) || '');
    const rooms = roomsHTML();
    const more = moreHTML();
    if(sty === 'b'){
      const gs = String(p.greet || '').replace(/[,.!].*$/, '');
      return `<div class="hm-wrap hn hn-b">
      <div class="hn-bh">
        <div class="hn-bh-l"><h1>오늘 한눈에</h1>
          <p>${esc(p.dateStr)} · ${name} 선생님, ${esc(gs || '오늘도 함께해요')} · <span id="hn-time2"></span><span id="hn-wx2"></span></p></div>
        <div class="hn-bh-r">
          ${p.approvalOk ? `<a class="hn-pill p" href="approval.html">${MS('approval')}전자결재</a>` : ''}
          <button class="hn-pill" type="button" onclick="HN.compose()">${MS('edit')}쪽지 쓰기</button>
          <button class="hn-pill ghost" type="button" onclick="openWidgetSetup()" title="홈 모양 · 더 보기에 둘 것 고르기">${MS('dashboard_customize')}홈 고르기</button>
        </div>
      </div>
      <div id="nt-nudge"></div>
      <div class="hn-kpis" id="hn-kpis">${kpisHTML()}</div>
      <div class="hn-b3">
        ${p.attendOk ? `<section class="hn-card" id="hn-hist" aria-label="최근 10일 결석과 지각"><div class="hn-h"><h2>최근 10일 · 결석 + 지각</h2><span class="hn-sp"></span><span class="hn-dim">명 · 적을수록 좋아요</span></div><div class="hn-dim">불러오는 중…</div></section>`
          : `<section class="hn-card hn-sched" aria-label="오늘 일정"><div class="hn-h"><h2>오늘 일정</h2></div><div id="hn-sched"><div class="hn-dim">불러오는 중…</div></div></section>`}
        <section class="hn-card" id="hn-next" aria-label="다음 일정"><div class="hn-h"><h2>다음 일정</h2></div><div class="hn-dim">불러오는 중…</div></section>
        <section class="hn-card hn-todo" aria-label="지금 할 일">${todoHead()}<div class="hn-tl" id="hn-todo">${todoRows(true)}</div></section>
      </div>
      <div class="hn-b3">
        <section class="hn-card" id="hn-stl" aria-label="오늘 출근"><div class="hn-h"><h2>오늘 출근</h2><span class="hn-sp"></span><a class="hn-a2" href="checkin.html">출근부 ›</a></div><div class="hn-dim">불러오는 중…</div></section>
        <section class="hn-card" id="hn-term" aria-label="학기 진행"><div class="hn-h"><h2>학기 진행</h2></div><div class="hn-dim">불러오는 중…</div></section>
        <section class="hn-card" id="hn-bd" aria-label="이번 달 생일"><div class="hn-h"><h2>이번 달 생일</h2></div>${bdHTML()}</section>
      </div>
      ${rooms}
      ${more}
    </div>`;
    }
    // A
    const t = tod();
    return `<div class="hm-wrap hn hn-a">
      <section class="hn-hero" aria-label="오늘 인사">
        <div class="hn-ht">
          <div class="hn-top"><span class="hn-date">${esc(p.dateStr)}<span id="hn-lunar"></span></span><span class="hn-sp"></span>
            <button class="hn-btn" type="button" onclick="openWidgetSetup()" title="홈 모양 · 더 보기에 둘 것 고르기">${MS('dashboard_customize')}홈 고르기</button></div>
          <h1 class="hn-hi">${esc(p.greet)}, ${name} 선생님</h1>
          <p class="hn-sum" id="hn-sum">${esc(p.orgLine || '')}</p>
          ${p.V ? `<blockquote class="hn-verse">${esc(p.V.t)}<cite>${esc(p.V.r)}</cite></blockquote>` : ''}
          <div class="hn-chips"><span class="hn-chip">${MS('schedule')}<span id="hn-time"></span></span><span class="hn-chip" id="hn-wx" hidden></span><span class="hn-chip" id="hn-moon" hidden></span></div>
        </div>
        <figure class="hn-art" data-tod="${t}">${artHTML(t)}</figure>
      </section>
      <div id="nt-nudge"></div>
      <div class="hn-g2">
        <section class="hn-card hn-todo" aria-label="지금 할 일">${todoHead()}<div class="hn-tl" id="hn-todo">${todoRows(false)}</div></section>
        <section class="hn-card hn-sched" aria-label="오늘 일정"><div class="hn-h"><h2>오늘 일정</h2></div><div id="hn-sched" style="display:flex;flex-direction:column;gap:10px;flex:1 1 auto"><div class="hn-dim">불러오는 중…</div></div></section>
      </div>
      <div class="hn-g3">
        ${p.attendOk ? `<section class="hn-card" id="hn-att" aria-label="오늘 출석"><div class="hn-h"><h2>오늘 출석</h2></div><div class="hn-dim">불러오는 중…</div></section>` : ''}
        <section class="hn-card" id="hn-staff" aria-label="교직원 출근"><div class="hn-h"><h2>교직원 출근</h2></div><div class="hn-dim">불러오는 중…</div></section>
        <section class="hn-card" id="hn-term" aria-label="학기 진행"><div class="hn-h"><h2>학기 진행</h2></div><div class="hn-dim">불러오는 중…</div></section>
      </div>
      ${rooms}
      ${more}
    </div>`;
  }
  /* 🖼 v186 인사 그림 — GPT로 그린 그림 (img/home-{계절-}{시간대}.webp · 폰은 그루터기를 가까이 자른 -sm)
     계절: 9~11월 가을 · 12~2월 겨울 · 나머지는 기본(봄 · 여름). 그 계절 그림 파일이 아직 없으면 기본 그림.
     그림을 못 받으면(아주 옛 브라우저 · 끊김) 예전에 그린 SVG 로 */
  const ART_SEASONS = [];   // 파일이 들어 있는 계절 ('fall' · 'winter')
  function season(d){ const m = (d || new Date()).getMonth() + 1; return m >= 9 && m <= 11 ? 'fall' : (m === 12 || m <= 2) ? 'winter' : ''; }
  function artKey(t){ const s = season(); return s && ART_SEASONS.includes(s) ? `${s}-${t}` : t; }
  function artHTML(t){
    const src = (window.HN_ART && window.HN_ART[t]) || '';
    if(src) return `<img src="${esc(src)}" alt="" loading="lazy">`;
    const k = artKey(t);
    return `<picture><source media="(max-width:760px)" srcset="img/home-${k}-sm.webp"><img src="img/home-${k}.webp" alt="" decoding="async" onerror="HN.artFail(this,'${t}')"></picture>`;
  }
  function artFail(img, t){
    const f = img && img.closest('figure'); if(!f) return;
    const pic = img.closest('picture');
    if(pic && !pic.dataset.base && artKey(t) !== t){   // 계절판이 없으면 기본(봄 · 여름) 그림으로 한 번 더
      pic.dataset.base = '1'; const s = pic.querySelector('source'); if(s) s.srcset = `img/home-${t}-sm.webp`; img.src = `img/home-${t}.webp`; return;
    }
    f.innerHTML = artSVG(t);
  }
  /* 빈 칸 그림 (img/empty-*.webp) — 할 일 없음 · 일정 없음 · 생일 없음 · 학생 없음 */
  const EA = { done: 'empty-done', cal: 'empty-calendar', letter: 'empty-letter', search: 'empty-search', basket: 'empty-basket', pot: 'empty-pot' };
  function emptyArt(k, text, cls){ return `<div class="hn-empty${cls ? ' ' + cls : ''}"><img src="img/${EA[k] || EA.basket}.webp" alt="" width="64" height="64" decoding="async" onerror="this.remove()"><span>${text}</span></div>`; }

  /* ── 지금 할 일 ── */
  const ORDER = ['전자결재', '경비 결재', '지급 대기', '안 읽은 쪽지', '회의 임무', '새 게시글'];
  const LABEL = { '회의 임무': '회의에서 맡은 일', '전자결재': '결재할 문서' };
  function todoItems(){
    const list = ((P && P.todos) || []).slice().sort((a, b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label));
    const mt = window.__mtgTop || null;
    const out = list.map(t => {
      let meta = t.hint, tag = `${t.v}${t.label === '안 읽은 쪽지' ? '통' : '건'}`, cls = t.c === 3 ? 'c3' : t.c === 2 ? 'c2' : t.c === 4 ? 'c4' : 'c1', href = t.href;
      if(t.label === '회의 임무' && mt && mt.n){
        meta = [mt.h, mt.mt].filter(Boolean).join(' · ') || t.hint;
        if(mt.due){ tag = mt.due.dd < 0 ? `${-mt.due.dd}일 지남` : mt.due.dd === 0 ? '오늘까지' : `D-${mt.due.dd}`; cls = mt.due.dd <= 3 ? 'hot' : 'c2'; }
        if(mt.n === 1 && mt.href) href = mt.href;
      }
      if(t.label === '전자결재' || t.label === '경비 결재' || t.label === '지급 대기') cls = 'warm';
      return { l: LABEL[t.label] || t.label, v: t.v, meta, tag, cls, href, mi: t.mi, c: t.c, core: t.core };
    });
    const TD = (G().TODOS || []).filter(x => !x.done);
    if(TD.length || (P && P.block && P.block('chk'))){
      out.push({ l: '내 할 일', v: TD.length, meta: TD.length ? TD.slice(0, 2).map(x => x.text).join(' · ') : '', tag: `${TD.length}개`, cls: 'c1', more: (P && P.block && P.block('chk')) ? 'chk' : '', mi: 'checklist', c: 1, core: 0 });
    }
    return out;
  }
  function todoHead(){
    const n = todoItems().filter(x => x.v > 0).reduce((s, x) => s + 1, 0);
    return `<div class="hn-h"><h2>지금 할 일</h2>${n ? `<span class="hn-cnt" id="hn-todo-n">${n}</span>` : `<span id="hn-todo-n"></span>`}</div>`;
  }
  function todoRows(compact){
    const it = todoItems(), on = it.filter(x => x.v > 0), zero = it.filter(x => !x.v && x.core);
    const row = x => {
      const inner = `<span class="hn-ic" style="background:var(--gx-c${x.c}b);color:var(--gx-c${x.c})">${MS(x.mi || 'task_alt')}</span>
        <span class="hn-tb"><span class="hn-tt">${esc(x.l)}</span>${!compact && x.meta ? `<span class="hn-tm">${esc(x.meta)}</span>` : ''}</span>
        <span class="hn-tag ${x.cls}">${esc(x.tag)}</span>`;
      return x.more ? `<button type="button" class="hn-tr" onclick="HN.openMore('${x.more}')">${inner}</button>`
        : x.href ? `<a class="hn-tr" href="${esc(x.href)}">${inner}</a>` : `<div class="hn-tr" style="cursor:default">${inner}</div>`;
    };
    let h = on.map(row).join('');
    if(!on.length) h = emptyArt('done', '지금 처리할 일이 없어요', compact ? 'ok' : 'ok big');
    if(zero.length && !compact) h += `<div class="hn-zero">${zero.map(x => `<a href="${esc(x.href)}">${esc(x.l)} 0</a>`).join('')}</div>`;
    return h;
  }
  function paintTodo(){
    const box = $I('hn-todo'); if(!box) return;
    box.innerHTML = todoRows(STY === 'b');
    const n = $I('hn-todo-n'); const k = todoItems().filter(x => x.v > 0).length;
    if(n){ n.className = k ? 'hn-cnt' : ''; n.textContent = k ? String(k) : ''; }
    paintSum();
  }

  /* ── 오늘 일정 (학사 행사 + 내 수업) ── */
  let _evP = null, _evKey = '', _evAt = 0;
  function todayEvents(){
    const key = ymd(new Date()) + '|' + (((window.__attOrgs && window.__attOrgs()) || []).join(','));   // 날짜 · 기관이 바뀌면 · 10분마다 새로
    if(!_evP || _evKey !== key || Date.now() - _evAt > 10 * 60000){ _evKey = key; _evAt = Date.now(); _evP = (window.hwTodayEventList ? window.hwTodayEventList() : Promise.resolve([])).catch(() => { _evP = null; return null; }); }
    return _evP;
  }
  async function schedItems(){
    const ev = await todayEvents();
    const { TT_TODAY } = G();
    const items = [];
    (ev || []).forEach(e => items.push({ k: 'ev', m: minOf(e.start), t: e.start ? e.start.slice(0, 5) : '종일', title: e.title, sub: [e.who, e.place].filter(Boolean).join(' · '), c: 1 }));
    (G().TT_OFF ? [] : (TT_TODAY || [])).forEach(c => items.push({ k: 'tt', m: c.start, t: hhmm(c.start), title: c.subject, sub: [c.room, (c.grades || []).join('·')].filter(Boolean).join(' · ') + ` · ${c.dur}분`, c: 2, end: c.start + c.dur }));
    items.sort((a, b) => a.m - b.m || a.title.localeCompare(b.title, 'ko'));
    return { items, failed: ev === null };
  }
  async function paintSched(){
    const box = $I('hn-sched');
    let r; try{ r = await schedItems(); }catch(e){ r = { items: [], failed: true }; }
    SCHED = r.items; paintSum(); paintNext();
    if(!box) return;
    const { TT_OFF, TT_TODAY } = G();
    const now = nowMin();
    const it = r.items;
    let h = `<span class="hn-now">지금 ${hhmm(now)}</span>`;
    if(!it.length){
      h += r.failed ? `<div class="hn-dim">일정을 불러오지 못했어요.</div>` : emptyArt('cal', TT_OFF ? `오늘은 쉬는 날이에요 · ${esc(TT_OFF)}` : '오늘 정해진 일정이 없어요.', STY === 'a' ? 'big' : '');
    } else {
      const MAX = 7;
      let shown = it.slice(0, MAX), rows = [], putNow = false;
      shown.forEach(x => {
        const end = x.end != null ? x.end : (x.m >= 0 ? x.m + 50 : -1);
        if(!putNow && x.m >= 0 && x.m > now){ putNow = true; if(rows.length) rows.push(`<li class="nowln"><span class="t">${hhmm(now)}</span><span class="ln"><i></i><b></b></span><span class="x"><b>지금</b></span></li>`); }
        const past = x.m >= 0 && end >= 0 && end <= now;
        rows.push(`<li class="${past ? 'past' : ''}"><span class="t">${esc(x.t)}</span><span class="ln"><i style="background:var(--gx-c${x.c})"></i><b></b></span>
          <span class="x"><b>${esc(x.title)}</b>${x.sub ? `<span>${esc(x.sub)}</span>` : ''}</span></li>`);
      });
      h += `<ol class="hn-tlx">${rows.join('')}</ol>`;
      if(it.length > MAX) h += `<div class="hn-dim">… ${it.length - MAX}개 더</div>`;
    }
    h += `<div class="hn-foot"><a href="academic.html">학사일정 ›</a>${(TT_TODAY || []).length ? '<a href="timetable-final.html">시간표 ›</a>' : ''}<a href="calendar.html">구글 캘린더 ›</a></div>`;
    box.innerHTML = h;
  }
  let SCHED = [];

  /* ── 오늘 출석 (출결 위젯이 받은 자료) ── */
  function attSum(){
    const orgs = (window.__attOrgs && window.__attOrgs()) || [];
    if(!orgs.length || !window.__attModel) return null;
    const days = orgs.map(o => window.__attDay ? window.__attDay(o) : null);
    if(days.length && days.every(d => d && !d.school)) return { off: true, day: days[0], orgs };
    const live = orgs.filter((o, i) => !days[i] || days[i].school);      // 오늘 쉬는 기관은 빼고 (두 기관을 함께 볼 때)
    const all = live.map(o => window.__attModel(o));
    const ms = all.filter(m => m && m.roster);
    if(!ms.length) return all.length && all.every(m => m) ? { empty: true } : null;   // 다 받았는데 재적이 없음 · 아직 받는 중
    // 학생마다 한 칸 — 결석(출석 아님) > 체험학습 > 조퇴 > 지각 (칸을 다 더하면 재적)
    const S = { roster: 0, present: 0, here: 0, abs: 0, lat: 0, ear: 0, trip: 0, per: [] };
    ms.forEach(m => { S.roster += m.roster; S.present += m.present; S.here += m.here;
      (m.flags || []).forEach(f => { const b = f.bks || [f.bk];
        if(f.np) S.abs++; else if(b.includes('trip')) S.trip++; else if(b.includes('ear')) S.ear++; else if(b.includes('lat')) S.lat++; });
      S.per.push({ nm: m.orgNm, rate: m.rate, present: m.present, roster: m.roster }); });
    S.ok = Math.max(0, S.roster - S.abs - S.trip - S.ear - S.lat);
    S.rate = S.roster ? Math.round(S.present / S.roster * 100) : 100;
    return S;
  }
  function ringSVG(rate, size){
    const C = 314.16, v = Math.max(0, Math.min(100, rate)) / 100 * C;
    return `<svg viewBox="0 0 120 120" role="img" aria-label="출석 ${rate}퍼센트"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--hn-mint)" stroke-width="13"/>
      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--hn-green)" stroke-width="13" stroke-linecap="round" stroke-dasharray="${v.toFixed(1)} ${C}" transform="rotate(-90 60 60)"/></svg>`;
  }
  function offText(d){
    if(!d) return '오늘은 수업이 없어요';
    const nm = d.name ? ` · ${d.name}` : '';
    const nx = d.next ? ` · 다음 수업일 ${Number(d.next.slice(5, 7))}/${Number(d.next.slice(8, 10))}` : '';
    return d.kind === 'noterm' ? '학기가 아직 등록되지 않았어요' : `오늘은 수업이 없어요${nm}${nx}`;
  }
  function paintAtt(){
    const box = $I('hn-att'), k = $I('hn-k-att');
    const S = attSum();
    if(box){
      const head = `<div class="hn-h"><h2>오늘 출석</h2><span class="hn-sp"></span>${S && !S.off && !S.empty ? '<span class="hn-tag c1">● 실시간</span>' : ''}</div>`;
      if(!S) box.innerHTML = head + `<div class="hn-dim">불러오는 중…</div>`;
      else if(S.off) box.innerHTML = head + `<div class="hn-dim">${esc(offText(S.day))}</div><div class="hn-foot"><a href="academic.html">학사일정 ›</a></div>`;
      else if(S.empty) box.innerHTML = head + emptyArt('pot', '출결을 셀 학생이 없어요 — 반편성에 학생을 넣으면 보여요.') + `<div class="hn-foot"><a href="class.html">반편성 ›</a></div>`;
      else {
        const lg = [['출석', S.ok, 'var(--hn-green)'], ['지각', S.lat, 'var(--att-late-tx,#B45309)'], ['결석', S.abs, 'var(--att-absent-tx,#DC2626)']]
          .concat(S.ear ? [['조퇴', S.ear, 'var(--att-early-tx,#C2410C)']] : []).concat(S.trip ? [['체험학습', S.trip, 'var(--gx-c2)']] : []);
        box.innerHTML = head + `<div class="hn-ringrow"><div class="hn-ring">${ringSVG(S.rate)}<div class="c"><b>${S.rate}%</b><span>${S.present} / ${S.roster}명</span></div></div>
          <ul class="hn-lg">${lg.map(([l, v, c]) => `<li><i style="background:${c}"></i><span>${l}</span><b>${v}</b></li>`).join('')}</ul></div>
          ${S.per.length > 1 ? `<div class="hn-lgl">${S.per.map(o => `<span>${esc(o.nm)} <b>${o.rate}%</b></span>`).join('')}</div>` : ''}
          <div class="hn-foot"><a href="attend.html?stat=live">출석부 열기 ›</a>${MORE_ON.includes('attend') ? `<button type="button" class="hn-lk" onclick="HN.openMore('attend')">반별 보기 ›</button>` : ''}</div>`;
      }
    }
    if(k){
      if(!S) k.innerHTML = kpiInner('오늘 출석', '…', '', '');
      else if(S.off) k.innerHTML = kpiInner('오늘 출석', `<small style="color:inherit;font-size:20px">${S.day && S.day.kind === 'noterm' ? '학기 없음' : '쉬는 날'}</small>`, esc(offText(S.day)), '');
      else if(S.empty) k.innerHTML = kpiInner('오늘 출석', '<small style="color:inherit;font-size:20px">학생 없음</small>', '반편성에 학생을 넣으면 보여요', '');
      else k.innerHTML = kpiInner('오늘 출석', `${S.rate}<small style="color:var(--hn-pri-sub)">%</small>`, `${S.present} / ${S.roster}명 · 지각 ${S.lat} · 결석 ${S.abs}`, `지금 학교에 ${S.here}명`);
    }
    paintSum();
    if(HIST) paintHist();
  }

  /* ── 교직원 출근 ──
     출근부(checkin.html)와 같은 판정 — 기록은 «예외»만 남는다:
     기록 없음 + 근무 기간 평일 = 정상출근(자동) · 방학 기간 = 정기휴가(자동) · 휴일 = 쉬는 날 · 기간 밖 = 아직
     이름과 휴가 · 결근 목록은 관리자(수퍼 · 기관 · 부서장)만 — 다른 분은 숫자만 (출근부 «전체 현황»과 같은 범위) */
  const SUB_OFF = ['병가', '연차', '정기휴가', '임시휴교', '휴무일', '반차(오전)', '반차(오후)', '경조사'];
  const stOf = sub => !sub ? 'none' : sub === '결근' ? 'abs' : SUB_OFF.includes(sub) ? 'off' : 'in';
  const offLabel = sub => /반차/.test(sub) ? '반차' : '휴가';                 // 병가 · 경조사도 «휴가»로 (사유는 출근부에서)
  const isAdm = () => { const cu = G().CU; return !!cu && ['super', 'org_admin', 'tab_admin'].includes(cu.role); };
  let _stf = null, _stfAt = 0, _stfP = null;
  function staffToday(){
    const td = ymd(new Date());
    if(_stf && _stf.day === td && Date.now() - _stfAt < 90000) return Promise.resolve(_stf);
    if(_stfP) return _stfP;
    _stfP = Promise.all([
      getDocs(query(collection(db, 'attendance'), where('date', '==', td))),
      window.hwSchoolData ? window.hwSchoolData().catch(() => null) : Promise.resolve(null),
    ]).then(([s, SD]) => {
      const rec = {};
      s.forEach(d => { const a = d.data(); if(!a.uid) return; const t = a.updatedAt && a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0;
        if(!rec[a.uid] || t >= rec[a.uid].t) rec[a.uid] = { sub: String(a.sub || a.type || ''), t }; });
      _stf = { day: td, rec, wp: (SD && SD.wp) || [], hol: (SD && SD.hol) || [] }; _stfAt = Date.now(); return _stf;
    }).finally(() => { _stfP = null; });
    return _stfP;
  }
  function autoOf(s, D){
    const td = D.day, dow = new Date(td + 'T00:00:00').getDay(), wknd = dow === 0 || dow === 6;
    const so = s.orgs && s.orgs.length ? s.orgs : [s.org];
    if(D.hol.some(h => h.date === td && (h.org === 'all' || so.includes(h.org)))) return { st: 'rest', sub: '' };
    const inP = w => so.includes(w.org) && td >= w.s && td <= w.e && (!wknd || w.wknd);
    if(D.wp.some(w => w.type === 'vacation' && inP(w))) return { st: 'off', sub: '정기휴가', auto: 1 };
    if(D.wp.some(w => w.type !== 'vacation' && inP(w))) return { st: 'in', sub: '정상출근', auto: 1 };
    return wknd ? { st: 'rest', sub: '' } : { st: 'none', sub: '' };
  }
  function roster(){
    const { STAFF_CACHE } = G();
    const orgs = (window.__attOrgs && window.__attOrgs()) || [];
    return Object.values(STAFF_CACHE || {}).filter(s => s && s.name && (s.acStatus || 'active') === 'active' && s.role !== 'partner'
      && (!orgs.length || (s.orgs && s.orgs.length ? s.orgs : [s.org]).some(o => orgs.includes(o))))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  }
  const AVC = [1, 2, 3, 4, 5];
  const avc = s => { let h = 0; for(const ch of String(s.uid || s.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVC[h % 5]; };
  const ini = s => esc(String(s.name || '?').trim().slice(0, 1));
  async function paintStaff(){
    const A = $I('hn-staff'), L = $I('hn-stl'), K = $I('hn-k-stf');
    if(!A && !L && !K) return;
    let data = null; try{ data = await staffToday(); }catch(e){ data = null; }
    const R = roster(), { CU } = G();
    const headL = n => `<div class="hn-h"><h2>오늘 출근</h2>${n || ''}<span class="hn-sp"></span><a class="hn-a2" href="checkin.html">출근부 ›</a></div>`;
    if(!data){
      const err = `<div class="hn-dim">출근 기록을 불러오지 못했어요.</div>`;
      if(A) A.innerHTML = `<div class="hn-h"><h2>교직원 출근</h2></div>` + err;
      if(L) L.innerHTML = headL() + err;
      if(K) K.innerHTML = kpiInner('교직원 출근', '—', '', '');
      return;
    }
    const rows = R.map(s => { const r = data.rec[s.uid];
      const a = r ? { st: stOf(r.sub), sub: r.sub } : autoOf(s, data);
      const t = r && r.t && ymd(new Date(r.t)) === data.day ? r.t : 0;          // 오늘 남긴 기록만 시각 (미리 넣어 둔 출장 · 재택은 «—»)
      return { s, sub: a.sub, st: a.st, t, auto: !!a.auto }; });
    const work = rows.filter(x => x.st !== 'rest');
    const n = { in: 0, off: 0, abs: 0, none: 0 }; work.forEach(x => n[x.st]++);
    const meRow = CU ? rows.find(x => x.s.uid === CU.uid) : null;
    const mine = !meRow ? '' : meRow.st === 'rest' ? '오늘은 쉬는 날이에요' : meRow.st === 'none' ? `내 출근 아직 · <a href="checkin.html">출근부에서 입력 ›</a>`
      : `내 출근 · ${esc(meRow.st === 'off' ? offLabel(meRow.sub) : meRow.sub || '기록됨')}${meRow.auto ? ' (자동)' : ''}`;
    if(!work.length){
      const rest = `<div class="hn-dim">오늘은 교직원 쉬는 날이에요.</div>`;
      if(A) A.innerHTML = `<div class="hn-h"><h2>교직원 출근</h2></div>` + rest + `<div class="hn-foot"><a href="checkin.html">출근부 ›</a></div>`;
      if(L) L.innerHTML = headL() + rest;
      if(K) K.innerHTML = kpiInner('교직원 출근', '<small style="color:inherit;font-size:20px">쉬는 날</small>', '오늘은 근무일이 아니에요', '');
      return;
    }
    const seg = [['in', '출근', 'var(--hn-green)'], ['off', '휴가', 'var(--att-leave-tx,#2B5C85)'], ['abs', '결근', 'var(--att-absent-tx,#DC2626)'], ['none', '아직', 'var(--line,#D9D6CD)']].filter(([k]) => n[k]);
    const segHTML = `<div class="hn-seg" role="img" aria-label="${seg.map(([k, l]) => `${l} ${n[k]}명`).join(', ')}">${seg.map(([k, l, c]) => `<i style="flex:${n[k]} 1 0;background:${c}"></i>`).join('')}</div>
        <div class="hn-lgl">${seg.map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} ${n[k]}</span>`).join('')}</div>`;
    if(A){
      const av = work.filter(x => x.st === 'in').slice(0, 5);
      A.innerHTML = `<div class="hn-h"><h2>교직원 출근</h2></div>
        <div class="hn-big"><b>${n.in}</b><span>/ ${work.length}명</span></div>${segHTML}
        ${mine ? `<div class="hn-mine">${mine}</div>` : ''}
        <div class="hn-foot" style="align-items:center"><span class="hn-av">${av.map(x => `<span style="background:var(--gx-c${avc(x.s)}b);color:var(--gx-c${avc(x.s)})" title="${esc(x.s.name)}">${ini(x.s)}</span>`).join('')}${n.in > 5 ? `<span style="background:var(--gx-c5b);color:var(--gx-c5);font-size:11px">+${n.in - 5}</span>` : ''}</span><span class="hn-sp"></span><a href="checkin.html">출근부 ›</a></div>`;
    }
    if(L){
      const tagN = `<span class="hn-tag c1">${n.in} / ${work.length}</span>`;
      if(!isAdm()){
        // 관리자가 아니면 숫자만 (누가 휴가 · 결근인지는 출근부 «전체 현황»을 볼 수 있는 분만)
        L.innerHTML = headL(tagN) + `<div class="hn-big"><b>${n.in}</b><span>/ ${work.length}명 출근</span></div>${segHTML}${mine ? `<div class="hn-mine">${mine}</div>` : ''}`;
      } else {
        const RANK = { abs: 0, none: 1, off: 2, in: 3 };
        const list = work.slice().sort((a, b) => RANK[a.st] - RANK[b.st] || String(a.s.name).localeCompare(String(b.s.name), 'ko'));
        const MAX = 7;
        const tag = x => x.st === 'in' ? `<span class="hn-tag c1">${x.sub === '정상출근' ? '출근' : esc(x.sub.replace('(오전)', '').replace('(오후)', '').slice(0, 5))}</span>`
          : x.st === 'off' ? `<span class="hn-tag c2">${offLabel(x.sub)}</span>` : x.st === 'abs' ? `<span class="hn-tag hot">결근</span>` : `<span class="hn-tag c5">아직</span>`;
        const tm = x => x.t && x.st === 'in' ? (d => `${pad(d.getHours())}:${pad(d.getMinutes())}`)(new Date(x.t)) : '—';
        L.innerHTML = headL(tagN) + `<div class="hn-sl">${list.slice(0, MAX).map(x => `<div><span class="av" style="background:var(--gx-c${avc(x.s)}b);color:var(--gx-c${avc(x.s)})">${ini(x.s)}</span>
          <span class="nm"><b>${esc(x.s.name)}</b><span>${esc([x.s.position, x.s.dept && x.s.dept !== '전체' ? x.s.dept : ''].filter(Boolean).join(' · ') || ((window.ORGS || {})[x.s.org] || ''))}</span></span>
          <span class="tm">${tm(x)}</span>${tag(x)}</div>`).join('')}</div>${list.length > MAX ? `<div class="hn-dim">외 ${list.length - MAX}명 — 출근부에서 모두 보기</div>` : ''}`;
      }
    }
    if(K) K.innerHTML = kpiInner('교직원 출근', `${n.in}<small> / ${work.length}</small>`, [n.off ? `휴가 ${n.off}` : '', n.none ? `아직 ${n.none}` : '', n.abs ? `결근 ${n.abs}` : ''].filter(Boolean).join(' · ') || '모두 출근했어요', meRow && meRow.st !== 'rest' && meRow.st !== 'none' ? `내 출근 ${esc(meRow.st === 'off' ? offLabel(meRow.sub) : meRow.sub || '')}` : (meRow && meRow.st === 'none' ? '내 출근 아직' : ''));
  }

  /* ── 학기 진행 · D-Day ── */
  async function paintTerm(){
    const box = $I('hn-term'); if(!box) return;
    let T = null, up = [];
    const [r1, r2] = await Promise.allSettled([window.hwTermInfo ? window.hwTermInfo() : null, window.hwUpcoming ? window.hwUpcoming(6) : []]);
    T = r1.status === 'fulfilled' ? r1.value : null; up = r2.status === 'fulfilled' ? r2.value : [];
    up = (up || []).filter(e => e.dn > 0).slice(0, 2);          // 오늘 것은 «오늘 일정»에 — 여기는 앞으로 다가올 것
    const dd = (up || []).map(e => `<a href="academic.html"><span class="hn-tag ${e.dn <= 3 ? 'hot' : 'c1'}">${e.dn === 0 ? '오늘' : 'D-' + e.dn}</span><span>${esc(e.t)}</span><em>${Number(e.d.slice(5, 7))}/${Number(e.d.slice(8, 10))}</em></a>`).join('');
    let body = '';
    if(T && T.state === 'in'){
      if(STY === 'b'){
        const C = 251.3, v = (T.pct / 100 * C).toFixed(1);
        body = `<div class="hn-gauge"><svg viewBox="0 0 200 118" role="img" aria-label="${esc(T.name)} ${T.weeks}주 중 ${T.week}주차, ${T.pct}퍼센트"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--hn-mint)" stroke-width="20" stroke-linecap="round"/>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--hn-green)" stroke-width="20" stroke-linecap="round" stroke-dasharray="${v} ${C}"/></svg>
          <div class="c"><b>${T.pct}%</b><span>${T.week} / ${T.weeks}주</span></div></div>
          <div class="hn-lgl" style="justify-content:center"><span><i style="background:var(--hn-green)"></i>지난 주</span><span><i style="background:var(--hn-mint)"></i>남은 주</span></div>`;
      } else {
        body = `<div class="hn-big"><b>${T.week}</b><span>주차 / ${esc(T.name)} ${T.weeks}주</span></div>
          <div class="hn-pbar" role="img" aria-label="학기 ${T.pct}퍼센트 지남"><i style="width:${T.pct}%"></i></div>`;
      }
    } else if(T && T.state === 'off'){
      body = `<div class="hn-big"><b>D-${T.dn}</b><span>${esc(T.name)} 시작까지</span></div><div class="hn-dim">지금은 학기 사이예요.</div>`;
    } else {
      body = `<div class="hn-dim">학기가 아직 등록되지 않았어요 — 학사일정 › 학기에서 넣으면 보여요.</div>`;
    }
    box.innerHTML = `<div class="hn-h"><h2>학기 진행</h2>${T && T.state === 'in' ? `<span class="hn-sp"></span><span class="hn-dim">끝까지 ${T.left}일</span>` : ''}</div>${body}${dd ? `<div class="hn-dd">${dd}</div>` : ''}`;
  }

  /* ── B: 최근 10일 ── */
  let HIST = null, _histP = null, _histKey = '';
  async function loadHist(){
    const key = ymd(new Date()) + '|' + (((window.__attOrgs && window.__attOrgs()) || []).join(','));
    if(!_histP || _histKey !== key){ _histKey = key; _histP = (window.hwAttHistory ? window.hwAttHistory(10) : Promise.resolve([])).catch(() => { _histP = null; return []; }); }
    HIST = await _histP; paintHist();
  }
  function paintHist(){
    const box = $I('hn-hist'); if(!box || !HIST) return;
    const head = `<div class="hn-h"><h2>최근 10일 · 결석 + 지각</h2><span class="hn-sp"></span><span class="hn-dim">명 · 적을수록 좋아요</span></div>`;
    if(!HIST.length){ box.innerHTML = head + emptyArt('pot', '최근 수업일 기록이 없어요.'); return; }
    const S = attSum();
    const days = HIST.map(d => (d.today && S && !S.off && !S.empty) ? { ...d, abs: S.abs, lat: S.lat } : d);
    const mx = Math.max(1, ...days.map(d => d.abs + d.lat));
    const DOW = ['일', '월', '화', '수', '목', '금', '토'];
    box.innerHTML = head + `<div class="hn-bars" role="img" aria-label="최근 수업일 결석과 지각: ${days.map(d => `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))} ${d.abs + d.lat}명`).join(', ')}">
      ${days.map(d => { const v = d.abs + d.lat; return `<div class="${d.today ? 'on' : ''}" title="${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))} · 결석 ${d.abs} · 지각 ${d.lat}"><span class="v">${v}</span><div class="p"><i style="height:${Math.round(v / mx * 100)}%"></i></div><span class="d">${d.today ? '오늘' : DOW[new Date(d.date + 'T00:00:00').getDay()]}</span></div>`; }).join('')}</div>
      <div class="hn-foot"><a href="attend.html">출석부 › 통계</a></div>`;
  }

  /* ── B: 다음 일정 ── */
  async function paintNext(){
    const box = $I('hn-next'); if(!box) return;
    const now = nowMin();
    const nx = SCHED.find(x => x.m >= 0 && (x.end != null ? x.end : x.m + 50) > now && x.m >= now - 10) || null;
    const after = nx ? SCHED.filter(x => x !== nx && x.m > nx.m)[0] : null;
    let h = `<div class="hn-h"><h2>다음 일정</h2></div>`;
    if(nx){
      h += `<span class="hn-dim" style="font-weight:700">${nx.m <= now ? '지금 · ' : ''}${esc(nx.t)}${nx.end != null ? ` – ${hhmm(nx.end)}` : ''}</span>
        <div class="hn-nx-t">${esc(nx.title)}</div>${nx.sub ? `<div class="hn-nx-m">${esc(nx.sub)}</div>` : ''}
        <a class="hn-nx-go" href="${nx.k === 'tt' ? 'timetable-final.html' : 'academic.html'}">${MS(nx.k === 'tt' ? 'schedule' : 'calendar_month')}${nx.k === 'tt' ? '시간표 열기' : '학사일정 열기'}</a>
        ${after ? `<div class="hn-nx-s">그다음 ${esc(after.t)} ${esc(after.title)}</div>` : ''}`;
    } else {
      let up = []; try{ up = window.hwUpcoming ? await window.hwUpcoming(2) : []; }catch(e){}
      const e = (up || []).find(x => x.dn > 0) || (up || [])[0];
      if(e) h += `<span class="hn-dim" style="font-weight:700">${Number(e.d.slice(5, 7))}/${Number(e.d.slice(8, 10))} · ${e.dn === 0 ? '오늘' : 'D-' + e.dn}</span><div class="hn-nx-t">${esc(e.t)}</div>
        <div class="hn-nx-m">오늘 남은 일정은 없어요.</div><a class="hn-nx-go" href="academic.html">${MS('calendar_month')}학사일정 열기</a>`;
      else h += emptyArt('cal', '다가오는 일정이 없어요.') + `<a class="hn-nx-go" href="academic.html">${MS('calendar_month')}학사일정 열기</a>`;
    }
    box.innerHTML = h;
  }

  /* ── B: 숫자 카드 ── */
  function kpiInner(h, v, s, tag){
    return `<span class="kh"><span>${h}</span><span class="kgo">${MS('arrow_outward')}</span></span><span class="kv">${v}</span>${s ? `<span class="ks">${s}</span>` : ''}${tag ? `<span class="hn-tag kt">${tag}</span>` : ''}`;
  }
  function kpisHTML(){
    const n = window.__notif || {};
    const art = `<svg class="kart" viewBox="0 0 300 170" aria-hidden="true"><path d="M0 140 C60 100 110 170 170 120 S260 80 300 110" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="22"/><path d="M20 170 C80 130 130 190 190 150 S270 120 310 140" fill="none" stroke="#00704A" stroke-opacity="0.55" stroke-width="16"/></svg>`;
    const out = [];
    if(P.attendOk) out.push(`<a class="hn-kpi pri" href="attend.html?stat=live">${art}<span id="hn-k-att" style="display:contents">${kpiInner('오늘 출석', '…', '', '')}</span></a>`);
    else { const k = todoItems().filter(x => x.v > 0).length;
      out.push(`<a class="hn-kpi pri" href="#hn-todo">${art}${kpiInner('지금 할 일', `${k}<small style="color:var(--hn-pri-sub)"> 가지</small>`, k ? '아래 «지금 할 일»에서 바로' : '모두 처리했어요', '')}</a>`); }
    if(P.approvalOk) out.push(`<a class="hn-kpi" href="approval.html">${kpiInner('결재 기다림', `${(n.approvalCnt || 0) + (n.payCnt || 0)}<small> 건</small>`, `전자결재 ${n.approvalCnt || 0} · 경비 결재 ${n.payCnt || 0}`, n.payWaitCnt ? `지급 대기 ${n.payWaitCnt}건` : '')}</a>`);
    else out.push(`<a class="hn-kpi" href="minutes.html?mine=1">${kpiInner('회의에서 맡은 일', `${n.mtgCnt || 0}<small> 건</small>`, '진행 전 · 진행 중', '')}</a>`);
    out.push(`<a class="hn-kpi" href="message.html">${kpiInner('안 읽은 쪽지', `${n.msgCnt || 0}<small> 통</small>`, `새 글 · 댓글 ${(n.newPostCnt || 0) + (n.boardCnt || 0)}`, '')}</a>`);
    out.push(`<a class="hn-kpi" href="checkin.html"><span id="hn-k-stf" style="display:contents">${kpiInner('교직원 출근', '…', '', '')}</span></a>`);
    return out.join('');
  }

  /* ── B: 이번 달 생일 (교직원) ── */
  function bdList(){
    const { STAFF_CACHE } = G();
    const d = new Date(), mm = pad(d.getMonth() + 1), dd = d.getDate();
    return Object.values(STAFF_CACHE || {}).filter(s => s && s.birth && String(s.birth).slice(5, 7) === mm && (s.acStatus || 'active') === 'active')
      .map(s => ({ s, day: Number(String(s.birth).slice(8, 10)) || 0 })).filter(x => x.day)
      .sort((a, b) => a.day - b.day).map(x => ({ ...x, dn: x.day - dd }));
  }
  function bdHTML(){
    const L = bdList();
    if(!L.length) return emptyArt('basket', '이번 달 생일인 선생님이 없어요.');
    const m = new Date().getMonth() + 1;
    const up = L.filter(x => x.dn >= 0), past = L.filter(x => x.dn < 0);
    const show = up.concat(past).slice(0, 4);
    return `<div class="hn-bdl">${show.map(x => `<div class="${x.dn < 0 ? 'past' : ''}"><span class="av">${ini(x.s)}</span><span class="nm"><b>${esc(x.s.name)} 선생님</b><span>${m}월 ${x.day}일 · ${x.dn === 0 ? '오늘 🎂' : x.dn > 0 ? `${x.dn}일 뒤` : '지남'}</span></span></div>`).join('')}</div>
      ${L.length > 4 ? `<div class="hn-dim">외 ${L.length - 4}명</div>` : ''}
      ${up.some(x => x.s.uid !== ((G().CU || {}).uid)) ? `<button class="hn-pill ghost" type="button" style="margin-top:auto;justify-content:center" onclick="HN.bdMsg()">${MS('mail')}축하 쪽지 보내기</button>` : ''}`;
  }

  /* ── 자주 여는 방 · 더 보기 ── */
  function roomsHTML(){
    const q = P.block('quick');
    if(q) return `<section class="hm-b hn-rooms" data-k="quick">${q}</section>`;
    return `<section class="hn-rooms">${window.allRoomsHTML ? window.allRoomsHTML() : ''}</section>`;
  }
  const MORE = [
    { k: 'notice', l: '공지사항', i: 'campaign', own: '<div id="home-notice"><div class="hn-dim">불러오는 중…</div></div>', nohead: 1 },
    { k: 'bday', l: '이번 달 생일', i: 'cake', own: '<div id="home-birthday"><div class="hn-dim">불러오는 중…</div></div>', nohead: 1 },
    { k: 'sched', l: '학사일정', i: 'calendar_month', own: '<div id="home-schedule"><div class="hn-dim">불러오는 중…</div></div>', wide: 1, nohead: 1 },
    { k: 'attend', l: '출결 자세히', i: 'fact_check', w: 'attend', wide: 1 },
    { k: 'mtg', l: '회의에서 맡은 일', i: 'edit_note', w: 'mtg' },
    { k: 'club', l: '동아리 실황', i: 'palette', w: 'club', wide: 1 },
    { k: 'tt', l: '내 시간표', i: 'schedule', w: 'tt', head: 1 },
    { k: 'chk', l: '오늘 할 일', i: 'checklist', w: 'chk', bare: 1 },
    { k: 'memo', l: '메모 · 포스트잇', i: 'sticky_note_2', w: 'memo', bare: 1 },
    { k: 'wx', l: '날씨', i: 'partly_cloudy_day', w: 'wx', bare: 1 },
    { k: 'world', l: '세계 시계', i: 'public', w: 'world', wide: 1, bare: 1 },
    { k: 'fav', l: '즐겨찾기', i: 'bookmark', w: 'fav', bare: 1 },
    { k: 'dday', l: 'D-Day', i: 'event', w: 'dday', bare: 1 },
    { k: 'boards', l: '게시판', i: 'forum', own: '<div id="home-boards"></div>', wide: 1 },
  ];
  let MORE_ON = [];
  function moreHTML(){
    const open = LS.get(moreKey(), []);
    const items = MORE.map(m => ({ ...m, body: m.own || P.block(m.w) })).filter(m => m.body);
    MORE_ON = items.map(m => m.k);
    const bar = items.map(m => { const on = open.includes(m.k);
      return `<button type="button" class="hn-mc${on ? ' on' : ''}" data-p="${m.k}" aria-expanded="${on}" aria-controls="hn-p-${m.k}" onclick="HN.toggleMore('${m.k}')">${MS(m.i)}${esc(m.l)}<span class="hn-mb" data-b="${m.k}"></span></button>`; }).join('');
    const pans = items.map(m => `<section class="hn-pn hm-b${m.wide ? ' wide' : ''}${m.bare ? ' bare' : ''}" id="hn-p-${m.k}" data-k="${m.w || m.k}" data-p="${m.k}"${open.includes(m.k) ? '' : ' hidden'}>
        ${(m.own && !m.nohead) || m.head ? `<div class="hn-pnh">${MS(m.i)}${esc(m.l)}</div>` : ''}${m.body}</section>`).join('');
    return `<section class="hn-more" aria-label="더 보기"><div class="hn-h"><h2>더 보기</h2><span class="hn-note">누르면 펼쳐요 · 펼친 것은 기억해 둬요</span></div>
      <div class="hn-mbar">${bar}</div><div class="hn-mpans">${pans}</div></section>`;
  }
  function toggleMore(k, force){
    const pn = $I('hn-p-' + k); if(!pn) return;
    const on = force != null ? !!force : pn.hidden;
    pn.hidden = !on;
    document.querySelectorAll(`.hn-mc[data-p="${k}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-expanded', String(on)); });
    let open = LS.get(moreKey(), []).filter(x => x !== k); if(on) open.push(k); LS.set(moreKey(), open);
    if(on){
      // 숨어 있던 칸은 펼칠 때 다시 맞춘다 (세계 시계 칸 수 · 날씨)
      try{ if(k === 'world' && window.renderWorld) window.renderWorld(); }catch(e){}
      try{ window.dispatchEvent(new Event('resize')); }catch(e){}
    }
    return on;
  }
  function openMore(k){
    if(!MORE_ON.includes(k)) return;
    toggleMore(k, true);
    const pn = $I('hn-p-' + k); if(pn) try{ pn.scrollIntoView({ behavior: 'smooth', block: 'start' }); }catch(e){ pn.scrollIntoView(); }
  }

  /* ── 인사 줄 · 시계 · 날씨 · 달 ── */
  function paintSum(){
    const el = $I('hn-sum'); if(!el) return;
    const k = todoItems().filter(x => x.v > 0 && x.l !== '내 할 일').length;
    const s = SCHED.length;
    const S = attSum();
    const bits = [];
    bits.push(k ? `처리할 일 <b>${k}가지</b>` : '처리할 일은 <b>없어요</b>');
    if(s) bits.push(`오늘 일정 <b>${s}개</b>`);
    if(S && !S.off && !S.empty) bits.push(`출석 <b>${S.rate}%</b>`);
    el.innerHTML = bits.join(' · ') + (P && P.orgLine ? `<br><span style="font-size:13px">${esc(P.orgLine)}</span>` : '');
  }
  function tick(){
    const d = new Date(), t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const a = $I('hn-time'), b = $I('hn-time2');
    if(!a && !b){ clearInterval(CLOCK); CLOCK = null; return; }
    if(a) a.textContent = t; if(b) b.textContent = t;
    const art = document.querySelector('.hn .hn-art'); if(art && art.dataset.tod !== tod()){ art.dataset.tod = tod(); art.innerHTML = artHTML(tod()); }
  }
  function paintWx(){
    const { WX_DATA, WX_PLACE, WX_LIST } = G();
    const c = WX_DATA && WX_DATA.current; const a = $I('hn-wx'), b = $I('hn-wx2');
    if(!c){ if(a) a.hidden = true; if(b) b.textContent = ''; return; }
    const place = ((WX_LIST || []).find(v => v.key === WX_PLACE) || {}).name || '';
    const code = (ctx.WX_CODE || {})[c.weather_code] || ['', ''];
    const tmp = Math.round(Number(c.temperature_2m));
    const txt = `${place} ${isFinite(tmp) ? tmp + '°' : ''} ${code[0] || ''}`.replace(/\s+/g, ' ').trim();
    if(a){ a.hidden = !txt; a.innerHTML = `${MS('partly_cloudy_day')}${esc(txt)}`;
      if(MORE_ON.includes('wx') && a.tagName !== 'BUTTON'){ const bt = document.createElement('button'); bt.type = 'button'; bt.id = 'hn-wx'; bt.className = 'hn-chip'; bt.title = '날씨 자세히 — 더 보기'; bt.innerHTML = a.innerHTML; bt.onclick = () => openMore('wx'); a.replaceWith(bt); } }
    if(b) b.textContent = txt ? ` · ${txt}` : '';
  }
  function paintMoon(){
    const el = $I('hn-moon'), lu = $I('hn-lunar');
    try{
      const now = new Date();
      if(lu && ctx.solarToLunar){ const L = ctx.solarToLunar(now); lu.textContent = ` · 음력 ${L.isLeap ? '윤 ' : ''}${L.month}월 ${L.day}일`; }
      if(el && ctx.moonPhase && ctx.moonName){ el.hidden = false; el.innerHTML = `${MS('dark_mode')}${esc(ctx.moonName(ctx.moonPhase(now)))}`; }
    }catch(e){}
  }

  /* ── 쪽지 쓰기 · 생일 축하 (쪽지함이 채워 둔 새 쪽지를 엶) ── */
  function compose(to, subject, body){
    try{ sessionStorage.setItem('gyosa_compose', JSON.stringify({ t: Date.now(), to: to || [], subject: subject || '', body: body || '' })); }catch(e){}
    location.href = 'message.html';
  }
  function bdMsg(){
    const me = (G().CU || {}).uid;
    const L = bdList().filter(x => x.dn >= 0 && x.s.uid !== me); if(!L.length) return;
    const first = L[0].dn, who = L.filter(x => x.dn === first).map(x => x.s);
    compose(who.map(s => s.uid).filter(Boolean), '생일 축하해요 🎂', `${who.map(s => s.name + ' 선생님').join(', ')}, 생일 축하해요!\n`);
  }

  /* ── 다 그린 뒤 ── */
  function after(sty){
    if(!WIRED){
      WIRED = true;
      document.addEventListener('hw:att', () => { if($I('hn-att') || $I('hn-k-att')) paintAtt(); });
      document.addEventListener('hw:mtg', () => { if($I('hn-todo')) paintTodo(); });
    }
    clearInterval(CLOCK); CLOCK = setInterval(tick, 15000); tick();
    paintMoon(); paintWx(); paintTodo(); paintAtt(); paintStaff(); paintTerm(); paintSched();
    if(sty === 'b' && P.attendOk) loadHist();
    if(!LEADCHK){ LEADCHK = true;
      setTimeout(() => { try{ const cu = G().CU; if(cu && STY !== 'classic' && defaultStyle(cu) !== STY && !((window.__homeAccStyle && window.__homeAccStyle()))) window.renderHome && window.renderHome(); }catch(e){} }, 5000); }
  }
  let LEADCHK = false;

  const api = { css, html, after, defaultStyle, styleOf, STYLES, STYLE_INFO, paintTodo, paintSched, paintWx, paintAtt, paintStaff, toggleMore, openMore, compose, bdMsg,
    artFail, artSVG, season, artKey, ART_SEASONS, style: () => STY };
  window.HN = api;
  return api;
}
