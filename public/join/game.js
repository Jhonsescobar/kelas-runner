/* Game di HP siswa. Fisika berjalan di HP agar mulus; penilaian soal, nyawa, dan skor kuis diputuskan server. */
(function () {
  'use strict';
  const KR = window.KR, { W, H, GROUND, PX } = KR;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portraitMQ = matchMedia('(orientation: portrait) and (max-width: 820px)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  let net = null, offset = 0, S = null, kamuId = null, me = null, mode = 'none';
  let tema = 'space', lint = null, lintSeed = -1, R = null, parts = [], idle = 0, tNow = 0, hintTimer = 0;
  let live = { rank: 0, dari: 0, g: [], top: [] }, ghosts = new Map(), best = 0, berakhirAt = 0, menungguLari = 0, posT = 0, hasilTerakhir = null;
  const byId = new Map();

  /* ---------- audio 8-bit ---------- */
  let ac = null, muted = false;
  function audio() { try { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === 'suspended') ac.resume(); } catch (e) { /* tanpa suara */ } }
  function tone(f, d, type, v, f2, delay) {
    if (muted || !ac) return;
    try { const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02); } catch (e) { /* abaikan */ }
  }
  const SFX = {
    jump: () => tone(330, .14, 'square', .04, 660), coin: () => { tone(988, .07, 'square', .04); tone(1319, .12, 'square', .04, 0, .07); },
    ok: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .12, 'square', .05, 0, i * .08)), bad: () => tone(220, .28, 'sawtooth', .05, 110),
    hit: () => tone(150, .18, 'square', .06, 60), die: () => tone(400, .7, 'sawtooth', .05, 40), gate: () => tone(440, .3, 'triangle', .05, 880), tick: () => tone(880, .05, 'square', .03),
  };

  /* ---------- tampilan ---------- */
  const LAYAR = ['scrSiap', 'scrHasil', 'scrAkhir', 'scrNonton'];
  function tampilLayar(nama) { LAYAR.forEach(id => { $(id).hidden = id !== nama; }); }
  function sembunyiPermainan() { ['hud', 'zones', 'quiz', 'fb', 'banner'].forEach(id => { $(id).hidden = true; }); }
  const sisaDetik = () => Math.max(0, (berakhirAt - (Date.now() + offset)) / 1000);
  const mmss = d => Math.floor(d / 60) + ':' + String(Math.floor(d % 60)).padStart(2, '0');

  function nyawaTerpakai() { return R ? R.strikes : 0; }
  const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  function heartSVG(on) {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 7 6'); s.setAttribute('shape-rendering', 'crispEdges'); s.setAttribute('aria-hidden', 'true');
    HEART.forEach((row, y) => { for (let x = 0; x < 7; x++) if (row[x] === '1') { const r = document.createElementNS(ns, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1); r.setAttribute('height', 1); r.setAttribute('fill', on ? '#ff4f7b' : '#3d3a86'); s.appendChild(r); } });
    return s;
  }
  let hudKey = '';
  function hud() {
    const r = R; if (!r) return;
    const total = r.kuis + r.lewat * 5 + r.koin * 10, sisa = sisaDetik();
    const rank = live.rank ? '#' + live.rank + '/' + live.dari : '-';
    const key = [total, Math.floor(sisa), r.strikes, r.koin, r.stage, rank].join('|');
    if (key === hudKey) return; hudKey = key;
    $('hudScore').textContent = String(total); $('hudTime').textContent = mmss(sisa); $('hudTime').classList.toggle('low', sisa < 30);
    $('hudCoin').textContent = String(r.koin); $('hudStage').textContent = 'Stage ' + r.stage; $('hudRank').textContent = rank;
    const h = $('hudHearts'); h.textContent = ''; h.append(heartSVG(r.strikes < 1), heartSVG(r.strikes < 2));
  }

  /* ---------- run ---------- */
  function newRun() {
    return { state: 'run', dist: 0, stage: 1, y: GROUND, vy: 0, duck: false, jumpHeld: false, duckHeld: false, jumpBuf: 0, onGround: true, rescue: false, invul: 0, slowT: 0,
      strikes: 0, cracked: false, kuis: 0, koin: 0, lewat: 0, benar: 0, salah: 0, gateCount: 0, salahList: [],
      phase: 0, runPh: 0, exprT: 0, expr: null, shake: 0, bannerT: 0, gate: null, gateT: 0, q: null, qPhase: '', qt: 0, qTotal: 0, readLeft: 0, askT: 0, fbT: 0, dyT: 0, dy: null, rot: 0 };
  }
  function startRun() {
    menungguLari = 0; R = newRun(); parts = []; hudKey = '';
    lint = new KR.Lintasan(S.seed); lintSeed = S.seed;
    tampilLayar(''); $('hud').hidden = false; $('zones').hidden = false; $('zones').classList.add('hint');
    clearTimeout(hintTimer); hintTimer = setTimeout(() => $('zones').classList.remove('hint'), 5500);
    mode = 'run'; stageBanner(); audio(); posT = 0;
  }
  function stageBanner() {
    const T = KR.TEMA[tema], st = T.stages[(R.stage - 1) % T.stages.length], b = $('banner');
    b.textContent = 'STAGE ' + R.stage; const s = document.createElement('small'); s.textContent = st.n; b.appendChild(s); b.hidden = false; R.bannerT = 1.8;
  }
  function sendPos(paksa) {
    if (!net || !R) return;
    const now = performance.now(); if (!paksa && now - posT < 160) return; posT = now;
    const r = R, tanya = r.state === 'gate' || r.state === 'quiz' || r.state === 'feedback';
    net.send({ t: 'pos', d: Math.round(r.dist), h: Math.max(0, Math.round(GROUND - r.y)), st: tanya ? 2 : r.slowT > 0 ? 1 : 0, dk: r.duck ? 1 : 0, lw: r.lewat, kn: r.koin });
  }

  /* ---------- input ---------- */
  function setJump(on) { if (!R) return; R.jumpHeld = on; if (on && R.state === 'run') R.jumpBuf = .12; }
  function setDuck(on) { if (R) R.duckHeld = on; }
  function bindZone(el, fn) {
    const up = e => { fn(false); try { el.releasePointerCapture(e.pointerId); } catch (_) { /* abaikan */ } };
    el.addEventListener('pointerdown', e => { e.preventDefault(); audio(); fn(true); try { el.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ } });
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', () => fn(false));
  }
  bindZone($('zJump'), setJump); bindZone($('zDuck'), setDuck);
  addEventListener('keydown', e => {
    if (!R || mode !== 'run') return;
    if (e.target && e.target.id === 'qInput') return;
    if (R.state === 'quiz' && R.qPhase === 'answer' && R.q.tipe === 'pg') {
      const k = e.key.toLowerCase(), i = 'abcd'.indexOf(k), j = '1234'.indexOf(k), idx = i >= 0 ? i : j;
      if (idx >= 0 && idx < R.q.opsi.length) { e.preventDefault(); answer(idx); } return;
    }
    if (R.state === 'feedback' && (e.key === 'Enter' || e.key === ' ') && document.activeElement !== $('bLanjut')) { e.preventDefault(); afterFeedback(); return; }
    if (R.state === 'run') {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); audio(); if (!e.repeat) setJump(true); }
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); setDuck(true); }
    }
  });
  addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') setJump(false);
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') setDuck(false);
  });
  addEventListener('blur', () => { setJump(false); setDuck(false); });
  $('bMute').addEventListener('click', () => { muted = !muted; $('bMute').setAttribute('aria-pressed', String(muted)); $('bMute').setAttribute('aria-label', muted ? 'Nyalakan suara' : 'Matikan suara'); });
  if (document.fullscreenEnabled) {
    $('bFull').addEventListener('click', () => { try { const p = document.fullscreenElement ? document.exitFullscreen() : $('vGame').requestFullscreen(); Promise.resolve(p).then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* abaikan */ } }).catch(() => {}); } catch (e) { /* abaikan */ } });
  } else $('bFull').hidden = true;

  /* ---------- partikel ---------- */
  function burst(x, y, n, cols, sp) { n = RM ? Math.ceil(n / 3) : n; for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-sp, sp), vy: -rnd(10, sp), life: rnd(.35, .8), c: cols[i % cols.length], s: 2 }); }
  const dust = n => burst(PX, GROUND, n, ['#8f8bd6', '#c5c2f5'], 34);
  function updateParts(dt) { for (const p of parts) { p.life -= dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } parts = parts.filter(p => p.life > 0); }

  /* ---------- logika utama ---------- */
  const overlap = (al, ar, at, ab, bl, br, bt, bb) => al < br && ar > bl && at < bb && ab > bt;
  function update(dt) {
    const r = R; r.phase += dt;
    if (r.bannerT > 0) { r.bannerT -= dt; if (r.bannerT <= 0) $('banner').hidden = true; }
    if (r.exprT > 0) r.exprT -= dt;
    const waktuHabis = sisaDetik() <= 0;
    switch (r.state) {
      case 'run': if (!waktuHabis) updateRun(dt); break;
      case 'gate': r.gateT -= dt; if (r.gateT <= 0) openQuiz(); break;
      case 'quiz': updateQuiz(dt); break;
      case 'feedback': r.fbT -= dt; $('fbBar').style.transform = 'scaleX(' + clamp(r.fbT / 6, 0, 1) + ')'; if (r.fbT <= 0) afterFeedback(); break;
      case 'dying': updateDying(dt); break;
    }
    if (!R) return;
    for (let i = lint.awal(r.dist); i < lint.items.length; i++) { const it = lint.items[i]; if (it.x - r.dist + PX > W + 60) break; if (it.t === 'gate' && it.done) it.openT += dt; }
    updateParts(dt); hud(); sendPos(false);
  }
  function updateRun(dt) {
    const r = R;
    if (r.slowT > 0) r.slowT -= dt; if (r.invul > 0) r.invul -= dt;
    const base = Math.min(150 + (r.stage - 1) * 20, 250), sp = base * (r.slowT > 0 ? .55 : 1);
    r.dist += sp * dt; r.runPh += sp * dt / 56; lint.sampai(r.dist + 640);
    if (r.jumpBuf > 0) r.jumpBuf -= dt;
    if (r.jumpBuf > 0 && r.onGround) { r.vy = -400; r.onGround = false; r.jumpBuf = 0; SFX.jump(); dust(5); }
    if (!r.jumpHeld && r.vy < -170) r.vy = -170;
    r.duck = r.duckHeld && r.onGround;
    r.vy += (r.duckHeld && !r.onGround ? 3400 : 1500) * dt; r.y += r.vy * dt;
    const wx = r.dist, items = lint.items, i0 = lint.awal(r.dist);
    let inPit = false;
    for (let i = i0; i < items.length && items[i].x < wx + 4; i++) { const it = items[i]; if (it.t === 'pit' && wx > it.x + 8 && wx < it.x + it.w - 8) { inPit = true; break; } }
    const solid = r.rescue || !inPit;
    if (solid && r.vy >= 0 && r.y >= GROUND) { if (!r.onGround && r.vy > 140) dust(4); r.y = GROUND; r.vy = 0; r.onGround = true; r.rescue = false; } else r.onGround = false;
    if (!r.rescue && r.y > GROUND + 24) fallInPit();
    const ph = r.duck ? 14 : 24, pl = PX - 4, pr = PX + 4, pt = r.y - ph + 2, pb = r.y;
    for (let i = i0; i < items.length; i++) {
      const it = items[i], sx = it.x - r.dist + PX; if (sx > W + 60) break;
      if (it.t === 'gate') { if (!it.done && sx <= PX + 34) { startGate(it); return; } continue; }
      if (!it.counted && it.x + it.w < r.dist - 4) { it.counted = true; if (!it.hit) r.lewat++; }
      if (sx < -60 || it.hit || r.invul > 0) continue;
      if (it.t === 'robot' && overlap(pl, pr, pt, pb, sx + 2, sx + it.w - 2, GROUND - 17, GROUND)) stumble(it);
      else if (it.t === 'ast' && overlap(pl, pr, pt, pb, sx + 2, sx + it.w - 2, GROUND - 38, GROUND - 18)) stumble(it);
    }
    const coins = lint.coins;
    for (let i = lint.awalKoin(r.dist); i < coins.length; i++) {
      const c = coins[i], sx = c.x - r.dist + PX; if (sx > W + 20) break; if (c.got) continue;
      if (overlap(pl, pr, pt, pb, sx - 4, sx + 4, c.y - 4, c.y + 4)) { c.got = true; r.koin++; SFX.coin(); burst(sx, c.y, 6, ['#ffd23f', '#fff'], 50); }
    }
  }
  function stumble(it) { const r = R; it.hit = true; r.invul = 1.4; r.slowT = Math.max(r.slowT, 2.5); r.exprT = .9; r.expr = 'kaget'; r.shake = .25; burst(PX, r.y - 12, 10, ['#fff', '#ffd23f'], 70); SFX.hit(); }
  function fallInPit() {
    const r = R, wx = r.dist; let pit = null;
    for (let i = lint.awal(r.dist); i < lint.items.length; i++) { const it = lint.items[i]; if (it.x > wx) break; if (it.t === 'pit' && wx < it.x + it.w) { pit = it; break; } }
    if (pit && !pit.hit && r.invul <= 0) stumble(pit); else if (pit) pit.hit = true;
    r.rescue = true; r.vy = -430; r.invul = Math.max(r.invul, 1.4);
  }
  function startGate(it) { const r = R; r.state = 'gate'; r.gate = it; r.gateT = .9; r.jumpHeld = false; r.duckHeld = false; r.duck = false; SFX.gate(); sendPos(true); }
  function nextStage() { R.stage++; stageBanner(); SFX.gate(); }

  /* ---------- kuis (soal datang dari server) ---------- */
  function openQuiz() {
    const r = R; r.state = 'quiz'; r.qPhase = 'minta'; r.q = null; r.askT = 0;
    sendPos(true); net.send({ t: 'q:minta' });
    const b = $('banner'); b.textContent = 'GERBANG KUIS'; b.hidden = false; r.bannerT = 99;
  }
  function terimaSoal(m) {
    const r = R; if (!r || r.state !== 'quiz' || r.qPhase !== 'minta') return;
    $('banner').hidden = true; r.bannerT = 0;
    r.q = m; r.qPhase = 'read'; r.qTotal = m.waktu; r.qt = m.waktu;
    r.readLeft = clamp(.9 + m.teks.length * .03 + (m.kode ? m.kode.length * .012 : 0), 1.2, 4.5);
    $('qMeta').textContent = (m.tipe === 'pg' ? 'Pilihan ganda' : 'Isian singkat') + ' · ' + m.waktu + ' detik';
    $('qSec').textContent = 'Baca dulu'; $('qText').textContent = m.teks;
    $('qKode').hidden = !m.kode; $('qKode').textContent = m.kode || ''; $('qBody').classList.toggle('dgkode', !!m.kode);
    $('qBar').style.transform = 'scaleX(1)'; $('qBarWrap').className = 'q-bar';
    const opts = $('qOpts'), form = $('qForm');
    if (m.tipe === 'pg') {
      form.hidden = true; opts.hidden = false; opts.classList.add('wait'); opts.textContent = '';
      m.opsi.forEach((t, idx) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'opt';
        const l = document.createElement('b'); l.textContent = 'ABCD'[idx]; const s = document.createElement('span'); s.textContent = t; b.append(l, s);
        b.addEventListener('click', () => answer(idx)); opts.appendChild(b);
      });
    } else { opts.hidden = true; form.hidden = false; form.classList.add('wait'); $('qInput').value = ''; }
    $('quiz').hidden = false;
  }
  function beginAnswer() {
    const r = R; r.qPhase = 'answer'; $('qOpts').classList.remove('wait'); $('qForm').classList.remove('wait'); $('qSec').textContent = String(r.qTotal);
    net.send({ t: 'q:mulai', n: r.q.n });
    if (r.q.tipe === 'isian') { try { $('qInput').focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }
  }
  function updateQuiz(dt) {
    const r = R;
    if (r.qPhase === 'minta') { r.askT += dt; if (r.askT > 1.5) { r.askT = 0; net.send({ t: 'q:minta' }); } return; }
    if (r.qPhase === 'read') { r.readLeft -= dt; if (r.readLeft <= 0) beginAnswer(); return; }
    if (r.qPhase === 'answer') {
      const prev = Math.ceil(r.qt); r.qt -= dt; const cur = Math.ceil(Math.max(0, r.qt));
      $('qBar').style.transform = 'scaleX(' + Math.max(0, r.qt / r.qTotal) + ')';
      const f = r.qt / r.qTotal; $('qBarWrap').className = 'q-bar' + (f <= .25 ? ' hot' : f <= .5 ? ' warn' : '');
      if (cur !== prev) { $('qSec').textContent = String(cur); if (cur > 0 && cur <= 3) SFX.tick(); }
      if (r.qt <= 0) answer(null, true);
      return;
    }
    if (r.qPhase === 'locked') { r.askT += dt; if (r.askT > 2) { r.askT = 0; net.send({ t: 'q:jawab', n: r.q.n, p: r.kirim }); } }
  }
  $('qForm').addEventListener('submit', e => { e.preventDefault(); answer($('qInput').value); });
  function answer(sel, habis) {
    const r = R; if (!r || r.state !== 'quiz' || r.qPhase !== 'answer') return;
    r.qPhase = 'locked'; r.askT = 0;
    r.kirim = habis ? null : (r.q.tipe === 'pg' ? sel : String(sel));
    net.send({ t: 'q:jawab', n: r.q.n, p: r.kirim });
    $('quiz').hidden = true; try { document.activeElement && document.activeElement.blur(); } catch (e) { /* abaikan */ }
  }
  function terimaHasil(m) {
    const r = R; if (!r || r.qPhase !== 'locked' || !r.q || m.n !== r.q.n) return;
    r.kuis = m.kuis; r.strikes = m.strikes;
    let note = '';
    if (m.benar) { r.benar++; r.exprT = 1.2; r.expr = 'senang'; SFX.ok(); }
    else {
      r.salah++; r.salahList.push({ teks: r.q.teks, jawab: m.jawabBenar }); SFX.bad();
      if (m.strikes === 1) { r.cracked = true; r.slowT = 3; note = 'Nyawa tinggal 1. Karaktermu retak dan larinya melambat sebentar.'; }
      else note = 'Nyawa habis. Kamu jatuh!';
    }
    const fb = $('fb'); fb.className = 'fb ' + (m.benar ? 'good' : 'bad');
    $('fbHead').textContent = m.benar ? 'Benar! +' + m.poin : (m.habis ? 'Waktu habis' : 'Belum tepat');
    $('fbAns').textContent = m.benar ? '' : 'Jawaban: ' + m.jawabBenar; $('fbAns').hidden = m.benar;
    $('fbWhy').textContent = m.bahas; $('fbWhy').hidden = !m.bahas; $('fbNote').textContent = note; $('fbNote').hidden = !note;
    fb.hidden = false; r.state = 'feedback'; r.fbT = 6; r.mati = m.mati; $('fbBar').style.transform = 'scaleX(1)';
    setTimeout(() => { try { $('bLanjut').focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }, 50);
  }
  $('bLanjut').addEventListener('click', () => afterFeedback());
  function afterFeedback() {
    const r = R; if (!r || r.state !== 'feedback') return; $('fb').hidden = true;
    if (r.mati) { startDeath(); return; }
    r.gate.done = true; r.state = 'run'; r.gateCount++; r.invul = Math.max(r.invul, .4);
    if (r.gateCount % 2 === 0) nextStage();
  }

  /* ---------- jatuh ---------- */
  function startDeath() {
    const r = R; r.state = 'dying'; r.dyT = 0; r.dy = { type: Math.random() < .5 ? 'lubang' : 'meteor', hit: false }; r.duck = false; r.vy = 0; SFX.die();
  }
  function updateDying(dt) {
    const r = R, d = r.dy; r.dyT += dt;
    if (d.type === 'lubang') { if (r.dyT > .4) { r.vy += 1300 * dt; r.y += r.vy * dt; r.rot += dt * 7; } if (r.dyT > 1.7) finishRun('jatuh'); }
    else {
      const p = clamp(r.dyT / .55, 0, 1); d.mx = PX - 80 * (1 - p); d.my = -30 + (GROUND - 26 + 30) * p;
      if (p >= 1 && !d.hit) { d.hit = true; r.shake = .4; burst(PX, GROUND - 12, 22, ['#ffd23f', '#ff7a3d', '#fff', '#8f8bd6'], 110); }
      if (r.dyT > 1.8) finishRun('meteor');
    }
  }

  /* ---------- hasil satu lari ---------- */
  function finishRun(alasan) {
    const r = R; if (!r) return;
    net.send({ t: 'lari:akhir', d: Math.round(r.dist), lw: r.lewat, kn: r.koin, h: 0, st: 2, alasan });
    const total = r.kuis + r.lewat * 5 + r.koin * 10; best = Math.max(best, total);
    hasilTerakhir = { alasan, total, kuis: r.kuis, lari: r.lewat * 5 + r.koin * 10, benar: r.benar, salah: r.salah, lewat: r.lewat, koin: r.koin, jarak: Math.round(r.dist / 16), salahList: r.salahList };
    R = null; parts = []; sembunyiPermainan(); clearTimeout(hintTimer);
    bangunHasil(); mode = 'hasil';
  }
  function bangunHasil() {
    const h = hasilTerakhir; if (!h) return;
    const T = KR.TEMA[tema];
    $('hAlasan').textContent = h.alasan === 'meteor' ? T.meteor : T.jatuh; $('hNama').textContent = me ? me.nama : '';
    $('hTotal').textContent = String(h.total); $('hBest').textContent = 'Nilai terbaik sesi ini: ' + best;
    $('hRank').textContent = live.rank ? 'Peringkat sementara: #' + live.rank + ' dari ' + live.dari : '';
    const bd = $('hBreak'); bd.textContent = '';
    [['Kuis', h.kuis + ' poin (' + h.benar + ' benar, ' + h.salah + ' salah)'], ['Lari', h.lari + ' poin (' + h.lewat + ' rintangan, ' + h.koin + ' koin)'], ['Jarak', h.jarak + ' m']].forEach(([k, v]) => {
      const d = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = k; b.textContent = v; d.append(a, b); bd.appendChild(d);
    });
    const ul = $('hSalah'); ul.textContent = '';
    if (!h.salahList.length) { const li = document.createElement('li'); li.textContent = h.benar ? 'Semua jawabanmu benar.' : 'Belum ada soal yang dijawab.'; ul.appendChild(li); }
    h.salahList.slice(0, 4).forEach(s => { const li = document.createElement('li'); li.append(document.createTextNode(s.teks + ' ')); const b = document.createElement('b'); b.textContent = 'Jawaban: ' + s.jawab; li.appendChild(b); ul.appendChild(li); });
    tampilLayar('scrHasil'); $('hSisa').textContent = 'Sisa waktu ' + mmss(sisaDetik());
  }
  $('bUlang2').addEventListener('click', () => { audio(); mintaLari(); });
  $('bLari').addEventListener('click', () => { audio(); mintaLari(); });
  function mintaLari() { menungguLari = 1; net.send({ t: 'lari:mulai' }); }

  /* ---------- layar sesi ---------- */
  function tampilSiap() {
    mode = 'siap'; sembunyiPermainan();
    $('siapNama').textContent = me ? 'Siap, ' + me.nama + '?' : 'Siap?';
    $('siapInfo').textContent = 'Sesi ' + S.durasiMenit + ' menit. Sisa waktu ' + mmss(sisaDetik()) + '.';
    tampilLayar('scrSiap');
  }
  function tampilNonton() { mode = 'nonton'; sembunyiPermainan(); tampilLayar('scrNonton'); perbaruiNonton(); }
  function perbaruiNonton() {
    if (mode !== 'nonton') return;
    const ul = $('nTop'); ul.textContent = '';
    (live.top || []).forEach((t, i) => { const p = byId.get(t[0]); const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = (i + 1) + '. ' + (p ? p.nama : '?'); const b = document.createElement('b'); b.textContent = String(t[1]); li.append(a, b); ul.appendChild(li); });
    $('nSisa').textContent = 'Sisa waktu ' + mmss(sisaDetik());
  }
  function tampilAkhir() {
    if (mode === 'akhir') return;
    mode = 'akhir'; R = null; parts = []; sembunyiPermainan(); $('quiz').hidden = true;
    const urut = S.hasil.urut.filter(u => u.ikut), i = urut.findIndex(u => u.id === kamuId);
    $('akKamu').textContent = i >= 0 ? 'Kamu peringkat #' + (i + 1) + ' dari ' + urut.length + ' dengan ' + urut[i].total + ' poin.' : (me && me.penonton ? 'Terima kasih sudah menonton.' : 'Kamu belum sempat bermain di sesi ini.');
    tampilLayar('scrAkhir');
    KR.podium($('akPodium'), S.hasil, { aku: kamuId });
  }

  /* ---------- gambar ---------- */
  function drawPlayer(r) {
    const av = me.avatar, o = { phase: r.runPh, duck: r.duck && r.onGround, air: !r.onGround, expr: r.exprT > 0 ? r.expr : null, cracked: r.cracked };
    if (r.state === 'gate' || r.state === 'quiz' || r.state === 'feedback') { o.phase = 0; o.air = !r.onGround; }
    if (r.invul > 0 && r.state === 'run' && Math.floor(tNow * 14) % 2 === 0) return;
    if (r.state === 'dying') {
      const d = r.dy;
      if (d.type === 'meteor') {
        if (d.hit) { ctx.save(); ctx.translate(PX, GROUND); ctx.scale(1.3, .28); KR.drawAvatar(ctx, av, 0, 0, { expr: 'kaget', cracked: true }); ctx.restore(); }
        else KR.drawAvatar(ctx, av, PX, r.y, { expr: 'kaget', cracked: true });
        if (!d.hit) ctx.drawImage(KR.batuSprite(tema, 1), Math.round(d.mx - 12), Math.round(d.my - 12), 24, 24);
        return;
      }
      ctx.save(); ctx.translate(PX, r.y - 12); ctx.rotate(r.rot); KR.drawAvatar(ctx, av, 0, 12, { expr: 'kaget', cracked: true, air: true }); ctx.restore(); return;
    }
    const h = clamp((GROUND - r.y) / 40, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.35)'; const sw = 12 - Math.round(h * 6); ctx.fillRect(PX - sw / 2, GROUND + 1, sw, 2);
    KR.drawAvatar(ctx, av, PX, r.y, o);
  }
  function drawGhosts(dist, dt) {
    if (!R || R.state === 'dying') return;
    let n = 0;
    for (const [id, g] of ghosts) {
      const p = byId.get(id); if (!p || !g.aktif) continue;
      const umur = Math.min(.8, (performance.now() - g.t) / 1000), est = g.d + g.v * umur;
      g.tampil += (est - g.tampil) * Math.min(1, dt * 8);
      const sx = PX + (g.tampil - dist); if (sx < -20 || sx > W + 20) continue;
      if (++n > 6) break;
      ctx.globalAlpha = .38; KR.drawAvatar(ctx, p.avatar, Math.round(sx), GROUND - g.h, { phase: (tNow * 1.6 + g.d * .01) % 1, duck: !!g.dk && g.h < 2, air: g.h > 2 }); ctx.globalAlpha = 1;
    }
  }
  function render(dt) {
    const r = R, dist = r ? r.dist : idle;
    if (!lint) return;
    if (!r) lint.sampai(dist + 640);
    const k = r ? r.stage - 1 : 0;
    let sx = 0, sy = 0; if (r && r.shake > 0) { r.shake -= 1 / 60; if (!RM) { sx = Math.round(rnd(-2, 2)); sy = Math.round(rnd(-2, 2)); } }
    ctx.save(); ctx.translate(sx, sy);
    let extra = null; if (r && r.state === 'dying' && r.dy.type === 'lubang') { const w = Math.min(34, r.dyT * 160); extra = [PX - w / 2, w]; }
    KR.latar(ctx, tema, k, lint, dist, { t: tNow, kurang: RM, extraLubang: extra });
    for (let i = lint.awal(dist); i < lint.items.length; i++) { const it = lint.items[i], x = it.x - dist + PX; if (x > W + 40) break; if (x < -60) continue; KR.benda(ctx, tema, it, x, r ? r.phase : tNow, RM); }
    if (r) {
      const coins = lint.coins;
      for (let i = lint.awalKoin(dist); i < coins.length; i++) { const c = coins[i], x = c.x - dist + PX; if (x > W + 10) break; if (c.got || x < -10) continue; KR.koin(ctx, x, c.y, tNow); }
      drawGhosts(dist, dt); drawPlayer(r);
    }
    for (const p of parts) { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    ctx.restore();
  }

  /* ---------- loop ---------- */
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts;
    if (mode === 'none' || portraitMQ.matches) return;
    tNow += dt;
    if (R) update(dt); else idle += 40 * dt;
    if (menungguLari && mode !== 'run') { menungguLari += dt; if (menungguLari > 1.5) { menungguLari = 1; net.send({ t: 'lari:mulai' }); } }
    render(dt);
    if (mode === 'hasil') $('hSisa').textContent = sisaDetik() > 0 ? 'Sisa waktu ' + mmss(sisaDetik()) : 'Waktu habis, menunggu hasil';
    if (mode === 'nonton' || mode === 'siap') { if (Math.floor(tNow) !== Math.floor(tNow - dt)) { perbaruiNonton(); if (mode === 'siap') tampilSiapInfo(); } }
  }
  function tampilSiapInfo() { $('siapInfo').textContent = 'Sesi ' + S.durasiMenit + ' menit. Sisa waktu ' + mmss(sisaDetik()) + '.'; }
  requestAnimationFrame(frame);

  /* ---------- hubungan dengan halaman join ---------- */
  function reset() { R = null; mode = 'none'; best = 0; hasilTerakhir = null; ghosts.clear(); live = { rank: 0, dari: 0, g: [], top: [] }; sembunyiPermainan(); tampilLayar(''); }

  KR.Game = {
    init(api) { net = api; },
    sinkron(sekarang) { offset = sekarang - Date.now(); },
    state(s, kamu) {
      S = s; if (kamu) kamuId = kamu; byId.clear(); s.pemain.forEach(p => byId.set(p.id, p)); me = byId.get(kamuId) || null;
      const main = s.status !== 'lobby';
      document.body.classList.toggle('bermain', main); $('vGame').hidden = !main;
      if (!main) { if (mode !== 'none') reset(); return; }
      tema = s.tema; berakhirAt = s.berakhirAt || 0;
      if (!lint || lintSeed !== s.seed) { lint = new KR.Lintasan(s.seed); lintSeed = s.seed; idle = 0; }
      if (s.status === 'selesai') { tampilAkhir(); return; }
      if (mode === 'none' || mode === 'akhir') { if (me && me.penonton) tampilNonton(); else tampilSiap(); }
    },
    pesan(m) {
      if (m.t === 'lari:ok') { berakhirAt = m.berakhirAt || berakhirAt; if (mode !== 'run') startRun(); }
      else if (m.t === 'q') terimaSoal(m);
      else if (m.t === 'q:hasil') terimaHasil(m);
      else if (m.t === 'lomba') {
        live.rank = m.peringkat || 0; live.dari = m.dari || 0; live.top = m.top || [];
        const now = performance.now(), ada = new Set();
        (m.g || []).forEach(a => {
          ada.add(a[0]); const g = ghosts.get(a[0]);
          if (!g) ghosts.set(a[0], { d: a[1], v: 0, t: now, tampil: a[1], h: a[2], dk: a[3], aktif: true });
          else { const dt = (now - g.t) / 1000; if (dt > .05) g.v = clamp((a[1] - g.d) / dt, 0, 330); g.d = a[1]; g.t = now; g.h = a[2]; g.dk = a[3]; g.aktif = true; }
        });
        ghosts.forEach((g, id) => { if (!ada.has(id)) g.aktif = false; });
        if (mode === 'hasil') $('hRank').textContent = live.rank ? 'Peringkat sementara: #' + live.rank + ' dari ' + live.dari : '';
        if (mode === 'nonton') perbaruiNonton();
      }
    },
  };
})();
