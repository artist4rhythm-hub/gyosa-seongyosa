/* ═══════════════════════════════════════════════════════════
   ✏️ minutes-editor.js — 회의록 쓰기 (v-93)
   ① 회의(기관 · 종류 · 날짜 · 시각 · 장소) ② 참석(명부에서 · 불참 사유) ③ 주제(번호 개요 · 결정 · 임무 · 첨부)
   · Tab 들여쓰기 / Shift+Tab 내어쓰기 → 번호 (1) → 1) → I. → (I) 저절로
   · Pages · 한글 · 워드에서 복사해 붙이면 번호를 읽어 단계로, 엑셀 · Numbers 칸은 표로
   · 저장할 때마다 수정 이력 한 벌 · 임무는 담당 선생님 홈으로
   · 📝 v179 «내 임시 저장» — 쓰는 동안 저절로(자동 저장) · «임시 저장»으로 나만 보게 두었다가 «게시»
     보관함 mtgDrafts/{내 uid}_{회의록 id} — 쓴 사람만 읽고 씀 (보안 규칙 v48) · 이 기기(localStorage)에도 한 벌
   ═══════════════════════════════════════════════════════════ */
import { sanitizeInline, sanitizeTableHTML, cleanEditedTable, pdfPages, xlsxTable, FILE_MAX, readAsDataURL, cleanInlineCached, cleanTableCached } from './minutes-files.js';

let X = null;          // 바깥 문맥 (db · FS · C · STORE · CU · STAFF …)
/* 🔒 v175 보관함 이름 — 주임 회의록(?book=lead)은 leadMeetings · leadTasks · leadVersions (바깥 문맥 COL) */
const COL0 = { m: 'meetings', t: 'meetingTasks', v: 'meetingVersions' };
const COL = c => (c && c.COL) || (X && X.COL) || COL0;
let ED = null;         // 지금 쓰는 회의록
let R = null;          // 편집기 뿌리 (#mt)
const uid6 = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const esc = s => X.C.esc(s);

const CSS = `
.ed{margin:0 auto;--agw:340px}
/* 📐 v180 넓은 화면 — 편집기가 화면 폭을 다 쓰고, 오른쪽에 «📮 안건» 창 (폭은 편집기 폭으로 판단: .wide ≥ 1060 · .xwide ≥ 1400 · .nar < 640) */
.ed-main{min-width:0;max-width:1240px;margin:0 auto}
.ed.wide.ag-side .ed-cols{display:grid;grid-template-columns:minmax(0,1fr) var(--agw);gap:16px;align-items:start}
.ed.wide.ag-side .ed-main{max-width:none;margin:0}
.ed.xwide{--agw:380px}
.ed-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:sticky;top:calc(var(--hd-h, 56px) / var(--zoom, 1));z-index:20;background:var(--bg);padding:8px 0 10px}
.ed-top .lb{display:inline}
.mt-btn.ag-tg{border-color:#E3C878;background:#FFFBEA;color:#6A4A00}
.mt-btn.ag-tg.on{background:#F6E7B0;border-color:#D8B54E}
.mt-btn.ag-tg b{font-weight:900}
html[data-theme="dark"] .mt-btn.ag-tg{background:var(--gold-bg);border-color:var(--gold-line);color:var(--gold)}
.ed-ag{display:none;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;min-height:0}
.ed.wide.ag-side .ed-ag{display:flex;position:sticky;top:calc(var(--hd-h, 56px) / var(--zoom, 1) + var(--edtop, 60px));max-height:calc((100vh - var(--hd-h, 56px)) / var(--zoom, 1) - var(--edtop, 60px) - 14px);max-height:calc((100dvh - var(--hd-h, 56px)) / var(--zoom, 1) - var(--edtop, 60px) - 14px)}
.ed-f > .mt-seg{align-self:flex-start;max-width:100%;overflow-x:auto}
.ed:not(.wide).ag-drawer .ed-ag{display:flex;position:fixed;top:0;right:0;bottom:0;width:min(420px, 100%);border-radius:0;border-width:0 0 0 1px;z-index:900;box-shadow:-12px 0 40px rgba(0,0,0,.18);padding-bottom:env(safe-area-inset-bottom)}
.ed-agbg{display:none}
.ed:not(.wide).ag-drawer .ed-agbg{display:block;position:fixed;inset:0;background:rgba(15,25,21,.35);z-index:899}
.ag-hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line);background:#FFFBEA}
html[data-theme="dark"] .ag-hd{background:var(--gold-bg)}
.ag-hd b{font-size:14.5px;font-weight:900;white-space:nowrap}
.ag-hd .n{font-size:11.5px;font-weight:800;color:#6A4A00;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
html[data-theme="dark"] .ag-hd .n{color:var(--gold)}
.ag-hd .ib{font-family:inherit;border:0;background:transparent;color:var(--ink-3);cursor:pointer;font-size:14px;width:30px;height:30px;border-radius:8px}
.ag-hd .ib:hover{background:rgba(0,0,0,.06);color:var(--ink)}
.ag-tip{font-size:11.5px;color:var(--ink-3);line-height:1.55;padding:8px 14px 0}
.ag-ls{flex:1;overflow:auto;padding:8px 10px 10px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.ag-g{font-size:11.5px;font-weight:900;color:var(--ink-2);margin:8px 4px 6px;display:flex;align-items:center;gap:6px}
.ag-g small{font-weight:700;color:var(--ink-3)}
.agc{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:6px;background:var(--surface)}
.agc.doing{border-left:3px solid #2B6CB0}
.agc.in{background:var(--sb-mint-2);border-color:#9CCBB6}
.agc.hold{border-style:dashed}
.agc-t{font-size:13.5px;font-weight:900;line-height:1.45;word-break:break-word}
.agc-d{font-size:12.5px;line-height:1.6;color:var(--ink-2);white-space:pre-wrap;word-break:break-word;margin-top:3px;cursor:pointer}
.agc-d.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.agc-m{font-size:11px;color:var(--ink-3);margin-top:5px;display:flex;flex-wrap:wrap;gap:3px 8px;align-items:center}
.agc-m .sp{flex:1}
.agc-m .st{font-weight:900;color:#1E4E8C;background:#E6F0FB;border-radius:100px;padding:0 7px}
.agc-m button{font-family:inherit;font-size:12px;font-weight:800;border-radius:8px;height:28px;padding:0 10px;cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);white-space:nowrap}
.agc-m button.p{background:var(--sb-green);border-color:var(--sb-green);color:#fff}
.agc-m button.go{border-color:#9CCBB6;color:var(--sb-green)}
.agc-s{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11.5px;font-weight:800;color:var(--ink-2)}
.agc-s .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}
.agc-s .seg button{font-family:inherit;font-size:11.5px;font-weight:800;border:0;background:transparent;color:var(--ink-2);height:26px;padding:0 10px;cursor:pointer}
.agc-s .seg button+button{border-left:1px solid var(--line)}
.agc-s .seg button.on{background:var(--sb-house);color:#fff}
.agc-s .seg button.on.doing{background:#2B6CB0}
.agc-m b{color:var(--ink-2);font-weight:800}
.agc-m .ty{font-weight:800;color:#2B6CB0;background:#E6F0FB;border-radius:100px;padding:0 7px}
html[data-theme="dark"] .agc-m .ty{background:#1F3550;color:#9CC3F0}
.agc-b{display:flex;gap:6px;margin-top:8px}
.agc-b button{font-family:inherit;font-size:12px;font-weight:800;border-radius:8px;height:30px;padding:0 10px;cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--ink-2)}
.agc-b button.p{background:var(--sb-green);border-color:var(--sb-green);color:#fff}
.agc-b button.go{border-color:#9CCBB6;color:var(--sb-green);background:var(--surface)}
.ag-ft{border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ag-ft a{font-size:12px;font-weight:800;color:var(--sb-green);text-decoration:none;margin-left:auto}
.ag-em{font-size:12.5px;color:var(--ink-2);line-height:1.7;padding:14px 6px;text-align:center}
.et-ag{font-family:inherit;font-size:11px;font-weight:800;color:#6A4A00;background:#FBF0D6;border:0;border-radius:100px;padding:2px 8px;white-space:nowrap;cursor:pointer}
.et-ag i{font-style:normal;color:var(--sb-green)}.et-ag i.doing{color:#2B6CB0}
html[data-theme="dark"] .et-ag{background:#2A2416;color:#E3C878}
.et.flash{animation:etflash 1.6s ease}
@keyframes etflash{0%,40%{box-shadow:0 0 0 4px rgba(227,200,120,.55)}100%{box-shadow:0 0 0 0 rgba(227,200,120,0)}}
/* 📱 좁은 편집기 (폰 · 좁은 창) — 머리를 한 줄로: 글 없는 단추 · 저장 상태는 아래 한 줄 */
.ed.nar .ed-top{gap:6px;padding:6px 0 8px}
.ed.nar .ed-top .tt{flex:1 1 0;min-width:0}
.ed.nar .ed-top .tt b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ed.nar .ed-top .tt span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.ed.nar .ed-top .mt-sp{display:none}
.ed.nar .ed-top .mt-btn{height:34px;padding:0 10px;font-size:12.5px;gap:4px}
.ed.nar .ed-top .lb{display:none}
.ed-top .tt{display:flex;flex-direction:column}
.ed-top .tt b{font-size:20px;font-weight:900}
.ed-top .tt span{font-size:11.5px;color:var(--ink-3);font-weight:700}
.ed-sec{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:14px}
.ed-sh{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900;margin-bottom:12px;flex-wrap:wrap}
.ed-sh i{font-style:normal;width:24px;height:24px;border-radius:50%;background:var(--sb-house);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center}
.ed-sh span{font-size:12px;font-weight:600;color:var(--ink-2)}
.ed-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.ed-f{display:flex;flex-direction:column;gap:5px;min-width:0}
.ed-f>label{font-size:12px;font-weight:800;color:var(--ink-2)}
.ed-f input,.ed-f select{font-family:inherit;font-size:14px;font-weight:600;height:40px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--surface);color:var(--ink);min-width:0}
.ed-f.w2{grid-column:span 2}.ed-f.w4{grid-column:1/-1}
.ed-chips{display:flex;flex-wrap:wrap;gap:6px}
.ed-cont{margin-top:12px;display:flex;align-items:center;gap:10px;background:#F3F8FF;border:1px solid #C9DCF5;border-radius:12px;padding:10px 14px;font-size:13px;color:#1E3A5F}
html[data-theme="dark"] .ed-cont{background:var(--info-bg);border-color:#2B4A72;color:var(--info)}
.ed-cont b{font-weight:900}
.at-grp{margin-bottom:10px}
.at-g{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-3);margin:8px 0 5px;padding-bottom:4px;border-bottom:1px dashed var(--line)}
.at-g b{font-size:12.5px;font-weight:900;color:var(--ink)}
.at-gin{margin-left:auto;font-family:inherit;font-size:11.5px;font-weight:800;color:var(--sb-green);background:transparent;border:0;cursor:pointer;padding:2px 4px}
.tchip{display:inline-flex;align-items:center;gap:0}
.tchip .tdel{font-family:inherit;border:1px solid #F3B4AC;background:#FDECEA;color:#B42318;border-radius:100px;width:22px;height:22px;margin-left:-6px;cursor:pointer;font-size:11px;font-weight:900;position:relative;top:-9px}
.mt-chip.ghost{border-style:dashed}.mt-chip small{font-weight:600;color:var(--ink-3)}
.ol.prev,.ob.prev{background:#F3F5F4;border-left:3px solid #BFCCC6}
.ol.prev .ol-t{color:#5E6A64}
html[data-theme="dark"] .ol.prev,html[data-theme="dark"] .ob.prev{background:#16241E;border-left-color:#2E463B}
html[data-theme="dark"] .ol.prev .ol-t{color:#A9BDB4}
.ol.cap,.ol.newcap{flex-wrap:wrap;margin-top:8px}
.ol.cap::before,.ol.newcap::before{flex-basis:100%;font-size:11px;font-weight:800;line-height:1.6;user-select:none}
.ol.cap::before{content:attr(data-cap);color:#7A8A82}
.ol.newcap::before{content:'✎ 이번 회의';color:#00704A;font-weight:900}
.ob.cap::before{content:attr(data-cap);display:block;font-size:11px;font-weight:800;color:#7A8A82;padding:4px 8px 0}
.ob.newcap{margin-top:22px}.ob.newcap::before{content:'✎ 이번 회의';display:block;font-size:11px;font-weight:900;color:#00704A;margin:-20px 0 4px}
.pk-top{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.pk-top input[type=search]{flex:1;min-width:220px;font-family:inherit;font-size:13.5px;height:38px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--surface);color:var(--ink)}
.pk-m{border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin-bottom:8px}
.pk-src{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 12px}.pk-src>span{font-size:12px;font-weight:800;color:var(--ink-2);margin-right:4px}
.pk-warn{margin:8px 0 2px;padding:10px 12px;border-radius:10px;background:#FFF4E5;border:1px solid #F2C99A;color:#6A3A0C;font-size:12.5px;line-height:1.6}
.pk-note{margin:8px 0 2px;padding:10px 12px;border-radius:10px;background:var(--sb-mint-2);color:var(--ink-2);font-size:12.5px;line-height:1.6}
html[data-theme="dark"] .pk-warn{background:#3A2A16;border-color:#6A4A22;color:#F2C99A}
.pk-m.pre{border-color:#9CCBB6;background:var(--sb-mint-2)}
.pk-m.pk-pin{border-color:#EADBA8;background:#FFFBEA}
html[data-theme="dark"] .pk-m.pk-pin{background:var(--gold-bg);border-color:var(--gold-line)}
.pk-mh{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px}
.pk-t{display:flex;align-items:baseline;gap:7px;font-size:13px;padding:5px 2px;cursor:pointer;flex-wrap:wrap}
.pk-t input{accent-color:var(--sb-green);position:relative;top:2px}
.pk-t span{font-weight:700}.pk-t small{color:var(--ink-3);font-size:11.5px}.pk-t small em{font-style:normal;color:#B45309;font-weight:800}
.pk-t .md-hit{font-style:normal;background:#FFE08A;border-radius:3px}
.at-list{display:flex;flex-wrap:wrap;gap:6px}
.at{font-family:inherit;font-size:13px;font-weight:700;border:1px solid var(--line);background:var(--surface);color:var(--ink-3);border-radius:10px;padding:6px 11px;cursor:pointer;display:inline-flex;gap:5px;align-items:center}
.at.o{background:#E8F3EF;border-color:#9CCBB6;color:#00704A}
.at.x{background:#FDECEA;border-color:#F3B4AC;color:#B42318}
.at small{font-weight:800;font-size:11px}
html[data-theme="dark"] .at.o{background:#123326;border-color:#2BAE7E;color:#3FCB96}
html[data-theme="dark"] .at.x{background:#3A1B1B;border-color:#7F2A2A;color:#F87171}
.ab{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:13px}
.ab b{min-width:64px}
.ab button{font-family:inherit;font-size:12px;font-weight:700;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:100px;padding:4px 11px;cursor:pointer}
.ab button.on{background:#FDECEA;border-color:#F3B4AC;color:#B42318}
.ab input{font-family:inherit;font-size:12.5px;height:30px;border:1px solid var(--line);border-radius:8px;padding:0 9px;width:160px;background:var(--surface);color:var(--ink)}
.et{border:1px solid var(--line);border-radius:14px;margin-bottom:12px;background:var(--surface)}
.et.focus{border-color:#9CCBB6;box-shadow:0 0 0 3px rgba(0,112,74,.07)}
.et-h{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line-soft)}
.et-no{font-weight:900;font-size:15px;min-width:24px}
.et-title{flex:1;min-width:0;font-family:inherit;font-size:15px;font-weight:800;border:0;outline:none;background:#FFF9C4;color:#1F2320;border-radius:6px;padding:6px 9px}
.et-title::placeholder{color:#B8A960;font-weight:600}
.et-thr{font-size:11px;font-weight:800;color:#2B6CB0;background:#E6F0FB;border-radius:100px;padding:2px 8px;white-space:nowrap}
.et-h .ib{font-family:inherit;border:0;background:transparent;color:var(--ink-3);cursor:pointer;font-size:13px;padding:4px 6px;border-radius:6px}
.et-h .ib:hover{background:var(--sb-mint-2);color:var(--ink)}
.et-sum{font-size:12px;color:var(--ink-3);display:none}
.et.fold .et-in{display:none}.et.fold .et-sum{display:inline}
.et-in{padding:8px 12px 12px}
.et-bar{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.et-bar button{font-family:inherit;font-size:12px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:8px;height:28px;padding:0 9px;cursor:pointer}
.et-bar button:hover{border-color:var(--sb-green);color:var(--sb-green)}
.et-bar .sep{width:1px;height:18px;background:var(--line);margin:0 4px}
.et-bar .tip{font-size:11.5px;color:var(--ink-3);margin-left:6px}
.et-body{min-height:34px;border-radius:8px;padding:2px 0}
.et-body.drop{outline:2px dashed var(--sb-green);outline-offset:2px}
.ol{display:flex;gap:6px;align-items:flex-start;font-size:14px;line-height:1.75}
.ol[data-lv="1"]{padding-left:22px}.ol[data-lv="2"]{padding-left:48px}.ol[data-lv="3"]{padding-left:74px}.ol[data-lv="4"]{padding-left:100px}
.ol-n{flex:none;min-width:26px;color:var(--ink-2);font-weight:600;user-select:none}
.ol-t{flex:1;min-width:0;outline:none;padding:1px 4px;border-radius:5px;white-space:pre-wrap;word-break:break-word}
.ol-t:focus{background:var(--sb-mint-2)}
.ol-t:empty::before{content:attr(data-ph);color:var(--ink-3)}
.ol-t mark,.dl-t mark,.kr-t mark{background:#FFF59D;color:inherit}
.ob{margin:6px 0 6px 22px;border:1px solid var(--line);border-radius:10px;background:var(--bg);overflow:hidden}
.ob-bar{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding:6px 8px;border-bottom:1px solid var(--line);font-size:12px;font-weight:800;color:var(--ink-2)}
.ob-bar button{font-family:inherit;font-size:11.5px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:7px;height:26px;padding:0 8px;cursor:pointer}
.ob-bar .ob-cap{flex:1;min-width:120px;font-family:inherit;font-size:12px;height:26px;border:1px solid var(--line);border-radius:7px;padding:0 8px;background:var(--surface);color:var(--ink)}
.ob-c{padding:8px;overflow-x:auto;background:#fff}
.ob-c table{border-collapse:collapse;font-size:12.5px;color:#1F2320}
.ob-c td,.ob-c th{border:1px solid #C9C5B9;padding:5px 8px;min-width:40px;outline:none;vertical-align:top}
.ob-c th{background:#EEECE6}
.ob-c td:focus,.ob-c th:focus{box-shadow:inset 0 0 0 2px #00704A}
.ob-c img{display:block;max-width:100%;max-height:320px;border-radius:6px}
.ob-pg{display:flex;gap:6px;overflow-x:auto}.ob-pg img{height:150px;border:1px solid #E3E1DA}
.ob-ld{padding:16px;font-size:12.5px;color:var(--ink-2)}
.ob-lk{display:flex;gap:6px;padding:8px;flex-wrap:wrap}.ob-lk input{font-family:inherit;font-size:12.5px;height:30px;border:1px solid var(--line);border-radius:8px;padding:0 9px;flex:1;min-width:160px}
.et-sub{margin-top:10px;padding-top:8px;border-top:1px dashed var(--line)}
.et-sub>b{font-size:12.5px;font-weight:900}
.et-sub>span{font-size:11.5px;color:var(--ink-3);margin-left:6px}
.dl,.kr{display:flex;gap:8px;align-items:center;margin-top:6px;border-radius:10px;padding:5px 8px}
.dl{background:#EEF6F2}.kr{background:#FBF6E6;flex-wrap:wrap}
html[data-theme="dark"] .dl{background:#123326}html[data-theme="dark"] .kr{background:#2A2416}
.dl-b{font-size:11.5px;font-weight:900;color:#00704A;flex:none}.kr-b{font-size:11.5px;font-weight:900;color:#8A6D00;flex:none}
.dl-t,.kr-t{flex:1;min-width:160px;outline:none;font-size:13.5px;line-height:1.6;padding:2px 4px;border-radius:5px}
.dl-t:empty::before,.kr-t:empty::before{content:attr(data-ph);color:var(--ink-3)}
.kr-w{font-family:inherit;font-size:12px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;height:30px;padding:0 10px;cursor:pointer;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kr-w.none{color:var(--ink-3)}
.kr-d{font-family:inherit;font-size:12.5px;height:30px;border:1px solid var(--line);border-radius:8px;padding:0 6px;background:var(--surface);color:var(--ink)}
.xb{font-family:inherit;border:0;background:transparent;color:var(--ink-3);cursor:pointer;font-size:13px;padding:2px 6px;border-radius:6px}
.xb:hover{background:#FDECEA;color:#B42318}
.addb{font-family:inherit;font-size:12.5px;font-weight:800;border:1px dashed var(--line);background:transparent;color:var(--sb-green);border-radius:10px;padding:6px 12px;cursor:pointer;margin-top:8px}
.ed-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 16px;font-size:12.5px;color:var(--ink-2)}
.ed-foot b{color:var(--ink)}
.ed-top .tt span.ok{color:var(--sb-green)}.ed-top .tt span.warn{color:#B45309}
.ed-lv{display:flex;flex-direction:column;gap:8px}.ed-lv button{display:block;width:100%;text-align:left;height:auto;padding:10px 14px;font-size:13.5px;line-height:1.45}
.ed-lv button small{display:block;font-size:11.5px;font-weight:600;color:var(--ink-3);margin-top:2px}
.ed-rs{display:flex;align-items:center;gap:10px;background:#FFFBEA;border:1px solid #EADBA8;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#5C4A00;flex-wrap:wrap}
html[data-theme="dark"] .ed-rs{background:var(--gold-bg);border-color:var(--gold-line);color:var(--gold)}
.wp{position:fixed;z-index:500;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-md);width:280px;max-height:380px;display:flex;flex-direction:column}
.wp input[type=search]{font-family:inherit;font-size:13px;height:36px;border:0;border-bottom:1px solid var(--line);padding:0 12px;background:transparent;color:var(--ink);outline:none}
.wp .ls{overflow:auto;padding:4px}
.wp label{display:flex;gap:8px;align-items:center;font-size:13px;padding:6px 8px;border-radius:8px;cursor:pointer}
.wp label:hover{background:var(--sb-mint-2)}
.wp label small{color:var(--ink-3);font-size:11px;margin-left:auto}
.wp .gh{font-size:11px;font-weight:800;color:var(--ink-3);padding:6px 8px 2px}
.wp .ft{border-top:1px solid var(--line);padding:6px;display:flex;justify-content:flex-end}
@media (max-width:760px){ .ed-grid{grid-template-columns:1fr 1fr} .ed-f.w2{grid-column:1/-1} .ed-sec{padding:14px} .et-bar .tip{display:none} .ed-sh > span{display:none}
  .et-h{flex-wrap:wrap} .et-title{flex-basis:calc(100% - 34px)} .et-thr{order:5} .ol[data-lv="1"]{padding-left:8px} .ol[data-lv="2"]{padding-left:26px} .ol[data-lv="3"]{padding-left:44px} .ol[data-lv="4"]{padding-left:62px} .ob{margin-left:6px} }
`;

