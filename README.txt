KELAS RUNNER
============

Game lari edukatif untuk satu kelas. Siswa berlari, melompat, dan merunduk di HP
(landscape). Tiap 3 rintangan ada gerbang kuis. Salah dua kali, karakter jatuh.
Layar kelas (IFP) menampilkan lintasan semua siswa, papan skor langsung, dan
podium di akhir. Semua jalan di laptop guru, tanpa internet.

CARA MENJALANKAN
1. Pasang Node.js versi LTS dari https://nodejs.org (cukup sekali).
2. Klik dua kali  mulai.bat  (Windows) atau jalankan  ./mulai.sh  (Mac/Linux).
   Jendela hitam harus tetap terbuka selama sesi.
3. Jika Windows menanyakan akses firewall, pilih "Allow" untuk jaringan pribadi.
4. Browser membuka dashboard guru. Masukkan PIN yang tampil di jendela hitam.

ALUR SATU SESI
1. Tab "Bank soal": siapkan soal (lihat bagian di bawah). Bank "Contoh bawaan"
   sudah ada untuk mencoba.
2. Tab "Sesi": atur jumlah pemain (1 sampai 40), durasi (2/5/7 menit), tema
   (Space atau Lava), jenis soal, dan bank soal, lalu BUAT ROOM.
3. Klik "Buka layar kelas", tampilkan di IFP. QR dan karakter siswa muncul di sana.
4. Siswa scan QR, isi nama, atur karakter, MASUK. HP diputar landscape.
5. Klik MULAI SESI. Siswa menekan LARI! untuk mulai berlari.
6. Sesi berakhir otomatis saat waktu habis (atau klik AKHIRI SEKARANG).
   Podium tampil di layar kelas dan HP siswa. Dashboard guru menampilkan analisis
   soal dan tombol Unduh CSV.
7. Podium tetap tampil sampai guru membuat room baru atau server dimatikan.
   Hasil tiap sesi juga tersimpan sebagai berkas di folder data/sesi.

ATURAN PERMAINAN
- Kontrol HP: layar kanan = lompat (tahan = lebih tinggi), layar kiri = merunduk.
  Laptop: Spasi atau panah atas = lompat, panah bawah = merunduk.
- Menabrak rintangan hanya memperlambat (tidak fatal, tidak mengurangi poin).
- Gerbang kuis: pilihan ganda 7 detik, isian 15 detik (soal berkode 12 dan 20
  detik). Waktu mulai dihitung setelah pilihan jawaban muncul. Waktu habis
  dihitung salah.
- Salah pertama: karakter retak dan melambat sebentar. Salah kedua: jatuh.
- Setelah jatuh siswa boleh langsung main lagi dari awal. Nilai sesi = lari
  terbaik, sampai waktu sesi habis.
- Poin: benar = 70 + sampai 30 poin bonus kecepatan (maks 100 per soal),
  +5 per rintangan yang dilewati bersih, +10 per koin.
- Peringkat: skor tertinggi, lalu nyawa terpakai paling sedikit, lalu waktu tercepat.
- Penghargaan di podium: Pelari Terjauh, Otak Tajam (minimal 5 jawaban), Pengumpul Koin.
- Siswa yang masuk setelah sesi dimulai menjadi penonton dan tidak masuk peringkat.
- Jawaban dinilai di server. Kunci jawaban tidak pernah dikirim ke HP sebelum soal dijawab.

