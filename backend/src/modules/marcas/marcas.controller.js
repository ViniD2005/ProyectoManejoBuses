const servicio = require('./marcas.service')

const listar = async (req, res) => res.json(await servicio.listar(req.query))
const listarGestion = async (req, res) => res.json(await servicio.listarGestion())
const crear = async (req, res) => res.status(201).json(await servicio.crear(req.body))
const actualizar = async (req, res) => res.json(await servicio.actualizar(req.params.id, req.body))
const cambiarEstado = async (req, res) => res.json(await servicio.cambiarEstado(req.params.id, req.body.activa))

module.exports = { listar, listarGestion, crear, actualizar, cambiarEstado }
