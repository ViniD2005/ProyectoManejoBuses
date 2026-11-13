-- =====================================================================
-- 004 - USUARIO DE PRUEBA DEL PERSONAL DEL BUS (CC-15)
-- Chofer / ayudante de Cooperativa Andina. Contraseña: Clave123*
-- Ejecutar DESPUÉS de 002_datos_prueba.sql.
-- =====================================================================

INSERT INTO usuario (rol_id, cooperativa_id, cedula, nombres, apellidos, email, fecha_nacimiento, password_hash)
VALUES (4, 1, '1805678909', 'Mario', 'Chofer', 'chofer@andina.local', '1988-08-08',
        '$2b$10$FDjDbPU70knhJviT7FB9J.Z0zdof7XSqNrWile2S.6oj494SRahQu')
ON CONFLICT (email) DO NOTHING;
