# Maderas Pachalito — notas para Claude

Sitio web de una maderera en Hurlingham (Argentina). El dueño no es programador: hablale en
español rioplatense (vos), simple y sin términos técnicos.

## Cómo es el sitio
- HTML, CSS y JavaScript puros, sin build ni frameworks. Cada página es un `.html`.
- Productos y precios vienen de Supabase (tabla `productos`, vista pública `catalogo`).
  Se administran desde `admin.html` / `admin.js`.
- Los datos de contacto y algunos valores se configuran en `config.js`.
- Al cambiar CSS o JS, subir la versión `?v=AAAAMMDDx` en todos los `.html`.
- Desde el contenedor de Claude no hay acceso a Supabase: para probar, simular la respuesta
  de `/rest/v1/catalogo` (por ejemplo con `page.route` de Playwright).

## Cortes a medida (Placas y tableros vendidos por m²)
- `catalogo.js`: calculadora de cortes. Al poner ancho y largo se dibuja la pieza
  (`dibujo-corte.js`). El cliente toca puntas para redondearlas y bordes para "matar el filo"
  (se marcan con cruces).
- Adicional por pieza: precio de cada punta y cada borde. Se toma de los artículos con código
  `ADIC-PUNTA` y `ADIC-FILO` (se cargan en Administración y no se muestran en el catálogo).
  Si no existen, se usan `precioPunta` / `precioFilo` de `config.js`; en 0 = "a consultar".
- Piezas chicas: si una pieza tiene menos de `piezaChicaM2` (0,25 m²), el m² lleva
  `recargoPiezaChica` (50%). Se mira cada pieza por separado. Configurado en `config.js`.
- El mensaje de WhatsApp incluye un link a `dibujo.html#d=...` con todos los cortes
  codificados en el link (no se guardan en ninguna base). Esa página muestra la lista
  de cortes con dibujo y deja descargar Excel (.xlsx con dibujo en caracteres, usa
  `lib/xlsx-js-style.min.js`), CSV o imprimir / guardar PDF.

## Publicación
- Repositorio: GitHub `pachalito/maderas-pachalito`, rama `main`.
- Se publica en Netlify. El dueño tiene pocos créditos ahí: juntar varios cambios y
  publicar una sola vez (zip para arrastrar, o una sola subida). Para ir revisando sin
  gastar, sugerir GitHub Pages.
- Si cambia la dirección del sitio, los links de dibujos ya enviados por WhatsApp dejan de abrir.

## Pendientes (actualizar cuando se resuelvan)
- Crear en Administración los artículos `ADIC-PUNTA` y `ADIC-FILO` con sus precios.
- Confirmar el límite de pieza chica (hoy 0,25 m²).
- Publicar en Netlify la versión con todos los cambios.
- Faltan las fotos del sitio (`img/`, ver `img/LEEME.txt`).
- Ideas ofrecidas y no hechas: vista previa al compartir por WhatsApp (Open Graph),
  datos de negocio local para Google, guardar pedidos en Supabase con pestaña "Pedidos".
