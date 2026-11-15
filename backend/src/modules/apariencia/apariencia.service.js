const fs = require('fs')
const { pool } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const COLOR = /^#[0-9a-fA-F]{6}$/
const URL_WEB = /^https?:\/\/[^\s<>]+$/

const CAMPOS = `id, nombre, telefono, email, direccion, logo_url, color_primario, color_acento,
                eslogan, descripcion, facebook_url, instagram_url, whatsapp`

async function obtener(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM cooperativa WHERE id = $1 AND activa`,
    [cooperativaId]
  )
  if (!rows[0]) throw errorHttp('Cooperativa no encontrada', 404)
  return rows[0]
}

const textoOpcional = (valor) => {
  const texto = String(valor ?? '').trim().replace(/\s+/g, ' ')
  return texto || null
}

function validar(datos) {
  const errores = {}
  if (!COLOR.test(datos.color_primario || '')) errores.color_primario = 'Elige un color principal válido'
  if (!COLOR.test(datos.color_acento || '')) errores.color_acento = 'Elige un color de acento válido'
  if (datos.color_primario && datos.color_primario.toLowerCase() === (datos.color_acento || '').toLowerCase()) {
    errores.color_acento = 'El color de acento debe ser distinto del color principal'
  }
  const eslogan = textoOpcional(datos.eslogan)
  if (eslogan && eslogan.length > 120) errores.eslogan = 'El eslogan no puede superar los 120 caracteres'
  const descripcion = textoOpcional(datos.descripcion)
  if (descripcion && descripcion.length > 500) errores.descripcion = 'La descripción no puede superar los 500 caracteres'
  for (const [campo, red] of [['facebook_url', 'Facebook'], ['instagram_url', 'Instagram']]) {
    const url = textoOpcional(datos[campo])
    if (url && (!URL_WEB.test(url) || url.length > 300)) {
      errores[campo] = `Pega el enlace completo de ${red}, empezando con https://`
    }
  }
  const whatsapp = String(datos.whatsapp ?? '').replace(/[\s-]/g, '')
  if (whatsapp && !/^09\d{8}$/.test(whatsapp)) errores.whatsapp = 'El WhatsApp debe ser un celular de 10 dígitos que empiece con 09'
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados', 400, errores)
}

// La cooperativa actualiza su apariencia (solo la suya)
async function actualizar(cooperativaId, datos) {
  validar(datos)
  await pool.query(
    `UPDATE cooperativa
        SET color_primario = $1, color_acento = $2, eslogan = $3, descripcion = $4,
            facebook_url = $5, instagram_url = $6, whatsapp = $7
      WHERE id = $8`,
    [
      datos.color_primario.toLowerCase(),
      datos.color_acento.toLowerCase(),
      textoOpcional(datos.eslogan),
      textoOpcional(datos.descripcion),
      textoOpcional(datos.facebook_url),
      textoOpcional(datos.instagram_url),
      String(datos.whatsapp ?? '').replace(/[\s-]/g, '') || null,
      cooperativaId,
    ]
  )
  return obtener(cooperativaId)
}

async function actualizarLogo(cooperativaId, archivo) {
  if (!archivo) throw errorHttp('Elige una imagen para el logo', 400)
  const url = `/uploads/cooperativas/${archivo.filename}`
  const { rowCount } = await pool.query('UPDATE cooperativa SET logo_url = $1 WHERE id = $2', [url, cooperativaId])
  if (!rowCount) {
    fs.unlink(archivo.path, () => {})
    throw errorHttp('Cooperativa no encontrada', 404)
  }
  return obtener(cooperativaId)
}

async function quitarLogo(cooperativaId) {
  await pool.query('UPDATE cooperativa SET logo_url = NULL WHERE id = $1', [cooperativaId])
  return obtener(cooperativaId)
}

module.exports = { obtener, actualizar, actualizarLogo, quitarLogo }
