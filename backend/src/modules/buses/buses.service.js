const pool = require('../../config/db');

exports.obtenerBusesPorCooperativa = async (cooperativaId) => {
    const query = `
        SELECT b.*, COUNT(a.id) as total_asientos 
        FROM bus b 
        LEFT JOIN asiento a ON b.id = a.bus_id 
        WHERE b.cooperativa_id = $1 
        GROUP BY b.id 
        ORDER BY b.id DESC;
    `;
    const { rows } = await pool.query(query, [cooperativaId]);
    return rows;
};

exports.crearBus = async (datos) => {
    const { numero_disco, placa, marca_chasis, marca_carroceria, anio_fabricacion, pisos, cantidad_asientos, tipo_asiento_id, cooperativa_id } = datos;
    
    if (!placa || !numero_disco || !cantidad_asientos) {
        throw new Error('Faltan campos obligatorios: placa, numero_disco o cantidad_asientos');
    }

    const placaUpper = placa.toUpperCase();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Insertar el bus
        const queryBus = `
            INSERT INTO bus (numero_disco, placa, marca_chasis, marca_carroceria, anio_fabricacion, pisos, activo, cooperativa_id)
            VALUES ($1, $2, $3, $4, $5, $6, true, $7)
            RETURNING *;
        `;
        const valuesBus = [numero_disco, placaUpper, marca_chasis, marca_carroceria, anio_fabricacion, pisos || 1, cooperativa_id];
        const resBus = await client.query(queryBus, valuesBus);
        const busCreado = resBus.rows[0];

        // Generar asientos automáticamente
        const asientosPorPiso = Math.ceil(cantidad_asientos / (pisos || 1));
        let numeroAsiento = 1;

        for (let piso = 1; piso <= (pisos || 1); piso++) {
            for (let i = 0; i < asientosPorPiso && numeroAsiento <= cantidad_asientos; i++) {
                const queryAsiento = `
                    INSERT INTO asiento (bus_id, numero, piso, tipo_asiento_id, estado)
                    VALUES ($1, $2, $3, $4, 'disponible');
                `;
                await client.query(queryAsiento, [busCreado.id, `A${numeroAsiento}`, piso, tipo_asiento_id || 1]);
                numeroAsiento++;
            }
        }

        await client.query('COMMIT');
        return { ...busCreado, total_asientos: cantidad_asientos };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.actualizarBus = async (id, cooperativaId, datos) => {
    const { numero_disco, placa, marca_chasis, marca_carroceria, anio_fabricacion, pisos } = datos;
    const query = `
        UPDATE bus 
        SET numero_disco = $1, placa = $2, marca_chasis = $3, marca_carroceria = $4, anio_fabricacion = $5, pisos = $6
        WHERE id = $7 AND cooperativa_id = $8
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [numero_disco, placa?.toUpperCase(), marca_chasis, marca_carroceria, anio_fabricacion, pisos, id, cooperativaId]);
    if (rows.length === 0) throw new Error('Bus no encontrado o no autorizado');
    return rows[0];
};

exports.cambiarEstado = async (id, cooperativaId, activo) => {
    const query = `
        UPDATE bus SET activo = $1 WHERE id = $2 AND cooperativa_id = $3 RETURNING *;
    `;
    const { rows } = await pool.query(query, [activo, id, cooperativaId]);
    if (rows.length === 0) throw new Error('Bus no encontrado o no autorizado');
    return rows[0];
};