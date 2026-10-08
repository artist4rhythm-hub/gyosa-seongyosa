/* ═══ 🧭 도우미 (v-113) ═══
   선생님이 «어떻게 하지?» 싶을 때 사용 방법을 번호 순서대로 알려 주는 앱 안 도움말.
   · 자료: help.json — 사용 설명서와 같은 내용. 처음 열 때 한 번만 받는다 (인터넷 AI를 부르지 않음 → 비용 없음 · 학생 정보가 밖으로 나가지 않음)
   · 여는 곳: PC 위쪽 «🧭 도우미» · 어느 화면에서나 ⌘K / Ctrl+K · 폰은 아래 탭 위 동그란 🧭 단추 · 처음 한 번 말풍선
   · 권한별로 숨기지 않는다 — 권한이 필요한 일에는 «보는 건 누구나 · 실제 저장·수정·적용은 ○○만» 한 줄 + 권한 요청
   · «화면에서 같이 하기»: 실제 단추를 금색 테두리로 짚으며 한 단계씩. 단추를 눌러 화면이 바뀌어도 이어서 한다.
     짚을 단추가 내 화면에 없으면 (대개 권한 없음) 멈추고 안내.
   · «관리자에게 물어보기 / 권한 요청»: 쪽지 화면에 받는 사람·제목·내용을 채워 연다 (보내기는 선생님이 직접 누른다)
   sidebar.js 의 renderShell 이 이 파일을 한 번 불러온다. 이 파일의 오류가 화면을 깨지 않도록 모두 감싸 둔다. */
