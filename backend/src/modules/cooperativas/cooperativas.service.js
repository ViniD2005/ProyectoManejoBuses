const bcrypt = require('bcryptjs')
const { pool, transaccion } = require('../../config/db')
const { validarCedula } = require('../../utils/cedula')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const limpiar = (valor) => String(valor ?? '').trim().replace(/\s+/g, ' ')
const LETRAS = 'A-Za-zÁÉÍÓÚáéíóúÑñÜü'
const NOMBRE_PERSONA = new RegExp(`^[${LETRAS}]+(?:[ '\\-][${LETRAS}]+)*$`)
const NOMBRE_COOPERATIVA = new RegExp(`^[${LETRAS}0-9]+(?:[ .,&'\\-][${LETRAS}0-9]*)*\\.?$`)
const CORREO = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

/*
  RUC de Ecuador con el algoritmo oficial (CC-23):
  - 13 dígitos, provincia 01-24 o 30, termina en 001 (establecimiento principal)
  - Tercer dígito 0-5: persona natural -> los 10 primeros dígitos son una cédula válida
  - Tercer dígito 6: entidad pública -> módulo 11, coeficientes 3,2,7,6,5,4,3,2; verificador en el dígito 9
  - Tercer dígito 9: sociedad privada -> módulo 11, coeficientes 4,3,2,7,6,5,4,3,2; verificador en el dígito 10
*/
function validarRuc(ruc) {
  const texto = String(ruc ?? '').trim()
  if (!texto) return 'El RUC es obligatorio'
  if (!/^\d+$/.test(texto)) return 'El RUC solo puede contener números'
  if (texto.length !== 13) return 'El RUC debe tener exactamente 13 dígitos'
  const provincia = Number(texto.slice(0, 2))
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return 'Los dos primeros dígitos del RUC no corresponden a una provincia'
  if (!texto.endsWith('001')) return 'El RUC debe terminar en 001'

  const d = texto.split('').map(Number)
  const modulo11 = (coeficientes) => {
    const suma = coeficientes.reduce((total, c, i) => total + c * d[i], 0)
    const residuo = suma % 11
    return residuo === 0 ? 0 : 11 - residuo
  }
  const invalido = 'El RUC no es válido. Revisa que esté bien escrito'

  if (d[2] < 6) return validarCedula(texto.slice(0, 10)) ? null : invalido
  if (d[2] === 6) {
    const verificador = modulo11([3, 2, 7, 6, 5, 4, 3, 2])
    return verificador !== 10 && verificador === d[8] && texto.slice(9) === '0001' ? null : invalido
  }
  if (d[2] === 9) {
    const verificador = modulo11([4, 3, 2, 7, 6, 5, 4, 3, 2])
    return verificador !== 10 && verificador === d[9] ? null : invalido
  }
  return 'El tercer dígito del RUC no es válido'
}

function validarTelefono(valor, obligatorio) {
  const texto = String(valor ?? '').replace(/[\s-]/g, '')
  if (!texto) return obligatorio ? 'El teléfono es obligatorio' : null
  if (!/^09\d{8}$/.test(texto) && !/^0[2-7]\d{7}$/.test(texto)) {
    return 'Escribe un celular (09XXXXXXXX) o un teléfono fijo con código de provincia (02XXXXXXX)'
  }
  return null
}

// Valida los datos de la cooperativa y devuelve los errores por campo
function erroresCooperativa(datos) {
  const errores = {}
  const nombre = limpiar(datos.nombre)
  if (!nombre) errores.nombre = 'El nombre de la cooperativa es obligatorio'
  else if (nombre.length < 3 || nombre.length > 120) errores.nombre = 'El nombre debe tener entre 3 y 120 caracteres'
  else if (!NOMBRE_COOPERATIVA.test(nombre)) errores.nombre = 'El nombre solo puede contener letras, números, espacios y los signos . , & -'

  const errorRuc = validarRuc(datos.ruc)
  if (errorRuc) errores.ruc = errorRuc

  const errorTelefono = validarTelefono(datos.telefono, true)
  if (errorTelefono) errores.telefono = errorTelefono

  const email = String(datos.email ?? '').trim()
  if (!email) errores.email = 'El correo de contacto es obligatorio'
  else if (!CORREO.test(email) || email.length > 120) errores.email = 'Escribe un correo válido, por ejemplo contacto@cooperativa.com'

  const direccion = limpiar(datos.direccion)
  if (!direccion) errores.direccion = 'La dirección es obligatoria'
  else if (direccion.length < 5 || direccion.length > 200) errores.direccion = 'La dirección debe tener entre 5 y 200 caracteres'
  return errores
}

