// Maderas Pachalito — catálogo, filtros por medida y pedido por WhatsApp
(function () {
  var P = window.PACHALITO, C = P.C, esc = P.esc, pesos = P.pesos;
  var CAMPOS = 'codigo,nombre,categoria,producto,material,variante,espesor,ancho,largo_m,unidad,precio,detalle,foto,imagen,espesor_orden,ancho_orden';
  var CACHE = 'pachalito-catalogo-v3', MINUTOS = 5;
  var CATEGORIAS = ['Maderas', 'Machimbres', 'Molduras', 'Placas y tableros', 'Chapas y perfiles', 'Decks y revestimientos', 'Aislantes', 'Protectores y barnices', 'Clavos y fijaciones', 'Herrajes y soportes', 'Muebles'];
  var ORDEN_MADERAS = ['Listón', 'Tabla', 'Tablón', 'Cabio', 'Tirante', 'Viga', 'Columna', 'Chanfle', 'Bulín', 'Buña', 'Cuñas'];
  var ORDEN_VARIANTE = ['Cepillado', 'Bruto', 'Finger joint'];
  var MADERA_CAT = { 'Maderas': 1, 'Machimbres': 1, 'Decks y revestimientos': 1 };
  var DIMS = ['material', 'variante', 'espesor', 'ancho'];

  var datos = [], porCodigo = {}, seleccion = {};
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Carga de productos desde Supabase ----------
  function cargar() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE));
      if (c && Date.now() - c.t < MINUTOS * 60000) return Promise.resolve(c.d);
    } catch (e) {}
    var todo = [];
    function pagina(desde) {
      var url = C.supabaseUrl + '/rest/v1/catalogo?select=' + CAMPOS + '&order=codigo.asc&limit=1000&offset=' + desde;
      return fetch(url, { headers: { apikey: C.supabaseKey } }).then(function (r) {
        if (!r.ok) throw new Error('Error ' + r.status);
        return r.json();
      }).then(function (d) {
        todo = todo.concat(d);
        return d.length === 0 ? todo : pagina(desde + d.length);
      });
    }
    return pagina(0).then(function (d) {
      try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      return d;
    });
  }

  // ---------- Utilidades ----------
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/["”“]/g, '').replace(/\s+/g, ' ').trim();
  }
  function unicos(arr) { return arr.filter(function (v, i) { return v != null && arr.indexOf(v) === i; }); }
  function sufijo(u) { return { 'metro': ' /m', 'm²': ' /m²', 'kg': ' /kg' }[u] || ''; }
  function unidadTxt(u) { return { 'metro': 'm', 'm²': 'm²', 'kg': 'kg' }[u] || ''; }
  // Precio para mostrar: si está oculto, "Consultar precio"
  function precioTxt(r) {
    return r.precio == null ? '<span class="consultar">Consultar precio</span>' : pesos(r.precio) + '<small>' + (esCorte(r) ? ' /m²' : sufijo(r.unidad)) + '</small>';
  }
  function subtotal(x) { return (x.precio || 0) * (1 + (x.recargo || 0) / 100) * x.cant * (x.m2 || 1) + (x.extra || 0) * x.cant; }
  // Recargo (%) para piezas chicas, según config.js
  function recargoDe(m2) { var lim = +C.piezaChicaM2 || 0, pct = +C.recargoPiezaChica || 0; return lim > 0 && pct > 0 && m2 > 0 && m2 < lim ? pct : 0; }
  function chicaTxt(pct) { return 'pieza chica (menos de ' + m2Txt(C.piezaChicaM2) + ' m²): +' + P.numero(pct) + '%'; }
  function subtotalTxt(x) { return x.precio == null ? 'A consultar' : pesos(subtotal(x)); }
  function nombreItem(x) { return x.medidas ? x.nombre + ' · corte ' + x.medidas : x.nombre; }
  function baseDe(x) { return porCodigo[x.base || x.codigo]; }
  // Tableros y MDF crudo con precio por m²: se venden cortados a medida
  function esCorte(r) {
    return r.categoria === 'Placas y tableros' && r.largo_m == null &&
      (r.unidad === 'm²' || ((r.producto === 'MDF' || r.producto === 'Tablero') && !r.unidad));
  }
  function m2Txt(n) { return String(+(+n).toFixed(2)).replace('.', ','); }
  function aConsultar(items) { return items.filter(function (x) { return x.precio == null; }).length; }
  function largoTxt(l) { return (+l).toFixed(2).replace('.', ',') + ' m'; }
  function fotoUrl(r) {
    var f = r.imagen || r.foto;
    if (!f) return '';
    if (/^https?:/.test(f)) return f;
    return C.supabaseUrl + '/storage/v1/object/public/productos/' + encodeURIComponent(f) + '.jpg';
  }
  function ordenar(dim, vals, filas) {
    if (dim === 'espesor' || dim === 'ancho') {
      var o = {};
      filas.forEach(function (r) { if (r[dim] != null) o[r[dim]] = r[dim + '_orden']; });
      return vals.sort(function (a, b) { return (o[a] || 0) - (o[b] || 0); });
    }
    if (dim === 'variante') {
      return vals.sort(function (a, b) {
        var ia = ORDEN_VARIANTE.indexOf(a), ib = ORDEN_VARIANTE.indexOf(b);
        if (ia < 0) ia = 99; if (ib < 0) ib = 99;
        return ia - ib || a.localeCompare(b, 'es', { numeric: true });
      });
    }
    return vals.sort(function (a, b) { return a.localeCompare(b, 'es', { numeric: true }); });
  }
  function productosDe(cat) {
    var ps = unicos(datos.filter(function (r) { return r.categoria === cat; }).map(function (r) { return r.producto || 'Otros'; }));
    if (cat === 'Maderas') {
      return ps.sort(function (a, b) {
        var ia = ORDEN_MADERAS.indexOf(a), ib = ORDEN_MADERAS.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    }
    return ps.sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }
  function filasDe(cat, prod) {
    return datos.filter(function (r) { return r.categoria === cat && (r.producto || 'Otros') === prod; });
  }
  function hash(obj) {
    var s = new URLSearchParams();
    Object.keys(obj).forEach(function (k) { if (obj[k] != null) s.set(k, obj[k]); });
    return '#' + s.toString();
  }

  // ---------- Pedido ----------
  function enPedido(codigo) {
    var it = P.leerPedido().filter(function (x) { return x.codigo === codigo; })[0];
    return it ? it.cant : 0;
  }
  // Deja el producto en el pedido con esa cantidad (0 lo quita)
  function ponerCant(codigo, cant) {
    var r = porCodigo[codigo]; if (!r) return;
    cant = Math.max(0, +(+String(cant).replace(',', '.')).toFixed(2) || 0);
    var items = P.leerPedido();
    var it = items.filter(function (x) { return x.codigo === codigo; })[0];
    if (it) it.cant = cant;
    else if (cant > 0) items.push({ codigo: r.codigo, nombre: r.nombre, precio: r.precio, unidad: r.unidad, cant: cant });
    P.guardarPedido(items.filter(function (x) { return x.cant > 0; }));
  }
  function cambiarCant(codigo, cant) {
    var items = P.leerPedido();
    items.forEach(function (x) { if (x.codigo === codigo) x.cant = Math.max(0, +(+String(cant).replace(',', '.')).toFixed(2) || 0); });
    P.guardarPedido(items.filter(function (x) { return x.cant > 0; }));
  }
  function refrescarPrecios() {
    var items = P.leerPedido(), cambio = false;
    items.forEach(function (x) {
      var r = baseDe(x);
      if (r && (r.precio !== x.precio || r.nombre !== x.nombre)) { x.precio = r.precio; x.nombre = r.nombre; if (!x.m2) x.unidad = r.unidad; cambio = true; }
      if (x.m2 && (x.recargo || 0) !== recargoDe(x.m2)) { x.recargo = recargoDe(x.m2); cambio = true; }
      if (x.forma) {
        var ex = extraDe(x.forma), monto = ex.consultar ? 0 : ex.monto;
        if (monto !== x.extra || ex.consultar !== x.extraConsultar) { x.extra = monto; x.extraConsultar = ex.consultar; cambio = true; }
      }
    });
    if (cambio) P.guardarPedido(items);
  }
  function lineaCant(x) {
    if (x.m2) return P.numero(x.cant) + ' ×';
    var u = unidadTxt(x.unidad);
    return P.numero(x.cant) + (u ? ' ' + u : '') + ' ×';
  }

  // ---------- Lateral y carrito (computadora) ----------
  function pintarLateral(catActual, prodActual) {
    var h = '<div class="titulo">Categorías</div>';
    CATEGORIAS.forEach(function (c) {
      if (!datos.some(function (r) { return r.categoria === c; })) return;
      h += '<a href="' + hash({ c: c }) + '" class="' + (c === catActual ? 'activo' : '') + '">' + esc(c) + '</a>';
      if (c === catActual) {
        h += '<div class="subs">' + productosDe(c).map(function (p) {
          return '<a href="' + hash({ c: c, p: p }) + '" class="' + (p === prodActual ? 'activo' : '') + '">' + esc(p) + '</a>';
        }).join('') + '</div>';
      }
    });
    $('lateral').innerHTML = h;
  }
  function pintarCarrito() {
    var items = P.leerPedido(), total = P.totalPedido(items);
    var h = '<h2>Tu pedido</h2>';
    if (!items.length) h += '<p class="vacio">Todavía no agregaste productos. Tocá + al lado del precio.</p>';
    items.forEach(function (x) {
      h += '<div class="linea-item"><span>' + esc(lineaCant(x)) + ' ' + esc(nombreItem(x)) + '</span><b>' + subtotalTxt(x) + '</b></div>';
    });
    if (items.length) {
      h += '<div class="total"><span>Total</span><b>' + pesos(total) + '</b></div>' + (aConsultar(items) ? '<p class="nota-precios">+ ' + aConsultar(items) + (aConsultar(items) === 1 ? ' producto' : ' productos') + ' con precio a consultar.</p>' : '') +
        '<a class="btn btn-principal btn-bloque" href="#pedido">Ver pedido y enviar</a>';
    }
    $('carrito').innerHTML = h;
    var barra = $('barra'), enVistaPedido = location.hash === '#pedido';
    barra.hidden = !items.length || enVistaPedido;
    $('barra-cant').textContent = items.length + (items.length === 1 ? ' producto' : ' productos') + ' en el pedido';
    $('barra-total').textContent = (total || !aConsultar(items)) ? pesos(total) : 'A consultar';
  }

  // ---------- Vistas ----------
  function vistaInicio() {
    pintarLateral(null, null);
    var h = '<h1 class="titulo-vista" style="margin-top:20px">Productos y precios</h1><p class="subtitulo">Elegí una categoría o buscá por nombre o código.</p><div class="filas">';
    CATEGORIAS.forEach(function (c) {
      var n = datos.filter(function (r) { return r.categoria === c; }).length;
      if (!n) return;
      h += '<a href="' + hash({ c: c }) + '"><span><span class="nombre">' + esc(c) + '</span><br><span class="pista">' + n + ' productos</span></span>' + flecha() + '</a>';
    });
    return h + '</div>';
  }

  function vistaCategoria(cat) {
    var ps = productosDe(cat);
    if (ps.length === 1) { history.replaceState(null, '', hash({ c: cat, p: ps[0] })); return vistaProducto(cat, ps[0]); }
    pintarLateral(cat, null);
    var h = migas([[cat]]) + '<h1 class="titulo-vista">' + esc(cat) + '</h1><div class="filas">';
    ps.forEach(function (p) {
      var f = filasDe(cat, p);
      var conPrecio = f.map(function (r) { return r.precio; }).filter(function (v) { return v != null; });
      var min = conPrecio.length ? Math.min.apply(null, conPrecio) : null;
      var esp = unicos(f.map(function (r) { return r.espesor; }));
      var pista = f.length + (f.length === 1 ? ' opción' : ' opciones') + (esp.length && MADERA_CAT[cat] ? ' · ' + esp.length + (esp.length === 1 ? ' espesor' : ' espesores') : '') + (min != null ? ' · desde ' + pesos(min) : ' · precio a consultar');
      h += '<a href="' + hash({ c: cat, p: p }) + '"><span><span class="nombre">' + esc(p) + '</span><br><span class="pista">' + esc(pista) + '</span></span>' + flecha() + '</a>';
    });
    return h + '</div>';
  }

  function vistaProducto(cat, prod) {
    pintarLateral(cat, prod);
    var todas = filasDe(cat, prod);
    if (!todas.length) return '<p class="aviso">No encontramos ese producto. <a href="productos.html">Volver a productos</a></p>';
    var clave = cat + '|' + prod, sel = seleccion[clave] || (seleccion[clave] = {});
    var sub = todas, filtros = '';
    var etiquetas = { material: MADERA_CAT[cat] ? 'Madera' : 'Material', variante: MADERA_CAT[cat] ? 'Terminación' : 'Tipo', espesor: 'Espesor', ancho: 'Ancho' };
    DIMS.forEach(function (d) {
      var vals = ordenar(d, unicos(sub.map(function (r) { return r[d]; })), sub);
      if (!vals.length || vals.length > 8) return;           // muchas opciones: se muestran todas en la lista
      if (vals.indexOf(sel[d]) < 0) sel[d] = vals[0];
      sub = sub.filter(function (r) { return r[d] == null || r[d] === sel[d]; });
      filtros += '<fieldset class="grupo-filtro"><legend>' + etiquetas[d] + '</legend><div class="chips">' + vals.map(function (v) {
        return '<button type="button" class="chip" data-dim="' + d + '" data-val="' + esc(v) + '" aria-pressed="' + (v === sel[d]) + '">' + esc(v) + '</button>';
      }).join('') + '</div></fieldset>';
    });
    sub.sort(function (a, b) {
      return (a.largo_m == null ? -1 : a.largo_m) - (b.largo_m == null ? -1 : b.largo_m) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true });
    });
    var largosUnicos = sub.length > 1 && unicos(sub.map(function (r) { return r.largo_m == null ? 'x' : r.largo_m; })).length === sub.length;
    var porMedida = !MADERA_CAT[cat] ? false : sub.length === 1 ? !!(sub[0].espesor || sub[0].ancho) : largosUnicos && sub.every(function (r) { return r.espesor || r.ancho; });

    var desc = [sel.material, sel.variante && String(sel.variante).toLowerCase()].filter(Boolean).join(' ');
    if (sel.espesor && sel.ancho) desc += (desc ? ' ' : '') + sel.espesor + ' x ' + sel.ancho;
    var foto = fotoUrl(sub[0] || todas[0]);

    var h = migas([[cat, hash({ c: cat })], [prod]]) +
      '<div class="encabezado-producto">' +
      (foto ? '<button type="button" class="btn-foto" data-ver="' + esc(foto) + '" data-titulo="' + esc(prod + (desc ? ' ' + desc : '')) + '" aria-label="Ver foto grande de ' + esc(prod) + '""><img class="foto-producto" src="' + esc(foto) + '" alt="" onerror="this.parentNode.remove()"></button>' : '') +
      '<div><h1 class="titulo-vista">' + esc(prod) + '</h1>' + (desc ? '<p class="subtitulo" style="margin:0">' + esc(desc) + '</p>' : '') + '</div></div>' +
      filtros +
      '<div class="etiqueta">' + (porMedida ? 'Largo y precio' : 'Precios') + '</div><div class="lista-precios">';
    sub.forEach(function (r) {
      var titulo;
      if (porMedida) titulo = r.largo_m != null ? largoTxt(r.largo_m) : (r.unidad === 'm²' ? 'Por m²' : r.unidad === 'metro' ? 'Por metro (a medida)' : r.nombre);
      else titulo = r.nombre;
      h += filaPrecio(r, '<span>' + esc(titulo) + '</span>' + (r.detalle ? '<span class="cod">' + esc(r.detalle) + '</span>' : '') + '<span class="cod">Código ' + esc(r.codigo) + '</span>');
    });
    return h + '</div>';
  }

  // Una fila con precio, selector de cantidad y botón Agregar
  function filaPrecio(r, izqHtml) {
    if (esCorte(r)) return filaCorte(r, izqHtml);
    var n = enPedido(r.codigo), u = unidadTxt(r.unidad) || 'u.', id = 'q-' + r.codigo.replace(/[^A-Za-z0-9]/g, '_'), foto = fotoUrl(r);
    return '<div class="item-precio">' +
      '<div class="fila1">' + (foto ? '<button type="button" class="btn-foto" data-ver="' + esc(foto) + '" data-titulo="' + esc(r.nombre) + '" aria-label="Ver foto grande de ' + esc(r.nombre) + '"><img class="mini-prod" src="' + esc(foto) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>' : '') + '<div class="izq">' + izqHtml + '</div>' +
      '<span class="precio">' + precioTxt(r) + '</span></div>' +
      '<div class="fila2">' +
      '<div class="cantidad chica"><button type="button" data-paso="-1" data-para="' + esc(r.codigo) + '" aria-label="Restar uno">−</button>' +
      '<label class="oculto" for="' + id + '">Cantidad de ' + esc(r.nombre) + '</label>' +
      '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + P.numero(n || 1) + '" data-qty="' + esc(r.codigo) + '">' +
      '<button type="button" data-paso="1" data-para="' + esc(r.codigo) + '" aria-label="Sumar uno">+</button>' +
      '<span class="unidad">' + u + '</span></div>' +
      '<button type="button" class="btn-agregar' + (n ? ' listo' : '') + '" data-agregar="' + esc(r.codigo) + '">' + (n ? '✓ En el pedido' : 'Agregar') + '</button>' +
      '</div></div>';
  }

  function filaCorte(r, izqHtml) {
    var id = r.codigo.replace(/[^A-Za-z0-9]/g, '_'), foto = fotoUrl(r);
    var cortes = P.leerPedido().filter(function (x) { return x.base === r.codigo; });
    var nCortes = cortes.reduce(function (s, x) { return s + x.cant; }, 0);
    return '<div class="item-precio corte">' +
      '<div class="fila1">' + (foto ? '<button type="button" class="btn-foto" data-ver="' + esc(foto) + '" data-titulo="' + esc(r.nombre) + '" aria-label="Ver foto grande de ' + esc(r.nombre) + '"><img class="mini-prod" src="' + esc(foto) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>' : '') +
      '<div class="izq">' + izqHtml + '<span class="cod">Corte a medida · precio por m²</span><span class="cod">Corte máximo: ' + maxTxt(placaDe(r)) + ' (placa entera)</span>' + (nCortes ? '<span class="en-pedido">' + nCortes + (nCortes === 1 ? ' corte' : ' cortes') + ' en el pedido</span>' : '') + '</div>' +
      '<span class="precio">' + precioTxt(r) + '</span></div>' +
      '<div class="calc-corte" data-calc="' + esc(r.codigo) + '">' +
      '<div class="medida"><label for="ca-' + id + '">Ancho</label><span><input id="ca-' + id + '" inputmode="decimal" autocomplete="off" placeholder="0" data-corte-a="' + esc(r.codigo) + '"> cm</span></div>' +
      '<span class="por" aria-hidden="true">×</span>' +
      '<div class="medida"><label for="cl-' + id + '">Largo</label><span><input id="cl-' + id + '" inputmode="decimal" autocomplete="off" placeholder="0" data-corte-l="' + esc(r.codigo) + '"> cm</span></div>' +
      '<div class="medida"><label for="cn-' + id + '">Piezas</label><span><input id="cn-' + id + '" inputmode="numeric" autocomplete="off" value="1" data-corte-n="' + esc(r.codigo) + '"></span></div>' +
      '<div class="dibujo-corte" data-dibujo="' + esc(r.codigo) + '" hidden></div>' +
      '<div class="resultado" data-corte-res="' + esc(r.codigo) + '" aria-live="polite">Ingresá ancho y largo</div>' +
      '<button type="button" class="btn-agregar" data-corte="' + esc(r.codigo) + '">Agregar corte</button>' +
      '</div></div>';
  }
  // ---------- Dibujo del corte: puntas redondeadas y bordes con filo matado ----------
  // Puntas: 0 arriba izq, 1 arriba der, 2 abajo der, 3 abajo izq. Bordes: 0 arriba, 1 derecha, 2 abajo, 3 izquierda.
  // El lado más largo se dibuja siempre horizontal.
  var D = window.DIBUJO_CORTE, formas = {};
  var dibujoSVG = D.svg, textoForma = D.texto, formaVacia = D.vacia;
  // Adicional por pieza de las puntas redondeadas y bordes con filo matado (precios en config.js)
  // Los precios salen de los artículos ADIC-PUNTA y ADIC-FILO (se cargan desde Administración).
  // Si no existen, se usa config.js. Esos artículos no se muestran en el catálogo.
  var ADICIONALES = { 'ADIC-PUNTA': 'punta', 'ADIC-FILO': 'filo' }, adic = {};
  function esAdicional(r) { return ADICIONALES.hasOwnProperty(String(r.codigo || '').toUpperCase()); }
  function precioAdic(tipo, respaldo) { return adic.hasOwnProperty(tipo) ? (+adic[tipo] || 0) : (+respaldo || 0); }
  function extraDe(f) {
    var c = D.cuenta(f), pp = precioAdic('punta', C.precioPunta), pf = precioAdic('filo', C.precioFilo);
    return { monto: c.puntas * pp + c.bordes * pf, consultar: !!((c.puntas && !pp) || (c.bordes && !pf)), hay: c.puntas + c.bordes > 0 };
  }
  function extraTxt(x) {
    if (x.extraConsultar) return 'puntas y filos a consultar';
    return x.extra ? '+ ' + pesos(x.extra) + ' puntas y filos c/u' : '';
  }
  function formaDe(codigo) { return formas[codigo] || (formas[codigo] = { esq: [0, 0, 0, 0], bordes: [0, 0, 0, 0] }); }
  function pintarDibujo(codigo, enfocar) {
    var cont = document.querySelector('[data-dibujo="' + CSS.escape(codigo) + '"]');
    if (!cont) return;
    var c = leerCorte(codigo);
    if (!c.ok) { cont.hidden = true; cont.innerHTML = ''; return; }
    var f = formaDe(codigo), txt = textoForma(f, c.a, c.l);
    cont.hidden = false;
    cont.innerHTML = dibujoSVG(c.a, c.l, f, { codigo: codigo }) +
      '<p class="ayuda-dibujo">Tocá una <b>punta</b> para redondearla. Tocá un <b>borde</b> para matarle el filo (se marca con <span class="x">✕</span>).</p>' +
      '<p class="forma-txt" aria-live="polite">' + (txt ? esc(txt) : 'Puntas rectas, sin matar filo.') + '</p>';
    if (enfocar) { var el = cont.querySelector(enfocar); if (el) el.focus(); }
  }
  function tocarForma(el) {
    var codigo = el.getAttribute('data-pieza'), f = formaDe(codigo), sel;
    if (el.hasAttribute('data-esq')) { var i = +el.getAttribute('data-esq'); f.esq[i] = f.esq[i] ? 0 : 1; sel = '[data-esq="' + i + '"]'; }
    else { var b = +el.getAttribute('data-borde'); f.bordes[b] = f.bordes[b] ? 0 : 1; sel = '[data-borde="' + b + '"]'; }
    actualizarCorte(codigo, sel);
  }

  // Medida de la placa entera del mismo material y espesor = corte máximo (en cm)
  function placaDe(r) {
    var p = datos.filter(function (x) {
      return x.categoria === r.categoria && x.producto === r.producto && x.material === r.material && x.espesor === r.espesor && x.largo_m != null && x.ancho;
    })[0];
    if (!p) return null;
    var w = Math.round(parseFloat(String(p.ancho).replace(',', '.')) * 100), l = Math.round(p.largo_m * 100);
    return w > 0 && l > 0 ? { w: Math.min(w, l), l: Math.max(w, l) } : null;
  }
  function maxTxt(pl) { return pl ? pl.w + ' x ' + pl.l + ' cm' : '400 x 400 cm'; }
  function leerCorte(codigo) {
    var q = function (k) { var el = document.querySelector('[data-corte-' + k + '="' + CSS.escape(codigo) + '"]'); return el ? +String(el.value).replace(',', '.') : 0; };
    var a = q('a'), l = q('l'), n = Math.round(q('n')) || 1;
    var pl = placaDe(porCodigo[codigo]) || { w: 400, l: 400 };
    var entra = (a <= pl.w && l <= pl.l) || (a <= pl.l && l <= pl.w);
    var ok = a > 0 && l > 0 && entra;
    return { a: a, l: l, n: n, ok: ok, m2: ok ? Math.round(a * l) / 10000 : 0, max: maxTxt(placaDe(porCodigo[codigo])) };
  }
  function actualizarCorte(codigo, enfocar) {
    var r = porCodigo[codigo], c = leerCorte(codigo), el = document.querySelector('[data-corte-res="' + CSS.escape(codigo) + '"]');
    if (!el) return;
    pintarDibujo(codigo, enfocar);
    if (!c.a || !c.l) { el.textContent = 'Ingresá ancho y largo'; el.classList.remove('error'); return; }
    if (!c.ok) { el.textContent = 'No entra en una placa: el corte máximo es ' + c.max; el.classList.add('error'); return; }
    el.classList.remove('error');
    var total = c.m2 * c.n, ex = extraDe(formaDe(codigo)), rec = recargoDe(c.m2);
    var notas = [];
    if (rec) notas.push(chicaTxt(rec).charAt(0).toUpperCase() + chicaTxt(rec).slice(1));
    if (ex.hay) notas.push(ex.consultar ? 'Puntas y filos: a consultar' : 'Incluye puntas y filos: ' + pesos(ex.monto * c.n));
    el.innerHTML = '<span>' + m2Txt(total) + ' m²' + (r.precio != null ? ' · <b>' + pesos(r.precio * (1 + rec / 100) * total + (ex.consultar ? 0 : ex.monto * c.n)) + '</b>' : ' · precio a consultar') +
      (notas.length && r.precio != null ? notas.map(function (t) { return '<small class="extra-corte">' + t + '</small>'; }).join('') : '') + '</span>';
  }
  function agregarCorte(codigo) {
    var r = porCodigo[codigo], c = leerCorte(codigo);
    if (!r) return false;
    if (!c.ok) { actualizarCorte(codigo); var el = document.querySelector('[data-corte-res="' + CSS.escape(codigo) + '"]'); if (el) { el.textContent = c.a && c.l ? 'No entra en una placa: el corte máximo es ' + c.max : 'Ingresá ancho y largo en cm'; el.classList.add('error'); } return false; }
    var medidas = P.numero(c.a) + ' x ' + P.numero(c.l) + ' cm', clave = r.codigo + '#' + c.a + 'x' + c.l;
    var f = formaDe(codigo), conForma = !formaVacia(f);
    if (conForma) clave += '#' + f.esq.join('') + f.bordes.join('');
    var items = P.leerPedido(), it = items.filter(function (x) { return x.codigo === clave; })[0];
    if (it) it.cant += c.n;
    else {
      var nuevo = { codigo: clave, base: r.codigo, nombre: r.nombre, medidas: medidas, m2: c.m2, precio: r.precio, unidad: 'm²', cant: c.n, a: c.a, l: c.l };
      if (recargoDe(c.m2)) nuevo.recargo = recargoDe(c.m2);
      if (conForma) {
        var ex = extraDe(f);
        nuevo.forma = { esq: f.esq.slice(), bordes: f.bordes.slice() }; nuevo.formaTxt = textoForma(f, c.a, c.l);
        nuevo.extra = ex.consultar ? 0 : ex.monto; nuevo.extraConsultar = ex.consultar;
      }
      items.push(nuevo);
    }
    P.guardarPedido(items);
    delete formas[codigo];
    return true;
  }

  function vistaBusqueda(q) {
    pintarLateral(null, null);
    var palabras = norm(q).split(' ').filter(Boolean);
    var res = datos.filter(function (r) {
      var t = r._t || (r._t = norm([r.nombre, r.codigo, r.categoria, r.producto, r.material, r.variante].join(' ')));
      return palabras.every(function (p) { return t.indexOf(p) >= 0; });
    });
    var h = '<h1 class="titulo-vista" style="margin-top:20px">Resultados</h1><p class="subtitulo">' +
      (res.length ? res.length + (res.length === 1 ? ' producto' : ' productos') + ' para "' + esc(q) + '"' : 'No encontramos productos para "' + esc(q) + '". Probá con otra palabra o escribinos por WhatsApp.') + '</p><div class="lista-precios">';
    res.slice(0, 80).forEach(function (r) {
      h += filaPrecio(r, '<a href="' + hash({ c: r.categoria, p: r.producto || 'Otros' }) + '" style="text-decoration:none;font-size:17px">' + esc(r.nombre) + '</a>' +
        '<span class="cod">' + esc(r.categoria) + ' · Código ' + esc(r.codigo) + '</span>');
    });
    if (res.length > 80) h += '<p class="subtitulo" style="margin-top:12px">Mostramos los primeros 80. Agregá más palabras para afinar la búsqueda.</p>';
    return h + '</div>';
  }

  function vistaPedido() {
    pintarLateral(null, null);
    var items = P.leerPedido();
    var h = '<div class="migas"><a href="javascript:history.back()">‹ Seguir comprando</a></div><h1 class="titulo-vista">Tu pedido</h1>';
    if (!items.length) return h + '<p class="aviso">Tu pedido está vacío. <a href="productos.html">Ver productos</a></p>';
    items.forEach(function (x) {
      var u = x.m2 ? 'u.' : unidadTxt(x.unidad);
      var f = baseDe(x) ? fotoUrl(baseDe(x)) : '';
      var det = x.m2 ? m2Txt(x.m2) + ' m² c/u · ' + (x.precio == null ? 'precio a consultar' : pesos(x.precio) + ' /m²') + (x.recargo ? ' · ' + chicaTxt(x.recargo) : '') + (extraTxt(x) ? ' · ' + extraTxt(x) : '')
        : esc(x.codigo) + ' · ' + (x.precio == null ? 'precio a consultar' : pesos(x.precio) + sufijo(x.unidad));
      h += '<div class="pedido-item"><div class="arriba">' +
        (f ? '<button type="button" class="btn-foto" data-ver="' + esc(f) + '" data-titulo="' + esc(x.nombre) + '" aria-label="Ver foto grande de ' + esc(x.nombre) + '"><img class="mini-prod" src="' + esc(f) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>' : '') +
        '<div class="txt"><div>' + esc(nombreItem(x)) + '</div><div class="det">' + det + '</div>' +
        (x.forma ? '<div class="forma-pedido">' + dibujoSVG(x.a, x.l, x.forma) + '<span>' + esc(x.formaTxt || '') + '</span></div>' : '') +
        '</div><b class="precio">' + subtotalTxt(x) + '</b></div>' +
        '<div class="abajo"><div class="cantidad chica"><button type="button" data-menos="' + esc(x.codigo) + '" aria-label="Restar uno">−</button>' +
        '<label class="oculto" for="c-' + esc(x.codigo) + '">Cantidad</label><input id="c-' + esc(x.codigo) + '" type="text" inputmode="decimal" autocomplete="off" value="' + P.numero(x.cant) + '" data-cant="' + esc(x.codigo) + '">' +
        '<button type="button" data-mas="' + esc(x.codigo) + '" aria-label="Sumar uno">+</button>' + '<span class="unidad">' + (u || 'u.') + '</span></div>' +
        '<button type="button" class="btn-quitar" data-quitar="' + esc(x.codigo) + '" aria-label="Quitar ' + esc(x.nombre) + ' del pedido">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>' +
        '<span>Quitar</span></button></div></div>';
    });
    h += '<div class="total" style="margin-top:18px"><span style="font-size:17px;font-weight:600">Total</span><b>' + (P.totalPedido(items) || !aConsultar(items) ? pesos(P.totalPedido(items)) : 'A consultar') + '</b></div>' +
      (aConsultar(items) ? '<p class="nota-precios">+ ' + aConsultar(items) + (aConsultar(items) === 1 ? ' producto' : ' productos') + ' con precio a consultar: te lo pasamos por WhatsApp.</p>' : '') +
      '<p class="nota-precios">Te confirmamos stock y entrega por WhatsApp.</p>' +
      '<form id="form-pedido">' +
      '<div class="campo"><label for="nombre">Tu nombre</label><input id="nombre" autocomplete="name" placeholder="Ej: Juan"></div>' +
      '<fieldset class="campo" style="border:0;padding:0;margin-top:14px"><legend style="font-size:14px;padding:0 0 6px">Entrega</legend><div class="opciones">' +
      '<label class="opcion"><input type="radio" name="entrega" value="Retiro en el local" checked> Retiro en el local</label>' +
      '<label class="opcion"><input type="radio" name="entrega" value="Envío a domicilio"> Envío a domicilio</label></div></fieldset>' +
      '<div class="aviso-retiro" id="aviso-retiro">' + avisoRetiro() + '</div>' +
      '<div id="bloque-envio" hidden>' +
      '<div class="campo"><label for="dir-envio">Dirección de entrega</label><input id="dir-envio" autocomplete="street-address" placeholder="Calle, número y localidad"></div>' +
      '<div class="aviso-retiro">Te cotizamos el envío y te lo pasamos por WhatsApp junto con la confirmación del pedido.</div></div>' +
      '<div class="campo"><label for="nota">Aclaraciones (opcional)</label><textarea id="nota" rows="2" placeholder="Ej: horario en que podés recibir o retirar"></textarea></div>' +
      '<button type="submit" class="btn btn-principal btn-bloque" style="margin-top:20px">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>Enviar pedido por WhatsApp</button>' +
      '<button type="button" class="quitar" data-vaciar style="display:block;margin:12px auto 0">Vaciar pedido</button></form>';
    return h;
  }

  function avisoRetiro() {
    return '<b>Horarios para retirar</b><span style="display:block;white-space:pre-line">' + esc(C.retiro || C.horarios || '') + '</span>';
  }
  // "7 unidades", "12,5 mts", "20 mt2" para el mensaje de WhatsApp
  function cantMensaje(x) {
    var n = P.numero(x.cant), uno = +x.cant === 1;
    var u = { 'metro': 'mts', 'm²': 'mt2', 'kg': 'kg', 'rollo': uno ? 'rollo' : 'rollos', 'placa': uno ? 'placa' : 'placas' }[x.unidad] || (uno ? 'unidad' : 'unidades');
    return n + ' ' + u;
  }
  function mensajePedido(form) {
    var items = P.leerPedido();
    var lineas = ['Hola! Quiero hacer este pedido:', ''];
    items.forEach(function (x) {
      var precio = x.precio == null ? 'precio a consultar' : pesos(subtotal(x));
      if (x.m2) {
        lineas.push('• ' + P.numero(x.cant) + (+x.cant === 1 ? ' corte' : ' cortes') + ' de ' + x.medidas + ' de ' + x.nombre + ' (' + m2Txt(x.m2 * x.cant) + ' mt2' + (x.recargo ? ', pieza chica +' + P.numero(x.recargo) + '%' : '') + ') — ' + precio);
        if (x.formaTxt) lineas.push('   ↳ ' + x.formaTxt + (x.a !== x.l ? ' (mirando la pieza con el lado de ' + P.numero(Math.max(x.a, x.l)) + ' cm arriba)' : '') + (extraTxt(x) ? ' — ' + extraTxt(x) : ''));
      } else lineas.push('• ' + cantMensaje(x) + ' de ' + x.nombre + ' — ' + precio);
    });
    // Link con el dibujo y la lista de todos los cortes (para ver, imprimir o bajar a Excel)
    var cortes = items.filter(function (x) { return x.m2; }).map(function (x) {
      var m = String(x.medidas || '').match(/([\d.,]+)\s*x\s*([\d.,]+)/), num = function (v) { return +String(v).replace(',', '.'); };
      return { nombre: x.nombre, a: x.a || (m ? num(m[1]) : 0), l: x.l || (m ? num(m[2]) : 0), cant: x.cant, forma: x.forma || { esq: [0, 0, 0, 0], bordes: [0, 0, 0, 0] } };
    }).filter(function (c) { return c.a && c.l; });
    if (cortes.length) {
      var url = new URL('dibujo.html#d=' + D.codificar(cortes), location.href).href;
      lineas.push('', '📐 Dibujo y lista de cortes: ' + url);
    }
    var nc = aConsultar(items);
    if (nc === items.length) lineas.push('', '¿Me pasan el precio?');
    else {
      var falta = [];
      if (nc) falta.push(nc + (nc === 1 ? ' producto' : ' productos') + ' a consultar');
      if (items.some(function (x) { return x.extraConsultar; })) falta.push('puntas y filos a consultar');
      lineas.push('', 'Total: ' + pesos(P.totalPedido(items)) + (falta.length ? ' (sin contar ' + falta.join(' ni ') + ')' : ''));
    }
    var nombre = form.querySelector('#nombre').value.trim();
    var entrega = (form.querySelector('input[name=entrega]:checked') || {}).value;
    var nota = form.querySelector('#nota').value.trim();
    if (nombre) lineas.push('Nombre: ' + nombre);
    if (entrega) lineas.push('Entrega: ' + entrega);
    if (entrega === 'Envío a domicilio') {
      var dir = form.querySelector('#dir-envio').value.trim();
      lineas.push('Dirección: ' + dir, '¿Me cotizan el envío?');
    }
    if (nota) lineas.push('Aclaraciones: ' + nota);
    return lineas.join('\n');
  }

  function migas(partes) {
    var h = '<nav class="migas" aria-label="Estás en"><a href="productos.html#">Productos</a>';
    partes.forEach(function (p) { h += ' <span aria-hidden="true">›</span> ' + (p[1] ? '<a href="' + p[1] + '">' + esc(p[0]) + '</a>' : '<span>' + esc(p[0]) + '</span>'); });
    return h + '</nav>';
  }
  function flecha() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A968F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  }

  // ---------- Navegación ----------
  function render(mantenerScroll) {
    var h = new URLSearchParams(location.hash.slice(1));
    var html, buscar = $('buscar');
    if (h.has('pedido')) html = vistaPedido();
    else if (h.get('q')) { html = vistaBusqueda(h.get('q')); if (document.activeElement !== buscar) buscar.value = h.get('q'); }
    else if (h.get('c') && h.get('p')) html = vistaProducto(h.get('c'), h.get('p'));
    else if (h.get('c')) html = vistaCategoria(h.get('c'));
    else html = vistaInicio();
    if (!h.get('q') && document.activeElement !== buscar) buscar.value = '';
    $('form-buscar').hidden = h.has('pedido');
    $('contenido').innerHTML = html;
    pintarCarrito();
    if (!mantenerScroll) window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var cont = $('contenido');

    var visor = $('visor');
    function abrirVisor(src, titulo) {
      $('visor-img').src = src; $('visor-img').alt = titulo || ''; $('visor-titulo').textContent = titulo || '';
      if (visor.showModal) visor.showModal(); else visor.setAttribute('open', '');
    }
    function cerrarVisor() { if (visor.close) visor.close(); else visor.removeAttribute('open'); }
    $('visor-cerrar').addEventListener('click', cerrarVisor);
    visor.addEventListener('click', function (e) { if (e.target === visor || e.target.id === 'visor-img') cerrarVisor(); });
    visor.addEventListener('close', function () { $('visor-img').removeAttribute('src'); });

    cont.addEventListener('click', function (e) {
      var z = e.target.closest('[data-pieza]'); if (z) { tocarForma(z); return; }
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ver) { abrirVisor(b.dataset.ver, b.dataset.titulo); return; }
      var h = new URLSearchParams(location.hash.slice(1));
      if (b.dataset.dim) {
        var sel = seleccion[h.get('c') + '|' + h.get('p')];
        sel[b.dataset.dim] = b.dataset.val;
        render(true);
      } else if (b.dataset.corte) {
        if (agregarCorte(b.dataset.corte)) render(true);
      } else if (b.dataset.agregar) {
        var inp = cont.querySelector('input[data-qty="' + b.dataset.agregar + '"]');
        var v = inp ? inp.value : 1;
        if (enPedido(b.dataset.agregar) && +String(v).replace(',', '.') === enPedido(b.dataset.agregar)) return;
        ponerCant(b.dataset.agregar, (+String(v).replace(',', '.') > 0) ? v : 1); render(true);
      } else if (b.dataset.paso) {
        var campo = cont.querySelector('input[data-qty="' + b.dataset.para + '"]');
        var nuevo = Math.max(enPedido(b.dataset.para) ? 0 : 1, Math.round(((+String(campo.value).replace(',', '.') || 0) + (+b.dataset.paso)) * 100) / 100);
        campo.value = nuevo;
        if (enPedido(b.dataset.para)) { ponerCant(b.dataset.para, nuevo); render(true); }
      } else if (b.dataset.menos) {
        cambiarCant(b.dataset.menos, P.leerPedido().filter(function (x) { return x.codigo === b.dataset.menos; })[0].cant - 1); render(true);
      } else if (b.dataset.mas) {
        cambiarCant(b.dataset.mas, P.leerPedido().filter(function (x) { return x.codigo === b.dataset.mas; })[0].cant + 1); render(true);
      } else if (b.dataset.quitar) {
        cambiarCant(b.dataset.quitar, 0); render(true);
      } else if (b.hasAttribute('data-vaciar')) {
        if (confirm('¿Vaciar todo el pedido?')) { P.guardarPedido([]); render(true); }
      }
    });
    cont.addEventListener('change', function (e) {
      if (e.target.name === 'entrega') {
        var esRetiro = e.target.value === 'Retiro en el local';
        if ($('aviso-retiro')) $('aviso-retiro').hidden = !esRetiro;
        if ($('bloque-envio')) { $('bloque-envio').hidden = esRetiro; if (!esRetiro) $('dir-envio').focus(); }
      }
      if (e.target.dataset.cant) { cambiarCant(e.target.dataset.cant, e.target.value); render(true); }
      if (e.target.dataset.qty && enPedido(e.target.dataset.qty)) { ponerCant(e.target.dataset.qty, e.target.value); render(true); }
    });
    cont.addEventListener('input', function (e) {
      var c = e.target.dataset.corteA || e.target.dataset.corteL || e.target.dataset.corteN;
      if (c) actualizarCorte(c);
    });
    cont.addEventListener('keydown', function (e) {
      var z = e.target.closest && e.target.closest('[data-pieza]');
      if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tocarForma(z); return; }
      var c = e.target.dataset.corteA || e.target.dataset.corteL || e.target.dataset.corteN;
      if (c && e.key === 'Enter') { e.preventDefault(); if (agregarCorte(c)) render(true); return; }
      if (e.key === 'Enter' && e.target.dataset.qty) {
        e.preventDefault();
        var btn = cont.querySelector('[data-agregar="' + e.target.dataset.qty + '"]');
        ponerCant(e.target.dataset.qty, e.target.value); render(true);
      }
    });
    cont.addEventListener('submit', function (e) {
      if (e.target.id !== 'form-pedido') return;
      e.preventDefault();
      var envio = (e.target.querySelector('input[name=entrega]:checked') || {}).value === 'Envío a domicilio';
      var dirEl = $('dir-envio');
      if (envio && !dirEl.value.trim()) {
        dirEl.setAttribute('aria-invalid', 'true'); dirEl.focus();
        if (!$('err-dir')) dirEl.insertAdjacentHTML('afterend', '<span id="err-dir" style="color:var(--rojo-osc);font-size:14px">Escribí la dirección para poder cotizarte el envío.</span>');
        return;
      }
      if ($('err-dir')) { $('err-dir').remove(); dirEl.removeAttribute('aria-invalid'); }
      window.open(P.linkWhatsApp(mensajePedido(e.target)), '_blank', 'noopener');
    });

    var t;
    $('buscar').addEventListener('input', function (e) {
      clearTimeout(t);
      var v = e.target.value;
      t = setTimeout(function () {
        history.replaceState(null, '', v.trim() ? hash({ q: v }) : 'productos.html#');
        render(true);
      }, 150);
    });
    $('form-buscar').addEventListener('submit', function (e) { e.preventDefault(); $('buscar').blur(); });

    window.addEventListener('hashchange', function () { render(false); });
    document.addEventListener('pedido-cambio', pintarCarrito);

    function iniciar() {
      cont.innerHTML = '<p class="cargando">Cargando productos…</p>';
      cargar().then(function (d) {
        d.forEach(function (r) { if (esAdicional(r)) adic[ADICIONALES[String(r.codigo).toUpperCase()]] = r.precio; });
        datos = d.filter(function (r) { return !esAdicional(r); });
        datos.forEach(function (r) { porCodigo[r.codigo] = r; });
        refrescarPrecios();
        render(true);
      }).catch(function () {
        cont.innerHTML = '<div class="aviso">No pudimos cargar los productos. Revisá tu conexión y <button type="button" class="enlace" id="reintentar" style="border:0;background:none;padding:0;cursor:pointer">probá de nuevo</button>, o escribinos por WhatsApp.</div>';
        $('reintentar').onclick = iniciar;
        pintarCarrito();
      });
    }
    iniciar();
  });
})();
