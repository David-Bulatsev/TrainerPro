# Container Architecture

## 1. Service map

The MVP is deployed as a multi-container stack with the following services:

- `proxy`: the public entry point based on Nginx. It terminates incoming HTTP traffic, serves the SPA through the frontend container, and forwards API, docs, `robots.txt`, and `sitemap.xml` requests to FastAPI.
- `frontend`: a static React/Vite build served by Nginx. It does not expose a public port directly inside the target topology and is reachable only from the internal `app` network.
- `backend`: FastAPI application with business logic, SEO technical endpoints, RBAC, file management, and external weather integration.
- `db`: PostgreSQL 15 for transactional application data.
- `minio`: S3-compatible object storage for uploaded files.
- `minio-init`: one-shot helper that creates the required bucket after MinIO becomes healthy.

## 2. Network scheme

Two Docker networks are used:

- `public`: only the `proxy` service is attached for ingress.
- `app`: private network for `proxy`, `frontend`, `backend`, `db`, `minio`, and `minio-init`.

Traffic flow:

1. Browser -> `proxy`
2. `proxy` -> `frontend` for SPA routes and static UI
3. `proxy` -> `backend` for `/api/*`, `/docs`, `/redoc`, `/openapi.json`, `/robots.txt`, `/sitemap.xml`
4. `backend` -> `db` for relational data
5. `backend` -> `minio` for object storage operations
6. `backend` -> external weather API over outbound internet

## 3. Startup order and resilience

The compose stack encodes readiness and startup dependencies:

- `db` must become healthy before `backend` starts.
- `minio` must become healthy before `minio-init`.
- `minio-init` must complete successfully before `backend` starts.
- `frontend` and `backend` must be healthy before `proxy` starts accepting traffic.

Healthchecks are configured for:

- `proxy`: `/healthz`
- `frontend`: `/`
- `backend`: `/health`
- `db`: `pg_isready`
- `minio`: `/minio/health/live`

If one of the long-running services crashes, Docker restarts it with `restart: unless-stopped`.

## 4. Security and configuration

Configuration is externalized into environment variables:

- root `.env.example` is the source template for Docker Compose interpolation
- `backend/.env.example` documents backend runtime settings
- `frontend/.env.example` documents frontend build-time variables

Secrets are excluded from the repository through `.gitignore`. Real `.env` files stay local or are injected via CI/CD secrets.

## 5. CI/CD shape

GitHub Actions is configured to:

- run backend tests and frontend tests on pull requests and pushes
- build both Docker images
- validate compose topology with `docker compose config`
- deploy automatically after successful checks on `main`, using SSH-based remote deployment and repository secrets

## 6. Known operational note

The current backend initializes tables through `Base.metadata.create_all(...)` on startup. This keeps the MVP deployable, but it is not a replacement for versioned migrations. For production hardening, introduce Alembic and fail the deployment before app startup when a migration step is unsuccessful.
