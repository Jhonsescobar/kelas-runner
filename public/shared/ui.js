/* Pilihan bergaya radio: tombol pil atau kotak warna. Teks selalu lewat textContent. */
(function () {
  'use strict';
  var KR = window.KR = window.KR || {};
  KR.radioGroup = function (host, items, get, set, kind) {
    host.setAttribute('role', 'radiogroup');
    host.textContent = '';
    var tombol = items.map(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio');
      b.className = kind === 'sw' ? 'sw' : 'pill';
      if (kind === 'sw') { b.style.background = it.color; b.setAttribute('aria-label', it.label); b.title = it.label; }
      else b.textContent = it.label;
      b.addEventListener('click', function () { set(it.k); sync(); });
      host.appendChild(b);
      return b;
    });
    function sync() { items.forEach(function (it, i) { tombol[i].setAttribute('aria-checked', String(get() === it.k)); }); }
    sync();
    return sync;
  };
  KR.salin = function (teks, tombol) {
    function ok() { var lama = tombol.textContent; tombol.textContent = 'Tersalin'; setTimeout(function () { tombol.textContent = lama; }, 1400); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(teks).then(ok, function () {});
  };
})();