/* ═══ 열기 ═══ */
export async function openEditor(ctx, m, opts){
  X = ctx; opts = opts || {};
  R = document.getElementById('mt');
  if(!document.getElementById('ed-css')){ const s = document.createElement('style'); s.id = 'ed-css'; s.textContent = CSS; document.head.appendChild(s); }
  const C = X.C;
  const isNew = !m;
  let from = null;
  if(opts.from){
    try{ const s = await X.FS.getDoc(X.FS.doc(X.db, COL().m, opts.from)); if(s.exists()) from = { id: s.id, ...s.data() }; }catch(e){}
  }
  const org = m ? m.org : (from ? from.org : (opts.org && X.WRITE.includes(opts.org) ? opts.org : X.defaultOrg));
  const prev = !m ? (from || lastOf(org, '')) : null;
  ED = {
    id: m ? m.id : (opts.id || X.FS.doc(X.FS.collection(X.db, COL().m)).id),   // 📝 v179 새 회의록 임시 저장을 이어 쓰면 그 id 그대로
    isNew, baseRev: m ? (m.rev || 0) : 0, base: m ? JSON.parse(JSON.stringify(m)) : null,
    org,
    type: m ? (m.type || '') : (prev && X.typesOf(org).includes(prev.type) ? prev.type : (X.typesOf(org)[0] || '')),
    title: m ? (m.title || '') : '',
    date: m ? m.date : C.todayStr(),
    time: m ? (m.time || '') : (prev ? prev.time || '' : ''),
    place: m ? (m.place || '') : (prev ? prev.place || '' : ''),
    att: m ? JSON.parse(JSON.stringify(m.att || {})) : rosterFrom(prev),
    attNames: m ? { ...(m.attNames || {}) } : { ...((prev && prev.attNames) || {}) },
    guests: m ? (m.guests || '') : '',
    writerUid: m ? (m.writerUid || '') : X.CU.uid,
    writerName: m ? (m.writerName || '') : (X.CU.name || ''),
    imported: m ? !!m.imported : false,
    topics: m ? JSON.parse(JSON.stringify(m.topics || [])) : [],
    dirty: false, saving: false, from,
    kept: false, resume: !!opts.draft, srvAt: 0, _try: Date.now(), _ready: false,   // 📝 v179 kept = «임시 저장»을 눌렀음 · resume = 목록 «이어서 쓰기»로 들어옴
  };
  if(from) ED.topics = carryTopics(from, from.topics || [], true);
  if(!ED.topics.length) ED.topics = [blankTopic()];
  window.__mtDirty = false;
  paint();
  await checkDraft(opts.draftDoc);
  if(!isNew) X.FS.updateDoc(X.FS.doc(X.db, COL().m, ED.id), { editing: { uid: X.CU.uid, name: X.CU.name || '', at: Date.now() } }).catch(()=>{});
}
function lastOf(org, type){
  const L = X.LIST.filter(x => x.org === org && !x.deleted && (!type || x.type === type)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return L[0] || null;
}
function rosterFrom(prev){
  const att = {};
  if(prev && !prev.imported) for(const [u, a] of Object.entries(prev.att || {})) if(a && (a.s === 'o' || a.s === 'x')) att[u] = { s: 'o' };
  return att;
}
const blankTopic = () => ({ id: uid6('t'), title: '', body: [{ k: 'l', lv: 1, h: '' }], dec: [], tasks: [] });
/* 지난 회의 주제를 «이어 쓰는 주제»로 — 지난 내용·결정·못 끝낸 임무는 회색(from)으로, 그 아래부터 이번 회의
   tasks = { key: 임무 문서 } (상태 확인용) */
function carryTopics(pm, topics, withContent, tasks, cross){
  const C = X.C;
  tasks = tasks || X.TASKS;
  return topics.map(t => {
    const body = [];
    if(withContent !== false){
      let nf = 0;
      /* 🔒 v175 다른 회의록(회의록 ↔ 주임 회의록)에서 가져올 때 — 사진 · PDF · 문서는 그쪽 보관함에 있어 옮기지 않고 한 줄로 알린다 */
      (t.body || []).forEach(b => { if(!b || b.k === 'wait') return; if(cross && (b.k === 'img' || b.k === 'pdf' || b.k === 'file')){ nf++; return; } body.push({ ...b, from: b.from || pm.date }); });
      if(nf) body.push({ k: 'l', lv: 1, h: esc(`· (사진 · 문서 ${nf}개는 «${cross}»의 원래 회의록에 있어요)`), from: pm.date });
      (t.dec || []).filter(d => C.textOf(d.h).trim()).forEach(d => body.push({ k: 'l', lv: 1, h: '· 지난 결정: ' + d.h, from: pm.date }));
    }
    (t.tasks || []).forEach(k => {
      const d = tasks[C.taskKey(pm.id, k.id)] || {};
      if(d.status === 'done') return;
      const who = (k.uids || []).map(u => (k.names || {})[u] || '').filter(Boolean).join(', ');
      body.push({ k: 'l', lv: 1, h: esc(`· 지난 임무: ${C.textOf(k.h)}${who ? ' · ' + who : ''} (${(C.STATUS[d.status] || C.STATUS.todo).l})`), from: pm.date });
    });
    body.push({ k: 'l', lv: 1, h: '' });                    // 이번 회의 내용은 여기부터
    return { id: uid6('t'), title: t.title || '', thr: t.thr || `${pm.id}:${t.id}`, thrFrom: pm.date, body, dec: [], tasks: [] };
  });
}

/* ═══ 그리기 ═══ */
function paint(){
  const C = X.C;
  const types = X.typesOf(ED.org);
  if(ED.type && !types.includes(ED.type)) types.push(ED.type);
  const orgSeg = ED.isNew
    ? `<div class="mt-seg">${X.WRITE.map(o => `<button type="button" class="${o === 'da' ? 'da ' : ''}${ED.org === o ? 'on' : ''}" data-e="org" data-v="${o}">${esc(C.MORG[o])}</button>`).join('')}</div>`
    : `<div style="font-size:14px;font-weight:800;padding:9px 0">${esc(C.MORG[ED.org])} <span style="font-size:11.5px;color:var(--ink-3);font-weight:600">(만든 뒤엔 바꿀 수 없어요)</span></div>`;
  R.innerHTML = `<div class="ed">
    <div class="ed-top"><button class="mt-btn" data-e="cancel" title="나가기">‹<span class="lb"> 나가기</span></button>
      <div class="tt"><b>${ED.isNew ? '새 회의록' : '회의록 고치기'}</b><span id="ed-saved">${ED.isNew ? '쓰는 동안 «내 임시 저장»에 저절로 남아요 · 게시하기 전엔 나만 보여요' : `${esc(C.fmtMDY(ED.date))} ${esc(C.titleOf(ED))} · 고친 것은 게시하기 전엔 나만 보여요`}</span></div>
      <div class="mt-sp"></div>
      ${agOn() ? `<button class="mt-btn ag-tg" data-e="agtog" id="ed-agtg" aria-controls="ed-ag" title="올라온 안건 — 보면서 쓰기">📮<span class="lb"> 안건</span> <b></b></button>` : ''}
      <button class="mt-btn" data-e="preview" title="문서로 미리보기">👁<span class="lb"> 문서로 미리보기</span></button>
      <button class="mt-btn" data-e="keep" title="게시하지 않고 나만 보이게 두기 — 목록 위 «내 임시 저장»에서 이어서 써요">📝<span class="lb"> 임시 저장</span></button>
      <button class="mt-btn p" data-e="save">${pubLabel()}</button></div>
    <div class="ed-cols"><div class="ed-main">
    <div id="ed-rs"></div>
    <section class="ed-sec"><div class="ed-sh"><i>1</i>회의</div>
      <div class="ed-grid">
        <div class="ed-f w4"><label>기관</label>${orgSeg}</div>
        <div class="ed-f w4"><label>회의 종류</label><div class="ed-chips" id="ed-types">${typeChipsHTML()}</div></div>
        <div class="ed-f w2"><label>제목 <span style="font-weight:600;color:var(--ink-3)">(비우면 «${esc(C.titleOf({ type: ED.type }))}»)</span></label><input id="ed-title" value="${esc(ED.title)}" placeholder="${esc(C.titleOf({ type: ED.type }))}"></div>
        <div class="ed-f"><label>날짜</label><input type="date" id="ed-date" value="${esc(ED.date)}"></div>
        <div class="ed-f"><label>시각</label><input type="time" id="ed-time" value="${esc(ED.time)}"></div>
        <div class="ed-f w2"><label>장소</label><input id="ed-place" value="${esc(ED.place)}" placeholder="예: 2층 회의실"></div>
        <div class="ed-f w2"><label>쓴 사람</label><input value="${esc(ED.writerName || X.CU.name || '')}" disabled></div>
      </div>
      <div id="ed-cont"></div></section>
    <section class="ed-sec"><div class="ed-sh"><i>2</i>참석 <span>누르면 참석 → 불참 → 빼기 · 교직원 명부에서 불러와요</span><div class="mt-sp"></div>
      <button type="button" class="mt-btn sm" data-e="allin">모두 참석</button><button type="button" class="mt-btn sm" data-e="addppl">＋ 다른 사람</button></div>
      <div id="ed-att"></div><div id="ed-abs"></div>
      <div class="ed-f" style="margin-top:12px"><label>그 외 참석 (손님 · 외부 강사 등)</label><input id="ed-guests" value="${esc(ED.guests)}" placeholder="예: 김○○ 대표님"></div></section>
    <section class="ed-sec"><div class="ed-sh"><i>3</i>주제 <span>Tab 들여쓰기 · Shift+Tab 내어쓰기 — 번호는 (1) → 1) → I. → (I) 로 저절로 · Pages · 한글에서 복사해 붙여도 번호를 알아봐요</span></div>
      <div id="ed-topics">${ED.topics.map(topicHTML).join('')}</div>
      <button type="button" class="addb" data-e="addtopic">＋ 주제 추가</button> <button type="button" class="addb" data-e="pick">↩ 이전 회의 주제 가져오기</button></section>
    <div class="ed-foot"><span id="ed-note" style="flex:1"></span><button class="mt-btn" data-e="keep">📝<span class="lb"> 임시 저장</span></button><button class="mt-btn p" data-e="save">${pubLabel()}</button></div>
    </div>${agOn() ? `<aside class="ed-ag" id="ed-ag" aria-label="올라온 안건"></aside><div class="ed-agbg" data-e="agclose"></div>` : ''}</div>
  </div>`;
  ED.topics.forEach(t => { const el = R.querySelector(`.et[data-tid="${t.id}"]`); if(el) hydrate(el, t); });
  paintAtt(); paintCont(); renumAll(); note();
  bind(); fit(); paintAg();
}
/* ═══ 📐 v180 편집기 폭에 맞추기 — 넓으면 안건 창을 옆에 · 좁으면 머리를 한 줄로 ═══ */
let RO = null, FIT_RS = null;
function fit(){
  const ed = R && R.querySelector('.ed'); if(!ed) return;
  const apply = () => {
    if(!ED || !ed.isConnected) return;
    const w = ed.getBoundingClientRect().width / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1);
    ed.classList.toggle('wide', w >= 1060); ed.classList.toggle('xwide', w >= 1400); ed.classList.toggle('nar', w < 640);
    const top = ed.querySelector('.ed-top'); if(top) ed.style.setProperty('--edtop', Math.ceil(top.getBoundingClientRect().height / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1)) + 'px');
    agClass();
  };
  try{ if(RO) RO.disconnect(); RO = new ResizeObserver(() => requestAnimationFrame(apply)); RO.observe(ed); const top = ed.querySelector('.ed-top'); if(top) RO.observe(top); }
  catch(e){ window.removeEventListener('resize', FIT_RS); FIT_RS = () => { try{ fit(); }catch(_){} }; window.addEventListener('resize', FIT_RS); }
  apply();
}
/* ═══ 📮 v180 오른쪽 «안건» 창 — 올라온 안건을 보며 쓰기 · «＋ 주제로» · 게시하면 «다룸» ═══
   넓은 화면: 옆에 (닫으면 이 기기에 기억) · 좁은 화면(패드 세로 · 폰): «📮 안건» 단추로 여닫는 서랍 */
