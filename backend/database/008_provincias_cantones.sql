-- =====================================================================
-- 008 - PROVINCIAS Y CANTONES DEL ECUADOR (GC-13)
-- - El administrador gestiona provincias y cantones desde la aplicación.
-- - La tabla "ciudad" pasa a ser el CANTÓN y queda ligada a su provincia.
--   (se mantiene la columna "provincia" con el nombre, para compatibilidad)
-- - Se cargan las 24 provincias y los 221 cantones.
--   Los cantones que ya existían conservan su nombre de uso común:
--   Baños (Baños de Agua Santa), Pelileo (San Pedro de Pelileo),
--   Puyo (cantón Pastaza), Nueva Loja (cantón Lago Agrio) y Macas (cantón Morona).
-- Ejecutar DESPUÉS de los scripts 001 a 006.
-- =====================================================================

CREATE TABLE IF NOT EXISTS provincia (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  activa BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO provincia (nombre) VALUES
  ('Azuay'), ('Bolívar'), ('Cañar'), ('Carchi'), ('Chimborazo'), ('Cotopaxi'),
  ('El Oro'), ('Esmeraldas'), ('Galápagos'), ('Guayas'), ('Imbabura'), ('Loja'),
  ('Los Ríos'), ('Manabí'), ('Morona Santiago'), ('Napo'), ('Orellana'), ('Pastaza'),
  ('Pichincha'), ('Santa Elena'), ('Santo Domingo de los Tsáchilas'), ('Sucumbíos'),
  ('Tungurahua'), ('Zamora Chinchipe')
ON CONFLICT (nombre) DO NOTHING;

-- La ciudad (cantón) queda ligada a su provincia
ALTER TABLE ciudad ADD COLUMN IF NOT EXISTS provincia_id INT REFERENCES provincia(id);
ALTER TABLE ciudad ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE ciudad c SET provincia_id = p.id FROM provincia p WHERE p.nombre = c.provincia AND c.provincia_id IS NULL;

ALTER TABLE ciudad ALTER COLUMN provincia_id SET NOT NULL;

-- El mismo nombre puede existir en provincias distintas (ej. Olmedo en Loja y en Manabí)
ALTER TABLE ciudad DROP CONSTRAINT IF EXISTS ciudad_nombre_key;
DO $$ BEGIN
  ALTER TABLE ciudad ADD CONSTRAINT ciudad_nombre_provincia_key UNIQUE (nombre, provincia_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Los 221 cantones (los que ya existen no se duplican)
INSERT INTO ciudad (nombre, provincia, provincia_id)
SELECT c.nombre, p.nombre, p.id
  FROM (VALUES
    ('Azuay', 'Cuenca'), ('Azuay', 'Girón'), ('Azuay', 'Gualaceo'), ('Azuay', 'Nabón'), ('Azuay', 'Paute'),
    ('Azuay', 'Pucará'), ('Azuay', 'San Fernando'), ('Azuay', 'Santa Isabel'), ('Azuay', 'Sígsig'), ('Azuay', 'Oña'),
    ('Azuay', 'Chordeleg'), ('Azuay', 'El Pan'), ('Azuay', 'Sevilla de Oro'), ('Azuay', 'Guachapala'), ('Azuay', 'Camilo Ponce Enríquez'),
    ('Bolívar', 'Guaranda'), ('Bolívar', 'Chillanes'), ('Bolívar', 'Chimbo'), ('Bolívar', 'Echeandía'), ('Bolívar', 'San Miguel'),
    ('Bolívar', 'Caluma'), ('Bolívar', 'Las Naves'),
    ('Cañar', 'Azogues'), ('Cañar', 'Biblián'), ('Cañar', 'Cañar'), ('Cañar', 'La Troncal'), ('Cañar', 'El Tambo'),
    ('Cañar', 'Déleg'), ('Cañar', 'Suscal'),
    ('Carchi', 'Tulcán'), ('Carchi', 'Bolívar'), ('Carchi', 'Espejo'), ('Carchi', 'Mira'), ('Carchi', 'Montúfar'),
    ('Carchi', 'San Pedro de Huaca'),
    ('Chimborazo', 'Riobamba'), ('Chimborazo', 'Alausí'), ('Chimborazo', 'Colta'), ('Chimborazo', 'Chambo'), ('Chimborazo', 'Chunchi'),
    ('Chimborazo', 'Guamote'), ('Chimborazo', 'Guano'), ('Chimborazo', 'Pallatanga'), ('Chimborazo', 'Penipe'), ('Chimborazo', 'Cumandá'),
    ('Cotopaxi', 'Latacunga'), ('Cotopaxi', 'La Maná'), ('Cotopaxi', 'Pangua'), ('Cotopaxi', 'Pujilí'), ('Cotopaxi', 'Salcedo'),
    ('Cotopaxi', 'Saquisilí'), ('Cotopaxi', 'Sigchos'),
    ('El Oro', 'Machala'), ('El Oro', 'Arenillas'), ('El Oro', 'Atahualpa'), ('El Oro', 'Balsas'), ('El Oro', 'Chilla'),
    ('El Oro', 'El Guabo'), ('El Oro', 'Huaquillas'), ('El Oro', 'Marcabelí'), ('El Oro', 'Pasaje'), ('El Oro', 'Piñas'),
    ('El Oro', 'Portovelo'), ('El Oro', 'Santa Rosa'), ('El Oro', 'Zaruma'), ('El Oro', 'Las Lajas'),
    ('Esmeraldas', 'Esmeraldas'), ('Esmeraldas', 'Eloy Alfaro'), ('Esmeraldas', 'Muisne'), ('Esmeraldas', 'Quinindé'),
    ('Esmeraldas', 'San Lorenzo'), ('Esmeraldas', 'Atacames'), ('Esmeraldas', 'Rioverde'),
    ('Galápagos', 'San Cristóbal'), ('Galápagos', 'Isabela'), ('Galápagos', 'Santa Cruz'),
    ('Guayas', 'Guayaquil'), ('Guayas', 'Alfredo Baquerizo Moreno'), ('Guayas', 'Balao'), ('Guayas', 'Balzar'), ('Guayas', 'Colimes'),
    ('Guayas', 'Daule'), ('Guayas', 'Durán'), ('Guayas', 'El Empalme'), ('Guayas', 'El Triunfo'), ('Guayas', 'Milagro'),
    ('Guayas', 'Naranjal'), ('Guayas', 'Naranjito'), ('Guayas', 'Palestina'), ('Guayas', 'Pedro Carbo'), ('Guayas', 'Samborondón'),
    ('Guayas', 'Santa Lucía'), ('Guayas', 'Salitre'), ('Guayas', 'San Jacinto de Yaguachi'), ('Guayas', 'Playas'), ('Guayas', 'Simón Bolívar'),
    ('Guayas', 'Coronel Marcelino Maridueña'), ('Guayas', 'Lomas de Sargentillo'), ('Guayas', 'Nobol'), ('Guayas', 'General Antonio Elizalde'), ('Guayas', 'Isidro Ayora'),
    ('Imbabura', 'Ibarra'), ('Imbabura', 'Antonio Ante'), ('Imbabura', 'Cotacachi'), ('Imbabura', 'Otavalo'), ('Imbabura', 'Pimampiro'),
    ('Imbabura', 'San Miguel de Urcuquí'),
    ('Loja', 'Loja'), ('Loja', 'Calvas'), ('Loja', 'Catamayo'), ('Loja', 'Celica'), ('Loja', 'Chaguarpamba'),
    ('Loja', 'Espíndola'), ('Loja', 'Gonzanamá'), ('Loja', 'Macará'), ('Loja', 'Paltas'), ('Loja', 'Puyango'),
    ('Loja', 'Saraguro'), ('Loja', 'Sozoranga'), ('Loja', 'Zapotillo'), ('Loja', 'Pindal'), ('Loja', 'Quilanga'), ('Loja', 'Olmedo'),
    ('Los Ríos', 'Babahoyo'), ('Los Ríos', 'Baba'), ('Los Ríos', 'Montalvo'), ('Los Ríos', 'Puebloviejo'), ('Los Ríos', 'Quevedo'),
    ('Los Ríos', 'Urdaneta'), ('Los Ríos', 'Ventanas'), ('Los Ríos', 'Vinces'), ('Los Ríos', 'Palenque'), ('Los Ríos', 'Buena Fe'),
    ('Los Ríos', 'Valencia'), ('Los Ríos', 'Mocache'), ('Los Ríos', 'Quinsaloma'),
    ('Manabí', 'Portoviejo'), ('Manabí', 'Bolívar'), ('Manabí', 'Chone'), ('Manabí', 'El Carmen'), ('Manabí', 'Flavio Alfaro'),
    ('Manabí', 'Jipijapa'), ('Manabí', 'Junín'), ('Manabí', 'Manta'), ('Manabí', 'Montecristi'), ('Manabí', 'Paján'),
    ('Manabí', 'Pichincha'), ('Manabí', 'Rocafuerte'), ('Manabí', 'Santa Ana'), ('Manabí', 'Sucre'), ('Manabí', 'Tosagua'),
    ('Manabí', '24 de Mayo'), ('Manabí', 'Pedernales'), ('Manabí', 'Olmedo'), ('Manabí', 'Puerto López'), ('Manabí', 'Jama'),
    ('Manabí', 'Jaramijó'), ('Manabí', 'San Vicente'),
    ('Morona Santiago', 'Gualaquiza'), ('Morona Santiago', 'Limón Indanza'), ('Morona Santiago', 'Palora'), ('Morona Santiago', 'Santiago'),
    ('Morona Santiago', 'Sucúa'), ('Morona Santiago', 'Huamboya'), ('Morona Santiago', 'San Juan Bosco'), ('Morona Santiago', 'Taisha'),
    ('Morona Santiago', 'Logroño'), ('Morona Santiago', 'Pablo Sexto'), ('Morona Santiago', 'Tiwintza'),
    ('Napo', 'Tena'), ('Napo', 'Archidona'), ('Napo', 'El Chaco'), ('Napo', 'Quijos'), ('Napo', 'Carlos Julio Arosemena Tola'),
    ('Orellana', 'Francisco de Orellana'), ('Orellana', 'Aguarico'), ('Orellana', 'La Joya de los Sachas'), ('Orellana', 'Loreto'),
    ('Pastaza', 'Mera'), ('Pastaza', 'Santa Clara'), ('Pastaza', 'Arajuno'),
    ('Pichincha', 'Quito'), ('Pichincha', 'Cayambe'), ('Pichincha', 'Mejía'), ('Pichincha', 'Pedro Moncayo'), ('Pichincha', 'Rumiñahui'),
    ('Pichincha', 'San Miguel de los Bancos'), ('Pichincha', 'Pedro Vicente Maldonado'), ('Pichincha', 'Puerto Quito'),
    ('Santa Elena', 'Santa Elena'), ('Santa Elena', 'La Libertad'), ('Santa Elena', 'Salinas'),
    ('Santo Domingo de los Tsáchilas', 'Santo Domingo'), ('Santo Domingo de los Tsáchilas', 'La Concordia'),
    ('Sucumbíos', 'Gonzalo Pizarro'), ('Sucumbíos', 'Putumayo'), ('Sucumbíos', 'Shushufindi'), ('Sucumbíos', 'Sucumbíos'),
    ('Sucumbíos', 'Cascales'), ('Sucumbíos', 'Cuyabeno'),
    ('Tungurahua', 'Ambato'), ('Tungurahua', 'Cevallos'), ('Tungurahua', 'Mocha'), ('Tungurahua', 'Patate'), ('Tungurahua', 'Quero'),
    ('Tungurahua', 'Santiago de Píllaro'), ('Tungurahua', 'Tisaleo'),
    ('Zamora Chinchipe', 'Zamora'), ('Zamora Chinchipe', 'Chinchipe'), ('Zamora Chinchipe', 'Nangaritza'), ('Zamora Chinchipe', 'Yacuambi'),
    ('Zamora Chinchipe', 'Yantzaza'), ('Zamora Chinchipe', 'El Pangui'), ('Zamora Chinchipe', 'Centinela del Cóndor'),
    ('Zamora Chinchipe', 'Palanda'), ('Zamora Chinchipe', 'Paquisha')
  ) AS c(provincia, nombre)
  JOIN provincia p ON p.nombre = c.provincia
ON CONFLICT (nombre, provincia_id) DO NOTHING;

-- Nuevos cantones activos por defecto; las búsquedas se hacen por nombre
CREATE INDEX IF NOT EXISTS idx_ciudad_provincia ON ciudad (provincia_id);
