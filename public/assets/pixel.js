/* Meta Pixel da Escola do Reino (o mesmo de escoladoreino.com), carregado em todas as páginas.
   Cada evento sai com um eventID; o servidor manda o mesmo evento pela API de Conversões
   (quando META_CAPI_TOKEN estiver configurado) e a Meta junta os dois sem duplicar.
   Respeita o opt-out do site principal (cookie edr_consent=denied).
   Uso nas páginas: edrPixel.track('Lead', {...}, eventId)  /  edrPixel.custom('Nome', {...}) */
(function () {
  'use strict';
  var PIXEL_ID = '1818933942616750';
  var on = !/(?:^|;\s*)edr_consent=denied/.test(document.cookie);
  var eid = function () {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  };
  if (on) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
  }
  var api = {
    on: on,
    eid: eid,
    track: function (name, params, id) { if (on && window.fbq) fbq('track', name, params || {}, { eventID: id || eid() }); },
    custom: function (name, params, id) { if (on && window.fbq) fbq('trackCustom', name, params || {}, { eventID: id || eid() }); }
  };
  window.edrPixel = api;

  // PageView no navegador + o mesmo evento pelo servidor
  var pv = eid();
  api.track('PageView', {}, pv);
  if (on) {
    var body = JSON.stringify({ eventId: pv, url: location.href });
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/pv', new Blob([body], { type: 'application/json' })))) {
        fetch('/api/pv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* ignore */ }
  }
})();