const agOn = () => !!(X && typeof X.agendas === 'function');
const agChip = (by, st) => `📮 ${esc(by || '')} 안건 · <i class="${st === 'doing' ? 'doing' : ''}">${st === 'doing' ? '▶ 진행 중' : '✓ 완료'}</i>`;   // 📮 v181 게시하면 이 상태로
function agSetSt(el, v){
  el._agSt = v === 'doing' ? 'doing' : 'done';
  const c = el.querySelector('.et-ag'); if(c) c.innerHTML = agChip(el._agBy, el._agSt);
  paintAg(); dirty();
}
const ymdOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const AGP = 'mtg_agpanel';
const agPref = () => { try{ return localStorage.getItem(AGP) || ''; }catch(e){ return ''; } };
function agList(){
  if(!agOn()) return [];
  return (X.agendas() || []).filter(a => (ED.org === 'lead' || a.org === ED.org) && !['used', 'done'].includes(a.status || 'open'));
}
function agInMap(){   // 이 편집기에 이미 넣은 안건 → 주제 번호
  const m = new Map();
  R.querySelectorAll('.et').forEach((el, i) => { if(el._ag) m.set(el._ag, { no: i + 1, el }); });
  return m;
}
function agClass(){
  const ed = R && R.querySelector('.ed'); if(!ed || !agOn()) return;
  const wide = ed.classList.contains('wide');
  const pref = agPref();
  if(ED.agInit == null && (agList().length || (X.agReady && X.agReady()))) ED.agInit = agList().length > 0;   // 처음 한 번만 정함
  const side = wide && (pref === 'open' || (pref !== 'closed' && !!ED.agInit));
  ed.classList.toggle('ag-side', side);
  if(wide) ed.classList.remove('ag-drawer');
  const tg = R.querySelector('#ed-agtg'); if(tg){ const on = side || ed.classList.contains('ag-drawer'); tg.classList.toggle('on', on); tg.setAttribute('aria-expanded', String(on)); }
}
function paintAg(){
  if(!agOn() || !ED || !R) return;
  const box = R.querySelector('#ed-ag'); if(!box) return;
  const C = X.C;
  const L = agList();
  const inMap = agInMap();
  const open = L.filter(a => (a.status || 'open') === 'open'), doing = L.filter(a => a.status === 'doing'), hold = L.filter(a => a.status === 'hold');
  const tg = R.querySelector('#ed-agtg b'); if(tg) tg.textContent = String([...open, ...doing].filter(a => !inMap.has(a.id)).length || '');
  const mineType = a => !a.type || a.type === ED.type;
  const who = a => a.byUid ? (a.byName || '') : (a.name || '');
  const card = a => {
    const hit = inMap.get(a.id), st = hit ? (hit.el._agSt || 'done') : '';
    return `<div class="agc${hit ? ' in' : ''}${a.status === 'hold' ? ' hold' : ''}${a.status === 'doing' ? ' doing' : ''}" data-agid="${esc(a.id)}">
      <div class="agc-t">${esc(a.title || '')}</div>
      ${a.desc ? `<div class="agc-d clamp" data-e="agmore" title="눌러서 모두 보기">${esc(a.desc)}</div>` : ''}
      <div class="agc-m">${a.status === 'doing' ? '<span class="st">진행 중</span>' : ''}<b>${esc(who(a))}</b><span>${esc(C.fmtMD(ymdOf(C.tsMs(a.at) || a.atMs || Date.now())))}</span>${a.type && !mineType(a) ? `<span class="ty">${esc(a.type)}</span>` : ''}<span class="sp"></span>
        ${hit ? `<button type="button" class="go" data-e="aggo" data-id="${esc(a.id)}">✓ ${hit.no}번 주제 ›</button>` : `<button type="button" class="p" data-e="agadd" data-id="${esc(a.id)}">＋ 주제로</button>`}</div>
      ${hit ? `<div class="agc-s">게시하면<span class="seg"><button type="button" data-e="agset" data-id="${esc(a.id)}" data-v="done" class="${st === 'done' ? 'on' : ''}">✓ 완료</button><button type="button" data-e="agset" data-id="${esc(a.id)}" data-v="doing" class="${st === 'doing' ? 'on doing' : ''}">▶ 진행 중</button></span></div>` : ''}</div>`;
  };
  const here = open.filter(mineType), other = open.filter(a => !mineType(a));
  const err = X.agErr && X.agErr();
  const keepOpen = new Set([...box.querySelectorAll('details[open][data-k]')].map(d => d.dataset.k));
  const keepClosed = new Set([...box.querySelectorAll('details[data-k]:not([open])')].map(d => d.dataset.k));
  const ls0 = box.querySelector('.ag-ls'), sc0 = ls0 ? ls0.scrollTop : 0;
  const det = (k, def) => keepOpen.has(k) || (!keepClosed.has(k) && def) ? ' open' : '';
  const SA = navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const left = [...here, ...doing].filter(a => !inMap.has(a.id)).length;
  box.innerHTML = `<div class="ag-hd"><b>📮 안건</b><span class="n">기다리는 ${open.length}${doing.length ? ` · 진행 중 ${doing.length}` : ''}</span><span class="mt-sp" style="flex:1"></span>
      ${typeof X.agNew === 'function' ? `<button type="button" class="mt-btn sm" data-e="agnew" title="안건 올리기">＋ 올리기</button>` : ''}
      <button type="button" class="ib" data-e="agclose" aria-label="안건 창 닫기" title="안건 창 닫기">✕</button></div>
    ${L.length ? `<div class="ag-tip">«＋ 주제로» → 게시하면 «완료» · 끝나지 않았으면 «진행 중»으로 (다음 회의에도 떠요)</div>` : ''}
    <div class="ag-ls">${err && /permission/.test(err) ? '<div class="ag-em">안건을 아직 불러올 수 없어요 — 보안 규칙 v50을 게시했는지 확인해 주세요.</div>' : ''}
      ${!L.length && !err ? `<div class="ag-em">${ED.org === 'lead' ? '주임 회의록' : esc(C.MORG[ED.org] || '')}에 올라온 안건이 없어요.<br>«＋ 올리기»로 미리 올려 둘 수 있어요.</div>` : ''}
      ${doing.length ? `<div class="ag-g">진행 중 — 지난 회의에서 이어서 <small>${doing.length}</small></div>${doing.map(card).join('')}` : ''}
      ${here.length ? `<div class="ag-g">${other.length ? `${esc(ED.type || '이 회의')} · 어느 회의든` : '기다리는 안건'} <small>${here.length}</small></div>${here.map(card).join('')}` : ''}
      ${other.length ? `<details data-k="other"${det('other', !here.length)}><summary class="ag-g" style="cursor:pointer">다른 회의 안건 <small>${other.length}</small></summary>${other.map(card).join('')}</details>` : ''}
      ${hold.length ? `<details data-k="hold"${det('hold', false)}><summary class="ag-g" style="cursor:pointer">보류한 안건 <small>${hold.length}</small></summary>${hold.map(card).join('')}</details>` : ''}</div>
    <div class="ag-ft">${left > 1 ? `<button type="button" class="mt-btn sm" data-e="agall">＋ ${left}건 모두 주제로</button>` : ''}${SA ? '' : `<a href="${esc(X.agUrl || 'minutes.html?agenda=1')}" target="_blank" rel="noopener">안건 창구 ↗</a>`}</div>`;
  const ls1 = box.querySelector('.ag-ls'); if(ls1 && sc0) ls1.scrollTop = sc0;
  agClass();
}
export function agendasChanged(){ try{ if(ED && R) paintAg(); }catch(e){ console.warn('agendas', e); } }
/* 안건 → 주제 (제목 = 안건 제목 · 내용 = 설명 한 줄씩 · 그 아래 빈 줄부터 회의 내용) */
function agTopic(a){
  const lines = String(a.desc || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 60);
  const body = lines.map(x => ({ k: 'l', lv: 1, h: esc(x) }));
  body.push({ k: 'l', lv: 1, h: '' });
  return { id: uid6('t'), title: String(a.title || '').slice(0, 150), body, dec: [], tasks: [], agendaId: a.id, agBy: (a.byUid ? a.byName : a.name) || '', agSt: 'done' };
}
function isBlankTopic(el){
  return !el.querySelector('.et-title').value.trim() && ![...el.querySelectorAll('.ol-t')].some(x => x.textContent.trim())
    && !el.querySelector('.ob, .dl, .kr') && !el._thr && !el._ag;
}
function agAdd(ids){
  const L = agList(), inMap = agInMap();
  const box = R.querySelector('#ed-topics');
  let last = null;
  for(const id of ids){
    const a = L.find(x => x.id === id); if(!a || inMap.has(id)) continue;
    const t = agTopic(a);
    const ets = [...box.querySelectorAll('.et')];
    const blank = ets.length === 1 && isBlankTopic(ets[0]) ? ets[0] : null;   // 처음 빈 주제 하나뿐이면 그 자리에
    box.insertAdjacentHTML('beforeend', topicHTML(t));
    const el = box.querySelector(`.et[data-tid="${t.id}"]`); hydrate(el, t);
    if(blank) blank.remove();
    inMap.set(id, { el }); last = el;
  }
  if(!last) return;
  renumAll(); dirty(); paintAg();
  const ed = R.querySelector('.ed');
  if(ed && ed.classList.contains('ag-drawer')){ ed.classList.remove('ag-drawer'); agClass(); }
  last.scrollIntoView({ block: 'center', behavior: 'smooth' });
  last.classList.remove('flash'); void last.offsetWidth; last.classList.add('flash');
}
function typeChipsHTML(){
  const list = X.typesOf(ED.org);
  const types = list.slice(); if(ED.type && !types.includes(ED.type)) types.push(ED.type);
  return types.map(t => `<span class="tchip${ED.type === t ? ' on' : ''}"><button type="button" class="mt-chip${ED.type === t ? ' on' : ''}" data-e="type" data-v="${esc(t)}">${esc(t)}${list.includes(t) ? '' : ' <small>(이 회의록만)</small>'}</button>${ED.typeEdit && list.includes(t) ? `<button type="button" class="tdel" data-e="deltype" data-v="${esc(t)}" aria-label="${esc(t)} 빼기">✕</button>` : ''}</span>`).join('')
    + `<button type="button" class="mt-chip" data-e="newtype">＋ 새 종류</button>`
    + `<button type="button" class="mt-chip ghost${ED.typeEdit ? ' on' : ''}" data-e="typeedit">${ED.typeEdit ? '✓ 고치기 끝' : '✎ 목록 고치기'}</button>`;
}
function paintTypes(){
  const box = R.querySelector('#ed-types'); if(box) box.innerHTML = typeChipsHTML();
  const t = R.querySelector('#ed-title');
  if(t){ t.placeholder = X.C.titleOf({ type: ED.type }); t.previousElementSibling.innerHTML = `제목 <span style="font-weight:600;color:var(--ink-3)">(비우면 «${esc(X.C.titleOf({ type: ED.type }))}»)</span>`; }
}
function topicHTML(t){
  return `<div class="et" data-tid="${esc(t.id)}">
    <div class="et-h"><span class="et-no"></span><input class="et-title" value="${esc(t.title || '')}" placeholder="주제 제목">
      ${t.thrFrom ? `<span class="et-thr">↩ ${esc(X.C.fmtMDY(t.thrFrom))} 회의에서 이어짐</span>` : ''}${t.agendaId ? `<button type="button" class="et-ag" data-e="agst" title="안건 창구에서 넣은 주제 — 누르면 게시할 때 «완료 ↔ 진행 중»">${agChip(t.agBy, t.agSt)}</button>` : ''}<span class="et-sum"></span>
      <button type="button" class="ib" data-e="tup" title="위로">↑</button><button type="button" class="ib" data-e="tdown" title="아래로">↓</button>
      <button type="button" class="ib" data-e="tfold" title="접기">접기</button><button type="button" class="ib" data-e="tdel" title="주제 빼기">✕</button></div>
    <div class="et-in">
      <div class="et-bar"><button type="button" data-e="bold" title="굵게 (⌘B)"><b>B</b></button><button type="button" data-e="mark" title="형광펜" style="background:#FFF59D;color:#1F2320">가</button>
        <button type="button" data-e="indent" title="들여쓰기 (Tab)">→</button><button type="button" data-e="outdent" title="내어쓰기 (Shift+Tab)">←</button><span class="sep"></span>
        <button type="button" data-e="addimg">＋ 사진</button><button type="button" data-e="addtbl">＋ 표</button><button type="button" data-e="adddoc">＋ 문서 · PDF</button><button type="button" data-e="addlink">＋ 링크</button>
        <span class="tip">표는 Numbers · 엑셀에서 칸을 복사해 그대로 붙여 넣어도 돼요 · 사진은 끌어다 놓기</span></div>
      <div class="et-body"></div>
      <div class="et-sub"><b>결정 사항</b><div class="et-decs"></div><button type="button" class="addb" data-e="adddec">＋ 결정 추가</button></div>
      <div class="et-sub"><b>임무</b><span>저장하면 담당 선생님 홈과 알림에 떠요</span><div class="et-tasks"></div><button type="button" class="addb" data-e="addtask">＋ 임무 추가 (담당은 여러 명도)</button></div>
    </div></div>`;
}
function hydrate(el, t){
  el._thr = t.thr || ''; el._thrFrom = t.thrFrom || ''; el._ed = t.ed || null;
  el._ag = t.agendaId || ''; el._agBy = t.agBy || ''; el._agSt = t.agSt === 'doing' ? 'doing' : 'done';   // 📮 v180 안건에서 넣은 주제 · v181 게시하면 완료 / 진행 중
  const body = el.querySelector('.et-body');
  (t.body && t.body.length ? t.body : [{ k: 'l', lv: 1, h: '' }]).forEach(b => body.appendChild(b.k === 'l' ? lineEl(b.lv, b.h, b.from) : blockEl(b)));
  const decs = el.querySelector('.et-decs');
  (t.dec || []).forEach(d => decs.appendChild(decEl(d)));
  const tasks = el.querySelector('.et-tasks');
  (t.tasks || []).forEach(k => tasks.appendChild(taskEl(k)));
}
function lineEl(lv, h, from){
  const d = document.createElement('div'); d.className = 'ol'; d.dataset.lv = X.C.clampLv(lv);
  if(from) d.dataset.from = from;
  d.innerHTML = `<span class="ol-n"></span><div class="ol-t" contenteditable="true" spellcheck="false" data-ph="내용을 적어 주세요"></div>`;
  d.querySelector('.ol-t').innerHTML = cleanInlineCached(h || '');
  return d;
}
function decEl(d){
  const el = document.createElement('div'); el.className = 'dl'; el.dataset.did = (d && d.id) || uid6('d');
  el.innerHTML = `<span class="dl-b">결정</span><div class="dl-t" contenteditable="true" data-ph="결정한 것을 한 줄로"></div><button type="button" class="xb" data-e="ddel" aria-label="빼기">✕</button>`;
  el.querySelector('.dl-t').innerHTML = cleanInlineCached((d && d.h) || '');
  return el;
}
function taskEl(k){
  const el = document.createElement('div'); el.className = 'kr'; el.dataset.kid = (k && k.id) || uid6('k');
  el._uids = (k && k.uids || []).slice(); el._names = { ...((k && k.names) || {}) };
  el.innerHTML = `<span class="kr-b">임무</span><div class="kr-t" contenteditable="true" data-ph="할 일"></div>
    <button type="button" class="kr-w" data-e="who"></button><input type="date" class="kr-d" value="${esc((k && k.due) || '')}" title="기한"><button type="button" class="xb" data-e="kdel" aria-label="빼기">✕</button>`;
  el.querySelector('.kr-t').innerHTML = cleanInlineCached((k && k.h) || '');
  whoLabel(el);
  return el;
}
function whoLabel(el){
  const b = el.querySelector('.kr-w'); const u = el._uids || [];
  const nm = x => X.nameOf(x) || (el._names || {})[x] || '?';
  b.textContent = u.length ? (u.length > 1 ? `${nm(u[0])} 외 ${u.length - 1}명` : nm(u[0])) : '담당 고르기';
  b.classList.toggle('none', !u.length);
}
function blockEl(b){
  const el = document.createElement('div'); el.className = 'ob'; el.dataset.k = b.k; el._b = { ...b };
  const bar = (label, extra) => `<div class="ob-bar"><span>${label}</span>${extra || ''}<input class="ob-cap" placeholder="설명 (선택)" value="${esc(b.cap || '')}">
    <button type="button" data-e="bup" title="위로">↑</button><button type="button" data-e="bdown" title="아래로">↓</button><button type="button" data-e="bdel" title="빼기">✕</button></div>`;
  if(b.k === 'tbl'){
    el.innerHTML = bar('표', `<button type="button" data-e="trow">＋ 줄</button><button type="button" data-e="tcol">＋ 칸</button><button type="button" data-e="trowd">− 줄</button><button type="button" data-e="tcold">− 칸</button>
      <button type="button" data-e="thead">머리 줄</button><button type="button" data-e="tcolor">칸 색</button><button type="button" data-e="tcenter">가운데</button>`) + `<div class="ob-c">${cleanTableCached(b.h || '')}</div>`;
    el.querySelectorAll('td,th').forEach(c => c.setAttribute('contenteditable', 'true'));
  } else if(b.k === 'img'){
    el.innerHTML = bar('사진') + `<div class="ob-c"><div class="ob-ld">사진 불러오는 중…</div></div>`;
    X.STORE.getImage(b.fid).then(src => { const c = el.querySelector('.ob-c'); if(c) c.innerHTML = X.C.okSrc(src) ? `<img src="${src}" alt="">` : '<div class="ob-ld">사진을 찾지 못했어요</div>'; });
  } else if(b.k === 'pdf'){
    el.innerHTML = bar(`📕 ${esc(b.name || 'PDF')} · ${(b.fids || []).length}쪽${b.fid ? ' · 원본 보관' : ''}`) + `<div class="ob-c"><div class="ob-pg"></div></div>`;
    const pg = el.querySelector('.ob-pg');
    (b.fids || []).slice(0, 6).forEach(f => X.STORE.getImage(f).then(src => { if(X.C.okSrc(src)){ const im = document.createElement('img'); im.src = src; pg.appendChild(im); } }));
  } else if(b.k === 'file'){
    el.innerHTML = bar(`📎 ${esc(b.name || '문서')}${b.size ? ' · ' + X.C.fmtSize(b.size) : ''}${b.link ? ' · 링크' : ' · 보관'}`) + (b.link ? `<div class="ob-lk"><input class="ob-url" value="${esc(b.link)}" placeholder="드라이브 링크"></div>` : '');
  } else if(b.k === 'link'){
    el.innerHTML = bar('🔗 링크') + `<div class="ob-lk"><input class="ob-url" value="${esc(b.url || '')}" placeholder="https://"><input class="ob-ttl" value="${esc(b.title || '')}" placeholder="보이는 이름 (예: 화재대피 시나리오)"></div>`;
  } else if(b.k === 'wait'){
    el.innerHTML = `<div class="ob-ld">${esc(b.msg || '올리는 중…')}</div>`;
  }
  return el;
}
function paintCont(){
  const box = R.querySelector('#ed-cont'); if(!box) return;
  if(!ED.isNew || ED.from){ box.innerHTML = ED.from ? `<div class="ed-cont">📋 <span><b>${esc(X.C.fmtMDY(ED.from.date))} ${esc(X.C.titleOf(ED.from))}</b>의 주제 ${(ED.from.topics || []).length}개를 이어 쓰는 주제로 불러왔어요.</span></div>` : ''; return; }
  const pm = X.LIST.filter(x => x.org === ED.org && x.type === ED.type && !x.deleted && x.date <= ED.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if(!pm){ box.innerHTML = ''; return; }
  let open = 0;
  (pm.topics || []).forEach(t => (t.tasks || []).forEach(k => { if((X.TASKS[X.C.taskKey(pm.id, k.id)] || {}).status !== 'done') open++; }));
  box.innerHTML = `<div class="ed-cont">↩ <span>지난 회의(<b>${esc(X.C.fmtMDY(pm.date))}</b>)에서 이어오기 — 주제 ${(pm.topics || []).length}개${open ? ` · 못 끝낸 임무 <b>${open}</b>` : ''}</span>
    <div class="mt-sp"></div><button type="button" class="mt-btn sm" data-e="cont" data-mid="${esc(pm.id)}">골라서 불러오기</button></div>`;
}
function poolOf(org){
  const C = X.C;
  if(org === 'lead') return X.STAFF.filter(s => (X.LEAD_UIDS || []).includes(s.uid));   // 🔒 v175 주임 멤버
  const inOrg = s => { const b = new Set([...(s.orgs || []), s.org]); return org === 'da' || b.has(org); };
  return X.STAFF.filter(s => s.role !== 'partner' && inOrg(s));
}
/* 부서별로 — 교직원 명부 «부서 관리» 순서 (부서 없음 · «전체»는 맨 앞 «관리 · 공통») · 부서 안에서는 직책 → 이름 순 */
const POS_ORDER = { '원장':1, '교장':2, '교감':3, '행정실장':4, '실장':4, '초등부장':5, '중고등부장':6, '부장':6, '주임':6.5, '주임교사':6.5, '교사':7 };
function attGroups(org, pool){
  const C = X.C;
  const primary = s => (s.org && s.org !== 'all') ? s.org : ((s.orgs || [])[0] || '');
  const orgs = org === 'da' ? ['daniel', 'jihyebit'] : [org];
  const sortP = (a, b) => (POS_ORDER[a.position] || 9) - (POS_ORDER[b.position] || 9) || (a.name || '').localeCompare(b.name || '', 'ko');
  if(org === 'lead') return pool.length ? [{ label: '주임 멤버', list: pool.slice().sort(sortP) }] : [];
  const out = [];
  for(const o of orgs){
    const mem = org === 'da' ? pool.filter(s => primary(s) === o) : pool;
    if(!mem.length) continue;
    const order = ((X.DEPTS || {})[o] || []).filter(d => d && d !== '전체');
    const by = new Map();
    for(const s of mem){ const d = s.dept && s.dept !== '전체' ? s.dept : ''; if(!by.has(d)) by.set(d, []); by.get(d).push(s); }
    const keys = [...by.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0) || ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)) || a.localeCompare(b, 'ko'));
    const pre = org === 'da' ? C.MORG[o] + ' · ' : '';
    for(const k of keys) out.push({ label: pre + (k || (by.size === 1 ? (org === 'da' ? '선생님' : C.MORG[o] + ' 선생님') : '관리 · 공통')), list: by.get(k).sort(sortP) });
  }
  if(org === 'da'){ const rest = pool.filter(s => !orgs.includes(primary(s))); if(rest.length) out.push({ label: '그 밖의 선생님', list: rest.sort(sortP) }); }
  return out;
}
function paintAtt(){
  const box = R.querySelector('#ed-att'); if(!box) return;
  const pool = poolOf(ED.org);
  const ids = new Set(pool.map(s => s.uid));
  const extra = Object.keys(ED.att).filter(u => !ids.has(u));
  const chip = (uid, nm) => {
    const a = ED.att[uid]; const s = a ? a.s : '';
    return `<button type="button" class="at ${s}" data-e="att" data-u="${esc(uid)}">${s === 'o' ? '✓ ' : s === 'x' ? '<small>불참</small> ' : ''}${esc(nm)}</button>`;
  };
  const nm = u => X.nameOf(u) || ED.attNames[u] || '?';
  let h = '';
  for(const g of attGroups(ED.org, pool)){
    const ids = g.list.map(s => s.uid);
    const on = ids.filter(u => ED.att[u] && ED.att[u].s === 'o').length;
    h += `<div class="at-grp"><div class="at-g"><b>${esc(g.label)}</b><span>${ids.length}명${on ? ` · 참석 ${on}` : ''}</span>
        ${on < ids.length ? `<button type="button" class="at-gin" data-e="grpin" data-g="${esc(ids.join(','))}">이 부서 모두 참석</button>` : ''}</div>
      <div class="at-list">${g.list.map(s => chip(s.uid, s.name || '')).join('')}</div></div>`;
  }
  if(extra.length) h += `<div class="at-g">다른 사람</div><div class="at-list">${extra.map(u => chip(u, nm(u))).join('')}</div>`;
  const on = Object.values(ED.att).filter(a => a.s === 'o').length, off = Object.values(ED.att).filter(a => a.s === 'x').length;
  box.innerHTML = `<div style="font-size:12.5px;color:var(--ink-2);margin-bottom:6px">참석 <b style="color:#00704A">${on}</b> · 불참 <b style="color:#B42318">${off}</b></div>` + h;
  const ab = R.querySelector('#ed-abs');
  const offs = Object.entries(ED.att).filter(([, a]) => a.s === 'x');
  ab.innerHTML = offs.length ? `<div style="margin-top:12px;font-size:12.5px;font-weight:900">불참 사유</div>` + offs.map(([u, a]) => {
    const rs = X.CFG.absence || [];
    const custom = a.r && !rs.includes(a.r);
    return `<div class="ab" data-u="${esc(u)}"><b>${esc(nm(u))}</b>${rs.map(r => `<button type="button" class="${a.r === r ? 'on' : ''}" data-e="absr" data-r="${esc(r)}">${esc(r)}</button>`).join('')}
      <input type="text" data-e="absc" placeholder="직접 쓰기" value="${custom ? esc(a.r) : ''}"></div>`;
  }).join('') : '';
}
function renum(el){
  const C = X.C;
  const rows = [...el.querySelector('.et-body').children];
  const body = rows.map(r => r.classList.contains('ol') ? { k: 'l', lv: +r.dataset.lv, h: r.querySelector('.ol-t').innerHTML } : { k: 'x' });
  const labels = C.numberBody(body);
  rows.forEach((r, i) => { if(r.classList.contains('ol')) r.querySelector('.ol-n').textContent = labels[i]; });
  const fromOf = r => r.classList.contains('ol') ? (r.dataset.from || '') : ((r._b && r._b.from) || '');
  const hasPrev = rows.some(r => fromOf(r));
  let pf = '';
  rows.forEach(r => {
    const f = fromOf(r);
    r.classList.toggle('prev', !!f);
    r.classList.toggle('cap', !!f && f !== pf);
    r.classList.toggle('newcap', hasPrev && !f && !!pf);
    if(f && f !== pf) r.dataset.cap = `↩ ${C.fmtMDY(f)} 회의에서 가져온 내용`;
    pf = f;
  });
  const nl = rows.filter(r => r.classList.contains('ol') && r.querySelector('.ol-t').textContent.trim()).length;
  el.querySelector('.et-sum').textContent = `내용 ${nl}줄 · 결정 ${el.querySelectorAll('.dl').length} · 임무 ${el.querySelectorAll('.kr').length}`;
}
function renumAll(){
  R.querySelectorAll('.et').forEach((el, i) => { el.querySelector('.et-no').textContent = (i + 1) + '.'; renum(el); });
  if(R.querySelector('#ed-ag')) paintAg();   // 📮 v180 주제를 빼거나 옮기면 «n번 주제에 넣었어요»도
}
function note(){
  const n = R.querySelector('#ed-note'); if(!n) return;
  const who = new Set();
  const base = new Map();
  ((ED.base && ED.base.topics) || []).forEach(t => (t.tasks || []).forEach(k => base.set(k.id, new Set(k.uids || []))));
  R.querySelectorAll('.kr').forEach(k => { const old = base.get(k.dataset.kid) || new Set(); (k._uids || []).forEach(u => { if(!old.has(u) && u !== X.CU.uid) who.add(u); }); });
  const vis = ED.org === 'lead' ? '주임 멤버가' : ED.org === 'da' ? '모든 기관 교직원이' : `${X.C.MORG[ED.org]} 교직원과 열람 허락을 받은 선생님이`;
  n.innerHTML = `${who.size ? `게시하면 임무 알림이 <b>${who.size}명</b>에게 가요 · ` : ''}게시하면 ${esc(vis)} 볼 수 있어요 · 그 전엔 «📝 임시 저장»으로 나만 보이게 둘 수 있어요`;
  R.querySelectorAll('[data-e="save"]').forEach(b => b.textContent = pubLabel() + (who.size ? '하고 알리기' : ''));   // 📝 v179 «게시» · «고친 것 게시» (+ 임무 알림)
}

