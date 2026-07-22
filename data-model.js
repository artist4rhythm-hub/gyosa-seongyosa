/* ═══════════════════════════════════════════════
   data-model.js — 연간 학사일정 데이터 모델 정의 + 검증
   Firebase 컬렉션: academicYears, academicEvents
   (기존 daniel-amatz 프로젝트에 추가)
   ═══════════════════════════════════════════════ */

// ── 부서·학년 마스터 (교사 선교사 시스템과 통일) ──
const DEPARTMENTS = ['주니어센터','유쓰센터','리더센터'];  // 부서(센터)
const GRADES = ['이레','로이1','로이2','샬롬1','샬롬2','라파1','라파2','닛시1','삼마1'];  // 학년(단)

// ── 시간대 ──
const TIME_SLOTS = {
  am:     '오전',
  pm:     '오후',
  allday: '종일',
};

// ── 행사 분류 (색상 기본값 포함) ──
const CATEGORIES = {
  event:    { label:'행사',    color:'#8B5CF6' },
  program:  { label:'프로그램', color:'#3B82F6' },
  break:    { label:'방학',    color:'#F97316' },
  exam:     { label:'시험',    color:'#16A34A' },
  holiday:  { label:'공휴일',   color:'#DC2626' },
  worship:  { label:'예배·기도회', color:'#0D9488' },
  admin:    { label:'행정',    color:'#6B7280' },
};

/* ───────────────────────────────────────────────
   academicYears/{year}  — 연도 + 학기·방학 골격
   ─────────────────────────────────────────────── */
const yearSchema = {
  year: 2026,                          // 문서 ID이자 연도
  label: '2026학년도',
  terms: [                             // 학기 기간
    { id:'t1', name:'1학기', start:'2026-02-09', end:'2026-07-24' },
    { id:'t2', name:'2학기', start:'2026-08-24', end:'2026-12-24' },
  ],
  breaks: [                            // 방학 기간 (주차 라벨용)
    { id:'b1', name:'Winter-Break', start:'2026-01-01', end:'2026-02-08' },
    { id:'b2', name:'Spring Break',  start:'2026-05-04', end:'2026-05-09' },
    { id:'b3', name:'Summer-Break',  start:'2026-07-19', end:'2026-08-23' },
    { id:'b4', name:'가을 방학',      start:'2026-11-02', end:'2026-11-03' },
    { id:'b5', name:'가정학습의 달',  start:'2026-12-27', end:'2026-12-31' },
  ],
  weekStart: 'sun',                    // 주 시작 요일 (이미지 = 일요일 시작)
  createdByUid:'', createdByName:'', createdAt:null,
};

/* ───────────────────────────────────────────────
   academicEvents/{id}  — 개별 행사
   한 행사가 = 기간 × 시간대 × 대상 × 요일 조합
   ─────────────────────────────────────────────── */
const eventSchema = {
  year: 2026,                          // 소속 연도 (조회 필터)
  title: '신년 수양회',                 // 표시 제목
  subtitle: '*새문안교회수양관',         // 부제 (선택)
  startDate: '2026-02-09',
  endDate:   '2026-02-13',             // 하루면 start=end

  timeOfDay: 'allday',                 // 'am' | 'pm' | 'allday'
  weekdays: null,                      // null=기간 내내, [1,2,3,4]=월~목만 (0=일 … 6=토)

  scope: 'all',                        // 'all' | 'dept' | 'grade'
  targets: [],                         // scope=dept면 ['유쓰센터','리더센터'], grade면 ['이레','로이1']

  category: 'event',                   // CATEGORIES 키
  color: '#B5A642',                    // 표시 색 (기본은 category 색, 덮어쓰기 가능)

  audience: 'both',                    // 'teacher'(교사전용) | 'parent'(학부모공개) | 'both'
  memo: '',                            // 교사용 상세 메모

  createdByUid:'', createdByName:'', createdAt:null,
};

/* ───────────────────────────────────────────────
   실제 이미지(2026 Seasonal Plan)의 행사들로 검증
   ─────────────────────────────────────────────── */
