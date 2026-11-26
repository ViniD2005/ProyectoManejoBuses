-- =====================================================================
-- 003 - TURNOS PARA LA HOJA DE RUTA SEMANAL (CC-13)
-- Un turno agrupa las frecuencias que un mismo bus hace en un día
-- (ej. Quito -> Ambato 07:00 y regreso Ambato -> Quito 14:00).
-- Los turnos rotan entre los buses cada día; los buses sobrantes
-- quedan en día de parada ("P").
-- Ejecutar DESPUÉS de 001_esquema.sql y 002_datos_prueba.sql.
-- =====================================================================

CREATE TABLE turno (
  id             SERIAL PRIMARY KEY,
  cooperativa_id INT NOT NULL REFERENCES cooperativa(id),
  nombre         VARCHAR(40) NOT NULL,
  orden          SMALLINT NOT NULL CHECK (orden >= 1),
  UNIQUE (cooperativa_id, nombre),
  UNIQUE (cooperativa_id, orden)
);

-- Cada frecuencia pertenece como máximo a un turno
CREATE TABLE turno_frecuencia (
  turno_id      INT NOT NULL REFERENCES turno(id) ON DELETE CASCADE,
  frecuencia_id INT NOT NULL UNIQUE REFERENCES frecuencia(id) ON DELETE CASCADE,
  PRIMARY KEY (turno_id, frecuencia_id)
);

-- Datos de prueba: dos turnos para Cooperativa Andina
-- Turno 1: Quito -> Ambato 07:00 y Ambato -> Quito 14:00 (ida y vuelta)
-- Turno 2: Quito -> Loja 20:00 (con paradas)
INSERT INTO turno (cooperativa_id, nombre, orden) VALUES
  (1, 'Turno 1', 1),
  (1, 'Turno 2', 2);

INSERT INTO turno_frecuencia (turno_id, frecuencia_id) VALUES
  (1, 3), (1, 2),
  (2, 1);