/* ═══ 커서 도우미 ═══ */
function caretAt(el, end){
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(!end);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function atStart(el){
  const s = getSelection(); if(!s.rangeCount || !s.isCollapsed) return false;
  const r = s.getRangeAt(0); const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length === 0;
}
function atEnd(el){
  const s = getSelection(); if(!s.rangeCount || !s.isCollapsed) return false;
  const r = s.getRangeAt(0); const post = document.createRange(); post.selectNodeContents(el); post.setStart(r.endContainer, r.endOffset);
  return post.toString().length === 0;
}
function splitTail(el){
  const s = getSelection(); if(!s.rangeCount) return '';
  const r = s.getRangeAt(0); r.deleteContents();
  const post = document.createRange(); post.selectNodeContents(el); post.setStart(r.endContainer, r.endOffset);
  const frag = post.extractContents(); const d = document.createElement('div'); d.appendChild(frag);
  return d.textContent.trim() || d.querySelector('img') ? d.innerHTML : '';
}
function lineRect(){
  const s = getSelection(); if(!s.rangeCount) return null;
  const r = s.getRangeAt(0).cloneRange(); r.collapse(true);
  return r.getClientRects()[0] || null;
}
function dirty(){
  ED.dirty = true; window.__mtDirty = true;
  clearTimeout(ED._dt); ED._dt = setTimeout(saveDraft, 1200);
  /* 📝 v179 자동 저장 — 손을 멈추고 3초 뒤 (계속 쓰는 중이면 20초마다) «내 임시 저장»에 */
  clearTimeout(ED._st);
  ED._st = setTimeout(() => srvSave(), Date.now() - (ED._try || 0) > 20000 ? 0 : 3000);
}
const pubLabel = () => ED.isNew ? '게시' : '고친 것 게시';

/* ═══ 묶기 ═══ */
function bind(){
  const root = R.querySelector('.ed');
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('beforeinput', onBeforeInput);
  root.addEventListener('input', e => {
    if(e.target.closest('.ol-t,.dl-t,.kr-t,.et-title,td,th,.ob-cap,.ob-url,.ob-ttl,#ed-title,#ed-place,#ed-guests,.ab input,.kr-d')){
      const et = e.target.closest('.et'); if(et && e.target.closest('.ol-t')) renum(et);
      if(e.target.matches('.ab input')){ const u = e.target.closest('.ab').dataset.u; ED.att[u].r = e.target.value.trim(); e.target.closest('.ab').querySelectorAll('button').forEach(b => b.classList.remove('on')); }
      dirty();
    }
  });
  root.addEventListener('change', e => {
    if(e.target.id === 'ed-date'){ ED.date = e.target.value; paintCont(); dirty(); }
    if(e.target.id === 'ed-time' || e.target.matches('.kr-d')) dirty();
  });
  root.addEventListener('paste', onPaste);
  root.addEventListener('focusin', e => {
    R.querySelectorAll('.et.focus').forEach(x => x.classList.remove('focus'));
    const et = e.target.closest('.et'); if(et) et.classList.add('focus');
    const cell = e.target.closest('.ob-c td, .ob-c th'); if(cell) ED.cell = cell;
    if(e.target.closest('.ol-t')) ED.line = e.target.closest('.ol');
  });
  root.addEventListener('dragover', e => { const b = e.target.closest('.et'); if(b && e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); b.querySelector('.et-body').classList.add('drop'); } });
  root.addEventListener('dragleave', e => { const b = e.target.closest('.et-body'); if(b) b.classList.remove('drop'); });
  root.addEventListener('drop', e => {
    const et = e.target.closest('.et'); if(!et || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); et.querySelector('.et-body').classList.remove('drop');
    const row = e.target.closest('.ol, .ob');
    addFiles(et, [...e.dataTransfer.files], row && row.parentElement && row.parentElement.classList.contains('et-body') ? row : null);
  });
  window.onbeforeunload = e => { if(ED && ED.dirty){ saveDraft(); srvSave(); e.preventDefault(); e.returnValue = ''; } };
}
function topicOfEvent(e){ return e.target.closest('.et'); }
function curLine(et){ const l = ED.line && ED.line.isConnected && et.contains(ED.line) ? ED.line : null; return l || [...et.querySelectorAll('.et-body > .ol')].pop() || null; }
async function onClick(e){
  const b = e.target.closest('[data-e]'); if(!b) return;
  const act = b.dataset.e, et = topicOfEvent(e), C = X.C;
  switch(act){
    case 'cancel': return cancel();
    case 'agtog': { const ed = R.querySelector('.ed');   // 📮 v180
      if(ed.classList.contains('wide')){ const on = ed.classList.contains('ag-side'); try{ localStorage.setItem(AGP, on ? 'closed' : 'open'); }catch(_){} }
      else ed.classList.toggle('ag-drawer');
      agClass(); return; }
    case 'agclose': { const ed = R.querySelector('.ed');
      if(ed.classList.contains('wide')){ try{ localStorage.setItem(AGP, 'closed'); }catch(_){} } else ed.classList.remove('ag-drawer');
      agClass(); return; }
    case 'agadd': return agAdd([b.dataset.id]);
    case 'agst': { const el = b.closest('.et'); if(el && el._ag) agSetSt(el, el._agSt === 'doing' ? 'done' : 'doing'); return; }
    case 'agset': { const h = agInMap().get(b.dataset.id); if(h) agSetSt(h.el, b.dataset.v); return; }
    case 'agall': { const inMap = agInMap(); return agAdd(agList().filter(a => (a.status === 'doing' || ((a.status || 'open') === 'open' && (!a.type || a.type === ED.type))) && !inMap.has(a.id)).map(a => a.id)); }
    case 'aggo': { const h = agInMap().get(b.dataset.id); if(h){ const ed = R.querySelector('.ed'); if(ed.classList.contains('ag-drawer')){ ed.classList.remove('ag-drawer'); agClass(); }
      h.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); h.el.classList.remove('flash'); void h.el.offsetWidth; h.el.classList.add('flash'); } return; }
    case 'agmore': b.classList.toggle('clamp'); return;
    case 'agnew': if(typeof X.agNew === 'function') X.agNew(ED.org === 'lead' ? 'lead' : ED.org); return;
    case 'keep': return keep();
    case 'save': return save();
    case 'preview': return preview();
    case 'org': if(!ED.isNew) return; ED.org = b.dataset.v; if(!X.typesOf(ED.org).includes(ED.type)) ED.type = X.typesOf(ED.org)[0] || '';
      { const keep = collect();
        if(agOn()) keep.topics.forEach(t => { const a = t.agendaId && (X.agendas() || []).find(x => x.id === t.agendaId); if(t.agendaId && (!a || a.org !== ED.org)){ delete t.agendaId; delete t.agBy; } });   // 📮 v180 다른 기관 안건은 연결을 풂
        ED.topics = keep.topics.length ? keep.topics : [blankTopic()]; ED.title = keep.title; ED.place = keep.place; ED.time = keep.time; ED.guests = keep.guests; ED.date = keep.date; }
      ED.att = {}; paint(); dirty(); return;
    case 'type': ED.type = b.dataset.v; paintTypes(); paintAg();
      if(ED.isNew){ const pm = lastOf(ED.org, ED.type); if(pm){ const p = R.querySelector('#ed-place'), tm = R.querySelector('#ed-time'); if(!p.value) p.value = pm.place || ''; if(!tm.value) tm.value = pm.time || ''; if(!Object.keys(ED.att).length){ ED.att = rosterFrom(pm); ED.attNames = { ...(pm.attNames || {}) }; paintAtt(); } } }
      paintCont(); dirty(); return;
    case 'newtype': { const v0 = prompt(`${C.MORG[ED.org]} 회의 종류에 새로 넣을 이름 (예: 교사 연수 회의)\n넣으면 다음부터 모든 선생님 목록에 보여요.`); const v = (v0 || '').trim(); if(!v) return;
      const list = X.typesOf(ED.org);
      if(!list.includes(v)){ try{ await X.saveTypes(ED.org, [...list, v]); X.toast(`«${v}»을(를) 회의 종류에 넣었어요`); }
        catch(e){ X.toast('목록에 저장하지 못했어요 — 이 회의록에만 쓸게요 (보안 규칙 v24 게시 확인)', 'err'); } }
      ED.type = v; paintTypes(); paintCont(); dirty(); return; }
    case 'typeedit': ED.typeEdit = !ED.typeEdit; paintTypes(); return;
    case 'deltype': { const v = b.dataset.v;
      if(!confirm(`«${v}»을(를) ${C.MORG[ED.org]} 회의 종류 목록에서 뺄까요?\n이미 쓴 회의록은 그대로예요.`)) return;
      try{ await X.saveTypes(ED.org, X.typesOf(ED.org).filter(t => t !== v)); X.toast(`«${v}»을(를) 목록에서 뺐어요`); }
      catch(e){ X.toast('빼지 못했어요 — ' + (e.code || e.message), 'err'); return; }
      if(ED.type === v && ED.isNew) ED.type = X.typesOf(ED.org)[0] || '';
      paintTypes(); paintCont(); return; }
    case 'cont': return openPicker(b.dataset.mid);
    case 'pick': return openPicker('');
    case 'grpin': { const ids = (b.dataset.g || '').split(','); ids.forEach(u => { if(u && !ED.att[u]){ ED.att[u] = { s: 'o' }; ED.attNames[u] = X.nameOf(u); } }); paintAtt(); dirty(); return; }
    case 'att': { const u = b.dataset.u; const a = ED.att[u]; const s = a ? a.s : '';
      if(!s) ED.att[u] = { s: 'o' }; else if(s === 'o') ED.att[u] = { s: 'x', r: '' }; else delete ED.att[u];
      const nm = X.nameOf(u); if(nm) ED.attNames[u] = nm;
      paintAtt(); dirty(); return; }
    case 'allin': poolOf(ED.org).forEach(s => { if(!ED.att[s.uid]) { ED.att[s.uid] = { s: 'o' }; ED.attNames[s.uid] = s.name || ''; } }); paintAtt(); dirty(); return;
    case 'addppl': return pickPeople(b, { title: '다른 사람 추가', pool: ED.org === 'lead' ? poolOf('lead') : X.STAFF, picked: Object.keys(ED.att), onDone: list => { list.forEach(u => { if(!ED.att[u]) ED.att[u] = { s: 'o' }; ED.attNames[u] = X.nameOf(u); }); paintAtt(); dirty(); } });
    case 'absr': { const u = b.closest('.ab').dataset.u; ED.att[u].r = b.dataset.r; paintAtt(); dirty(); return; }
    case 'addtopic': { const t = blankTopic(); R.querySelector('#ed-topics').insertAdjacentHTML('beforeend', topicHTML(t)); const el = R.querySelector(`.et[data-tid="${t.id}"]`); hydrate(el, t); renumAll(); el.querySelector('.et-title').focus(); dirty(); return; }
    case 'tup': { const p = et.previousElementSibling; if(p) et.parentElement.insertBefore(et, p); renumAll(); dirty(); return; }
    case 'tdown': { const n = et.nextElementSibling; if(n) et.parentElement.insertBefore(n, et); renumAll(); dirty(); return; }
    case 'tfold': et.classList.toggle('fold'); b.textContent = et.classList.contains('fold') ? '펼치기' : '접기'; renum(et); return;
    case 'tdel': { const has = et.querySelector('.et-title').value.trim() || [...et.querySelectorAll('.ol-t')].some(x => x.textContent.trim()) || et.querySelector('.ob,.dl,.kr');
      if(has && !confirm('이 주제를 뺄까요? (저장 전이면 되돌릴 수 있어요 — 취소하고 나가기)')) return; et.remove(); renumAll(); note(); dirty(); return; }
    case 'bold': document.execCommand('bold'); dirty(); return;
    case 'mark': return toggleMark();
    case 'indent': case 'outdent': { const l = curLine(et); if(l){ setLv(l, +l.dataset.lv + (act === 'indent' ? 1 : -1)); renum(et); dirty(); } return; }
    case 'addimg': return pickFiles('image/*', true, fs => addFiles(et, fs, curLine(et)));
    case 'adddoc': return pickFiles('.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.numbers,.pages,.key,.zip,.txt', true, fs => addFiles(et, fs, curLine(et)));
    case 'addtbl': insertBlock(et, curLine(et), { k: 'tbl', h: '<table><tr><th>제목</th><th>제목</th><th>제목</th></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table>' }); dirty(); return;
    case 'addlink': { const u = prompt('링크 주소 (구글 드라이브 · 웹 페이지)', 'https://'); if(!u || !/^https?:\/\//.test(u.trim())) return;
      if(!C.safeUrl(u)){ X.toast('http:// 또는 https://로 시작하는 주소만 넣을 수 있어요', 'err'); return; }
      const t = prompt('보이는 이름 (비우면 주소 그대로)', '') || ''; insertBlock(et, curLine(et), { k: 'link', url: C.safeUrl(u), title: t.trim() }); dirty(); return; }
    case 'bup': { const o = b.closest('.ob'); const p = o.previousElementSibling; if(p) o.parentElement.insertBefore(o, p); renum(et); dirty(); return; }
    case 'bdown': { const o = b.closest('.ob'); const n = o.nextElementSibling; if(n) o.parentElement.insertBefore(n, o); renum(et); dirty(); return; }
    case 'bdel': { if(!confirm('이 첨부를 뺄까요?')) return; b.closest('.ob').remove(); ensureLine(et); renum(et); dirty(); return; }
    case 'trow': case 'tcol': case 'trowd': case 'tcold': case 'thead': case 'tcenter': return tableOp(b.closest('.ob'), act);
    case 'tcolor': return X.popMenu(b, [['#FFF59D', '노랑'], ['#FDE2C4', '주황'], ['#D4E9E2', '초록'], ['#DBEAFE', '파랑'], ['#FCE7F3', '분홍'], ['#E5E7EB', '회색'], ['', '색 없음']]
      .map(([c, l]) => ({ l: `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid #ccc;background:${c || '#fff'}"></span> ${l}`, f: () => tableOp(b.closest('.ob'), 'color', c) })));
    case 'adddec': { const el = decEl(null); et.querySelector('.et-decs').appendChild(el); el.querySelector('.dl-t').focus(); renum(et); dirty(); return; }
    case 'ddel': { b.closest('.dl').remove(); renum(et); dirty(); return; }
    case 'addtask': { const el = taskEl(null); et.querySelector('.et-tasks').appendChild(el); el.querySelector('.kr-t').focus(); renum(et); dirty(); return; }
    case 'kdel': { b.closest('.kr').remove(); renum(et); note(); dirty(); return; }
    case 'who': { const kr = b.closest('.kr');
      const pool = ED.org === 'lead' ? poolOf('lead')   // 🔒 v175 주임 회의록 임무는 주임 멤버에게만 (멤버 밖 선생님이 임무 · 알림으로 내용을 보지 않게)
        : ED.org === 'da' ? X.STAFF : poolOf(ED.org).concat(X.STAFF.filter(s => !poolOf(ED.org).includes(s) && ED.att[s.uid]));
      return pickPeople(b, { title: '담당 선생님', pool, picked: kr._uids, first: Object.keys(ED.att).filter(u => ED.att[u].s === 'o'), live: true,
        onDone: list => { kr._uids = list; list.forEach(u => kr._names[u] = X.nameOf(u)); whoLabel(kr); note(); dirty(); } }); }
  }
}
function onKey(e){
  if(e.isComposing || e.keyCode === 229) return;                  // 한글 조합 중에는 손대지 않는다
  const t = e.target;
  if((e.metaKey || e.ctrlKey) && e.key === 's'){ e.preventDefault(); save(); return; }
  if(t.closest('.ob-c td, .ob-c th')){
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); document.execCommand('insertLineBreak'); }
    if(e.key === 'Tab'){ e.preventDefault(); const cells = [...t.closest('table').querySelectorAll('td,th')]; const i = cells.indexOf(t.closest('td,th')); const n = cells[i + (e.shiftKey ? -1 : 1)]; if(n) caretAt(n, true); }
    return;
  }
  if(t.classList.contains('et-title')){
    if(e.key === 'Enter'){ e.preventDefault(); const et = t.closest('.et'); const l = et.querySelector('.et-body > .ol .ol-t') || (ensureLine(et), et.querySelector('.et-body > .ol .ol-t')); caretAt(l, true); }
    return;
  }
  if(t.classList.contains('dl-t') || t.classList.contains('kr-t')){
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); rowEnter(t); }
    else if(e.key === 'Backspace' && rowBack(t)) e.preventDefault();
    return;
  }
  if(!t.classList.contains('ol-t')) return;
  const row = t.parentElement, et = t.closest('.et');
  if(e.key === 'Tab'){ e.preventDefault(); setLv(row, +row.dataset.lv + (e.shiftKey ? -1 : 1)); renum(et); dirty(); return; }
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); lineEnter(t); return; }
  if(e.key === 'Enter' && e.shiftKey){ e.preventDefault(); document.execCommand('insertLineBreak'); dirty(); return; }
  if(e.key === 'Backspace'){ if(lineBack(t)) e.preventDefault(); return; }
  if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
    const up = e.key === 'ArrowUp';
    const cr = lineRect(), er = t.getBoundingClientRect(), lh = parseFloat(getComputedStyle(t).lineHeight) || 24;
    const edge = !cr ? true : up ? (cr.top - er.top < lh * 0.8) : (er.bottom - cr.bottom < lh * 0.8);
    if(!edge) return;
    const all = [...R.querySelectorAll('.et-body > .ol .ol-t')];
    const n = all[all.indexOf(t) + (up ? -1 : 1)];
    if(n){ e.preventDefault(); caretAt(n, up); }
  }
}
/* Enter · Backspace — 키보드(keydown)와 폰·사파리 한글 입력(beforeinput) 양쪽에서 같은 동작 */
function rowEnter(t){
  const row = t.parentElement, et = t.closest('.et');
  const el = row.classList.contains('dl') ? decEl(null) : taskEl(null); row.after(el); caretAt(el.querySelector('.dl-t,.kr-t')); renum(et); dirty();
}
function rowBack(t){
  if(t.textContent || t.querySelector('img')) return false;
  const row = t.parentElement, et = t.closest('.et');
  const p = row.previousElementSibling; row.remove(); if(p) caretAt(p.querySelector('.dl-t,.kr-t'), true); renum(et); note(); dirty();
  return true;
}
function lineEnter(t){
  const row = t.parentElement, et = t.closest('.et');
  if(!t.textContent.trim() && +row.dataset.lv > 1){ setLv(row, +row.dataset.lv - 1); renum(et); dirty(); return; }
  const tail = splitTail(t);
  const nl = lineEl(+row.dataset.lv, tail); row.after(nl); caretAt(nl.querySelector('.ol-t')); renum(et); dirty();
}
function lineBack(t){
  if(!atStart(t)) return false;
  const sel = getSelection(); if(sel.rangeCount && !sel.isCollapsed) return false;
  const row = t.parentElement, et = t.closest('.et');
  if(+row.dataset.lv > 1 && t.textContent.trim()){ setLv(row, +row.dataset.lv - 1); renum(et); dirty(); return true; }
  const prev = row.previousElementSibling;
  if(!prev){ if(!t.textContent.trim() && +row.dataset.lv > 1){ setLv(row, 1); renum(et); return true; } return false; }
  if(prev.classList.contains('ob')){ if(!t.textContent.trim()){ row.remove(); ensureLine(et); } renum(et); dirty(); return true; }
  const pt = prev.querySelector('.ol-t');
  if(!t.textContent.trim() && !t.querySelector('img')){ row.remove(); caretAt(pt, true); }
  else { const mark = document.createElement('span'); mark.id = 'ed-mk'; pt.appendChild(mark); pt.insertAdjacentHTML('beforeend', t.innerHTML); row.remove();
    const m = pt.querySelector('#ed-mk'); pt.focus(); const r = document.createRange(); r.setStartBefore(m); r.collapse(true); m.remove(); const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(r); }
  renum(et); dirty(); return true;
}
function onBeforeInput(e){
  const t = e.target && e.target.closest && e.target.closest('.ol-t, .dl-t, .kr-t'); if(!t || e.isComposing) return;
  if(e.inputType === 'insertParagraph'){ e.preventDefault(); t.classList.contains('ol-t') ? lineEnter(t) : rowEnter(t); }
  else if(e.inputType === 'deleteContentBackward'){ if(t.classList.contains('ol-t') ? lineBack(t) : (!t.textContent && rowBack(t))) e.preventDefault(); }
}
function setLv(row, lv){ row.dataset.lv = X.C.clampLv(lv); }
function ensureLine(et){ const body = et.querySelector('.et-body'); if(!body.querySelector('.ol')) body.appendChild(lineEl(1, '')); }
function toggleMark(){
  const s = getSelection(); if(!s.rangeCount || s.isCollapsed){ X.toast('형광펜을 칠할 글자를 먼저 고르세요'); return; }
  const n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
  const mk = n && n.closest('mark');
  if(mk){ const p = mk.parentNode; while(mk.firstChild) p.insertBefore(mk.firstChild, mk); mk.remove(); }
  else { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, '#FFF59D'); }
  dirty();
}
function insertBlock(et, afterRow, b){
  const el = blockEl(b);
  const body = et.querySelector('.et-body');
  if(afterRow && afterRow.parentElement === body){
    const t = afterRow.querySelector && afterRow.querySelector('.ol-t');
    if(t && !t.textContent.trim() && !t.querySelector('img') && afterRow.previousElementSibling){ afterRow.replaceWith(el); }
    else afterRow.after(el);
  } else body.appendChild(el);
  /* 첨부 뒤에는 늘 빈 줄 하나 — 다음 첨부·글이 그 뒤로 이어지게 (빈 줄은 저장할 때 빠진다) */
  if(!el.nextElementSibling || !el.nextElementSibling.classList.contains('ol')) el.after(lineEl(afterRow && afterRow.dataset ? +afterRow.dataset.lv || 1 : 1, ''));
  ED.line = el.nextElementSibling;
  renum(et);
  return el;
}
function tableOp(ob, op, color){
  const tbl = ob.querySelector('table'); if(!tbl) return;
  let cell = ED.cell && tbl.contains(ED.cell) ? ED.cell : tbl.querySelector('td,th');
  const tr = cell.parentElement, rows = [...tbl.rows];
  const ci = cell.cellIndex;
  const width = Math.max(...rows.map(r => [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0)));
  const mk = (tag) => { const c = document.createElement(tag); c.setAttribute('contenteditable', 'true'); return c; };
  if(op === 'trow'){ const nr = document.createElement('tr'); for(let i = 0; i < width; i++) nr.appendChild(mk('td')); tr.after(nr); caretAt(nr.cells[0]); }
  if(op === 'tcol'){ rows.forEach(r => { const ref = r.cells[Math.min(ci, r.cells.length - 1)]; const c = mk(r.cells[0] && r.cells[0].tagName === 'TH' ? 'th' : 'td'); ref ? ref.after(c) : r.appendChild(c); }); }
  if(op === 'trowd'){ if(rows.length > 1){ tr.remove(); ED.cell = null; } }
  if(op === 'tcold'){ if(width > 1) rows.forEach(r => { const c = r.cells[Math.min(ci, r.cells.length - 1)]; if(c && r.cells.length > 1) c.remove(); }); ED.cell = null; }
  if(op === 'thead'){ const r0 = rows[0]; const isH = r0.cells[0] && r0.cells[0].tagName === 'TH';
    [...r0.cells].forEach(c => { const n = mk(isH ? 'td' : 'th'); n.innerHTML = c.innerHTML; if(c.colSpan > 1) n.colSpan = c.colSpan; if(c.rowSpan > 1) n.rowSpan = c.rowSpan; const st = c.getAttribute('style'); if(st) n.setAttribute('style', st); c.replaceWith(n); }); }
  if(op === 'tcenter'){ cell.style.textAlign = cell.style.textAlign === 'center' ? '' : 'center'; }
  if(op === 'color'){ cell.style.backgroundColor = color || ''; }
  dirty();
}
function pickFiles(accept, multi, cb){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multi;
  inp.onchange = () => { if(inp.files.length) cb([...inp.files]); };
  inp.click();
}
async function addFiles(et, files, afterRow){
  for(const f of files){
    const name = f.name || '';
    const ext = name.toLowerCase().split('.').pop();
    const wait = insertBlock(et, afterRow, { k: 'wait', msg: `${name || '파일'} 올리는 중…` });
    afterRow = wait.nextElementSibling;                      // 여러 개면 고른 순서대로 이어 붙는다
    const setMsg = t => { const d = wait.querySelector('.ob-ld'); if(d) d.textContent = t; };
    try{
      if((f.type || '').startsWith('image/') && !/heic|heif/i.test(f.type + ext)){
        setMsg(`${name} — 줄이는 중…`);
        const src = await readAsDataURL(f);
        const r = await X.STORE.putImage(ED.org, ED.id, src, 'img', name);
        wait.replaceWith(blockEl({ k: 'img', fid: r.fid, w: r.w, ht: r.ht, cap: '' }));
        X.toast(`${name} · ${X.C.fmtSize(f.size)} → ${X.C.fmtSize(r.size)}로 줄였어요`);
      } else if(/heic|heif/i.test(f.type + ext)){
        wait.remove(); X.toast('아이폰 HEIC 사진은 이 브라우저에서 열 수 없어요 — 사진 앱에서 JPG로 내보내거나 사파리에서 올려 주세요', 'err');
      } else if(ext === 'pdf'){
        const { pages, total } = await pdfPages(f, (i, n, all) => setMsg(`${name} — ${i}/${n}쪽 펼치는 중…${all > n ? ` (앞 ${n}쪽만)` : ''}`));
        const fids = [];
        for(let i = 0; i < pages.length; i++){ setMsg(`${name} — ${i + 1}/${pages.length}쪽 저장 중…`); fids.push(await X.STORE.putShrunk(ED.org, ED.id, pages[i], 'pdfpage', `${name} ${i + 1}쪽`)); }
        let fid = '';
        if(f.size <= FILE_MAX){ setMsg(`${name} — 원본 보관 중…`); fid = (await X.STORE.putFile(ED.org, ED.id, f)).fid; }
        wait.replaceWith(blockEl({ k: 'pdf', id: uid6('b'), name, fids, pages: total, fid, size: f.size, link: '' }));
        if(!fid) X.toast('원본이 5MB보다 커서 쪽 그림만 넣었어요 — 원본은 드라이브 링크로 붙여 주세요');
      } else if(['xlsx', 'xls', 'csv'].includes(ext) && confirm(`${name}\n\n표로 넣을까요? (취소: 파일 그대로 첨부)`)){
        setMsg(`${name} — 표로 바꾸는 중…`);
        const h = await xlsxTable(f);
        if(!h) throw new Error('표를 찾지 못했어요');
        wait.replaceWith(blockEl({ k: 'tbl', h, cap: name }));
      } else if(f.size <= FILE_MAX){
        setMsg(`${name} — 보관 중…`);
        const r = await X.STORE.putFile(ED.org, ED.id, f);
        wait.replaceWith(blockEl({ k: 'file', fid: r.fid, name, size: f.size, mime: f.type || '' }));
      } else {
        const link = prompt(`${name} (${X.C.fmtSize(f.size)})는 5MB보다 커서 바로 보관할 수 없어요.\n구글 드라이브에 올린 뒤 링크를 붙여 주세요:`, 'https://');
        if(X.C.safeUrl(link)) wait.replaceWith(blockEl({ k: 'file', name, size: f.size, link: X.C.safeUrl(link) }));
        else wait.remove();
      }
    }catch(err){
      console.error(err); wait.remove();
      X.toast(`${name}을(를) 넣지 못했어요 — ${err.message || err}`, 'err');
    }
    if(!ED || !et.isConnected) return;               // 그 사이 편집기를 닫았으면 멈춘다
    renum(et); dirty();
  }
}
async function onPaste(e){
  const t = e.target.closest('.ol-t, .dl-t, .kr-t, .ob-c td, .ob-c th'); if(!t) return;
  const cd = e.clipboardData; if(!cd) return;
  const et = t.closest('.et');
  const imgs = [...(cd.files || [])].filter(f => (f.type || '').startsWith('image/'));
  const html = cd.getData('text/html') || '', text = cd.getData('text/plain') || '';
  if(imgs.length && et && !text.trim()){ e.preventDefault(); addFiles(et, imgs, t.closest('.ol')); return; }
  if(t.matches('td,th,.dl-t,.kr-t')){ e.preventDefault(); document.execCommand('insertText', false, t.matches('td,th') ? text : text.replace(/\s*\n\s*/g, ' ')); dirty(); return; }
  const row = t.closest('.ol');
  if(/<table/i.test(html)){
    const cells = (html.match(/<t[dh][\s>]/gi) || []).length;
    if(cells > 1){
      e.preventDefault();
      const tb = await sanitizeTableHTML(html);
      if(tb){ insertBlock(et, row, { k: 'tbl', h: tb }); X.toast('표로 넣었어요 — 칸을 눌러 바로 고칠 수 있어요'); dirty(); return; }
    }
  }
  if(looksTsv(text)){ e.preventDefault(); insertBlock(et, row, { k: 'tbl', h: X.C.tsvToTable(text) }); dirty(); return; }
  if(text.trim().includes('\n')){ e.preventDefault(); pasteOutline(et, row, text); return; }
  e.preventDefault();
  if(html) document.execCommand('insertHTML', false, sanitizeInline(html));
  else document.execCommand('insertText', false, text);
  renum(et); dirty();
}
/* 엑셀 칸 복사처럼 보이는가 — 글 «사이»에 탭이 있는 줄이 둘 이상, 칸 수가 같고, 번호 개요 줄이 아님 */
function looksTsv(text){
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').filter(l => l.trim());
  if(lines.length < 2) return false;
  const inner = lines.filter(l => /\S\t|\t\S/.test(l.replace(/^\t+/, '')) && /\S/.test(l.replace(/^\t+/, '').split('\t')[0]));
  if(inner.length < 2) return false;
  if(lines.some(l => /^\s*(\(?\d{1,2}[.)]|\(?[IVX]{1,5}[.)])\s/.test(l))) return false;
  const cols = new Set(inner.map(l => l.split('\t').length));
  return cols.size <= 2 && Math.min(...cols) >= 2;
}
function pasteOutline(et, row, text){
  const C = X.C;
  const parsed = C.parseOutline(text);
  if(!parsed.length) return;
  const esc2 = s => C.esc(s);
  if(parsed.length > 1 && confirm(`붙여 넣은 글에서 주제 ${parsed.length}개를 찾았어요.\n주제로 나눠 넣을까요? (취소: 이 주제 안에 줄로만)`)){
    let at = et;
    const empty = !et.querySelector('.et-title').value.trim() && ![...et.querySelectorAll('.ol-t')].some(x => x.textContent.trim()) && !et.querySelector('.ob,.dl,.kr');
    parsed.forEach((p, i) => {
      const t = { id: uid6('t'), title: p.title, body: p.lines.length ? p.lines.map(l => ({ k: 'l', lv: l.lv, h: esc2(l.t) })) : [{ k: 'l', lv: 1, h: '' }], dec: [], tasks: [] };
      at.insertAdjacentHTML('afterend', topicHTML(t));
      const el = at.nextElementSibling; hydrate(el, t); at = el;
    });
    if(empty) et.remove();
    renumAll(); dirty(); X.toast(`주제 ${parsed.length}개로 나눠 넣었어요`); return;
  }
  const lines = [];
  parsed.forEach(p => { if(p.title) lines.push({ lv: 1, t: p.title }); p.lines.forEach(l => lines.push(l)); });
  if(parsed.length === 1 && parsed[0].title && !et.querySelector('.et-title').value.trim()){
    et.querySelector('.et-title').value = parsed[0].title; lines.shift();
  }
  let cur = row;
  const rt = row && row.querySelector('.ol-t');
  if(rt && !rt.textContent.trim() && lines.length){ const f = lines.shift(); row.dataset.lv = C.clampLv(f.lv); rt.innerHTML = esc2(f.t); }
  for(const l of lines){ const nl = lineEl(l.lv, esc2(l.t)); if(cur) cur.after(nl); else et.querySelector('.et-body').appendChild(nl); cur = nl; }
  if(cur) caretAt(cur.querySelector('.ol-t'), true);
  renum(et); dirty();
}
/* 사람 고르기 (담당 · 다른 참석자) */
function pickPeople(anchor, o){
  document.querySelectorAll('.wp').forEach(p => p.remove());
  const picked = new Set(o.picked || []);
  const first = new Set(o.first || []);
  const p = document.createElement('div'); p.className = 'wp';
  const C = X.C;
  const orgL = s => C.MORG_SHORT[s.org] || '';
  const draw = (q) => {
    const L = o.pool.filter(s => !q || (s.name || '').includes(q));
    const a = L.filter(s => first.has(s.uid)), b = L.filter(s => !first.has(s.uid));
    const row = s => `<label><input type="checkbox" value="${esc(s.uid)}"${picked.has(s.uid) ? ' checked' : ''}>${esc(s.name || '')}<small>${esc(s.position || '')} ${esc(orgL(s))}</small></label>`;
    p.querySelector('.ls').innerHTML = (a.length ? `<div class="gh">참석한 사람</div>${a.map(row).join('')}` : '') + (b.length ? `${a.length ? '<div class="gh">그 밖의 선생님</div>' : ''}${b.map(row).join('')}` : '') || '<div class="gh">찾는 이름이 없어요</div>';
  };
  p.innerHTML = `<input type="search" placeholder="${esc(o.title)} — 이름 찾기"><div class="ls"></div><div class="ft"><button type="button" class="mt-btn sm g">고르기 끝</button></div>`;
  document.body.appendChild(p);
  const r = anchor.getBoundingClientRect();
  p.style.left = Math.max(8, Math.min(innerWidth - 290, r.left)) + 'px';
  p.style.top = (r.bottom + 390 > innerHeight ? Math.max(8, r.top - 390) : r.bottom + 4) + 'px';
  draw('');
  const inp = p.querySelector('input[type=search]'); inp.focus();
  inp.oninput = () => draw(inp.value.trim());
  const done = () => { p.remove(); document.removeEventListener('mousedown', off, true); o.onDone([...picked]); };
  p.addEventListener('change', e => { const c = e.target; if(c.type !== 'checkbox') return; c.checked ? picked.add(c.value) : picked.delete(c.value); if(o.live) o.onDone([...picked]); });
  p.querySelector('.ft button').onclick = done;
  const off = e => { if(!p.contains(e.target)) done(); };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
}
/* ↩ 이전 회의 주제 가져오기 — 같은 기관의 지난 회의록에서 주제를 골라 «이어 쓰는 주제»로
   · 찾기: 주제 · 내용으로 걸러 보기 (회의록이 많아도)
   · 가져온 내용은 회색 상자(↩ M/D 회의에서 가져온 내용), 그 아래 새로 적는 줄은 «✎ 이번 회의» */
