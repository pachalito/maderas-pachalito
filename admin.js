// Maderas Pachalito — página de administración
(function () {
  var C = window.CONFIG, P = window.PACHALITO, esc = P.esc, pesos = P.pesos;
  var SES = 'pachalito-admin', ADMIN = 'pachalitomaderas@gmail.com', BUCKET = 'productos';
  var CATEGORIAS = ['Maderas', 'Machimbres', 'Molduras', 'Placas y tableros', 'Chapas y perfiles', 'Decks y revestimientos', 'Aislantes', 'Protectores y barnices', 'Clavos y fijaciones', 'Herrajes y soportes', 'Muebles'];
  var UNIDADES = ['unidad', 'metro', 'm²', 'kg', 'rollo', 'placa'];
  var datos = [], porCodigo = {}, abierto = null, listaRevisada = null;
  var $ = function (id) { return document.getElementById(id); };

  // ================= Sesión =================
  function sesion() { try { return JSON.parse(localStorage.getItem(SES)); } catch (e) { return null; } }
  function guardarSesion(d) {
    var s = { access_token: d.access_token, refresh_token: d.refresh_token, expira: Date.now() + (d.expires_in || 3600) * 1000, email: (d.user && d.user.email) || (sesion() || {}).email };
    try { localStorage.setItem(SES, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function borrarSesion() { try { localStorage.removeItem(SES); } catch (e) {} }

  function auth(tipo, cuerpo) {
    return fetch(C.supabaseUrl + '/auth/v1/token?grant_type=' + tipo, {
      method: 'POST', headers: { apikey: C.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }
  function token() {
    var s = sesion();
    if (!s) return Promise.reject({ sinSesion: true });
    if (s.expira - Date.now() > 60000) return Promise.resolve(s.access_token);
    return auth('refresh_token', { refresh_token: s.refresh_token }).then(function (d) { return guardarSesion(d).access_token; })
      .catch(function () { borrarSesion(); mostrar('login'); throw { sinSesion: true }; });
  }

  // ================= Supabase =================
  function rest(metodo, ruta, cuerpo, prefer) {
    return token().then(function (t) {
      var h = { apikey: C.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' };
      if (prefer) h.Prefer = prefer;
      return fetch(C.supabaseUrl + '/rest/v1/' + ruta, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    }).then(function (r) {
      return r.text().then(function (x) {
        var j = x ? JSON.parse(x) : null;
        if (!r.ok) throw { status: r.status, detalle: j };
        return j;
      });
    });
  }
  function filtroCodigo(c) { return 'codigo=eq.' + encodeURIComponent(c); }
  function cambiar(codigo, campos) {
    return rest('PATCH', 'productos?' + filtroCodigo(codigo), campos, 'return=representation').then(function (filas) {
      if (!filas || !filas.length) throw { sinPermiso: true };
      var r = porCodigo[codigo]; Object.assign(r, filas[0]); r._t = null;
      limpiarCacheCatalogo();
      return r;
    });
  }
  function subirFoto(nombre, blob) {
    return token().then(function (t) {
      return fetch(C.supabaseUrl + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(nombre) + '.jpg', {
        method: 'POST', headers: { apikey: C.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' }, body: blob
      });
    }).then(function (r) { if (!r.ok) return r.text().then(function (x) { throw { status: r.status, detalle: x }; }); });
  }
  function borrarFoto(nombre) {
    if (!nombre || /^https?:/.test(nombre)) return Promise.resolve();
    return token().then(function (t) {
      return fetch(C.supabaseUrl + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(nombre) + '.jpg', { method: 'DELETE', headers: { apikey: C.supabaseKey, Authorization: 'Bearer ' + t } });
    }).catch(function () {});
  }
  function fotoUrl(nombre) {
    if (!nombre) return '';
    if (/^https?:/.test(nombre)) return nombre;
    return C.supabaseUrl + '/storage/v1/object/public/' + BUCKET + '/' + encodeURIComponent(nombre) + '.jpg';
  }
  function limpiarCacheCatalogo() { try { sessionStorage.removeItem('pachalito-catalogo-v3'); } catch (e) {} }

  function cargarTodo() {
    var todo = [];
    function pagina(desde) {
      return rest('GET', 'productos?select=*&order=codigo.asc&limit=1000&offset=' + desde).then(function (d) {
        todo = todo.concat(d);
        return d.length < 1000 ? todo : pagina(desde + d.length);
      });
    }
    return pagina(0);
  }

  // ================= Utilidades =================
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/["”“]/g, '').replace(/\s+/g, ' ').trim(); }
  function slug(s) { return norm(s).replace(/\//g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function unicos(a) { return a.filter(function (v, i) { return v != null && v !== '' && a.indexOf(v) === i; }).sort(function (x, y) { return String(x).localeCompare(String(y), 'es', { numeric: true }); }); }
  // "7.950", "$ 7.950,50", "7950.5" -> número
  function leerPrecio(txt) {
    var s = String(txt == null ? '' : txt).replace(/[$\s]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = +s;
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  }
  // '1 1/2"' -> 1.5 ; '18 mm' -> 18 ; 'Cal. 25' -> 25
  function orden(m) {
    if (!m) return null;
    var s = String(m).replace(/["”]/g, '').replace(',', '.'), t = 0, ok = false;
    var mm = s.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/); if (mm) return +mm[1];
    var cal = s.match(/cal\.?\s*(\d+)/i); if (cal) return +cal[1];
    s.split(/\s+/).forEach(function (p) {
      if (/^\d+\/\d+$/.test(p)) { var a = p.split('/'); t += a[0] / a[1]; ok = true; }
      else if (/^\d+(\.\d+)?$/.test(p)) { t += +p; ok = true; }
    });
    return ok ? Math.round(t * 10000) / 10000 : null;
  }
  function msg(cont, tipo, texto) { $(cont).innerHTML = texto ? '<div class="mensaje ' + tipo + '">' + texto + '</div>' : ''; }
  function textoError(e) {
    if (e && e.sinPermiso) return 'No se guardó: tu cuenta todavía no tiene permiso para modificar. Corré el archivo <b>4_permisos_admin.sql</b> en Supabase.';
    if (e && e.sinSesion) return 'Se cerró la sesión. Volvé a entrar.';
    if (e && e.status === 409) return 'Ya existe un producto con ese código.';
    if (e && e.status === 413) return 'La foto es demasiado pesada.';
    return 'No se pudo guardar. Revisá la conexión y probá de nuevo.' + (e && e.status ? ' (error ' + e.status + ')' : '');
  }

  // Achica la foto antes de subirla (máx. 1200 px, liviana para el celular)
  function prepararFoto(archivo) {
    return new Promise(function (ok, mal) {
      var img = new Image(), url = URL.createObjectURL(archivo);
      img.onload = function () {
        var max = 1200, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : mal(new Error('foto')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto')); };
      img.src = url;
    });
  }

  // ================= Vistas =================
  function mostrar(v) {
    $('vista-cargando').hidden = v !== 'cargando';
    $('vista-login').hidden = v !== 'login';
    $('vista-clave').hidden = v !== 'clave';
    $('vista-panel').hidden = v !== 'panel';
    $('salir').hidden = v !== 'panel';
  }

  function resumen() {
    var sin = datos.filter(function (r) { return r.precio == null; }).length;
    var ocultos = datos.filter(function (r) { return !r.activo; }).length;
    var consultar = datos.filter(function (r) { return r.mostrar_precio === false; }).length;
    $('resumen').textContent = datos.length + ' productos · ' + (datos.length - sin) + ' con precio · ' + sin + ' sin precio' + (consultar ? ' · ' + consultar + ' con precio a consultar' : '') + (ocultos ? ' · ' + ocultos + ' ocultos' : '');
  }

  function filasFiltradas() {
    var q = norm($('buscar-admin').value).split(' ').filter(Boolean);
    var cat = $('filtro-cat').value, sp = $('filtro-sinprecio').checked, oc = $('filtro-oculto').checked, cc = $('filtro-consultar').checked;
    return datos.filter(function (r) {
      if (cat && r.categoria !== cat) return false;
      if (sp && r.precio != null) return false;
      if (oc && r.activo) return false;
      if (cc && r.mostrar_precio !== false) return false;
      if (!q.length) return true;
      var t = r._t || (r._t = norm([r.codigo, r.nombre, r.categoria, r.producto, r.material, r.variante].join(' ')));
      return q.every(function (p) { return t.indexOf(p) >= 0; });
    });
  }

  function pintarLista() {
    var res = filasFiltradas(), max = 60;
    var hayFiltro = $('buscar-admin').value.trim() || $('filtro-cat').value || $('filtro-sinprecio').checked || $('filtro-oculto').checked || $('filtro-consultar').checked;
    if (!hayFiltro) { $('lista-admin').innerHTML = '<p class="ayuda" style="margin-top:14px">Escribí un código o nombre, o elegí una categoría.</p>'; return; }
    var h = '<p class="ayuda" style="margin-top:14px">' + res.length + (res.length === 1 ? ' producto' : ' productos') + (res.length > max ? ' · mostrando los primeros ' + max + ', escribí más para afinar' : '') + '</p>';
    res.slice(0, max).forEach(function (r) { h += filaAdmin(r); });
    $('lista-admin').innerHTML = h;
    if (abierto && porCodigo[abierto]) abrirEditor(abierto);
  }

  function filaAdmin(r) {
    var id = 'p-' + slug(r.codigo), foto = fotoUrl(r.imagen || r.foto);
    return '<div class="fila-admin" data-fila="' + esc(r.codigo) + '">' +
      (foto ? '<img class="mini" src="' + esc(foto) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<div class="mini" aria-hidden="true"></div>') +
      '<div class="info"><b>' + esc(r.nombre) + '</b><small>' + esc(r.codigo) + ' · ' + esc(r.categoria) + (r.unidad ? ' · por ' + esc(r.unidad) : '') + '</small></div>' +
      '<div class="controles">' +
      '<label class="oculto" for="' + id + '">Precio de ' + esc(r.nombre) + '</label>' +
      '<span class="precio-input">$<input id="' + id + '" inputmode="decimal" autocomplete="off" value="' + (r.precio == null ? '' : esc(P.numero(r.precio))) + '" placeholder="sin precio" data-precio="' + esc(r.codigo) + '"></span>' +
      '<label class="interruptor"><input type="checkbox" data-activo="' + esc(r.codigo) + '"' + (r.activo ? ' checked' : '') + '> Visible</label>' +
      '<label class="interruptor"><input type="checkbox" data-mostrar="' + esc(r.codigo) + '"' + (r.mostrar_precio !== false ? ' checked' : '') + '> Precio visible</label>' +
      '<button type="button" class="btn-chico" data-editar="' + esc(r.codigo) + '">Editar y fotos</button>' +
      '<span class="estado" data-estado="' + esc(r.codigo) + '" aria-live="polite"></span>' +
      '</div></div>';
  }
  function estado(codigo, tipo, texto) {
    var el = document.querySelector('[data-estado="' + CSS.escape(codigo) + '"]');
    if (el) { el.className = 'estado ' + tipo; el.textContent = texto; }
  }

  // ---------- Formulario (editar / nuevo) ----------
  function datalist(id, campo) {
    return '<datalist id="' + id + '">' + unicos(datos.map(function (r) { return r[campo]; })).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>';
  }
  function formulario(r, nuevo) {
    r = r || {};
    var pre = nuevo ? 'n-' : 'e-';
    function campo(nombre, etiqueta, valor, extra) {
      return '<div class="campo' + (extra && extra.ancho ? ' ancho2' : '') + '"><label for="' + pre + nombre + '">' + etiqueta + '</label>' +
        '<input id="' + pre + nombre + '" name="' + nombre + '" value="' + esc(valor == null ? '' : valor) + '"' + (extra && extra.lista ? ' list="dl-' + nombre + '"' : '') + (extra && extra.attrs ? ' ' + extra.attrs : '') + '></div>';
    }
    var cats = CATEGORIAS.concat(unicos(datos.map(function (x) { return x.categoria; })).filter(function (c) { return CATEGORIAS.indexOf(c) < 0; }));
    var h = '<form class="grilla-form" data-form="' + (nuevo ? 'nuevo' : esc(r.codigo)) + '" novalidate>' +
      campo('codigo', 'Código', nuevo ? '' : r.codigo, { attrs: nuevo ? 'required autocomplete="off"' : 'readonly' }) +
      campo('precio', 'Precio ($)', r.precio == null ? '' : P.numero(r.precio), { attrs: 'inputmode="decimal" autocomplete="off" placeholder="Vacío = no se muestra"' }) +
      campo('nombre', 'Nombre que ve el cliente', r.nombre, { ancho: 1, attrs: 'required' }) +
      '<div class="campo"><label for="' + pre + 'categoria">Categoría (menú)</label><select id="' + pre + 'categoria" name="categoria">' +
      cats.map(function (c) { return '<option' + (c === r.categoria ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      campo('producto', 'Producto (submenú, ej: Cabio)', r.producto, { lista: 1 }) +
      campo('material', 'Madera o material', r.material, { lista: 1 }) +
      campo('variante', 'Terminación o tipo', r.variante, { lista: 1 }) +
      campo('espesor', 'Espesor (ej: 2")', r.espesor, { lista: 1 }) +
      campo('ancho', 'Ancho (ej: 4")', r.ancho, { lista: 1 }) +
      campo('largo_m', 'Largo en metros (vacío si se vende por metro)', r.largo_m == null ? '' : P.numero(r.largo_m), { attrs: 'inputmode="decimal"' }) +
      '<div class="campo"><label for="' + pre + 'unidad">Se vende por</label><select id="' + pre + 'unidad" name="unidad">' +
      UNIDADES.map(function (u) { return '<option' + (u === (r.unidad || 'unidad') ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div>' +
      campo('detalle', 'Detalle extra (opcional)', r.detalle, { ancho: 1 }) +
      '<label class="interruptor ancho2"><input type="checkbox" name="activo"' + (r.activo === false ? '' : ' checked') + '> Visible en la página</label>' +
      '<label class="interruptor ancho2"><input type="checkbox" name="mostrar_precio"' + (r.mostrar_precio === false ? '' : ' checked') + '> Mostrar el precio (si lo destildás, el cliente ve "Consultar precio")</label>' +
      datalist('dl-producto', 'producto') + datalist('dl-material', 'material') + datalist('dl-variante', 'variante') + datalist('dl-espesor', 'espesor') + datalist('dl-ancho', 'ancho') +
      '</form>';
    return h;
  }
  function leerFormulario(form) {
    var g = function (n) { var el = form.elements[n]; return el ? String(el.value).trim() : ''; };
    var precio = leerPrecio(g('precio')), largo = g('largo_m') ? +g('largo_m').replace(',', '.') : null;
    if (isNaN(precio)) throw 'El precio no es un número válido.';
    if (largo != null && !(largo > 0)) throw 'El largo no es un número válido.';
    if (!g('nombre')) throw 'Falta el nombre.';
    var nulo = function (v) { return v === '' ? null : v; };
    return {
      codigo: g('codigo'), nombre: g('nombre'), categoria: g('categoria'), producto: nulo(g('producto')), material: nulo(g('material')),
      variante: nulo(g('variante')), espesor: nulo(g('espesor')), ancho: nulo(g('ancho')), largo_m: largo, unidad: g('unidad'),
      precio: precio, detalle: nulo(g('detalle')), activo: form.elements.activo.checked, mostrar_precio: form.elements.mostrar_precio.checked,
      espesor_orden: orden(g('espesor')), ancho_orden: orden(g('ancho'))
    };
  }

  function abrirEditor(codigo) {
    document.querySelectorAll('.editor').forEach(function (e) { e.remove(); });
    abierto = codigo;
    var fila = document.querySelector('[data-fila="' + CSS.escape(codigo) + '"]'); if (!fila) return;
    var r = porCodigo[codigo];
    var grupo = r.foto ? datos.filter(function (x) { return x.foto === r.foto; }).length : 1;
    var ed = document.createElement('div'); ed.className = 'editor';
    ed.innerHTML = '<div><b>Fotos</b><div class="fotos-editor" style="margin-top:8px">' +
      '<div class="caja"><img src="' + esc(fotoUrl(r.foto)) + '" alt="Foto del grupo" onerror="this.style.visibility=\'hidden\'">' +
      '<p>Foto del grupo: se ve en ' + grupo + (grupo === 1 ? ' producto' : ' productos') + (grupo > 1 ? ' (todas las medidas de este producto)' : '') + '.</p>' +
      '<label class="btn-chico" style="display:inline-flex;align-items:center;justify-content:center">Cambiar foto del grupo<input type="file" accept="image/*" data-foto-grupo="' + esc(codigo) + '" class="oculto"></label></div>' +
      '<div class="caja"><img src="' + esc(fotoUrl(r.imagen)) + '" alt="Foto propia" onerror="this.style.visibility=\'hidden\'">' +
      '<p>' + (r.imagen ? 'Este producto usa su propia foto en lugar de la del grupo.' : 'Opcional: una foto distinta solo para este producto.') + '</p>' +
      '<label class="btn-chico" style="display:inline-flex;align-items:center;justify-content:center">' + (r.imagen ? 'Cambiar foto propia' : 'Subir foto propia') + '<input type="file" accept="image/*" data-foto-propia="' + esc(codigo) + '" class="oculto"></label>' +
      (r.imagen ? '<button type="button" class="btn-chico" data-quitar-propia="' + esc(codigo) + '">Quitar foto propia</button>' : '') + '</div>' +
      '</div></div>' + '<b>Datos del producto</b>' + formulario(r, false) +
      '<div class="acciones-editor"><div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-principal" data-guardar="' + esc(codigo) + '">Guardar cambios</button>' +
      '<button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button>' +
      '<button type="button" class="btn btn-secundario" data-duplicar="' + esc(codigo) + '">Duplicar</button></div>' +
      '<button type="button" class="btn btn-secundario btn-peligro" data-borrar="' + esc(codigo) + '">Eliminar producto</button></div>' +
      '<div data-msg-editor aria-live="polite"></div>';
    fila.appendChild(ed);
  }
  function msgEditor(tipo, texto) {
    var el = document.querySelector('.editor [data-msg-editor]');
    if (el) el.innerHTML = texto ? '<div class="mensaje ' + tipo + '">' + texto + '</div>' : '';
  }

  function pintarNuevo(base) {
    var r = base ? Object.assign({}, base, { codigo: '' }) : null;
    $('form-nuevo-cont').innerHTML = formulario(r, true) +
      '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button type="button" class="btn btn-principal" id="crear">Agregar producto</button></div>' +
      '<p class="ayuda">Las fotos se agregan después de crearlo, desde <b>Editar y fotos</b>.</p><div id="msg-nuevo" aria-live="polite"></div>';
  }

  // ---------- Lista masiva ----------
  function leerLista(texto) {
    var filas = [];
    texto.split(/\r?\n/).forEach(function (linea, i) {
      linea = linea.trim(); if (!linea) return;
      var partes = linea.indexOf('\t') >= 0 ? linea.split('\t') : linea.split(/[;]/);
      var codigo, precioTxt;
      if (partes.length >= 2) { codigo = partes[0].trim(); precioTxt = partes[partes.length - 1].trim(); }
      else { var m = linea.match(/^(.*\S)\s+(\$?\s*[\d.,]+)$/); if (m) { codigo = m[1].trim(); precioTxt = m[2]; } }
      var precio = leerPrecio(precioTxt);
      var r = codigo && (porCodigo[codigo] || porCodigo[codigo.toUpperCase()]);
      filas.push({ linea: i + 1, texto: linea, codigo: r ? r.codigo : codigo, r: r, precio: precio });
    });
    return filas;
  }
  function revisarLista() {
    var filas = leerLista($('texto-lista').value);
    if (!filas.length) { msg('msg-lista', 'info', 'Pegá al menos una línea con código y precio.'); $('aplicar-lista').disabled = true; return; }
    var validas = filas.filter(function (f) { return f.r && f.precio != null && !isNaN(f.precio) && f.precio !== f.r.precio; });
    var iguales = filas.filter(function (f) { return f.r && f.precio === f.r.precio; });
    var malas = filas.filter(function (f) { return !f.r || f.precio == null || isNaN(f.precio); });
    var h = '<b>' + validas.length + '</b> precios para cambiar' + (iguales.length ? ' · ' + iguales.length + ' ya tienen ese precio' : '') + (malas.length ? ' · <b>' + malas.length + '</b> líneas con problemas' : '') + '.';
    if (validas.length) {
      h += '<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:14px"><tr style="text-align:left"><th>Código</th><th>Producto</th><th style="text-align:right">Antes</th><th style="text-align:right">Ahora</th></tr>' +
        validas.slice(0, 200).map(function (f) {
          var antes = f.r.precio, cambio = antes ? (f.precio - antes) / antes : null, raro = cambio != null && Math.abs(cambio) > 0.5;
          return '<tr style="border-top:1px solid #E2D9CC"><td>' + esc(f.codigo) + '</td><td>' + esc(f.r.nombre) + '</td><td style="text-align:right">' + (antes == null ? '—' : pesos(antes)) + '</td><td style="text-align:right;' + (raro ? 'color:#A80008;font-weight:700' : '') + '">' + pesos(f.precio) + (cambio != null ? ' <small>(' + (cambio > 0 ? '+' : '') + Math.round(cambio * 100) + '%)</small>' : '') + '</td></tr>';
        }).join('') + '</table></div>' + (validas.length > 200 ? '<p class="ayuda">Y ' + (validas.length - 200) + ' más.</p>' : '') +
        (validas.some(function (f) { return f.r.precio && Math.abs(f.precio - f.r.precio) / f.r.precio > 0.5; }) ? '<p class="ayuda" style="color:#A80008">Los marcados en rojo cambian más de un 50%: revisá que no falte o sobre un cero.</p>' : '');
    }
    if (malas.length) h += '<p class="ayuda" style="margin-top:10px">No se van a cambiar:</p><ul class="ayuda">' + malas.slice(0, 30).map(function (f) { return '<li>Línea ' + f.linea + ': "' + esc(f.texto) + '" · ' + (!f.r ? 'no existe ese código' : 'el precio no es un número') + '</li>'; }).join('') + '</ul>';
    msg('msg-lista', validas.length ? 'info' : 'error', h);
    listaRevisada = validas;
    $('aplicar-lista').disabled = !validas.length;
  }
  function aplicarLista() {
    var pend = (listaRevisada || []).slice(), hechos = 0, errores = [], total = pend.length;
    if (!total) return;
    $('aplicar-lista').disabled = true; $('revisar-lista').disabled = true;
    function trabajador() {
      var f = pend.shift(); if (!f) return Promise.resolve();
      return cambiar(f.codigo, { precio: f.precio }).then(function () { hechos++; }, function (e) { errores.push(f.codigo + (e && e.sinPermiso ? ' (sin permiso)' : '')); })
        .then(function () { msg('msg-lista', 'info', 'Guardando… ' + (hechos + errores.length) + ' de ' + total); return trabajador(); });
    }
    Promise.all([trabajador(), trabajador(), trabajador(), trabajador(), trabajador(), trabajador()]).then(function () {
      $('revisar-lista').disabled = false; listaRevisada = null; resumen();
      if (errores.length) msg('msg-lista', 'error', 'Se guardaron ' + hechos + ' precios. No se pudieron guardar ' + errores.length + ': ' + esc(errores.slice(0, 20).join(', ')));
      else { msg('msg-lista', 'ok', '✓ Listo: se actualizaron ' + hechos + ' precios. Ya se ven en la página.'); $('texto-lista').value = ''; }
    });
  }

  // ================= Eventos =================
  function iniciarPanel() {
    mostrar('cargando');
    return cargarTodo().then(function (d) {
      datos = d; porCodigo = {}; datos.forEach(function (r) { porCodigo[r.codigo] = r; });
      $('filtro-cat').innerHTML = '<option value="">Todas</option>' + unicos(datos.map(function (r) { return r.categoria; })).map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
      resumen(); pintarLista(); pintarNuevo(); mostrar('panel');
    }).catch(function (e) {
      if (e && e.sinSesion) return;
      mostrar('login'); msg('msg-login', 'error', 'No se pudieron cargar los productos. Si Supabase está pausado, reactivalo desde supabase.com y volvé a entrar.');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var modo = 'entrar';
    var volver = location.origin + location.pathname;
    function ponerModo(m) {
      modo = m; msg('msg-login', '', '');
      $('titulo-login').textContent = { entrar: 'Iniciar sesión', crear: 'Crear mi cuenta', olvide: 'Recuperar contraseña' }[m];
      $('btn-login').textContent = { entrar: 'Entrar', crear: 'Crear cuenta', olvide: 'Mandarme el mail' }[m];
      $('campo-clave').hidden = m === 'olvide'; $('clave').required = m !== 'olvide';
      $('clave').autocomplete = m === 'crear' ? 'new-password' : 'current-password';
      $('campo-clave2').hidden = m !== 'crear'; $('clave2').required = m === 'crear';
      document.querySelectorAll('[data-modo]').forEach(function (x) { x.hidden = m === 'entrar' ? x.dataset.modo === 'entrar' : x.dataset.modo !== 'entrar'; });
    }
    document.querySelectorAll('[data-modo]').forEach(function (x) { x.addEventListener('click', function () { ponerModo(x.dataset.modo); }); });
    function post(ruta, cuerpo) {
      return fetch(C.supabaseUrl + '/auth/v1/' + ruta, { method: 'POST', headers: { apikey: C.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
        .then(function (r) { return r.text().then(function (x) { var j = x ? JSON.parse(x) : {}; if (!r.ok) throw j; return j; }); });
    }
    function textoAuth(err) {
      var t = (err && (err.error_description || err.msg || err.message || err.error_code)) || '';
      if (/invalid login|invalid_credentials/i.test(t)) return 'Email o contraseña incorrectos.';
      if (/not confirmed/i.test(t)) return 'Todavía no confirmaste tu cuenta: abrí el mail que te mandamos y tocá el link.';
      if (/signups? not allowed|signup_disabled/i.test(t)) return 'El registro está apagado en Supabase. Prendelo un momento (Authentication → Sign In / Providers → Allow new users to sign up), creá la cuenta y después volvé a apagarlo.';
      if (/already registered|user_already_exists/i.test(t)) return 'Ya tenés cuenta con ese mail. Tocá "Olvidé mi contraseña" si no te acordás la contraseña.';
      if (/rate limit|too many|over_email_send/i.test(t)) return 'Se pidieron demasiados mails seguidos. Esperá una hora y probá de nuevo.';
      if (/password/i.test(t)) return 'La contraseña tiene que tener al menos 8 caracteres.';
      return 'No se pudo completar. ' + esc(t);
    }
    $('form-login').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('email').value.trim().toLowerCase(), clave = $('clave').value;
      if (modo !== 'entrar' && email !== ADMIN) { msg('msg-login', 'error', 'Solo la cuenta ' + ADMIN + ' puede administrar la página.'); return; }
      if (modo === 'crear' && clave !== $('clave2').value) { msg('msg-login', 'error', 'Las dos contraseñas no coinciden.'); return; }
      if (modo === 'crear' && clave.length < 8) { msg('msg-login', 'error', 'La contraseña tiene que tener al menos 8 caracteres.'); return; }
      msg('msg-login', 'info', modo === 'entrar' ? 'Entrando…' : 'Enviando…');
      if (modo === 'crear') {
        post('signup?redirect_to=' + encodeURIComponent(volver), { email: email, password: clave }).then(function (d) {
          if (d.access_token) { guardarSesion(d); iniciarPanel(); return; }
          var u = d.user || d;
          if (u.identities && u.identities.length === 0) { msg('msg-login', 'error', textoAuth({ msg: 'already registered' })); return; }
          $('clave').value = ''; $('clave2').value = '';
          msg('msg-login', 'ok', '✓ Listo. Te mandamos un mail a <b>' + esc(email) + '</b>: abrilo y tocá el link para confirmar la cuenta. Después volvés acá y entrás con tu contraseña. Si no llega, mirá en Spam.');
        }).catch(function (err) { msg('msg-login', 'error', textoAuth(err)); });
      } else if (modo === 'olvide') {
        post('recover?redirect_to=' + encodeURIComponent(volver), { email: email }).then(function () {
          msg('msg-login', 'ok', '✓ Te mandamos un mail a <b>' + esc(email) + '</b> con un link para elegir una contraseña nueva. Si no llega, mirá en Spam.');
        }).catch(function (err) { msg('msg-login', 'error', textoAuth(err)); });
      } else {
        auth('password', { email: email, password: clave }).then(function (d) {
          if ((d.user && d.user.email || '').toLowerCase() !== ADMIN) { msg('msg-login', 'error', 'Esta cuenta no tiene permiso para administrar la página.'); return; }
          guardarSesion(d); $('clave').value = ''; msg('msg-login', '', ''); iniciarPanel();
        }).catch(function (err) { msg('msg-login', 'error', textoAuth(err)); });
      }
    });
    $('form-clave').addEventListener('submit', function (e) {
      e.preventDefault();
      var a1 = $('nueva1').value, a2 = $('nueva2').value;
      if (a1.length < 8) { msg('msg-clave', 'error', 'La contraseña tiene que tener al menos 8 caracteres.'); return; }
      if (a1 !== a2) { msg('msg-clave', 'error', 'Las dos contraseñas no coinciden.'); return; }
      msg('msg-clave', 'info', 'Guardando…');
      token().then(function (t) {
        return fetch(C.supabaseUrl + '/auth/v1/user', { method: 'PUT', headers: { apikey: C.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: a1 }) });
      }).then(function (r) { if (!r.ok) return r.json().then(function (j) { throw j; }); iniciarPanel(); })
        .catch(function (err) { msg('msg-clave', 'error', textoAuth(err)); });
    });

    // Al volver del link del mail (confirmar cuenta o recuperar contraseña)
    var vuelta = new URLSearchParams(location.hash.slice(1)), arranque = null;
    if (vuelta.get('error_description')) {
      history.replaceState(null, '', location.pathname); borrarSesion(); arranque = 'link-vencido';
    } else if (vuelta.get('access_token')) {
      guardarSesion({ access_token: vuelta.get('access_token'), refresh_token: vuelta.get('refresh_token'), expires_in: +vuelta.get('expires_in') || 3600, user: { email: ADMIN } });
      history.replaceState(null, '', location.pathname);
      if (vuelta.get('type') === 'recovery') arranque = 'clave';
    }

    $('salir').addEventListener('click', function () {
      token().then(function (t) { return fetch(C.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: { apikey: C.supabaseKey, Authorization: 'Bearer ' + t } }); }).catch(function () {});
      borrarSesion(); datos = []; mostrar('login');
    });

    document.querySelectorAll('[data-pestana]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('[data-pestana]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
        document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== b.dataset.pestana; });
      });
    });

    var t;
    ['buscar-admin'].forEach(function (id) { $(id).addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { abierto = null; pintarLista(); }, 150); }); });
    ['filtro-cat', 'filtro-sinprecio', 'filtro-oculto', 'filtro-consultar'].forEach(function (id) { $(id).addEventListener('change', function () { abierto = null; pintarLista(); }); });

    var lista = $('lista-admin');
    // Precio rápido: se guarda al salir del casillero o con Enter
    lista.addEventListener('change', function (e) {
      var el = e.target;
      if (el.dataset.precio) {
        var c = el.dataset.precio, p = leerPrecio(el.value);
        if (isNaN(p)) { estado(c, 'error', 'Precio inválido'); return; }
        if (p === porCodigo[c].precio) return;
        estado(c, '', 'Guardando…');
        cambiar(c, { precio: p }).then(function (r) { el.value = r.precio == null ? '' : P.numero(r.precio); estado(c, 'ok', '✓ Guardado'); resumen(); }, function (err) { estado(c, 'error', 'No se guardó'); alertar(err); });
      } else if (el.dataset.activo) {
        var c2 = el.dataset.activo;
        estado(c2, '', 'Guardando…');
        cambiar(c2, { activo: el.checked }).then(function () { estado(c2, 'ok', el.checked ? '✓ Visible' : '✓ Oculto'); resumen(); }, function (err) { el.checked = !el.checked; estado(c2, 'error', 'No se guardó'); alertar(err); });
      } else if (el.dataset.mostrar) {
        var c3 = el.dataset.mostrar;
        estado(c3, '', 'Guardando…');
        cambiar(c3, { mostrar_precio: el.checked }).then(function () { estado(c3, 'ok', el.checked ? '✓ Precio visible' : '✓ A consultar'); resumen(); }, function (err) { el.checked = !el.checked; estado(c3, 'error', 'No se guardó. ¿Corriste 5_precio_a_consultar.sql?'); alertar(err); });
      } else if (el.dataset.fotoGrupo || el.dataset.fotoPropia) {
        cambiarFoto(el);
      }
    });
    lista.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset.precio) { e.preventDefault(); e.target.blur(); } });

    lista.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.editar) { if (abierto === b.dataset.editar) { abierto = null; document.querySelectorAll('.editor').forEach(function (x) { x.remove(); }); } else abrirEditor(b.dataset.editar); }
      else if (b.hasAttribute('data-cerrar')) { abierto = null; b.closest('.editor').remove(); }
      else if (b.dataset.guardar) guardarEditor(b.dataset.guardar, b);
      else if (b.dataset.duplicar) { pintarNuevo(porCodigo[b.dataset.duplicar]); document.querySelector('[data-pestana="nuevo"]').click(); window.scrollTo(0, 0); $('n-codigo').focus(); }
      else if (b.dataset.borrar) borrarProducto(b.dataset.borrar);
      else if (b.dataset.quitarPropia) quitarPropia(b.dataset.quitarPropia);
    });

    $('elegir-fotos').addEventListener('change', function () { elegirFotos(this); });
    $('subir-fotos').addEventListener('click', subirMuchasFotos);
    $('revisar-lista').addEventListener('click', revisarLista);
    $('aplicar-lista').addEventListener('click', aplicarLista);
    $('texto-lista').addEventListener('input', function () { $('aplicar-lista').disabled = true; });

    $('form-nuevo-cont').addEventListener('click', function (e) {
      if (e.target.id !== 'crear') return;
      var form = document.querySelector('[data-form="nuevo"]'), r;
      try { r = leerFormulario(form); } catch (err) { msg('msg-nuevo', 'error', err); return; }
      if (!r.codigo) { msg('msg-nuevo', 'error', 'Falta el código.'); return; }
      if (porCodigo[r.codigo]) { msg('msg-nuevo', 'error', 'Ya existe un producto con el código ' + esc(r.codigo) + '.'); return; }
      var base = datos.filter(function (x) { return x.categoria === r.categoria && x.producto === r.producto && x.material === r.material && x.variante === r.variante && x.foto; })[0];
      if (base) r.foto = base.foto;
      msg('msg-nuevo', 'info', 'Guardando…');
      rest('POST', 'productos', r, 'return=representation').then(function (filas) {
        if (!filas || !filas.length) throw { sinPermiso: true };
        datos.push(filas[0]); porCodigo[r.codigo] = filas[0]; limpiarCacheCatalogo(); resumen();
        pintarNuevo();
        msg('msg-nuevo', 'ok', '✓ Se agregó <b>' + esc(r.nombre) + '</b>' + (r.precio == null ? ' (sin precio, no se muestra hasta que le cargues uno)' : '') + '.' + (base ? ' Usa la misma foto que los demás ' + esc(r.producto) + '.' : ''));
      }).catch(function (err) { msg('msg-nuevo', 'error', textoError(err)); });
    });

    if (arranque === 'clave') mostrar('clave');
    else if (arranque === 'link-vencido') { mostrar('login'); msg('msg-login', 'error', 'El link del mail ya no es válido (vencen al rato). Pedí uno nuevo.'); }
    else if (sesion()) iniciarPanel(); else mostrar('login');
  });

  function alertar(err) { if (err && (err.sinPermiso || err.sinSesion)) { var c = document.querySelector('#resumen'); c.innerHTML = '<span style="color:#A80008">' + textoError(err) + '</span>'; } }

  function guardarEditor(codigo, boton) {
    var form = document.querySelector('[data-form="' + CSS.escape(codigo) + '"]'), r;
    try { r = leerFormulario(form); } catch (err) { msgEditor('error', err); return; }
    delete r.codigo;
    boton.disabled = true; msgEditor('info', 'Guardando…');
    cambiar(codigo, r).then(function () {
      boton.disabled = false; resumen(); pintarLista(); msgEditor('ok', '✓ Cambios guardados. Ya se ven en la página.');
    }, function (err) { boton.disabled = false; msgEditor('error', textoError(err)); });
  }

  function borrarProducto(codigo) {
    var r = porCodigo[codigo];
    if (!confirm('¿Eliminar "' + r.nombre + '" (' + codigo + ')? No se puede deshacer.\n\nSi solo querés que no se vea por un tiempo, destildá "Visible".')) return;
    rest('DELETE', 'productos?' + filtroCodigo(codigo), null, 'return=representation').then(function (filas) {
      if (!filas || !filas.length) throw { sinPermiso: true };
      if (r.imagen) borrarFoto(r.imagen);
      datos = datos.filter(function (x) { return x.codigo !== codigo; }); delete porCodigo[codigo];
      abierto = null; limpiarCacheCatalogo(); resumen(); pintarLista();
    }).catch(function (err) { msgEditor('error', textoError(err)); });
  }

  // Sube una foto a un producto: propia (solo ese) o del grupo (todas sus medidas)
  function fotoAProducto(codigo, archivo, grupal) {
    var r = porCodigo[codigo];
    var viejo = grupal ? r.foto : r.imagen;
    var base = grupal ? (r.foto ? r.foto.replace(/-\d{10,}$/, '') : slug([r.producto, r.material, r.variante].join(' ')) || slug(codigo)) : 'p-' + slug(codigo);
    var nuevo = base + '-' + Date.now();
    return prepararFoto(archivo).then(function (blob) { return subirFoto(nuevo, blob); }).then(function () {
      if (!grupal) return cambiar(codigo, { imagen: nuevo });
      if (!r.foto) return cambiar(codigo, { foto: nuevo });
      return rest('PATCH', 'productos?foto=eq.' + encodeURIComponent(r.foto), { foto: nuevo }, 'return=representation').then(function (filas) {
        if (!filas || !filas.length) throw { sinPermiso: true };
        filas.forEach(function (f) { if (porCodigo[f.codigo]) porCodigo[f.codigo].foto = f.foto; });
        limpiarCacheCatalogo();
      });
    }).then(function () { if (viejo) borrarFoto(viejo); });
  }

  function cambiarFoto(input) {
    var archivo = input.files && input.files[0]; if (!archivo) return;
    var grupal = !!input.dataset.fotoGrupo, codigo = input.dataset.fotoGrupo || input.dataset.fotoPropia;
    msgEditor('info', 'Subiendo foto…');
    fotoAProducto(codigo, archivo, grupal).then(function () {
      pintarLista(); msgEditor('ok', '✓ Foto actualizada.');
    }).catch(function (err) { msgEditor('error', err && err.message ? esc(err.message) : textoError(err)); });
  }

  // ================= Muchas fotos (el nombre del archivo es el código) =================
  var fotosElegidas = [];
  function claveCodigo(s) { return String(s || '').toUpperCase().replace(/\s*\(\d+\)$/, '').replace(/[\s_]+/g, '').replace(/,/g, '.').replace(/\//g, '-'); }
  function codigoDeArchivo(nombre) {
    var sin = nombre.replace(/\.[a-z0-9]{2,5}$/i, ''), k = claveCodigo(sin);
    if (porCodigo[sin]) return sin;
    for (var i = 0; i < datos.length; i++) if (claveCodigo(datos[i].codigo) === k) return datos[i].codigo;
    return null;
  }
  function elegirFotos(input) {
    fotosElegidas = Array.prototype.map.call(input.files || [], function (f) { return { archivo: f, codigo: codigoDeArchivo(f.name) }; });
    var ok = fotosElegidas.filter(function (x) { return x.codigo; }), no = fotosElegidas.filter(function (x) { return !x.codigo; });
    var h = '';
    if (ok.length) h += '<div class="mensaje ok"><b>' + ok.length + (ok.length === 1 ? ' foto lista' : ' fotos listas') + ' para subir:</b><br>' +
      ok.map(function (x) { return esc(x.archivo.name) + ' → ' + esc(porCodigo[x.codigo].nombre); }).join('<br>') + '</div>';
    if (no.length) h += '<div class="mensaje error"><b>' + no.length + (no.length === 1 ? ' foto no coincide' : ' fotos no coinciden') + ' con ningún código</b> (no se van a subir):<br>' +
      no.map(function (x) { return esc(x.archivo.name); }).join('<br>') + '<br>Revisá que el nombre sea exactamente el código del producto.</div>';
    $('msg-fotos').innerHTML = h;
    $('subir-fotos').disabled = !ok.length;
    $('subir-fotos').textContent = ok.length ? 'Subir ' + ok.length + (ok.length === 1 ? ' foto' : ' fotos') : 'Subir fotos';
  }
  function subirMuchasFotos() {
    var lista = fotosElegidas.filter(function (x) { return x.codigo; }), grupal = $('fotos-grupo').checked, hechas = 0, fallas = [];
    if (!lista.length) return;
    $('subir-fotos').disabled = true; $('elegir-fotos').disabled = true;
    function siguiente(i) {
      if (i >= lista.length) {
        $('elegir-fotos').disabled = false; $('elegir-fotos').value = ''; fotosElegidas = [];
        $('subir-fotos').textContent = 'Subir fotos';
        $('msg-fotos').innerHTML = '<div class="mensaje ' + (fallas.length ? 'error' : 'ok') + '">✓ Se subieron ' + hechas + ' de ' + lista.length + ' fotos. Ya se ven en la página.' +
          (fallas.length ? '<br>No se pudieron subir: ' + fallas.map(esc).join(', ') + '. Probá de nuevo con esas.' : '') + '</div>';
        pintarLista(); return;
      }
      var x = lista[i];
      $('msg-fotos').innerHTML = '<div class="mensaje info">Subiendo ' + (i + 1) + ' de ' + lista.length + ': ' + esc(x.archivo.name) + '…</div>';
      fotoAProducto(x.codigo, x.archivo, grupal).then(function () { hechas++; }, function (err) {
        fallas.push(x.archivo.name);
        if (err && (err.sinPermiso || err.sinSesion)) { i = lista.length; }
      }).then(function () { siguiente(i + 1); });
    }
    siguiente(0);
  }

  function quitarPropia(codigo) {
    var viejo = porCodigo[codigo].imagen;
    cambiar(codigo, { imagen: null }).then(function () { borrarFoto(viejo); pintarLista(); msgEditor('ok', '✓ Ahora usa la foto del grupo.'); }, function (err) { msgEditor('error', textoError(err)); });
  }
})();
