const jwt = require('jsonwebtoken')

function errorHttp(mensaje, status) {
  const error = new Error(mensaje)
  error.status = status
  return error
}

// Exige un token válido. Deja en req.usuario: { id, rol, cooperativa_id }
function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ')
  if (tipo !== 'Bearer' || !token) {
    throw errorHttp('Debes iniciar sesión', 401)
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    throw errorHttp('La sesión expiró o no es válida. Inicia sesión de nuevo.', 401)
  }
}

// Restringe una ruta a ciertos roles. Usar SIEMPRE después de autenticar.
//   router.post('/', autenticar, permitirRoles('admin'), controlador.crear)
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      throw errorHttp('No tienes permiso para realizar esta acción', 403)
    }
    next()
  }
}

module.exports = { autenticar, permitirRoles }
