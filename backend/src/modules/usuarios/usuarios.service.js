const bcrypt = require('bcryptjs')
const { pool } = require('../../config/db')
const {
  agregar, limpiar, validarNombrePersona, validarCedulaEcuador, validarCorreo,
  validarTelefono, validarContrasena, validarFechaNacimiento, validarLicencia,
} = require('../../utils/validaciones')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const ROLES = ['admin', 'cooperativa', 'oficinista', 'personal_bus', 'cliente']
const ROLES_CON_COOPERATIVA = ['cooperativa', 'oficinista', 'personal_bus']

// Roles que puede crear cada tipo de usuario (CC-16)
const ROLES_PERMITIDOS = {
  admin: ['admin', 'cooperativa', 'oficinista', 'personal_bus'],
  cooperativa: ['oficinista', 'personal_bus'],
}

const CAMPOS = `u.id, u.cedula, u.nombres, u.apellidos, u.email, u.telefono, u.activo, u.creado_en,
                r.nombre AS rol, u.cooperativa_id, c.nombre AS cooperativa,
                u.fecha_nacimiento::text AS fecha_nacimiento, u.cargo, u.licencia_tipo, u.licencia_vence::text AS licencia_vence`

/*
  GC-33: datos propios del personal del bus.
  - cargo: chofer o ayudante (obligatorio para el personal del bus)
  - el chofer necesita licencia profesional tipo D o E vigente
  Devuelve { errores, valores } con los valores listos para guardar.
*/
const CARGOS = ['chofer', 'ayudante']
function datosPersonalBus(datos) {
  const errores = {}
  const cargo = String(datos.cargo || '').toLowerCase()
  if (!CARGOS.includes(cargo)) errores.cargo = 'Elige el cargo: chofer o ayudante'
  if (cargo === 'chofer') Object.assign(errores, validarLicencia(datos.licencia_tipo, datos.licencia_vence))
  const esChofer = cargo === 'chofer'
  return {
    errores,
    valores: {
      cargo: CARGOS.includes(cargo) ? cargo : null,
      licencia_tipo: esChofer ? String(datos.licencia_tipo || '').toUpperCase() : null,
      licencia_vence: esChofer ? datos.licencia_vence : null,
    },
  }
}

