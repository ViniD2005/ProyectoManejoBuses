const pool = require('../../config/db');

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje);
  error.status = status;
  error.detalles = detalles;
  return error;
}

// Valida los datos antes de guardar: así responde 400 con el detalle
// de cada campo en lugar de un error 500 de la base de datos.
function validarCooperativa(datos) {
  const errores = {};
  if (!datos.nombre?.trim()) errores.nombre = 'El nombre es obligatorio';
  if (!/^\d{13}$/.test(datos.ruc || '')) errores.ruc = 'El RUC debe tener 13 dígitos';
  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    errores.email = 'El correo no es válido';
  }
  if (Object.keys(errores).length) {
    throw errorHttp('Revisa los datos de la cooperativa', 400, errores);
  }
}

const listarCooperativas = async () => {
  const resultado = await pool.query(
    'SELECT id, nombre, ruc, telefono, email, direccion, logo_url, activa, creado_en FROM cooperativa ORDER BY id ASC'
  );
  return resultado.rows;
};

const obtenerCooperativaPorId = async (id) => {
  const resultado = await pool.query(
    'SELECT id, nombre, ruc, telefono, email, direccion, logo_url, activa, creado_en FROM cooperativa WHERE id = $1',
    [id]
  );
  return resultado.rows[0];
};

const crearCooperativa = async (datos) => {
  validarCooperativa(datos);
  const { nombre, ruc, telefono, email, direccion, logo_url } = datos;
  const resultado = await pool.query(
    `INSERT INTO cooperativa (nombre, ruc, telefono, email, direccion, logo_url, activa)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id, nombre, ruc, telefono, email, direccion, logo_url, activa, creado_en`,
    [nombre, ruc, telefono, email, direccion, logo_url || null]
  );
  return resultado.rows[0];
};

const actualizarCooperativa = async (id, datos) => {
  validarCooperativa(datos);
  const { nombre, ruc, telefono, email, direccion, logo_url } = datos;
  const resultado = await pool.query(
    `UPDATE cooperativa 
     SET nombre = $1, ruc = $2, telefono = $3, email = $4, direccion = $5, logo_url = COALESCE($6, logo_url)
     WHERE id = $7
     RETURNING id, nombre, ruc, telefono, email, direccion, logo_url, activa, creado_en`,
    [nombre, ruc, telefono, email, direccion, logo_url, id]
  );
  return resultado.rows[0];
};

const cambiarEstadoCooperativa = async (id, activa) => {
  const resultado = await pool.query(
    `UPDATE cooperativa SET activa = $1 WHERE id = $2 
     RETURNING id, nombre, ruc, activa`,
    [activa, id]
  );
  return resultado.rows[0];
};

module.exports = {
  listarCooperativas,
  obtenerCooperativaPorId,
  crearCooperativa,
  actualizarCooperativa,
  cambiarEstadoCooperativa,
};