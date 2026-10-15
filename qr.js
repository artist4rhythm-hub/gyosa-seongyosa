/* ═══════════════════════════════════════════════
   qr.js — QR 코드 그리기 (교사 선교사 v122 · 바깥 라이브러리 없이)
   · 가정통신문 · 연결 코드표에 «찍으면 코드가 채워지는 주소»를 QR로 넣는다
   · 바이트(UTF-8) · 오류 정정 M · 버전 1~10 (주소 200자 남짓까지)
   · 쓰는 법: QR.svg('https://…', { px: 120 }) → <svg> 글자
   QR 만드는 순서는 국제 표준(ISO/IEC 18004)을 그대로 따랐다.
   ═══════════════════════════════════════════════ */
(function(){
  const RAW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];        // 버전별 전체 코드워드
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];                     // M 블록 수
  const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];              // M 블록당 정정 코드워드
  const dataCap = v => RAW[v] - BLOCKS[v] * ECC[v];

  function utf8(s){ return Array.from(new TextEncoder().encode(String(s))); }
  function gmul(x, y){ let z = 0; for(let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(deg){
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for(let i = 0; i < deg; i++){
      for(let j = 0; j < r.length; j++){ r[j] = gmul(r[j], root); if(j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = gmul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div){
    const r = new Array(div.length).fill(0);
    for(const b of data){ const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); }
    return r;
  }
  function encode(text){
    const bytes = utf8(text);
    let ver = 1;
    for(; ver <= 10; ver++){ const cc = ver < 10 ? 8 : 16; if(4 + cc + bytes.length * 8 <= dataCap(ver) * 8) break; }
    if(ver > 10) throw new Error('QR: 글자가 너무 깁니다');
    const bits = [];
    const put = (val, n) => { for(let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const cap = dataCap(ver) * 8;
    put(0, Math.min(4, cap - bits.length));
    while(bits.length % 8) bits.push(0);
    const data = [];
    for(let i = 0; i < bits.length; i += 8){ let b = 0; for(let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    for(let p = 0xEC; data.length < dataCap(ver); p ^= 0xEC ^ 0x11) data.push(p);
    // 블록 나누기 + 정정 코드 + 엮기
    const nb = BLOCKS[ver], ecl = ECC[ver], raw = RAW[ver];
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const div = rsDivisor(ecl); const blocks = [];
    for(let i = 0, k = 0; i < nb; i++){
      const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length;
      const ec = rsRemainder(dat, div);
      if(i < nShort) dat.push(0);
      blocks.push(dat.concat(ec));
    }
    const all = [];
    for(let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if(i !== shortLen - ecl || j >= nShort) all.push(b[i]); });
    return { ver, codewords: all };
  }
  function build(text){
    const { ver, codewords } = encode(text);
    const n = 17 + ver * 4;
    const M = Array.from({ length: n }, () => new Array(n).fill(false));
    const F = Array.from({ length: n }, () => new Array(n).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for(let i = 0; i < n; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for(let dy = -4; dy <= 4; dy++) for(let dx = -4; dx <= 4; dx++){
      const x = cx + dx, y = cy + dy; if(x < 0 || y < 0 || x >= n || y >= n) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    if(ver > 1){
      const na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
      const pos = [6]; for(let p = n - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      pos.forEach((y, i) => pos.forEach((x, j) => {
        if((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
        for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
    }
    const drawFormat = mask => {
      const dataF = (0 << 3) | mask;                     // 오류 정정 M = 00
      let rem = dataF; for(let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((dataF << 10) | rem) ^ 0x5412; const bit = i => ((b >>> i) & 1) === 1;
      for(let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for(let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for(let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
      for(let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
      set(8, n - 8, true);
    };
    drawFormat(0);
    if(ver >= 7){
      let rem = ver; for(let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const b = (ver << 12) | rem;
      for(let i = 0; i < 18; i++){ const d = ((b >>> i) & 1) === 1, a = n - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); }
    }
    // 데이터 놓기 (오른쪽 아래에서 지그재그)
    let k = 0;
    for(let right = n - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(let v = 0; v < n; v++) for(let j = 0; j < 2; j++){
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - v : v;
        if(!F[y][x] && k < codewords.length * 8){ M[y][x] = ((codewords[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
      }
    }
    const maskFn = [ (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0 ];
    const applyMask = m => { for(let y = 0; y < n; y++) for(let x = 0; x < n; x++) if(!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0;
      for(let t = 0; t < 2; t++) for(let a = 0; a < n; a++){
        let run = 0, prev = null; const line = [];
        for(let b = 0; b < n; b++){ const v = t ? M[b][a] : M[a][b]; line.push(v ? 1 : 0);
          if(v === prev){ run++; if(run === 5) p += 3; else if(run > 5) p++; } else { prev = v; run = 1; } }
        const s = line.join('');
        for(const pat of ['10111010000', '00001011101']){ let i = s.indexOf(pat); while(i >= 0){ p += 40; i = s.indexOf(pat, i + 1); } }
      }
      for(let y = 0; y < n - 1; y++) for(let x = 0; x < n - 1; x++){ const c = M[y][x]; if(c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      let dark = 0; M.forEach(r => r.forEach(v => { if(v) dark++; }));
      p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for(let m = 0; m < 8; m++){ applyMask(m); drawFormat(m); const p = penalty(); if(p < bestP){ bestP = p; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { n, M, ver, mask: best };
  }
  function svg(text, opt){
    opt = opt || {};
    const q = build(text), mg = opt.margin == null ? 2 : opt.margin, W = q.n + mg * 2;
    let d = '';
    for(let y = 0; y < q.n; y++) for(let x = 0; x < q.n; x++) if(q.M[y][x]) d += `M${x + mg},${y + mg}h1v1h-1z`;
    const px = opt.px || 120;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${W}" height="${W}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  window.QR = { svg, build };
})();
