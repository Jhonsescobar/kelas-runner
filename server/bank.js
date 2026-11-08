'use strict';
/* Bank soal: membaca JSON tempelan guru, memeriksanya soal per soal, dan menyimpannya per topik. */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'bank');
const BATAS = { teks: 140, opsi: 28, diterima: 40, contoh: 40, kodeBaris: 10, kodeLebar: 46, bahas: 300, waktuMin: 5, waktuMaks: 60, jumlah: 200 };
const WAKTU = { pg: 7, isian: 15, pgKode: 12, isianKode: 20 };

const TIPE = {
  pg: 'pg', 'pilihan ganda': 'pg', pilgan: 'pg', mcq: 'pg', mc: 'pg', 'multiple choice': 'pg',
  isian: 'isian', 'isian singkat': 'isian', essay: 'isian', esai: 'isian', uraian: 'isian', 'short answer': 'isian',
};

const CONTOH = [
  { tipe: 'pg', teks: 'Komponen apa yang menyimpan data sementara saat komputer menyala?', opsi: ['Hard disk', 'RAM', 'Flashdisk', 'Monitor'], kunci: 1, pembahasan: 'RAM menyimpan data yang sedang dipakai dan kosong lagi saat listrik mati. Hard disk dan flashdisk menyimpan data permanen.' },
  { tipe: 'pg', teks: 'Bagian komputer yang menjalankan instruksi program disebut...', opsi: ['CPU', 'Speaker', 'Keyboard', 'Printer'], kunci: 0, pembahasan: 'CPU memproses instruksi. Keyboard adalah perangkat masuk, speaker dan printer adalah perangkat keluar.' },
  { tipe: 'pg', teks: 'Alamat unik yang membuat perangkat dikenali di jaringan adalah...', opsi: ['Alamat IP', 'Kata sandi', 'Nama akun', 'Bookmark'], kunci: 0, pembahasan: 'Alamat IP seperti alamat rumah: data tahu harus dikirim ke mana.' },
  { tipe: 'pg', teks: 'Ada pesan: "Kamu menang hadiah! Klik tautan dan isi kata sandi." Tindakan paling aman?', opsi: ['Klik tautannya', 'Teruskan ke teman', 'Abaikan, laporkan', 'Balas sandimu'], kunci: 2, pembahasan: 'Pesan yang memburu waktu dan minta kata sandi adalah ciri phishing. Jangan diklik, abaikan dan laporkan.' },
  { tipe: 'pg', teks: 'Urutan langkah yang jelas untuk menyelesaikan masalah disebut...', opsi: ['Algoritma', 'Hardware', 'Browser', 'Piksel'], kunci: 0, pembahasan: 'Algoritma adalah langkah-langkah terurut yang bisa diikuti sampai masalah selesai.' },
  { tipe: 'pg', teks: 'Memecah masalah besar menjadi bagian kecil agar mudah dikerjakan disebut...', opsi: ['Dekomposisi', 'Enkripsi', 'Kompresi', 'Kloning'], kunci: 0, pembahasan: 'Dekomposisi memecah masalah jadi bagian kecil. Enkripsi mengacak data, kompresi memperkecil ukuran file.' },
  { tipe: 'pg', teks: '1 byte sama dengan berapa bit?', opsi: ['4', '8', '16', '1'], kunci: 1, pembahasan: '1 byte = 8 bit. Satu huruf biasanya memakai 1 byte.' },
  { tipe: 'pg', teks: 'Kata sandi yang paling kuat adalah...', opsi: ['12345678', 'namamu123', 'Kd9#mQ2!vL7x', 'passwordku'], kunci: 2, pembahasan: 'Kata sandi kuat itu panjang, campuran huruf besar, kecil, angka, simbol, dan tidak berisi data pribadi.' },
  { tipe: 'pg', teks: 'Pola 2, 4, 8, 16, ... Angka berikutnya adalah...', opsi: ['18', '24', '32', '20'], kunci: 2, pembahasan: 'Tiap angka dikali 2, jadi 16 x 2 = 32.' },
  { tipe: 'pg', teks: 'Apa keluaran program ini?', kode: 'x = 5\ny = 3\nprint(x + y)', opsi: ['8', '53', '2', 'Error'], kunci: 0, pembahasan: 'x + y menjumlahkan dua angka: 5 + 3 = 8. Tanda + pada angka berarti penjumlahan, bukan menyambung.' },
  { tipe: 'isian', teks: 'Aplikasi untuk membuka situs web, contohnya Chrome, disebut apa? (1 kata)', diterima: ['browser', 'peramban', 'penjelajah web'], contoh: 'Browser (peramban)', pembahasan: 'Browser atau peramban menampilkan halaman web. Contohnya Chrome, Firefox, dan Edge.' },
  { tipe: 'isian', teks: 'Sebutkan satu contoh perangkat keluaran (output) komputer.', diterima: ['monitor', 'layar', 'printer', 'speaker', 'proyektor', 'headphone', 'earphone', 'pengeras suara'], contoh: 'Monitor, printer, atau speaker', pembahasan: 'Perangkat keluaran menampilkan hasil pemrosesan: monitor menampilkan gambar, printer mencetak, speaker mengeluarkan suara.' },
  { tipe: 'isian', teks: 'Proses mengacak data menjadi kode rahasia agar tidak terbaca orang lain disebut...', diterima: ['enkripsi', 'mengenkripsi', 'encryption'], contoh: 'Enkripsi', pembahasan: 'Enkripsi mengubah data jadi kode yang hanya bisa dibuka dengan kunci.' },
  { tipe: 'isian', teks: 'Bilangan biner hanya memakai dua angka: 0 dan ...?', diterima: ['1', 'satu'], contoh: '1', pembahasan: 'Biner hanya punya 0 dan 1. Komputer menyimpan semua data dalam bentuk 0 dan 1.' },
  { tipe: 'isian', teks: 'Angka terakhir yang dicetak program ini?', kode: 'for i in range(3):\n    print(i)', diterima: ['2', 'dua'], contoh: '2', pembahasan: 'range(3) menghasilkan 0, 1, 2. Penghitungan Python dimulai dari 0 dan berhenti sebelum angka 3.' },
];