async function openPicker(preMid){
  const C = X.C, FS = X.FS, db = X.db;
  const md = X.modal('↩ 이전 회의 주제 가져오기', `<div class="dv-hint">불러오는 중…</div>`, `<span class="dv-hint" id="pk-n" style="margin-right:auto"></span><button class="mt-btn" data-c="x">닫기</button><button class="mt-btn p" data-c="ok" disabled>가져오기</button>`, 'wide');
  md.box.querySelector('[data-c="x"]').onclick = md.close;
  /* 🔒 v175 어느 회의록에서 — 주임 회의록 ↔ 기관 회의록 (바깥 문맥 pickSources · 맨 앞 = 지금 쓰는 회의록과 같은 곳) */
  const srcs = ((typeof X.pickSources === 'function' && X.pickSources(ED.org)) || []).filter(Boolean);
  if(!srcs.length) srcs.push({ org: ED.org, label: C.MORG[ED.org] || '', col: COL() });
  let si = Math.max(0, srcs.findIndex(x => x.org === ED.org));
  let ms = [], tk = {};
  const sel = new Map();                                   // 'mid|tid' → true
  let lim = 8, q = '';
  const body = md.box.querySelector('.mm-b');
  const src = () => srcs[si];
  const cross = () => src().org !== ED.org;
  async function load(){
    const S = src(), K = S.col || COL();
    ms = []; tk = {};
    try{
      const [a, b] = await Promise.all([
        FS.getDocs(FS.query(FS.collection(db, K.m), FS.where('org', '==', S.org))),
        FS.getDocs(FS.query(FS.collection(db, K.t), FS.where('org', '==', S.org))).catch(() => null)]);
      ms = a.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !m.deleted && m.id !== (ED && ED.id) && (m.topics || []).length)
        .sort((x, y) => String(y.date).localeCompare(String(x.date)) || String(y.time || '').localeCompare(String(x.time || '')));
      if(b) b.forEach(d => tk[d.id] = d.data());
      return '';
    }catch(e){ return e.code || e.message || 'error'; }
  }
  const openTasks = (m, t) => (t.tasks || []).filter(k => C.textOf(k.h).trim() && (tk[C.taskKey(m.id, k.id)] || {}).status !== 'done').length;
  const hitT = (t) => { if(!q) return true; const L = (t.title + '\n' + C.topicText(t)).toLowerCase(); return q.split(/\s+/).filter(Boolean).every(w => L.includes(w)); };
  let pinned = [];
  const pinBlock = () => !q && pinned.length ? `<div class="pk-m pk-pin"><div class="pk-mh"><b>☆ 모아 둔 주제 ${pinned.length}</b><span class="dv-hint" style="margin-left:6px">목차에서 ☆로 모아 둔 것</span></div>
      ${pinned.map(({ m, t, i }) => { const k = m.id + '|' + t.id;
        return `<label class="pk-t"><input type="checkbox" data-pk="${esc(k)}"${sel.has(k) ? ' checked' : ''}><b>${esc(C.fmtMDY(m.date, false))}</b><span>${i + 1}. ${esc(t.title || '(제목 없음)')}</span><small>${esc(C.titleOf(m))}</small></label>`; }).join('')}</div>` : '';
  const srcBar = () => srcs.length > 1 ? `<div class="pk-src" role="group" aria-label="어느 회의록에서"><span>어느 회의록에서</span>${srcs.map((x, i) =>
      `<button type="button" class="mt-chip${i === si ? ' on' : ''}" data-pksrc="${i}" aria-pressed="${i === si}">${x.org === 'lead' ? '🔒 ' : ''}${esc(x.label)}</button>`).join('')}</div>` : '';
  const crossNote = () => !cross() ? '' : src().org === 'lead'
    ? `<div class="pk-warn">⚠ 주임 회의록의 주제를 가져와 저장하면 <b>${esc(C.MORG[ED.org] || '')}</b> 회의록을 볼 수 있는 교직원이 모두 보게 돼요. 댓글 · 고친 기록 · 공유 명단은 따라가지 않아요.</div>`
    : `<div class="pk-note">«${esc(src().label)}»에서 가져와요 — 내용 · 결정 · 못 끝낸 임무는 글로 따라오고, 사진 · 문서는 옮기지 않아요. 댓글 · 고친 기록은 따라가지 않아요.</div>`;
  const list0 = () => body.querySelector('#pk-list');
  const draw = () => {
    const list = list0(); if(!list) return;
    const rows = ms.map(m => ({ m, ts: (m.topics || []).map((t, i) => ({ t, i })).filter(x => hitT(x.t)) })).filter(r => r.ts.length);
    const show = q ? rows.slice(0, 40) : rows.slice(0, lim);
    if(preMid && !q){ const i = show.findIndex(r => r.m.id === preMid); if(i > 0){ const [x] = show.splice(i, 1); show.unshift(x); } }
    list.innerHTML = (!ms.length ? `<div class="dv-hint">${esc(C.MORG[src().org] || src().label || '')}에 가져올 지난 회의록이 아직 없어요.</div>` : '') + pinBlock() + show.map(({ m, ts }) => `<div class="pk-m${preMid === m.id ? ' pre' : ''}">
        <div class="pk-mh"><b>${esc(C.fmtMDY(m.date))}</b> ${esc(C.titleOf(m))}${m.imported ? ` <span class="md-imp">${C.impLabel ? C.impLabel(m) : 'PDF에서 옮김'}</span>` : ''}<span class="mt-sp"></span>
          <button type="button" class="mt-btn sm ghost" data-pkall="${esc(m.id)}">${ts.every(x => sel.has(m.id + '|' + x.t.id)) ? '모두 빼기' : '모두 고르기'}</button></div>
        ${ts.map(({ t, i }) => { const k = m.id + '|' + t.id, ot = openTasks(m, t);
          const nl = (t.body || []).filter(b => b.k === 'l').length, nd = (t.dec || []).length;
          return `<label class="pk-t"><input type="checkbox" data-pk="${esc(k)}"${sel.has(k) ? ' checked' : ''}><b>${i + 1}.</b><span>${q ? C.hlText(t.title || '(제목 없음)', q) : esc(t.title || '(제목 없음)')}</span>
            <small>${nl ? `내용 ${nl}줄` : ''}${nd ? ` · 결정 ${nd}` : ''}${ot ? ` · <em>못 끝낸 임무 ${ot}</em>` : ''}${t.thrFrom ? ` · ↩ ${esc(C.fmtMDY(t.thrFrom))}부터 이어짐` : ''}</small></label>`; }).join('')}
      </div>`).join('') + (!q && rows.length > lim ? `<button type="button" class="addb" data-pkmore>지난 회의 ${Math.min(8, rows.length - lim)}개 더 보기 (모두 ${rows.length}개)</button>` : '')
      + (ms.length && !rows.length ? `<div class="dv-hint">찾는 말이 든 주제가 없어요.</div>` : '');
    const n = sel.size;
    md.box.querySelector('#pk-n').textContent = n ? `고른 주제 ${n}개` : '가져올 주제를 골라 주세요';
    const ok = md.box.querySelector('[data-c="ok"]'); ok.disabled = !n; ok.textContent = n ? `주제 ${n}개 가져오기` : '가져오기';
  };
  async function paintSrc(first){
    body.innerHTML = `${srcBar()}<div class="dv-hint" style="padding:10px 0">불러오는 중…</div>`;
    const err = await load();
    if(!ED){ md.close(); return; }
    if(err){ sel.clear(); const ok = md.box.querySelector('[data-c="ok"]'); ok.disabled = true; ok.textContent = '가져오기'; md.box.querySelector('#pk-n').textContent = '';
      body.innerHTML = `${srcBar()}<div class="dv-hint">지난 회의록을 불러오지 못했어요 — ${esc(err === 'permission-denied' ? '볼 권한이 없어요' : err)}</div>`; return; }
    sel.clear();
    if(first && preMid){ const pm = ms.find(m => m.id === preMid); if(pm) (pm.topics || []).forEach(t => { if(openTasks(pm, t)) sel.set(pm.id + '|' + t.id, true); }); }
    /* (v-100) ☆ 모아 둔 주제 — 목차에서 모아 둔 것을 맨 위에 */
    const pinK = new Set(((X.pins && X.pins()) || []).filter(p => p.org === src().org).map(p => p.mid + '|' + p.tid));
    pinned = [];
    ms.forEach(m => (m.topics || []).forEach((t, i) => { if(pinK.has(m.id + '|' + t.id)) pinned.push({ m, t, i }); }));
    body.innerHTML = `${srcBar()}<div class="pk-top"><input type="search" id="pk-q" placeholder="주제 · 내용으로 찾기 (예: 신발장, 종업식)" value="${esc(q)}">
        <label class="ck"><input type="checkbox" id="pk-body" checked>지난 내용 · 결정도 함께</label>
        <label class="ck"><input type="checkbox" id="pk-att"${Object.keys(ED.att).length || cross() ? '' : ' checked'}>참석 명단도 그 회의와 같게</label></div>
      ${crossNote()}
      <div class="dv-hint" style="margin:6px 0 10px">가져온 내용은 회색 상자에 <b>«↩ 9/28 회의에서 가져온 내용»</b>으로, 새로 적는 줄은 <b>«✎ 이번 회의»</b> 아래에 보여서 한눈에 구분돼요. 못 끝낸 임무도 한 줄로 따라와요.</div>
      <div id="pk-list"></div>`;
    let qt = null;
    body.querySelector('#pk-q').addEventListener('input', e => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { q = v.trim().toLowerCase(); draw(); }, 180); });
    draw();
  }
  body.addEventListener('change', e => { const c = e.target.closest('[data-pk]'); if(!c) return; c.checked ? sel.set(c.dataset.pk, true) : sel.delete(c.dataset.pk); draw(); });
  body.addEventListener('click', e => {
    const sb = e.target.closest('[data-pksrc]');
    if(sb){ const i = +sb.dataset.pksrc; if(i === si) return;
      if(sel.size && !confirm(`고른 주제 ${sel.size}개는 빠져요. 다른 회의록으로 바꿀까요?`)) return;
      si = i; lim = 8; paintSrc(false); return; }
    const a = e.target.closest('[data-pkall]');
    if(a){ const m = ms.find(x => x.id === a.dataset.pkall); const ts = (m.topics || []).filter(hitT); const all = ts.every(t => sel.has(m.id + '|' + t.id));
      ts.forEach(t => all ? sel.delete(m.id + '|' + t.id) : sel.set(m.id + '|' + t.id, true)); draw(); return; }
    if(e.target.closest('[data-pkmore]')){ lim += 8; draw(); }
  });
  await paintSrc(true);
  md.box.querySelector('[data-c="ok"]').onclick = () => {
    if(!ED) { md.close(); return; }
    const S = src(), cx = cross();
    if(!sel.size || !md.box.querySelector('#pk-body')) return;
    if(cx && S.org === 'lead' && !confirm(`주임 회의록의 주제 ${sel.size}개를 «${C.MORG[ED.org] || ''}» 회의록으로 가져와요.\n\n저장하면 이 회의록을 볼 수 있는 교직원이 모두 보게 돼요. 댓글 · 고친 기록 · 공유 명단은 따라가지 않아요.\n\n가져올까요?`)) return;
    const withBody = md.box.querySelector('#pk-body').checked;
    const picked = ms.filter(m => (m.topics || []).some(t => sel.has(m.id + '|' + t.id))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let tps = [];
    for(const m of picked) tps = tps.concat(carryTopics(m, (m.topics || []).filter(t => sel.has(m.id + '|' + t.id)), withBody, tk, cx ? (S.label || C.MORG[S.org] || '') : ''));
    if(md.box.querySelector('#pk-att').checked && picked.length){
      const last = picked[picked.length - 1];
      if(!last.imported){ const r = rosterFrom(last); for(const u in r) if(!ED.att[u]) ED.att[u] = r[u]; Object.assign(ED.attNames, last.attNames || {}); paintAtt(); }
    }
    const box = R.querySelector('#ed-topics');
    const ets = [...box.querySelectorAll('.et')];
    if(ets.length === 1 && !ets[0].querySelector('.et-title').value.trim() && ![...ets[0].querySelectorAll('.ol-t')].some(x => x.textContent.trim()) && !ets[0].querySelector('.ob,.dl,.kr')) ets[0].remove();
    tps.forEach(t => { box.insertAdjacentHTML('beforeend', topicHTML(t)); hydrate(box.lastElementChild, t); });
    renumAll(); dirty(); md.close();
    X.toast(`주제 ${tps.length}개를 가져왔어요 — 회색 상자 아래 «이번 회의»에 새 내용을 적어 주세요`);
    const firstNew = box.querySelectorAll('.et')[box.querySelectorAll('.et').length - tps.length];
    if(firstNew){ firstNew.scrollIntoView({ block: 'start', behavior: 'smooth' }); const l = [...firstNew.querySelectorAll('.et-body > .ol:not(.prev) .ol-t')].pop(); if(l) setTimeout(() => caretAt(l, true), 300); }
  };
}

