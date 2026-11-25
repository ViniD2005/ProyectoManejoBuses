const { pool, transaccion } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-18 - Estructura (plantilla) de asientos de cada bus.

  Cada piso es una cuadrícula: "filas" filas y, en cada fila, "izquierda"
  asientos + pasillo + "derecha" asientos. Cada asiento tiene su fila, su
  columna y su tipo (Normal, VIP, Semicama...), así el cliente ve el bus tal
  como es y la cooperativa decide cuáles son VIP.

  Reglas:
    - el bus debe tener entre 10 y 80 asientos y al menos uno por piso;
    - un asiento no puede ir en el pasillo ni repetir lugar;
    - el tipo de asiento debe ser de la misma cooperativa;
    - si el bus tiene boletos vendidos para viajes de hoy en adelante, la
      estructura no se cambia (el pasajero ya eligió su asiento);
    - los números se asignan solos: piso 1 primero, de adelante hacia atrás
      y de izquierda a derecha.
*/

const MIN_ASIENTOS = 10
const MAX_ASIENTOS = 80
const MAX_FILAS = 25

const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

// Posición por defecto (2 + pasillo + 2) para asientos que aún no tienen una
const posicionPorDefecto = (i) => ({ fila: Math.floor(i / 4) + 1, columna: [1, 2, 4, 5][i % 4] })

async function boletosFuturos(busId, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT COUNT(*)::int AS total
       FROM boleto b JOIN viaje v ON v.id = b.viaje_id
      WHERE v.bus_id = $1 AND v.fecha >= $2 AND b.estado <> 'anulado'`,
    [busId, hoyEcuador()]
  )
  return rows[0].total
}

// Buses de la cooperativa con un resumen de su estructura
async function listar(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.numero_disco, b.placa, b.pisos, b.activo,
            COUNT(a.id)::int AS asientos,
            COUNT(a.id) FILTER (WHERE ta.factor_precio > 1)::int AS asientos_especiales,
            (SELECT COUNT(*)::int FROM bus_piso bp WHERE bp.bus_id = b.id) AS pisos_configurados
       FROM bus b
       LEFT JOIN asiento a ON a.bus_id = b.id
       LEFT JOIN tipo_asiento ta ON ta.id = a.tipo_asiento_id
      WHERE b.cooperativa_id = $1
      GROUP BY b.id
      ORDER BY b.numero_disco::int, b.numero_disco`,
    [cooperativaId]
  )
  return rows
}

async function busPropio(cooperativaId, busId, cliente = pool) {
  const { rows } = await cliente.query(
    'SELECT id, numero_disco, placa, pisos, activo FROM bus WHERE id = $1 AND cooperativa_id = $2',
    [busId, cooperativaId]
  )
  if (!rows[0]) throw errorHttp('El bus no existe o no es de tu cooperativa', 404)
  return rows[0]
}

async function obtener(cooperativaId, busId) {
  const bus = await busPropio(cooperativaId, busId)
  const tipos = await pool.query(
    'SELECT id, nombre, factor_precio FROM tipo_asiento WHERE cooperativa_id = $1 ORDER BY factor_precio, nombre',
    [cooperativaId]
  )
  const distribucion = await pool.query('SELECT piso, filas, izquierda, derecha FROM bus_piso WHERE bus_id = $1', [busId])
  const asientos = await pool.query(
    'SELECT id, numero, piso, fila, columna, tipo_asiento_id FROM asiento WHERE bus_id = $1 ORDER BY piso, numero',
    [busId]
  )

  const pisos = []
  const totalPisos = Math.max(bus.pisos, ...asientos.rows.map((a) => a.piso), 1)
  for (let piso = 1; piso <= totalPisos; piso++) {
    const delPiso = asientos.rows.filter((a) => a.piso === piso)
    const conPosicion = delPiso.every((a) => a.fila && a.columna)
    const lista = delPiso.map((a, i) => ({
      id: a.id,
      numero: a.numero,
      tipo_asiento_id: a.tipo_asiento_id,
      ...(conPosicion ? { fila: a.fila, columna: a.columna } : posicionPorDefecto(i)),
    }))
    const guardada = distribucion.rows.find((d) => d.piso === piso)
    const izquierda = guardada?.izquierda || 2
    const derecha = guardada?.derecha || 2
    const filasNecesarias = Math.max(1, ...lista.map((a) => a.fila))
    pisos.push({
      piso,
      filas: Math.max(guardada?.filas || 0, filasNecesarias),
      izquierda,
      derecha,
      sobrante: piso > bus.pisos, // asientos en un piso que el bus ya no tiene
      asientos: lista,
    })
  }

  return {
    bus,
    tipos: tipos.rows.map((t) => ({ ...t, factor_precio: Number(t.factor_precio) })),
    pisos,
    boletos_futuros: await boletosFuturos(busId),
    limites: { min_asientos: MIN_ASIENTOS, max_asientos: MAX_ASIENTOS, max_filas: MAX_FILAS },
  }
}

