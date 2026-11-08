'use strict';
/* Server Kelas Runner: berjalan di laptop guru. Melayani halaman statis dan satu WebSocket di /ws. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const { Rooms } = require('./rooms');
const G = require('./game');
const Bank = require('./bank');

const PORT = Number(process.env.KR_PORT) || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const DIR_SESI = path.join(__dirname, '..', 'data', 'sesi');
const PIN = process.env.KR_PIN || String(crypto.randomInt(1000, 10000));

const rooms = new Rooms();
const koneksi = new Set();
const tokenGuru = new Set();
const gagalPin = new Map(); // ip -> { n, sampai }
const percobaanJoin = new Map(); // ip -> [waktu]

/* Mode online: cloudflared membuat alamat https publik yang meneruskan ke server ini (tanpa akun). */
let publik = process.env.KR_PUBLIK || '';
function mulaiTerowongan() {
  const lokal = path.join(__dirname, '..', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  const exe = fs.existsSync(lokal) ? lokal : 'cloudflared';
  let p;
  try { p = spawn(exe, ['tunnel', '--url', 'http://localhost:' + PORT, '--no-autoupdate'], { windowsHide: true }); }
  catch (e) { console.log('  Mode online gagal dimulai: ' + e.message); return; }
  p.on('error', () => console.log('  cloudflared tidak ditemukan. Jalankan online.bat agar diunduh otomatis.'));
  const baca = (d) => {
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(d));
    if (m && m[0] !== publik) {
      publik = m[0];
      console.log('\n  ALAMAT ONLINE  : ' + publik + '\n  Di dashboard, pilih "Online (Cloudflare)" sebelum BUAT ROOM.\n');
      for (const ws of koneksi) if (ws.ctx && ws.ctx.role === 'guru') kirim(ws, { t: 'hosts', hosts: alamatLaptop() });
    }
  };
  p.stdout.on('data', baca); p.stderr.on('data', baca);
  process.on('exit', () => { try { p.kill(); } catch (e) { /* abaikan */ } });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const HEADER_AMAN = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

/* ---------- alamat laptop di jaringan ---------- */
function skorIp(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  return 3;
}
function alamatLaptop() {
  const hasil = [];
  for (const [nama, daftar] of Object.entries(os.networkInterfaces())) {
    for (const i of daftar || []) if (i.family === 'IPv4' && !i.internal) hasil.push({ nama, ip: i.address });
  }
  hasil.sort((a, b) => skorIp(a.ip) - skorIp(b.ip));
  if (publik) hasil.unshift({ nama: 'Online (Cloudflare)', ip: 'publik' });
  return hasil;
}

/* ---------- HTTP statis ---------- */
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, HEADER_AMAN); return res.end('Metode tidak diizinkan'); }
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400, HEADER_AMAN); return res.end('Permintaan tidak valid'); }
  if (p === '/') p = '/join/';
  if (p === '/guru' || p === '/layar' || p === '/join') p += '/';
  if (p.endsWith('/')) p += 'index.html';
  const berkas = path.normalize(path.join(PUBLIC, p));
  if (!berkas.startsWith(PUBLIC + path.sep) || path.basename(berkas).startsWith('.')) { res.writeHead(403, HEADER_AMAN); return res.end('Dilarang'); }
  fs.readFile(berkas, (err, isi) => {
    if (err) { res.writeHead(404, HEADER_AMAN); return res.end('Tidak ditemukan'); }
    res.writeHead(200, { ...HEADER_AMAN, 'Content-Type': MIME[path.extname(berkas)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : isi);
  });
});

/* ---------- WebSocket ---------- */
const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 256 * 1024,
  verifyClient: ({ origin, req }) => { // tolak halaman dari situs lain yang mencoba menyambung
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
  },
});

