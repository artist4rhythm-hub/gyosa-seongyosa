/* ── 학생 재적·휴학 판정 — 학생관리 · 반편성 · 출석부가 함께 쓰는 «단 하나의 규칙» ──
   학생 문서
     · status : active 재학 · leave 휴학 · quit 자퇴 · grad 졸업 · egrad 조기졸업  (학생관리 «재적 상태»)
     · leaves : [{start:'YYYY-MM-DD', end:'YYYY-MM-DD' | ''}]                    (학생관리 «휴학 기간», end 비면 복학일 미정)
   판정 (날짜 ds 기준, 안 주면 오늘)
     ① 자퇴 · 졸업 · 조기졸업 → 그대로 (휴학 기간과 무관)
     ② ds 가 휴학 기간 안 → 휴학          (복학일을 넣었으면 그날이 지나면 저절로 재학)
     ③ 재적 상태가 «휴학»인데 ds 를 덮는 기간이 없을 때
          · 기간 기록이 하나도 없다        → 늘 휴학 (옛 자료·엑셀 등록)
          · 복학일 미정(끝 빈) 기간이 있다  → 그 기간이 곧 휴학이므로 휴학 아님 (시작 전)
          · 끝난 기간뿐이다               → 마지막 기간 뒤로도 휴학 (옛 자료 — 학생관리에 «확인 필요»로 표시)
     ④ 나머지 → 재학
   그래서 «재적 상태 = 재학»이어도 오늘이 휴학 기간 안이면 모든 화면에서 «휴학»으로 본다.
   학생관리 저장은 이 모양으로 맞춰 둔다: 복학일 미정 휴학 = 상태 «휴학» + 끝 빈 기간 / 날짜가 정해진 휴학 = 상태 «재학» + 기간 */
(function(){
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  function today(){ return ymd(new Date()); }
  function addDays(ds, n){ const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  const GONE = { quit:1, grad:1, egrad:1 };
  const stored = s => (s && s.status) || 'active';

  // 쓸 수 있는 휴학 기간만 (시작일 필수, 끝이 비면 복학 미정) — 시작일 순
  function periods(s){
    const arr = (s && Array.isArray(s.leaves)) ? s.leaves : [];
    return arr.filter(lv => lv && typeof lv.start === 'string' && lv.start)
      .map(lv => ({ start: lv.start, end: (typeof lv.end === 'string' ? lv.end : '') }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  const covers = (lv, ds) => ds >= lv.start && (!lv.end || ds <= lv.end);
  // ds 를 덮는 휴학 기간 (없으면 null)
  function period(s, ds){ ds = ds || today(); return periods(s).find(lv => covers(lv, ds)) || null; }
  // 재적 상태 «휴학»이 기간 밖 날짜에도 미치는 범위: '' = 처음부터, null = 안 미침, 'YYYY-MM-DD' = 그날 다음부터
  function statusAfter(s){
    const ps = periods(s);
    if(!ps.length) return '';
    if(ps.some(lv => !lv.end)) return null;
    return ps.reduce((a, lv) => lv.end > a ? lv.end : a, '');
  }
  // 옛 자료처럼 «상태 휴학 + 끝난 기간뿐»이라 기간 밖까지 휴학으로 보는 학생 — 학생관리에서 확인하도록 표시
  function needsCheck(s){
    if(stored(s) !== 'leave') return false;
    const a = statusAfter(s);
    return typeof a === 'string' && a !== '';
  }
  function onLeave(s, ds){
    if(!s) return false;
    ds = ds || today();
    const st = stored(s);
    if(GONE[st]) return false;
    if(period(s, ds)) return true;
    if(st === 'leave'){ const a = statusAfter(s); return a === '' || (a !== null && ds > a); }
    return false;
  }
  // 그날의 실제 상태: active | leave | quit | grad | egrad
  function status(s, ds){
    const st = stored(s);
    if(GONE[st]) return st;
    return onLeave(s, ds) ? 'leave' : 'active';
  }
  // 학적이 살아 있는가 (재학 또는 휴학 — 반 편성·출석부 명단 대상)
  function enrolled(s){ const st = stored(s); return st === 'active' || st === 'leave'; }
  // 짧은 설명: «~12/31 복학» · «복학일 미정» · «기간 미기록»
  function leaveNote(s, ds){
    ds = ds || today();
    if(!onLeave(s, ds)) return '';
    const lv = period(s, ds);
    const md = x => `${Number(x.slice(5,7))}/${Number(x.slice(8,10))}`;
    if(lv) return lv.end ? `~${md(lv.end)}` : '복학일 미정';
    return periods(s).length ? '기간 확인 필요' : '기간 미기록';
  }
  // 기간 [from, to] 가운데 하루라도 휴학인가 (행사·활동 참가자 거르기용)
  function leaveDuring(s, from, to){
    if(!s) return false;
    from = from || today(); to = to || from;
    if(GONE[stored(s)]) return false;
    if(periods(s).some(lv => lv.start <= to && (!lv.end || from <= lv.end))) return true;
    if(stored(s) === 'leave'){ const a = statusAfter(s); return a === '' || (a !== null && to > a); }
    return false;
  }
  // 날짜 집합(Set 또는 배열) 가운데 휴학인 날 수
  function leaveDays(s, days){
    let n = 0;
    (days && days.forEach ? days : []).forEach(d => { if(onLeave(s, d)) n++; });
    return n;
  }
  const LABEL = { active:'재학', leave:'휴학', quit:'자퇴', grad:'졸업', egrad:'조기졸업' };
  // 학생관리 저장용 — 고른 재적 상태 + 휴학 기간을 위 규칙에 맞는 모양으로 (복학일이 정해진 휴학은 상태 «재학» + 기간)
  function canonical(pick, leaves){
    if(pick !== 'leave') return pick;
    const ps = periods({ leaves });
    if(!ps.length || ps.some(lv => !lv.end)) return 'leave';
    const t = today();
    return ps.some(lv => lv.end >= t) ? 'active' : 'leave';   // 끝난 기간뿐이면 옛 모양 그대로 둔다
  }
  window.StuStatus = { today, addDays, periods, period, onLeave, leaveDuring, status, enrolled, leaveNote, leaveDays, needsCheck, canonical, LABEL };
})();