/* ---------- membaca JSON yang longgar ---------- */
function posisiGalat(e, teks) {
  const m = /position (\d+)/.exec(e && e.message || '');
  if (!m) return '';
  const pos = Number(m[1]);
  const baris = teks.slice(0, pos).split('\n').length;
  const potong = teks.slice(Math.max(0, pos - 25), pos + 15).replace(/\s+/g, ' ');
  return ' (dekat baris ' + baris + ': ...' + potong + '...)';
}
function coba(t) { try { return { ok: true, nilai: JSON.parse(t) }; } catch (e) { return { ok: false, e }; } }
function bersihDasar(s) {
  let t = s.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '');
  const a = t.search(/[[{]/);
  const z = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  if (a >= 0 && z > a) t = t.slice(a, z + 1);
  return t.replace(/,\s*([\]}])/g, '$1');
}
function bacaJSON(mentah) {
  const s = String(mentah == null ? '' : mentah).replace(/^﻿/, '').trim();
  if (!s) return { ok: false, pesan: 'Kotak masih kosong. Tempel soal dalam format JSON.' };
  if (s.length > 250000) return { ok: false, pesan: 'Teks terlalu panjang. Pecah menjadi beberapa bank soal.' };
  let r = coba(s);
  let diperbaiki = false;
  if (!r.ok) {
    const t1 = bersihDasar(s);
    r = coba(t1);
    if (!r.ok) { // kutip melengkung dari Word atau chat
      const t2 = t1.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'");
      const r2 = coba(t2);
      if (r2.ok) r = r2; else r = { ok: false, e: r2.e, t: t2 };
    }
    if (!r.ok) return { ok: false, pesan: 'Format JSON belum benar' + posisiGalat(r.e, r.t || t1) + '. Biasanya ada koma atau tanda kutip yang kurang. Minta AI memperbaiki, atau pakai tombol Salin prompt.' };
    diperbaiki = true;
  }
  let daftar = r.nilai;
  if (daftar && !Array.isArray(daftar) && typeof daftar === 'object') daftar = daftar.soal || daftar.questions || daftar.pertanyaan;
  if (!Array.isArray(daftar)) return { ok: false, pesan: 'Yang dibaca bukan daftar soal. Isi harus berupa [ { ... }, { ... } ] atau { "soal": [ ... ] }.' };
  if (!daftar.length) return { ok: false, pesan: 'Daftar soal kosong.' };
  if (daftar.length > BATAS.jumlah) return { ok: false, pesan: 'Terlalu banyak soal (' + daftar.length + '). Maksimal ' + BATAS.jumlah + ' per bank.' };
  return { ok: true, daftar, diperbaiki };
}

/* ---------- memeriksa satu soal ---------- */
const teksOpsional = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
function ambil(q, ...kunci) { for (const k of kunci) if (q[k] !== undefined && q[k] !== null) return q[k]; return undefined; }

