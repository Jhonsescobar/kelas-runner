'use strict';
/* Aturan permainan di sisi server: giliran soal, penilaian, skor, peringkat, podium, analisis.
   Kunci jawaban tidak pernah keluar dari file ini sebelum soal dijawab. */

const SELISIH_JAWAB_MS = 1500; // toleransi jaringan saat menilai batas waktu
const JARAK_GERBANG_MIN = 450; // jarak minimal antar soal, mencegah klien meminta soal berulang

const acak = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
const batas = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min; };

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function cekIsian(q, teks) {
  const n = norm(teks);
  if (!n) return false;
  if (n.split(' ').some(t => ['bukan', 'tidak', 'nggak', 'gak'].includes(t))) return false;
  return q.diterima.some(t => (' ' + n + ' ').includes(' ' + norm(t) + ' '));
}

/* Antrean soal acak per pemain: semua soal habis dulu sebelum ada yang berulang. */
class Antrean {
  constructor(soal, jenis) {
    let pool = soal.filter(s => jenis === 'acak' || s.tipe === jenis);
    if (!pool.length) pool = soal;
    this.pool = pool; this.urut = []; this.terakhir = null;
  }
  berikut() {
    if (!this.urut.length) {
      this.urut = acak(this.pool);
      if (this.urut.length > 1 && this.urut[this.urut.length - 1] === this.terakhir) this.urut.reverse();
    }
    this.terakhir = this.urut.pop();
    return this.terakhir;
  }
}

function pemainBaru(p, room) {
  p.antrean = new Antrean(room.soal, room.jenis);
  p.run = null; p.soalAktif = null; p.nSoal = 0; p.best = null; p.live = null;
  p.agg = { benar: 0, salah: 0, runs: 0, maxJarak: 0, maxKoin: 0 };
}

const totalRun = (r) => r.kuis + r.lw * 5 + r.kn * 10;
const lebihBaik = (a, b) => !b || a.total > b.total || (a.total === b.total && (a.strike < b.strike || (a.strike === b.strike && a.waktu < b.waktu)));

function mulaiLari(room, p, now) {
  if (room.status !== 'berjalan' || p.penonton || now >= room.berakhirAt) return false;
  finalisasi(room, p, now);
  p.run = { t0: now, d: 0, lw: 0, kn: 0, kuis: 0, benar: 0, salah: 0, strikes: 0, mati: false, selesai: false, dGerbang: 0, alasan: null };
  p.soalAktif = null;
  p.agg.runs++;
  p.live = { d: 0, h: 0, st: 0, dk: 0 };
  return true;
}

/* Laporan posisi dari HP. Angka dibatasi supaya klien nakal tidak bisa melompat jauh. */
function lapor(p, m, now) {
  const r = p.run;
  if (!r || r.selesai) return;
  const maksJarak = (now - r.t0) / 1000 * 330 + 300;
  r.d = Math.max(r.d, Math.min(maksJarak, batas(m.d, 0, 1e7)));
  r.lw = Math.max(r.lw, Math.min(Math.floor(r.d / 150) + 1, batas(m.lw, 0, 1e5)));
  r.kn = Math.max(r.kn, Math.min(r.lw * 3 + 3, batas(m.kn, 0, 1e5)));
  p.live = { d: Math.round(r.d), h: batas(m.h, 0, 90), st: batas(m.st, 0, 2), dk: m.dk ? 1 : 0 };
}

function finalisasi(room, p, now, akhir) {
  const r = p.run;
  if (!r || r.selesai) return;
  if (akhir && typeof akhir === 'object') lapor(p, akhir, now);
  r.selesai = true;
  const alasan = r.mati ? (akhir && (akhir.alasan === 'meteor' || akhir.alasan === 'lava') ? akhir.alasan : 'jatuh') : 'waktu';
  const rec = {
    total: totalRun(r), kuis: r.kuis, lari: r.lw * 5 + r.kn * 10, koin: r.kn, lewat: r.lw,
    benar: r.benar, salah: r.salah, strike: Math.min(2, r.strikes), jarak: Math.round(r.d / 16),
    waktu: Math.round((now - r.t0) / 1000), alasan,
  };
  if (lebihBaik(rec, p.best)) p.best = rec;
  p.agg.maxJarak = Math.max(p.agg.maxJarak, rec.jarak);
  p.agg.maxKoin = Math.max(p.agg.maxKoin, rec.koin);
  p.soalAktif = null;
  p.live = { d: Math.round(r.d), h: 0, st: 3, dk: 0 };
  p.runTerakhir = rec;
}

