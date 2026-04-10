import os
from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response

from app.api import (
    admin,
    athletes,
    attendance,
    auth,
    external,
    files,
    injuries,
    nutrition_plans,
    reports,
    training_plans,
    workouts,
)
from app.core.rbac import ensure_default_rbac
from app.database import Base, engine
from app.models import (
    Athlete,
    Attendance,
    Injury,
    NutritionPlan,
    Report,
    TrainingPlan,
    TrainingPlanAssignment,
    UserFile,
    Workout,
)

Base.metadata.create_all(bind=engine)
ensure_default_rbac()


def get_allowed_origins() -> list[str]:
    raw_value = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://localhost:4173")
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


app = FastAPI(
    title="Coach Management System",
    description="Web application for managing athletes, workouts, and coaching data.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(athletes.router)
app.include_router(training_plans.router)
app.include_router(workouts.router)
app.include_router(attendance.router)
app.include_router(injuries.router)
app.include_router(nutrition_plans.router)
app.include_router(reports.router)
app.include_router(files.router)
app.include_router(external.router)

INDEXABLE_ROUTES = (
    {"path": "/", "changefreq": "weekly", "priority": "1.0"},
)

DISALLOWED_PATHS = (
    "/login",
    "/app",
    "/docs",
    "/redoc",
    "/openapi.json",
)


@app.get("/")
def root():
    return {
        "message": "Coach Management System API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


def get_public_site_url() -> str:
    return os.getenv("PUBLIC_SITE_URL", "http://localhost:3000").rstrip("/")


def get_sitemap_url(request: Request) -> str:
    return str(request.url_for("sitemap_xml"))


def build_public_page_url(path: str) -> str:
    site_url = get_public_site_url()
    if path == "/":
        return f"{site_url}/"
    return f"{site_url}{path}"


@app.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
def robots_txt(request: Request):
    rules = [
        "User-agent: *",
        "Allow: /",
        *[f"Disallow: {path}" for path in DISALLOWED_PATHS],
        f"Sitemap: {get_sitemap_url(request)}",
    ]
    return "\n".join(rules)


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap_xml():
    lastmod = datetime.now(timezone.utc).date().isoformat()
    entries = "".join(
        (
            "<url>"
            f"<loc>{build_public_page_url(route['path'])}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<changefreq>{route['changefreq']}</changefreq>"
            f"<priority>{route['priority']}</priority>"
            "</url>"
        )
        for route in INDEXABLE_ROUTES
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{entries}"
        "</urlset>"
    )
    return Response(content=body, media_type="application/xml")


@app.get("/gone", include_in_schema=False, status_code=status.HTTP_410_GONE)
def gone_resource():
    return JSONResponse(
        status_code=status.HTTP_410_GONE,
        content={"detail": "This resource has been permanently removed."},
    )