(function(){
  'use strict';
  if(window.__helperOn) return;
  window.__helperOn = true;

  const TOUR_KEY = 'gyosa_help_tour';        // sessionStorage · 같이 하기 진행 (화면을 옮겨도 이어감)
  const TIP_KEY  = 'gyosa_help_tip1';        // localStorage   · 처음 한 번 말풍선을 보였는지
  const MAIL_KEY = 'gyosa_help_compose';     // sessionStorage · 쪽지 미리 채우기 (message.html 이 읽는다)
  const TOUR_TTL = 20 * 60 * 1000;           // 같이 하기를 20분 넘게 멈춰 두면 이어 하지 않는다

  let HELP = null, loading = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const lab = s => esc(s).replace(/«([^»]+)»/g, '<b class="hp-k">$1</b>');
  const pageOf = p => (String(p || '').split('?')[0].split('#')[0]) || 'index.html';
  const here = () => pageOf(location.pathname.split('/').pop() || 'index.html');
  const me = () => { try { return (typeof SB_USER !== 'undefined' && SB_USER) || null; } catch(_){ return null; } };
  const isSuper = () => (me() || {}).role === 'super';
  const phone = () => { try { return matchMedia('(max-width:768px)').matches; } catch(_){ return innerWidth <= 768; } };
  const ss = { get(k){ try { return sessionStorage.getItem(k); } catch(_){ return null; } }, set(k, v){ try { sessionStorage.setItem(k, v); } catch(_){} }, del(k){ try { sessionStorage.removeItem(k); } catch(_){} } };
  const ls = { get(k){ try { return localStorage.getItem(k); } catch(_){ return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch(_){} } };

  /* 받침에 맞춘 조사 — «출석부로» «학생관리로» «홈으로» */
  function ro(w){ const c = String(w).trim().slice(-1).charCodeAt(0);
    if(!(c >= 0xAC00 && c <= 0xD7A3)) return w + '(으)로';
    const j = (c - 0xAC00) % 28; return w + (j === 0 || j === 8 ? '로' : '으로'); }

  const EXTRA_PAGES = { 'index.html':'홈', 'install-guide.html':'설치 안내', 'timetable.html':'시간표', 'schedule-assign.html':'시간표 배정', 'parent-admin.html':'학부모 관리' };
  function pageName(p){
    p = pageOf(p);
    const it = (window.menuAllItems ? menuAllItems() : []).find(i => i.href === p);
    return it ? it.label : (EXTRA_PAGES[p] || '그 화면');
  }

  /* 누구나 하는 일인지 (= «누가»가 모든 교직원/선생님·교직원 누구나로 시작) — 아니면 권한 안내를 붙인다 */
  const isOpen = a => /^(모든 (교직원|선생님)|교직원 누구나)/.test(a.who || '');

  const ICON = { '처음 시작하기':'👋', '홈':'🏠', '메뉴·화면':'🧭', '내 정보':'👤', '공통 기능':'🧰', '기관·연합':'🏫',
    '학생관리':'👩‍🎓', '출석부':'✅', '반편성':'🧩', '학사일정':'📅', '구글 캘린더':'🗓️', '회의록':'📝', '연혁':'📚',
    '동아리':'🎨', '동아리 현황':'📊', '증명서 발급':'📄', '출근부':'🕘', '교직원 명부':'📇', '근무시간':'⏱️', '전자결재':'✍️',
    '시간표':'🗂️', '경비 지급 요청서':'💳', '수행성 경비':'🐷', '활동 경비':'🎒', '공사 경비':'🏗️', '쪽지':'✉️', '게시판':'📌',
    '가정통신문':'📮', '학부모':'👪', '관리자':'🛠️', '홈페이지 관리':'🌐', '공유 링크':'🔗' };
  const iconOf = a => ICON[a.cat] || '📘';

  /* ═══ 찾기 — 띄어쓰기·조사 무시 · 비슷한 말 · 오타 조금 · 지금 화면 우대 ═══ */
  const SYN = { '비번':['비밀번호'], '암호':['비밀번호'], '돈':['경비'], '영수증':['경비','영수증'], '결석':['출결'], '지각':['출결'], '조퇴':['출결'],
    '아이':['학생'], '애들':['학생'], '아이들':['학생'], '쉬는':['휴학'], '쉬는학생':['휴학'], '선생님':['교직원'], '샘':['교직원'],
    '고치기':['수정'], '고치':['수정'], '바꾸기':['수정','변경'], '지우기':['삭제'], '없애기':['삭제'], '만들기':['추가','등록'],
    '출결':['출석'], '출석':['출결'], '결재':['전자결재'], '공지':['게시판','공지'], '메세지':['쪽지'], '메시지':['쪽지'], '문자':['쪽지'],
    '프린트':['인쇄'], '엑셀':['엑셀','내려받기'], '다운':['내려받기'], '다운로드':['내려받기'], '사진':['사진','이미지'] };
  const TAIL = /(을|를|이|가|은|는|에서|에게|한테|으로|로|에|의|도|만|좀|하기|하려면|하는법|하는방법|방법|어떻게|해요|하나요|되나요|돼요|안돼요|안되요|안돼|안보여요|안보임|싶어요|할래요|하고|해야|하죠)$/;
  const norm = s => String(s || '').toLowerCase().replace(/[\s·«»()\[\]{}.,!?~'"“”‘’\-_/:;|]+/g, '');
  function groups(q){
    return String(q || '').split(/\s+/).map(norm).filter(Boolean).map(t => {
      let x = t; for(let i = 0; i < 2; i++) x = x.replace(TAIL, ''); x = x || t;
      const alt = [x]; (SYN[x] || SYN[t] || []).forEach(s => { if(!alt.includes(s)) alt.push(s); });
      return alt;
    });
  }
  function prep(a){
    a._T = norm(a.title); a._Q = norm((a.q || []).join('|')); a._C = norm(a.cat) + '|' + norm(a.tab);
    a._S = norm((a.steps || []).join('|')); a._P = norm((a.tips || []).join('|'));
  }
  function field(a, t){
    let s = 0;
    if(a._T.includes(t)) s += 6; if(a._Q.includes(t)) s += 5; if(a._C.includes(t)) s += 3;
    if(a._S.includes(t)) s += 1.5; if(a._P.includes(t)) s += .8;
    if(!s && t.length >= 3){            // 비슷한 글자 (두 글자씩 겹치는 정도)
      const g = []; for(let i = 0; i < t.length - 1; i++) g.push(t.slice(i, i + 2));
      const m = g.filter(x => a._T.includes(x) || a._Q.includes(x)).length / g.length;
      if(m >= .5) s += 3 * m;
    }
    return s;
  }
  function score(a, gs, whole){
    let sc = 0, hit = 0;
    gs.forEach(alt => { let best = 0;
      alt.forEach((t, i) => { const v = field(a, t) * (i ? .85 : 1); if(v > best) best = v; });
      if(best) hit++; sc += best; });
    if(hit < gs.length) sc *= hit / gs.length * .6;
    if(whole.length >= 3 && (a._T.includes(whole) || a._Q.includes(whole))) sc += 4;
    if(pageOf(a.page) === here()) sc *= 1.25;
    return sc;
  }
  function visible(){ return (HELP || []).filter(a => !a.only || (a.only === 'super' && isSuper())); }
  function search(q){
    const gs = groups(q); if(!gs.length) return [];
    const whole = norm(q);
    const r = visible().map(a => [a, score(a, gs, whole)]).filter(x => x[1] > 1).sort((x, y) => y[1] - x[1]);
    const top = r.length ? r[0][1] : 0;
    return r.filter(x => x[1] >= top * .3).map(x => x[0]);
  }
  function hl(s, q){
    let h = esc(s);
    groups(q).forEach(alt => alt.forEach(t => { if(t.length < 2) return;
      const re = new RegExp(t.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s?'), 'g');
      h = h.replace(re, m => `<mark>${m}</mark>`); }));
    return h;
  }
  /* 화면 바로 가기 — 내가 볼 수 있는 메뉴만 */
  function menuHits(q){
    const gs = groups(q); if(!gs.length) return [];
    let items = [];
    try { items = (typeof sbVisibleGroups === 'function' ? sbVisibleGroups() : []).flatMap(g => g.items.map(it => ({ ...it, group:g.group }))); } catch(_){}
    return items.filter(it => /\.html/.test(it.href) && gs.some(alt => alt.some(t => t.length >= 2 && norm(it.label + '|' + (it.desc || '') + '|' + (it.tabs || []).join('|')).includes(t)))).slice(0, 3);
  }

  function load(){
    if(HELP) return Promise.resolve(HELP);
    if(loading) return loading;
    loading = fetch('help.json?v=' + encodeURIComponent(window.__APPVER || ''), { cache:'no-cache' })
      .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(j => { HELP = (j.items || j || []); HELP.forEach(prep); return HELP; })
      .catch(e => { loading = null; throw e; });
    return loading;
  }
  const byId = id => (HELP || []).find(a => a.id === id);

  /* ═══ 모양 ═══ */
  const CSS = `
:root{--hp-perm-bg:#F4F7FB;--hp-perm-ln:#D6E0EC;--hp-perm-tx:#2B4A6B;--hp-perm-ic:#E3EAF3;--hp-tip-bg:#FFFBEA;--hp-tip-ln:#F1E2B0;--hp-tip-tx:#8A6410;--hp-mark:#FFF1B8;--hp-gold:#F5C542}
html[data-theme="dark"]{--hp-perm-bg:#132131;--hp-perm-ln:#27405C;--hp-perm-tx:#A9CBF2;--hp-perm-ic:#1B3048;--hp-tip-bg:#2A2416;--hp-tip-ln:#4A3F22;--hp-tip-tx:#E3C878;--hp-mark:#5C4B12}
#hp-fab{display:none;position:fixed;right:14px;bottom:calc(var(--tab-h) * var(--zoom) + 14px + env(safe-area-inset-bottom));z-index:52;width:52px;height:52px;border:0;border-radius:50%;
  background:linear-gradient(135deg,#00704A,#1E3932);color:#fff;font-size:24px;line-height:1;box-shadow:0 8px 22px rgba(30,57,50,.34);cursor:pointer;
  align-items:center;justify-content:center;transition:transform .22s ease,opacity .22s ease;-webkit-tap-highlight-color:transparent}
#hp-fab.hide{transform:translateY(90px);opacity:0;pointer-events:none}
@media(max-width:768px){#hp-fab{display:flex}}
body.share-mode #hp-fab,body.share-mode #hp-tip{display:none!important}
html.hp-open #hp-fab{opacity:0;pointer-events:none}

#hp-scrim{position:fixed;inset:0;z-index:100090;background:rgba(10,20,15,.42);display:none}
#hp{position:fixed;top:0;right:0;bottom:0;width:min(430px,94vw);z-index:100100;background:var(--bg);box-shadow:-14px 0 44px rgba(20,40,32,.22);
  border-left:1px solid var(--ivd);display:flex;flex-direction:column;transform:translateX(105%);transition:transform .24s ease;font-family:inherit;color:var(--ink)}
html.hp-open #hp{transform:none}
@media(max-width:768px){
  #hp{top:auto;left:0;right:0;width:auto;height:86vh;height:86dvh;border-left:0;border-radius:22px 22px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.25);transform:translateY(105%);overflow:hidden}
  html.hp-open #hp-scrim{display:block}
}
.hp-hd{background:linear-gradient(150deg,#10241D 0%,#1E3932 60%,#245046 100%);color:#fff;padding:18px 20px 18px;flex:none}
.hp-grab{display:none;width:42px;height:5px;border-radius:9px;background:rgba(255,255,255,.35);margin:-4px auto 12px;border:0;padding:0;cursor:pointer}
@media(max-width:768px){.hp-grab{display:block}.hp-hd{padding:14px 16px 16px}}
.hp-ttl{display:flex;align-items:center;gap:10px}
.hp-logo{width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}
.hp-ttl b{display:block;font-size:17px;font-weight:900;letter-spacing:-.2px}
.hp-ttl small{display:block;font-size:11.5px;opacity:.72;margin-top:2px}
.hp-x{margin-left:auto;width:32px;height:32px;border:0;border-radius:9px;background:rgba(255,255,255,.12);color:#fff;font-size:14px;cursor:pointer;flex:none;font-family:inherit}
.hp-x:hover{background:rgba(255,255,255,.22)}
.hp-q{display:flex;align-items:center;gap:9px;background:var(--wh);border:2px solid transparent;border-radius:14px;padding:0 8px 0 14px;height:48px;margin-top:15px;box-shadow:0 4px 14px rgba(0,0,0,.12)}
.hp-q:focus-within{border-color:var(--hp-gold)}
.hp-q input{flex:1;border:0;outline:none;font:600 15px/1.2 inherit;font-family:inherit;background:none;color:var(--ink);min-width:0}
.hp-q input::placeholder{color:var(--tl);font-weight:500}
#hp .hp-q input,#hp .hp-q input:focus{border:0!important;box-shadow:none!important;background:transparent!important;padding:0!important;height:auto!important;color:var(--ink)!important}
.hp-q .ic{font-size:16px;flex:none}
.hp-clr{border:0;background:var(--iv);color:var(--ts);width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:11px;flex:none;display:none;font-family:inherit}
.hp-q.has .hp-clr{display:block}.hp-q.has .hp-kbd{display:none}
.hp-kbd{font-size:11px;color:var(--tl);font-weight:800;border:1px solid var(--ivd);border-radius:6px;padding:3px 6px;flex:none;margin-right:4px}
@media(max-width:768px){.hp-kbd{display:none}}
.hp-bd{flex:1;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.hp-z{zoom:var(--zoom);padding:6px 18px 28px}
@media(max-width:768px){.hp-z{padding:4px 14px calc(24px + env(safe-area-inset-bottom))}}
.hp-sec{font-size:12px;font-weight:900;color:var(--gm);margin:16px 2px 8px;display:flex;align-items:center;gap:6px}
.hp-back{display:inline-flex;align-items:center;gap:5px;font:800 12.5px/1 inherit;font-family:inherit;color:var(--gm);margin:14px 2px 12px;background:none;border:0;padding:4px 0;cursor:pointer}
.hp-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 12px;border-radius:12px;border:1px solid var(--ivd);background:var(--wh);margin-bottom:7px;cursor:pointer;font-family:inherit;color:inherit}
.hp-row:hover,.hp-row.on{border-color:var(--gm);box-shadow:0 0 0 3px rgba(0,112,74,.12)}
.hp-row .ic{width:30px;height:30px;border-radius:9px;background:var(--gp);display:flex;align-items:center;justify-content:center;font-size:15px;flex:none}
.hp-row .tx{min-width:0;flex:1}
.hp-row b{display:block;font-size:13.5px;font-weight:800;color:var(--gd);line-height:1.4}
.hp-row span.m{display:block;font-size:11px;color:var(--tl);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hp-row .go{color:var(--gm);font-weight:900;flex:none}
.hp-sug{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.hp-sug button{font:700 12px/1 inherit;font-family:inherit;color:var(--ts);background:var(--wh);border:1px solid var(--ivd);border-radius:100px;padding:7px 11px;cursor:pointer}
.hp-sug button:hover{border-color:var(--gm);color:var(--gm)}
.hp-cats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.hp-cats button{background:var(--wh);border:1px solid var(--ivd);border-radius:12px;padding:10px 4px 9px;text-align:center;font:800 11.5px/1.3 inherit;font-family:inherit;color:var(--gd);cursor:pointer;word-break:keep-all}
.hp-cats button:hover{border-color:var(--gm)}
.hp-cats i{display:block;font-style:normal;font-size:19px;margin-bottom:4px}
.hp-cats em{display:block;font-style:normal;font-size:10px;color:var(--tl);font-weight:700;margin-top:2px}
.hp-ask{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--iv);border:1px dashed var(--gl);border-radius:12px;padding:12px 13px;margin-top:14px;font:500 12.5px/1.5 inherit;font-family:inherit;color:var(--ts);cursor:pointer}
.hp-ask b{color:var(--gm)}
.hp-empty{text-align:center;padding:26px 10px 8px;color:var(--ts);font-size:13px;line-height:1.7}
.hp-empty i{display:block;font-style:normal;font-size:30px;margin-bottom:6px}
.hp-card{background:var(--wh);border:1px solid var(--ivd);border-radius:16px;padding:18px 18px 16px}
.hp-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.hp-cat{font-size:10.5px;font-weight:800;color:var(--gm);background:var(--gp);border-radius:100px;padding:3px 9px}
.hp-who{font-size:11px;font-weight:800;color:var(--hp-tip-tx);background:var(--goldp);border-radius:100px;padding:3px 9px}
.hp-h{font-size:19px;font-weight:900;color:var(--gd);margin:0 0 14px;letter-spacing:-.3px;line-height:1.4}
.hp-perm{display:flex;gap:10px;align-items:flex-start;background:var(--hp-perm-bg);border:1px solid var(--hp-perm-ln);border-radius:12px;padding:10px 12px;margin:0 0 16px;font-size:12.5px;line-height:1.6;color:var(--ts)}
.hp-perm .lk{flex:none;width:26px;height:26px;border-radius:8px;background:var(--hp-perm-ic);display:flex;align-items:center;justify-content:center;font-size:13px}
.hp-perm b{color:var(--hp-perm-tx)}
.hp-perm button{border:0;background:none;padding:0;color:var(--gm);font:800 12.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}
.hp-steps{list-style:none;margin:0;padding:0;counter-reset:s}
.hp-steps li{counter-increment:s;position:relative;padding:0 0 14px 40px;font-size:14px;line-height:1.65;color:var(--ink)}
.hp-steps li::before{content:counter(s);position:absolute;left:0;top:0;width:27px;height:27px;border-radius:50%;background:var(--gm);color:#fff;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center}
.hp-steps li:not(:last-child)::after{content:'';position:absolute;left:13px;top:30px;bottom:2px;width:1.5px;background:var(--gl)}
.hp-k{display:inline;background:var(--gp);color:var(--gd);border:1px solid var(--gl);border-radius:6px;padding:0 5px;margin:0 1px;font-weight:800;line-height:1.55;-webkit-box-decoration-break:clone;box-decoration-break:clone}
#hp mark,#hp-bub mark{background:var(--hp-mark);color:inherit;border-radius:3px;padding:0 1px}
.hp-tips{background:var(--hp-tip-bg);border:1px solid var(--hp-tip-ln);border-radius:12px;padding:11px 14px;margin-top:4px}
.hp-tips>b{font-size:12px;color:var(--hp-tip-tx)}
.hp-tips p{font-size:12.5px;line-height:1.6;color:var(--ts);margin:5px 0 0}
.hp-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.hp-btn{border:0;border-radius:10px;padding:11px 14px;font:800 13px/1 inherit;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.hp-btn.pr{background:var(--gm);color:#fff}
html[data-theme="dark"] .hp-btn.pr{color:#06130E}
.hp-btn.sc{background:var(--wh);color:var(--gd);border:1.5px solid var(--ivd)}
.hp-btn:disabled{opacity:.45;cursor:default}
.hp-fb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px dashed var(--ivd);font-size:12.5px;color:var(--tl)}
.hp-fb button{border:1px solid var(--ivd);background:var(--wh);border-radius:100px;padding:7px 11px;font:700 12px inherit;font-family:inherit;color:var(--ts);cursor:pointer}
.hp-fb button:hover{border-color:var(--gm);color:var(--gm)}
.hp-fbok{font-size:12.5px;font-weight:800;color:var(--gm)}

/* 처음 한 번 말풍선 */
#hp-tip{position:fixed;z-index:100050;width:calc(330px * var(--zoom));max-width:calc(100vw - 28px);background:var(--wh);border:1px solid var(--ivd);border-radius:16px;box-shadow:0 14px 40px rgba(20,40,32,.24);padding:15px 16px 13px;font-family:inherit;color:var(--ink)}
#hp-tip .t{font-size:14px;font-weight:900;color:var(--gd);padding-right:24px}
#hp-tip .d{font-size:12.5px;color:var(--ts);line-height:1.6;margin-top:6px}
#hp-tip .f{font-size:11px;color:var(--tl);margin-top:10px}
#hp-tip .x{position:absolute;top:9px;right:9px;width:24px;height:24px;border:0;border-radius:7px;background:var(--iv);color:var(--ts);cursor:pointer;font-size:11px}
#hp-tip .ar{position:absolute;width:14px;height:14px;background:var(--wh);border-left:1px solid var(--ivd);border-top:1px solid var(--ivd);transform:rotate(45deg)}
#hp-tip .sg{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
#hp-tip .sg button{font:700 12px/1 inherit;font-family:inherit;color:var(--ts);background:var(--iv);border:1px solid var(--ivd);border-radius:100px;padding:7px 10px;cursor:pointer}

/* 같이 하기 */
#hp-hole{position:fixed;z-index:100200;border-radius:12px;pointer-events:none;box-shadow:0 0 0 9999px rgba(10,22,17,.58),0 0 0 3px var(--hp-gold),0 0 0 9px rgba(245,197,66,.35);transition:left .12s,top .12s,width .12s,height .12s}
#hp-dim{position:fixed;inset:0;z-index:100200;background:rgba(10,22,17,.55)}
#hp-bub{position:fixed;z-index:100202;width:calc(380px * var(--zoom));max-width:calc(100vw - 24px);background:var(--wh);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden;font-family:inherit;color:var(--ink)}
#hp-bub .bh{background:linear-gradient(135deg,#00704A,#1E3932);color:#fff;padding:11px 15px;display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800}
#hp-bub .bh span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hp-bub .bh em{margin-left:auto;font-style:normal;opacity:.8;flex:none}
#hp-bub .bb{padding:15px 16px 14px;zoom:var(--zoom)}
#hp-bub .pg{display:flex;gap:5px;margin-bottom:12px}
#hp-bub .pg i{flex:1;height:5px;border-radius:9px;background:var(--ivd)}
#hp-bub .pg i.d{background:var(--gm)}#hp-bub .pg i.w{background:#9DB4CC}
#hp-bub .st{font-size:15px;line-height:1.65;font-weight:600}
#hp-bub .st.lk{font-weight:800}
#hp-bub .ht{font-size:12px;color:var(--tl);margin-top:6px;line-height:1.55}
#hp-bub .ex{font-size:12.5px;line-height:1.65;color:var(--ts);margin-top:7px}
#hp-bub .ex b{color:var(--hp-perm-tx)}
#hp-bub .bt{display:flex;gap:7px;margin-top:14px;flex-wrap:wrap}
#hp-bub .bt .r{margin-left:auto}
@media(max-width:768px){#hp-bub .bt{gap:6px}#hp-bub .bt .hp-btn{padding:10px 11px;font-size:12.5px}}
#hp-arr{position:fixed;z-index:100201;width:18px;height:18px;transform:rotate(45deg);border-radius:3px;pointer-events:none}
#hp-toast{position:fixed;left:50%;bottom:calc(28px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100300;background:#1E3932;color:#fff;padding:11px 16px;border-radius:12px;font:700 13px/1.4 inherit;font-family:inherit;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:92vw}
@media(max-width:768px){#hp-toast{bottom:calc(var(--tab-h) * var(--zoom) + 18px)}}
`;
  function injectCSS(){
    if($('hp-css')) return;
    const st = document.createElement('style'); st.id = 'hp-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function toast(msg, ms){
    let t = $('hp-toast'); if(t) t.remove();
    t = document.createElement('div'); t.id = 'hp-toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => { if(t.parentNode) t.remove(); }, ms || 2600);
  }

  /* ═══ 서랍 (PC 오른쪽 · 폰 아래에서 올라오는 판) ═══ */
  let stack = [];          // 지나온 화면 (뒤로 가기용)
  let view = null;         // { k:'home'|'search'|'cat'|'page'|'art', ... }
  let lastQ = '';
  function build(){
    if($('hp')) return;
    injectCSS();
    const sc = document.createElement('div'); sc.id = 'hp-scrim'; sc.onclick = () => closeHelper();
    const dw = document.createElement('aside'); dw.id = 'hp'; dw.setAttribute('role', 'dialog'); dw.setAttribute('aria-label', '도우미');
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    dw.innerHTML = `
      <div class="hp-hd">
        <button class="hp-grab" aria-label="도우미 접기"></button>
        <div class="hp-ttl"><div class="hp-logo">🧭</div><div><b>도우미</b><small>사용 방법을 순서대로 알려 드려요</small></div>
          <button class="hp-x" aria-label="도우미 닫기">✕</button></div>
        <div class="hp-q" id="hp-qbox"><span class="ic">🔍</span>
          <input id="hp-in" type="text" inputmode="search" placeholder="궁금한 것을 적어 보세요 · 예: 휴학 처리" autocomplete="off" enterkeyhint="search" aria-label="도우미 검색">
          <button class="hp-clr" aria-label="지우기">✕</button><span class="hp-kbd">${mac ? '⌘K' : 'Ctrl+K'}</span></div>
      </div>
      <div class="hp-bd" id="hp-bd"><div class="hp-z" id="hp-z"></div></div>`;
    document.body.appendChild(sc); document.body.appendChild(dw);
    dw.querySelector('.hp-x').onclick = () => closeHelper();
    dw.querySelector('.hp-grab').onclick = () => closeHelper();
    const inp = $('hp-in'), box = $('hp-qbox');
    let tm = 0;
    inp.addEventListener('input', () => {
      box.classList.toggle('has', !!inp.value);
      clearTimeout(tm); tm = setTimeout(() => { const q = inp.value.trim(); stack = []; if(q) go({ k:'search', q }, true); else go({ k:'home' }, true); }, 130);
    });
    inp.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ e.preventDefault(); if(inp.value){ inp.value = ''; box.classList.remove('has'); go({ k:'home' }, true); } else closeHelper(); return; }
      const rows = [...$('hp-z').querySelectorAll('.hp-row')];
      if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        if(!rows.length) return; e.preventDefault();
        let i = rows.findIndex(r => r.classList.contains('on'));
        rows.forEach(r => r.classList.remove('on'));
        i = e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1);
        rows[i].classList.add('on'); rows[i].scrollIntoView({ block:'nearest' });
      }
      if(e.key === 'Enter'){
        e.preventDefault(); clearTimeout(tm);
        const q = inp.value.trim();
        if(q && (!view || view.k !== 'search' || view.q !== q)){ go({ k:'search', q }, true); }
        const r = $('hp-z').querySelector('.hp-row.on') || $('hp-z').querySelector('.hp-row');
        if(r) r.click();
      }
    });
    box.querySelector('.hp-clr').onclick = () => { inp.value = ''; box.classList.remove('has'); go({ k:'home' }, true); inp.focus(); };
    $('hp-z').addEventListener('click', onBodyClick);
  }
  function isHelperOpen(){ return document.documentElement.classList.contains('hp-open'); }
  function openHelper(q, opt){
    opt = opt || {};
    try {
      build(); hideTip();
      document.documentElement.classList.add('hp-open');
      const inp = $('hp-in');
      if(typeof q === 'string'){ inp.value = q; $('hp-qbox').classList.toggle('has', !!q); }
      const z = $('hp-z');
      if(!HELP) z.innerHTML = '<div class="hp-empty"><i>⏳</i>도움말을 불러오는 중…</div>';
      load().then(() => {
        if(opt.art){ stack = []; go({ k:'art', id:opt.art }, true); }
        else if(inp.value.trim()) go({ k:'search', q:inp.value.trim() }, true);
        else if(!view || opt.fresh) go({ k:'home' }, true);
        else render();
      }).catch(() => {
        z.innerHTML = `<div class="hp-empty"><i>📡</i>도움말을 불러오지 못했어요.<br>인터넷 연결을 확인하고 다시 열어 주세요.
          <div style="margin-top:12px"><button class="hp-btn sc" data-act="retry">다시 불러오기</button></div></div>`;
      });
      if(!phone() || opt.focus) setTimeout(() => { try { inp.focus({ preventScroll:true }); if(opt.select) inp.select(); } catch(_){} }, 60);
    } catch(e){ console.warn('도우미', e); }
  }
  function closeHelper(){ document.documentElement.classList.remove('hp-open'); try { $('hp-in') && $('hp-in').blur(); } catch(_){} }
  function toggleHelper(){
    if(isHelperOpen() && document.activeElement === $('hp-in')) closeHelper();
    else openHelper(undefined, { focus:true, select:true });
  }
  window.openHelper = openHelper; window.closeHelper = closeHelper; window.toggleHelper = toggleHelper;

  function go(v, replace){
    if(view && !replace) stack.push(view);
    if(stack.length > 30) stack = stack.slice(-30);
    view = v; if(v.k === 'search') lastQ = v.q;
    render();
    const bd = $('hp-bd'); if(bd) bd.scrollTop = 0;
  }
  function back(){
    view = stack.pop() || { k:'home' };
    if(view.k === 'search'){ const inp = $('hp-in'); inp.value = view.q; $('hp-qbox').classList.add('has'); }
    if(view.k === 'home'){ const inp = $('hp-in'); inp.value = ''; $('hp-qbox').classList.remove('has'); }
    render();
  }
  function backLabel(){
    const p = stack[stack.length - 1];
    if(!p || p.k === 'home') return '처음으로';
    if(p.k === 'search') return `«${p.q}» 찾은 목록으로`;
    if(p.k === 'cat') return `«${p.cat}» 목록으로`;
    if(p.k === 'page') return `«${pageName(p.page)}» 도움말 목록으로`;
    return '돌아가기';
  }

  function row(a, q){
    const meta = (isOpen(a) ? '' : '🔒 ') + esc(a.cat) + ' · ' + (a.steps || []).length + '단계' + (isOpen(a) ? '' : ' · ' + esc(a.who));
    return `<button class="hp-row" data-art="${esc(a.id)}"><span class="ic">${iconOf(a)}</span>
      <span class="tx"><b>${q ? hl(a.title, q) : esc(a.title)}</b><span class="m">${meta}</span></span><span class="go">›</span></button>`;
  }
  const askBox = (txt) => `<button class="hp-ask" data-act="ask">🙋 <span>${txt || '찾는 답이 없나요? <b>관리자에게 물어보기</b> — 쪽지로 보내져요'}</span></button>`;
  const POPULAR = ['결석 표시', '지난 날짜 출결 고치기', '휴학 처리', '경비 영수증', '비밀번호 바꾸기', '쪽지에 사진', '결재 올리기'];

  function render(){
    const z = $('hp-z'); if(!z || !HELP) return;
    const v = view || { k:'home' };
    const list = visible();
    let h = '';
    if(v.k === 'home'){
      const hp = here();
      const mine = list.filter(a => pageOf(a.page) === hp);
      const cnt = {}; mine.forEach(a => cnt[a.cat] = (cnt[a.cat] || 0) + 1);
      const main = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
      const top = mine.slice().sort((x, y) => (x.cat === main ? 0 : 1) - (y.cat === main ? 0 : 1)).slice(0, 5);
      if(top.length){
        h += `<div class="hp-sec">📍 지금 화면 «${esc(pageName(hp))}»에서 자주 묻는 것</div>` + top.map(a => row(a)).join('');
        if(mine.length > top.length) h += `<button class="hp-back" data-page="${esc(hp)}" style="margin:2px 2px 0">이 화면 도움말 모두 보기 (${mine.length}) ›</button>`;
      }
      h += `<div class="hp-sec">🔥 선생님들이 많이 찾는 것</div><div class="hp-sug">${POPULAR.map(s => `<button data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
      const cats = []; list.forEach(a => { if(!cats.includes(a.cat)) cats.push(a.cat); });
      h += `<div class="hp-sec">📚 기능별로 보기</div><div class="hp-cats">${cats.map(c => `<button data-cat="${esc(c)}"><i>${ICON[c] || '📘'}</i>${esc(c)}<em>${list.filter(a => a.cat === c).length}가지</em></button>`).join('')}</div>`;
      h += askBox('🧭 그래도 모르겠으면 <b>관리자에게 물어보기</b> — 쪽지로 보내져요');
    } else if(v.k === 'search'){
      const rs = search(v.q).slice(0, 8), mh = menuHits(v.q);
      const nq = norm(v.q), exactMenu = mh.some(m => norm(m.label) === nq);
      const menus = mh.length ? `<div class="hp-sec">↗ 화면 바로 가기</div>` + mh.map(m => `<button class="hp-row" data-href="${esc(m.href)}"><span class="ic">↗</span><span class="tx"><b>${hl(m.label, v.q)}</b><span class="m">${esc(m.group)} · ${esc(m.desc || '')}</span></span><span class="go">›</span></button>`).join('') : '';
      if(exactMenu) h += menus;
      if(rs.length){
        h += `<div class="hp-sec">🔎 «${esc(v.q)}» 찾은 방법 ${rs.length}개</div>` + rs.map((a, i) => row(a, v.q).replace('class="hp-row"', i === 0 ? 'class="hp-row on"' : 'class="hp-row"')).join('');
      } else {
        h += `<div class="hp-empty"><i>🤔</i>«${esc(v.q)}»에 맞는 방법을 찾지 못했어요.<br>짧은 낱말로 다시 적어 보세요. (예: 휴학, 출결, 영수증)</div>`;
      }
      if(!exactMenu) h += menus;
      h += askBox();
    } else if(v.k === 'cat' || v.k === 'page'){
      const arts = v.k === 'cat' ? list.filter(a => a.cat === v.cat) : list.filter(a => pageOf(a.page) === v.page);
      h += `<button class="hp-back" data-act="back">‹ ${esc(backLabel())}</button>`;
      h += `<div class="hp-sec" style="margin-top:4px">${v.k === 'cat' ? (ICON[v.cat] || '📘') + ' ' + esc(v.cat) : '📍 ' + esc(pageName(v.page))} · ${arts.length}가지</div>` + arts.map(a => row(a)).join('');
      h += askBox();
    } else if(v.k === 'art'){
      const a = byId(v.id);
      h += `<button class="hp-back" data-act="back">‹ ${esc(backLabel())}</button>`;
      h += a ? `<div class="hp-card">${artHTML(a, v)}</div>` : '<div class="hp-empty">이 도움말을 찾을 수 없어요.</div>';
    }
    z.innerHTML = h;
  }
  function artHTML(a, v){
    const steps = (a.steps || []).map(s => `<li>${lab(s)}</li>`).join('');
    const tips = (a.tips || []).length ? `<div class="hp-tips"><b>💡 알아 두면 좋아요</b>${a.tips.map(t => `<p>${lab(t)}</p>`).join('')}</div>` : '';
    const perm = isOpen(a) ? '' : `<div class="hp-perm"><span class="lk">🔒</span><div>보는 건 누구나 할 수 있어요. 실제로 <b>저장·수정·적용은 ${esc(a.who)}</b>만 할 수 있어요.
      권한이 없으면 단추가 안 보이거나 «👁 열람 전용»으로 보여요. <button data-act="perm">권한 요청하기 ›</button></div></div>`;
    const canTour = Object.keys(a.sel || {}).length > 0;
    const pg = pageOf(a.page), away = a.page !== '*' && pg !== here();
    const act = `<div class="hp-act">
      ${canTour ? `<button class="hp-btn pr" data-act="tour">👆 화면에서 같이 하기</button>` : ''}
      ${away ? `<a class="hp-btn sc" href="${esc(a.page)}">↗ ${esc(ro(pageName(pg)))} 가기</a>` : ''}</div>`;
    const fb = v.fb === 'ok' ? `<div class="hp-fb"><span class="hp-fbok">😊 다행이에요! 또 궁금하면 언제든 불러 주세요.</span></div>`
      : v.fb === 'no' ? `<div class="hp-fb" style="display:block">조금 더 도와 드릴게요.${askBox('<b>관리자에게 물어보기</b> — 이 도움말 제목을 담아 쪽지로 보내요')}
          <button class="hp-ask" data-act="again" style="margin-top:8px">🔍 <span>다른 말로 다시 찾아보기</span></button></div>`
      : `<div class="hp-fb">도움이 되었나요? <button data-act="fbok">👍 해결됐어요</button><button data-act="fbno">🤔 아직이요</button></div>`;
    return `<div class="hp-chips"><span class="hp-cat">${esc(a.cat)}${a.tab ? ' · ' + esc(a.tab) : ''}</span>${isOpen(a) ? `<span class="hp-who">👤 ${esc(a.who)}</span>` : ''}</div>
      <h2 class="hp-h">${esc(a.title)}</h2>${perm}<ol class="hp-steps">${steps}</ol>${tips}${act}${fb}`;
  }
  function onBodyClick(e){
    const t = e.target.closest('button,a'); if(!t) return;
    const d = t.dataset;
    if(d.art){ go({ k:'art', id:d.art }); return; }
    if(d.href){ closeHelper(); location.href = d.href; return; }
    if(d.q){ const inp = $('hp-in'); inp.value = d.q; $('hp-qbox').classList.add('has'); go({ k:'search', q:d.q }); return; }
    if(d.cat){ go({ k:'cat', cat:d.cat }); return; }
    if(d.page){ go({ k:'page', page:d.page }); return; }
    const a = view && view.k === 'art' ? byId(view.id) : null;
    switch(d.act){
      case 'back': back(); break;
      case 'retry': openHelper(); break;
      case 'tour': if(a){ closeHelper(); tourStart(a); } break;
      case 'fbok': view.fb = 'ok'; render(); break;
      case 'fbno': view.fb = 'no'; render(); break;
      case 'again': { const inp = $('hp-in'); inp.focus(); inp.select(); break; }
      case 'perm': askAdmin('perm', a); break;
      case 'ask': askAdmin('ask', a); break;
    }
  }

  /* ═══ 관리자에게 물어보기 · 권한 요청 → 쪽지 화면에 채워서 연다 ═══ */
  function askAdmin(kind, a){
    const where = pageName(here());
    let subject, body;
    if(kind === 'perm' && a){
      subject = `[권한 요청] ${a.title}`;
      body = `«${a.title}» 일을 하려고 하는데 제 계정에는 권한이 없는 것 같아요.\n필요한 권한: ${a.who}\n화면: ${pageName(a.page === '*' ? here() : a.page)}${a.tab ? ' › ' + a.tab : ''}\n\n권한을 주시거나, 대신 처리해 주실 수 있을까요?`;
    } else if(a){
      subject = `[도우미] ${a.title}`;
      body = `도우미에서 «${a.title}» 안내를 봤는데 아직 해결이 안 됐어요.\n화면: ${where}\n\n궁금한 점: `;
    } else {
      const q = lastQ || ($('hp-in') && $('hp-in').value.trim()) || '';
      subject = q ? `[도우미] ${q}` : '[도우미] 사용 방법 문의';
      body = (q ? `도우미에서 «${q}»(으)로 찾아봤는데 답을 못 찾았어요.\n` : '') + `화면: ${where}\n\n궁금한 점: `;
    }
    const hc = { subject, body, t: Date.now() };
    closeHelper(); tourStop(true);
    if(here() === 'message.html' && typeof window.__helpCompose === 'function'){ window.__helpCompose(hc); return; }
    ss.set(MAIL_KEY, JSON.stringify(hc));
    location.href = 'message.html';
  }

  /* ═══ 화면에서 같이 하기 ═══ */
  const T = { a:null, step:0, el:null, sel:'', raf:0, poll:0, mode:'', seq:0 };
  const stepSel = (a, n) => (a.sel || {})[String(n)] || '';
  const total = a => (a.steps || []).length;
  function saveTour(){ if(T.a) ss.set(TOUR_KEY, JSON.stringify({ id:T.a.id, step:T.step, t:Date.now() })); }
  /* 지금 이 화면으로 오는 «사이드바에서 ○○ 누르기» 단계는 건너뛴다 */
  function navStep(a, n){ const s = stepSel(a, n); const pg = here();
    return !!s && /href/.test(s) && (s.includes(`"${pg}"`) || s.includes(`'${pg}'`) || s.includes(`=${pg}]`)); }
  function firstStep(a, from){ let n = from || 1; while(n < total(a) && navStep(a, n)) n++; return n; }
  function pick(sel){
    if(!sel) return null;
    let all = []; try { all = [...document.querySelectorAll(sel)]; } catch(_){ return null; }
    return all.find(el => { if(el.closest('#hp,#hp-bub,#hp-tip')) return false;
      if(!el.getClientRects().length) return false; const r = el.getBoundingClientRect();
      if(r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.opacity !== '0'; }) || null;
  }
  function tourStart(a, step){
    if(!a) return;
    const pg = pageOf(a.page);
    if(a.page !== '*' && pg !== here()){
      // 그 화면으로 먼저 옮긴 뒤 이어서 한다 (사이드바로 가는 단계는 건너뜀)
      let n = 1; const s1 = stepSel(a, 1);
      if(s1 && /href/.test(s1) && s1.includes(pg)) n = 2;
      ss.set(TOUR_KEY, JSON.stringify({ id:a.id, step:n, t:Date.now(), nav:1 }));
      location.href = a.page; return;
    }
    T.a = a; T.step = firstStep(a, step || 1);
    showStep();
  }
  function tourStop(silent){
    T.seq++; cancelAnimationFrame(T.raf); clearInterval(T.poll);
    ['hp-hole', 'hp-dim', 'hp-bub', 'hp-arr'].forEach(id => { const x = $(id); if(x) x.remove(); });
    document.removeEventListener('click', onTourClick, true);
    document.removeEventListener('change', onTourChange, true);
    T.a = null; T.el = null; ss.del(TOUR_KEY);
    if(!silent){}
  }
  window.helpTour = id => load().then(() => tourStart(byId(id)));
  window.helpSearch = q => load().then(() => search(q).map(a => a.id));
  function showStep(){
    const a = T.a; if(!a) return;
    const seq = ++T.seq;
    cancelAnimationFrame(T.raf); clearInterval(T.poll);
    ['hp-hole', 'hp-dim', 'hp-arr'].forEach(id => { const x = $(id); if(x) x.remove(); });
    T.el = null; T.sel = stepSel(a, T.step);
    saveTour();
    document.addEventListener('click', onTourClick, true);
    document.addEventListener('change', onTourChange, true);
    if(!T.sel){ T.mode = 'free'; bubble(); placeFree(); return; }
    // 단추를 찾는다 — 앞 단계를 누른 뒤 화면이 그려질 시간을 조금 준다
    const STEP = 120, limit = T.resumeWait || 2600; T.resumeWait = 0;
    let waiting = false, ticks = 0;
    const tryFind = () => {
      if(seq !== T.seq) return true;
      const el = pick(T.sel);
      if(el){ clearInterval(T.poll); target(el); return true; }
      const spent = (ticks++) * STEP;
      if(!waiting && spent > 700){ waiting = true; T.mode = 'wait'; bubble(); placeFree(); }   // 늦으면 말풍선부터 띄워 둔다
      // 폰 서랍(사이드바) 안의 단추면 서랍을 열어 준다
      if(phone() || matchMedia('(max-height:520px) and (max-width:1100px)').matches){
        let raw = null; try { raw = document.querySelector(T.sel); } catch(_){}
        if(raw && raw.closest('#sb') && window.openDrawer && !document.getElementById('app')?.classList.contains('drawer')){ openDrawer(); }
      }
      if(spent > limit){ clearInterval(T.poll); T.mode = 'missing'; bubble(); placeCenter(); return true; }
      return false;
    };
    if(!tryFind()) T.poll = setInterval(tryFind, STEP);
  }
  function target(el){
    T.el = el;
    const tag = el.tagName, field = /^(INPUT|SELECT|TEXTAREA)$/.test(tag) || (el.isContentEditable && tag !== 'BUTTON');
    T.mode = field ? 'field' : 'click';
    if(el.closest('#sb') && window.openDrawer && (phone() || matchMedia('(max-height:520px) and (max-width:1100px)').matches)) openDrawer();
    try { el.scrollIntoView({ block:'center', inline:'nearest', behavior:'smooth' }); } catch(_){ el.scrollIntoView(); }
    const hole = document.createElement('div'); hole.id = 'hp-hole'; document.body.appendChild(hole);
    const arr = document.createElement('div'); arr.id = 'hp-arr'; document.body.appendChild(arr);
    bubble();
    const loop = () => {
      if(!T.a) return;
      if(!T.el || !T.el.isConnected){ const n = pick(T.sel); if(n) T.el = n; }
      if(T.el && T.el.isConnected) place(T.el.getBoundingClientRect());
      T.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  function bubble(){
    const a = T.a; let b = $('hp-bub');
    if(!b){ b = document.createElement('div'); b.id = 'hp-bub'; b.setAttribute('role', 'dialog'); document.body.appendChild(b); b.addEventListener('click', onBubClick); }
    const n = T.step, N = total(a), last = n >= N;
    const pg = a.steps.map((_, i) => `<i class="${i < n - 1 || (i === n - 1 && T.mode !== 'missing') ? 'd' : i === n - 1 ? 'w' : ''}"></i>`).join('');
    const head = `<div class="bh"><span>🧭 같이 하기 · ${esc(a.title)}</span><em>${n} / ${N}</em></div>`;
    let body;
    if(T.mode === 'missing'){
      const ks = (a.steps[n - 1] || '').match(/«[^»]+»/g) || [], name = ks.length ? ks[ks.length - 1].slice(1, -1) : '단추';   // 마지막 «…» 가 누르는 단추
      const perm = !isOpen(a) && !isSuper();
      body = perm
        ? `<div class="st lk">🔒 이 단계의 «${esc(name)}» 단추는 권한이 있는 분께만 보여요</div>
           <div class="ex">이 일은 <b>${esc(a.who)}</b>만 할 수 있어요. 지금 계정으로는 보기까지만 돼요.<br>필요하면 관리자에게 권한을 요청하거나, 담당 선생님께 부탁해 주세요.</div>
           <div class="ht">«${esc(name)}» 단추가 화면에 있으면 직접 누른 뒤 «다음 ›»을 눌러도 돼요.</div>
           <div class="bt"><button class="hp-btn sc" data-t="stop">그만하기</button><button class="hp-btn sc" data-t="next">다음 ›</button><button class="hp-btn pr r" data-t="perm">✉️ 관리자에게 권한 요청</button></div>`
        : `<div class="st">${lab(a.steps[n - 1])}</div>
           <div class="ex">«${esc(name)}»을(를) 지금 화면에서 찾지 못했어요. 앞 단계를 마쳤는지 확인해 주세요. 화면에서 직접 찾아 누른 뒤 «다음 ›»을 눌러도 돼요.</div>
           <div class="bt">${n > 1 ? '<button class="hp-btn sc" data-t="prev">‹ 이전</button>' : ''}<button class="hp-btn sc" data-t="stop">그만하기</button><button class="hp-btn sc" data-t="retry">다시 찾기</button><button class="hp-btn pr r" data-t="next">${last ? '다 했어요 ✓' : '다음 ›'}</button></div>`;
    } else {
      const hint = T.mode === 'click' ? '노란 테두리 안을 누르면 다음 단계로 넘어가요'
        : T.mode === 'field' ? '칸을 채우거나 고른 뒤 «다음 ›»을 눌러 주세요'
        : T.mode === 'wait' ? '⏳ 화면에서 단추를 찾는 중이에요…'
        : '이 단계는 화면을 보면서 직접 해 주세요. 다 했으면 «다음 ›»';
      body = `<div class="st">${lab(a.steps[n - 1])}</div><div class="ht">${hint}</div>
        <div class="bt">${n > 1 ? '<button class="hp-btn sc" data-t="prev">‹ 이전</button>' : ''}<button class="hp-btn sc" data-t="stop">그만하기</button><button class="hp-btn sc" data-t="list">📋 순서</button><button class="hp-btn pr r" data-t="next">${last ? '다 했어요 ✓' : '다음 ›'}</button></div>`;
    }
    b.innerHTML = head + `<div class="bb"><div class="pg">${pg}</div>${body}</div>`;
  }
  function bubSize(){ const b = $('hp-bub'); const r = b.getBoundingClientRect(); return { w:r.width, h:r.height }; }
  function placeFree(){
    const b = $('hp-bub'); const { w } = bubSize();
    const bottomGap = phone() ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-h')) || 58) + 14 : 24;
    b.style.left = Math.max(12, (innerWidth - w) / 2) + 'px'; b.style.top = ''; b.style.bottom = bottomGap + 'px';
  }
  function placeCenter(){
    let dim = $('hp-dim'); if(!dim){ dim = document.createElement('div'); dim.id = 'hp-dim'; document.body.appendChild(dim); }
    const b = $('hp-bub'); const { w, h } = bubSize();
    b.style.bottom = ''; b.style.left = Math.max(12, (innerWidth - w) / 2) + 'px'; b.style.top = Math.max(16, (innerHeight - h) / 2.6) + 'px';
  }
  function place(r){
    const hole = $('hp-hole'), b = $('hp-bub'), arr = $('hp-arr'); if(!hole || !b) return;
    const pad = 6;
    hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px';
    hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
    const { w, h } = bubSize(), W = innerWidth, H = innerHeight, gap = 16;
    let left, top, side;
    if(phone()){
      left = (W - w) / 2;
      const tabH = ((parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-h')) || 58) + 12);
      if(r.top + r.height / 2 < H * .5 && r.bottom + gap + h < H - tabH){ top = Math.max(r.bottom + gap, H - tabH - h); side = 'none'; }
      else if(r.top - gap - h > 8){ top = Math.min(r.top - gap - h, 64); side = 'none'; }
      else { top = H - tabH - h; side = 'none'; }
    } else if(r.bottom + gap + h < H - 10){ top = r.bottom + gap; left = r.left; side = 'below'; }
    else if(r.top - gap - h > 10){ top = r.top - gap - h; left = r.left; side = 'above'; }
    else if(r.right + gap + w < W - 10){ left = r.right + gap; top = r.top; side = 'right'; }
    else if(r.left - gap - w > 10){ left = r.left - gap - w; top = r.top; side = 'left'; }
    else { left = (W - w) / 2; top = H - h - 16; side = 'none'; }
    left = Math.min(Math.max(12, left), W - w - 12); top = Math.min(Math.max(10, top), H - h - 10);
    b.style.bottom = ''; b.style.left = left + 'px'; b.style.top = top + 'px';
    if(arr){
      const head = side === 'below', col = head ? '#0B6B47' : 'var(--wh)';
      arr.style.background = col; arr.style.display = side === 'none' ? 'none' : 'block';
      if(side === 'below' || side === 'above'){
        const x = Math.min(Math.max(r.left + Math.min(r.width / 2, 40) - 9, left + 18), left + w - 36);
        arr.style.left = x + 'px'; arr.style.top = (side === 'below' ? top - 8 : top + h - 10) + 'px';
      } else if(side === 'right' || side === 'left'){
        const y = Math.min(Math.max(r.top + Math.min(r.height / 2, 30) - 9, top + 14), top + h - 30);
        arr.style.top = y + 'px'; arr.style.left = (side === 'right' ? left - 8 : left + w - 10) + 'px';
      }
    }
  }
  function advance(d){
    const a = T.a; if(!a) return;
    const n = T.step + d;
    if(n > total(a)){ const t = a.title; tourStop(); toast(`👍 «${t}» 끝! 잘 하셨어요.`); return; }
    if(n < 1) return;
    T.step = n; showStep();
  }
  function onBubClick(e){
    const t = e.target.closest('button'); if(!t) return;
    switch(t.dataset.t){
      case 'next': advance(1); break;
      case 'prev': { let n = T.step - 1; while(n > 1 && navStep(T.a, n)) n--; T.step = Math.max(1, n); showStep(); break; }
      case 'stop': tourStop(); break;
      case 'retry': showStep(); break;
      case 'list': { const id = T.a.id; tourStop(); openHelper(undefined, { art:id }); break; }
      case 'perm': { const a = T.a; tourStop(true); askAdmin('perm', a); break; }
    }
  }
  /* 노란 테두리 안을 누르면 다음 단계 — 누른 일은 그대로 일어나게 둔다 (화면이 바뀌면 다음 화면에서 이어감) */
  function onTourClick(e){
    if(!T.a || !T.el || T.mode !== 'click') return;
    if(e.target.closest && e.target.closest('#hp-bub')) return;
    if(!T.el.contains(e.target)) return;
    const a = T.a, n = T.step + 1;
    if(n > total(a)){ setTimeout(() => { if(T.a === a) advance(1); }, 350); return; }
    ss.set(TOUR_KEY, JSON.stringify({ id:a.id, step:n, t:Date.now() }));
    const seq = T.seq;
    setTimeout(() => { if(T.a === a && T.seq === seq){ T.step = n; showStep(); } }, 380);
  }
  function onTourChange(e){
    if(!T.a || !T.el || T.mode !== 'field') return;
    if(!T.el.contains(e.target) && e.target !== T.el) return;
    const ty = (e.target.type || '').toLowerCase();
    if(e.target.tagName === 'SELECT' || /^(checkbox|radio|date|month|week|time|file)$/.test(ty)){
      const seq = T.seq; setTimeout(() => { if(T.a && T.seq === seq) advance(1); }, 450);
    }
  }
  /* 화면이 바뀌었으면 이어서 */
  function resumeTour(){
    let st = null; try { st = JSON.parse(ss.get(TOUR_KEY) || 'null'); } catch(_){}
    if(!st || !st.id || Date.now() - (st.t || 0) > TOUR_TTL){ ss.del(TOUR_KEY); return; }
    load().then(() => {
      const a = byId(st.id); if(!a){ ss.del(TOUR_KEY); return; }
      T.a = a; T.step = firstStep(a, Math.min(Math.max(1, st.step || 1), total(a))); T.resumeWait = 7000;
      // 화면이 다 열린 뒤 (불러오는 중 화면이 걷힌 뒤) 시작
      let n = 0; const wait = () => { if(!T.a) return; if(document.querySelector('#loadOverlay.on') && ++n < 60) return setTimeout(wait, 250); setTimeout(showStep, 350); };
      wait();
    }).catch(() => {});
  }

  /* ═══ 폰: 아래 탭 위 동그란 단추 (내려 읽을 땐 비켜 준다) ═══ */
  function fab(){
    if($('hp-fab')) return;
    const b = document.createElement('button'); b.id = 'hp-fab'; b.type = 'button';
    b.setAttribute('aria-label', '도우미 — 사용 방법 찾기'); b.textContent = '🧭';
    b.onclick = () => openHelper();
    document.body.appendChild(b);
    let y0 = scrollY, acc = 0;
    addEventListener('scroll', () => {
      const y = scrollY, d = y - y0; y0 = y;
      acc = (d > 0) === (acc > 0) ? acc + d : d;
      if(acc > 40 && y > 120) b.classList.add('hide');
      else if(acc < -24 || y < 60) b.classList.remove('hide');
      liftSoon();
    }, { passive:true });
    addEventListener('resize', liftSoon);
    setInterval(liftFab, 1500);
    setTimeout(liftFab, 400);
  }
  /* 화면 아래에 붙은 띠(«신청하기» 같은 단추가 있는 곳)가 있으면 그 위로 비켜 선다 */
  let liftT = 0;
  function liftSoon(){ clearTimeout(liftT); liftT = setTimeout(liftFab, 120); }
  function liftFab(){
    const b = $('hp-fab'); if(!b || !phone()) return;
    const mt = $('mtab'), base = mt ? mt.getBoundingClientRect().top : innerHeight;
    let top = base;
    const probe = [innerWidth - 40, innerWidth - 90, innerWidth / 2];
    b.style.visibility = 'hidden';
    for(let y = base - 8; y > base - 220; y -= 26){
      probe.forEach(x => {
        let el = document.elementFromPoint(x, y);
        for(let k = 0; el && el !== document.body && k < 12; k++, el = el.parentElement){
          if(el.id === 'mtab' || el.id === 'app' || el.id === 'mn' || el.id === 'mn-wrap') break;
          if(/^hp-/.test(el.id || '') || el.id === 'hp') break;
          const cs = getComputedStyle(el);
          if(cs.position === 'fixed' || cs.position === 'sticky'){
            const r = el.getBoundingClientRect();
            if(r.bottom >= base - 30 && r.height < innerHeight * .5 && r.width > innerWidth * .5) top = Math.min(top, r.top);
            break;
          }
        }
      });
    }
    b.style.visibility = '';
    b.style.bottom = top < base ? (innerHeight - top + 12) + 'px' : '';
  }

  /* ═══ 처음 한 번 말풍선 ═══ */
  function hideTip(){ const t = $('hp-tip'); if(t) t.remove(); }
  /* 불러오는 중이거나 창(팝업)이 떠 있으면 기다린다 */
  function busy(){ return !!document.querySelector('#loadOverlay.on') || [...document.querySelectorAll('.mov')].some(m => m.getClientRects().length); }
  let tipTries = 0;
  function showTip(){
    if(ls.get(TIP_KEY) || ss.get(TOUR_KEY) || isHelperOpen() || T.a || document.body.classList.contains('share-mode')) return;
    if(busy()){ if(++tipTries < 10) setTimeout(showTip, 2500); return; }
    const ph = phone();
    const anchor = ph ? $('hp-fab') : document.querySelector('#tb .tb-help');
    if(!anchor || !anchor.getClientRects().length) return;
    ls.set(TIP_KEY, '1');
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const t = document.createElement('div'); t.id = 'hp-tip'; t.setAttribute('role', 'note');
    t.innerHTML = `<button class="x" aria-label="닫기">✕</button><span class="ar"></span>
      <div class="t">👋 궁금한 게 있으면 저를 불러 주세요</div>
      <div class="d">하고 싶은 일을 그냥 적으면 순서대로 알려 드려요. 실제 단추를 짚으며 같이 할 수도 있어요.</div>
      <div class="sg">${['휴학 처리', '결석 고치기', '경비 영수증', '쪽지에 사진'].map(s => `<button data-q="${s}">${s}</button>`).join('')}</div>
      <div class="f">${ph ? '오른쪽 아래 🧭 단추를 누르면 언제든 열려요' : `어느 화면에서나 ${mac ? '⌘K' : 'Ctrl+K'} · 오른쪽 위 «🧭 도우미»`}</div>`;
    document.body.appendChild(t);
    const r = anchor.getBoundingClientRect(), ar = t.querySelector('.ar'), w = t.getBoundingClientRect().width;
    if(ph){ t.style.right = '14px'; t.style.bottom = (innerHeight - r.top + 12) + 'px'; ar.style.bottom = '-8px'; ar.style.right = '22px'; ar.style.transform = 'rotate(225deg)'; }
    else { t.style.top = (r.bottom + 12) + 'px'; t.style.left = Math.min(innerWidth - w - 14, Math.max(14, r.right - w + 10)) + 'px';
      ar.style.top = '-8px'; ar.style.left = Math.min(w - 26, Math.max(14, r.left + r.width / 2 - parseFloat(t.style.left) - 7)) + 'px'; }
    t.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return;
      if(b.classList.contains('x')){ hideTip(); return; }
      if(b.dataset.q){ hideTip(); openHelper(b.dataset.q); } });
    setTimeout(hideTip, 30000);
  }

  /* ═══ 시작 ═══ */
  function init(){
    try {
      injectCSS(); fab();
      document.addEventListener('keydown', e => {
        if(e.key !== 'Escape') return;
        if(T.a){ e.preventDefault(); tourStop(); return; }
        if(isHelperOpen() && document.activeElement !== $('hp-in')){ closeHelper(); }
      });
      if(ss.get(TOUR_KEY)) resumeTour();
      else setTimeout(showTip, 1600);
    } catch(e){ console.warn('도우미', e); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
