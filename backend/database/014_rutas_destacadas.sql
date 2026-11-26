-- GC-35 - Rutas destacadas
-- La cooperativa paga por fuera del sistema; el administrador registra cuántas
-- rutas (frecuencias) puede destacar y hasta qué fecha. El usuario de la cooperativa
-- marca sus frecuencias destacadas sin pasar ese cupo. En la búsqueda del cliente
-- los viajes de frecuencias destacadas (con plan vigente) aparecen primero.
-- Se puede ejecutar varias veces sin error.

ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS rutas_destacadas SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS destacadas_hasta DATE;
ALTER TABLE frecuencia  ADD COLUMN IF NOT EXISTS destacada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE frecuencia  ADD COLUMN IF NOT EXISTS destacada_en TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cooperativa_rutas_destacadas_rango') THEN
    ALTER TABLE cooperativa ADD CONSTRAINT cooperativa_rutas_destacadas_rango CHECK (rutas_destacadas BETWEEN 0 AND 20);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_frecuencia_destacada ON frecuencia (cooperativa_id) WHERE destacada;
