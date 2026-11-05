
const servicio = require('./viajes.service')

function idPositivo(valor, nombre) {
  if (
    !/^\d+$/.test(String(valor || '')) ||
    Number(valor) <= 0 ||
    !Number.isSafeInteger(Number(valor))
  ) {
    const error = new Error(
      `${nombre} debe ser un número entero positivo`
    )
    error.status = 400
    throw error
  }

  return Number(valor)
}

function fechaValida(valor) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(valor || '') ||
    Number.isNaN(Date.parse(`${valor}T12:00:00Z`)) ||
    new Date(`${valor}T12:00:00Z`)
      .toISOString().slice(0, 10) !== valor
  ) {
    const error = new Error(
      'La fecha debe tener el formato YYYY-MM-DD y ser válida'
    )
    error.status = 400
    throw error
  }

  return valor
}

async function buscar(req, res) {
  const q = req.query

  const filtros = {
    origen: idPositivo(q.origen, 'origen'),
    destino: idPositivo(q.destino, 'destino'),
    fecha: fechaValida(q.fecha),
    cooperativa: q.cooperativa
      ? idPositivo(q.cooperativa, 'cooperativa') : null,
    tipoAsiento: q.tipoAsiento
      ? idPositivo(q.tipoAsiento, 'tipoAsiento') : null,
    marcaChasis: q.marcaChasis || null,
    marcaCarroceria: q.marcaCarroceria || null,
    tipoViaje: q.tipoViaje || null,
  }

  if (filtros.origen === filtros.destino) {
    const error = new Error(
      'El origen y el destino deben ser diferentes'
    )
    error.status = 400
    throw error
  }

  if (
    filtros.tipoViaje &&
    !['directo', 'con_paradas'].includes(filtros.tipoViaje)
  ) {
    const error = new Error('Tipo de viaje no válido')
    error.status = 400
    throw error
  }

  const viajes = await servicio.buscarViajes(filtros)
  res.json(viajes)
}

async function detalle(req, res) {
  const viajeId = idPositivo(req.params.id, 'id')
  const subida = idPositivo(req.query.subida, 'subida')
  const bajada = idPositivo(req.query.bajada, 'bajada')

  const resultado = await servicio.obtenerDetalle(
    viajeId, subida, bajada
  )

  res.json(resultado)
}

async function asientos(req, res) {
  const viajeId = idPositivo(req.params.id, 'id')
  const subida = idPositivo(req.query.subida, 'subida')
  const bajada = idPositivo(req.query.bajada, 'bajada')

  const resultado = await servicio.obtenerAsientos(
    viajeId, subida, bajada
  )

  res.json(resultado)
}

module.exports = {
  buscar,
  detalle,
  asientos,
}
