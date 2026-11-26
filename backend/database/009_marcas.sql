-- =====================================================================
-- 009 - MARCAS DE CHASIS Y DE CARROCERÍA (GC-13)
-- El administrador gestiona las marcas y las cooperativas solo las
-- eligen de una lista. Así "Mercedes-Benz" no aparece escrita de varias
-- formas y los reportes por marca salen correctos.
-- Ejecutar DESPUÉS de los scripts 001 a 006.
-- =====================================================================

CREATE TABLE IF NOT EXISTS marca (
  id     SERIAL PRIMARY KEY,
  tipo   VARCHAR(12) NOT NULL CHECK (tipo IN ('chasis', 'carroceria')),
  nombre VARCHAR(40) NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tipo, nombre)
);

INSERT INTO marca (tipo, nombre) VALUES
  ('chasis', 'Mercedes-Benz'), ('chasis', 'Scania'), ('chasis', 'Volvo'), ('chasis', 'Hino'),
  ('chasis', 'Chevrolet'), ('chasis', 'Volkswagen'), ('chasis', 'International'), ('chasis', 'Yutong'),
  ('chasis', 'King Long'), ('chasis', 'Higer'), ('chasis', 'Agrale'), ('chasis', 'Isuzu'),
  ('carroceria', 'Carrocerías Olímpica'), ('carroceria', 'Miral'), ('carroceria', 'Varma'),
  ('carroceria', 'Picosa'), ('carroceria', 'Cepeda'), ('carroceria', 'Patricio Cepeda'),
  ('carroceria', 'IMCE'), ('carroceria', 'Pillapa'), ('carroceria', 'Megabuss'),
  ('carroceria', 'Marcopolo'), ('carroceria', 'Busscar'), ('carroceria', 'Irizar')
ON CONFLICT (tipo, nombre) DO NOTHING;

-- Las marcas que ya usan los buses registrados quedan en el catálogo
INSERT INTO marca (tipo, nombre) SELECT DISTINCT 'chasis', marca_chasis FROM bus ON CONFLICT (tipo, nombre) DO NOTHING;
INSERT INTO marca (tipo, nombre) SELECT DISTINCT 'carroceria', marca_carroceria FROM bus ON CONFLICT (tipo, nombre) DO NOTHING;
