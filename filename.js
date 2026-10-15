/* ═══════════════════════════════════════════════════════════
   📁 filename.js — 인쇄 · PDF · 이미지 · 파일 저장 이름 (v-115)
   · 브라우저의 «PDF로 저장»은 화면 제목(document.title)을 파일 이름으로 쓴다
     → 인쇄하는 동안만 제목을 «무엇_어느 것_기관» 으로 바꿨다가 끝나면 되돌린다
       (예전에는 «학사일정 · 교사 선교사.pdf» 처럼 모두 홈페이지 이름으로 나왔다)
   · 이름 규칙: 조각을 «_» 로 잇는다 · 첫 조각은 붙여 쓴 종류(학사일정·출결현황…)
     · 파일 이름에 못 쓰는 글자(\ / : * ? " < > |)와 이모지는 뺀다 · 같은 말은 두 번 넣지 않는다
   · 화면마다 window.fileNameContext = () => ['출결현황', '2026학년도 1학기', '다니엘 아마츠']
     를 두면 Ctrl+P(⌘P)·브라우저 메뉴 인쇄에도 그 이름이 붙는다.
     없으면 «화면 이름 › 탭» 경로 + 오늘 날짜 (예: 출석부_월별 출석_2026-10-11)
   쓰는 법:
     FN.make(['공사경비', '본관 공사', '2026-10-11'], { ext:'.csv' })   → 공사경비_본관 공사_2026-10-11.csv
     FN.printAs(['수업일', '2026년 10월', '다니엘 아마츠'])              → 그 이름으로 인쇄 창을 연다
     FN.printAs(name, () => iframe.contentWindow.print())               → 다른 창 인쇄도 이름을 붙여서
   ═══════════════════════════════════════════════════════════ */
