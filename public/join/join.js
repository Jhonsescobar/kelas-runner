(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KR = window.KR;
  var kode = (new URLSearchParams(location.search).get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  var av = { skin: rand(6), shirt: rand(6), expr: KR.EXPR[rand(4)][0], hat: KR.HAT[rand(4)][0] };
  var sudahMasuk = false, id = null, net;
  function rand(n) { return Math.floor(Math.random() * n); }

  function simpan(o) { try { sessionStorage.setItem('kr_siswa', JSON.stringify(o)); } catch (e) { /* abaikan */ } }
  function muat() { try { return JSON.parse(sessionStorage.getItem('kr_siswa') || 'null'); } catch (e) { return null; } }
  function lupa() { try { sessionStorage.removeItem('kr_siswa'); } catch (e) { /* abaikan */ } }

  function lihat(nama) { ['vKode', 'vForm', 'vLobby', 'vAkhir'].forEach(function (v) { $(v).hidden = v !== nama; }); }
  function akhir(pesan, bisaUlang) { sudahMasuk = false; $('aPesan').textContent = pesan; $('bUlang').hidden = !bisaUlang; lihat('vAkhir'); }

  var syncs = [
    KR.radioGroup($('swSkin'), KR.SKIN.map(function (s, i) { return { k: i, label: s.n, color: s.c }; }), function () { return av.skin; }, function (v) { av.skin = v; gambar(); }, 'sw'),
    KR.radioGroup($('swShirt'), KR.SHIRT.map(function (s, i) { return { k: i, label: s.n, color: s.c }; }), function () { return av.shirt; }, function (v) { av.shirt = v; gambar(); }, 'sw'),
    KR.radioGroup($('pExpr'), KR.EXPR.map(function (e) { return { k: e[0], label: e[1] }; }), function () { return av.expr; }, function (v) { av.expr = v; gambar(); }),
    KR.radioGroup($('pHat'), KR.HAT.map(function (e) { return { k: e[0], label: e[1] }; }), function () { return av.hat; }, function (v) { av.hat = v; gambar(); }),
  ];
  var t0 = performance.now();
  function gambar() { KR.redrawAvatar($('prev'), av, ((performance.now() - t0) / 1000 * 1.6) % 1); if (sudahMasuk) KR.redrawAvatar($('prev2'), av, ((performance.now() - t0) / 1000 * 1.6) % 1); }
  (function loop() { if (!$('vForm').hidden || !$('vLobby').hidden) gambar(); requestAnimationFrame(loop); })();

  $('bKode').addEventListener('click', function () {
    var k = $('kodeIn').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (k.length === 6) { kode = k; lihat('vForm'); }
  });
  $('bMasuk').addEventListener('click', function () {
    $('eForm').textContent = '';
    net.send({ t: 'hello', role: 'siswa', kode: kode, nama: $('nama').value, avatar: av });
  });
  $('nama').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('bMasuk').click(); } });
  $('bUlang').addEventListener('click', function () { lupa(); location.href = '/join'; });

  net = KR.connect({
    open: function (api) {
      KR.Game.init(api);
      $('putus').hidden = true;
      var s = muat();
      if (s && s.token && (!kode || s.kode === kode)) { kode = s.kode; api.send({ t: 'hello', role: 'siswa', kode: s.kode, token: s.token }); }
      else if (!sudahMasuk) lihat(kode ? 'vForm' : 'vKode');
    },
    close: function () { $('putus').hidden = false; },
    msg: function (m) {
      if (m.t === 'siswa:ok') {
        sudahMasuk = true; id = m.id; simpan({ kode: kode, token: m.token });
        if (m.sekarang) KR.Game.sinkron(m.sekarang);
        $('lNama').textContent = m.nama;
        lihat('vLobby'); gambar();
      } else if (m.t === 'state') {
        if (!sudahMasuk) return;
        var s = m.state;
        if (!s) return;
        KR.Game.state(s, id);
        var jumlah = s.pemain.filter(function (p) { return !p.penonton; }).length;
        $('lInfo').textContent = jumlah + ' pemain sudah di lobby · kode ' + s.kode;
        if (s.status === 'lobby') { $('lStatus').textContent = 'Kamu di lobby'; $('lPesan').textContent = 'Menunggu guru memulai. Putar HP ke mode landscape saat permainan dimulai.'; }
      } else if (m.t === 'lari:ok' || m.t === 'q' || m.t === 'q:hasil' || m.t === 'lomba') {
        KR.Game.pesan(m);
      } else if (m.t === 'err') {
        if (m.kode === 'token') { lupa(); sudahMasuk = false; lihat(kode ? 'vForm' : 'vKode'); $('eForm').textContent = m.pesan; }
        else if (m.kode === 'kode') { lupa(); sudahMasuk = false; lihat('vKode'); }
        else $('eForm').textContent = m.pesan;
        if (m.kode === 'kode') { $('kodeIn').value = ''; $('kodeIn').placeholder = 'Kode tidak ditemukan'; }
      } else if (m.t === 'keluar') { lupa(); document.body.classList.remove('bermain'); $('vGame').hidden = true; akhir(m.alasan, true); }
      else if (m.t === 'tutup') { lupa(); document.body.classList.remove('bermain'); $('vGame').hidden = true; akhir('Room sudah ditutup oleh guru.', false); }
    },
  });
})();