const kirim = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
function sebar() {
  const state = rooms.publik();
  const terakhir = state ? null : rooms.terakhir;
  for (const ws of koneksi) {
    const c = ws.ctx;
    if (c.role === 'guru' || c.role === 'layar') kirim(ws, { t: 'state', state, terakhir });
    else if (c.role === 'siswa' && state && c.kode === state.kode) kirim(ws, { t: 'state', state, kamu: c.pid });
  }
}
function putusSiswa(kodeRoom, pesanTipe, alasan) {
  for (const ws of koneksi) {
    if (ws.ctx.role === 'siswa' && ws.ctx.kode === kodeRoom) { kirim(ws, { t: pesanTipe, alasan }); ws.close(1000); }
  }
}
function samaAman(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function boleh(ip) { // batasi percobaan join per IP: 40 per menit
  const sekarang = Date.now();
  const daftar = (percobaanJoin.get(ip) || []).filter(t => sekarang - t < 60000);
  daftar.push(sekarang);
  percobaanJoin.set(ip, daftar);
  return daftar.length <= 40;
}

function hello(ws, m) {
  const c = ws.ctx;
  if (m.role === 'layar') { c.role = 'layar'; kirim(ws, { t: 'layar:ok' }); kirim(ws, { t: 'state', state: rooms.publik(), terakhir: rooms.publik() ? null : rooms.terakhir }); return; }

  if (m.role === 'guru') {
    const sekarang = Date.now();
    let g = gagalPin.get(c.ip);
    if (g && g.sampai && g.sampai <= sekarang) { gagalPin.delete(c.ip); g = null; }
    if (g && g.sampai > sekarang) return kirim(ws, { t: 'err', kode: 'terkunci', pesan: 'Terlalu banyak salah PIN. Tunggu 1 menit.' });
    if (typeof m.token === 'string' && !m.pin && !tokenGuru.has(m.token)) return kirim(ws, { t: 'err', kode: 'sesi', pesan: 'Sesi berakhir. Masukkan PIN lagi.' });
    const ok = (typeof m.token === 'string' && tokenGuru.has(m.token)) || (typeof m.pin === 'string' && samaAman(m.pin, PIN));
    if (!ok) {
      const n = ((g && g.n) || 0) + 1;
      gagalPin.set(c.ip, { n, sampai: n >= 5 ? sekarang + 60000 : 0 });
      return kirim(ws, { t: 'err', kode: 'pin', pesan: n >= 5 ? 'Terlalu banyak salah PIN. Tunggu 1 menit.' : 'PIN salah.' });
    }
    gagalPin.delete(c.ip);
    let token = m.token;
    if (!tokenGuru.has(token)) { token = crypto.randomBytes(16).toString('hex'); tokenGuru.add(token); }
    c.role = 'guru';
    kirim(ws, { t: 'guru:ok', token, hosts: alamatLaptop(), port: PORT, bank: Bank.daftar() });
    kirim(ws, { t: 'state', state: rooms.publik(), terakhir: rooms.publik() ? null : rooms.terakhir });
    return;
  }

  if (m.role === 'siswa') {
    if (!boleh(c.ip)) return kirim(ws, { t: 'err', kode: 'limit', pesan: 'Terlalu banyak percobaan. Tunggu sebentar.' });
    const r = typeof m.token === 'string' ? rooms.sambungUlang(m.kode, m.token) : rooms.gabung(m.kode, m.nama, m.avatar);
    if (!r.ok) return kirim(ws, { t: 'err', kode: r.kode, pesan: r.pesan });
    const p = r.pemain;
    if (p.ws && p.ws !== ws) { try { p.ws.close(1000); } catch { /* sudah tertutup */ } }
    p.ws = ws; p.online = true;
    c.role = 'siswa'; c.kode = rooms.room.kode; c.pid = p.id;
    kirim(ws, { t: 'siswa:ok', id: p.id, token: p.token, nama: p.nama, penonton: p.penonton, sekarang: Date.now() });
    return sebar();
  }
}

function kirimBank(ws) { kirim(ws, { t: 'bank:daftar', bank: Bank.daftar() }); }

function pesanGuru(ws, m) {
  switch (m.t) {
    case 'room:buat': {
      const daftar = alamatLaptop();
      const host = daftar.some(a => a.ip === m.host) ? m.host : (daftar[0] ? daftar[0].ip : 'localhost');
      const urlBase = host === 'publik' ? publik : 'http://' + host + ':' + PORT;
      const bank = Bank.baca(typeof m.bank === 'string' ? m.bank : 'contoh');
      if (!bank || !bank.soal.length) return kirim(ws, { t: 'err', kode: 'bank', pesan: 'Bank soal tidak ditemukan. Pilih bank soal lain.' });
      const jenis = ['acak', 'pg', 'isian'].includes(m.jenis) ? m.jenis : 'acak';
      if (jenis !== 'acak' && !bank.soal.some(s => s.tipe === jenis)) return kirim(ws, { t: 'err', kode: 'bank', pesan: 'Bank ini tidak punya soal ' + (jenis === 'pg' ? 'pilihan ganda' : 'isian') + '. Pilih jenis "Acak" atau bank lain.' });
      const lama = rooms.tutup();
      if (lama) putusSiswa(lama.kode, 'tutup', 'Room ditutup guru.');
      rooms.buat({ kapasitas: m.kapasitas, durasiMenit: m.durasiMenit, jenis, tema: m.tema, soal: bank.soal, bankNama: bank.nama, urlBase });
      return sebar();
    }
    case 'room:mulai': if (rooms.mulai()) sebar(); else kirim(ws, { t: 'err', kode: 'mulai', pesan: 'Belum ada pemain di lobby.' }); return;
    case 'room:akhiri': { const r = rooms.akhiri(); if (r) { simpanSesi(r); sebar(); } return; }
    case 'room:tutup': { const lama = rooms.tutup(); if (lama && lama.status !== 'selesai') putusSiswa(lama.kode, 'tutup', 'Room ditutup guru.'); return sebar(); } // sesi selesai: HP siswa tetap menampilkan podium
    case 'pemain:keluarkan': {
      const p = rooms.keluarkan(m.id);
      if (p && p.ws) { kirim(p.ws, { t: 'keluar', alasan: 'Kamu dikeluarkan oleh guru.' }); p.ws.close(1000); }
      return sebar();
    }
    case 'bank:daftar': return kirimBank(ws);
    case 'bank:periksa': {
      const r = Bank.periksa(m.teks);
      return kirim(ws, { t: 'bank:hasil', ok: r.ok, galat: r.galat.slice(0, 30), peringatan: r.peringatan.slice(0, 20), soal: r.ok ? r.soal : [], jumlahBaca: r.jumlahBaca || 0 });
    }
    case 'bank:simpan': {
      const r = Bank.periksa(m.teks);
      if (!r.ok) return kirim(ws, { t: 'bank:hasil', ok: false, galat: r.galat.slice(0, 30), peringatan: [], soal: [], jumlahBaca: 0 });
      const s = Bank.simpan(m.nama, r.soal);
      if (!s.ok) return kirim(ws, { t: 'err', kode: 'bank', pesan: s.pesan });
      kirim(ws, { t: 'bank:tersimpan', id: s.id, jumlah: r.soal.length });
      return kirimBank(ws);
    }
    case 'bank:baca': {
      const b = Bank.baca(m.id);
      return b ? kirim(ws, { t: 'bank:isi', id: b.id, nama: b.nama, bawaan: !!b.bawaan, teks: JSON.stringify(b.soal.map(({ tipe, teks, kode, opsi, kunci, diterima, contoh, waktu_detik, pembahasan }) => {
        const o = { tipe, teks }; if (kode) o.kode = kode;
        if (tipe === 'pg') { o.opsi = opsi; o.kunci = kunci; } else { o.diterima = diterima; o.contoh = contoh; }
        o.waktu_detik = waktu_detik; o.pembahasan = pembahasan; return o;
      }), null, 1) }) : kirim(ws, { t: 'err', kode: 'bank', pesan: 'Bank tidak ditemukan.' });
    }
    case 'bank:hapus': Bank.hapus(m.id); return kirimBank(ws);
  }
}

/* ---------- pesan dari HP siswa saat sesi berjalan ---------- */
function pesanSiswa(ws, m) {
  const room = rooms.room, c = ws.ctx;
  if (!room || room.kode !== c.kode) return;
  const p = room.pemain.get(c.pid);
  if (!p || p.penonton || room.status !== 'berjalan') return;
  const now = Date.now();
  switch (m.t) {
    case 'lari:mulai': if (G.mulaiLari(room, p, now)) kirim(ws, { t: 'lari:ok', berakhirAt: room.berakhirAt }); return;
    case 'pos': G.lapor(p, m, now); return;
    case 'lari:akhir': G.finalisasi(room, p, now, m); return;
    case 'q:minta': { const paket = G.mintaSoal(room, p); if (paket) kirim(ws, { t: 'q', ...paket }); return; }
    case 'q:mulai': G.mulaiHitung(p, m.n, now); return;
    case 'q:jawab': { const h = G.jawab(room, p, m.n, m.p, now); if (h) kirim(ws, { t: 'q:hasil', ...h }); return; }
  }
}

function simpanSesi(room) {
  try {
    fs.mkdirSync(DIR_SESI, { recursive: true });
    const d = new Date(room.mulaiAt || Date.now()), dua = n => String(n).padStart(2, '0');
    const nama = d.getFullYear() + dua(d.getMonth() + 1) + dua(d.getDate()) + '-' + dua(d.getHours()) + dua(d.getMinutes()) + '-' + room.kode + '.json';
    const isi = { kode: room.kode, mulai: room.mulaiAt, tema: room.tema, bank: room.bankNama, durasiMenit: room.durasiMenit, jenis: room.jenis, hasil: room.hasil };
    fs.writeFileSync(path.join(DIR_SESI, nama), JSON.stringify(isi, null, 1));
  } catch (e) { console.error('  Gagal menyimpan sesi:', e.message); }
}

/* Denyut permainan: siaran posisi ke layar kelas dan HP, serta pemeriksa batas waktu sesi. */
let tik = 0;
setInterval(() => {
  const room = rooms.room;
  if (!room || room.status !== 'berjalan') return;
  const now = Date.now();
  if (now >= room.berakhirAt) { const r = rooms.akhiri(); if (r) { simpanSesi(r); sebar(); } return; }
  tik++;
  const baris = G.barisLomba(room);
  const urut = G.peringkatLangsung(baris);
  const sisa = Math.max(0, Math.round((room.berakhirAt - now) / 1000));
  const posisi = new Map(urut.map((b, i) => [b[0], i + 1]));
  for (const ws of koneksi) {
    const c = ws.ctx;
    if (c.role === 'layar') kirim(ws, { t: 'lomba', sisa, s: baris });
    else if (c.role === 'guru' && tik % 5 === 0) kirim(ws, { t: 'lomba', sisa, s: baris });
    else if (c.role === 'siswa' && c.kode === room.kode && tik % 2 === 0) {
      const aku = baris.find(b => b[0] === c.pid);
      const ghost = aku ? baris.filter(b => b[0] !== c.pid && b[7] && Math.abs(b[1] - aku[1]) < 380).sort((a, b) => Math.abs(a[1] - aku[1]) - Math.abs(b[1] - aku[1])).slice(0, 6).map(b => [b[0], b[1], b[2], b[4]]) : [];
      const top = urut.slice(0, 3).map(b => [b[0], b[6]]);
      kirim(ws, { t: 'lomba', sisa, peringkat: posisi.get(c.pid) || 0, dari: baris.length, g: ghost, top });
    }
  }
}, 200).unref();

wss.on('connection', (ws, req) => {
  const asal = req.socket.remoteAddress || '?';
  const lewatTerowongan = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(asal) && req.headers['cf-connecting-ip'];
  ws.ctx = { role: null, ip: lewatTerowongan ? String(req.headers['cf-connecting-ip']) : asal };
  ws.hidup = true;
  ws.kuota = 40;
  koneksi.add(ws);
  ws.on('pong', () => { ws.hidup = true; });
  ws.on('message', raw => {
    if (--ws.kuota < 0) return ws.close(1008, 'Terlalu cepat'); // 20 pesan per detik rata-rata
    if (ws.ctx.role !== 'guru' && raw.length > 2048) return; // hanya guru boleh kirim pesan besar (bank soal)
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (m.t === 'hello') return hello(ws, m);
    if (ws.ctx.role === 'guru') pesanGuru(ws, m);
    else if (ws.ctx.role === 'siswa') pesanSiswa(ws, m);
  });
  ws.on('close', () => {
    koneksi.delete(ws);
    const c = ws.ctx;
    if (c.role === 'siswa' && rooms.room) {
      const p = rooms.room.pemain.get(c.pid);
      if (p && p.ws === ws) { p.online = false; p.ws = null; sebar(); }
    }
  });
  ws.on('error', () => {});
});

setInterval(() => { // deteksi HP yang tertidur atau terputus
  for (const ws of koneksi) { if (!ws.hidup) { ws.terminate(); continue; } ws.hidup = false; try { ws.ping(); } catch { /* abaikan */ } }
}, 20000).unref();
setInterval(() => { for (const ws of koneksi) ws.kuota = Math.min(40, ws.kuota + 20); }, 1000).unref();
setInterval(() => { const t = Date.now(); for (const [ip, d] of percobaanJoin) if (!d.some(x => t - x < 60000)) percobaanJoin.delete(ip); }, 60000).unref();

server.listen(PORT, '0.0.0.0', () => {
  const alamat = alamatLaptop();
  console.log('\n  KELAS RUNNER berjalan\n');
  console.log('  Dashboard guru : http://localhost:' + PORT + '/guru');
  console.log('  PIN guru       : ' + PIN);
  console.log('  Layar kelas    : http://localhost:' + PORT + '/layar');
  console.log('  Alamat laptop  : ' + (alamat.length ? alamat.map(a => a.ip + ' (' + a.nama + ')').join(', ') : 'tidak terdeteksi, sambungkan ke WiFi atau hotspot'));
  if (process.env.KR_ONLINE) { console.log('  Mode online    : membuat alamat publik, tunggu beberapa detik...'); mulaiTerowongan(); }
  console.log('\n  Biarkan jendela ini terbuka selama sesi. Tutup jendela untuk menghentikan server.\n');
  if (!process.env.KR_NO_OPEN) {
    const url = 'http://localhost:' + PORT + '/guru';
    const perintah = process.platform === 'win32' ? 'start "" "' + url + '"' : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
    exec(perintah, () => {});
  }
});
server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? '\n  Port ' + PORT + ' sudah dipakai. Tutup jendela server lama, atau jalankan dengan KR_PORT=3001.\n' : e);
  process.exit(1);
});