(function(){
  if(window.FN) return;
  const SITE = '교사 선교사';
  const ORG = { daniel:'다니엘 아마츠', jihyebit:'지혜빛 선교원', all:'DA 전체', __all__:'DA 전체', both:'다니엘 아마츠·지혜빛 선교원' };
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

  /* 한 조각 다듬기 — 못 쓰는 글자 · 이모지 · 겹친 빈칸 */
  function clean(s){
    return String(s == null ? '' : s)
      .replace(EMOJI, '')
      .replace(/\s*[:|\\]\s*/g, ' ')
      .replace(/\s*\/\s*/g, '-')
      .replace(/[*?"<>\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.\-_·]+|[\s.\-_·]+$/g, '');
  }
  const flat = s => s.replace(/\s/g, '');

  /* 조각들 → 파일 이름 */
  function make(parts, opt){
    opt = opt || {};
    const list = (Array.isArray(parts) ? parts : [parts]).flat(Infinity).map(clean).filter(Boolean);
    const out = [];
    list.forEach(p => {
      const f = flat(p);
      // 앞 조각에 이미 들어 있는 말은 빼기 (예: «다니엘 아마츠 2학기 시간표» 뒤의 «다니엘 아마츠»)
      if(out.some(q => flat(q) === f || (f.length >= 3 && flat(q).includes(f)))) return;
      out.push(p);
    });
    // 뒤 조각이 첫 조각(종류)을 이미 품고 있으면 앞의 종류는 빼기 (예: «완성시간표_2학기 완성 시간표» → «2학기 완성 시간표»)
    if(out.length > 1){ const f0 = flat(out[0]); if(f0.length >= 3 && out.slice(1).some(q => flat(q).includes(f0))) out.shift(); }
    if(opt.date){
      const ds = opt.date === true ? today() : clean(opt.date);
      if(ds && !out.some(q => q.includes(ds))) out.push(ds);
    }
    let name = out.join('_') || '문서';
    if(name.length > 120) name = name.slice(0, 120).replace(/[\s_·-]+$/, '');
    const ext = opt.ext ? (String(opt.ext)[0] === '.' ? opt.ext : '.' + opt.ext) : '';
    return name + ext;
  }

  const orgName = k => ORG[k] || (k ? String(k) : '');
  /* '2026-10' → '2026년 10월' */
  const ym = s => { const m = /^(\d{4})-(\d{1,2})/.exec(String(s || '')); return m ? `${m[1]}년 ${+m[2]}월` : String(s || ''); };
  /* «학사일정 · 교사 선교사» → «학사일정» */
  function baseTitle(t){
    let s = String(t || '').trim();
    s = s.replace(/\s*[·|—–-]\s*교사\s*선교사\s*$/, '').replace(/^교사\s*선교사\s*[·|—–-]\s*/, '');
    return flat(s) === flat(SITE) ? '' : s;
  }

  /* 화면이 이름을 정하지 않았을 때 — 화면 이름 › 탭 + 기관 + 오늘 */
  function autoName(){
    let p = null;
    if(typeof window.fileNameContext === 'function'){ try { p = window.fileNameContext(); } catch(e){ p = null; } }
    if(p && (Array.isArray(p) ? p.some(Boolean) : String(p).trim())) return Array.isArray(p) ? make(p) : make([p]);
    const parts = [];
    const crumb = document.querySelector('#tb-crumb .tb-p');
    const ct = crumb && crumb.textContent.trim();
    parts.push(ct || baseTitle(SAVED != null ? SAVED : document.title) || '홈');
    (window.__crumbTail || []).forEach(x => { if(x && x.label) parts.push(x.label); });
    try { if(window.OrgBar && OrgBar.current) parts.push(orgName(OrgBar.current)); } catch(e){}
    return make(parts, { date:true });
  }

  /* ── 인쇄하는 동안만 제목 바꾸기 ── */
  let SAVED = null, HOLD = false, armT = 0;
  function setTitle(name){ if(SAVED == null) SAVED = document.title; document.title = name; }
  function restore(){
    clearTimeout(armT); disarm();
    if(SAVED != null){ document.title = SAVED; SAVED = null; }
    HOLD = false;
  }
  // 인쇄 창이 기다리지 않고 바로 돌아오는 브라우저(폰 등) — 인쇄가 끝났다는 신호를 기다린다
  const later = () => restore();
  function arm(){
    disarm();
    armT = setTimeout(() => {
      ['pointerdown', 'keydown', 'focus'].forEach(ev => window.addEventListener(ev, later, { once:true, capture:true }));
    }, 1200);
  }
  function disarm(){ ['pointerdown', 'keydown', 'focus'].forEach(ev => window.removeEventListener(ev, later, { capture:true })); }

  function printAs(name, fn){
    const nm = name == null || name === '' ? autoName() : (Array.isArray(name) ? make(name) : make([name]));
    HOLD = true; setTitle(nm);
    const t0 = Date.now();
    try { (typeof fn === 'function' ? fn : () => window.print())(); }
    catch(e){ restore(); throw e; }
    // PC 크롬·엣지는 인쇄 창을 닫을 때까지 여기서 기다린다 → 바로 되돌리기
    if(Date.now() - t0 > 500) restore(); else arm();
    return nm;
  }

  window.addEventListener('beforeprint', () => { if(HOLD) return; setTitle(autoName()); });
  window.addEventListener('afterprint', () => setTimeout(restore, 0));

  /* Ctrl+P · ⌘P — 이름을 먼저 붙이고 인쇄 창을 연다 (브라우저 메뉴 인쇄는 beforeprint 가 맡는다)
     화면에 따로 정한 인쇄가 있으면(window.onPrintKey) 그걸 먼저 */
  document.addEventListener('keydown', e => {
    if(!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if(String(e.key).toLowerCase() !== 'p' && e.code !== 'KeyP') return;
    try { if(typeof window.onPrintKey === 'function' && window.onPrintKey(e) === true){ e.preventDefault(); return; } } catch(_){}
    e.preventDefault();
    printAs(null);
  }, true);

  window.FN = { make, clean, printAs, autoName, orgName, ym, today, baseTitle, restore,
    get holding(){ return HOLD; } };
})();
