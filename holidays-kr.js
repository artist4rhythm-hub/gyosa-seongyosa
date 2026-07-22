/* ═══════════════════════════════════════════════
   holidays-kr.js — 한국 공휴일 데이터 (내장 + 수동 보정)
   방법 B: 서버 없이 GitHub Pages에서 작동
   - 고정 공휴일: 규칙으로 자동 계산
   - 음력 명절(설날·추석)·석가탄신일: 연도별 확정값 테이블
   - 대체공휴일: 규칙 적용
   - 선거일 등 유동: 관리자가 수동 추가 (academicEvents에 category:'공휴일')
   ═══════════════════════════════════════════════ */

// 양력 고정 공휴일 (매년 동일)
const FIXED_HOLIDAYS = [
  { m:1,  d:1,  name:'새해 첫날' },
  { m:3,  d:1,  name:'삼일절' },
  { m:5,  d:5,  name:'어린이날' },
  { m:6,  d:6,  name:'현충일' },
  { m:8,  d:15, name:'광복절' },
  { m:10, d:3,  name:'개천절' },
  { m:10, d:9,  name:'한글날' },
  { m:12, d:25, name:'성탄절' },
];

// 음력 기반·유동 공휴일: 연도별 확정 테이블 (천문硏 발표 기준으로 갱신)
// 설날/추석은 연휴 3일, 석가탄신일은 음력 4/8 → 양력 환산값
const LUNAR_HOLIDAYS = {
  2026: [
    { date:'2026-02-16', name:'설날 연휴' },
    { date:'2026-02-17', name:'설날' },
    { date:'2026-02-18', name:'설날 연휴' },
    { date:'2026-05-24', name:'부처님오신날' },
    { date:'2026-09-24', name:'추석 연휴' },
    { date:'2026-09-25', name:'추석' },
    { date:'2026-09-26', name:'추석 연휴' },
  ],
  2027: [
    { date:'2027-02-06', name:'설날 연휴' },
    { date:'2027-02-07', name:'설날' },
    { date:'2027-02-08', name:'설날 연휴' },
    { date:'2027-05-13', name:'부처님오신날' },
    { date:'2027-09-14', name:'추석 연휴' },
    { date:'2027-09-15', name:'추석' },
    { date:'2027-09-16', name:'추석 연휴' },
  ],
  2028: [
    { date:'2028-01-26', name:'설날 연휴' },
    { date:'2028-01-27', name:'설날' },
    { date:'2028-01-28', name:'설날 연휴' },
    { date:'2028-05-02', name:'부처님오신날' },
    { date:'2028-10-02', name:'추석 연휴' },
    { date:'2028-10-03', name:'추석' },
    { date:'2028-10-04', name:'추석 연휴' },
  ],
};

// 대체공휴일 규칙: 설날·추석·어린이날이 주말과 겹치면 다음 평일
// (정확한 대체휴일은 유동적이라 연도 테이블로 보정하는 게 안전)
const SUBSTITUTE_HOLIDAYS = {
  2026: [
    { date:'2026-03-02', name:'삼일절 대체휴일' },   // 3/1 일요일
    { date:'2026-05-25', name:'부처님오신날 대체휴일' }, // 예시
    { date:'2026-08-17', name:'광복절 대체휴일' },   // 8/15 토요일
  ],
  2027: [],
  2028: [],
};

// YYYY-MM-DD 헬퍼
function ymd(y, m, d){ return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

// 특정 연도의 전체 공휴일 맵 반환 { 'YYYY-MM-DD': '이름' }
function getHolidaysKR(year){
  const map = {};
  FIXED_HOLIDAYS.forEach(h => { map[ymd(year, h.m, h.d)] = h.name; });
  (LUNAR_HOLIDAYS[year]||[]).forEach(h => { map[h.date] = h.name; });
  (SUBSTITUTE_HOLIDAYS[year]||[]).forEach(h => { map[h.date] = h.name; });
  return map;
}

// 특정 날짜가 공휴일인지 (공휴일명 or null)
function holidayName(dateStr, year){
  const y = year || parseInt(dateStr.slice(0,4),10);
  return getHolidaysKR(y)[dateStr] || null;
}

// 내장 데이터에 없는 연도인지 (수동 입력 안내용)
function hasHolidayData(year){
  return !!LUNAR_HOLIDAYS[year];
}

if(typeof window !== 'undefined'){
  window.getHolidaysKR = getHolidaysKR;
  window.holidayName = holidayName;
  window.hasHolidayData = hasHolidayData;
}
if(typeof module !== 'undefined'){ module.exports = { getHolidaysKR, holidayName, hasHolidayData }; }
