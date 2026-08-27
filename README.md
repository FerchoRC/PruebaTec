# Módulo de Gestión de Promociones

Aplicación web para registrar y administrar promociones de un punto de venta,
controlando su **vigencia** y su **ciclo de vida** (`Programada` → `Activa` →
`Finalizada`).

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite (servido por Nginx en producción) |
| Backend | Node.js 22 + Express |
| Base de datos | PostgreSQL 16 (3 tablas: `categories`, `products`, `promotions`) |
| Orquestación | Docker Compose |
| CI/CD | GitHub Actions (`lint` → `test` → `build` → `smoke test`) |

El porqué de cada elección está en [DECISIONS.md](DECISIONS.md).

---

## 1. Requisitos previos

- [Docker](https://docs.docker.com/get-docker/) con Docker Compose v2
- Opcional, solo para desarrollo sin contenedores: Node.js ≥ 20

---

## 2. Levantar el proyecto

```bash
git clone <url-del-repositorio>
cd PruebaTec

# 1. Cree su archivo de entorno a partir de la plantilla
cp .env.example .env

# 2. Rellene los valores obligatorios en .env
#    POSTGRES_USER, POSTGRES_PASSWORD y POSTGRES_DB no tienen valor por defecto.

# 3. (Opcional) Compruebe que no falta nada antes de arrancar
./scripts/check-env.sh .env

# 4. Levante la pila completa
docker compose up --build
```

En Windows sin Bash, los pasos 3 y 4 se reducen a `docker compose up --build`:
si falta una variable obligatoria, Compose aborta igualmente con un mensaje
que dice cuál.

Una vez arriba:

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:8080 |
| API | http://localhost:3001/api |
| Health check | http://localhost:3001/health |

La base de datos se crea y se puebla con un catálogo de ejemplo (4 categorías y
5 productos) la primera vez que arranca el contenedor de Postgres.

Para detenerlo:

```bash
docker compose down        # conserva los datos
docker compose down -v     # borra también el volumen de la base de datos
```

---

## 3. Variables de entorno

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `POSTGRES_USER` | Sí | — | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | Sí | — | Contraseña de PostgreSQL |
| `POSTGRES_DB` | Sí | — | Nombre de la base de datos |
| `POSTGRES_PORT` | No | `5432` | Puerto publicado en el host |
| `BACKEND_PORT` | No | `3001` | Puerto publicado en el host |
| `FRONTEND_PORT` | No | `8080` | Puerto publicado en el host |
| `NODE_ENV` | No | `production` | Entorno de ejecución del backend |
| `CORS_ORIGIN` | No | `*` | Origen permitido por CORS |

---

## 4. Desarrollo sin contenedores

Útil para tener recarga en caliente. Requiere un PostgreSQL accesible (basta
con levantar solo ese servicio: `docker compose up db`).

```bash
# Backend  ->  http://localhost:3001
cd backend
npm install
DATABASE_URL=postgres://promociones:<password>@localhost:5432/promociones npm run dev

# Frontend ->  http://localhost:5173  (proxy de /api y /health hacia el backend)
cd frontend
npm install
npm run dev
```

---

## 5. API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | `200` si el proceso y la conexión a Postgres están vivos; `503` si no |
| `GET` | `/api/catalog` | Productos y categorías para los selectores |
| `GET` | `/api/promotions` | Listado de promociones |
| `GET` | `/api/promotions/summary` | Contadores por estado y vigentes hoy |
| `GET` | `/api/promotions/:id` | Detalle de una promoción |
| `POST` | `/api/promotions` | Crea una promoción (nace `Programada`) |
| `PUT` | `/api/promotions/:id` | Edita una promoción no finalizada |
| `PATCH` | `/api/promotions/:id/status` | Avanza el estado |
| `DELETE` | `/api/promotions/:id` | Elimina, solo si está `Programada` |

---

## 6. Integración continua

El flujo [`.github/workflows/ci.yml`](.github/workflows/ci.yml) encadena cuatro
etapas dependientes; si una falla, las siguientes no se ejecutan:

1. **`lint`** — ESLint en backend y frontend (`--max-warnings=0`).
2. **`test`** — Vitest en backend y frontend.
3. **`build`** — construye ambas imágenes Docker y las exporta como artefactos.
4. **`smoke-test`** — carga esas mismas imágenes, levanta la pila con
   `docker compose up`, espera a que los contenedores estén *healthy* y
   comprueba `/health`. Si no responde `200`, el pipeline falla.

### Secrets requeridos

Antes del primer `push`, cree en **Settings → Secrets and variables → Actions**:

| Secret | Obligatorio |
|---|---|
| `POSTGRES_PASSWORD` | **Sí** — no tiene valor por defecto; sin él el pipeline falla de forma explícita |
| `POSTGRES_USER` | No (por defecto `promociones`) |
| `POSTGRES_DB` | No (por defecto `promociones`) |

`POSTGRES_PASSWORD` se deja deliberadamente sin fallback: es lo que demuestra
que el pipeline se detiene cuando falta una credencial, en vez de arrancar con
una contraseña por defecto escondida en el repositorio.
