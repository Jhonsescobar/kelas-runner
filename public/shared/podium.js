/* Podium bersama: dipakai layar kelas, HP siswa, dan dashboard guru. Ukuran mengikuti font-size elemen pembungkus. */
(function () {
  'use strict';
  var KR = window.KR = window.KR || {};
  function el(tag, cls, teks) { var e = document.createElement(tag); if (cls) e.className = cls; if (teks !== undefined) e.textContent = teks; return e; }

  KR.podium = function (host, hasil, opt) {
    opt = opt || {};
    host.textContent = '';
    if (!hasil || !hasil.urut) return;
    var ikut = hasil.urut.filter(function (u) { return u.ikut; });
    var belum = hasil.urut.filter(function (u) { return !u.ikut; });
    var root = el('div', 'pdm' + (opt.sempit ? ' sempit' : ''));

    var pod = el('div', 'pdm-pod');
    [1, 0, 2].forEach(function (i) {
      var u = ikut[i], kol = el('div', 'pdm-kol' + (i === 0 ? ' juara' : '') + (u && u.id === opt.aku ? ' aku' : ''));
      if (u) {
        var cv = KR.avatarCanvas(u.avatar, i === 0 ? 'semangat' : null); cv.setAttribute('aria-hidden', 'true');
        kol.append(cv, el('div', 'pdm-nama', u.nama), el('div', 'pdm-skor', String(u.total)));
      }
      kol.appendChild(el('div', 'pdm-blok r' + (i + 1), u ? String(i + 1) : '-'));
      pod.appendChild(kol);
    });
    root.appendChild(pod);

    var sisi = el('div', 'pdm-sisi');
    var ol = el('ol', 'pdm-daftar');
    ikut.slice(3).forEach(function (u, k) {
      var li = el('li', u.id === opt.aku ? 'aku' : '');
      var nm = el('span', 'nm', u.nama);
      if (u.id === opt.aku) nm.appendChild(el('span', 'tag', 'kamu'));
      li.append(el('span', 'no', String(k + 4)), nm, el('span', 'sk', String(u.total)));
      ol.appendChild(li);
    });
    belum.forEach(function (u) {
      var li = el('li', 'belum'); var nm = el('span', 'nm', u.nama); nm.appendChild(el('span', 'tag', 'belum main'));
      li.append(el('span', 'no', '-'), nm, el('span', 'sk', '0')); ol.appendChild(li);
    });
    if (ol.children.length) sisi.appendChild(ol);
    else if (ikut.length <= 3) sisi.appendChild(el('p', 'pdm-info', 'Peringkat 4 dan seterusnya muncul di sini.'));

    if (hasil.penghargaan && hasil.penghargaan.length) {
      var aw = el('div', 'pdm-aw');
      hasil.penghargaan.forEach(function (p) {
        var d = el('div'); d.append(el('span', '', p.judul), el('b', '', p.nama + ' · ' + p.nilai)); aw.appendChild(d);
      });
      sisi.appendChild(aw);
    }
    root.appendChild(sisi);
    host.appendChild(root);
    var aku = root.querySelector('li.aku');
    if (aku && ol.clientHeight && ol.scrollHeight > ol.clientHeight) ol.scrollTop = Math.max(0, aku.offsetTop - ol.offsetTop - ol.clientHeight / 2); // tampilkan barismu sendiri
  };
})();
