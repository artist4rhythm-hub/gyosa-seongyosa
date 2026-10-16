/* ═══════════════════════════════════════════════════════════
   🏛 org-core.js — 기관 스코프 원장 (재정비 1단계)
   · 15개 파일에 흩어져 있던 myOrgs 5변종을 «정책표»로 통일
   · 각 페이지는 자신의 기존 동작과 100% 동일한 정책 키를 물려받는다
   · 3단계(전역 스위처)에서 «함께 보기 허용 목록»을 systemConfig로
     읽는 훅이 이 파일에 합류할 예정
   ═══════════════════════════════════════════════════════════ */
window.orgCore = (function(){
  const JF = ['jihyebit','daniel'];         // 다수 페이지의 기존 순서
  const DF = ['daniel','jihyebit'];
  const UNIFIED_POS = ['교장','교감','행정실장'];
  const base = CU => (CU && CU.orgs && CU.orgs.length) ? CU.orgs.slice()
                   : (CU && CU.org ? [CU.org] : []);
  const POLICY = {
    /* 학사일정 — 모든 교직원 양기관, 내 기관 먼저 */
    academic(CU){ let l = DF.slice();
      if(CU && CU.org && l.includes(CU.org)) l = [CU.org, ...l.filter(o=>o!==CU.org)];
      return l; },
    /* 표준 — 수퍼 양기관, 그 외 «접근 기관(orgs)» 존중 */
    std(CU){ if(!CU) return []; if(CU.role==='super') return JF.slice(); return base(CU); },
    stdDF(CU){ if(!CU) return []; if(CU.role==='super') return DF.slice(); return base(CU); },
    /* 표준 + 직책 승격(교장·교감·행정실장 양기관) */
    unified(CU){ if(!CU) return [];
      if(CU.role==='super' || UNIFIED_POS.includes(CU.position||'')) return JF.slice();
      return base(CU); },
    unifiedDF(CU){ if(!CU) return [];
      if(CU.role==='super' || UNIFIED_POS.includes(CU.position||'')) return DF.slice();
      return base(CU); },
  };
  /* ── 🤝 연합 — 두 기관을 함께 보는 «열린 상태» ──
     · sessionStorage라 «이 탭에서만» 유지된다 (탭을 닫으면 자동 잠김)
     · 잠긴 상태가 기본이며, 그때는 어떤 화면도 한 기관만 본다 */
  const UNION_KEY = 'gyosa_union';
  function unionOpen(){ try{ return sessionStorage.getItem(UNION_KEY)==='1'; }catch(e){ return false; } }
  function setUnion(on){
    try{ on ? sessionStorage.setItem(UNION_KEY,'1') : sessionStorage.removeItem(UNION_KEY); }catch(e){}
    if(!on){ try{ if(curOrg()==='all') localStorage.removeItem('gyosa_curorg'); }catch(e){} }
    try{ window.dispatchEvent(new CustomEvent('unionchange', { detail:{ open:!!on } })); }catch(e){}
  }
  /* 주 소속 — 명부의 대표 기관(staff.org)이 곧 평소에 보는 기관 */
  function primaryOrg(CU){
    if(!CU) return '';
    const b = base(CU);
    const p = CU.primaryOrg || CU.org || '';
    if((p==='daniel'||p==='jihyebit') && (!b.length || b.includes(p))) return p;
    return b[0] || '';
  }

  /* 🔒 lockTo — 모든 화면이 통과하는 «단 하나의» 잠금 함수
     · list  = 그 기능이 스스로 계산한 «볼 자격이 있는 기관» (권한은 각 기능이 정한다)
     · 연합 잠김 → 그중 주 소속 하나만 / 연합 열림 → list 그대로
     연합은 권한을 넓히지도, 좁히지도 않는다. 잠금만 건다. */
  function lockTo(CU, list){
    const L = (list || []).filter(o => o==='daniel' || o==='jihyebit');
    if(!L.length) return [];
    const g = curOrg();                                   // 전역 스위처로 한 기관을 골랐다면 그것
    if((g==='daniel'||g==='jihyebit') && L.includes(g)) return [g];
    if(unionOpen()) return L;
    const p = primaryOrg(CU);
    if(p && L.includes(p)) return [p];
    return L.slice(0,1);
  }

  function myOrgs(CU, key){
    const full = (POLICY[key] || POLICY.std)(CU);
    return lockTo(CU, full);                              // 🔒 잠금은 lockTo 한 곳에서만
  }

  /* ── 🧭 전역 기관 컨텍스트 (3단계) ── */
  function curOrg(){
    try{ const q = new URLSearchParams(location.search).get('org');
      if(q==='daniel'||q==='jihyebit'||q==='all') return q; }catch(e){}
    try{ const v = localStorage.getItem('gyosa_curorg');
      if(v==='daniel'||v==='jihyebit'||v==='all') return v; }catch(e){}
    return '';
  }
  function setCurOrg(v, silent){
    try{ localStorage.setItem('gyosa_curorg', v); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent('orgchange', { detail:{ org:v, silent:!!silent } })); }catch(e){}
  }

  /* ── 👥 함께 보기 허용 목록 — systemConfig/orgView (로컬 캐시) ── */
  const DEFAULT_COMBINED = ['home','students','academic','directory','board'];
  function combined(){
    try{ const j = JSON.parse(localStorage.getItem('gyosa_orgview')||'null');
      if(Array.isArray(j)) return j; }catch(e){}
    return DEFAULT_COMBINED.slice();
  }
  const combinedHas = k => unionOpen() && combined().includes(k);   // 🤝 연합이 열려야 «전체 기관»이 뜬다
  function applyLocalOrgView(list){
    if(!Array.isArray(list)) return;
    try{ localStorage.setItem('gyosa_orgview', JSON.stringify(list)); }catch(e){}
  }

  /* 🧪 테스트 계정은 어떤 명단에도 나타나지 않는다 (명부·결재선·쪽지·출퇴근·강사 목록…) */
  function hideTest(snap){
    if(!snap || !snap.docs) return snap;
    const docs = snap.docs.filter(d=>{ try{ return !((d.data()||{}).isTest); }catch(e){ return true; } });
    return { docs, size: docs.length, empty: !docs.length,
      forEach: (fn, t)=>docs.forEach(fn, t), metadata: snap.metadata, query: snap.query };
  }
  window.hideTest = hideTest;
  return { myOrgs, lockTo, POLICY, UNIFIED_POS, JF, DF, unionOpen, setUnion, primaryOrg,
           curOrg, setCurOrg, combined, combinedHas, applyLocalOrgView, DEFAULT_COMBINED };
})();

