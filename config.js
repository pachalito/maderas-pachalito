// ============================================================
//  DATOS DE MADERAS PACHALITO
//  Este es el único archivo que tenés que tocar para cambiar
//  los datos de contacto. Escribí entre las comillas.
// ============================================================
window.CONFIG = {
  // Número de WhatsApp donde llegan los pedidos.
  // Solo números, con 549 adelante y sin el 15. Ejemplo: '5491123456789'
  // Si lo dejás vacío, WhatsApp le pide al cliente que elija el contacto.
  whatsapp: '5491161890049',

  telefono: '11 6189-0049',
  direccion: 'Pedro Díaz 3020',
  localidad: 'Hurlingham',
  // Horario de atención al público (\n = nuevo renglón)
  horarios: 'Lunes a viernes de 8:00 a 11:45 hs\nSábados de 8:00 a 12:30 hs',
  // Horario para retirar pedidos (dejalo vacío '' para que no aparezca)
  retiro: 'Lunes a viernes de 8:00 a 11:45 hs y de 13:30 a 17:00 hs\nSábados de 8:00 a 12:30 hs\nPor la tarde, solo con el pedido realizado previamente',
  email: '',

  // Cortes a medida: precio adicional POR PIEZA de cada punta redondeada y de cada borde
  // con el filo matado. Lo mejor es cargarlos desde Administración como artículos con
  // código ADIC-PUNTA y ADIC-FILO. Estos números se usan solo si esos artículos no existen.
  // En 0, al cliente le aparece "a consultar".
  precioPunta: 0,
  precioFilo: 0,

  // Conexión con Supabase (no tocar)
  supabaseUrl: 'https://qgimqttnilnqudswwhke.supabase.co',
  supabaseKey: 'sb_publishable_iW6t71iHGRDsrYZfhfrfAw_ygTzKpTb'
};
