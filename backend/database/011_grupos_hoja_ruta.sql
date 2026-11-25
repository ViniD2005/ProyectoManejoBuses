-- =====================================================================
-- GC-19 - Grupos de buses y frecuencias + hoja de ruta por grupo
--
-- * grupo: cada cooperativa separa su operación (Urbano, Interprovincial,
--   Rural...). Un bus y una frecuencia pertenecen a UN solo grupo.
-- * La hoja de ruta se arma por grupo y por fecha.
-- * Lo que ya existía se pasa a un grupo "Interprovincial" por cooperativa.
-- * Datos de prueba: dos buses más para Cooperativa Andina, así su grupo
--   tiene 3 frecuencias y 5 buses (3 en ruta + 2 en parada cada día).
--
-- Se puede ejecutar varias veces sin dañar nada.
-- =====================================================================

CREATE TABLE IF NOT EXISTS grupo (
  id             SERIAL PRIMARY KEY,
  cooperativa_id INT NOT NULL REFERENCES cooperativa(id),
  nombre         VARCHAR(40) NOT NULL,
  descripcion    VARCHAR(200),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (cooperativa_id, nombre)
);

ALTER TABLE bus        ADD COLUMN IF NOT EXISTS grupo_id INT REFERENCES grupo(id) ON DELETE SET NULL;
ALTER TABLE frecuencia ADD COLUMN IF NOT EXISTS grupo_id INT REFERENCES grupo(id) ON DELETE SET NULL;
ALTER TABLE hoja_ruta  ADD COLUMN IF NOT EXISTS grupo_id INT REFERENCES grupo(id);

-- Grupo inicial para cada cooperativa que ya tiene buses, frecuencias u hojas de ruta
INSERT INTO grupo (cooperativa_id, nombre, descripcion)
SELECT c.id, 'Interprovincial', 'Rutas entre provincias'
  FROM cooperativa c
 WHERE EXISTS (SELECT 1 FROM bus b WHERE b.cooperativa_id = c.id)
    OR EXISTS (SELECT 1 FROM frecuencia f WHERE f.cooperativa_id = c.id)
    OR EXISTS (SELECT 1 FROM hoja_ruta h WHERE h.cooperativa_id = c.id)
ON CONFLICT (cooperativa_id, nombre) DO NOTHING;

UPDATE bus b SET grupo_id = g.id
  FROM grupo g WHERE g.cooperativa_id = b.cooperativa_id AND g.nombre = 'Interprovincial' AND b.grupo_id IS NULL;
UPDATE frecuencia f SET grupo_id = g.id
  FROM grupo g WHERE g.cooperativa_id = f.cooperativa_id AND g.nombre = 'Interprovincial' AND f.grupo_id IS NULL;
UPDATE hoja_ruta h SET grupo_id = g.id
  FROM grupo g WHERE g.cooperativa_id = h.cooperativa_id AND g.nombre = 'Interprovincial' AND h.grupo_id IS NULL;

-- Ahora la hoja de ruta es única por grupo y fecha (antes: por cooperativa y fecha)
ALTER TABLE hoja_ruta ALTER COLUMN grupo_id SET NOT NULL;
ALTER TABLE hoja_ruta DROP CONSTRAINT IF EXISTS hoja_ruta_cooperativa_id_fecha_key;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hoja_ruta_grupo_fecha_key') THEN
    ALTER TABLE hoja_ruta ADD CONSTRAINT hoja_ruta_grupo_fecha_key UNIQUE (grupo_id, fecha);
  END IF;
END $$;

-- Datos de prueba: dos buses más en el grupo Interprovincial de Cooperativa Andina
INSERT INTO bus (cooperativa_id, numero_disco, placa, marca_chasis, marca_carroceria, anio_fabricacion, pisos, grupo_id)
SELECT 1, v.disco, v.placa, v.chasis, v.carroceria, v.anio, 1, g.id
  FROM (VALUES ('45', 'TBE-3456', 'Hino', 'Carrocerías Olímpica', 2022),
               ('50', 'TBF-7890', 'Mercedes-Benz', 'Miral', 2024)) AS v(disco, placa, chasis, carroceria, anio)
  JOIN grupo g ON g.cooperativa_id = 1 AND g.nombre = 'Interprovincial'
 WHERE EXISTS (SELECT 1 FROM cooperativa WHERE id = 1)
ON CONFLICT (placa) DO NOTHING;

INSERT INTO asiento (bus_id, tipo_asiento_id, numero, piso)
SELECT b.id, t.id, n, 1
  FROM bus b
  JOIN tipo_asiento t ON t.cooperativa_id = b.cooperativa_id AND t.nombre = 'Normal'
  CROSS JOIN generate_series(1, 40) AS n
 WHERE b.placa IN ('TBE-3456', 'TBF-7890')
ON CONFLICT (bus_id, numero) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_bus_grupo ON bus (grupo_id);
CREATE INDEX IF NOT EXISTS idx_frecuencia_grupo ON frecuencia (grupo_id);