/* ═══════════════════════════════════════════════════════════
   ⚡ v133 — 교직원 명단 «가벼운 사본» (같은 탭 안에서만)
   · 교직원 문서에는 사진 · 결재 서명 그림이 들어 있어 명단 전체가 수백 KB ~ 1MB 넘게 무겁다.
     화면마다 이것을 다 받을 때까지 기다리느라 느린 연결(휴대폰 · 사파리)에서 화면이 늦게 떴다.
   · 한 번 받은 명단에서 사진 · 서명 · 알림 토큰 · 연락처 · 계좌처럼 무겁거나 민감한 칸은 빼고
     이 탭(sessionStorage)에만 잠깐 기억한다 — 탭을 닫으면 사라짐 · 로그인한 사람이 바뀌면 쓰지 않음.
     남기는 칸은 «이름 · 역할 · 기관 · 부서 · 직책 · 재직 상태»뿐 (정해 둔 칸만 — 새로 생기는 칸도 저절로 빠짐).
   · 이것을 쓰는 화면은 «먼저 사본으로 화면을 띄우고 → 곧바로 뒤에서 진짜 명단을 다시 받는다».
     결재선을 정하는 것처럼 저장에 쓰이는 판단은 진짜 명단을 받은 뒤에 한다 (staffLite.fresh).
   ═══════════════════════════════════════════════════════════ */
window.staffLite = (function(){
  const KEY = 'gs_staffLite_v133', MAX_AGE = 10 * 60000;
  const KEEP = ['name','role','org','orgs','dept','position','positionOrgs','acStatus','isTest','avatar','approved'];
  function lite(d){
    const o = {};
    for(const k of KEEP){
      if(!(k in d)) continue;
      const v = d[k];
      if(typeof v === 'string' && v.length > 300) continue;           // 그림 같은 긴 글자는 빼기
      if(v && typeof v === 'object' && !Array.isArray(v)) continue;   // 이름표 칸은 글자 · 목록 · 참거짓뿐
      o[k] = v;
    }
    return o;
  }
  /* 받은 명단(스냅샷)을 기억 — uid: 지금 로그인한 사람 */
  function put(snap, uid){
    try{
      if(!snap || !snap.docs || !uid) return;
      // 서버에 닿지 못해 이 기기에 남은 것만 돌려준 결과(빈 명단 등)는 기억하지 않는다
      if(snap.empty || !snap.docs.length || (snap.metadata && snap.metadata.fromCache)) return;
      const rows = snap.docs.map(d => [d.id, lite(d.data() || {})]);
      sessionStorage.setItem(KEY, JSON.stringify({ uid, at: Date.now(), rows }));
    }catch(e){ try{ sessionStorage.removeItem(KEY); }catch(_){} }
  }
  /* 기억해 둔 명단 — 스냅샷처럼 쓸 수 있게 (docs · forEach · size). 없거나 오래됐으면 null */
  function get(uid){
    try{
      const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if(!c || !uid || c.uid !== uid || !Array.isArray(c.rows)) return null;
      if(Date.now() - (c.at || 0) > MAX_AGE) return null;
      if(!c.rows.length) return null;
      const docs = c.rows.map(([id, d]) => ({ id, exists: () => true, data: () => JSON.parse(JSON.stringify(d)), __lite: true }));
      return { docs, size: docs.length, empty: !docs.length, forEach: (fn, t) => docs.forEach(fn, t), __lite: true, at: c.at };
    }catch(e){ return null; }
  }
  function drop(){ try{ sessionStorage.removeItem(KEY); }catch(e){} }
  return { put, get, drop, KEY };
})();
