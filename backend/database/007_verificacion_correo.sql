-- =====================================================================
-- GC-12 - Verificación de correo y recuperación de contraseña (MailHog)
--
-- * usuario.correo_verificado: los usuarios que YA existen quedan
--   verificados (DEFAULT TRUE). Solo el cliente que se registra solo
--   empieza sin verificar (el backend lo guarda con FALSE).
-- * token_correo: enlaces de un solo uso que se envían por correo.
--   Se guarda el SHA-256 del token, nunca el token en claro.
--
-- Se puede ejecutar varias veces sin dañar nada.
-- =====================================================================

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS correo_verificado BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS correo_verificado_en TIMESTAMP;

CREATE TABLE IF NOT EXISTS token_correo (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('verificacion', 'recuperacion')),
  token_hash  CHAR(64) NOT NULL UNIQUE,
  expira_en   TIMESTAMP NOT NULL,
  usado_en    TIMESTAMP,
  creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_correo_usuario ON token_correo (usuario_id, tipo, creado_en DESC);