/* ═══ 모으기 · 미리 보기 · 임시 저장 ═══ */
function collect(){
  const C = X.C;
  const q = s => R.querySelector(s);
  const topics = [...R.querySelectorAll('.et')].map(el => {
    const body = [];
    [...el.querySelector('.et-body').children].forEach(r => {
      if(r.classList.contains('ol')){
        const h = sanitizeInline(r.querySelector('.ol-t').innerHTML);
        if(C.textOf(h).trim()){ const ln = { k: 'l', lv: C.clampLv(r.dataset.lv), h }; if(r.dataset.from) ln.from = r.dataset.from; body.push(ln); }
      } else if(r.classList.contains('ob') && r._b && r._b.k !== 'wait'){
        const b = { ...r._b };
        const cap = r.querySelector('.ob-cap'); b.cap = cap ? cap.value.trim() : (b.cap || '');
        if(b.k === 'tbl'){ const t = r.querySelector('table'); b.h = t ? cleanEditedTable(t) : (b.h || ''); }
        if(b.k === 'link'){ b.url = C.safeUrl((r.querySelector('.ob-url') || {}).value || b.url || ''); b.title = ((r.querySelector('.ob-ttl') || {}).value || '').trim(); if(!b.url) return; }
        if(b.k === 'file' && r.querySelector('.ob-url')) b.link = C.safeUrl(r.querySelector('.ob-url').value);
        Object.keys(b).forEach(k => { if(b[k] === undefined) delete b[k]; });
        body.push(b);
      }
    });
    const dec = [...el.querySelectorAll('.dl')].map(d => ({ id: d.dataset.did, h: sanitizeInline(d.querySelector('.dl-t').innerHTML) })).filter(d => C.textOf(d.h).trim());
    const tasks = [...el.querySelectorAll('.kr')].map(k => {
      const uids = (k._uids || []).slice();
      const names = {}; uids.forEach(u => names[u] = X.nameOf(u) || (k._names || {})[u] || '');
      return { id: k.dataset.kid, h: sanitizeInline(k.querySelector('.kr-t').innerHTML), uids, names, due: k.querySelector('.kr-d').value || '' };
    }).filter(k => C.textOf(k.h).trim());
    const t = { id: el.dataset.tid, title: el.querySelector('.et-title').value.trim(), body, dec, tasks };
    if(el._thr){ t.thr = el._thr; t.thrFrom = el._thrFrom || ''; }
    if(el._ag){ t.agendaId = el._ag; t.agBy = el._agBy || ''; t.agSt = el._agSt === 'doing' ? 'doing' : 'done'; }
    return t;
  }).filter(t => t.title || t.body.length || t.dec.length || t.tasks.length);
  const attNames = {};
  Object.keys(ED.att).forEach(u => attNames[u] = X.nameOf(u) || ED.attNames[u] || '');
  const att = {};
  for(const [u, a] of Object.entries(ED.att)) att[u] = a.s === 'x' ? { s: 'x', r: a.r || '' } : { s: 'o' };
  return {
    org: ED.org, type: ED.type || '', title: (q('#ed-title') || {}).value ? q('#ed-title').value.trim() : '',
    date: (q('#ed-date') || {}).value || ED.date, time: (q('#ed-time') || {}).value || '', place: (q('#ed-place') || {}).value ? q('#ed-place').value.trim() : '',
    writerUid: ED.writerUid || '', writerName: ED.writerName || '', att, attNames, guests: (q('#ed-guests') || {}).value ? q('#ed-guests').value.trim() : '',
    topics, imported: !!ED.imported,
  };
}
function preview(){
  const d = collect();
  const md = X.modal('문서로 미리보기', `<div class="dv-paper" style="min-height:0">${X.C.renderDoc({ ...d, id: ED.id }, { files: Object.fromEntries(X.STORE.cache) })}</div>`, '', 'wide');
  md.box.querySelectorAll('.md-ph[data-fid]').forEach(async ph => { const s = await X.STORE.getImage(ph.dataset.fid); if(s && ph.isConnected){ const im = document.createElement('img'); im.src = s; ph.replaceWith(im); } });
}
/* 📝 이 기기 한 벌의 이름 — v179 사람마다 · 회의록마다 (같은 컴퓨터를 여럿이 써도 · 새 회의록이 여럿이어도)
   예전 이름(OLDKEY: mtg_draft_new · mtg_draft_<id> · 주임 mtg_draft_lead_<uid>_new)도 한 번은 찾아 준다 */
