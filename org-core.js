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
  function myOrgs(CU, key){ return (POLICY[key] || POLICY.std)(CU); }
  return { myOrgs, POLICY, UNIFIED_POS, JF, DF };
})();
