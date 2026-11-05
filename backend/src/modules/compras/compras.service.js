const { pool, transaccion } = require('../../config/db')
const { validarCedula } = require('../../utils/cedula')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const redondear = (valor) => Math.round(valor * 100) / 100

// Edad cumplida en una fecha dada (ambas en formato 'YYYY-MM-DD')
function edadEn(fechaNacimiento, fecha) {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number)
  const [a, m, d] = fecha.split('-').map(Number)
  return a - an - (m < mn || (m === mn && d < dn) ? 1 : 0)
}

// Métodos de pago y tipos de descuento activos (para los formularios de compra)
async function obtenerCatalogos() {
  const metodos = await pool.query(
    'SELECT id, codigo, nombre, requiere_comprobante FROM metodo_pago WHERE activo ORDER BY id'
  )
  const descuentos = await pool.query(
    'SELECT id, codigo, nombre, porcentaje FROM tipo_descuento WHERE activo ORDER BY id'
  )
  return { metodos_pago: metodos.rows, tipos_descuento: descuentos.rows }
}

/*
  Cuerpo esperado:
  {
    viaje_id, subida (id de ciudad), bajada (id de ciudad), metodo_pago_id,
    pasajeros: [ { asiento_id, cedula, nombre, tipo_descuento_id (opcional) }, ... ]
  }
  El servidor calcula precios y descuentos: nunca se confía en valores del frontend.
*/
async function crear(clienteId, datos) {
  const pasajeros = Array.isArray(datos.pasajeros) ? datos.pasajeros : []
  if (!datos.viaje_id || !datos.subida || !datos.bajada || !datos.metodo_pago_id) {
    throw errorHttp('Faltan datos del viaje, del tramo o del método de pago', 400)
  }
  if (pasajeros.length < 1 || pasajeros.length > 10) {
    throw errorHttp('La compra debe tener entre 1 y 10 pasajeros', 400)
  }
  const asientosPedidos = pasajeros.map((p) => Number(p.asiento_id))
  if (new Set(asientosPedidos).size !== asientosPedidos.length) {
    throw errorHttp('No puedes elegir el mismo asiento dos veces', 400)
  }
  const errores = {}
  pasajeros.forEach((p, i) => {
    if (!validarCedula(p.cedula)) errores[`pasajero_${i + 1}`] = `Cédula no válida del pasajero ${i + 1}`
    else if (!p.nombre?.trim()) errores[`pasajero_${i + 1}`] = `Falta el nombre del pasajero ${i + 1}`
  })
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos de los pasajeros', 400, errores)

  return transaccion(async (cliente) => {
    // Tramo solicitado: orden de subida y bajada, y precio para asiento normal
    const tramo = await cliente.query(
      `SELECT v.id, v.fecha::text AS fecha, v.estado, v.bus_id, f.cooperativa_id,
              po.orden AS orden_subida, pd.orden AS orden_bajada,
              (pd.precio_acumulado - po.precio_acumulado) AS precio_normal
         FROM viaje v
         JOIN frecuencia f ON f.id = v.frecuencia_id
         JOIN parada po ON po.frecuencia_id = f.id AND po.ciudad_id = $2
         JOIN parada pd ON pd.frecuencia_id = f.id AND pd.ciudad_id = $3
        WHERE v.id = $1 AND po.orden < pd.orden`,
      [datos.viaje_id, datos.subida, datos.bajada]
    )
    const viaje = tramo.rows[0]
    if (!viaje) throw errorHttp('Viaje o tramo no encontrado', 404)
    if (viaje.estado !== 'programado') throw errorHttp('Este viaje ya no está disponible para la venta', 409)
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
    if (viaje.fecha < hoy) throw errorHttp('No se pueden comprar boletos de viajes pasados', 409)

    const metodo = await cliente.query('SELECT id FROM metodo_pago WHERE id = $1 AND activo', [datos.metodo_pago_id])
    if (!metodo.rows[0]) throw errorHttp('Método de pago no válido', 400)

    const boletos = []
    for (const p of pasajeros) {
      // El asiento debe pertenecer al bus del viaje; su tipo define el factor de precio
      const asiento = await cliente.query(
        `SELECT a.id, a.numero, ta.factor_precio
           FROM asiento a JOIN tipo_asiento ta ON ta.id = a.tipo_asiento_id
          WHERE a.id = $1 AND a.bus_id = $2`,
        [p.asiento_id, viaje.bus_id]
      )
      if (!asiento.rows[0]) throw errorHttp(`El asiento ${p.asiento_id} no pertenece a este bus`, 400)

      const precioBase = redondear(Number(viaje.precio_normal) * Number(asiento.rows[0].factor_precio))
      let descuento = 0
      let tipoDescuentoId = null

      if (p.tipo_descuento_id) {
        const td = await cliente.query(
          'SELECT id, codigo, nombre, porcentaje FROM tipo_descuento WHERE id = $1 AND activo',
          [p.tipo_descuento_id]
        )
        const tipo = td.rows[0]
        if (!tipo) throw errorHttp('Tipo de descuento no válido', 400)

        // Descuentos por edad: se valida con la fecha de nacimiento del pasajero registrado
        if (tipo.codigo === 'tercera_edad' || tipo.codigo === 'menor_edad') {
          const registro = await cliente.query(
            'SELECT fecha_nacimiento::text AS fecha_nacimiento FROM usuario WHERE cedula = $1',
            [p.cedula]
          )
          const nacimiento = registro.rows[0]?.fecha_nacimiento
          if (!nacimiento) {
            throw errorHttp(`Para el descuento "${tipo.nombre}", el pasajero con cédula ${p.cedula} debe estar registrado`, 400)
          }
          const edad = edadEn(nacimiento, viaje.fecha)
          if (tipo.codigo === 'tercera_edad' && edad < 65) {
            throw errorHttp(`El pasajero con cédula ${p.cedula} no cumple la edad para tercera edad`, 400)
          }
          if (tipo.codigo === 'menor_edad' && edad >= 18) {
            throw errorHttp(`El pasajero con cédula ${p.cedula} no es menor de edad`, 400)
          }
        }
        // Discapacidad: la verifica el oficinista con el carné al validar el pago
        descuento = redondear(precioBase * Number(tipo.porcentaje) / 100)
        tipoDescuentoId = tipo.id
      }

      boletos.push({
        asiento_id: Number(p.asiento_id),
        numero_asiento: asiento.rows[0].numero,
        pasajero_cedula: p.cedula,
        pasajero_nombre: p.nombre.trim(),
        tipo_descuento_id: tipoDescuentoId,
        precio_base: precioBase,
        descuento,
        precio_final: redondear(precioBase - descuento),
      })
    }

    const total = redondear(boletos.reduce((suma, b) => suma + b.precio_final, 0))
    const compra = await cliente.query(
      `INSERT INTO compra (cliente_id, metodo_pago_id, total, estado_pago)
       VALUES ($1, $2, $3, 'pendiente')
       RETURNING id, total, estado_pago, creado_en`,
      [clienteId, datos.metodo_pago_id, total]
    )
    const compraId = compra.rows[0].id

    // Si un asiento ya está vendido en un tramo que se cruza, PostgreSQL
    // rechaza el INSERT (error 23P01 -> 409) y se deshace toda la compra.
    for (const b of boletos) {
      const { rows } = await cliente.query(
        `INSERT INTO boleto (compra_id, viaje_id, asiento_id, pasajero_cedula, pasajero_nombre,
                             tipo_descuento_id, orden_subida, orden_bajada, precio_base, descuento, precio_final)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, codigo, estado`,
        [compraId, viaje.id, b.asiento_id, b.pasajero_cedula, b.pasajero_nombre, b.tipo_descuento_id,
          viaje.orden_subida, viaje.orden_bajada, b.precio_base, b.descuento, b.precio_final]
      )
      Object.assign(b, rows[0])
    }

    return { ...compra.rows[0], boletos }
  })
}

