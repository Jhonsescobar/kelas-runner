'use strict';
/* Logika room: pemain, kapasitas, validasi. Tidak tahu apa-apa soal jaringan. */
const crypto = require('crypto');
const G = require('./game');

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa O/0 dan I/1 yang mudah tertukar
const EXPR = ['senang', 'datar', 'semangat', 'kaget'];
const HAT = ['none', 'topi', 'helm', 'antena'];
const JENIS = ['acak', 'pg', 'isian'];
const TEMA = ['space', 'lava'];
const KASAR_SUB = ['anjing', 'bangsat', 'kontol', 'memek', 'goblok', 'tolol'];
const KASAR_UTUH = ['asu', 'babi', 'bego']; // kata pendek hanya ditolak bila berdiri sendiri (agar "Basuki" aman)

const id = n => crypto.randomBytes(n).toString('hex');
function kodeBaru() { let s = ''; for (let i = 0; i < 6; i++) s += ALPHA[crypto.randomInt(ALPHA.length)]; return s; }
const rapikanKode = k => (typeof k === 'string' ? k.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '');

function bersihNama(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}
function namaKasar(n) {
  const rendah = n.toLowerCase();
  const flat = rendah.replace(/[^a-z]/g, '');
  if (KASAR_SUB.some(k => flat.includes(k))) return true;
  return rendah.split(/[^a-z]+/).some(t => KASAR_UTUH.includes(t));
}
function avatarValid(a) {
  if (!a || typeof a !== 'object') return null;
  const idx = (v, max) => Number.isInteger(v) && v >= 0 && v < max;
  if (!idx(a.skin, 6) || !idx(a.shirt, 6) || !EXPR.includes(a.expr) || !HAT.includes(a.hat)) return null;
  return { skin: a.skin, shirt: a.shirt, expr: a.expr, hat: a.hat };
}
function intDalam(v, min, max, def) {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : def;
}

class Rooms {
  constructor() { this.room = null; this.terakhir = null; }

  buat({ kapasitas, durasiMenit, jenis, tema, soal, bankNama, urlBase }) {
    this.terakhir = null;
    this.room = {
      kode: kodeBaru(),
      seed: crypto.randomInt(1, 2147483647),
      kapasitas: intDalam(kapasitas, 1, 40, 10),
      durasiMenit: [2, 5, 7].includes(Number(durasiMenit)) ? Number(durasiMenit) : 7,
      jenis: JENIS.includes(jenis) ? jenis : 'acak',
      tema: TEMA.includes(tema) ? tema : 'space',
      soal, bankNama: bankNama || '',
      urlBase,
      status: 'lobby',
      pemain: new Map(),
      stat: new Map(),
      hasil: null,
      dibuat: Date.now(),
      mulaiAt: null,
      berakhirAt: null,
    };
    return this.room;
  }

  tutup() { const r = this.room; this.room = null; return r; }

  namaUnik(room, dasar) {
    const ada = n => [...room.pemain.values()].some(p => p.nama.toLowerCase() === n.toLowerCase());
    if (!ada(dasar)) return dasar;
    for (let i = 2; i < 100; i++) {
      const sufiks = ' ' + i;
      const n = dasar.slice(0, 12 - sufiks.length) + sufiks;
      if (!ada(n)) return n;
    }
    return dasar.slice(0, 8) + ' ' + id(1);
  }

  gabung(kode, namaMentah, avatarMentah) {
    const room = this.room;
    if (!room || rapikanKode(kode) !== room.kode) return { ok: false, kode: 'kode', pesan: 'Kode room tidak ditemukan. Periksa lagi atau scan ulang QR.' };
    const nama = bersihNama(namaMentah);
    if (nama.length < 2) return { ok: false, kode: 'nama', pesan: 'Isi nama panggilan, minimal 2 huruf.' };
    if (namaKasar(nama)) return { ok: false, kode: 'nama', pesan: 'Nama itu tidak bisa dipakai. Coba nama lain.' };
    const avatar = avatarValid(avatarMentah);
    if (!avatar) return { ok: false, kode: 'avatar', pesan: 'Tampilan karakter tidak valid.' };
    const penonton = room.status !== 'lobby';
    if (!penonton && [...room.pemain.values()].filter(p => !p.penonton).length >= room.kapasitas) {
      return { ok: false, kode: 'penuh', pesan: 'Room sudah penuh (' + room.kapasitas + ' pemain).' };
    }
    const pemain = { id: id(4), token: id(16), nama: this.namaUnik(room, nama), avatar, online: true, penonton, ws: null, masuk: Date.now() };
    G.pemainBaru(pemain, room);
    room.pemain.set(pemain.id, pemain);
    return { ok: true, pemain };
  }

  sambungUlang(kode, token) {
    const room = this.room;
    if (!room || rapikanKode(kode) !== room.kode) return { ok: false, kode: 'kode', pesan: 'Sesi sebelumnya sudah berakhir.' };
    if (typeof token !== 'string') return { ok: false, kode: 'token', pesan: 'Sesi sebelumnya sudah berakhir.' };
    for (const p of room.pemain.values()) {
      if (p.token.length === token.length && crypto.timingSafeEqual(Buffer.from(p.token), Buffer.from(token))) return { ok: true, pemain: p };
    }
    return { ok: false, kode: 'token', pesan: 'Kamu sudah dikeluarkan dari room ini.' };
  }

  keluarkan(pid) {
    const room = this.room;
    if (!room) return null;
    const p = room.pemain.get(pid);
    if (p) room.pemain.delete(pid);
    return p || null;
  }

  mulai() {
    const room = this.room;
    if (!room || room.status !== 'lobby') return false;
    if ([...room.pemain.values()].filter(p => !p.penonton).length < 1) return false;
    room.status = 'berjalan';
    room.mulaiAt = Date.now();
    room.berakhirAt = room.mulaiAt + (Number(process.env.KR_DETIK) || room.durasiMenit * 60) * 1000; // KR_DETIK hanya untuk pengujian
    return true;
  }

  /* Mengakhiri sesi: nilai akhir dikunci dan podium disimpan sampai room baru dibuat atau server dimatikan. */
  akhiri() {
    const room = this.room;
    if (!room || room.status !== 'berjalan') return null;
    const now = Date.now();
    for (const p of room.pemain.values()) G.finalisasi(room, p, now);
    room.status = 'selesai';
    room.hasil = G.buatHasil(room);
    this.terakhir = this.ringkasTerakhir(room);
    return room;
  }

  ringkasTerakhir(room) {
    return { kode: room.kode, tema: room.tema, bankNama: room.bankNama, durasiMenit: room.durasiMenit, jenis: room.jenis, selesaiAt: Date.now(), hasil: room.hasil };
  }

  /* Data yang aman dikirim ke semua klien: tanpa token dan tanpa soket. */
  publik() {
    const r = this.room;
    if (!r) return null;
    return {
      kode: r.kode,
      status: r.status,
      kapasitas: r.kapasitas,
      durasiMenit: r.durasiMenit,
      jenis: r.jenis,
      tema: r.tema,
      seed: r.seed,
      bankNama: r.bankNama,
      jumlahSoal: r.soal.length,
      mulaiAt: r.mulaiAt,
      berakhirAt: r.berakhirAt,
      hasil: r.hasil,
      urlJoin: r.urlBase + '/join?r=' + r.kode,
      pemain: [...r.pemain.values()].map(p => ({ id: p.id, nama: p.nama, avatar: p.avatar, online: p.online, penonton: p.penonton })),
    };
  }
}

module.exports = { Rooms, TEMA, JENIS, bersihNama, namaKasar, avatarValid, rapikanKode };
