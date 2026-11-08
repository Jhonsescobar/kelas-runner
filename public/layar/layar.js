(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KR = window.KR;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var qrUrl = '', kartu = {}, state = null, terakhir = null, t0 = performance.now();
  var KODE_STATUS = ['lari', 'slow', 'menjawab', 'jatuh', 'siap', 'putus'];
  var LABEL_STATUS = { lari: 'berlari', slow: 'melambat', menjawab: 'menjawab kuis', jatuh: 'jatuh', siap: 'bersiap', putus: 'terputus' };
  var lint = null, lintSeed = -1, tema = 'space', lane = {}, baris = {}, snapT = 0, sisa = 0, sisaT = 0, penanda = '', byId = {};
  var laneKosong = false;

  KR.connect({
    open: function (api) { api.send({ t: 'hello', role: 'layar' }); },
    msg: function (m) {
      if (m.t === 'state') { state = m.state; terakhir = m.terakhir || null; tampil(); }
      else if (m.t === 'lomba') lomba(m);
    },
  });

  function lihat(nama) { ['vTunggu', 'vLobi', 'vLomba', 'vAkhir'].forEach(function (v) { $(v).hidden = v !== nama; }); }

  function tampil() {
    byId = {};
    if (state) state.pemain.forEach(function (p) { byId[p.id] = p; });
    if (state && state.status === 'berjalan') { lihat('vLomba'); siapkanLomba(); return; }
    if (state && state.status === 'selesai') { lihat('vAkhir'); podium(state.hasil, state.kode, state.durasiMenit, state.bankNama, state.tema, true); return; }
    if (!state && terakhir) { lihat('vAkhir'); podium(terakhir.hasil, terakhir.kode, terakhir.durasiMenit, terakhir.bankNama, terakhir.tema, false); return; }
    lihat(state ? 'vLobi' : 'vTunggu');
    if (!state) { kartu = {}; return; }
    lobi();
  }

  /* ---------- lobby ---------- */
  function lobi() {
    if (qrUrl !== state.urlJoin) {
      qrUrl = state.urlJoin;
      var q = qrcode(0, 'M'); q.addData(state.urlJoin); q.make();
      $('qr').src = q.createDataURL(10, 2);
    }
    $('kode').textContent = state.kode;
    $('url').textContent = state.urlJoin;
    var aktif = state.pemain.filter(function (p) { return !p.penonton; }).length;
    $('hitung').textContent = aktif + ' / ' + state.kapasitas + ' pemain';
    $('status').textContent = 'Menunggu guru memulai · tema ' + KR.TEMA[state.tema].nama;
    $('kosong').hidden = state.pemain.length > 0;
    $('daftar').classList.toggle('banyak', state.pemain.length > 15);
    var ul = $('daftar'), ada = {};
    state.pemain.forEach(function (p, i) {
      ada[p.id] = true;
      var k = kartu[p.id];
      if (!k) {
        var li = document.createElement('li'); li.className = 'masuk';
        var cv = KR.avatarCanvas(p.avatar); cv.setAttribute('aria-hidden', 'true');
        var nm = document.createElement('div'); nm.className = 'nama';
        li.append(cv, nm);
        k = kartu[p.id] = { li: li, cv: cv, nm: nm, av: p.avatar, fase: i * 0.17 };
        ul.appendChild(li);
      }
      k.nm.textContent = p.nama;
      k.li.classList.toggle('off', !p.online);
    });
    Object.keys(kartu).forEach(function (id) { if (!ada[id]) { kartu[id].li.remove(); delete kartu[id]; } });
  }

  /* ---------- podium ---------- */
  function podium(hasil, kode, durasi, bank, temaNama, sesiAktif) {
    var kunci = kode + '|' + (hasil ? hasil.urut.length : 0) + '|' + (hasil && hasil.urut[0] ? hasil.urut[0].total : 0);
    $('aInfo').textContent = 'Room ' + kode + ' · ' + durasi + ' menit' + (bank ? ' · ' + bank : '');
    $('aCatatan').textContent = sesiAktif ? 'Guru bisa melihat analisis soal di dashboard.' : 'Podium sesi terakhir. Menunggu guru membuat room baru.';
    if (kunci === penanda) return;
    penanda = kunci;
    KR.podium($('aPodium'), hasil, {});
    $('aPodium').classList.toggle('banyak', hasil.urut.length > 12);
  }

  /* ---------- lomba ---------- */
  function siapkanLomba() {
    tema = state.tema;
    if (!lint || lintSeed !== state.seed) { lint = new KR.Lintasan(state.seed); lintSeed = state.seed; lane = {}; baris = {}; $('lanes').textContent = ''; $('papan').textContent = ''; laneKosong = false; }
    $('lTema').textContent = 'Tema ' + KR.TEMA[tema].nama;
    $('lKode').textContent = 'Room ' + state.kode;
    var aktif = state.pemain.filter(function (p) { return !p.penonton; });
    var padat = aktif.length > 12;
    $('lIsi').classList.toggle('padat', padat);
    $('lIsi').classList.toggle('sangat', aktif.length > 24);
    $('lanes').classList.toggle('satu', aktif.length === 1);
    aktif.forEach(function (p) {
      if (lane[p.id]) return;
      var li = document.createElement('li'); li.className = 'lane';
      var cv = document.createElement('canvas'); cv.width = 320; cv.height = 84; cv.setAttribute('aria-hidden', 'true');
      var info = document.createElement('div'); info.className = 'info';
      var n = document.createElement('span'); n.textContent = p.nama; var s = document.createElement('b'); s.textContent = '0';
      info.append(n, s); li.append(cv, info); $('lanes').appendChild(li);
      lane[p.id] = { li: li, cv: cv, c: cv.getContext('2d'), skor: s, d: 0, v: 0, t: performance.now(), show: 0, h: 0, st: 4, dk: 0, ny: 0, sk: 0 };
      lane[p.id].c.imageSmoothingEnabled = false;
    });
    Object.keys(lane).forEach(function (id) { if (!byId[id] || byId[id].penonton) { lane[id].li.remove(); delete lane[id]; if (baris[id]) { baris[id].li.remove(); delete baris[id]; } } });
  }

  function lomba(m) {
    if (!state || state.status !== 'berjalan') return;
    var now = performance.now();
    sisa = m.sisa; sisaT = now;
    m.s.forEach(function (a) {
      var l = lane[a[0]]; if (!l) return;
      var dt = (now - l.t) / 1000;
      if (dt > .05 && a[7]) l.v = Math.max(0, Math.min(330, (a[1] - l.d) / dt));
      if (!a[7]) l.v = 0;
      l.d = a[1]; l.t = now; l.h = a[2]; l.st = a[3]; l.dk = a[4]; l.ny = a[5]; l.sk = a[6]; l.run = a[7];
      if (l.show === 0 && l.d > 0) l.show = l.d;
    });
    papan(m.s);
  }

  function papan(data) {
    var urut = data.slice().sort(function (a, b) { return b[6] - a[6]; });
    var maks = urut.reduce(function (n, a) { return Math.max(n, a[1]); }, 1);
    var ol = $('papan');
    urut.forEach(function (a, i) {
      var p = byId[a[0]]; if (!p) return;
      var b = baris[a[0]];
      if (!b) {
        var li = document.createElement('li');
        var no = document.createElement('span'); no.className = 'no';
        var cv = KR.avatarCanvas(p.avatar); cv.setAttribute('aria-hidden', 'true');
        var nm = document.createElement('span'); nm.className = 'nm'; var nt = document.createElement('span'); nt.textContent = p.nama; var sm = document.createElement('small'); nm.append(nt, sm);
        var nv = document.createElement('span'); nv.className = 'nv'; nv.append(document.createElement('i'), document.createElement('i'));
        var sk = document.createElement('span'); sk.className = 'sk';
        li.append(no, cv, nm, nv, sk);
        b = baris[a[0]] = { li: li, no: no, sm: sm, nv: nv, sk: sk, ss: '', ns: -1, sc: -1 };
      }
      ol.appendChild(b.li); // urutan DOM mengikuti peringkat
      b.no.textContent = String(i + 1);
      var st = KODE_STATUS[a[3]] || 'lari';
      var label = (LABEL_STATUS[st]) + (a[3] <= 1 || a[3] === 3 ? ' · ' + Math.round(a[1] / 16) + ' m' : '');
      if (b.ss !== label) { b.ss = label; b.sm.textContent = label; b.sm.className = st; }
      if (b.ns !== a[5]) { b.ns = a[5]; b.nv.children[0].className = a[5] < 1 ? 'on' : ''; b.nv.children[1].className = a[5] < 2 ? 'on' : ''; }
      if (b.sc !== a[6]) { b.sc = a[6]; b.sk.textContent = String(a[6]); }
      b.li.classList.toggle('off', a[3] === 5);
      var l = lane[a[0]]; if (l) { if (l.skorTeks !== a[6]) { l.skorTeks = a[6]; l.skor.textContent = String(a[6]); } l.li.classList.toggle('mati', a[3] === 3); }
    });
  }

  function tahap(d) { var n = 0; for (var i = 0; i < lint.items.length; i++) { var it = lint.items[i]; if (it.x > d) break; if (it.t === 'gate') n++; } return Math.floor(n / 2); }

  function gambarLane(l, p, dt, t) {
    var c = l.c, umur = Math.min(.8, (performance.now() - l.t) / 1000);
    var est = l.d + l.v * umur; l.show += (est - l.show) * Math.min(1, dt * 8);
    var d = l.show; lint.sampai(d + 340);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 320, 84);
    c.save(); c.translate(0, -(KR.GROUND - 72));
    KR.latar(c, tema, tahap(d), lint, d, { lane: true, t: t, kurang: reduce });
    for (var i = lint.awal(d); i < lint.items.length; i++) { var it = lint.items[i], x = it.x - d + KR.PX; if (x > 330) break; if (x < -60) continue; KR.benda(c, tema, it, x, t, reduce); }
    var co = lint.coins; for (var j = lint.awalKoin(d); j < co.length; j++) { var k = co[j], cx = k.x - d + KR.PX; if (cx > 330) break; if (cx < -10) continue; KR.koin(c, cx, k.y, t); }
    var h = l.h;
    if (l.st === 3) { c.globalAlpha = .55; c.save(); c.translate(KR.PX, KR.GROUND); c.scale(1.3, .3); KR.drawAvatar(c, p.avatar, 0, 0, { expr: 'kaget', cracked: true }); c.restore(); c.globalAlpha = 1; }
    else KR.drawAvatar(c, p.avatar, KR.PX, KR.GROUND - h, { phase: (d / 56) % 1, duck: !!l.dk && h < 2, air: h > 2, expr: l.st === 2 ? 'kaget' : null, cracked: l.ny >= 1 });
    c.restore();
  }

  var last = performance.now();
  (function animasi() {
    var now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    var t = (now - t0) / 1000;
    if (state && state.status === 'lobby' && !reduce) {
      Object.keys(kartu).forEach(function (id) { var k = kartu[id]; KR.redrawAvatar(k.cv, k.av, (t * 1.4 + k.fase) % 1); });
    } else if (state && state.status === 'berjalan' && lint) {
      Object.keys(lane).forEach(function (id) { var p = byId[id]; if (p && !$('lanes').closest('.padat')) gambarLane(lane[id], p, dt, t); });
      var s = Math.max(0, sisa - (now - sisaT) / 1000);
      $('lWaktu').textContent = Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
      $('lWaktu').classList.toggle('low', s < 30);
    }
    requestAnimationFrame(animasi);
  })();
})();