function paketSoal(a) {
  const s = a.soal;
  return { n: a.n, tipe: s.tipe, teks: s.teks, kode: s.kode || '', opsi: a.urut ? a.urut.map(i => s.opsi[i]) : undefined, waktu: s.waktu_detik };
}

function mintaSoal(room, p) {
  const r = p.run;
  if (!r || r.selesai || r.mati) return null;
  if (p.soalAktif) return p.soalAktif.t0 ? null : paketSoal(p.soalAktif); // kirim ulang bila HP belum sempat menampilkan
  if (r.d - r.dGerbang < JARAK_GERBANG_MIN) return null;
  r.dGerbang = r.d;
  const s = p.antrean.berikut();
  p.soalAktif = { n: ++p.nSoal, soal: s, t0: null, urut: s.tipe === 'pg' ? acak(s.opsi.map((_, i) => i)) : null };
  return paketSoal(p.soalAktif);
}

function mulaiHitung(p, n, now) {
  const a = p.soalAktif;
  if (a && a.n === n && !a.t0) a.t0 = now;
}

function catatStat(room, s, hasil, jawabanTeks) {
  const kunci = s.tipe + '|' + s.teks + '|' + (s.kode || '');
  let st = room.stat.get(kunci);
  if (!st) { st = { teks: s.teks, kode: s.kode || '', tipe: s.tipe, contoh: s.tipe === 'pg' ? s.opsi[s.kunci] : s.contoh, tampil: 0, benar: 0, salah: 0, habis: 0, jawaban: [] }; room.stat.set(kunci, st); }
  st.tampil++;
  if (hasil === 'benar') st.benar++;
  else if (hasil === 'habis') st.habis++;
  else st.salah++;
  if (s.tipe === 'isian' && hasil === 'salah' && jawabanTeks && st.jawaban.length < 12 && !st.jawaban.includes(jawabanTeks)) st.jawaban.push(jawabanTeks);
}

function jawab(room, p, n, jaw, now) {
  const a = p.soalAktif, r = p.run;
  if (!a || !r || a.n !== n) return null;
  p.soalAktif = null;
  const s = a.soal, lamaMaks = s.waktu_detik * 1000;
  const el = a.t0 ? now - a.t0 : Infinity;
  let ok = false, habis = !a.t0 || el > lamaMaks + SELISIH_JAWAB_MS || jaw === null || jaw === undefined;
  let teks = '';
  if (!habis) {
    if (s.tipe === 'pg') { const i = Number.isInteger(jaw) ? jaw : -1; ok = i >= 0 && i < a.urut.length && a.urut[i] === s.kunci; if (i < 0 || i >= a.urut.length) habis = true; }
    else if (typeof jaw === 'string') { teks = jaw.trim().slice(0, 60); ok = cekIsian(s, teks); }
    else habis = true;
  }
  const frac = Math.max(0, 1 - Math.min(el, lamaMaks) / lamaMaks);
  const poin = ok ? Math.round(70 + 30 * frac) : 0;
  if (ok) { r.kuis += poin; r.benar++; p.agg.benar++; }
  else { r.salah++; r.strikes++; p.agg.salah++; if (r.strikes >= 2) { r.mati = true; p.live = { d: Math.round(r.d), h: 0, st: 3, dk: 0 }; } }
  catatStat(room, s, ok ? 'benar' : habis ? 'habis' : 'salah', teks);
  return { n, benar: ok, habis: habis && !ok, jawabBenar: s.tipe === 'pg' ? s.opsi[s.kunci] : s.contoh, bahas: s.pembahasan || '', poin, strikes: r.strikes, mati: r.mati, kuis: r.kuis };
}

/* ---------- tampilan langsung ---------- */
function skorLangsung(p) {
  const cur = p.run && !p.run.selesai ? totalRun(p.run) : 0;
  return Math.max(cur, p.best ? p.best.total : 0);
}
function statusKode(p) {
  if (!p.online) return 5;
  if (!p.run) return 4;
  if (p.run.selesai || p.run.mati) return 3;
  return p.live ? p.live.st : 0;
}
function pemainAktif(room) { return [...room.pemain.values()].filter(p => !p.penonton); }