async function obtener(id) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS}
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN cooperativa c ON c.id = u.cooperativa_id
      WHERE u.id = $1`,
    [id]
  )
  return rows[0]
}

/*
  Lista de usuarios internos (no clientes).
  - admin: todos los usuarios internos de todas las cooperativas
  - cooperativa: solo oficinistas y personal del bus de su cooperativa
*/
async function listar(solicitante) {
  const soloSuCooperativa = solicitante.rol === 'cooperativa'
  const { rows } = await pool.query(
    `SELECT ${CAMPOS}
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN cooperativa c ON c.id = u.cooperativa_id
      WHERE r.nombre <> 'cliente'
        AND ($1::boolean = FALSE OR (u.cooperativa_id = $2 AND r.nombre IN ('oficinista', 'personal_bus')))
      ORDER BY c.nombre NULLS FIRST, r.id, u.apellidos`,
    [soloSuCooperativa, solicitante.cooperativa_id]
  )
  return rows
}

/*
  CC-22: busca usuarios registrados (de cualquier rol) por cédula, correo o nombre,
  para que el administrador les asigne un rol. Devuelve como máximo 20.
*/
async function buscar(texto) {
  const termino = limpiar(texto)
  if (termino.length < 3) throw errorHttp('Escribe al menos 3 caracteres para buscar', 400)
  const { rows } = await pool.query(
    `SELECT ${CAMPOS}
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN cooperativa c ON c.id = u.cooperativa_id
      WHERE u.cedula LIKE $1 || '%'
         OR LOWER(u.email) LIKE '%' || LOWER($1) || '%'
         OR LOWER(u.nombres || ' ' || u.apellidos) LIKE '%' || LOWER($1) || '%'
      ORDER BY u.apellidos, u.nombres
      LIMIT 20`,
    [termino]
  )
  return rows
}

async function cooperativaActiva(id) {
  const { rows } = await pool.query('SELECT id FROM cooperativa WHERE id = $1 AND activa', [id])
  return Boolean(rows[0])
}

async function crear(solicitante, datos) {
  const permitidos = ROLES_PERMITIDOS[solicitante.rol] || []
  const errores = {}
  if (!permitidos.includes(datos.rol)) errores.rol = 'No puedes crear usuarios con ese rol'
  agregar(errores, 'cedula', validarCedulaEcuador(datos.cedula))
  agregar(errores, 'nombres', validarNombrePersona(datos.nombres, 'los nombres', true))
  agregar(errores, 'apellidos', validarNombrePersona(datos.apellidos, 'los apellidos', true))
  agregar(errores, 'email', validarCorreo(datos.email))
  agregar(errores, 'telefono', validarTelefono(datos.telefono))
  agregar(errores, 'password', validarContrasena(datos.password))
  // GC-33: todo el personal debe ser mayor de edad
  agregar(errores, 'fecha_nacimiento', validarFechaNacimiento(datos.fecha_nacimiento, true, 18))
  const personal = datosPersonalBus(datos)
  if (datos.rol === 'personal_bus') Object.assign(errores, personal.errores)

  // La cooperativa crea siempre en la suya; el admin la elige
  const cooperativaId = solicitante.rol === 'cooperativa'
    ? solicitante.cooperativa_id
    : (ROLES_CON_COOPERATIVA.includes(datos.rol) ? Number(datos.cooperativa_id) || null : null)
  if (ROLES_CON_COOPERATIVA.includes(datos.rol)) {
    if (!cooperativaId) errores.cooperativa_id = 'Elige la cooperativa a la que pertenece'
    else if (!(await cooperativaActiva(cooperativaId))) errores.cooperativa_id = 'La cooperativa elegida no existe o está desactivada'
  }

  // Cédula y correo únicos, con mensaje claro en el campo correspondiente
  const { rows: existentes } = await pool.query(
    'SELECT cedula, LOWER(email) AS email FROM usuario WHERE cedula = $1 OR LOWER(email) = LOWER($2)',
    [String(datos.cedula ?? '').trim(), String(datos.email ?? '').trim()]
  )
  if (existentes.some((u) => u.cedula === String(datos.cedula).trim())) {
    agregar(errores, 'cedula', 'Ya existe un usuario con esta cédula. Si es un cliente registrado, asígnale el rol desde "Asignar rol".')
  }
  if (existentes.some((u) => u.email === String(datos.email).trim().toLowerCase())) {
    agregar(errores, 'email', 'Este correo electrónico ya está registrado')
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados del usuario', 400, errores)

  const hash = await bcrypt.hash(datos.password, 10)
  const { rows } = await pool.query(
    `INSERT INTO usuario (rol_id, cooperativa_id, cedula, nombres, apellidos, email, telefono, password_hash,
                          fecha_nacimiento, cargo, licencia_tipo, licencia_vence)
     VALUES ((SELECT id FROM rol WHERE nombre = $1), $2, $3, $4, $5, LOWER($6), $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [datos.rol, cooperativaId, datos.cedula.trim(), limpiar(datos.nombres), limpiar(datos.apellidos),
      datos.email.trim(), datos.telefono ? String(datos.telefono).replace(/[\s-]/g, '') : null, hash,
      datos.fecha_nacimiento,
      ...(datos.rol === 'personal_bus' ? [personal.valores.cargo, personal.valores.licencia_tipo, personal.valores.licencia_vence] : [null, null, null])]
  )
  return obtener(rows[0].id)
}

