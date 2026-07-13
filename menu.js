/* ═══════════════════════════════════════════════
   메뉴 정의 — 시스템의 모든 페이지가 여기에 정의됩니다.
   새 기능 추가 시 아래 배열에 한 줄만 추가하면
   사이드바 · 검색 · 홈 지도 · 모바일 전체메뉴에 자동 반영됩니다.

   key    : 페이지 고유 키 (각 페이지에서 setActive에 사용)
   label  : 표시 이름
   icon   : Material Symbols 아이콘 이름
   href   : 파일명
   desc   : 한 줄 설명 (홈 지도·검색에 표시)
   tabs   : 하위 탭 목록 (검색·홈 지도에 노출)
   badge  : 뱃지 키 (BADGE_SOURCES에서 계산)
   admin  : true면 관리자만
   ═══════════════════════════════════════════════ */

const MENU = [
  {
    group: '학사',
    icon: 'school',
    items: [
      { key:'students', label:'학생관리', icon:'group', href:'students.html',
        desc:'명단 · 추출 · 통계 · 연락처',
        tabs:['전체 목록','재학생 명단','명단 추출','재적 통계','생일 명단','연락처'] },
      { key:'attend', label:'출석부', icon:'fact_check', href:'attend.html',
        desc:'출석 체크 · 통계',
        tabs:['출석 체크','통계','설정'] },
      { key:'class', label:'반편성', icon:'extension', href:'class.html',
        desc:'반 배정 · 담임' },
      { key:'calendar', label:'학사일정', icon:'calendar_month', href:'calendar.html',
        desc:'일정 관리' },
      { key:'cert', label:'증명서 발급', icon:'description', href:'cert.html',
        desc:'발급 · 목록',
        tabs:['증명서 발급','발급 목록'] },
    ]
  },
  {
    group: '근무 · 행정',
    icon: 'work',
    items: [
      { key:'att', label:'출근부', icon:'schedule', href:'checkin.html',
        desc:'출퇴근 · 명부 · 통계',
        tabs:['달력','통계','교직원 명부'] },
      { key:'work', label:'근무시간', icon:'timer', href:'work.html',
        desc:'근무 통계 · 예외 입력',
        tabs:['근무 통계','예외 입력','근무시간 설정'] },
      { key:'approval', label:'전자결재', icon:'approval', href:'approval.html',
        desc:'기안 · 결재함 · 서명',
        tabs:['결재할 문서','내가 올린 문서','완료 문서','내 서명','직책 관리'],
        badge:'approval' },
      { key:'timetable', label:'시간표틀', icon:'grid_view', href:'timetable.html',
        desc:'틀 만들기 · 수업 배치' },
    ]
  },
  {
    group: '경비',
    icon: 'payments',
    items: [
      { key:'payreq', label:'경비 지급 요청서', icon:'credit_card', href:'payreq.html',
        desc:'지급 요청 · 결재 · 취합',
        tabs:['지급 요청','내 신청내역','결재함','취합','설정·백업'],
        badge:'payreq' },
      { key:'expense', label:'수행성 경비', icon:'savings', href:'expense.html',
        desc:'경비 신청 · 취합 · 영수증',
        tabs:['경비 신청','신청 내역','취합','백업·정리'] },
    ]
  },
  {
    group: '소통',
    icon: 'forum',
    items: [
      { key:'message', label:'쪽지함', icon:'mail', href:'message.html',
        desc:'받은 쪽지 · 보낸 쪽지',
        tabs:['받은 쪽지','보낸 쪽지','새 쪽지'],
        badge:'message' },
      { key:'board', label:'게시판', icon:'push_pin', href:'board.html',
        desc:'글 · 댓글' },
    ]
  },
  {
    group: '관리',
    icon: 'settings',
    admin: true,
    items: [
      { key:'adm', label:'관리자', icon:'admin_panel_settings', href:'checkin.html#adm',
        desc:'교직원 · 인사 · 보안 · 로그',
        tabs:['통합관리','출근부 설정','인사정보','접속·보안','로그인 기록','활동 로그'], admin:true },
    ]
  },
];

/* 전체 페이지 평탄화 (검색·홈용) */
function menuAllItems(){
  const out = [];
  MENU.forEach(g => g.items.forEach(it => out.push({ ...it, group: g.group, groupIcon: g.icon, groupAdmin: g.admin })));
  return out;
}

/* 키로 찾기 */
function menuFind(key){ return menuAllItems().find(i => i.key === key) || null; }

/* 검색: 페이지명 · 설명 · 하위탭까지 매칭 */
function menuSearch(q){
  const s = (q||'').trim().toLowerCase();
  if(!s) return [];
  const out = [];
  menuAllItems().forEach(it => {
    // 페이지 자체 매칭
    if((it.label||'').toLowerCase().includes(s) || (it.desc||'').toLowerCase().includes(s) || (it.group||'').toLowerCase().includes(s)){
      out.push({ ...it, matchTab:null });
    }
    // 하위 탭 매칭
    (it.tabs||[]).forEach(t => {
      if(t.toLowerCase().includes(s)) out.push({ ...it, matchTab:t });
    });
  });
  // 중복 제거 (같은 페이지 + 같은 탭)
  const seen = new Set();
  return out.filter(r => {
    const k = r.key + '|' + (r.matchTab||'');
    if(seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, 12);
}

window.MENU = MENU;
window.menuAllItems = menuAllItems;
window.menuFind = menuFind;
window.menuSearch = menuSearch;
