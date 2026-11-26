const fs = require('fs')
const { pool, transaccion } = require('../../config/db')
const { notificar, notificarOficinistas } = require('../../utils/notificar')
const cuentas = require('../cuentas-bancarias/cuentas-bancarias.service')
const { validarCedulaEcuador, validarNombreCompleto, validarFechaNacimiento, limpiar } = require('../../utils/validaciones')

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

  opciones.vendidoPor (CC-14, venta en ventanilla): el oficinista que vende.
  En ese caso el pago es en efectivo, la compra queda aprobada y los boletos emitidos,
  y el viaje debe ser de la cooperativa del oficinista.
*/
/*
  GC-34 - opciones.aBordo (venta del chofer dentro del bus): el viaje debe estar
  EN CURSO y manejado por ese chofer; el pago es en efectivo y los boletos quedan
  como "usados" porque el pasajero ya está a bordo.
*/
async function crear(clienteId, datos, opciones = {}) {
  const aBordo = Boolean(opciones.aBordo)
  const ventanilla = opciones.vendidoPor || null
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
  // CC-21: cédula y nombre de cada pasajero.
  // GC-15: SÍ se permite repetir la cédula (una persona puede comprar dos asientos para ella,
  // o uno para ella y otro para su mascota, siempre que pague cada pasaje).
  pasajeros.forEach((p, i) => {
    const clave = `pasajero_${i + 1}`
    const errorCedula = validarCedulaEcuador(p.cedula)
    const errorNombre = validarNombreCompleto(p.nombre)
    const errorNacimiento = p.fecha_nacimiento ? validarFechaNacimiento(p.fecha_nacimiento) : null
    if (errorCedula) errores[clave] = `Pasajero ${i + 1}: ${errorCedula.charAt(0).toLowerCase()}${errorCedula.slice(1)}`
    else if (errorNombre) errores[clave] = `Pasajero ${i + 1}: ${errorNombre.charAt(0).toLowerCase()}${errorNombre.slice(1)}`
    else if (errorNacimiento) errores[clave] = `Pasajero ${i + 1}: ${errorNacimiento.charAt(0).toLowerCase()}${errorNacimiento.slice(1)}`
  })
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos de los pasajeros', 400, errores)

  return transaccion(async (cliente) => {
    // Tramo solicitado: orden de subida y bajada, y precio para asiento normal
    const tramo = await cliente.query(
      `SELECT v.id, v.fecha::text AS fecha, v.estado, v.bus_id, v.chofer_id, f.cooperativa_id,
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
    if (aBordo) {
      if (viaje.estado !== 'en_curso') throw errorHttp('Solo puedes vender a bordo cuando el viaje está en curso', 409)
      if (viaje.chofer_id !== ventanilla.id) throw errorHttp('Solo el chofer que inició el viaje puede vender a bordo', 403)
    } else if (viaje.estado !== 'programado') {
      throw errorHttp('Este viaje ya no está disponible para la venta', 409)
    }
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
    if (viaje.fecha < hoy) throw errorHttp('No se pueden comprar boletos de viajes pasados', 409)
    if (ventanilla && viaje.cooperativa_id !== ventanilla.cooperativa_id) {
      throw errorHttp('Solo puedes vender boletos de los viajes de tu cooperativa', 403)
    }

    const metodo = await cliente.query('SELECT id, requiere_comprobante FROM metodo_pago WHERE id = $1 AND activo', [datos.metodo_pago_id])
    if (!metodo.rows[0]) throw errorHttp('Método de pago no válido', 400)

    // GC-43: el cliente transfiere o deposita a la cooperativa del viaje: debe tener su cuenta registrada
    let cuentaCooperativa = null
    if (!ventanilla && metodo.rows[0].requiere_comprobante) {
      const coop = await cliente.query(
        `SELECT nombre, cuenta_banco, cuenta_tipo, cuenta_numero, cuenta_titular, cuenta_identificacion
           FROM cooperativa WHERE id = $1`,
        [viaje.cooperativa_id]
      )
      if (!coop.rows[0]?.cuenta_numero) {
        throw errorHttp(`${coop.rows[0]?.nombre || 'La cooperativa'} todavía no registra su cuenta bancaria, así que no recibe pagos por transferencia o depósito. Puedes comprar este viaje en su ventanilla.`, 409)
      }
      cuentaCooperativa = cuentas.formatear(coop.rows[0])
    }

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
          // GC-15: si el pasajero no tiene cuenta, se usa la fecha de nacimiento que ingresó el comprador
          const nacimiento = registro.rows[0]?.fecha_nacimiento || p.fecha_nacimiento
          if (!nacimiento) {
            throw errorHttp(`Para aplicar el descuento "${tipo.nombre}" ingresa la fecha de nacimiento del pasajero con cédula ${p.cedula}`, 400)
          }
          const edad = edadEn(nacimiento, viaje.fecha)
          if (tipo.codigo === 'tercera_edad' && edad < 65) {
            throw errorHttp(`El descuento de tercera edad es para personas de 65 años o más. El pasajero con cédula ${p.cedula} no cumple ese requisito`, 400)
          }
          if (tipo.codigo === 'menor_edad' && edad >= 18) {
            throw errorHttp(`El descuento de menor de edad es para personas de menos de 18 años. El pasajero con cédula ${p.cedula} no cumple ese requisito`, 400)
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
        pasajero_nombre: limpiar(p.nombre),
        tipo_descuento_id: tipoDescuentoId,
        precio_base: precioBase,
        descuento,
        precio_final: redondear(precioBase - descuento),
      })
    }

    const total = redondear(boletos.reduce((suma, b) => suma + b.precio_final, 0))
    const compra = await cliente.query(
      `INSERT INTO compra (cliente_id, metodo_pago_id, total, estado_pago, vendido_por, validado_por, validado_en, a_bordo)
       VALUES ($1, $2, $3, $4, $5, $5, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() END, $6)
       RETURNING id, total, estado_pago, creado_en`,
      [clienteId, datos.metodo_pago_id, total, ventanilla ? 'aprobado' : 'pendiente', ventanilla ? ventanilla.id : null, aBordo]
    )
    const compraId = compra.rows[0].id

    // Si un asiento ya está vendido en un tramo que se cruza, PostgreSQL
    // rechaza el INSERT (error 23P01 -> 409) y se deshace toda la compra.
    for (const b of boletos) {
      const { rows } = await cliente.query(
        `INSERT INTO boleto (compra_id, viaje_id, asiento_id, pasajero_cedula, pasajero_nombre,
                             tipo_descuento_id, orden_subida, orden_bajada, precio_base, descuento, precio_final, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, codigo, estado`,
        [compraId, viaje.id, b.asiento_id, b.pasajero_cedula, b.pasajero_nombre, b.tipo_descuento_id,
          viaje.orden_subida, viaje.orden_bajada, b.precio_base, b.descuento, b.precio_final,
          aBordo ? 'usado' : ventanilla ? 'emitido' : 'reservado']
      )
      Object.assign(b, rows[0])
      // GC-34: quien compra a bordo ya está dentro del bus: queda registrado su abordaje
      if (aBordo) {
        await cliente.query('INSERT INTO acceso_pasajero (boleto_id, registrado_por) VALUES ($1, $2)', [rows[0].id, ventanilla.id])
      }
    }

    // Notificación al cliente (CC-11)
    if (!ventanilla) {
      await notificar(cliente, clienteId, `Compra N.º ${compraId} registrada`,
        `Reservaste ${boletos.length} asiento(s) por $${total.toFixed(2)}. ` +
        'Realiza el pago y sube el comprobante desde Mis boletos.')
    } else if (aBordo && clienteId !== ventanilla.id) {
      await notificar(cliente, clienteId, `Compra N.º ${compraId} a bordo`,
        `Compraste ${boletos.length} boleto(s) a bordo del bus, pagados en efectivo.`)
    } else if (!aBordo && clienteId !== ventanilla.id) {
      await notificar(cliente, clienteId, `Compra N.º ${compraId} en ventanilla`,
        `Se emitieron ${boletos.length} boleto(s) pagados en efectivo. Descárgalos desde Mis boletos.`)
    }

    return { ...compra.rows[0], boletos, cuenta_cooperativa: cuentaCooperativa }
  })
}

// Historial del cliente: sus compras con el viaje y los boletos
async function listarMias(clienteId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.total, c.estado_pago, c.creado_en, mp.nombre AS metodo_pago,
            mp.requiere_comprobante, c.comprobante_url, c.referencia_bancaria, c.motivo_rechazo,
            json_agg(json_build_object(
              'id', b.id, 'codigo', b.codigo, 'estado', b.estado,
              'pasajero_nombre', b.pasajero_nombre, 'numero_asiento', a.numero,
              'precio_final', b.precio_final
            ) ORDER BY a.numero) AS boletos,
            MIN(v.fecha)::text AS fecha_viaje,
            MIN(f.hora_salida)::text AS hora_salida,
            MIN(coop.nombre) AS cooperativa,
            -- GC-43: cuenta de la cooperativa a la que se paga la transferencia o el depósito
            (array_agg(json_build_object('banco', coop.cuenta_banco, 'tipo', coop.cuenta_tipo,
              'numero', coop.cuenta_numero, 'titular', coop.cuenta_titular,
              'identificacion', coop.cuenta_identificacion)))[1] AS cuenta_cooperativa,
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
      GROUP BY c.id, mp.nombre, mp.requiere_comprobante
      ORDER BY c.creado_en DESC`,
    [clienteId]
  )
  return rows
}

/*
  El cliente sube el comprobante de su transferencia o depósito.
  Solo para sus compras en estado 'pendiente'. La compra pasa a 'en_revision'
  y queda lista para que el oficinista la valide.
*/
async function subirComprobante(clienteId, compraId, archivo, referencia) {
  // Si algo falla, se borra el archivo subido para no dejar basura
  const descartar = () => archivo && fs.unlink(archivo.path, () => {})

  if (!archivo) throw errorHttp('Adjunta el comprobante (imagen JPG o PNG, o PDF)', 400)
  if (!referencia?.trim()) {
    descartar()
    throw errorHttp('Ingresa el número de referencia de la transferencia o depósito', 400)
  }

  const { rows } = await pool.query(
    `SELECT c.id, c.estado_pago, mp.requiere_comprobante
       FROM compra c JOIN metodo_pago mp ON mp.id = c.metodo_pago_id
      WHERE c.id = $1 AND c.cliente_id = $2`,
    [compraId, clienteId]
  )
  const compra = rows[0]
  if (!compra) {
    descartar()
    throw errorHttp('Compra no encontrada', 404)
  }
  if (!compra.requiere_comprobante) {
    descartar()
    throw errorHttp('Este método de pago no requiere comprobante', 400)
  }
  if (compra.estado_pago !== 'pendiente') {
    descartar()
    throw errorHttp(`No se puede subir comprobante: la compra está "${compra.estado_pago}"`, 409)
  }

  const url = `/uploads/comprobantes/${archivo.filename}`
  const actualizada = await pool.query(
    `UPDATE compra
        SET comprobante_url = $1, referencia_bancaria = $2, estado_pago = 'en_revision'
      WHERE id = $3
      RETURNING id, total, estado_pago, comprobante_url, referencia_bancaria`,
    [url, referencia.trim(), compraId]
  )

  // Notificaciones (CC-11): al cliente y a los oficinistas de la cooperativa del viaje
  await notificar(pool, clienteId, `Comprobante recibido — compra N.º ${compraId}`,
    'Tu comprobante está en revisión. Te avisaremos cuando el oficinista valide el pago.')
  const coop = await pool.query(
    `SELECT DISTINCT f.cooperativa_id
       FROM boleto b JOIN viaje v ON v.id = b.viaje_id JOIN frecuencia f ON f.id = v.frecuencia_id
      WHERE b.compra_id = $1`,
    [compraId]
  )
  for (const fila of coop.rows) {
    await notificarOficinistas(pool, fila.cooperativa_id, 'Nuevo comprobante por validar',
      `La compra N.º ${compraId} tiene un comprobante pendiente de revisión (referencia ${referencia.trim()}).`)
  }

  return actualizada.rows[0]
}

/*
  CC-14: venta en ventanilla. El oficinista vende con pago en efectivo.
  Si la cédula del primer pasajero es de un cliente registrado, la compra queda en su
  historial (Mis boletos); si no, queda registrada a nombre del oficinista que vendió.
*/
async function venderEnVentanilla(oficinista, datos, opciones = {}) {
  const efectivo = await pool.query("SELECT id FROM metodo_pago WHERE codigo = 'efectivo' AND activo")
  if (!efectivo.rows[0]) throw errorHttp('El pago en efectivo no está habilitado', 409)

  const cedula = Array.isArray(datos.pasajeros) ? datos.pasajeros[0]?.cedula : null
  const registrado = await pool.query(
    `SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.cedula = $1 AND r.nombre = 'cliente' AND u.activo`,
    [cedula || '']
  )
  const clienteId = registrado.rows[0]?.id || oficinista.id

  return crear(clienteId, { ...datos, metodo_pago_id: efectivo.rows[0].id }, { vendidoPor: oficinista, aBordo: Boolean(opciones.aBordo) })
}

// GC-34: venta del chofer dentro del bus (misma lógica que la ventanilla, con el viaje en curso)
const venderABordo = (chofer, datos) => venderEnVentanilla(chofer, datos, { aBordo: true })

/*
  GC-15: datos de un pasajero ya registrado, para precargarlos en la compra.
  Solo se devuelve el nombre (nunca correo ni teléfono) y si tiene fecha de nacimiento
  registrada (para saber si hace falta pedirla en los descuentos por edad).
*/
async function buscarPasajero(cedula) {
  const error = validarCedulaEcuador(cedula)
  if (error) throw errorHttp(error, 400)
  const { rows } = await pool.query(
    `SELECT nombres || ' ' || apellidos AS nombre, (fecha_nacimiento IS NOT NULL) AS tiene_fecha_nacimiento
       FROM usuario WHERE cedula = $1 AND activo`,
    [String(cedula).trim()]
  )
  return rows[0] ? { registrado: true, ...rows[0] } : { registrado: false }
}

/*
  GC-22: viajes de la cooperativa del oficinista para vender en ventanilla.
  Usa la misma búsqueda del cliente (solo salidas futuras con asientos libres)
  y deja únicamente los viajes de SU cooperativa.
*/
async function viajesVentanilla(oficinista, consulta) {
  const errores = {}
  const origen = Number(consulta.origen)
  const destino = Number(consulta.destino)
  const pasajeros = consulta.pasajeros ? Number(consulta.pasajeros) : 1
  if (!Number.isInteger(origen) || origen <= 0) errores.origen = 'Elige el origen'
  if (!Number.isInteger(destino) || destino <= 0) errores.destino = 'Elige el destino'
  else if (origen === destino) errores.destino = 'El destino debe ser distinto del origen'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(consulta.fecha || '')) errores.fecha = 'Elige la fecha del viaje'
  if (!Number.isInteger(pasajeros) || pasajeros < 1 || pasajeros > 10) errores.pasajeros = 'Puedes vender de 1 a 10 pasajes por venta'
  if (Object.keys(errores).length) throw errorHttp('Revisa la búsqueda', 400, errores)

  const { buscarViajes } = require('../viajes/viajes.service')
  return buscarViajes({ origen, destino, fecha: consulta.fecha, pasajeros, cooperativa: oficinista.cooperativa_id })
}

/*
  GC-22: cierre de caja del día del oficinista (ventas en efectivo de hoy).
*/
async function ventasDelDia(oficinista) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT c.id)::int AS ventas,
            COUNT(b.id)::int AS boletos,
            COALESCE(SUM(b.precio_final), 0)::numeric(10,2) AS total
       FROM compra c
       JOIN boleto b ON b.compra_id = c.id AND b.estado <> 'anulado'
      WHERE c.vendido_por = $1
        AND (c.creado_en AT TIME ZONE 'America/Guayaquil')::date = (NOW() AT TIME ZONE 'America/Guayaquil')::date`,
    [oficinista.id]
  )
  const ultimas = await pool.query(
    `SELECT c.id, c.total, to_char(c.creado_en AT TIME ZONE 'America/Guayaquil', 'HH24:MI') AS hora,
            COUNT(b.id)::int AS boletos, MIN(cs.nombre) AS origen, MIN(cd.nombre) AS destino
       FROM compra c
       JOIN boleto b ON b.compra_id = c.id
       JOIN viaje v ON v.id = b.viaje_id
       JOIN parada ps ON ps.frecuencia_id = v.frecuencia_id AND ps.orden = b.orden_subida
       JOIN parada pd ON pd.frecuencia_id = v.frecuencia_id AND pd.orden = b.orden_bajada
       JOIN ciudad cs ON cs.id = ps.ciudad_id
       JOIN ciudad cd ON cd.id = pd.ciudad_id
      WHERE c.vendido_por = $1
        AND (c.creado_en AT TIME ZONE 'America/Guayaquil')::date = (NOW() AT TIME ZONE 'America/Guayaquil')::date
      GROUP BY c.id
      ORDER BY c.creado_en DESC
      LIMIT 8`,
    [oficinista.id]
  )
  return { ...rows[0], total: Number(rows[0].total), ultimas: ultimas.rows.map((u) => ({ ...u, total: Number(u.total) })) }
}

module.exports = {
  buscarPasajero, obtenerCatalogos, crear, listarMias, subirComprobante, venderEnVentanilla,
  viajesVentanilla, ventasDelDia, venderABordo,
}