function validar(bus, tiposValidos, datos) {
  const errores = {}
  const pisos = Array.isArray(datos.pisos) ? datos.pisos : []
  if (pisos.length !== bus.pisos) {
    throw errorHttp(`El bus es de ${bus.pisos} piso(s): envía la estructura de ${bus.pisos === 1 ? 'un piso' : 'los dos pisos'}`, 400)
  }

  const limpios = []
  let total = 0
  pisos.forEach((p, indice) => {
    const piso = indice + 1
    const clave = `piso_${piso}`
    const filas = Number(p.filas)
    const izquierda = Number(p.izquierda)
    const derecha = Number(p.derecha)
    if (!Number.isInteger(filas) || filas < 1 || filas > MAX_FILAS) errores[clave] = `Piso ${piso}: las filas deben estar entre 1 y ${MAX_FILAS}`
    if (![1, 2, 3].includes(izquierda) || ![1, 2, 3].includes(derecha)) errores[clave] = `Piso ${piso}: cada lado del pasillo puede tener de 1 a 3 asientos`
    if (errores[clave]) return
    const pasillo = izquierda + 1
    const columnas = izquierda + 1 + derecha

    const ocupados = new Set()
    const asientos = []
    for (const a of Array.isArray(p.asientos) ? p.asientos : []) {
      const fila = Number(a.fila)
      const columna = Number(a.columna)
      const tipo = Number(a.tipo_asiento_id)
      if (!Number.isInteger(fila) || fila < 1 || fila > filas || !Number.isInteger(columna) || columna < 1 || columna > columnas) {
        errores[clave] = `Piso ${piso}: hay un asiento fuera de la cuadrícula`
        break
      }
      if (columna === pasillo) { errores[clave] = `Piso ${piso}: no se puede poner un asiento en el pasillo`; break }
      if (ocupados.has(`${fila}-${columna}`)) { errores[clave] = `Piso ${piso}: dos asientos en el mismo lugar (fila ${fila})`; break }
      if (!tiposValidos.has(tipo)) { errores[clave] = `Piso ${piso}: un asiento tiene un tipo que no es de tu cooperativa`; break }
      ocupados.add(`${fila}-${columna}`)
      asientos.push({ fila, columna, tipo_asiento_id: tipo })
    }
    if (!errores[clave] && asientos.length === 0) errores[clave] = `Piso ${piso}: pon al menos un asiento`
    asientos.sort((x, y) => x.fila - y.fila || x.columna - y.columna)
    total += asientos.length
    limpios.push({ piso, filas, izquierda, derecha, asientos })
  })

  if (!Object.keys(errores).length && (total < MIN_ASIENTOS || total > MAX_ASIENTOS)) {
    errores.total = `El bus debe tener entre ${MIN_ASIENTOS} y ${MAX_ASIENTOS} asientos (ahora tiene ${total})`
  }
  if (Object.keys(errores).length) throw errorHttp(Object.values(errores)[0], 400, errores)
  return limpios
}

async function guardar(cooperativaId, busId, datos) {
  const bus = await busPropio(cooperativaId, busId)
  const tipos = await pool.query('SELECT id FROM tipo_asiento WHERE cooperativa_id = $1', [cooperativaId])
  const pisos = validar(bus, new Set(tipos.rows.map((t) => t.id)), datos)

  await transaccion(async (cliente) => {
    // Se bloquea el bus para que nadie venda mientras se cambia su estructura
    await cliente.query('SELECT id FROM bus WHERE id = $1 FOR UPDATE', [busId])
    const vendidos = await boletosFuturos(busId, cliente)
    if (vendidos > 0) {
      throw errorHttp(`Este bus tiene ${vendidos} boleto(s) vendido(s) para viajes de hoy en adelante: no se puede cambiar su estructura hasta que pasen esos viajes`, 409)
    }

    // Numeración automática: piso 1 primero, de adelante hacia atrás, de izquierda a derecha
    const nuevos = pisos.flatMap((p) => p.asientos.map((a) => ({ ...a, piso: p.piso })))
    nuevos.forEach((a, i) => { a.numero = i + 1 })

    const { rows: actuales } = await cliente.query(
      `SELECT a.id, a.numero, EXISTS (SELECT 1 FROM boleto b WHERE b.asiento_id = a.id) AS con_boletos
         FROM asiento a WHERE a.bus_id = $1 ORDER BY a.numero`,
      [busId]
    )
    const sobrantes = actuales.filter((a) => a.numero > nuevos.length)
    const historico = sobrantes.find((a) => a.con_boletos)
    if (historico) {
      throw errorHttp(`El asiento ${historico.numero} tiene boletos de viajes anteriores y no se puede quitar. Deja al menos ${historico.numero} asientos.`, 409)
    }

    // Se liberan las posiciones antes de reacomodar (evita choques entre asientos)
    await cliente.query('UPDATE asiento SET fila = NULL, columna = NULL WHERE bus_id = $1', [busId])
    if (sobrantes.length) {
      await cliente.query('DELETE FROM asiento WHERE id = ANY($1::int[])', [sobrantes.map((a) => a.id)])
    }
    const existentes = new Set(actuales.map((a) => a.numero))
    for (const a of nuevos) {
      if (existentes.has(a.numero)) {
        await cliente.query(
          'UPDATE asiento SET piso = $1, fila = $2, columna = $3, tipo_asiento_id = $4 WHERE bus_id = $5 AND numero = $6',
          [a.piso, a.fila, a.columna, a.tipo_asiento_id, busId, a.numero]
        )
      } else {
        await cliente.query(
          'INSERT INTO asiento (bus_id, tipo_asiento_id, numero, piso, fila, columna) VALUES ($1, $2, $3, $4, $5, $6)',
          [busId, a.tipo_asiento_id, a.numero, a.piso, a.fila, a.columna]
        )
      }
    }

    await cliente.query('DELETE FROM bus_piso WHERE bus_id = $1', [busId])
    for (const p of pisos) {
      await cliente.query(
        'INSERT INTO bus_piso (bus_id, piso, filas, izquierda, derecha) VALUES ($1, $2, $3, $4, $5)',
        [busId, p.piso, p.filas, p.izquierda, p.derecha]
      )
    }
  })

  return obtener(cooperativaId, busId)
}

module.exports = { listar, obtener, guardar }
