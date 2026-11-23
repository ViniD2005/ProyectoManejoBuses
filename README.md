# Pasajes Ecuador — Sistema de venta de pasajes interprovinciales

Aplicación web para la gestión y venta de pasajes de transporte interprovincial en Ecuador.
Proyecto del segundo parcial de **Manejo y Configuración de Software** (UTA – FISEI).

## Funcionalidades

| Rol | Qué puede hacer |
|---|---|
| **Cliente** | Buscar viajes (incluso entre paradas intermedias) con filtros, ver el detalle del bus, elegir asientos, comprar con descuentos (tercera edad, menor de edad, discapacidad), subir el comprobante de pago, ver su historial y descargar el boleto en PDF con código QR |
| **Oficinista** | Validar los comprobantes de pago: aprobar (boletos emitidos) o rechazar con motivo (asientos liberados) |
| **Cooperativa** | Gestionar tipos de asiento, buses (con generación de asientos), frecuencias de la ANT con paradas intermedias y la hoja de ruta diaria (manual o automática, con días de parada) |
| **Administrador** | Gestionar cooperativas y la configuración de la aplicación (nombre, logo, colores, redes sociales y soporte) |

Todos los usuarios reciben **notificaciones dentro de la aplicación** en cada paso de la compra.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite, React Router, Axios, ESLint |
| Backend | Node.js 22 + Express 5, JWT, bcryptjs, multer, pdfkit, qrcode |
| Base de datos | PostgreSQL 17 |
| Control de versiones | Git y GitHub con GitFlow |
| Control de cambios | Jira (espacio *Control de Cambios*, clave `CC`) |

## Requisitos