/* Satu baris per pemain: [id, jarak, tinggi, status, merunduk, nyawaTerpakai, skor, adaRunAktif] */
function barisLomba(room) {
  return pemainAktif(room).map(p => {
    const l = p.live || { d: 0, h: 0, dk: 0 };
    return [p.id, l.d, l.h, statusKode(p), l.dk, p.run ? Math.min(2, p.run.strikes) : 0, skorLangsung(p), p.run && !p.run.selesai ? 1 : 0];
  });
}
function peringkatLangsung(baris) { return baris.slice().sort((a, b) => b[6] - a[6]); }

/* ---------- hasil akhir ---------- */
function urutPemain(room) {
  const nol = { total: 0, kuis: 0, lari: 0, koin: 0, lewat: 0, benar: 0, salah: 0, strike: 0, jarak: 0, waktu: 0, alasan: '-' };
  return pemainAktif(room).map(p => {
    const b = p.best || nol;
    const jawab = p.agg.benar + p.agg.salah;
    return { id: p.id, nama: p.nama, avatar: p.avatar, ...b, percobaan: p.agg.runs, akurasi: jawab ? Math.round(p.agg.benar / jawab * 100) : 0, dijawab: jawab, jarakTerjauh: p.agg.maxJarak, koinTerbanyak: p.agg.maxKoin, ikut: !!p.best };
  }).sort((a, b) => b.total - a.total || a.strike - b.strike || (a.waktu || 1e9) - (b.waktu || 1e9) || a.nama.localeCompare(b.nama));
}

function buatHasil(room) {
  const urut = urutPemain(room);
  const ikut = urut.filter(u => u.ikut);
  const penghargaan = [];
  const jauh = ikut.slice().sort((a, b) => b.jarakTerjauh - a.jarakTerjauh)[0];
  if (jauh && jauh.jarakTerjauh > 0) penghargaan.push({ judul: 'Pelari Terjauh', id: jauh.id, nama: jauh.nama, nilai: jauh.jarakTerjauh + ' m' });
  const tajam = ikut.filter(u => u.dijawab >= 5).sort((a, b) => b.akurasi - a.akurasi || b.dijawab - a.dijawab)[0];
  if (tajam) penghargaan.push({ judul: 'Otak Tajam', id: tajam.id, nama: tajam.nama, nilai: tajam.akurasi + '% benar' });
  const koin = ikut.slice().sort((a, b) => b.koinTerbanyak - a.koinTerbanyak)[0];
  if (koin && koin.koinTerbanyak > 0) penghargaan.push({ judul: 'Pengumpul Koin', id: koin.id, nama: koin.nama, nilai: koin.koinTerbanyak + ' koin' });

  const soal = [...room.stat.values()].map(s => ({ ...s, persenSalah: s.tampil ? Math.round((s.salah + s.habis) / s.tampil * 100) : 0 }));
  const sulit = soal.filter(s => s.tampil >= 2).sort((a, b) => b.persenSalah - a.persenSalah || b.tampil - a.tampil).slice(0, 6)
    .map(s => ({ teks: s.teks, kode: s.kode, tampil: s.tampil, benar: s.benar, salah: s.salah, habis: s.habis, persenSalah: s.persenSalah, contoh: s.contoh }));
  const isianCek = soal.filter(s => s.tipe === 'isian' && s.jawaban.length).slice(0, 8)
    .map(s => ({ teks: s.teks, contoh: s.contoh, jawaban: s.jawaban }));
  const totalJawab = soal.reduce((n, s) => n + s.tampil, 0), totalBenar = soal.reduce((n, s) => n + s.benar, 0);
  return {
    urut, penghargaan,
    analisis: { sulit, isianCek, totalJawab, persenBenar: totalJawab ? Math.round(totalBenar / totalJawab * 100) : 0 },
    ringkas: { pemain: urut.length, ikut: ikut.length, rata: ikut.length ? Math.round(ikut.reduce((n, u) => n + u.total, 0) / ikut.length) : 0 },
  };
}

module.exports = { Antrean, pemainBaru, mulaiLari, lapor, finalisasi, mintaSoal, mulaiHitung, jawab, barisLomba, peringkatLangsung, buatHasil, pemainAktif, cekIsian, norm, totalRun };
