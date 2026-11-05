
const servicio = require('./frecuencias.service')

// ======================================
// LISTAR FRECUENCIAS
// ======================================

const listar = async (req, res) => {
  res.json(
    await servicio.listar(req.usuario.cooperativa_id)
  )
}

// ======================================
// OBTENER FRECUENCIA POR ID
// ======================================

const obtener = async (req, res) => {
  res.json(
    await servicio.obtener(
      req.usuario.cooperativa_id,
      req.params.id
    )
  )
}

// ======================================
// CREAR FRECUENCIA
// ======================================

const crear = async (req, res) => {
  res.status(201).json(
    await servicio.crear(
      req.usuario.cooperativa_id,
      req.body
    )
  )
}

// ======================================
// CAMBIAR ESTADO DE FRECUENCIA
// ======================================

const cambiarEstado = async (req, res) => {
  res.json(
    await servicio.cambiarEstado(
      req.usuario.cooperativa_id,
      req.params.id,
      req.body.activa
    )
  )
}

// ======================================
// EXPORTAR CONTROLADORES
// ======================================

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado
}