const LKEY = E => { E = E || ED; return (E.org === 'lead' ? 'mtg_draft_lead_' : 'mtg_draft_u_') + X.CU.uid + '_' + E.id; };
const OLDKEY = E => { E = E || ED; return E.org === 'lead' ? `mtg_draft_lead_${X.CU.uid}_${E.isNew ? 'new' : E.id}` : E.isNew ? 'mtg_draft_new' : 'mtg_draft_' + E.id; };
const SREF = E => X.FS.doc(X.db, 'mtgDrafts', `${X.CU.uid}_${E.id}`);   // 📝 v179 «내 임시 저장» 문서 (쓴 사람만 읽고 씀 · 보안 규칙 v48)
const hm = () => new Date().toTimeString().slice(0, 5);
const bytes = o => { try{ return new TextEncoder().encode(JSON.stringify(o)).length; }catch(e){ return JSON.stringify(o).length * 3; } };
const MAXB = 950000;   // Firestore 문서 한 개 1MiB (글자가 아니라 바이트 · 한글은 한 글자 3바이트)
function status(t, cls){ const s = R && R.querySelector('#ed-saved'); if(s){ s.textContent = t; s.className = cls || ''; } }
/* 이 기기에 한 벌 — 인터넷이 끊겨도 · 서버에 남기기 전이라도 */
function saveDraft(){
  if(!ED || !ED.dirty || !R || !R.querySelector('.ed')) return;     // 편집 화면이 없으면 (빈 내용으로 덮지 않게)
  try{ localStorage.setItem(LKEY(), JSON.stringify({ at: Date.now(), id: ED.id, isNew: !!ED.isNew, baseRev: ED.baseRev, kept: !!ED.kept, org: ED.org, data: collect() })); ED._locAt = Date.now(); }catch(e){}
}
function dropLocal(E){   // 이 기기 것 지우기 (예전 이름은 같은 회의록 것일 때만)
  try{ localStorage.removeItem(LKEY(E)); }catch(e){}
  try{ const k = OLDKEY(E), d = JSON.parse(localStorage.getItem(k) || 'null'); if(d && (!d.id || d.id === E.id)) localStorage.removeItem(k); }catch(e){}
}
/* 📝 v179 «내 임시 저장»(서버)에 남기기 — 자동 저장 · «임시 저장» 단추 · 나갈 때
   · 불러오기(checkDraft)가 끝나기 전 · 불러오지 못했을 때 · 다른 창에서 게시 · 버렸을 때는 서버에 쓰지 않는다 (있던 것을 덮지 않게) */
async function srvSave(kind){
  const E = ED;
  if(!E || E._dead || E.saving || !R || !R.querySelector('.ed')) return false;
  if(!E._ready){ clearTimeout(E._st); E._st = setTimeout(() => srvSave(kind), 1500); return false; }
  if(E._noSrv && kind !== 'keep') return false;
  if(!E.dirty && kind !== 'keep') return true;
  clearTimeout(E._st); E._try = Date.now();
  const data = collect(), at = Date.now();
  if(kind === 'keep') E.kept = true;
  const body = draftBody(E, data, at);
  if(bytes(body) > MAXB){ status('회의록이 너무 커서 이 기기에만 저장돼요 — 표를 나누거나 문서로 첨부해 주세요', 'warn'); return false; }
  const seq = (E._seq = (E._seq || 0) + 1);
  if(ED === E && !E.srvAt) status('자동 저장 중…');
  try{
    E._sP = X.FS.setDoc(SREF(E), body);
    await Promise.race([E._sP, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 9000))]);
    E.srvAt = Date.now(); E._noSrv = false; E._gone = false;
    if(!E._locAt || E._locAt <= at) dropLocal(E);          // 서버에 남았으면 이 기기 것은 정리 (오래된 것이 다시 뜨지 않게)
    if(ED === E && seq === E._seq) status(`✓ ${E.kept ? '임시 저장됨' : '자동 저장됨'} · ${hm()} · 게시하기 전엔 나만 보여요`, 'ok');
    return true;
  }catch(e){
    if(ED === E){
      status(e.code === 'permission-denied' ? `이 기기에만 저장됨 · ${hm()} — «내 임시 저장»은 보안 규칙 v48 게시 뒤에 돼요`
        : e.code === 'invalid-argument' ? '회의록이 너무 커서 이 기기에만 저장돼요 — 표를 나누거나 문서로 첨부해 주세요'
        : `이 기기에만 저장됨 · ${hm()} — 인터넷이 돌아오면 다시 남겨요`, 'warn');
      if(E.dirty && !E._dead && e.code !== 'invalid-argument' && e.code !== 'permission-denied'){ clearTimeout(E._st); E._st = setTimeout(() => srvSave(), 30000); }
    }
    return false;
  }
}
function draftBody(E, data, at){
  return { uid: X.CU.uid, name: X.CU.name || '', book: E.org === 'lead' ? 'lead' : '', org: data.org || E.org, meetingId: E.id, isNew: !!E.isNew,
    baseRev: E.baseRev || 0, kind: E.kept ? 'keep' : 'auto', title: X.C.titleOf(data), date: data.date || '',
    topic1: String(((data.topics || []).find(t => t.title) || {}).title || '').slice(0, 80), nTopics: (data.topics || []).length,   // 목록에서 알아보기 쉽게 — 첫 주제
    data, atMs: at, updatedAt: X.FS.serverTimestamp() };
}
function stopWatch(E){ try{ E && E._unW && E._unW(); }catch(e){} if(E) E._unW = null; }
/* 다른 창 · 다른 기기에서 이 임시 저장을 게시하거나 버리면 — 이 창은 더 서버에 쓰지 않음 (되살아나지 않게) */
function watchSrv(E){
  stopWatch(E);
  try{ E._unW = X.FS.onSnapshot(SREF(E), sn => {
    if(ED !== E || E._dead) return;
    if(!sn.exists() && E.srvAt && !E._gone){
      E._gone = true; E._noSrv = true;
      status('다른 창에서 게시했거나 버렸어요 — 이 창에서 더 쓴 것은 이 기기에만 남아요 (필요하면 «📝 임시 저장»)', 'warn');
    }
  }, () => {}); }catch(e){}
}
/* 버리기 — 서버 · 이 기기 둘 다 */
function discardDraft(E){
  E = E || ED; if(!E) return Promise.resolve();
  E._dead = true; clearTimeout(E._st); clearTimeout(E._dt); stopWatch(E);
  dropLocal(E);
  return X.FS.deleteDoc(SREF(E)).catch(() => {});
}
function applyDraft(d){
  const v = d.data || {};
  if(ED.isNew && d.id) ED.id = d.id;
  Object.assign(ED, { org: (v.org && X.WRITE.includes(v.org) && (v.org === 'lead') === (ED.org === 'lead')) ? v.org : ED.org, type: v.type, title: v.title, date: v.date, time: v.time, place: v.place, att: v.att || {}, attNames: v.attNames || {}, guests: v.guests || '', topics: v.topics && v.topics.length ? v.topics : [blankTopic()] });
  if(!ED.isNew && d.baseRev != null) ED.baseRev = d.baseRev;   // 그 사이 다른 분이 게시했으면 게시할 때 한 번 더 묻게 (그 판에서 고친 것이니까)
  if(d.kind === 'keep') ED.kept = true;
  paint(); ED.dirty = true; window.__mtDirty = true;
}
/* 열 때 — 서버 · 이 기기(새 이름 · 예전 이름)에서 가장 새것을 찾아 «이어서 쓰기» (목록에서 들어오면 바로) */
async function checkDraft(pre){
  const E = ED;
  const rd = k => { try{ const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && v.data && Date.now() - (v.at || 0) < 30 * 86400000 ? v : null; }catch(e){ return null; } };
  const locs = [rd(LKEY(E)), rd(OLDKEY(E))].filter(Boolean).filter(v => !E.resume || !v.id || v.id === E.id);
  let srv = null, failed = false;
  try{ const sn = await X.FS.getDoc(SREF(E)); if(sn.exists()) srv = sn.data(); }
  catch(e){ failed = true; if(pre && pre.meetingId === E.id) srv = pre; }   // 목록이 이미 받아 둔 것이 있으면 그것으로
  if(ED !== E || !R.querySelector('.ed')) return;
  E._ready = true;
  if(failed && !srv){
    E._noSrv = true;   // 서버에 있을지 모르는 임시 저장을 덮지 않게
    status('«내 임시 저장»을 확인하지 못했어요 — 인터넷을 확인하고 다시 열어 주세요 (이 화면에서 쓴 것은 이 기기에 남아요)', 'warn');
  }
  const cand = [];
  if(srv && srv.data) cand.push({ at: srv.atMs || X.C.tsMs(srv.updatedAt) || 0, id: srv.meetingId, baseRev: srv.baseRev || 0, kind: srv.kind, data: srv.data, srv: true });
  locs.forEach(v => cand.push({ at: v.at || 0, id: v.id, baseRev: v.baseRev || 0, kind: v.kept ? 'keep' : 'auto', data: v.data }));
  if(!cand.length){ if(!failed) watchSrv(E); return; }
  let d = cand.sort((a, b) => b.at - a.at)[0];
  /* 이 기기의 새 회의록(예전 이름)이 다른 id 면 — 그 id 의 서버 것이 더 새것인지도 본다 */
  if(!d.srv && E.isNew && d.id && d.id !== E.id){
    try{ const sn = await X.FS.getDoc(X.FS.doc(X.db, 'mtgDrafts', `${X.CU.uid}_${d.id}`)); const o = sn.exists() ? sn.data() : null;
      if(o && o.data && (o.atMs || 0) > d.at) d = { at: o.atMs, id: o.meetingId, baseRev: o.baseRev || 0, kind: o.kind, data: o.data, srv: true }; }catch(e){}
    if(ED !== E) return;
  }
  const stale = !ED.isNew && d.baseRev !== ED.baseRev;
  const staleTxt = stale ? ' — 그 사이 다른 분이 고쳐 게시했어요. 이어서 쓰고 게시할 때 한 번 더 물어요.' : '';
  const finish = () => { if(!failed) watchSrv(ED); };
  if(ED.resume){
    applyDraft(d); finish();
    status(`📝 ${d.kind === 'keep' ? '임시 저장한' : '자동 저장된'} 내용을 이어서 써요 (${X.C.fmtStamp(d.at)}) · 게시하기 전엔 나만 보여요`, 'ok');
    if(stale) R.querySelector('#ed-rs').innerHTML = `<div class="ed-rs">⚠ <span>${esc(staleTxt.slice(3))}</span></div>`;
    if(!d.srv && !failed) srvSave();   // 이 기기에만 있던 것이면 서버에도
    return;
  }
  /* 고르기 전에는 서버의 임시 저장을 덮지 않음 (이 기기에만 저장) — «이어서 쓰기» · «버리기»를 고르면 다시 */
  if(d.srv){ E._pend = true; E._noSrv = true; }
  const box = R.querySelector('#ed-rs');
  box.innerHTML = `<div class="ed-rs">📝 <span>${d.kind === 'keep' ? '임시 저장한' : '게시하지 않은'} ${ED.isNew ? '새 회의록' : '고친 내용'}이 있어요 (${esc(X.C.fmtStamp(d.at))} · ${d.srv ? '나만 보여요' : '이 기기에만 있어요'})${staleTxt}</span>
    <div class="mt-sp"></div><button type="button" class="mt-btn sm p" data-dr="use">이어서 쓰기</button><button type="button" class="mt-btn sm" data-dr="drop">버리기</button></div>`;
  box.onclick = async e => {
    const b = e.target.closest('[data-dr]'); if(!b) return;
    if(b.dataset.dr === 'drop'){
      if(!confirm('임시 저장한 내용을 버릴까요? 되살릴 수 없어요.')) return;
      const tmp = { id: d.id || ED.id, isNew: ED.isNew, org: ED.org };
      dropLocal(tmp);
      X.FS.deleteDoc(X.FS.doc(X.db, 'mtgDrafts', `${X.CU.uid}_${tmp.id}`)).catch(() => {});
      if(ED.isNew && tmp.id === ED.id) ED.id = X.FS.doc(X.FS.collection(X.db, COL().m)).id;   // 버린 것과 같은 id 로 다시 만들지 않게
      E._pend = false; if(!failed) E._noSrv = false;
      box.innerHTML = ''; finish(); if(ED.dirty) srvSave(); return;
    }
    E._pend = false; if(!failed) E._noSrv = false;
    applyDraft(d); finish(); X.toast('임시 저장한 내용을 불러왔어요');
    status(`📝 ${X.C.fmtStamp(d.at)}에 남긴 내용을 이어서 써요 · 게시하기 전엔 나만 보여요`, 'ok');
    if(!d.srv && !failed) srvSave();
  };
  if(!failed) watchSrv(E);
}
/* 뒤로 가기 등으로 편집 화면을 떠날 때 — 쓰던 것은 «내 임시 저장»에 남기고 정리 */
export function closeEditor(){
  try{ RO && RO.disconnect(); }catch(e){} RO = null;
  if(!ED) return;
  const E = ED;
  clearTimeout(E._dt); clearTimeout(E._st); stopWatch(E);
  if(!E.saving){   // 게시하는 중이면 그쪽이 마무리 (임시 저장을 다시 만들지 않게)
    saveDraft();
    if(E.dirty && !E._dead && !E._pend) srvSave('quiet').then(ok => { if(!ok && E.dirty && !E._dead) X.toast('«내 임시 저장»에 남기지 못했어요 — 이 기기에는 남아 있어요 (목록 위 «이 기기에만»)', 'err'); });
  }
  if(!E.isNew && !E.saving) X.FS.updateDoc(X.FS.doc(X.db, COL().m, E.id), { editing: null }).catch(()=>{});
  window.onbeforeunload = null;
  document.querySelectorAll('.wp').forEach(p => p.remove());
  ED = null;
}
/* «‹ 나가기» — 쓰던 것이 있으면 임시 저장 · 버리기 · 계속 쓰기 가운데 고르기 */
function cancel(){
  if(uploading() && !confirm('사진 · 문서를 올리는 중이에요. 그래도 나갈까요? (올리던 것은 빠질 수 있어요)')) return;
  if(!ED.dirty) return leave();
  const md = X.modal('쓰던 내용을 어떻게 할까요?', `<div class="ed-lv">
      <button type="button" class="mt-btn p" data-lv="keep">📝 임시 저장하고 나가기<small>게시하지 않고 나만 보이게 — 목록 위 «내 임시 저장»에서 이어서 써요</small></button>
      <button type="button" class="mt-btn" data-lv="drop">버리고 나가기<small>${ED.isNew ? '이 새 회의록을 남기지 않아요' : '고친 것을 버리고 게시된 모습 그대로 둬요'}</small></button>
      <button type="button" class="mt-btn" data-lv="stay">계속 쓰기</button></div>`, '');
  md.box.addEventListener('click', e => {
    const b = e.target.closest('[data-lv]'); if(!b) return;
    md.close();
    if(b.dataset.lv === 'keep') return keep();
    if(b.dataset.lv === 'drop'){ discardDraft(); return leave(); }
  });
}
function leave(){
  if(!ED) return;
  clearTimeout(ED._dt); clearTimeout(ED._st); stopWatch(ED);
  const id = ED.isNew ? '' : ED.id;
  if(!ED.isNew) X.FS.updateDoc(X.FS.doc(X.db, COL().m, id), { editing: null }).catch(()=>{});
  ED.dirty = false; window.__mtDirty = false; window.onbeforeunload = null;
  ED = null;
  X.onCancel(id);
}
/* «📝 임시 저장» — 게시하지 않고 나만 보이게 두고 나간다 */
async function keep(){
  if(!ED || ED.saving) return;
  const E = ED;
  if(uploading()){ X.toast('사진 · 문서를 올리는 중이에요 — 다 올라간 뒤 다시 눌러 주세요', 'err'); return; }
  const d = collect();
  if(E.isNew && !d.title && !d.topics.length && !E.kept){ X.toast('적은 내용이 없어 남기지 않았어요'); discardDraft(); return leave(); }
  if(!E._ready){ X.toast('임시 저장을 확인하는 중이에요 — 잠깐 뒤 다시 눌러 주세요'); return; }
  if(E._noSrv && !E._gone){   // 처음에 «내 임시 저장»을 확인하지 못했거나 · 위 «이어서 쓰기 / 버리기»를 고르지 않았으면 — 있으면 묻기
    try{ const sn = await X.FS.getDoc(SREF(E)); const o = sn.exists() ? sn.data() : null;
      if(o && !confirm(`«내 임시 저장»에 ${X.C.fmtStamp(o.atMs || X.C.tsMs(o.updatedAt))}에 남긴 것이 있어요.\n지금 이 화면 내용으로 바꿀까요? (취소: 그대로 두고 이 화면에 머물기)`)) return;
    }catch(e){}
    if(ED !== E) return;
  }
  E.dirty = true; saveDraft();
  const btns = R.querySelectorAll('[data-e="keep"]'); btns.forEach(b => { b.disabled = true; b.textContent = '임시 저장 중…'; });
  const ok = await srvSave('keep');
  if(ED !== E) return;
  if(!ok){
    btns.forEach(b => { b.disabled = false; b.innerHTML = '📝<span class="lb"> 임시 저장</span>'; });
    X.toast('«내 임시 저장»에 남기지 못했어요 — 이 기기에는 남아 있어요. 인터넷을 확인하고 다시 눌러 주세요', 'err');
    return;
  }
  X.toast('임시 저장했어요 — 목록 위 «내 임시 저장»에서 이어서 써요 (나만 보여요)');
  leave();
}