MEMBUAT SOAL DENGAN AI (tab Bank soal)
1. Buka "1. Minta AI membuatkan soal", isi topik, jenjang, jumlah. Klik "Salin prompt".
2. Tempel ke ChatGPT, Gemini, atau Claude. Salin jawabannya.
3. Tempel ke kotak "2. Tempel soal", klik PERIKSA. Kesalahan ditunjukkan per nomor
   soal. Pagar kode ```, koma sisa, dan tanda kutip melengkung dirapikan otomatis.
4. Hapus soal yang tidak cocok lewat pratinjau, beri nama, klik SIMPAN BANK.
   Untuk mengubah isi, klik "Ubah" pada bank tersimpan, edit teksnya, PERIKSA, SIMPAN.

Format satu soal:
  Pilihan ganda:
    {"tipe":"pg","teks":"...","opsi":["...","...","...","..."],"kunci":1,"pembahasan":"..."}
    kunci = nomor jawaban benar mulai dari 0.
  Isian singkat:
    {"tipe":"isian","teks":"...","diterima":["print","print()"],"contoh":"print","pembahasan":"..."}
    "diterima" = semua penulisan yang dianggap benar. Huruf besar/kecil dan aksen
    diabaikan. Jawaban yang memuat kata "bukan/tidak" dianggap salah.
  Soal dengan potongan kode (tampil di samping soal, huruf monospace):
    tambahkan "kode":"x = 5\nprint(x)"  (maks 10 baris, 46 huruf per baris)
  Opsional: "waktu_detik" (5 sampai 60) untuk menimpa waktu bawaan.
Batas: teks soal 140 huruf, tiap pilihan 28 huruf, pembahasan 300 huruf.
Soal isian dengan banyak kemungkinan jawaban sebaiknya dihindari. Setelah sesi,
dashboard menampilkan jawaban isian yang dinilai salah supaya kamu bisa cek dan
menambah variasi "diterima".

HASIL DAN ANALISIS
- Dashboard setelah sesi: podium, rata-rata skor, soal yang paling banyak salah,
  dan jawaban isian yang perlu dicek manual.
- Unduh CSV dibuka dengan Excel (pemisah titik koma, cocok untuk Excel berbahasa Indonesia).
- Berkas sesi: data/sesi/TANGGAL-JAM-KODE.json (berisi nama panggilan dan skor saja).

JARINGAN
- Laptop dan HP siswa harus ada di jaringan yang sama.
- Hotspot dari laptop sebaiknya dipakai bila WiFi sekolah memblokir perangkat saling
  terhubung. Hotspot dari HP biasanya membatasi sekitar 8 sampai 10 perangkat, jadi
  untuk kelas besar pakai hotspot laptop atau router.
- Di dashboard, pilih "Alamat laptop" yang sesuai jaringan yang dipakai.
- Tidak perlu internet. Font dan pembuat QR ada di folder ini.

MODE ONLINE (jika WiFi atau hotspot memblokir HP)
- Klik dua kali  online.bat  (bukan mulai.bat). Pertama kali akan mengunduh
  cloudflared (gratis, tanpa akun). Laptop butuh internet.
- Tunggu sampai jendela hitam menampilkan ALAMAT ONLINE (https://....trycloudflare.com).
- Di dashboard, pilih "Online (Cloudflare)" pada Alamat laptop, lalu BUAT ROOM.
  QR akan berisi alamat online itu. HP siswa cukup punya internet apa saja (data seluler juga bisa).
- Alamat berubah tiap online.bat dijalankan. Dashboard guru tetap dilindungi PIN,
  tapi siapa pun yang tahu alamat bisa membuka halaman login. Jangan sebar alamatnya selain lewat QR.

JIKA HP TIDAK BISA MEMBUKA ALAMAT DI QR
- Pastikan HP dan laptop satu jaringan, dan VPN dimatikan.
- Coba pilih alamat laptop yang lain di dashboard, lalu buat room lagi.
- Coba hotspot. Jika berhasil, penyebabnya pembatasan WiFi sekolah.
- Pastikan firewall tidak memblokir port 3000.

KEAMANAN
- Dashboard dikunci PIN (5 kali salah = dikunci 1 menit). PIN baru tiap server
  dijalankan, kecuali kamu menetapkan KR_PIN.
- Nama siswa ditampilkan sebagai teks biasa. Pesan dibatasi lajunya.
- Skor lari (rintangan dan koin) dilaporkan HP dan dibatasi wajar oleh server.
  Skor kuis dihitung penuh di server. Cukup aman untuk kelas, belum untuk lomba resmi.

PENGATURAN OPSIONAL (variabel lingkungan)
  KR_PORT=3001   ganti port
  KR_PIN=4321    tetapkan PIN sendiri
  KR_NO_OPEN=1   jangan membuka browser otomatis

STRUKTUR
  server/     index.js (HTTP+WebSocket), rooms.js (room/pemain), game.js (soal,
              penilaian, podium), bank.js (validasi dan simpan bank soal)
  public/     guru/, join/ (HP siswa), layar/ (IFP), shared/, vendor/
  data/bank/  bank soal tersimpan      data/sesi/  hasil sesi
  prototipe/  prototipe satu layar (buka index.html di browser)
