const servicio = require('./auth.service')

const login = async (req, res) => res.json(await servicio.login(req.body))
const registro = async (req, res) => res.status(201).json(await servicio.registrarCliente(req.body))
const perfil = async (req, res) => res.json(await servicio.obtenerPerfil(req.usuario.id))

// GC-12: verificación de correo y recuperación de contraseña
const verificarCorreo = async (req, res) => res.json(await servicio.verificarCorreo(req.body))
const reenviarVerificacion = async (req, res) => res.json(await servicio.reenviarVerificacion(req.body))
const olvideContrasena = async (req, res) => res.json(await servicio.olvideContrasena(req.body))
const revisarEnlace = async (req, res) => res.json(await servicio.revisarEnlaceRecuperacion(req.body))
const restablecerContrasena = async (req, res) => res.json(await servicio.restablecerContrasena(req.body))

module.exports = {
  login, registro, perfil,
  verificarCorreo, reenviarVerificacion, olvideContrasena, revisarEnlace, restablecerContrasena,
}