/* ═══ 저장 — 수정 이력 한 벌 · 임무 맞추기 · 알림 ═══ */
const uploading = () => !!(R && R.querySelector('.ob[data-k="wait"]'));
async function save(force){
  if(!ED || ED.saving) return;
  const E = ED;
  if(uploading()){ X.toast('사진 · 문서를 올리는 중이에요 — 다 올라간 뒤에 게시해 주세요', 'err'); return; }
  const d = collect();
  if(!d.date){ X.toast('날짜를 골라 주세요', 'err'); return; }
  if(!d.type){ X.toast('회의 종류를 골라 주세요', 'err'); return; }
  if(!d.topics.length){ X.toast('주제를 하나 이상 적어 주세요', 'err'); return; }
  if(bytes(d) > MAXB){ X.toast('회의록이 너무 커요 — 표를 나누거나 문서로 첨부해 주세요', 'err'); return; }
  E.saving = true; clearTimeout(E._st);
  const btns = R.querySelectorAll('[data-e="save"]'); btns.forEach(b => { b.disabled = true; b.textContent = '게시 중…'; });
  try{
    await persist(X, E.id, d, { baseRev: E.baseRev, force: !!force, isNew: E.isNew });
    discardDraft(E);                                                 // 📝 v179 게시했으면 «내 임시 저장»은 지움
    E.dirty = false; window.__mtDirty = false; window.onbeforeunload = null;
    X.toast(E.isNew ? '게시했어요 ✓' : '고친 것을 게시했어요 ✓');
    if(ED === E){ ED = null; X.onSaved(E.id); }                       // 게시하는 사이 다른 화면으로 갔으면 그대로
  }catch(e){
    E.saving = false;
    if(ED !== E){   // 게시하는 사이 다른 화면으로 갔는데 게시가 안 됐으면 — 쓰던 것을 이 기기 · «내 임시 저장»에
      try{ localStorage.setItem(LKEY(E), JSON.stringify({ at: Date.now(), id: E.id, isNew: !!E.isNew, baseRev: E.baseRev, kept: !!E.kept, org: E.org, data: d })); }catch(_){}
      if(E._ready && !E._noSrv && bytes(d) < MAXB) X.FS.setDoc(SREF(E), draftBody(E, d, Date.now())).catch(() => {});
      X.toast('게시하지 못했어요 — 쓰던 것은 «내 임시 저장»에 남겼어요', 'err'); return;
    }
    btns.forEach(b => { b.disabled = false; }); note();
    if(e.message === 'conflict'){
      const c = e.cur || {};
      if(confirm(`${c.updatedByName || '다른 선생님'} 님이 먼저 고쳐 게시했어요 (${X.C.fmtStamp(X.C.tsMs(c.updatedAt))}).\n\n내 것으로 게시할까요? 그분이 고친 모습도 기록에 그대로 남아요.\n(취소: 게시하지 않고 이 화면에 머물기)`)){
        E.baseRev = c.rev || 0; return save(true);
      }
      return;
    }
    console.error(e);
    X.toast('게시하지 못했어요 — ' + (e.code === 'permission-denied' ? '이 기관 회의록을 쓸 권한이 없어요 (보안 규칙 확인)' : (e.code || e.message)), 'err');
  }
}
async function persist(ctx, id, data, o){
  const { db, FS, C, CU } = ctx;
  const K = COL(ctx);
  const ref = FS.doc(db, K.m, id);
  let prevData = null, saved = null, sumTxt = '';
  await FS.runTransaction(db, async tx => {
    const cur = await tx.get(ref);
    prevData = cur.exists() ? cur.data() : null;
    if(prevData && !o.force && (prevData.rev || 0) !== (o.baseRev || 0)){ const er = new Error('conflict'); er.cur = prevData; throw er; }
    const rev = (prevData ? prevData.rev || 0 : 0) + 1;
    const ch = C.changeSummary(prevData, data);
    const now = Date.now();
    const topics = data.topics.map(t => { const { ed, ...r } = t; return r; });   // 📜 v177 «누가 고쳤는지»는 회의록에 남기지 않음 (예전 표시도 저장할 때 지움) — 기록은 mtgLog · 수정 이력(수퍼관리자)
    saved = { ...data, topics, org: prevData ? prevData.org : data.org, sem: C.semOf(data.date), rev,
      createdBy: prevData ? (prevData.createdBy || CU.uid) : CU.uid, createdAt: prevData && prevData.createdAt ? prevData.createdAt : FS.serverTimestamp(),
      updatedAt: FS.serverTimestamp(), updatedByUid: CU.uid, updatedByName: CU.name || '',
      cmtCount: prevData ? (prevData.cmtCount || 0) : 0, lastCmtAt: prevData && prevData.lastCmtAt ? prevData.lastCmtAt : null,
      deleted: false, editing: null, imported: prevData ? !!prevData.imported : !!data.imported, source: prevData ? (prevData.source || '') : '' };
    tx.set(ref, saved);
    const snap = { type: saved.type, title: saved.title, date: saved.date, time: saved.time, place: saved.place, writerUid: saved.writerUid, writerName: saved.writerName,
      att: saved.att, attNames: saved.attNames, guests: saved.guests, topics: saved.topics, imported: saved.imported };
    sumTxt = o.sum || ch.sum;
    tx.set(FS.doc(db, K.v, `${id}_${rev}`), { meetingId: id, org: saved.org, rev, at: FS.serverTimestamp(), atMs: now, uid: CU.uid, name: CU.name || '',
      sum: sumTxt, data: snap });
  });
  /* 📜 v177 한 줄 기록 (수퍼관리자만 · 관리자 › 활동 로그) */
  if(typeof ctx.log === 'function'){ try{ ctx.log(o.sum && /되돌림/.test(o.sum) ? '되돌림' : prevData ? '고침' : '새로 씀', { ...saved, id }, { rev: saved.rev, detail: sumTxt || '' }); }catch(e){} }
  await syncTasks(ctx, id, saved, prevData);
  if(!(o.sum && /되돌림/.test(o.sum))) await markAgendas(ctx, id, saved, prevData);   // 수정 이력 «되돌리기»에서는 안건 상태를 바꾸지 않음
  if(typeof ctx.onPersist === 'function'){ try{ await ctx.onPersist(id, saved, prevData); }catch(e){ console.warn('onPersist', e); } }   // 🔒 v175 공유본 맞추기
  return saved;
}
/* 📮 v180 회의록에 넣은 안건 → «다룸» (이 회의록으로 바로 가기) · 올린 분께 알림 — 이번에 새로 넣은 것만 */
async function markAgendas(ctx, id, m, prev){
  const { db, FS, C, CU } = ctx;
  const K = COL(ctx); if(!K.a || typeof ctx.agendas !== 'function') return;
  const before = new Map(((prev && prev.topics) || []).filter(t => t.agendaId).map(t => [t.agendaId, t.agSt === 'doing' ? 'doing' : 'done']));
  const list = ctx.agendas() || [];
  const mtitle = C.titleOf(m);
  const jobs = [];
  (m.topics || []).forEach((t, ti) => {
    if(!t.agendaId) return;
    const want = t.agSt === 'doing' ? 'doing' : 'done';
    const had = before.get(t.agendaId);
    if(had && had === want) return;                                     // 이 회의록에서 이미 그 상태로 정함
    jobs.push((async () => {
      let a = list.find(x => x.id === t.agendaId);
      if(!a && had){ try{ const sn = await FS.getDoc(FS.doc(db, K.a, t.agendaId)); if(sn.exists()) a = { id: sn.id, ...sn.data() }; }catch(e){} }   // 고칠 때 — 이미 완료된 안건도
      if(!a || (m.org !== 'lead' && a.org !== m.org)) return;           // 이 회의록 기관의 안건만
      if(had && a.meetingId && a.meetingId !== id) return;              // 그 뒤 다른 회의록이 이어받은 안건은 그대로
      if(!had && ['done', 'used'].includes(a.status)) return;           // 다른 회의에서 이미 끝낸 안건은 그대로
      await FS.updateDoc(FS.doc(db, K.a, a.id), { status: want, meetingId: id, meetingDate: m.date || '', meetingTitle: String(mtitle || '').slice(0, 150),
        usedAt: FS.serverTimestamp(), usedByUid: CU.uid, usedByName: CU.name || '', updatedAt: FS.serverTimestamp() });
      const to = a.byUid || a.uid;
      if(had || !to || to === CU.uid) return;                           // 처음 넣었을 때만 · 나에게는 안 보냄
      await FS.addDoc(FS.collection(db, 'mtgNotifs'), { toUid: to, kind: 'agenda', meetingId: id, org: m.org, ...(m.org === 'lead' ? { book: 'lead' } : {}), mtitle, date: m.date,
        tgt: 't:' + t.id, where: `${ti + 1}. ${t.title || ''}`, text: `${String(a.title || '').slice(0, 120)} · ${want === 'doing' ? '진행 중' : '완료'}`, fromUid: CU.uid, fromName: CU.name || '', at: FS.serverTimestamp(), read: false });
    })().catch(e => console.warn('agenda', e)));
  });
  if(jobs.length) await Promise.all(jobs);
}
async function syncTasks(ctx, id, m, prev){
  const { db, FS, C, CU } = ctx;
  const K = COL(ctx);
  const want = new Map();
  (m.topics || []).forEach((t, ti) => (t.tasks || []).forEach(k => { if(C.textOf(k.h).trim()) want.set(C.taskKey(id, k.id), { t, ti, k }); }));
  const have = new Map();
  try{ const s = await FS.getDocs(FS.query(FS.collection(db, K.t), FS.where('meetingId', '==', id))); s.forEach(d => have.set(d.id, d.data())); }catch(e){}
  const batch = FS.writeBatch(db);
  const mtitle = C.titleOf(m);
  for(const [key, { t, ti, k }] of want){
    const def = { meetingId: id, org: m.org, sem: m.sem, date: m.date, mtitle, topicId: t.id, topicNo: ti + 1, topicTitle: t.title || '', kid: k.id,
      h: C.textOf(k.h).trim(), uids: k.uids || [], names: k.names || {}, due: k.due || '', deleted: false, updatedAt: FS.serverTimestamp() };
    if(have.has(key)) batch.set(FS.doc(db, K.t, key), def, { merge: true });
    else batch.set(FS.doc(db, K.t, key), { ...def, status: 'todo', cmt: 0, createdAt: FS.serverTimestamp(), createdBy: CU.uid });
  }
  for(const key of have.keys()) if(!want.has(key)) batch.delete(FS.doc(db, K.t, key));
  try{ await batch.commit(); }catch(e){ console.warn('tasks', e); X && X.toast && X.toast('임무를 홈에 올리지 못했어요 — ' + (e.code || e.message), 'err'); }
  const old = new Map();
  ((prev && prev.topics) || []).forEach(t => (t.tasks || []).forEach(k => old.set(k.id, new Set(k.uids || []))));
  const jobs = [];
  for(const [key, { t, ti, k }] of want){
    const was = old.get(k.id) || new Set();
    for(const u of k.uids || []){
      if(was.has(u) || u === CU.uid) continue;
      jobs.push(FS.addDoc(FS.collection(db, 'mtgNotifs'), { toUid: u, kind: 'task', meetingId: id, org: m.org, ...(m.org === 'lead' ? { book: 'lead' } : {}), mtitle, date: m.date, tgt: 'k:' + key,
        where: `${ti + 1}. ${t.title || ''}`, text: C.textOf(k.h).trim().slice(0, 140) + (k.due ? ` · ${C.fmtMD(k.due)}까지` : ''),
        fromUid: CU.uid, fromName: CU.name || '', at: FS.serverTimestamp(), read: false }).catch(()=>{}));
    }
  }
  // 🔔 v135 새로 맡은 임무를 휴대폰으로도 (서버가 방금 남긴 알림을 확인하고 보냄 · 기다리지 않음)
  if(jobs.length && typeof ctx.dailyEv === 'function') Promise.all(jobs).then(() => ctx.dailyEv('mtg', { meetingId: id })).catch(()=>{});
}
/* 수정 이력에서 «이 모습으로 되돌리기» */
export async function saveRevert(ctx, m, ver){
  X = X || ctx;
  const v = ver.data || {};
  const data = { org: m.org, type: v.type || '', title: v.title || '', date: v.date || m.date, time: v.time || '', place: v.place || '',
    writerUid: v.writerUid || '', writerName: v.writerName || '', att: v.att || {}, attNames: v.attNames || {}, guests: v.guests || '',
    topics: (v.topics || []).map(t => { const { ed, ...rest } = t; return rest; }), imported: !!v.imported };
  return persist(ctx, m.id, data, { baseRev: m.rev || 0, sum: `${ver.rev}번째 모습으로 되돌림` });
}
