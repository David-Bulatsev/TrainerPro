# Coach Management System

## Local container run

1. Create local environment files from templates:
   - `.env` from `.env.example`
   - `backend/.env` from `backend/.env.example` when you need standalone backend runs
   - `frontend/.env` from `frontend/.env.example` when you need standalone frontend builds
2. Fill in real secrets for PostgreSQL, MinIO, and `WEATHER_API_KEY`.
3. Start the full stack:

```bash
docker compose up --build
```

Public entry points after startup:

- App and SPA routes: `http://localhost`
- API via reverse proxy: `http://localhost/api`
- Swagger UI: `http://localhost/docs`
- Backend health: `http://localhost/api/health`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

## Container topology

The stack includes:

- `proxy` on Nginx as the single public entry point
- `frontend` with a production Vite build served by Nginx
- `backend` on FastAPI/Uvicorn
- `db` on PostgreSQL 15
- `minio` for object storage
- `minio-init` for bucket bootstrap

See `CONTAINER_ARCHITECTURE.md` for the full service and network model.

## Configuration

Main variables are defined through environment files and Compose interpolation:

- `PUBLIC_SITE_URL`, `PROXY_PORT`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`
- `STORAGE_S3_PUBLIC_ENDPOINT_URL`
- `WEATHER_API_KEY` and related weather integration limits
- `VITE_API_BASE_URL`

Secrets are intentionally ignored by `.gitignore`, so committed templates stay safe while real credentials remain local or in CI secrets.

## Health and dependency order

Compose waits for service readiness:

- `db` must pass `pg_isready`
- `minio` must pass its live health endpoint
- `minio-init` must create the bucket successfully
- `backend` must answer `/health`
- `frontend` must answer `/`
- `proxy` must answer `/healthz`

This keeps startup reproducible and reduces transient failures during local deployment.

## CI/CD

GitHub Actions in `.github/workflows/ci-cd.yml` performs:

- backend dependency install and `pytest`
- frontend `npm ci`, unit tests, coverage, and production build
- Docker Compose validation
- Docker image builds for backend and frontend
- automatic deploy on `main` via SSH after successful checks

Required deployment secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

## Operational note

The backend still uses `Base.metadata.create_all(...)` for schema bootstrap. This preserves MVP deployability, but a production-grade rollout should replace it with Alembic migrations and a dedicated migration step in the deployment pipeline.
