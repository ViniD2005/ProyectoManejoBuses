const servicio = require('./auth.service')

const login = async (req, res) => res.json(await servicio.login(req.body))
const registro = async (req, res) => res.status(201).json(await servicio.registrarCliente(req.body))
const perfil = async (req, res) => res.json(await servicio.obtenerPerfil(req.usuario.id))

module.exports = { login, registro, perfil }
