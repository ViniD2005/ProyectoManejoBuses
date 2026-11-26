const { pool, transaccion } = require('../../config/db')
const { validarCedula } = require('../../utils/cedula')
const { validarRuc } = require('../cooperativas/cooperativas.service')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-43 - Cuenta bancaria de cada cooperativa.
  El cliente paga por transferencia o depósito a la COOPERATIVA que opera el viaje,
  y es el oficinista de esa cooperativa quien valida el comprobante.
    · La registra o cambia el usuario de la cooperativa (Datos y apariencia)
      o el administrador (Cooperativas).
    · Cada cambio queda registrado (quién y cuándo) y se avisa a la otra parte,
      porque cambiar la cuenta de cobro es una operación sensible.
    · Sin cuenta, la cooperativa no recibe pagos por transferencia en línea.
*/
const BANCOS = [
  'Banco Pichincha', 'Banco Guayaquil', 'Banco del Pacífico', 'Produbanco', 'Banco Internacional',
  'Banco Bolivariano', 'Banco del Austro', 'Banco de Machala', 'Banco General Rumiñahui', 'Banco de Loja',
  'Banco Solidario', 'Banco Amazonas', 'Banco ProCredit', 'Banco Capital', 'BanEcuador',
  'Cooperativa JEP', 'Cooperativa Jardín Azuayo', 'Cooperativa Policía Nacional', 'Cooperativa 29 de Octubre',
  'Cooperativa Alianza del Valle', 'Cooperativa Oscus', 'Cooperativa San Francisco', 'Cooperativa Mushuc Runa',
  'Cooperativa Chibuleo', 'Cooperativa Andalucía', 'Cooperativa Cooprogreso',
]
const TIPOS = { ahorros: 'Ahorros', corriente: 'Corriente' }
const LETRAS = 'A-Za-zÁÉÍÓÚáéíóúÑñÜü'
const TITULAR = new RegExp(`^[${LETRAS}0-9]+(?:[ .,&'\\-][${LETRAS}0-9]*)*\\.?$`)
const limpiar = (v) => String(v ?? '').trim().replace(/\s+/g, ' ')

// Titular: cédula (10 dígitos) o RUC (13), con las mismas reglas que el registro de cooperativas
function validarIdentificacion(valor) {
  const t = String(valor ?? '').trim()
  if (!t) return 'Escribe la cédula o el RUC del titular de la cuenta'
  if (!/^\d+$/.test(t)) return 'La identificación solo puede contener números'
  if (t.length === 10) return validarCedula(t) ? null : 'La cédula del titular no es válida'
  if (t.length === 13) {
    const error = validarRuc(t)
    return error ? error.replace('El RUC', 'El RUC del titular') : null
  }
  return 'La identificación debe tener 10 dígitos (cédula) o 13 (RUC)'
}

function validar(datos = {}) {
  const errores = {}
  const banco = limpiar(datos.banco)
  const tipo = String(datos.tipo ?? '').toLowerCase()
  const numero = String(datos.numero ?? '').replace(/[\s-]/g, '')
  const titular = limpiar(datos.titular)
  const identificacion = String(datos.identificacion ?? '').trim()

  if (!banco) errores.banco = 'Elige el banco o la cooperativa de ahorro'
  else if (!BANCOS.includes(banco)) errores.banco = 'Elige una entidad de la lista'
  if (!TIPOS[tipo]) errores.tipo = 'Elige si la cuenta es de ahorros o corriente'
  if (!numero) errores.numero = 'Escribe el número de cuenta'
  else if (!/^\d+$/.test(numero)) errores.numero = 'El número de cuenta solo puede contener dígitos'
  else if (numero.length < 6 || numero.length > 20) errores.numero = 'El número de cuenta debe tener entre 6 y 20 dígitos'
  else if (/^(\d)\1+$/.test(numero)) errores.numero = 'El número de cuenta no es válido'
  if (titular.length < 3 || titular.length > 100) errores.titular = 'El titular debe tener entre 3 y 100 caracteres'
  else if (!TITULAR.test(titular)) errores.titular = 'El titular contiene caracteres no permitidos'
  const errorId = validarIdentificacion(identificacion)
  if (errorId) errores.identificacion = errorId

  if (Object.keys(errores).length) throw errorHttp('Revisa los datos de la cuenta bancaria', 400, errores)
  return { banco, tipo, numero, titular, identificacion }
}