function periksaSoal(q, i) {
  const no = i + 1, g = [], w = [];
  const salah = (t) => g.push('Soal ' + no + ': ' + t);
  if (!q || typeof q !== 'object' || Array.isArray(q)) return { g: ['Soal ' + no + ': bukan objek soal.'], w };

  const tipe = TIPE[String(ambil(q, 'tipe', 'jenis', 'type') || '').trim().toLowerCase()];
  if (!tipe) salah('tipe harus "pg" atau "isian".');
  const teks = teksOpsional(ambil(q, 'teks', 'soal', 'pertanyaan', 'question')).replace(/\s+/g, ' ');
  if (!teks) salah('teks soal kosong.');
  else if (teks.length > BATAS.teks) salah('teks soal ' + teks.length + ' huruf, maksimal ' + BATAS.teks + '. Persingkat agar muat di layar HP.');

  let kode = '';
  const kodeMentah = ambil(q, 'kode', 'code');
  if (kodeMentah !== undefined && kodeMentah !== null && String(kodeMentah).trim() !== '') {
    kode = String(kodeMentah).replace(/\r/g, '').replace(/\t/g, '  ').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
    const baris = kode.split('\n');
    if (baris.length > BATAS.kodeBaris) salah('kode ' + baris.length + ' baris, maksimal ' + BATAS.kodeBaris + '.');
    else if (baris.some(l => l.length > BATAS.kodeLebar)) salah('ada baris kode lebih dari ' + BATAS.kodeLebar + ' huruf.');
  }

  const hasil = { tipe, teks, kode };
  if (tipe === 'pg') {
    let opsi = ambil(q, 'opsi', 'pilihan', 'options');
    if (!Array.isArray(opsi)) { salah('"opsi" harus berupa daftar 2 sampai 4 pilihan.'); opsi = []; }
    opsi = opsi.map(o => teksOpsional(o).replace(/^\s*[A-Da-d][.)]\s+/, ''));
    if (opsi.length < 2 || opsi.length > 4) salah('jumlah pilihan harus 2 sampai 4 (ada ' + opsi.length + ').');
    opsi.forEach((o, k) => {
      if (!o) salah('pilihan ' + 'ABCD'[k] + ' kosong.');
      else if (o.length > BATAS.opsi) salah('pilihan ' + 'ABCD'[k] + ' ' + o.length + ' huruf, maksimal ' + BATAS.opsi + '.');
    });
    if (new Set(opsi.map(o => o.toLowerCase())).size !== opsi.length) salah('ada dua pilihan yang sama.');
    let kunci = ambil(q, 'kunci', 'jawaban', 'answer');
    if (typeof kunci === 'string') {
      const t = kunci.trim();
      if (/^[A-Da-d]$/.test(t)) kunci = 'abcd'.indexOf(t.toLowerCase());
      else if (/^\d+$/.test(t)) kunci = Number(t);
      else { const idx = opsi.findIndex(o => o.toLowerCase() === t.toLowerCase()); kunci = idx; }
    }
    if (!Number.isInteger(kunci) || kunci < 0 || kunci >= opsi.length) salah('"kunci" harus nomor pilihan benar mulai dari 0 (0 = pilihan pertama).');
    hasil.opsi = opsi; hasil.kunci = kunci;
  } else if (tipe === 'isian') {
    let d = ambil(q, 'diterima', 'kunci', 'jawaban', 'answers', 'answer');
    if (typeof d === 'string') d = [d];
    if (!Array.isArray(d) || !d.length) { salah('"diterima" harus berisi minimal satu jawaban yang dianggap benar.'); d = []; }
    d = d.map(x => teksOpsional(x)).filter(Boolean);
    if (!d.length) salah('semua isi "diterima" kosong.');
    if (d.some(x => x.length > BATAS.diterima)) salah('jawaban dalam "diterima" maksimal ' + BATAS.diterima + ' huruf.');
    if (d.length === 1) w.push('Soal ' + no + ': hanya ada satu jawaban diterima. Tambahkan variasi (sinonim, singkatan) agar siswa tidak dianggap salah karena beda penulisan.');
    let contoh = teksOpsional(ambil(q, 'contoh', 'jawaban_contoh')) || d[0] || '';
    if (contoh.length > BATAS.contoh) { salah('"contoh" maksimal ' + BATAS.contoh + ' huruf.'); }
    hasil.diterima = d; hasil.contoh = contoh;
  }

  let waktu = ambil(q, 'waktu_detik', 'waktu', 'detik');
  const dasar = tipe === 'isian' ? (kode ? WAKTU.isianKode : WAKTU.isian) : (kode ? WAKTU.pgKode : WAKTU.pg);
  if (waktu === undefined || waktu === null || waktu === '') waktu = dasar;
  else {
    waktu = Number(waktu);
    if (!Number.isFinite(waktu) || waktu < BATAS.waktuMin || waktu > BATAS.waktuMaks) { salah('waktu harus antara ' + BATAS.waktuMin + ' dan ' + BATAS.waktuMaks + ' detik.'); waktu = dasar; }
    waktu = Math.round(waktu);
  }
  hasil.waktu_detik = waktu;

  const bahas = teksOpsional(ambil(q, 'pembahasan', 'bahas', 'penjelasan', 'explanation')).replace(/\s+/g, ' ');
  if (!bahas) w.push('Soal ' + no + ': belum ada pembahasan. Siswa yang salah tidak mendapat penjelasan.');
  else if (bahas.length > BATAS.bahas) salah('pembahasan ' + bahas.length + ' huruf, maksimal ' + BATAS.bahas + '.');
  hasil.pembahasan = bahas;

  return { g, w, soal: g.length ? null : hasil };
}

