// Maderas Pachalito — dibujo de un corte a medida (puntas redondeadas y bordes con filo matado)
// Lo usan productos.html (calculadora y pedido) y dibujo.html (el link que llega por WhatsApp).
(function () {
  function numero(n) { return String(+(+n).toFixed(2)).replace('.', ','); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var PUNTAS = ['arriba a la izquierda', 'arriba a la derecha', 'abajo a la derecha', 'abajo a la izquierda'];
  var BORDES = ['arriba', 'derecha', 'abajo', 'izquierda'];
  function formaVacia(f) { return !f || (f.esq.join('') + f.bordes.join('')).indexOf('1') < 0; }
  function ladosDe(a, l) { var hz = Math.max(a, l), vt = Math.min(a, l); return [hz, vt, hz, vt]; }
  function textoForma(f, a, l) {
    if (formaVacia(f)) return '';
    var lados = ladosDe(a, l), partes = [];
    var e = PUNTAS.filter(function (x, i) { return f.esq[i]; });
    var b = BORDES.map(function (x, i) { return f.bordes[i] ? x + ' (' + numero(lados[i]) + ' cm)' : ''; }).filter(Boolean);
    if (e.length) partes.push(e.length === 4 ? 'las 4 puntas redondeadas' : (e.length === 1 ? 'punta redondeada ' : 'puntas redondeadas ') + e.join(', '));
    if (b.length) partes.push(b.length === 4 ? 'matar filo en los 4 bordes' : 'matar filo: ' + b.join(', '));
    var t = partes.join('; ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  // op: { codigo } para el dibujo que se puede tocar, { cotas: true } para mostrar las medidas
  function dibujoSVG(a, l, f, op) {
    op = op || {};
    var codigo = op.codigo, interactivo = !!codigo, grande = interactivo || op.cotas;
    var W = 320, H = grande ? 200 : 120, pad = grande ? 40 : 22;
    var lados = ladosDe(a, l), hz = lados[0], vt = lados[1];
    var s = Math.min((W - 2 * pad) / hz, (H - 2 * pad) / vt);
    var w = hz * s, h = Math.max(vt * s, grande ? 34 : 18);
    var x = (W - w) / 2, y = (H - h) / 2 + (grande ? 4 : 0);
    var rr = Math.min(Math.min(w, h) * 0.3, 28), r = f.esq.map(function (v) { return v ? rr : 0; });
    var n = function (v) { return Math.round(v * 10) / 10; };
    var d = 'M' + n(x + r[0]) + ',' + n(y) + 'H' + n(x + w - r[1]) + (r[1] ? 'A' + n(r[1]) + ',' + n(r[1]) + ' 0 0 1 ' + n(x + w) + ',' + n(y + r[1]) : '') +
      'V' + n(y + h - r[2]) + (r[2] ? 'A' + n(r[2]) + ',' + n(r[2]) + ' 0 0 1 ' + n(x + w - r[2]) + ',' + n(y + h) : '') +
      'H' + n(x + r[3]) + (r[3] ? 'A' + n(r[3]) + ',' + n(r[3]) + ' 0 0 1 ' + n(x) + ',' + n(y + h - r[3]) : '') +
      'V' + n(y + r[0]) + (r[0] ? 'A' + n(r[0]) + ',' + n(r[0]) + ' 0 0 1 ' + n(x + r[0]) + ',' + n(y) : '') + 'Z';
    var esquinas = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    var g = '<svg class="svg-corte" viewBox="0 0 ' + W + ' ' + H + '" ' + (interactivo ? 'role="group" aria-label="Dibujo del corte"' : 'aria-hidden="true"') + '>' +
      '<path d="' + d + '" class="pieza"/>';
    // Cruces en los bordes con el filo matado
    var cruces = '';
    for (var i = 0; i < 4; i++) {
      if (!f.bordes[i]) continue;
      var p0 = esquinas[i], p1 = esquinas[(i + 1) % 4];
      var largo = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ini = Math.max(r[i], 6) + 4, fin = largo - Math.max(r[(i + 1) % 4], 6) - 4;
      var paso = grande ? 20 : 14, k = Math.max(1, Math.floor((fin - ini) / paso)), t = grande ? 4.5 : 3;
      for (var j = 0; j <= k; j++) {
        var dd = k ? ini + (fin - ini) * j / k : (ini + fin) / 2;
        var cx = p0[0] + (p1[0] - p0[0]) * dd / largo, cy = p0[1] + (p1[1] - p0[1]) * dd / largo;
        cruces += 'M' + n(cx - t) + ',' + n(cy - t) + 'L' + n(cx + t) + ',' + n(cy + t) + 'M' + n(cx + t) + ',' + n(cy - t) + 'L' + n(cx - t) + ',' + n(cy + t);
      }
    }
    if (cruces) g += '<path d="' + cruces + '" class="cruz"/>';
    if (grande) {
      g += '<text x="' + n(x + w / 2) + '" y="' + n(y - 12) + '" text-anchor="middle" class="cota">' + numero(hz) + ' cm</text>' +
        '<text x="' + n(x - 12) + '" y="' + n(y + h / 2) + '" text-anchor="middle" class="cota" transform="rotate(-90 ' + n(x - 12) + ' ' + n(y + h / 2) + ')">' + numero(vt) + ' cm</text>';
    }
    if (!interactivo) {
      // Punto rojo sobre cada punta redondeada
      esquinas.forEach(function (c0, i) {
        if (!f.esq[i]) return;
        var o = rr * 0.29;
        g += '<circle cx="' + n(c0[0] + (i === 0 || i === 3 ? o : -o)) + '" cy="' + n(c0[1] + (i < 2 ? o : -o)) + '" r="' + (grande ? 5 : 3.5) + '" class="punto-punta"/>';
      });
    }
    if (interactivo) {
      for (var b = 0; b < 4; b++) {
        var q0 = esquinas[b], q1 = esquinas[(b + 1) % 4], m = 16;
        var ux = Math.sign(q1[0] - q0[0]), uy = Math.sign(q1[1] - q0[1]);
        g += '<line x1="' + n(q0[0] + ux * m) + '" y1="' + n(q0[1] + uy * m) + '" x2="' + n(q1[0] - ux * m) + '" y2="' + n(q1[1] - uy * m) + '" class="zona zona-borde' + (f.bordes[b] ? ' activo' : '') + '"' +
          ' data-borde="' + b + '" data-pieza="' + esc(codigo) + '" role="button" tabindex="0" aria-pressed="' + (f.bordes[b] ? 'true' : 'false') + '" aria-label="Matar filo del borde de ' + BORDES[b] + ' (' + numero(lados[b]) + ' cm)"/>';
      }
      esquinas.forEach(function (c0, i) {
        // Si la punta está redondeada, el marcador va sobre la curva
        var o = f.esq[i] ? rr * 0.29 : 0, c = [c0[0] + (i === 0 || i === 3 ? o : -o), c0[1] + (i < 2 ? o : -o)];
        g += '<g class="zona zona-punta' + (f.esq[i] ? ' activo' : '') + '" data-esq="' + i + '" data-pieza="' + esc(codigo) + '" role="button" tabindex="0" aria-pressed="' + (f.esq[i] ? 'true' : 'false') + '" aria-label="Punta redondeada ' + PUNTAS[i] + '">' +
          '<circle cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="18" class="toque"/><circle cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="6.5" class="marca-punta"/></g>';
      });
    }
    return g + '</svg>';
  }
  function cuenta(f) {
    var n = function (arr) { return arr.reduce(function (s, v) { return s + (v ? 1 : 0); }, 0); };
    return { puntas: f ? n(f.esq) : 0, bordes: f ? n(f.bordes) : 0 };
  }
  // Para el link: cada corte es "nombre,ancho,largo,cantidad,puntas,bordes" y se separan con ";"
  function codificar(cortes) {
    return cortes.map(function (c) {
      return [c.nombre, c.a, c.l, c.cant, c.forma.esq.join(''), c.forma.bordes.join('')].map(encodeURIComponent).join(',');
    }).join(';');
  }
  function decodificar(txt) {
    return String(txt || '').split(';').map(function (p) {
      var v = p.split(',').map(function (x) { try { return decodeURIComponent(x); } catch (e) { return ''; } });
      var bits = function (s) { var r = String(s || '').split('').slice(0, 4).map(function (d) { return d === '1' ? 1 : 0; }); while (r.length < 4) r.push(0); return r; };
      var c = { nombre: v[0] || 'Corte', a: +v[1], l: +v[2], cant: +v[3] || 1, forma: { esq: bits(v[4]), bordes: bits(v[5]) } };
      return c.a > 0 && c.l > 0 ? c : null;
    }).filter(Boolean);
  }
  window.DIBUJO_CORTE = { svg: dibujoSVG, texto: textoForma, vacia: formaVacia, cuenta: cuenta, codificar: codificar, decodificar: decodificar, PUNTAS: PUNTAS, BORDES: BORDES };
})();