// Forma pública de la cuenta (la que ve el cliente al pagar)
const formatear = (c) => (c.cuenta_numero
  ? {
      banco: c.cuenta_banco,
      tipo: c.cuenta_tipo,
      tipo_texto: TIPOS[c.cuenta_tipo],
      numero: c.cuenta_numero,
      titular: c.cuenta_titular,
      identificacion: c.cuenta_identificacion,
      actualizada_en: c.cuenta_actualizada_en,
    }
  : null)

async function obtener(cooperativaId, db = pool) {
  const { rows } = await db.query(
    `SELECT id, nombre, ruc, cuenta_banco, cuenta_tipo, cuenta_numero, cuenta_titular,
            cuenta_identificacion, cuenta_actualizada_en
       FROM cooperativa WHERE id = $1`,
    [cooperativaId]
  )
  if (!rows[0]) throw errorHttp('Cooperativa no encontrada', 404)
  const c = rows[0]
  return { cooperativa_id: c.id, cooperativa: c.nombre, ruc: c.ruc, cuenta: formatear(c) }
}

// Guarda la cuenta y avisa a la otra parte (si cambia la cooperativa, al admin; si cambia el admin, a la cooperativa)
async function guardar(cooperativaId, datos, usuario) {
  const v = validar(datos)
  return transaccion(async (cliente) => {
    const antes = await obtener(cooperativaId, cliente)
    const igual = antes.cuenta && antes.cuenta.banco === v.banco && antes.cuenta.tipo === v.tipo &&
      antes.cuenta.numero === v.numero && antes.cuenta.titular === v.titular && antes.cuenta.identificacion === v.identificacion
    if (igual) return { ...antes, sin_cambios: true }

    await cliente.query(
      `UPDATE cooperativa
          SET cuenta_banco = $1, cuenta_tipo = $2, cuenta_numero = $3, cuenta_titular = $4,
              cuenta_identificacion = $5, cuenta_actualizada_en = NOW(), cuenta_actualizada_por = $6
        WHERE id = $7`,
      [v.banco, v.tipo, v.numero, v.titular, v.identificacion, usuario.id, cooperativaId]
    )
    const final = `···${v.numero.slice(-4)}`
    const destino = usuario.rol === 'admin'
      ? `SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre = 'cooperativa' AND u.cooperativa_id = $1 AND u.activo`
      : `SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre = 'admin' AND u.activo AND $1::int IS NOT NULL`
    const persona = await cliente.query("SELECT TRIM(nombres || ' ' || apellidos) AS nombre FROM usuario WHERE id = $1", [usuario.id])
    const quien = usuario.rol === 'admin'
      ? 'El administrador del sistema'
      : `${persona.rows[0]?.nombre || 'El usuario de la cooperativa'} (usuario de la cooperativa)`
    await cliente.query(
      `INSERT INTO notificacion (usuario_id, titulo, mensaje)
       SELECT id, $2, $3 FROM (${destino}) d`,
      [cooperativaId, antes.cuenta ? 'Cuenta bancaria cambiada' : 'Cuenta bancaria registrada',
        `${quien} ${antes.cuenta ? 'cambió' : 'registró'} la cuenta de cobro de ${antes.cooperativa}: ${v.banco}, ${TIPOS[v.tipo].toLowerCase()} ${final}. Si no reconoces este cambio, revísalo de inmediato.`]
    )
    return obtener(cooperativaId, cliente)
  })
}

// Admin: estado de la cuenta de todas las cooperativas
async function listar() {
  const { rows } = await pool.query(
    `SELECT id, cuenta_banco, cuenta_tipo, cuenta_numero, cuenta_titular, cuenta_identificacion, cuenta_actualizada_en
       FROM cooperativa ORDER BY nombre`
  )
  return rows.map((c) => ({ cooperativa_id: c.id, cuenta: formatear(c) }))
}

module.exports = { BANCOS, TIPOS, validar, obtener, guardar, listar, formatear }
