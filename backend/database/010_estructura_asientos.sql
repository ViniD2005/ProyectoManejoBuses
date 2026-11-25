-- =====================================================================
-- GC-18 - Estructura (plantilla) de asientos de cada bus
--
-- Como en la compra de pasajes de avión o de cine: cada piso del bus es una
-- cuadrícula de filas con asientos a la izquierda y a la derecha del pasillo.
--   bus_piso:  filas y cuántos asientos hay a cada lado del pasillo (2+2, 2+1...)
--   asiento:   fila y columna donde está dibujado
--                columna 1..izquierda          → lado izquierdo (1 = ventana)
--                columna izquierda+1           → pasillo (nunca tiene asiento)
--                columna izquierda+2..         → lado derecho
-- Los buses que ya existían quedan en 2+2 respetando su numeración.
--
-- Se puede ejecutar varias veces sin dañar nada.
-- =====================================================================

CREATE TABLE IF NOT EXISTS bus_piso (
  bus_id     INT NOT NULL REFERENCES bus(id) ON DELETE CASCADE,
  piso       SMALLINT NOT NULL CHECK (piso IN (1, 2)),
  filas      SMALLINT NOT NULL CHECK (filas BETWEEN 1 AND 25),
  izquierda  SMALLINT NOT NULL DEFAULT 2 CHECK (izquierda BETWEEN 1 AND 3),
  derecha    SMALLINT NOT NULL DEFAULT 2 CHECK (derecha BETWEEN 1 AND 3),
  PRIMARY KEY (bus_id, piso)
);

ALTER TABLE asiento ADD COLUMN IF NOT EXISTS fila    SMALLINT;
ALTER TABLE asiento ADD COLUMN IF NOT EXISTS columna SMALLINT;

-- Asientos sin posición: se acomodan en filas de 4 (2 + pasillo + 2) en orden de número
WITH orden AS (
  SELECT a.id, ROW_NUMBER() OVER (PARTITION BY a.bus_id, a.piso ORDER BY a.numero) - 1 AS i
    FROM asiento a
   WHERE a.fila IS NULL OR a.columna IS NULL
)
UPDATE asiento a
   SET fila = (o.i / 4) + 1,
       columna = (ARRAY[1, 2, 4, 5])[(o.i % 4) + 1]
  FROM orden o
 WHERE o.id = a.id;

-- Distribución de cada piso que todavía no la tenga
INSERT INTO bus_piso (bus_id, piso, filas, izquierda, derecha)
SELECT a.bus_id, a.piso, GREATEST(MAX(a.fila), 1), 2, 2
  FROM asiento a
 GROUP BY a.bus_id, a.piso
ON CONFLICT (bus_id, piso) DO NOTHING;

-- Dos asientos no pueden ocupar el mismo lugar del mismo piso
CREATE UNIQUE INDEX IF NOT EXISTS asiento_posicion_unica
  ON asiento (bus_id, piso, fila, columna)
  WHERE fila IS NOT NULL AND columna IS NOT NULL;
