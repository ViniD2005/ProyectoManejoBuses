const servicio = require('./usuarios.service')

const listar = async (req, res) => res.json(await servicio.listar(req.usuario))
const crear = async (req, res) => res.status(201).json(await servicio.crear(req.usuario, req.body))
const cambiarEstado = async (req, res) => res.json(await servicio.cambiarEstado(req.usuario, req.params.id, req.body.activo))

module.exports = { listar, crear, cambiarEstado }