// Valida los datos de un usuario nuevo que será el responsable de la cooperativa
function erroresResponsableNuevo(datos = {}) {
  const errores = {}
  const cedula = String(datos.cedula ?? '').trim()
  if (!/^\d{10}$/.test(cedula)) errores.responsable_cedula = 'La cédula debe tener exactamente 10 dígitos'
  else if (!validarCedula(cedula)) errores.responsable_cedula = 'La cédula no es válida. Revisa que esté bien escrita'
  for (const [campo, etiqueta] of [['nombres', 'Los nombres'], ['apellidos', 'Los apellidos']]) {
    const texto = limpiar(datos[campo])
    if (!texto) errores[`responsable_${campo}`] = `${etiqueta} son obligatorios`
    else if (texto.length < 2 || texto.length > 60 || !NOMBRE_PERSONA.test(texto)) {
      errores[`responsable_${campo}`] = `${etiqueta} solo pueden contener letras y espacios (2 a 60 caracteres)`
    }
  }
  const email = String(datos.email ?? '').trim()
  if (!CORREO.test(email) || email.length > 120) errores.responsable_email = 'Escribe un correo válido para el responsable'
  const errorTelefono = validarTelefono(datos.telefono, false)
  if (errorTelefono) errores.responsable_telefono = errorTelefono
  const clave = String(datos.password ?? '')
  if (clave.length < 8 || clave.length > 64 || !/[A-ZÁÉÍÓÚÑ]/.test(clave) || !/[a-záéíóúñ]/.test(clave) || !/\d/.test(clave)) {
    errores.responsable_password = 'La contraseña debe tener al menos 8 caracteres, con una mayúscula, una minúscula y un número'
  }
  return errores
}

const CAMPOS = 'c.id, c.nombre, c.ruc, c.telefono, c.email, c.direccion, c.logo_url, c.activa, c.creado_en'

// Listado público (lo usan la búsqueda de viajes y los formularios)
const listarCooperativas = async () => {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM cooperativa c ORDER BY c.nombre`)
  return rows
}

const obtenerCooperativaPorId = async (id) => {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM cooperativa c WHERE c.id = $1`, [id])
  return rows[0]
}

// CC-23: listado para el administrador, con los responsables de cada cooperativa
const listarParaGestion = async () => {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS},
            COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
              'id', u.id, 'nombres', u.nombres, 'apellidos', u.apellidos,
              'email', u.email, 'cedula', u.cedula, 'activo', u.activo
            ) ORDER BY u.apellidos) FILTER (WHERE u.id IS NOT NULL), '[]') AS responsables
       FROM cooperativa c
       LEFT JOIN usuario u ON u.cooperativa_id = c.id
                          AND u.rol_id = (SELECT id FROM rol WHERE nombre = 'cooperativa')
      GROUP BY c.id
      ORDER BY c.nombre`
  )
  return rows
}

// Usuarios registrados que pueden ser responsables: clientes activos (sin cooperativa)
const listarCandidatos = async (texto) => {
  const termino = limpiar(texto)
  const { rows } = await pool.query(
    `SELECT u.id, u.cedula, u.nombres, u.apellidos, u.email
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre = 'cliente' AND u.activo
        AND ($1 = '' OR u.cedula LIKE $1 || '%'
             OR LOWER(u.email) LIKE '%' || LOWER($1) || '%'
             OR LOWER(u.nombres || ' ' || u.apellidos) LIKE '%' || LOWER($1) || '%')
      ORDER BY u.apellidos, u.nombres
      LIMIT 20`,
    [termino]
  )
  return rows
}

// Revisa duplicados de nombre y RUC antes de guardar (mensaje claro por campo)
async function revisarDuplicados(datos, idActual = null) {
  const errores = {}
  const { rows } = await pool.query(
    `SELECT id, LOWER(nombre) AS nombre, ruc FROM cooperativa
      WHERE (LOWER(nombre) = LOWER($1) OR ruc = $2) AND ($3::int IS NULL OR id <> $3)`,
    [limpiar(datos.nombre), String(datos.ruc ?? '').trim(), idActual]
  )
  if (rows.some((c) => c.nombre === limpiar(datos.nombre).toLowerCase())) errores.nombre = 'Ya existe una cooperativa con este nombre'
  if (rows.some((c) => c.ruc === String(datos.ruc).trim())) errores.ruc = 'Ya existe una cooperativa registrada con este RUC'
  return errores
}

/*
  CC-23: crea la cooperativa y le asigna su usuario responsable en una sola transacción.
  datos.responsable puede ser:
    { usuario_id }                                    -> un cliente registrado pasa a ser el usuario de la cooperativa
    { nuevo: { cedula, nombres, apellidos, email, telefono, password } }  -> se crea su cuenta
*/
const crearCooperativa = async (datos) => {
  const errores = { ...erroresCooperativa(datos), ...(await revisarDuplicados(datos)) }
  const responsable = datos.responsable || {}

  if (responsable.usuario_id) {
    const { rows } = await pool.query(
      `SELECT u.id, r.nombre AS rol, u.activo FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`,
      [responsable.usuario_id]
    )
    const usuario = rows[0]
    if (!usuario) errores.responsable = 'El usuario elegido no existe'
    else if (!usuario.activo) errores.responsable = 'El usuario elegido está desactivado'
    else if (usuario.rol !== 'cliente') errores.responsable = 'El usuario elegido ya tiene otro rol en el sistema. Elige un usuario registrado como cliente'
  } else if (responsable.nuevo) {
    Object.assign(errores, erroresResponsableNuevo(responsable.nuevo))
    const { rows } = await pool.query(
      'SELECT cedula, LOWER(email) AS email FROM usuario WHERE cedula = $1 OR LOWER(email) = LOWER($2)',
      [String(responsable.nuevo.cedula ?? '').trim(), String(responsable.nuevo.email ?? '').trim()]
    )
    if (rows.some((u) => u.cedula === String(responsable.nuevo.cedula).trim())) {
      errores.responsable_cedula = 'Ya existe un usuario con esta cédula. Elige "Usuario registrado" y búscalo'
    }
    if (rows.some((u) => u.email === String(responsable.nuevo.email).trim().toLowerCase())) {
      errores.responsable_email = 'Este correo ya está registrado'
    }
  } else {
    errores.responsable = 'Asigna el usuario que administrará la cooperativa'
  }

  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados de la cooperativa', 400, errores)

  const id = await transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO cooperativa (nombre, ruc, telefono, email, direccion, activa)
       VALUES ($1, $2, $3, LOWER($4), $5, TRUE)
       RETURNING id`,
      [limpiar(datos.nombre), datos.ruc.trim(), String(datos.telefono).replace(/[\s-]/g, ''),
        datos.email.trim(), limpiar(datos.direccion)]
    )
    const cooperativaId = rows[0].id

    if (responsable.usuario_id) {
      await cliente.query(
        `UPDATE usuario SET rol_id = (SELECT id FROM rol WHERE nombre = 'cooperativa'), cooperativa_id = $1
          WHERE id = $2`,
        [cooperativaId, responsable.usuario_id]
      )
    } else {
      const n = responsable.nuevo
      const hash = await bcrypt.hash(n.password, 10)
      await cliente.query(
        `INSERT INTO usuario (rol_id, cooperativa_id, cedula, nombres, apellidos, email, telefono, password_hash)
         VALUES ((SELECT id FROM rol WHERE nombre = 'cooperativa'), $1, $2, $3, $4, LOWER($5), $6, $7)`,
        [cooperativaId, n.cedula.trim(), limpiar(n.nombres), limpiar(n.apellidos), n.email.trim(),
          n.telefono ? String(n.telefono).replace(/[\s-]/g, '') : null, hash]
      )
    }
    return cooperativaId
  })

  return (await listarParaGestion()).find((c) => c.id === id)
}

