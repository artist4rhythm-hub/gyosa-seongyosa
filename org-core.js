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

  function myOrgs(CU, key){
    const full = (POLICY[key] || POLICY.std)(CU);
    const g = curOrg();                                   // 🧭 전역 스위처: 단일 기관을 고르면
    if((g==='daniel'||g==='jihyebit') && full.includes(g)) return [g];   //    전 화면의 스코프가 그 기관으로 좁혀진다
    if(!unionOpen()){                                     // 🔒 연합이 잠겨 있으면 «반드시» 한 기관
      const p = primaryOrg(CU);
      if(p && full.includes(p)) return [p];
      return full.slice(0,1);
    }
    /* 🔓 연합 열림 — «권한 안에서만» 드러낸다.
       연합 키는 권한을 새로 주지 않는다. 두 겹의 AND 구조:
         ① 권한(접근 기관·페이지 권한) = 볼 «자격»          ← 관리자가 일일이 설정
         ② 연합 키                     = 지금 «드러낼지»     ← 주 소속 밖을 여는 스위치
       그래서 다른 기관 접근 권한이 없는 분은 키를 열어도 달라지는 게 없다. */
    return full;
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

  return { myOrgs, POLICY, UNIFIED_POS, JF, DF, unionOpen, setUnion, primaryOrg,
           curOrg, setCurOrg, combined, combinedHas, applyLocalOrgView, DEFAULT_COMBINED };
})();
