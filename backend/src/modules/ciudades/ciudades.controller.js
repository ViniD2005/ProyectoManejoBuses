const servicio = require('./ciudades.service')

const listar = async (req, res) => res.json(await servicio.listar(req.query))
const listarGestion = async (req, res) => res.json(await servicio.listarGestion())
const obtener = async (req, res) => res.json(await servicio.obtener(req.params.id))
const crear = async (req, res) => res.status(201).json(await servicio.crear(req.body))
const actualizar = async (req, res) => res.json(await servicio.actualizar(req.params.id, req.body))
const cambiarEstado = async (req, res) => res.json(await servicio.cambiarEstado(req.params.id, req.body.activa))
const eliminar = async (req, res) => {
  await servicio.eliminar(req.params.id)
  res.status(204).end()
}

module.exports = { listar, listarGestion, obtener, crear, actualizar, cambiarEstado, eliminar }
