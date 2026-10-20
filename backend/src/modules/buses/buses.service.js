const pool = require('../../config/db');

const listarBuses = async () => {
  const query = `
    SELECT b.*, c.nombre AS cooperativa_nombre 
    FROM buses b
    JOIN cooperativas c ON b.id_cooperativa = c.id
    ORDER BY b.id ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

const crearBus = async (data) => {
  const { id_cooperativa, numero_disco, placa, chasis, carroceria, capacidad_asientos, foto_url } = data;
  const query = `
    INSERT INTO buses (id_cooperativa, numero_disco, placa, chasis, carroceria, capacidad_asientos, foto_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [id_cooperativa, numero_disco, placa, chasis, carroceria, capacidad_asientos, foto_url];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

const actualizarBus = async (id, data) => {
  const { id_cooperativa, numero_disco, placa, chasis, carroceria, capacidad_asientos, foto_url } = data;
  const query = `
    UPDATE buses 
    SET id_cooperativa = $1, numero_disco = $2, placa = $3, chasis = $4, carroceria = $5, capacidad_asientos = $6, foto_url = $7
    WHERE id = $8
    RETURNING *;
  `;
  const values = [id_cooperativa, numero_disco, placa, chasis, carroceria, capacidad_asientos, foto_url, id];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

const cambiarEstadoBus = async (id, activa) => {
  const query = `
    UPDATE buses 
    SET activa = $1 
    WHERE id = $2 
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [activa, id]);
  return rows[0];
};

module.exports = {
  listarBuses,
  crearBus,
  actualizarBus,
  cambiarEstadoBus
};