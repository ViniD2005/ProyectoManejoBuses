-- =====================================================================
-- 001 - ESQUEMA DE LA BASE DE DATOS buses_db (PostgreSQL)
-- Modelo de datos acordado en la guía del equipo (sección 5).
-- REGLA DEL EQUIPO: este archivo NO se modifica una vez integrado en
-- develop. Cualquier cambio al esquema va en un archivo nuevo
-- (003_..., 004_...) mediante su propio pull request.
-- =====================================================================

-- Necesaria para la restricción que impide vender el mismo asiento en
-- tramos que se cruzan (ver tabla boleto).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── SEGURIDAD Y USUARIOS ────────────────────────────────────────────
CREATE TABLE rol (
  id          SMALLINT PRIMARY KEY,
  nombre      VARCHAR(30) NOT NULL UNIQUE,   -- admin, cooperativa, oficinista, personal_bus, cliente
  descripcion VARCHAR(150)
);

CREATE TABLE cooperativa (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL UNIQUE,
  ruc        CHAR(13) NOT NULL UNIQUE,
  telefono   VARCHAR(20),
  email      VARCHAR(120),
  direccion  VARCHAR(200),
  logo_url   VARCHAR(300),
  activa     BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE usuario (
  id               SERIAL PRIMARY KEY,
  rol_id           SMALLINT NOT NULL REFERENCES rol(id),
  cooperativa_id   INT REFERENCES cooperativa(id),
  cedula           CHAR(10) NOT NULL UNIQUE,
  nombres          VARCHAR(100) NOT NULL,
  apellidos        VARCHAR(100) NOT NULL,
  email            VARCHAR(120) NOT NULL UNIQUE,
  telefono         VARCHAR(20),
  fecha_nacimiento DATE,
  password_hash    VARCHAR(255) NOT NULL,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Los roles de cooperativa, oficinista y personal de bus siempre
  -- pertenecen a una cooperativa. Admin (1) y cliente (5) no.
  CONSTRAINT chk_usuario_cooperativa CHECK (
    (rol_id IN (2, 3, 4) AND cooperativa_id IS NOT NULL) OR
    (rol_id IN (1, 5))
  )
);

-- ─── CATÁLOGOS ───────────────────────────────────────────────────────
CREATE TABLE ciudad (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL UNIQUE,
  provincia VARCHAR(100) NOT NULL
);

CREATE TABLE tipo_descuento (
  id         SMALLSERIAL PRIMARY KEY,
  codigo     VARCHAR(30) NOT NULL UNIQUE,    -- menor_edad, tercera_edad, discapacidad
  nombre     VARCHAR(60) NOT NULL,
  porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje BETWEEN 0 AND 100),
  activo     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE metodo_pago (
  id                   SMALLSERIAL PRIMARY KEY,
  codigo               VARCHAR(30) NOT NULL UNIQUE,  -- transferencia, deposito, efectivo
  nombre               VARCHAR(60) NOT NULL,
  requiere_comprobante BOOLEAN NOT NULL DEFAULT FALSE,
  activo               BOOLEAN NOT NULL DEFAULT TRUE
);

-- Configuración general de la app (logo, colores, redes, soporte...)
CREATE TABLE configuracion_app (
  clave          VARCHAR(60) PRIMARY KEY,
  valor          TEXT,
  actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── FLOTA ───────────────────────────────────────────────────────────
-- Cada cooperativa define sus propios tipos de asiento y su recargo.
CREATE TABLE tipo_asiento (
  id             SERIAL PRIMARY KEY,
  cooperativa_id INT NOT NULL REFERENCES cooperativa(id),
  nombre         VARCHAR(40) NOT NULL,              -- Normal, VIP, Semicama...
  factor_precio  NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (factor_precio > 0),
  UNIQUE (cooperativa_id, nombre)
);

CREATE TABLE bus (
  id               SERIAL PRIMARY KEY,
  cooperativa_id   INT NOT NULL REFERENCES cooperativa(id),
  numero_disco     VARCHAR(10) NOT NULL,            -- número interno del bus
  placa            VARCHAR(10) NOT NULL UNIQUE,
  marca_chasis     VARCHAR(60) NOT NULL,
  marca_carroceria VARCHAR(60) NOT NULL,
  anio_fabricacion SMALLINT,
  foto_url         VARCHAR(300),
  pisos            SMALLINT NOT NULL DEFAULT 1 CHECK (pisos IN (1, 2)),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (cooperativa_id, numero_disco)
);

CREATE TABLE asiento (
  id              SERIAL PRIMARY KEY,
  bus_id          INT NOT NULL REFERENCES bus(id) ON DELETE CASCADE,
  tipo_asiento_id INT NOT NULL REFERENCES tipo_asiento(id),
  numero          SMALLINT NOT NULL CHECK (numero > 0),
  piso            SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (bus_id, numero)
);

-- ─── FRECUENCIAS (asignadas por la ANT) ──────────────────────────────
CREATE TABLE frecuencia (
  id                SERIAL PRIMARY KEY,
  cooperativa_id    INT NOT NULL REFERENCES cooperativa(id),
  ciudad_origen_id  INT NOT NULL REFERENCES ciudad(id),
  ciudad_destino_id INT NOT NULL REFERENCES ciudad(id),
  hora_salida       TIME NOT NULL,
  numero_resolucion VARCHAR(60) NOT NULL,            -- resolución emitida por la ANT
  fecha_resolucion  DATE,
  tipo_viaje        VARCHAR(15) NOT NULL DEFAULT 'directo'
                    CHECK (tipo_viaje IN ('directo', 'con_paradas')),
  activa            BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (ciudad_origen_id <> ciudad_destino_id),
  UNIQUE (cooperativa_id, ciudad_origen_id, ciudad_destino_id, hora_salida)
);

-- Recorrido completo de la frecuencia, INCLUYENDO origen y destino.
-- Ej. Quito-Loja: 1 Quito, 2 Latacunga, 3 Riobamba, 4 Cuenca, 5 Loja.
-- precio_acumulado = tarifa desde el origen hasta esa parada (asiento normal).
-- Precio de un tramo = acumulado(bajada) - acumulado(subida).
CREATE TABLE parada (
  id                  SERIAL PRIMARY KEY,
  frecuencia_id       INT NOT NULL REFERENCES frecuencia(id) ON DELETE CASCADE,
  ciudad_id           INT NOT NULL REFERENCES ciudad(id),
  orden               SMALLINT NOT NULL CHECK (orden >= 1),
  minutos_desde_salida INT NOT NULL DEFAULT 0 CHECK (minutos_desde_salida >= 0),
  precio_acumulado    NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (precio_acumulado >= 0),
  UNIQUE (frecuencia_id, orden),
  UNIQUE (frecuencia_id, ciudad_id)
);

-- ─── OPERACIÓN DIARIA ────────────────────────────────────────────────
-- Hoja de ruta de una cooperativa para un día. Los buses activos que no
-- tienen viaje en esa hoja están en "día de parada".
CREATE TABLE hoja_ruta (
  id             SERIAL PRIMARY KEY,
  cooperativa_id INT NOT NULL REFERENCES cooperativa(id),
  fecha          DATE NOT NULL,
  generacion     VARCHAR(12) NOT NULL DEFAULT 'manual'
                 CHECK (generacion IN ('manual', 'automatica')),
  creado_por     INT REFERENCES usuario(id),
  creado_en      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (cooperativa_id, fecha)
);

-- Un viaje = una frecuencia operada por un bus en una fecha concreta.
-- Es lo que el cliente busca y compra.
CREATE TABLE viaje (
  id            SERIAL PRIMARY KEY,
  hoja_ruta_id  INT NOT NULL REFERENCES hoja_ruta(id) ON DELETE CASCADE,
  frecuencia_id INT NOT NULL REFERENCES frecuencia(id),
  bus_id        INT NOT NULL REFERENCES bus(id),
  fecha         DATE NOT NULL,
  estado        VARCHAR(15) NOT NULL DEFAULT 'programado'
                CHECK (estado IN ('programado', 'en_curso', 'finalizado', 'cancelado')),
  UNIQUE (frecuencia_id, fecha)
);

-- ─── VENTAS ──────────────────────────────────────────────────────────
-- Una compra agrupa los boletos pagados juntos (varios pasajeros).
CREATE TABLE compra (
  id                  SERIAL PRIMARY KEY,
  cliente_id          INT NOT NULL REFERENCES usuario(id),
  vendido_por         INT REFERENCES usuario(id),       -- oficinista si fue venta en ventanilla
  metodo_pago_id      SMALLINT NOT NULL REFERENCES metodo_pago(id),
  total               NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  estado_pago         VARCHAR(15) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado_pago IN ('pendiente', 'en_revision', 'aprobado', 'rechazado')),
  referencia_bancaria VARCHAR(60),
  comprobante_url     VARCHAR(300),
  validado_por        INT REFERENCES usuario(id),       -- oficinista que revisó el comprobante
  validado_en         TIMESTAMP,
  motivo_rechazo      VARCHAR(250),
  creado_en           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE boleto (
  id                SERIAL PRIMARY KEY,
  codigo            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),  -- va dentro del QR
  compra_id         INT NOT NULL REFERENCES compra(id) ON DELETE CASCADE,
  viaje_id          INT NOT NULL REFERENCES viaje(id),
  asiento_id        INT NOT NULL REFERENCES asiento(id),
  pasajero_cedula   CHAR(10) NOT NULL,
  pasajero_nombre   VARCHAR(200) NOT NULL,
  tipo_descuento_id SMALLINT REFERENCES tipo_descuento(id),
  orden_subida      SMALLINT NOT NULL,   -- parada.orden donde sube
  orden_bajada      SMALLINT NOT NULL,   -- parada.orden donde baja
  precio_base       NUMERIC(8,2) NOT NULL,
  descuento         NUMERIC(8,2) NOT NULL DEFAULT 0,
  precio_final      NUMERIC(8,2) NOT NULL,
  estado            VARCHAR(12) NOT NULL DEFAULT 'reservado'
                    CHECK (estado IN ('reservado', 'emitido', 'usado', 'anulado')),
  creado_en         TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (orden_subida < orden_bajada),
  CHECK (precio_final = precio_base - descuento),
  -- Un mismo asiento de un mismo viaje no puede venderse dos veces en
  -- tramos que se cruzan. Quito(1)->Riobamba(3) y Riobamba(3)->Loja(5)
  -- SÍ pueden compartir asiento: [1,3) y [3,5) no se solapan.
  CONSTRAINT excl_asiento_tramo EXCLUDE USING gist (
    viaje_id   WITH =,
    asiento_id WITH =,
    int4range(orden_subida, orden_bajada) WITH &&
  ) WHERE (estado <> 'anulado')
);

-- ─── ACCESO Y NOTIFICACIONES ─────────────────────────────────────────
-- Uso futuro: escaneo del QR por el personal del bus (fuera del alcance
-- de la primera entrega).
CREATE TABLE acceso_pasajero (
  id             SERIAL PRIMARY KEY,
  boleto_id      INT NOT NULL UNIQUE REFERENCES boleto(id),
  registrado_por INT NOT NULL REFERENCES usuario(id),
  fecha          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notificacion (
  id         SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  titulo     VARCHAR(120) NOT NULL,
  mensaje    TEXT NOT NULL,
  leida      BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── ÍNDICES PARA LAS CONSULTAS MÁS FRECUENTES ───────────────────────
CREATE INDEX idx_viaje_fecha        ON viaje (fecha);
CREATE INDEX idx_parada_ciudad      ON parada (ciudad_id);
CREATE INDEX idx_boleto_viaje       ON boleto (viaje_id);
CREATE INDEX idx_compra_cliente     ON compra (cliente_id);
CREATE INDEX idx_compra_estado_pago ON compra (estado_pago);
CREATE INDEX idx_notificacion_usr   ON notificacion (usuario_id, leida);
