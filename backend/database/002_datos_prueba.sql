-- =====================================================================
-- 002 - DATOS INICIALES Y DE PRUEBA
-- Parte 1: catálogos que el sistema necesita (roles, ciudades, ...).
-- Parte 2: datos de prueba para desarrollo (cooperativa, buses, viajes).
-- Ejecutar DESPUÉS de 001_esquema.sql.
-- =====================================================================

INSERT INTO rol (id, nombre, descripcion) VALUES
  (1, 'admin',        'Administrador general del sistema'),
  (2, 'cooperativa',  'Usuario de cooperativa: gestiona sus buses, frecuencias y hojas de ruta'),
  (3, 'oficinista',   'Vende boletos en ventanilla y valida comprobantes de pago'),
  (4, 'personal_bus', 'Chofer o ayudante: registra el acceso de pasajeros'),
  (5, 'cliente',      'Usuario final que compra boletos');

INSERT INTO ciudad (nombre, provincia) VALUES
  ('Quito', 'Pichincha'),            ('Guayaquil', 'Guayas'),
  ('Cuenca', 'Azuay'),               ('Ambato', 'Tungurahua'),
  ('Riobamba', 'Chimborazo'),        ('Latacunga', 'Cotopaxi'),
  ('Loja', 'Loja'),                  ('Ibarra', 'Imbabura'),
  ('Santo Domingo', 'Santo Domingo de los Tsáchilas'),
  ('Esmeraldas', 'Esmeraldas'),      ('Manta', 'Manabí'),
  ('Portoviejo', 'Manabí'),          ('Machala', 'El Oro'),
  ('Babahoyo', 'Los Ríos'),          ('Tulcán', 'Carchi'),
  ('Guaranda', 'Bolívar'),           ('Azogues', 'Cañar'),
  ('Puyo', 'Pastaza'),               ('Tena', 'Napo'),
  ('Baños', 'Tungurahua'),           ('Pelileo', 'Tungurahua'),
  ('Nueva Loja', 'Sucumbíos'),       ('Macas', 'Morona Santiago');

-- Porcentajes referenciales; el equipo debe confirmarlos con la normativa vigente.
INSERT INTO tipo_descuento (codigo, nombre, porcentaje) VALUES
  ('menor_edad',   'Menor de edad', 50),
  ('tercera_edad', 'Tercera edad',  50),
  ('discapacidad', 'Discapacidad',  50);

INSERT INTO metodo_pago (codigo, nombre, requiere_comprobante) VALUES
  ('transferencia', 'Transferencia bancaria', TRUE),
  ('deposito',      'Depósito bancario',      TRUE),
  ('efectivo',      'Efectivo en ventanilla', FALSE);

INSERT INTO configuracion_app (clave, valor) VALUES
  ('nombre_app',      'Pasajes Ecuador'),
  ('logo_url',        ''),
  ('color_primario',  '#1F4E5F'),
  ('color_acento',    '#E8A317'),
  ('soporte_email',   'soporte@pasajes.local'),
  ('soporte_telefono',''),
  ('facebook_url',    ''),
  ('instagram_url',   ''),
  ('cuenta_bancaria', 'Banco Pichincha - Cta. Corriente 0000000000 - Pasajes Ecuador');
-- =====================================================================
-- PARTE 2: DATOS DE PRUEBA (solo desarrollo)
-- Todos los usuarios tienen la contraseña:  Clave123*
-- Los viajes se generan para hoy y los 6 días siguientes a la fecha en
-- que se ejecuta este script: si pasan los días, volver a crear la base.
-- =====================================================================

-- Cooperativas
INSERT INTO cooperativa (nombre, ruc, telefono, email) VALUES
  ('Cooperativa Andina',    '1890000001001', '032400001', 'info@andina.local'),
  ('Transportes del Valle', '1790000002001', '022400002', 'info@delvalle.local');

-- Usuarios (cédulas válidas según el módulo 10)
INSERT INTO usuario (rol_id, cooperativa_id, cedula, nombres, apellidos, email, fecha_nacimiento, password_hash) VALUES
  (1, NULL, '1710034065', 'Ana',    'Administradora', 'admin@pasajes.local',       '1990-01-15', '$2b$10$FDjDbPU70knhJviT7FB9J.Z0zdof7XSqNrWile2S.6oj494SRahQu'),
  (2, 1,    '1803456787', 'Carlos', 'Andina',         'coop@andina.local',         '1985-05-20', '$2b$10$FDjDbPU70knhJviT7FB9J.Z0zdof7XSqNrWile2S.6oj494SRahQu'),
  (3, 1,    '1804567897', 'Olga',   'Oficinista',     'oficina@andina.local',      '1995-03-10', '$2b$10$FDjDbPU70knhJviT7FB9J.Z0zdof7XSqNrWile2S.6oj494SRahQu'),
  (5, NULL, '0102030400', 'Pedro',  'Pasajero',       'cliente@pasajes.local',     '2000-07-01', '$2b$10$FDjDbPU70knhJviT7FB9J.Z0zdof7XSqNrWile2S.6oj494SRahQu'),
  (5, NULL, '1712345675', 'Rosa',   'Mayor',          'adultomayor@pasajes.local', '1950-02-11', '$2b$10$FDjDbPU70knhJviT7FB9J.Z0zdof7XSqNrWile2S.6oj494SRahQu');