function periksa(mentah) {
  const b = bacaJSON(mentah);
  if (!b.ok) return { ok: false, galat: [b.pesan], peringatan: [], soal: [] };
  const galat = [], peringatan = [], soal = [];
  const lihat = new Map();
  b.daftar.forEach((q, i) => {
    const r = periksaSoal(q, i);
    galat.push(...r.g); peringatan.push(...r.w);
    if (r.soal) {
      const kunciTeks = r.soal.teks.toLowerCase() + '|' + (r.soal.kode || '');
      if (lihat.has(kunciTeks)) peringatan.push('Soal ' + (i + 1) + ': teksnya sama dengan soal ' + lihat.get(kunciTeks) + '.');
      else lihat.set(kunciTeks, i + 1);
      soal.push(r.soal);
    }
  });
  if (b.diperbaiki) peringatan.unshift('Teks tempelan sedikit dirapikan otomatis (pagar kode, koma sisa, atau tanda kutip melengkung).');
  return { ok: galat.length === 0, galat, peringatan, soal, jumlahBaca: b.daftar.length };
}

/* ---------- penyimpanan ---------- */
function slug(n) {
  return String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
const idValid = (id) => typeof id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) && id.length <= 40;
const berkas = (id) => path.join(DIR, id + '.json');
function hitungJenis(soal) { return { pg: soal.filter(s => s.tipe === 'pg').length, isian: soal.filter(s => s.tipe === 'isian').length }; }

function daftar() {
  const hasil = [{ id: 'contoh', nama: 'Contoh bawaan (Informatika dasar)', jumlah: CONTOH.length, ...hitungJenis(CONTOH.map(c => ({ tipe: c.tipe }))), bawaan: true }];
  try {
    fs.mkdirSync(DIR, { recursive: true });
    for (const f of fs.readdirSync(DIR)) {
      if (!f.endsWith('.json')) continue;
      const id = f.slice(0, -5);
      if (!idValid(id)) continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
        if (!Array.isArray(d.soal)) continue;
        hasil.push({ id, nama: String(d.nama || id).slice(0, 60), jumlah: d.soal.length, ...hitungJenis(d.soal), diubah: d.diubah || 0 });
      } catch { /* berkas rusak dilewati */ }
    }
  } catch { /* folder belum ada */ }
  return hasil.sort((a, b) => (b.bawaan ? 1 : 0) - (a.bawaan ? 1 : 0) || (b.diubah || 0) - (a.diubah || 0));
}

function baca(id) {
  if (id === 'contoh') { const p = periksa(JSON.stringify(CONTOH)); return { id, nama: 'Contoh bawaan (Informatika dasar)', soal: p.soal, bawaan: true }; }
  if (!idValid(id)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(berkas(id), 'utf8'));
    const p = periksa(JSON.stringify(d.soal));
    if (!p.ok) return null;
    return { id, nama: String(d.nama || id), soal: p.soal };
  } catch { return null; }
}

function simpan(nama, soal) {
  const bersih = String(nama || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const id = slug(bersih);
  if (!id) return { ok: false, pesan: 'Beri nama bank soal, misalnya "Python dasar".' };
  if (id === 'contoh') return { ok: false, pesan: 'Nama "contoh" dipakai bank bawaan. Pilih nama lain.' };
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = berkas(id) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ nama: bersih, diubah: Date.now(), soal }, null, 1));
    fs.renameSync(tmp, berkas(id));
    return { ok: true, id };
  } catch (e) { return { ok: false, pesan: 'Gagal menyimpan: ' + e.message }; }
}

function hapus(id) {
  if (!idValid(id)) return false;
  try { fs.unlinkSync(berkas(id)); return true; } catch { return false; }
}

module.exports = { periksa, daftar, baca, simpan, hapus, WAKTU, BATAS, CONTOH };
