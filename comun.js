// Maderas Pachalito — funciones que usan todas las páginas
(function () {
  var C = window.CONFIG || {};
  var CLAVE_PEDIDO = 'pachalito-pedido';
  var fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

  function pesos(n) { return '$' + fmt.format(Math.round(n || 0)); }
  function numero(n) { return String(+(+n).toFixed(2)).replace('.', ','); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Pedido guardado en el navegador ----------
  function leerPedido() {
    try { return JSON.parse(localStorage.getItem(CLAVE_PEDIDO)) || []; } catch (e) { return []; }
  }
  function guardarPedido(items) {
    try { localStorage.setItem(CLAVE_PEDIDO, JSON.stringify(items)); } catch (e) {}
    actualizarGlobo();
    document.dispatchEvent(new CustomEvent('pedido-cambio'));
  }
  function totalPedido(items) {
    return items.reduce(function (s, it) { return s + (it.precio || 0) * it.cant * (it.m2 || 1); }, 0);
  }

  // ---------- WhatsApp ----------
  function linkWhatsApp(texto) {
    var num = String(C.whatsapp || '').replace(/\D/g, '');
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(texto || '');
  }

  function actualizarGlobo() {
    var n = leerPedido().length;
    document.querySelectorAll('[data-globo]').forEach(function (el) {
      el.textContent = n;
      el.hidden = n === 0;
    });
  }

  // Completa los datos de contacto desde config.js
  function completarDatos() {
    var faltan = { direccion: '[Dirección]', horarios: '[Horarios]', telefono: '[Teléfono]', email: '[Email]' };
    document.querySelectorAll('[data-dato]').forEach(function (el) {
      var k = el.getAttribute('data-dato');
      var v = C[k];
      if (k === 'direccion' && v) v = v + (C.localidad ? ', ' + C.localidad : '');
      if (k === 'email' && !v) { (el.closest('.lista-datos > div') || el).hidden = true; return; }
      if (k === 'retiro') { var cont = el.closest('[data-si-retiro]') || el; cont.hidden = !v; el.textContent = v || ''; return; }
      if (v) { el.textContent = v; el.classList.remove('falta'); }
      else { el.textContent = faltan[k] || ''; el.classList.add('falta'); }
    });
    document.querySelectorAll('[data-whatsapp]').forEach(function (el) {
      el.href = linkWhatsApp(el.getAttribute('data-whatsapp') || 'Hola! Les escribo desde la página web.');
      el.target = '_blank'; el.rel = 'noopener';
    });
    document.querySelectorAll('[data-mapa]').forEach(function (el) {
      if (!C.direccion) { el.remove(); return; }
      var q = encodeURIComponent(C.direccion + ', ' + (C.localidad || '') + ', Buenos Aires');
      var f = document.createElement('iframe');
      f.className = 'mapa'; f.loading = 'lazy'; f.title = 'Mapa de cómo llegar';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.src = 'https://www.google.com/maps?q=' + q + '&output=embed';
      el.replaceWith(f);
    });
    document.querySelectorAll('[data-anio]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  // Fotos que todavía no se subieron: se ocultan sin dejar el ícono roto
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-opcional')) t.style.visibility = 'hidden';
  }, true);

  window.PACHALITO = {
    C: C, pesos: pesos, numero: numero, esc: esc,
    leerPedido: leerPedido, guardarPedido: guardarPedido, totalPedido: totalPedido,
    linkWhatsApp: linkWhatsApp
  };

  document.addEventListener('DOMContentLoaded', function () {
    completarDatos();
    actualizarGlobo();
  });
})();