const actualizarCooperativa = async (id, datos) => {
  const errores = { ...erroresCooperativa(datos), ...(await revisarDuplicados(datos, Number(id))) }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados de la cooperativa', 400, errores)
  const { rowCount } = await pool.query(
    `UPDATE cooperativa
        SET nombre = $1, ruc = $2, telefono = $3, email = LOWER($4), direccion = $5
      WHERE id = $6`,
    [limpiar(datos.nombre), datos.ruc.trim(), String(datos.telefono).replace(/[\s-]/g, ''),
      datos.email.trim(), limpiar(datos.direccion), id]
  )
  if (!rowCount) return null
  return (await listarParaGestion()).find((c) => c.id === Number(id))
}

const cambiarEstadoCooperativa = async (id, activa) => {
  const { rows } = await pool.query(
    'UPDATE cooperativa SET activa = $1 WHERE id = $2 RETURNING id, nombre, ruc, activa',
    [Boolean(activa), id]
  )
  return rows[0]
}

/*
  CC-23: agrega otro usuario responsable a una cooperativa existente
  (un cliente registrado pasa a tener el rol de cooperativa).
*/
const asignarResponsable = async (id, usuarioId) => {
  const cooperativa = await obtenerCooperativaPorId(id)
  if (!cooperativa) throw errorHttp('Cooperativa no encontrada', 404)
  if (!cooperativa.activa) throw errorHttp('Activa la cooperativa antes de asignarle un responsable', 409)
  const { rows } = await pool.query(
    'SELECT u.id, r.nombre AS rol, u.activo FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1',
    [usuarioId]
  )
  const usuario = rows[0]
  if (!usuario) throw errorHttp('Elige un usuario registrado', 400)
  if (!usuario.activo) throw errorHttp('El usuario elegido está desactivado', 409)
  if (usuario.rol !== 'cliente') throw errorHttp('El usuario elegido ya tiene otro rol. Elige un usuario registrado como cliente', 409)
  await pool.query(
    `UPDATE usuario SET rol_id = (SELECT id FROM rol WHERE nombre = 'cooperativa'), cooperativa_id = $1 WHERE id = $2`,
    [id, usuarioId]
  )
  return (await listarParaGestion()).find((c) => c.id === Number(id))
}

module.exports = {
  validarRuc,
  listarCooperativas,
  obtenerCooperativaPorId,
  listarParaGestion,
  listarCandidatos,
  crearCooperativa,
  actualizarCooperativa,
  cambiarEstadoCooperativa,
  asignarResponsable,
}