- [Git](https://git-scm.com/)
- [Node.js 22 LTS](https://nodejs.org/)
- [PostgreSQL 17](https://www.postgresql.org/download/) con pgAdmin 4


## Instalación con Docker (recomendada)

Con Docker no hace falta instalar PostgreSQL ni crear la base a mano, y **los datos se guardan entre reinicios**.

Requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.

```bash
cp .env.example .env          # opcional: cambia JWT_SECRET
docker compose up -d --build  # la primera vez tarda unos minutos
```

| Servicio | Dirección |
|---|---|
| Aplicación | http://localhost:5173 |
| API | http://localhost:3000/api |
| pgAdmin | http://localhost:5050 (servidor *Pasajes Ecuador*, contraseña `postgres`) |
| MailHog (correos de prueba) | http://localhost:8025 |
| PostgreSQL | `localhost:5433`, usuario `postgres`, contraseña `postgres` |

La primera vez que arranca, la base ejecuta todos los scripts de `backend/database` en orden. Después **ya no se vuelven a ejecutar**: lo que registres (usuarios, compras, buses…) queda guardado en el volumen `datos_postgres`.

| Necesito… | Comando |
|---|---|
| Apagar (conserva los datos) | `docker compose down` |
| Ver mensajes del backend | `docker compose logs -f backend` |
| Ejecutar un script nuevo de `backend/database` | `docker compose exec -T db psql -U postgres -d buses_db < backend/database/007_ejemplo.sql` |
| Instalar una dependencia nueva tras un `git pull` | `docker compose up -d --build` |
| Empezar de cero (borra todos los datos) | `docker compose down -v` y luego `docker compose up -d --build` |

Los viajes para nuevas fechas se generan desde la **Hoja semanal** de la cooperativa, así que no es necesario recrear la base.

> El código de `backend/src` y `frontend` se edita normalmente en tu PC: el backend y el frontend se recargan solos.

### Correos de prueba con MailHog (GC-12)

El sistema envía correos reales por SMTP: **confirmación de la cuenta**, **bienvenida**, **recuperación de contraseña** y **aviso de contraseña cambiada**. En desarrollo ninguno sale a internet: todos llegan a **MailHog**, una bandeja falsa que se abre en http://localhost:8025 (sirve cualquier correo, incluso `ana@prueba.com`).

1. Regístrate en http://localhost:5173/registro → aparece *«¡Ya casi! Confirma tu correo»*.
2. Abre http://localhost:8025 → correo *«Confirma tu correo para activar tu cuenta»* → **Confirmar mi correo**.
3. La cuenta queda activa, llega el correo de bienvenida y ya puedes iniciar sesión.
4. En **Iniciar sesión → ¿Olvidaste tu contraseña?** pide el enlace, ábrelo desde MailHog y crea la nueva contraseña.

| Regla | Valor |
|---|---|
| Enlace de confirmación | dura 24 horas, sirve una vez |
| Enlace de recuperación | dura 30 minutos, sirve una vez |
| Pedir otro correo | cada 60 segundos; el enlace anterior deja de servir |
| Usuarios que ya existían y personal creado por el admin o la cooperativa | quedan confirmados |

> Si MailHog está apagado el registro sigue funcionando: el backend escribe el enlace en `docker compose logs backend`.


## Instalación

### 1. Clonar el repositorio

Clonar **fuera de OneDrive** (OneDrive bloquea la carpeta `node_modules`):

```bash
mkdir -p /c/dev && cd /c/dev
git clone https://github.com/ViniD2005/ProyectoManejoBuses.git
cd ProyectoManejoBuses
git checkout develop
```

### 2. Crear la base de datos

En pgAdmin:

1. Clic derecho en **Databases** → **Create** → **Database…** → nombre `buses_db` → **Save**.
2. Clic derecho en `buses_db` → **Query Tool**.
3. Abrir y ejecutar (**F5**), en este orden:
   - `backend/database/001_esquema.sql`
   - `backend/database/002_datos_prueba.sql`

Los viajes de prueba se generan para la fecha en que se ejecuta el script y los 6 días siguientes. Si pasan los días, volver a crear la base.

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Editar `backend/.env` con la contraseña de PostgreSQL y una clave JWT propia:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Iniciar:

```bash
npm run dev
```

Debe mostrar `API escuchando en http://localhost:3000/api`.

### 4. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173

## Usuarios de prueba

Contraseña de todos: `Clave123*`

| Rol | Correo |
|---|---|
| Administrador | admin@pasajes.local |
| Cooperativa (Cooperativa Andina) | coop@andina.local |
| Oficinista (Cooperativa Andina) | oficina@andina.local |
| Cliente | cliente@pasajes.local |
| Cliente de tercera edad | adultomayor@pasajes.local |

## Recorrido de prueba

1. **Viajes** → Latacunga → Cuenca, fecha de hoy, 2 pasajeros → **Ver detalle** → **Seleccionar asientos**.
2. Elegir 2 asientos → **Continuar con la compra** → iniciar sesión como cliente.
3. Pasajero 2 con cédula `1712345675` y descuento **Tercera edad** → **Confirmar compra** (total $17.22).
4. **Mis boletos** → subir el comprobante (imagen JPG/PNG o PDF) con su referencia.
5. Iniciar sesión como oficinista → **Validar pagos** → **Aprobar pago**.
6. Como cliente → **Mis boletos** → **Descargar boleto (PDF con QR)**.

## Estructura

```
├── backend/
│   ├── database/        001_esquema.sql, 002_datos_prueba.sql
│   ├── uploads/         comprobantes subidos (no se versionan)
│   └── src/
│       ├── config/      conexión a PostgreSQL
│       ├── middlewares/ autenticación, roles y subida de archivos
│       ├── modules/     un módulo por funcionalidad (routes, controller, service)
│       ├── utils/       cédula, notificaciones
│       ├── app.js
│       └── server.js
└── frontend/
    └── src/
        ├── components/  componentes reutilizables
        ├── context/     sesión del usuario
        ├── hooks/       configuración de la app
        ├── layouts/     barra superior y pie de página
        ├── pages/       una carpeta por rol
        └── services/    cliente HTTP (api.js)
```

## Flujo de trabajo

### Control de cambios (Jira)

Todo cambio empieza como **petición de cambio** en Jira (espacio *Control de Cambios*, clave `CC`):

```
Abierta → En análisis → Aprobada / Rechazada → En implementación → En revisión → Cerrada
```

El **comité de control de cambios** (Vini y Damián) aprueba o rechaza cada petición con un comentario y asigna al responsable. El dashboard **Auditoría de cambios** muestra el estado de todas las peticiones.

### Control de versiones (GitFlow)

| Rama | Uso |
|---|---|
| `main` | Versiones estables con tag (`v0.2.0`, `v0.3.0`…) |
| `develop` | Integración del equipo (rama por defecto) |
| `feature/CC-n-descripcion` | Una petición aprobada |
| `bugfix/CC-n-descripcion` | Corrección de un error en develop |
| `release/vX.Y.Z` | Preparación de una versión |

Cada petición aprobada:

1. Issue en GitHub `[CC-n] título`.
2. Rama `feature/CC-n-...` desde `develop`.
3. Commits en Conventional Commits con la clave: `feat(boletos): CC-6 generar PDF con QR`.
4. Pull request hacia `develop` con `Jira: CC-n` y `Closes #n`, revisado por otro integrante.
5. El comité verifica y cierra la petición en Jira.

## Comandos útiles

| Comando | Dónde | Qué hace |
|---|---|---|
| `npm run dev` | backend / frontend | Inicia en modo desarrollo |
| `npm run build` | frontend | Compila para producción |
| `npm run lint` | frontend | Revisa el código con ESLint |