-- Tipos de asiento definidos por Cooperativa Andina
INSERT INTO tipo_asiento (cooperativa_id, nombre, factor_precio) VALUES
  (1, 'Normal', 1.00),
  (1, 'VIP',    1.35);

-- Buses de Cooperativa Andina
INSERT INTO bus (cooperativa_id, numero_disco, placa, marca_chasis, marca_carroceria, anio_fabricacion, pisos) VALUES
  (1, '12', 'TBA-1234', 'Mercedes-Benz', 'Carrocerías Olímpica', 2021, 1),
  (1, '27', 'TBC-5678', 'Scania',        'Miral',                2023, 2),
  (1, '33', 'TBD-9012', 'Volvo',         'Varma',                2019, 1);

-- Bus 12: 40 asientos, los 8 primeros VIP
INSERT INTO asiento (bus_id, tipo_asiento_id, numero, piso)
SELECT 1, CASE WHEN n <= 8 THEN 2 ELSE 1 END, n, 1 FROM generate_series(1, 40) n;

-- Bus 27: dos pisos; piso 1 = 12 VIP, piso 2 = 40 normales
INSERT INTO asiento (bus_id, tipo_asiento_id, numero, piso)
SELECT 2, CASE WHEN n <= 12 THEN 2 ELSE 1 END, n, CASE WHEN n <= 12 THEN 1 ELSE 2 END
FROM generate_series(1, 52) n;

-- Bus 33: 44 asientos normales (queda en día de parada: no tiene viajes)
INSERT INTO asiento (bus_id, tipo_asiento_id, numero, piso)
SELECT 3, 1, n, 1 FROM generate_series(1, 44) n;

-- Frecuencias. Ids de ciudad según 002_catalogos.sql:
-- 1 Quito, 3 Cuenca, 4 Ambato, 5 Riobamba, 6 Latacunga, 7 Loja
INSERT INTO frecuencia (cooperativa_id, ciudad_origen_id, ciudad_destino_id, hora_salida, numero_resolucion, fecha_resolucion, tipo_viaje) VALUES
  (1, 1, 7, '20:00', 'ANT-RES-2025-0145', '2025-03-01', 'con_paradas'),  -- Quito -> Loja
  (1, 4, 1, '14:00', 'ANT-RES-2025-0146', '2025-03-01', 'directo'),      -- Ambato -> Quito
  (1, 1, 4, '07:00', 'ANT-RES-2025-0147', '2025-03-01', 'directo');      -- Quito -> Ambato

-- Recorrido Quito - Latacunga - Ambato - Riobamba - Cuenca - Loja
INSERT INTO parada (frecuencia_id, ciudad_id, orden, minutos_desde_salida, precio_acumulado) VALUES
  (1, 1, 1,   0,  0.00),
  (1, 6, 2,  90,  2.50),
  (1, 4, 3, 150,  3.75),
  (1, 5, 4, 210,  5.50),
  (1, 3, 5, 480, 11.00),
  (1, 7, 6, 660, 15.00);

INSERT INTO parada (frecuencia_id, ciudad_id, orden, minutos_desde_salida, precio_acumulado) VALUES
  (2, 4, 1, 0, 0.00), (2, 1, 2, 150, 3.75),
  (3, 1, 1, 0, 0.00), (3, 4, 2, 150, 3.75);

-- Hojas de ruta para los próximos 7 días
INSERT INTO hoja_ruta (cooperativa_id, fecha, generacion, creado_por)
SELECT 1, CURRENT_DATE + d, 'manual', 2 FROM generate_series(0, 6) d;

-- Bus 27 hace Quito-Loja; bus 12 hace Quito-Ambato (07:00) y regresa Ambato-Quito (14:00)
INSERT INTO viaje (hoja_ruta_id, frecuencia_id, bus_id, fecha)
SELECT hr.id, 1, 2, hr.fecha FROM hoja_ruta hr
UNION ALL
SELECT hr.id, 3, 1, hr.fecha FROM hoja_ruta hr
UNION ALL
SELECT hr.id, 2, 1, hr.fecha FROM hoja_ruta hr;
