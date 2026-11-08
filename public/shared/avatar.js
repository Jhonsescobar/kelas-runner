/* Sprite avatar voxel. Dipakai di lobby siswa, dashboard guru, dan layar kelas. */
(function () {
  'use strict';
  var KR = window.KR = window.KR || {};

  KR.SKIN = [{ n: 'Krem', c: '#f5c9a6' }, { n: 'Sawo muda', c: '#e0a073' }, { n: 'Sawo', c: '#b9784a' }, { n: 'Cokelat', c: '#7c4a2d' }, { n: 'Hijau alien', c: '#8de3b0' }, { n: 'Biru', c: '#9fb4ff' }];
  KR.SHIRT = [{ n: 'Merah muda', c: '#ff4fa3' }, { n: 'Biru langit', c: '#4de2ff' }, { n: 'Kuning', c: '#ffd23f' }, { n: 'Hijau', c: '#5fd45a' }, { n: 'Jingga', c: '#ff7a3d' }, { n: 'Ungu', c: '#b58bff' }];
  KR.EXPR = [['senang', 'Senang'], ['datar', 'Santai'], ['semangat', 'Semangat'], ['kaget', 'Kaget']];
  KR.HAT = [['none', 'Polos'], ['topi', 'Topi'], ['helm', 'Helm'], ['antena', 'Antena']];

  var cache = {};
  function shade(hex, amt) {
    var k = hex + amt; if (cache[k]) return cache[k];
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
    return (cache[k] = 'rgb(' + r + ',' + g + ',' + b + ')');
  }
  function box(c, x, y, w, h, col) {
    x = Math.round(x); y = Math.round(y);
    c.fillStyle = col; c.fillRect(x, y, w, h);
    var t = h >= 7 ? 2 : 1, s = w >= 7 ? 2 : 1;
    c.fillStyle = shade(col, 0.3); c.fillRect(x, y, w, t);
    c.fillStyle = shade(col, -0.3); c.fillRect(x + w - s, y + t, s, h - t);
  }
  KR.box = box;
  KR.shade = shade;

  KR.drawAvatar = function (c, av, x, y, o) {
    o = o || {};
    var ph = o.phase || 0, duck = !!o.duck, air = !!o.air, expr = o.expr || av.expr;
    var sk = KR.SKIN[av.skin].c, sh = KR.SHIRT[av.shirt].c, pants = '#2b3a8f', ink = '#14123a';
    var lg = Math.sin(ph * Math.PI * 2), hy;
    if (duck) {
      box(c, x - 5, y - 3, 4, 3, pants); box(c, x + 1, y - 3, 4, 3, pants); box(c, x - 5, y - 8, 10, 6, sh); hy = y - 14;
    } else {
      var a = air ? 0 : Math.max(0, lg) * 2, b = air ? 0 : Math.max(0, -lg) * 2;
      box(c, x - 5, y - 8, 4, air ? 6 : 8 - a, pants); box(c, x + 1, y - 8, 4, air ? 5 : 8 - b, pants);
      var sw = air ? -4 : Math.round(lg * 2);
      box(c, x - 8, y - 16 + (air ? -3 : sw), 3, 7, sk); box(c, x + 5, y - 16 + (air ? -5 : -sw), 3, 7, sk);
      box(c, x - 5, y - 17, 10, 9, sh); hy = y - 26;
    }
    var hx = x - 5; box(c, hx, hy, 10, 9, sk);
    c.fillStyle = ink;
    if (expr === 'senang') { c.fillRect(hx + 2, hy + 3, 2, 2); c.fillRect(hx + 6, hy + 3, 2, 2); c.fillRect(hx + 3, hy + 6, 4, 1); c.fillRect(hx + 2, hy + 5, 1, 1); c.fillRect(hx + 7, hy + 5, 1, 1); }
    else if (expr === 'datar') { c.fillRect(hx + 2, hy + 3, 2, 2); c.fillRect(hx + 6, hy + 3, 2, 2); c.fillRect(hx + 3, hy + 6, 4, 1); }
    else if (expr === 'semangat') { c.fillRect(hx + 2, hy + 2, 2, 3); c.fillRect(hx + 6, hy + 2, 2, 3); c.fillRect(hx + 3, hy + 5, 4, 3); c.fillStyle = '#ff6b7a'; c.fillRect(hx + 4, hy + 7, 2, 1); }
    else { c.fillStyle = '#fff'; c.fillRect(hx + 1, hy + 2, 3, 4); c.fillRect(hx + 6, hy + 2, 3, 4); c.fillStyle = ink; c.fillRect(hx + 2, hy + 4, 1, 1); c.fillRect(hx + 7, hy + 4, 1, 1); c.fillRect(hx + 4, hy + 6, 2, 2); }
    if (av.hat === 'topi') { box(c, hx - 1, hy - 3, 12, 4, '#e8453c'); box(c, hx + 7, hy, 5, 2, '#b3302a'); }
    else if (av.hat === 'helm') {
      c.fillStyle = 'rgba(185,232,255,.34)'; c.fillRect(hx - 2, hy - 3, 14, 13);
      c.fillStyle = '#e6efff'; c.fillRect(hx - 1, hy - 4, 12, 1); c.fillRect(hx - 2, hy - 3, 1, 12); c.fillRect(hx + 11, hy - 3, 1, 12); c.fillRect(hx, hy - 2, 3, 1); box(c, hx - 2, hy + 9, 14, 2, '#c9d1e6');
    } else if (av.hat === 'antena') {
      var bob = Math.round(Math.sin(ph * Math.PI * 4)); c.fillStyle = '#cfd3ff'; c.fillRect(x, hy - 5, 1, 5); box(c, x - 1, hy - 8 + bob, 3, 3, '#ff4fa3');
    }
    if (o.cracked) {
      c.fillStyle = ink;
      if (duck) { c.fillRect(x - 1, y - 7, 1, 3); c.fillRect(x, y - 5, 1, 2); }
      else { c.fillRect(x - 2, y - 16, 1, 3); c.fillRect(x - 1, y - 13, 1, 2); c.fillRect(x, y - 12, 1, 3); c.fillRect(x + 2, y - 25, 1, 2); c.fillRect(x + 3, y - 23, 1, 2); }
    }
  };

  /* Canvas 48x64 berisi satu avatar diam. Ukuran tampil diatur lewat CSS. */
  KR.avatarCanvas = function (av, expr, phase) {
    var k = document.createElement('canvas'); k.width = 48; k.height = 64;
    var c = k.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0);
    KR.drawAvatar(c, av, 12, 29, { expr: expr || null, phase: phase || 0 });
    return k;
  };
  KR.redrawAvatar = function (k, av, phase) {
    var c = k.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 48, 64); c.setTransform(2, 0, 0, 2, 0, 0);
    box(c, 3, 30, 18, 2, '#3b3a8a'); KR.drawAvatar(c, av, 12, 29, { phase: phase || 0 });
  };
})();
