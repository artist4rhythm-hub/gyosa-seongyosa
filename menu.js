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
   orgs   : 그 기관에 접근하는 선생님만 (예: ['daniel'] — 나학평)
   ── 🔐 v143 화면 열기 권한 (관리자 › 접근 권한 표가 이 값을 그대로 씀) ──
   deny   : 이 역할은 늘 닫힘 (예: ['partner'] — 협력교사)
   roles  : 이 역할만 (예: 학부모 관리 = 수퍼 · 기관관리자)
   allow  : 관리자용이지만 사람마다 «열어 주기»(staff.pageAllow) 가능
   acc    : false 면 접근 권한 표에 안 나옴 (바깥 주소 · 관리자 화면 자체)
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
      { key:'myparents', label:'우리 반 학부모', icon:'diversity_1', href:'class-parents.html', badge:'myparents',
        desc:'담임 · 부담임 — 우리 반 학부모 연결 · QR 코드표 · 반 게시판 (공지 · 답글 · 가리기)',
        tabs:['학부모 연결','우리 반 게시판','코드표 인쇄'] },
      { key:'calendar', label:'학사일정', icon:'calendar_month', href:'academic.html',
        desc:'연간 행사 · 학기 · 방학',
        tabs:['월 달력','학기·방학','교사용','학부모용'] },
      { key:'minutes', label:'회의록', icon:'edit_note', href:'minutes.html',
        desc:'주간 회의 · 참석 · 결정 · 임무 · 댓글 — 기관별 · DA전체 · PDF·워드 출력', badge:'minutes',
        tabs:['회의록 목록','주제 찾기','내가 맡은 임무','출력 (PDF · 워드)'] },
      { key:'nhp', label:'나학평', icon:'menu_book', href:'nhp.html', badge:'nhp', orgs:['daniel'],
        desc:'나의 학교생활 평가서 — 과목 담당 입력 · 담임 · 검토관 · 최종 승인 · PDF · 영문판 · 지난 나학평',
        tabs:['내 할 일','진행 현황','출력 · 원본','지난 나학평','학기 설정'] },
      { key:'history', label:'연혁', icon:'auto_stories', href:'history.html',
        desc:'학년도 책장 — 해마다의 반·담임·학생과 반별 학부모 공지' },
      { key:'club', label:'동아리', icon:'palette', href:'club-admin.html',
        desc:'방과후 동아리·조이클래스 — 학기 설정·강사 모집·신청 취합·공고',
        tabs:['학기 설정','학사 휴강','질문 양식','모집 링크','신청 취합','요일·시간 그리드','신청 현황·배정'] },
      { key:'clubstat', label:'동아리 현황', icon:'calendar_month', href:'club-status.html',
        desc:'최종 확정 동아리 · 참여 명단 · 월별 일정 달력 — 학부모 공유 링크 게시' },
      { key:'gcal', label:'구글 캘린더', icon:'event', href:'calendar.html',
        desc:'구글 캘린더 보기' },
      { key:'cert', label:'증명서 발급', icon:'description', href:'cert.html', deny:['partner'],
        desc:'발급 · 목록',
        tabs:['증명서 발급','발급 목록'] },
    ]
  },
  {
    group: '근무 · 행정',
    icon: 'work',
    items: [
      { key:'att', label:'출근부', icon:'schedule', href:'checkin.html',
        desc:'출퇴근 · 달력 · 통계',
        tabs:['달력','통계'], deny:['partner'] },
      { key:'dir', label:'교직원 명부', icon:'contacts', href:'directory.html',
        desc:'연락처 · 부서 · 직책' },
      { key:'work', label:'근무시간', icon:'timer', href:'work.html', deny:['partner'],
        desc:'근무 통계 · 예외 입력',
        tabs:['근무 통계','예외 입력','근무시간 설정'] },
      { key:'approval', label:'전자결재', icon:'approval', href:'approval.html', deny:['partner'],
        desc:'기안 · 결재함 · 서명',
        tabs:['결재할 문서','내가 올린 문서','완료 문서','내 서명','직책 관리'],
        badge:'approval' },
      { key:'timetable', label:'시간표', icon:'grid_view', href:'timetable-final.html',
        desc:'시간표 틀 · 배정 · 완성 시간표',
        tabs:['시간표 틀 만들기','시간표 틀 보관함','수업 가능 시간','교실 배치','수업 정의','배치','완성 시간표'],
        alt:['schedule-assign.html','timetable.html'] },
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
      { key:'actexp', label:'활동 경비', icon:'festival', href:'act-expense.html',
        desc:'행사별 회비 · 지출 · 회계 보고',
        tabs:['활동 목록','참가자·회비','지출','회계 보고'] },
      { key:'buildexp', label:'공사 경비', icon:'construction', href:'build-expense.html',
        desc:'선입금 · 집행 · 정산 (지정된 담당자만)', admin:true, allow:true,
        tabs:['공사 목록','선입금','집행','정산 보고'] },
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
      { key:'family', label:'가정통신문', icon:'campaign', href:'family-notice.html',
        desc:'통신문 작성 · 발행 · 학부모 공유' },
      { key:'sharecenter', label:'공유 링크', icon:'link', href:'share-center.html',
        desc:'발행한 모든 공유 링크의 대장·조회 이력 — 살아있는 링크를 한눈에' },
      { key:'psite', label:'학부모 사이트', icon:'diversity_3',
        href:'https://artist4rhythm-hub.github.io/daniel-parents/index.html?stay=1', acc:false,
        desc:'학부모에게 보이는 그 화면 — 교사 모드로 열람·참여' },
      { key:'pubsite', label:'공개 홈페이지', icon:'public',
        href:'https://artist4rhythm-hub.github.io/public-web/index.html', acc:false,
        desc:'대외 안내용 홈페이지 — 다니엘 대문 (지혜빛은 안에서 이동)' },
    ]
  },
  {
    group: '관리',
    icon: 'settings',
    admin: true,
    items: [
      { key:'parentadm', label:'학부모 관리', icon:'family_restroom', href:'parent-admin.html',
        desc:'학부모 사이트 — 가입 코드·게시판·바로가기 링크·연결 현황',
        tabs:['가입 코드','바로가기 링크','게시판 관리','금칙어','연결 현황'], admin:true, roles:['super','org_admin'] },
      { key:'siteadm', label:'홈페이지 관리', icon:'language', href:'site-admin.html',
        desc:'공개 홈페이지 소식 — 작성·사진·게시/내리기 (별도 관리자 열쇠 필요)', admin:true, allow:true },
      { key:'adm', label:'관리자', icon:'admin_panel_settings', href:'admin.html',
        desc:'교직원 · 인사 · 보안 · 로그 · 오류 알림판', badge:'err',
        tabs:['통합관리','접근 권한','인사정보','부서·새 학년도','출근부 설정','접속·보안','로그인 기록','활동 로그','오류 알림판'], admin:true, acc:false },
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

/* ═══ 🔐 v143 화면 열기 권한 — 한 곳에서 판단 ═══
   사이드바 · 폰 «전체» · 홈 «전체 기능»·즐겨찾기 · 검색 · 주소로 바로 들어오기(guardPage) ·
   관리자 › 접근 권한 표 · 나학평 검토관 고르기가 모두 이 함수 하나를 쓴다.
   차례: 수퍼관리자는 늘 열림 → 역할로 닫힘(deny · roles) → 기본 열림이면 개인 차단(pageDeny)만 보고
         기본 닫힘(관리자용 allow 화면 · 다른 기관 화면)은 개인 «열어 주기»(pageAllow)가 있을 때만
   돌려주는 kind: super · base(기본 열림) · deny(닫음) · off(기본 닫힘) · allow(열어 줌) · role(역할로 늘 닫힘)
   why: off · allow 일 때 왜 기본이 닫혔는지 — 'admin'(관리자용) · 'org'(다른 기관) */
const MENU_ADMIN_ROLES = ['super','org_admin','tab_admin'];
function menuOrgsOf(u){ return (u && Array.isArray(u.orgs) && u.orgs.length) ? u.orgs : [u && u.org]; }
function menuAccess(it, u){
  if(!it) return { ok:false, kind:'role' };
  const adm = !!(it.admin || it.groupAdmin);
  if(!u) return { ok:!adm, kind:'base' };
  if(u.role === 'super') return { ok:true, kind:'super' };
  if((it.deny||[]).includes(u.role) || (Array.isArray(it.roles) && !it.roles.includes(u.role))) return { ok:false, kind:'role' };
  const denied = Array.isArray(u.pageDeny) && u.pageDeny.includes(it.key);
  const allowed = Array.isArray(u.pageAllow) && u.pageAllow.includes(it.key);
  let why = '';
  if(adm && !MENU_ADMIN_ROLES.includes(u.role)){
    if(!it.allow) return { ok:false, kind:'role' };
    why = 'admin';
  } else if(Array.isArray(it.orgs) && it.orgs.length && !menuOrgsOf(u).some(o => it.orgs.includes(o))){
    why = 'org';
  }
  if(!why) return { ok:!denied, kind: denied ? 'deny' : 'base' };
  if(denied) return { ok:false, kind:'deny', why };
  return allowed ? { ok:true, kind:'allow', why } : { ok:false, kind:'off', why };
}
function menuCanSee(it, u){ return menuAccess(it, u).ok; }

/* 검색: 페이지명 · 설명 · 하위탭까지 매칭 (ok 를 주면 열 수 있는 화면만) */
function menuSearch(q, ok){
  const s = (q||'').trim().toLowerCase();
  if(!s) return [];
  const out = [];
  menuAllItems().filter(it => !ok || ok(it)).forEach(it => {
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
window.menuAccess = menuAccess;
window.menuCanSee = menuCanSee;
window.menuOrgsOf = menuOrgsOf;
window.MENU_ADMIN_ROLES = MENU_ADMIN_ROLES;