const SAMPLE_EVENTS = [
  // 1월 — 신년기도회 (월~금, 종일)
  { year:2026, title:'신년기도회 2주차', startDate:'2026-01-05', endDate:'2026-01-09',
    timeOfDay:'allday', weekdays:[1,2,3,4,5], scope:'all', category:'worship',
    audience:'both', color:'#6BA3A0' },
  { year:2026, title:'정기 휴가', startDate:'2026-01-19', endDate:'2026-01-23',
    timeOfDay:'allday', weekdays:[1,2,3,4,5], scope:'all', category:'break',
    audience:'teacher', color:'#C5E063' },
  { year:2026, title:'교재 및 준비물 취합', startDate:'2026-01-28', endDate:'2026-01-28',
    timeOfDay:'pm', scope:'all', category:'admin', audience:'teacher' },

  // 2월 — 시즌 오픈, 수양회, 설날
  { year:2026, title:'SEASON1 OPEN', startDate:'2026-02-09', endDate:'2026-02-09',
    timeOfDay:'am', scope:'all', category:'event', audience:'both', color:'#5A8F5A' },
  { year:2026, title:'환영식', startDate:'2026-02-09', endDate:'2026-02-09',
    timeOfDay:'am', scope:'all', category:'event', audience:'both', color:'#E89B4C' },
  { year:2026, title:'신년 수양회', subtitle:'*새문안교회수양관',
    startDate:'2026-02-10', endDate:'2026-02-12',
    timeOfDay:'allday', scope:'all', category:'event', audience:'both', color:'#B5A642' },
  { year:2026, title:'성경탐험 없음', startDate:'2026-02-19', endDate:'2026-02-19',
    timeOfDay:'am', scope:'dept', targets:['주니어센터','유쓰센터','리더센터'],
    category:'program', audience:'teacher', color:'#F5C99B' },
  { year:2026, title:'이음프로젝트 단장선생님', startDate:'2026-02-20', endDate:'2026-02-20',
    timeOfDay:'am', scope:'all', category:'program', audience:'teacher', color:'#B5E0B5' },

  // 3월 — 국토대장정 (금요일, 부서별)
  { year:2026, title:'국토대장정 연습 1', subtitle:'오전 · 유쓰센터',
    startDate:'2026-03-06', endDate:'2026-03-06',
    timeOfDay:'am', scope:'dept', targets:['유쓰센터'], category:'event',
    audience:'both', color:'#A5B4E0' },

  // 5월 — Spring Break, 비전트립 (학년별)
  { year:2026, title:'비전트립 (자연체험)', subtitle:'이레, 로이1·2',
    startDate:'2026-05-11', endDate:'2026-05-14',
    timeOfDay:'allday', scope:'grade', targets:['이레','로이1','로이2'],
    category:'event', audience:'both', color:'#C5E8A0' },
  { year:2026, title:'캠핑', subtitle:'라파1·2, 닛시1',
    startDate:'2026-05-11', endDate:'2026-05-13',
    timeOfDay:'allday', scope:'grade', targets:['라파1','라파2','닛시1'],
    category:'event', audience:'both', color:'#A0C8E8' },

  // 매주 목요일 말씀암송검사 (반복 → weekdays로)
  { year:2026, title:'말씀암송검사', startDate:'2026-02-26', endDate:'2026-12-17',
    timeOfDay:'allday', weekdays:[4], scope:'all', category:'admin',
    audience:'teacher', color:'#8B4A6B' },
];

// ── 검증 함수들 ──
function validateEvent(e){
  const errors = [];
  if(!e.title) errors.push('제목 없음');
  if(!e.startDate || !e.endDate) errors.push('날짜 없음');
  if(e.startDate > e.endDate) errors.push('시작>종료');
  if(!TIME_SLOTS[e.timeOfDay]) errors.push('시간대 오류');
  if(!['all','dept','grade'].includes(e.scope)) errors.push('scope 오류');
  if(e.scope!=='all' && (!e.targets || !e.targets.length)) errors.push('대상 없음');
  if(!CATEGORIES[e.category]) errors.push('분류 오류');
  if(!['teacher','parent','both'].includes(e.audience)) errors.push('공개대상 오류');
  return errors;
}

// 특정 날짜에 해당하는 행사 필터 (요일·기간 반영)
function eventsOnDate(events, dateStr){
  const dow = new Date(dateStr+'T00:00:00').getDay();  // 0=일
  return events.filter(e=>{
    if(dateStr < e.startDate || dateStr > e.endDate) return false;
    if(e.weekdays && !e.weekdays.includes(dow)) return false;
    return true;
  });
}

// 학부모용 필터
function forParents(events){
  return events.filter(e=> e.audience==='parent' || e.audience==='both');
}

if(typeof module !== 'undefined'){
  module.exports = { DEPARTMENTS, GRADES, TIME_SLOTS, CATEGORIES,
    SAMPLE_EVENTS, validateEvent, eventsOnDate, forParents };
}
