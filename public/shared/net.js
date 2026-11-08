/* Klien WebSocket kecil dengan sambung ulang otomatis. */
(function () {
  'use strict';
  var KR = window.KR = window.KR || {};
  KR.connect = function (h) {
    var ws, retry = 0, berhenti = false;
    var api = {
      send: function (o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
      stop: function () { berhenti = true; if (ws) ws.close(); },
    };
    function buka() {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      ws.onopen = function () { retry = 0; if (h.open) h.open(api); };
      ws.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (_) { return; } if (h.msg) h.msg(m, api); };
      ws.onclose = function () {
        if (h.close) h.close();
        if (!berhenti) setTimeout(buka, Math.min(5000, 500 * Math.pow(2, retry++)));
      };
      ws.onerror = function () {};
    }
    buka();
    return api;
  };
})();
