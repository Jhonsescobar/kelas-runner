(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KR = window.KR;
  var token = null, masuk = false, state = null, terakhir = null, tutupArm = 0, akhiriArm = 0, qrUrl = '', bank = [], bagian = 'sesi';
  try { token = sessionStorage.getItem('kr_guru'); } catch (e) { /* abaikan */ }
  var pilih = { dur: 7, jenis: 'acak', tema: 'space', bank: 'contoh' };
  var lombaData = null, sisa = 0, sisaT = 0, penandaHasil = '';
  var JENIS = { acak: 'acak', pg: 'pilihan ganda', isian: 'isian' };
  var STATUS = ['berlari', 'melambat', 'menjawab', 'jatuh', 'bersiap', 'terputus'];

  KR.radioGroup($('pDur'), [{ k: 2, label: '2 menit' }, { k: 5, label: '5 menit' }, { k: 7, label: '7 menit' }], function () { return pilih.dur; }, function (v) { pilih.dur = v; });
  KR.radioGroup($('pTema'), [{ k: 'space', label: 'Space' }, { k: 'lava', label: 'Lava' }], function () { return pilih.tema; }, function (v) { pilih.tema = v; });
  KR.radioGroup($('pJenis'), [{ k: 'acak', label: 'Acak' }, { k: 'pg', label: 'Pilihan ganda' }, { k: 'isian', label: 'Isian' }], function () { return pilih.jenis; }, function (v) { pilih.jenis = v; });

  var net = KR.connect({
    open: function (api) { $('putus').hidden = true; if (token) api.send({ t: 'hello', role: 'guru', token: token }); },
    close: function () { $('putus').hidden = false; },
    msg: function (m) {
      if (m.t === 'guru:ok') {
        token = m.token; masuk = true;
        try { sessionStorage.setItem('kr_guru', token); } catch (e) { /* abaikan */ }
        isiHost(m.hosts); bank = m.bank || []; isiBank(); tampil();
      } else if (m.t === 'hosts') { isiHost(m.hosts);
      } else if (m.t === 'state') { state = m.state; terakhir = m.terakhir || null; tampil(); }
      else if (m.t === 'lomba') { lombaData = m.s; sisa = m.sisa; sisaT = performance.now(); monitor(); }
      else if (m.t === 'bank:daftar') { bank = m.bank; isiBank(); }
      else if (m.t === 'bank:hasil') hasilPeriksa(m);
      else if (m.t === 'bank:tersimpan') { pesanBank('sukses', ['Tersimpan: ' + m.jumlah + ' soal. Bank ini sekarang bisa dipilih saat membuat room.']); }
      else if (m.t === 'bank:isi') { $('bNama').value = m.bawaan ? '' : m.nama; $('bTeks').value = m.teks; $('bJudul').textContent = m.bawaan ? 'Contoh bawaan (salin ke bank sendiri)' : 'Mengubah: ' + m.nama; net.send({ t: 'bank:periksa', teks: m.teks }); }
      else if (m.t === 'err') {
        if (m.kode === 'pin' || m.kode === 'terkunci' || m.kode === 'sesi') $('eLogin').textContent = m.pesan;
        else if (m.kode === 'bank') { $('eBuat').textContent = m.pesan; pesanBank('galat', [m.pesan]); }
        else { $('eRoom').textContent = m.pesan; }
      }
    },
  });

  function isiHost(hosts) {
    var s = $('host'), lama = s.value; s.textContent = '';
    if (!hosts || !hosts.length) {
      var o = document.createElement('option'); o.value = ''; o.textContent = 'Tidak terdeteksi. Sambungkan laptop ke WiFi atau hotspot.'; s.appendChild(o); return;
    }
    hosts.forEach(function (h) { var o = document.createElement('option'); o.value = h.ip; o.textContent = h.ip === 'publik' ? h.nama : h.ip + '  (' + h.nama + ')'; s.appendChild(o); });
    if (lama && hosts.some(function (h) { return h.ip === lama; })) s.value = lama;
  }

  /* ---------- tab ---------- */
  function setBagian(b) { bagian = b; $('tSesi').setAttribute('aria-pressed', String(b === 'sesi')); $('tBank').setAttribute('aria-pressed', String(b === 'bank')); tampil(); if (b === 'bank') net.send({ t: 'bank:daftar' }); }
  $('tSesi').addEventListener('click', function () { setBagian('sesi'); });
  $('tBank').addEventListener('click', function () { setBagian('bank'); });

  $('fLogin').addEventListener('submit', function (e) {
    e.preventDefault(); $('eLogin').textContent = '';
    net.send({ t: 'hello', role: 'guru', pin: $('pin').value.trim() });
  });
  $('bBuat').addEventListener('click', function () {
    $('eBuat').textContent = '';
    var kap = parseInt($('kap').value, 10);
    if (!(kap >= 1 && kap <= 40)) { $('eBuat').textContent = 'Jumlah pemain harus antara 1 dan 40.'; return; }
    net.send({ t: 'room:buat', kapasitas: kap, durasiMenit: pilih.dur, jenis: pilih.jenis, tema: pilih.tema, bank: $('bank').value, host: $('host').value });
  });
  $('bank').addEventListener('change', infoBank);
  $('bMulai').addEventListener('click', function () { $('eRoom').textContent = ''; net.send({ t: 'room:mulai' }); });
  function konfirmasi(tombol, teksAwal, teksYakin, aksi, arm) {
    if (!arm.v) { tombol.textContent = teksYakin; arm.v = setTimeout(function () { arm.v = 0; tombol.textContent = teksAwal; }, 4000); return; }
    clearTimeout(arm.v); arm.v = 0; tombol.textContent = teksAwal; aksi();
  }
  var armTutup = { v: 0 }, armAkhiri = { v: 0 }, armTutup2 = { v: 0 };
  $('bTutup').addEventListener('click', function () { konfirmasi($('bTutup'), 'TUTUP ROOM', 'YAKIN? TUTUP ROOM', function () { net.send({ t: 'room:tutup' }); }, armTutup); });
  $('bBaruRoom').addEventListener('click', function () { konfirmasi($('bBaruRoom'), 'Tutup room', 'Yakin? Tutup room', function () { net.send({ t: 'room:tutup' }); }, armTutup2); });
  $('bAkhiri').addEventListener('click', function () { konfirmasi($('bAkhiri'), 'AKHIRI SEKARANG', 'YAKIN? AKHIRI SESI', function () { net.send({ t: 'room:akhiri' }); }, armAkhiri); });
  $('bSalin').addEventListener('click', function () { if (state) KR.salin(state.urlJoin, $('bSalin')); });

  /* ---------- daftar bank di formulir room ---------- */
  function isiBank() {
    var s = $('bank'), lama = s.value || pilih.bank; s.textContent = '';
    bank.forEach(function (b) { var o = document.createElement('option'); o.value = b.id; o.textContent = b.nama + ' (' + b.jumlah + ' soal)'; s.appendChild(o); });
    if (bank.some(function (b) { return b.id === lama; })) s.value = lama;
    infoBank();
    daftarBank();
  }
  function infoBank() {
    var b = bank.filter(function (x) { return x.id === $('bank').value; })[0];
    $('bankInfo').textContent = b ? b.pg + ' pilihan ganda, ' + b.isian + ' isian.' : '';
  }

  /* ---------- tampilan sesi ---------- */
  function tampil() {
    $('tab').hidden = !masuk;
    $('vLogin').hidden = masuk;
    var sesi = masuk && bagian === 'sesi';
    $('pBank').hidden = !(masuk && bagian === 'bank');
    $('vBuat').hidden = !sesi || !!state;
    $('vRoom').hidden = !sesi || !state || state.status !== 'lobby';
    $('vMonitor').hidden = !sesi || !state || state.status !== 'berjalan';
    var punyaHasil = sesi && ((state && state.status === 'selesai') || (!state && terakhir));
    $('vHasil').hidden = !punyaHasil;
    if (!masuk || !sesi) return;
    if (punyaHasil) hasil(state ? state : terakhir);
    if (!state) return;
    if (state.status === 'lobby') lobi();
    else if (state.status === 'berjalan') monitor();
  }

  function lobi() {
    if (qrUrl !== state.urlJoin) {
      qrUrl = state.urlJoin;
      var q = qrcode(0, 'M'); q.addData(state.urlJoin); q.make();
      $('qr').src = q.createDataURL(8, 2);
    }
    $('kode').textContent = state.kode;
    $('url').textContent = state.urlJoin;
    var aktif = state.pemain.filter(function (p) { return !p.penonton; }).length;
    $('hitung').textContent = aktif + ' dari ' + state.kapasitas + ' pemain';
    $('status').textContent = 'Menunggu pemain';
    $('info').textContent = state.durasiMenit + ' menit · tema ' + KR.TEMA[state.tema].nama + ' · soal ' + JENIS[state.jenis] + ' · ' + state.bankNama + ' (' + state.jumlahSoal + ' soal)';
    $('bMulai').disabled = aktif < 1;
    $('kosong').hidden = state.pemain.length > 0;

    var ul = $('daftar'); ul.textContent = '';
    state.pemain.forEach(function (p) {
      var li = document.createElement('li');
      var cv = KR.avatarCanvas(p.avatar); cv.className = 'av'; cv.setAttribute('aria-hidden', 'true');
      var nm = document.createElement('div'); nm.className = 'nama';
      var dot = document.createElement('span'); dot.className = 'dot' + (p.online ? '' : ' off'); dot.title = p.online ? 'Tersambung' : 'Terputus';
      nm.append(dot, document.createTextNode(p.nama));
      li.append(cv, nm);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn kecil'; b.textContent = 'Keluarkan';
      b.setAttribute('aria-label', 'Keluarkan ' + p.nama);
      b.addEventListener('click', function () { net.send({ t: 'pemain:keluarkan', id: p.id }); });
      li.appendChild(b); ul.appendChild(li);
    });
  }

  function monitor() {
    if (!state || state.status !== 'berjalan' || $('vMonitor').hidden) return;
    var s = Math.max(0, sisa - (performance.now() - sisaT) / 1000);
    $('mWaktu').textContent = Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    $('mInfo').textContent = 'Room ' + state.kode + ' · tema ' + KR.TEMA[state.tema].nama + ' · ' + state.bankNama;
    var byId = {}; state.pemain.forEach(function (p) { byId[p.id] = p; });
    var data = (lombaData || []).slice().sort(function (a, b) { return b[6] - a[6]; });
    var tb = $('mIsi'); tb.textContent = '';
    data.forEach(function (a, i) {
      var p = byId[a[0]]; if (!p) return;
      var tr = document.createElement('tr');
      function td(t, cls) { var c = document.createElement('td'); c.textContent = t; if (cls) c.className = cls; tr.appendChild(c); }
      td(String(i + 1)); td(p.nama); td(String(a[6]), 'n'); td(a[5] >= 2 ? 'habis' : (2 - a[5]) + ' dari 2', a[5] >= 2 ? 'bad' : a[5] === 1 ? 'warn' : 'ok');
      td(STATUS[a[3]] || '', a[3] === 5 ? 'bad' : ''); td(Math.round(a[1] / 16) + ' m', 'n');
      tb.appendChild(tr);
    });
  }
  setInterval(function () { if (bagian === 'sesi' && state && state.status === 'berjalan') monitor(); }, 1000);

  /* ---------- hasil & analisis ---------- */
  function hasil(sumber) {
    var h = sumber.hasil; if (!h) return;
    var kunci = sumber.kode + '|' + h.urut.length + '|' + (h.urut[0] ? h.urut[0].total : 0);
    if (kunci === penandaHasil) return;
    penandaHasil = kunci;
    $('hJudul').textContent = 'Hasil sesi · room ' + sumber.kode;
    $('hInfo').textContent = sumber.durasiMenit + ' menit · ' + (sumber.bankNama || '') + ' · hasil juga tersimpan di folder data/sesi';
    KR.podium($('hPodium'), h, {});
    $('hPodium').classList.toggle('banyak', h.urut.length > 12);
    var r = $('hRingkas'); r.textContent = '';
    [['Pemain ikut', h.ringkas.ikut + ' dari ' + h.ringkas.pemain], ['Rata-rata skor', String(h.ringkas.rata)], ['Soal dijawab', h.analisis.totalJawab + ' (' + h.analisis.persenBenar + '% benar)']].forEach(function (x) {
      var d = document.createElement('div'); d.className = 'head'; var a = document.createElement('span'); a.textContent = x[0]; var b = document.createElement('b'); b.textContent = x[1]; d.append(a, b); r.appendChild(d);
    });
    var sl = $('hSulit'); sl.textContent = '';
    if (!h.analisis.sulit.length) { var k = document.createElement('p'); k.className = 'dim'; k.textContent = 'Belum cukup data (satu soal perlu muncul minimal dua kali).'; sl.appendChild(k); }
    h.analisis.sulit.forEach(function (s) {
      var d = document.createElement('div'); var t = document.createElement('b'); t.textContent = s.teks;
      var m = document.createElement('div'); m.className = 'meta'; m.textContent = s.persenSalah + '% salah · ' + s.benar + ' benar, ' + s.salah + ' salah, ' + s.habis + ' kehabisan waktu · jawaban: ' + s.contoh;
      d.append(t, m); sl.appendChild(d);
    });
    var il = $('hIsian'); il.textContent = '';
    if (!h.analisis.isianCek.length) { var k2 = document.createElement('p'); k2.className = 'dim'; k2.textContent = 'Tidak ada jawaban isian yang salah.'; il.appendChild(k2); }
    h.analisis.isianCek.forEach(function (s) {
      var d = document.createElement('div'); var t = document.createElement('b'); t.textContent = s.teks;
      var m = document.createElement('div'); m.className = 'meta'; m.textContent = 'Kunci: ' + s.contoh;
      var c = document.createElement('div'); c.className = 'chips'; s.jawaban.forEach(function (j) { var sp = document.createElement('span'); sp.textContent = j; c.appendChild(sp); });
      d.append(t, m, c); il.appendChild(d);
    });
    $('bCsv').onclick = function () { unduhCsv(sumber, h); };
  }
  function sel(v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function unduhCsv(sumber, h) {
    var baris = [['Peringkat', 'Nama', 'Total', 'Kuis', 'Lari', 'Koin', 'Benar', 'Salah', 'Jarak (m)', 'Percobaan', 'Akurasi (%)'].map(sel).join(';')];
    h.urut.forEach(function (u, i) { baris.push([u.ikut ? i + 1 : '-', u.nama, u.total, u.kuis, u.lari, u.koin, u.benar, u.salah, u.jarak, u.percobaan, u.akurasi].map(sel).join(';')); });
    var blob = new Blob(['﻿' + baris.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hasil-' + sumber.kode + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- bank soal ---------- */
  var KOMP = 'campur', KODE = false, soalPrev = [];
  KR.radioGroup($('pKomp'), [{ k: 'campur', label: 'Campur' }, { k: 'pg', label: 'Pilihan ganda' }, { k: 'isian', label: 'Isian' }], function () { return KOMP; }, function (v) { KOMP = v; susunPrompt(); });
  KR.radioGroup($('pKode'), [{ k: false, label: 'Tanpa kode' }, { k: true, label: 'Sertakan kode Python' }], function () { return KODE; }, function (v) { KODE = v; susunPrompt(); });
  ['pTopik', 'pLevel', 'pJumlah'].forEach(function (id) { $(id).addEventListener('input', susunPrompt); });
  function susunPrompt() {
    var n = parseInt($('pJumlah').value, 10) || 20, topik = $('pTopik').value.trim() || '[isi topik]', level = $('pLevel').value.trim() || 'siswa SMP';
    var kom = KOMP === 'pg' ? 'semuanya pilihan ganda' : KOMP === 'isian' ? 'semuanya isian singkat' : 'sekitar 70% pilihan ganda dan 30% isian singkat';
    var p = 'Buatkan ' + n + ' soal kuis tentang "' + topik + '" untuk ' + level + '. Komposisi: ' + kom + '.\n' +
      'Keluarkan HANYA JSON valid (tanpa penjelasan, tanpa pagar ```), berupa array objek. Contoh bentuknya:\n\n' +
      '[\n {"tipe":"pg","teks":"Apa fungsi RAM?","opsi":["Menyimpan data sementara","Menyimpan foto selamanya","Mencetak dokumen","Menampilkan gambar"],"kunci":0,"pembahasan":"RAM menyimpan data yang sedang dipakai."},\n' +
      ' {"tipe":"isian","teks":"Hasil dari 2 + 3 * 4 adalah ...","diterima":["14","empat belas"],"contoh":"14","pembahasan":"Perkalian dikerjakan lebih dulu."}' + (KODE ? ',\n {"tipe":"pg","teks":"Apa keluaran program ini?","kode":"x = 2\\ny = 3\\nprint(x * y)","opsi":["5","6","23","Error"],"kunci":1,"waktu_detik":12,"pembahasan":"2 dikali 3 sama dengan 6."}' : '') + '\n]\n\n' +
      'Aturan:\n' +
      '- "tipe" hanya "pg" (pilihan ganda) atau "isian" (jawaban singkat, 1 sampai 3 kata).\n' +
      '- "teks" maksimal 140 huruf. Setiap pilihan maksimal 28 huruf, tanpa awalan A/B/C/D.\n' +
      '- pg: tepat 4 opsi. "kunci" adalah nomor jawaban benar mulai dari 0 (0 = opsi pertama). Sebar posisi jawaban benar.\n' +
      '- isian: jawabannya harus pasti. Isi "diterima" dengan 2 sampai 5 variasi penulisan yang benar (huruf kecil), dan "contoh" berisi jawaban yang ditampilkan ke siswa.\n' +
      '- "pembahasan": 1 sampai 2 kalimat sederhana, maksimal 300 huruf.\n' +
      (KODE ? '- "kode" (opsional): potongan kode Python maksimal 8 baris, tiap baris maksimal 40 huruf, pakai \\n untuk baris baru. Soal berkode beri "waktu_detik": 12 (pg) atau 20 (isian).\n' : '') +
      '- Kesulitan campur dari mudah ke sedang. Bahasa Indonesia. Hindari soal ambigu atau yang punya dua jawaban benar.';
    $('pHasil').value = p;
  }
  susunPrompt();
  $('bSalinPrompt').addEventListener('click', function () { KR.salin($('pHasil').value, $('bSalinPrompt')); });

  function pesanBank(jenis, daftar, judul) {
    var h = $('bPesan'); h.textContent = '';
    if (!daftar || !daftar.length) return;
    var d = document.createElement('div'); d.className = 'kotak ' + jenis;
    if (judul) { var b = document.createElement('b'); b.textContent = judul; d.appendChild(b); }
    var ul = document.createElement('ul'); daftar.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); d.appendChild(ul);
    h.appendChild(d);
  }
  $('bPeriksa').addEventListener('click', function () { $('bSimpan').disabled = true; net.send({ t: 'bank:periksa', teks: $('bTeks').value }); });
  $('bSimpan').addEventListener('click', function () { net.send({ t: 'bank:simpan', nama: $('bNama').value, teks: $('bTeks').value }); });
  $('bBaru').addEventListener('click', function () { $('bNama').value = ''; $('bTeks').value = ''; $('bJudul').textContent = 'Bank baru'; $('bPesan').textContent = ''; $('bPrev').textContent = ''; $('bSimpan').disabled = true; });

  function hasilPeriksa(m) {
    $('bPesan').textContent = '';
    if (!m.ok) { pesanBank('galat', m.galat, 'Perlu diperbaiki (' + m.galat.length + ')'); $('bPrev').textContent = ''; $('bSimpan').disabled = true; soalPrev = []; return; }
    soalPrev = m.soal;
    var ringkas = m.soal.length + ' soal terbaca (' + m.soal.filter(function (s) { return s.tipe === 'pg'; }).length + ' pilihan ganda, ' + m.soal.filter(function (s) { return s.tipe === 'isian'; }).length + ' isian). Semua aturan terpenuhi.';
    if (m.peringatan.length) pesanBank('peringatan', m.peringatan, ringkas + ' Catatan (tidak wajib diperbaiki):');
    else pesanBank('sukses', [ringkas]);
    $('bSimpan').disabled = false;
    pratinjau();
  }
  function bentuk(q) {
    var o = { tipe: q.tipe, teks: q.teks }; if (q.kode) o.kode = q.kode;
    if (q.tipe === 'pg') { o.opsi = q.opsi; o.kunci = q.kunci; } else { o.diterima = q.diterima; o.contoh = q.contoh; }
    o.waktu_detik = q.waktu_detik; o.pembahasan = q.pembahasan; return o;
  }
  function pratinjau() {
    var ul = $('bPrev'); ul.textContent = '';
    soalPrev.forEach(function (q, i) {
      var li = document.createElement('li'); li.className = q.tipe;
      var atas = document.createElement('div'); atas.className = 'atas2';
      var tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = (i + 1) + '. ' + q.teks;
      var meta = document.createElement('span'); meta.className = 'chip'; meta.textContent = (q.tipe === 'pg' ? 'PG' : 'Isian') + ' · ' + q.waktu_detik + ' dtk';
      atas.append(tx, meta); li.appendChild(atas);
      if (q.kode) { var pre = document.createElement('pre'); pre.textContent = q.kode; li.appendChild(pre); }
      var op = document.createElement('div'); op.className = 'op';
      if (q.tipe === 'pg') q.opsi.forEach(function (o, k) { var s = document.createElement('span'); s.textContent = 'ABCD'[k] + '. ' + o; if (k === q.kunci) s.className = 'benar'; op.appendChild(s); });
      else q.diterima.forEach(function (o) { var s = document.createElement('span'); s.className = 'benar'; s.textContent = o; op.appendChild(s); });
      li.appendChild(op);
      var hapus = document.createElement('button'); hapus.type = 'button'; hapus.className = 'btn kecil'; hapus.textContent = 'Hapus soal ini';
      hapus.addEventListener('click', function () {
        soalPrev.splice(i, 1);
        $('bTeks').value = JSON.stringify(soalPrev.map(bentuk), null, 1);
        if (!soalPrev.length) { $('bPrev').textContent = ''; $('bSimpan').disabled = true; return; }
        net.send({ t: 'bank:periksa', teks: $('bTeks').value });
      });
      li.appendChild(hapus); ul.appendChild(li);
    });
  }
  function daftarBank() {
    var ul = $('bDaftar'); ul.textContent = '';
    bank.forEach(function (b) {
      var li = document.createElement('li');
      var n = document.createElement('div'); n.className = 'nm'; n.textContent = b.nama;
      var m = document.createElement('div'); m.className = 'meta'; m.textContent = b.jumlah + ' soal · ' + b.pg + ' PG · ' + b.isian + ' isian';
      var a = document.createElement('div'); a.className = 'aksi';
      var u = document.createElement('button'); u.type = 'button'; u.className = 'btn kecil'; u.textContent = b.bawaan ? 'Lihat' : 'Ubah';
      u.addEventListener('click', function () { net.send({ t: 'bank:baca', id: b.id }); });
      a.appendChild(u);
      if (!b.bawaan) {
        var h = document.createElement('button'); h.type = 'button'; h.className = 'btn kecil danger'; h.textContent = 'Hapus'; var arm = { v: 0 };
        h.addEventListener('click', function () { konfirmasi(h, 'Hapus', 'Yakin?', function () { net.send({ t: 'bank:hapus', id: b.id }); }, arm); });
        a.appendChild(h);
      }
      li.append(n, m, a); ul.appendChild(li);
    });
  }
})();
