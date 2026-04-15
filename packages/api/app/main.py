from fastapi import FastAPI

from app.middleware.cors import setup_cors
from app.routers import (
    admin_keys,
    admin_usage,
    ai,
    audit,
    auth,
    billing,
    brands,
    dashboard,
    engines,
    keywords,
    project_answers,
    project_assistant,
    project_dashboard_api,
    project_explorer,
    projects,
    public,
    queries,
    recommendations,
    reports,
    roles,
    runs,
    schedules,
    scores,
    tenant_ai_keys,
    usage,
)

app = FastAPI(
    title="AEOGEO API",
    version="0.1.0",
)

setup_cors(app)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(reports.generate_router, prefix="/api/v1")
app.include_router(engines.router, prefix="/api/v1")
app.include_router(brands.router, prefix="/api/v1")
app.include_router(brands.autofill_router, prefix="/api/v1")
app.include_router(keywords.router, prefix="/api/v1")
app.include_router(queries.router, prefix="/api/v1")
app.include_router(runs.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(roles.router, prefix="/api/v1")
app.include_router(admin_keys.router, prefix="/api/v1")
app.include_router(tenant_ai_keys.router, prefix="/api/v1")
app.include_router(admin_usage.router, prefix="/api/v1")
app.include_router(usage.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(scores.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(project_dashboard_api.router, prefix="/api/v1")
app.include_router(project_assistant.router, prefix="/api/v1")
app.include_router(project_explorer.router, prefix="/api/v1")
app.include_router(project_answers.router, prefix="/api/v1")

# Public routes — NO auth dependency (share_token / embed_token where applicable)
app.include_router(public.router, prefix="/api/v1")
# Public quick GEO audit (rate-limited by IP hash)
app.include_router(audit.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health_check() -> dict:
    return {"status": "healthy", "version": "0.1.0"}


@app.get("/")
async def root() -> dict:
    return {"name": "AEOGEO API", "version": "0.1.0", "docs": "/docs"}