/*
  CC-22: el administrador asigna un rol a un usuario registrado.
  - cooperativa, oficinista y personal del bus necesitan una cooperativa activa
  - admin y cliente quedan sin cooperativa
  - nadie puede cambiar su propio rol
  El usuario verá el nuevo rol la próxima vez que inicie sesión.
*/
async function asignarRol(solicitante, id, datos) {
  const { rol, cooperativa_id: cooperativaIdRecibida } = datos
  if (Number(id) === solicitante.id) throw errorHttp('No puedes cambiar tu propio rol', 409)
  const usuario = await obtener(id)
  if (!usuario) throw errorHttp('Usuario no encontrado', 404)

  const errores = {}
  if (!ROLES.includes(rol)) errores.rol = 'Elige un rol válido'
  const necesitaCooperativa = ROLES_CON_COOPERATIVA.includes(rol)
  const cooperativaId = necesitaCooperativa ? Number(cooperativaIdRecibida) || null : null
  if (necesitaCooperativa) {
    if (!cooperativaId) errores.cooperativa_id = 'Elige la cooperativa a la que pertenecerá'
    else if (!(await cooperativaActiva(cooperativaId))) errores.cooperativa_id = 'La cooperativa elegida no existe o está desactivada'
  }
  // GC-33: el personal debe ser mayor de edad; el personal del bus necesita cargo (y licencia si es chofer)
  if (rol && rol !== 'cliente' && usuario.fecha_nacimiento && validarFechaNacimiento(usuario.fecha_nacimiento, true, 18)) {
    errores.rol = `${usuario.nombres} todavía no cumple 18 años: no puede tener un rol del personal`
  }
  const personal = datosPersonalBus(datos)
  if (rol === 'personal_bus') Object.assign(errores, personal.errores)
  if (Object.keys(errores).length) throw errorHttp('Revisa el rol a asignar', 400, errores)

  if (usuario.rol === rol && rol !== 'personal_bus' && (usuario.cooperativa_id || null) === cooperativaId) {
    throw errorHttp(`${usuario.nombres} ya tiene ese rol`, 409)
  }

  const extra = rol === 'personal_bus' ? personal.valores : { cargo: null, licencia_tipo: null, licencia_vence: null }
  await pool.query(
    `UPDATE usuario SET rol_id = (SELECT id FROM rol WHERE nombre = $1), cooperativa_id = $2,
            cargo = $4, licencia_tipo = $5, licencia_vence = $6
      WHERE id = $3`,
    [rol, cooperativaId, id, extra.cargo, extra.licencia_tipo, extra.licencia_vence]
  )
  return obtener(id)
}

/*
  GC-33: renovar la licencia o cambiar el cargo de alguien del personal del bus.
  La cooperativa solo puede hacerlo con su propio personal.
*/
async function actualizarPersonalBus(solicitante, id, datos) {
  const visibles = await listar(solicitante)
  const usuario = visibles.find((u) => u.id === Number(id))
  if (!usuario) throw errorHttp('Usuario no encontrado', 404)
  if (usuario.rol !== 'personal_bus') throw errorHttp('Solo el personal del bus tiene cargo y licencia', 409)
  const { errores, valores } = datosPersonalBus(datos)
  if (Object.keys(errores).length) throw errorHttp('Revisa el cargo y la licencia', 400, errores)
  await pool.query(
    'UPDATE usuario SET cargo = $1, licencia_tipo = $2, licencia_vence = $3 WHERE id = $4',
    [valores.cargo, valores.licencia_tipo, valores.licencia_vence, id]
  )
  return obtener(id)
}

async function cambiarEstado(solicitante, id, activo) {
  if (Number(id) === solicitante.id) throw errorHttp('No puedes desactivar tu propio usuario', 409)
  const visibles = await listar(solicitante)
  if (!visibles.some((u) => u.id === Number(id))) throw errorHttp('Usuario no encontrado', 404)
  await pool.query('UPDATE usuario SET activo = $1 WHERE id = $2', [Boolean(activo), id])
  return (await listar(solicitante)).find((u) => u.id === Number(id))
}

module.exports = { listar, buscar, crear, asignarRol, cambiarEstado, actualizarPersonalBus }