// Historial del cliente: sus compras con el viaje y los boletos
async function listarMias(clienteId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.total, c.estado_pago, c.creado_en, mp.nombre AS metodo_pago,
            json_agg(json_build_object(
              'id', b.id, 'codigo', b.codigo, 'estado', b.estado,
              'pasajero_nombre', b.pasajero_nombre, 'numero_asiento', a.numero,
              'precio_final', b.precio_final
            ) ORDER BY a.numero) AS boletos,
            MIN(v.fecha)::text AS fecha_viaje,
            MIN(f.hora_salida)::text AS hora_salida,
            MIN(coop.nombre) AS cooperativa,
            MIN(cs.nombre) AS origen,
            MIN(cb.nombre) AS destino
       FROM compra c
       JOIN metodo_pago mp ON mp.id = c.metodo_pago_id
       JOIN boleto b ON b.compra_id = c.id
       JOIN asiento a ON a.id = b.asiento_id
       JOIN viaje v ON v.id = b.viaje_id
       JOIN frecuencia f ON f.id = v.frecuencia_id
       JOIN cooperativa coop ON coop.id = f.cooperativa_id
       JOIN parada ps ON ps.frecuencia_id = f.id AND ps.orden = b.orden_subida
       JOIN parada pb ON pb.frecuencia_id = f.id AND pb.orden = b.orden_bajada
       JOIN ciudad cs ON cs.id = ps.ciudad_id
       JOIN ciudad cb ON cb.id = pb.ciudad_id
      WHERE c.cliente_id = $1
      GROUP BY c.id, mp.nombre
      ORDER BY c.creado_en DESC`,
    [clienteId]
  )
  return rows
}

module.exports = { obtenerCatalogos, crear, listarMias }
