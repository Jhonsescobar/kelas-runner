/* Dunia permainan yang dipakai bersama: HP siswa (arena penuh) dan layar kelas (lintasan kecil).
   Rintangan dibangkitkan dari seed room, jadi semua siswa menghadapi urutan yang sama. */
(function () {
  'use strict';
  const KR = window.KR = window.KR || {};
  const W = 480, H = 270, GROUND = 222, PX = 96;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  Object.assign(KR, { W, H, GROUND, PX });

  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  KR.mulberry32 = mulberry32;
  const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

  /* ---------- tema ---------- */
  KR.TEMA = {
    space: {
      nama: 'Space', jatuh: 'Kamu jatuh ke lubang', meteor: 'Kamu tersambar meteor', lubang: '#04030d', lava: false,
      gerbang: { tiang: '#3b3a8a', atas: '#5a58c8', medan: '#4de2ff' }, bata: null,
      stages: [
        { n: 'Orbit Bumi', sky: ['#07061a', '#0d0a2c', '#150f40', '#1e1456', '#2b1a70'], mt: ['#1b1450', '#2a1c75'], g: ['#6a66d8', '#2d2a7c', '#201d5e'], pal: ['#2b1e63', '#4a3aa3', '#7a66e0', '#b9a8ff'], ring: '#4de2ff' },
        { n: 'Sabuk Asteroid', sky: ['#04121a', '#071d2a', '#0a2a3d', '#0d3a52', '#134b68'], mt: ['#0b2a3a', '#123f55'], g: ['#4fb3c9', '#1f6075', '#154657'], pal: ['#7a3d1e', '#b5652f', '#e08f4c', '#ffd09a'], ring: '#ffd23f' },
        { n: 'Nebula Magenta', sky: ['#14051a', '#22082c', '#340c40', '#4a1058', '#651774'], mt: ['#3a0f4d', '#561672'], g: ['#d062c4', '#6c2a80', '#4c1c5e'], pal: ['#1f5a40', '#2f8f63', '#5fd49a', '#c1ffe0'], ring: '#ff4fa3' },
      ],
      batu: [['#2c2640', '#4a3f66', '#6e6094', '#a29ac9'], ['#2a2438', '#463b60', '#685a8c', '#9c93c2']],
    },
    lava: {
      nama: 'Lava', jatuh: 'Kamu jatuh ke lava', meteor: 'Kamu terkena bola api', lubang: '#ff5a1f', lava: true,
      gerbang: { tiang: '#6b2a1a', atas: '#b4491f', medan: '#ffb347' },
      stages: [
        { n: 'Kawah Merah', sky: ['#1a0505', '#2b0a08', '#40100a', '#5c1a0c', '#7d2810'], mt: ['#2e0c0a', '#4a1510'], g: ['#7a4a38', '#3a1d16', '#c2410c'], pal: ['#5a1a10', '#a1361a', '#e8662c', '#ffc27a'], ring: null },
        { n: 'Gua Magma', sky: ['#12060a', '#240a12', '#3a0f1a', '#531526', '#701d33'], mt: ['#2a0a14', '#43111f'], g: ['#865646', '#40222a', '#d9480f'], pal: ['#4a1020', '#8a2a3a', '#d9534a', '#ffb09a'], ring: null },
        { n: 'Gunung Api', sky: ['#0e0a05', '#1e1408', '#33200b', '#4f330f', '#6e4814'], mt: ['#26180a', '#3d2810'], g: ['#9a7430', '#4a3516', '#e8590c'], pal: ['#5a3a10', '#a8721f', '#f0a936', '#ffe6a0'], ring: null },
      ],
      batu: [['#3a0c06', '#7a1c0e', '#d94a1c', '#ffb347'], ['#2e0a06', '#681808', '#c23f16', '#ff9f43']],
    },
  };

  /* ---------- gambar piksel ---------- */
  const box = (c, x, y, w, h, col) => KR.box(c, x, y, w, h, col);
  function bmp(c, rows, x, y, s, col) { c.fillStyle = col; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') c.fillRect(x + i * s, y + j * s, s, s); }); }

  function bola(r, pal, opt) {
    opt = opt || {};
    const d = r * 2, k = document.createElement('canvas'); k.width = k.height = d;
    const c = k.getContext('2d'), L = [-.5, -.6, .62], noise = opt.noise || 0, seed = opt.seed || 1, bands = !!opt.bands;
    for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      const nx = (x + .5 - r) / r, ny = (y + .5 - r) / r, rr = nx * nx + ny * ny; let lim = 1;
      if (noise) { const a = Math.floor((Math.atan2(ny, nx) + Math.PI) / (Math.PI * 2) * 12); lim = 1 - noise * hash(a, seed, 7); }
      if (rr > lim * lim) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, rr))), dot = nx * L[0] + ny * L[1] + nz * L[2];
      let i = clamp(Math.floor((dot + .2) * pal.length * .85), 0, pal.length - 1);
      if (bands && Math.sin(ny * 9 + seed) > .35) i = Math.max(0, i - 1);
      if (noise && hash(x, y, seed) > .93) i = 0;
      c.fillStyle = pal[i]; c.fillRect(x, y, 1, 1);
    }
    return k;
  }
  function planet(st) {
    const r = 34, k = document.createElement('canvas'); k.width = r * 2 + 60; k.height = r * 2 + 40;
    const c = k.getContext('2d'), cx = k.width / 2, cy = k.height / 2, tilt = -.32;
    const cincin = depan => {
      if (!st.ring) return;
      c.fillStyle = st.ring;
      for (let a = 0; a < Math.PI * 2; a += .015) {
        const s = Math.sin(a); if ((s > 0) !== depan) continue;
        for (const rad of [1.0, 1.12]) {
          const ex = Math.cos(a) * (r + 26) * rad, ey = s * (r * .32) * rad;
          c.fillRect(Math.round(cx + ex * Math.cos(tilt) - ey * Math.sin(tilt)), Math.round(cy + ex * Math.sin(tilt) + ey * Math.cos(tilt)), 2, 2);
        }
      }
    };
    cincin(false); c.drawImage(bola(r, st.pal, { bands: !st.ring ? false : true, seed: 3, noise: st.ring ? 0 : .08 }), cx - r, cy - r); cincin(true);
    return k;
  }
  const cache = {};
  function sprites(tema) {
    if (cache[tema]) return cache[tema];
    const T = KR.TEMA[tema];
    return (cache[tema] = { planet: T.stages.map(planet), batu: [bola(10, T.batu[0], { noise: .22, seed: 5 }), bola(10, T.batu[1], { noise: .26, seed: 11 })] });
  }
  const rnd0 = mulberry32(12345);
  const BINTANG = Array.from({ length: 110 }, () => ({ x: rnd0() * W, y: rnd0() * (GROUND - 30), s: rnd0() < .2 ? 2 : 1, l: Math.floor(rnd0() * 3) }));
  const BUKIT = [0, 1].map(L => Array.from({ length: 160 }, (_, i) => { const t = i / 160 * Math.PI * 2; const h = L ? 30 + 10 * Math.sin(t * 3 + 2) + 6 * Math.sin(t * 8 + .5) : 62 + 18 * Math.sin(t * 2 + .4) + 10 * Math.sin(t * 5 + 1.3); return Math.round(h / 3) * 3; }));

  /* ---------- lintasan bersama ---------- */
  class Lintasan {
    constructor(seed) { this.rnd = mulberry32(seed); this.items = []; this.coins = []; this.cursor = 380; this.sinceGate = 0; }
    sampai(x) { while (this.cursor < x) this.buat(); }
    buat() {
      const rnd = this.rnd;
      if (this.sinceGate >= 3) { this.cursor += 170 * 1.1 + 50; this.items.push({ t: 'gate', x: this.cursor, w: 40, done: false, openT: 0 }); this.sinceGate = 0; return; }
      this.cursor += 190 * (.95 + rnd() * .7) + 70;
      const p = rnd(), cx = this.cursor; let it;
      if (p < .38) { it = { t: 'pit', x: cx, w: 44 }; for (const dx of [-14, 0, 14]) this.coins.push({ x: cx + 22 + dx, y: GROUND - (dx ? 30 : 40), got: false }); }
      else if (p < .72) { it = { t: 'robot', x: cx, w: 16 }; for (const dx of [-14, 0, 14]) this.coins.push({ x: cx + 8 + dx, y: GROUND - (dx ? 30 : 40), got: false }); }
      else { it = { t: 'ast', x: cx, w: 20, ph: rnd() * 6 }; for (const dx of [-8, 10]) this.coins.push({ x: cx + 10 + dx, y: GROUND - 9, got: false }); }
      this.items.push(it); this.sinceGate++;
    }
    /* indeks item pertama yang masih mungkin terlihat pada jarak tempuh d */
    awal(d) { const a = this.items; let lo = 0, hi = a.length; const batas = d - PX - 90; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].x + a[m].w < batas) lo = m + 1; else hi = m; } return lo; }
    awalKoin(d) { const a = this.coins; let lo = 0, hi = a.length; const batas = d - PX - 30; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].x < batas) lo = m + 1; else hi = m; } return lo; }
  }
  KR.Lintasan = Lintasan;

  /* ---------- latar ---------- */
  function langit(c, st) { const ys = [0, 40, 80, 120, 160, GROUND]; for (let i = 0; i < 5; i++) { c.fillStyle = st.sky[i]; c.fillRect(-8, ys[i] - (i ? 0 : 8), W + 16, ys[i + 1] - ys[i] + (i ? 0 : 8)); } }
  function bintang(c, dist, t, kurang) {
    for (const s of BINTANG) {
      const x = (((s.x - dist * .02 * (s.l + 1)) % W) + W) % W;
      const tw = !kurang && (((t * 2 + s.x) | 0) % 7 === 0);
      c.fillStyle = tw ? 'rgba(255,255,255,.35)' : (s.l === 2 ? '#fff' : s.l === 1 ? '#cfd3ff' : '#8f94d9');
      c.fillRect(Math.round(x), Math.round(s.y), s.s, s.s);
    }
  }
  function bukit(c, dist, st) {
    for (let L = 0; L < 2; L++) {
      const k = L ? .32 : .14, off = dist * k, shift = Math.floor(off / 3), sub = off % 3; c.fillStyle = st.mt[L];
      for (let j = 0; j <= 161; j++) { const h = BUKIT[L][(j + shift) % 160]; c.fillRect(Math.round(j * 3 - sub), GROUND - h, 3, h); }
    }
  }
  function tanah(c, T, lint, dist, st, extraLubang, t) {
    const g = st.g;
    c.fillStyle = g[0]; c.fillRect(-8, GROUND, W + 16, 6); c.fillStyle = KR.shade(g[0], .25); c.fillRect(-8, GROUND, W + 16, 1);
    c.fillStyle = g[1]; c.fillRect(-8, GROUND + 6, W + 16, H - GROUND);
    c.fillStyle = g[2]; const o = Math.floor(dist) % 24;
    for (let row = 0; row < 4; row++) {
      const y = GROUND + 8 + row * 10; c.fillRect(-8, y + 9, W + 16, 1);
      for (let x = -24 + ((row % 2) ? 12 : 0) - o; x < W + 24; x += 24) c.fillRect(x, y, 1, 10);
    }
    const lub = [];
    for (let i = lint.awal(dist); i < lint.items.length; i++) { const it = lint.items[i], sx = it.x - dist + PX; if (sx > W + 20) break; if (it.t === 'pit') lub.push([sx, it.w]); }
    if (extraLubang) lub.push(extraLubang);
    for (const [x, w] of lub) {
      if (x > W || x + w < 0) continue;
      c.fillStyle = T.lubang; c.fillRect(Math.round(x), GROUND, Math.round(w), H - GROUND + 8);
      if (T.lava) { c.fillStyle = '#ffb02e'; c.fillRect(Math.round(x), GROUND + 6, Math.round(w), 4 + (((t * 5) | 0) % 2)); c.fillStyle = '#ffe08a'; for (let k = 6; k < w - 4; k += 12) c.fillRect(Math.round(x + k), GROUND + 7 + (((t * 4 + k) | 0) % 3), 3, 2); }
      c.fillStyle = KR.shade(g[1], .1); c.fillRect(Math.round(x), GROUND + 6, 3, H); c.fillStyle = KR.shade(g[1], -.45); c.fillRect(Math.round(x + w - 3), GROUND + 6, 3, H);
      c.fillStyle = g[0]; c.fillRect(Math.round(x), GROUND, 3, 6); c.fillStyle = KR.shade(g[0], -.4); c.fillRect(Math.round(x + w - 3), GROUND, 3, 6);
    }
  }
  /* o: { lane, t, kurang, extraLubang } */
  KR.latar = function (c, tema, stageIdx, lint, dist, o) {
    o = o || {};
    const T = KR.TEMA[tema], st = T.stages[stageIdx % T.stages.length], sp = sprites(tema);
    langit(c, st); bintang(c, dist, o.t || 0, o.kurang);
    if (!o.lane) { const x = ((((520 - dist * .05) % 760) + 760) % 760) - 170; c.drawImage(sp.planet[stageIdx % sp.planet.length], Math.round(x), 26); }
    bukit(c, dist, st); tanah(c, T, lint, dist, st, o.extraLubang, o.t || 0);
  };

  /* ---------- benda ---------- */
  function musuh(c, T, x, ph) {
    const y = GROUND;
    if (T.lava) { const b = Math.round(Math.abs(Math.sin(ph * 5)) * 2); box(c, x, y - 11 - b, 16, 11 + b, '#e0451f'); box(c, x + 2, y - 14 - b, 12, 4, '#ff7a2a'); c.fillStyle = '#ffd27a'; c.fillRect(x + 3, y - 12 - b, 3, 2); c.fillStyle = '#fff'; c.fillRect(x + 4, y - 8 - b, 3, 3); c.fillRect(x + 10, y - 8 - b, 3, 3); c.fillStyle = '#2a0a06'; c.fillRect(x + 5, y - 7 - b, 1, 2); c.fillRect(x + 11, y - 7 - b, 1, 2); return; }
    const l = Math.sin(ph * 8) > 0;
    box(c, x + 2, y - 4 - (l ? 0 : 1), 4, 4, '#6e79bd'); box(c, x + 9, y - 4 - (l ? 1 : 0), 4, 4, '#6e79bd');
    box(c, x, y - 14, 15, 10, '#9aa6e6'); box(c, x + 2, y - 18, 11, 5, '#b7c0f5');
    c.fillStyle = '#ff4fa3'; c.fillRect(x + 8, y - 17, 4, 2); c.fillRect(x + 7, y - 21, 1, 3); c.fillRect(x + 6, y - 22, 3, 1);
  }
  KR.koin = function (c, x, y, t) {
    const w = Math.max(1, Math.round(Math.abs(Math.cos(t * 4 + x * .05)) * 7));
    c.fillStyle = '#b8860b'; c.fillRect(Math.round(x - w / 2), y - 4, w, 8);
    c.fillStyle = '#ffd23f'; c.fillRect(Math.round(x - w / 2), y - 4, Math.max(1, w - 1), 7);
    if (w > 3) { c.fillStyle = '#fff6b8'; c.fillRect(Math.round(x - w / 2) + 1, y - 3, 1, 3); }
  };
  const QM = ['01110', '10001', '00001', '00110', '00100', '00000', '00100'];
  function gerbang(c, T, it, sx) {
    const gy = GROUND, open = it.done ? clamp(it.openT / .6, 0, 1) : 0, G = T.gerbang;
    box(c, sx, gy - 46, 9, 46, G.tiang); box(c, sx + 31, gy - 46, 9, 46, G.tiang); box(c, sx - 2, gy - 53, 44, 8, G.atas);
    c.fillStyle = open > 0 ? '#7bff6b' : '#ffd23f'; c.fillRect(sx + 3, gy - 38, 3, 3); c.fillRect(sx + 34, gy - 38, 3, 3); c.fillRect(sx + 3, gy - 28, 3, 3); c.fillRect(sx + 34, gy - 28, 3, 3);
    if (open < 1) {
      c.globalAlpha = .5 * (1 - open); c.fillStyle = G.medan; c.fillRect(sx + 9, gy - 45, 22, 45);
      c.globalAlpha = .35 * (1 - open); c.fillStyle = '#fff'; for (let y = gy - 45; y < gy; y += 4) c.fillRect(sx + 9, y, 22, 1);
      c.globalAlpha = 1 - open; bmp(c, QM, sx + 14, gy - 36, 3, '#fff'); c.globalAlpha = 1;
    }
  }
  /* it: item lintasan, x: posisi layar */
  KR.benda = function (c, tema, it, x, phase, kurang) {
    const T = KR.TEMA[tema];
    if (it.t === 'robot') musuh(c, T, Math.round(x), phase);
    else if (it.t === 'ast') { const by = GROUND - 38 + (kurang ? 0 : Math.round(Math.sin(phase * 2 + it.ph) * 2)); c.drawImage(sprites(tema).batu[Math.floor(it.ph) % 2], Math.round(x), by); }
    else if (it.t === 'gate') gerbang(c, T, it, Math.round(x));
  };
  KR.batuSprite = (tema, i) => sprites(tema).batu[i];
})();
