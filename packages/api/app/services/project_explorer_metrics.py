"""SOV, weekly trends, citations explorer, and competitor comparison."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.brand import Brand
from app.models.citation import Citation
from app.models.competitor import Competitor
from app.models.engine import Engine
from app.models.engine_run import EngineRun
from app.models.mention import Mention
from app.models.project import Project
from app.models.visibility_score import VisibilityScore
from app.schemas.project_explorer import (
    CitationDomainDetailResponse,
    CitationQueryDetail,
    CitationRow,
    CitationsListResponse,
    CompetitorComparisonBrand,
    CompetitorPlatformSlice,
    CompetitorsComparisonResponse,
    ProjectSovResponse,
    ProjectTrendsResponse,
    SovBrandEntry,
)
from app.utils.datetime_compat import naive_utc


def _domain_from_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return "unknown"
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    try:
        p = urlparse(u)
        host = (p.netloc or "").lower()
        if host.startswith("www."):
            host = host[4:]
        return host.split(":")[0] or "unknown"
    except Exception:
        return "unknown"


def _period_cutoff(period: str) -> datetime:
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
    return datetime.utcnow() - timedelta(days=days)


async def _run_ids_since(
    db: AsyncSession,
    project_id: UUID,
    since: datetime,
) -> list[UUID]:
    since = naive_utc(since)
    r = await db.execute(
        select(EngineRun.id).where(
            EngineRun.project_id == project_id,
            EngineRun.created_at >= since,
        ),
    )
    return [row[0] for row in r.all()]


async def _all_project_run_ids(
    db: AsyncSession,
    project_id: UUID,
) -> list[UUID]:
    r = await db.execute(
        select(EngineRun.id).where(EngineRun.project_id == project_id),
    )
    return [row[0] for row in r.all()]


def _project_domain_host(project: Project) -> str:
    raw = (project.domain or "").casefold()
    raw = raw.replace("https://", "").replace("http://", "")
    return raw.split("/")[0]


def _is_client_brand_name(
    name: str,
    brand: Brand | None,
    project: Project,
) -> bool:
    n = name.casefold().strip()
    if not n:
        return False
    if brand and brand.name.casefold() == n:
        return True
    if project.domain:
        d = _project_domain_host(project)
        if d and d in n:
            return True
    if brand and brand.website:
        h = _domain_from_url(brand.website)
        if h and h in n:
            return True
    return False


def _is_client_domain(
    domain: str,
    brand: Brand | None,
    project: Project,
) -> bool:
    d = domain.casefold()
    if brand and brand.website:
        h = _domain_from_url(brand.website)
        if h and (d == h or d.endswith("." + h)):
            return True
    if project.domain:
        pd = _project_domain_host(project)
        if pd and (d == pd or d.endswith("." + pd)):
            return True
    return False


async def build_sov(
    db: AsyncSession,
    project_id: UUID,
    brand: Brand | None,
    project: Project,
) -> ProjectSovResponse:
    run_ids = await _all_project_run_ids(db, project_id)
    if not run_ids:
        return ProjectSovResponse(
            brands=[],
            total_tracked_brands=0,
            updated_at=datetime.utcnow(),
        )

    result = await db.execute(
        select(Mention.entity_name)
        .join(Answer, Mention.answer_id == Answer.id)
        .where(
            Answer.run_id.in_(run_ids),
            Mention.entity_type == "brand",
        ),
    )
    names = [row[0] for row in result.all()]
    if not names:
        return ProjectSovResponse(
            brands=[],
            total_tracked_brands=0,
            updated_at=datetime.utcnow(),
        )

    counts: dict[str, int] = defaultdict(int)
    for n in names:
        counts[n.strip()] += 1
    total = sum(counts.values())
    brands: list[SovBrandEntry] = []
    for name, cnt in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        pct = round(100.0 * cnt / total, 1) if total else 0.0
        brands.append(
            SovBrandEntry(
                domain=name,
                sov_pct=pct,
                is_client=_is_client_brand_name(name, brand, project),
            ),
        )
    r2 = await db.execute(
        select(EngineRun.updated_at, EngineRun.completed_at, EngineRun.created_at)
        .where(EngineRun.project_id == project_id)
        .order_by(EngineRun.created_at.desc())
        .limit(1),
    )
    row = r2.first()
    updated = datetime.utcnow()
    if row:
        u = row[0] or row[1] or row[2]
        if u:
            updated = u if u.tzinfo else u.replace(tzinfo=UTC)

    return ProjectSovResponse(
        brands=brands,
        total_tracked_brands=len(counts),
        updated_at=updated,
    )


def _week_ranges(num_weeks: int) -> list[tuple[datetime, datetime, str]]:
    """UTC week windows: (start, end, label) for the last num_weeks weeks.

    Boundaries are naive UTC midnights to match TIMESTAMP WITHOUT TIME ZONE columns.
    """
    today = datetime.utcnow().date()
    monday = today - timedelta(days=today.weekday())
    ranges: list[tuple[datetime, datetime, str]] = []
    for i in range(num_weeks - 1, -1, -1):
        start_d = monday - timedelta(weeks=i)
        end_d = start_d + timedelta(days=7)
        start_dt = datetime(start_d.year, start_d.month, start_d.day)
        end_dt = datetime(end_d.year, end_d.month, end_d.day)
        label = start_d.strftime("%b %d")
        ranges.append((start_dt, end_dt, label))
    return ranges


async def _avg_visibility_for_runs(
    db: AsyncSession,
    run_ids: list[UUID],
) -> float:
    if not run_ids:
        return 0.0
    r = await db.execute(
        select(func.avg(VisibilityScore.total_score)).where(
            VisibilityScore.run_id.in_(run_ids),
        ),
    )
    v = r.scalar()
    return round(min(100.0, float(v or 0) * 10), 1)


async def _sov_pct_for_runs(
    db: AsyncSession,
    project_id: UUID,
    run_ids: list[UUID],
    brand: Brand | None,
    project: Project,
) -> float:
    if not run_ids or not brand:
        return 0.0
    result = await db.execute(
        select(Mention.entity_name)
        .join(Answer, Mention.answer_id == Answer.id)
        .where(
            Answer.run_id.in_(run_ids),
            Mention.entity_type == "brand",
        ),
    )
    names = [row[0] for row in result.all()]
    if not names:
        return 0.0
    client = sum(
        1 for n in names if _is_client_brand_name(n, brand, project)
    )
    return round(100.0 * client / len(names), 1)


async def build_trends(
    db: AsyncSession,
    project_id: UUID,
    weeks: int,
    brand: Brand | None,
    project: Project,
) -> ProjectTrendsResponse:
    w = max(4, min(52, weeks))
    ranges = _week_ranges(w)
    labels = [lbl for _, _, lbl in ranges]
    sov_s: list[float] = []
    vis_s: list[float] = []

    for start_dt, end_dt, _ in ranges:
        r = await db.execute(
            select(EngineRun.id).where(
                EngineRun.project_id == project_id,
                EngineRun.status == "completed",
                EngineRun.created_at >= start_dt,
                EngineRun.created_at < end_dt,
            ),
        )
        run_ids = [row[0] for row in r.all()]
        vis_s.append(await _avg_visibility_for_runs(db, run_ids))
        sov_s.append(
            await _sov_pct_for_runs(db, project_id, run_ids, brand, project),
        )

    updated = datetime.utcnow()
    return ProjectTrendsResponse(
        labels=labels,
        series={"sov": sov_s, "visibility": vis_s},
        updated_at=updated,
    )


_ENGINE_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _platform_key(engine: Engine) -> str:
    s = engine.slug.strip().lower()
    s = _ENGINE_SLUG_RE.sub("_", s).strip("_")
    return s or "unknown"


async def build_citations_list(
    db: AsyncSession,
    project_id: UUID,
    brand: Brand | None,
    project: Project,
    *,
    engine_filter: str,
    domain_filter: str | None,
    page: int,
    limit: int,
) -> CitationsListResponse:
    run_ids = await _all_project_run_ids(db, project_id)
    if not run_ids:
        return CitationsListResponse(
            total=0,
            citations=[],
            updated_at=datetime.utcnow(),
        )

    q = (
        select(Citation, Answer, Engine)
        .join(Answer, Citation.answer_id == Answer.id)
        .join(Engine, Answer.engine_id == Engine.id)
        .where(Answer.run_id.in_(run_ids))
    )
    if engine_filter != "all":
        q = q.where(Engine.slug == engine_filter)
    result = await db.execute(q)
    rows_raw = result.all()

    by_domain: dict[str, list[tuple[Citation, Answer, Engine]]] = defaultdict(list)
    for cit, ans, eng in rows_raw:
        dom = _domain_from_url(cit.source_url)
        by_domain[dom].append((cit, ans, eng))

    if domain_filter:
        df = domain_filter.casefold()
        by_domain = {k: v for k, v in by_domain.items() if df in k.casefold()}

    # Trend: last 7 completed runs citation counts for this project
    runs_ord = await db.execute(
        select(EngineRun.id)
        .where(
            EngineRun.project_id == project_id,
            EngineRun.status == "completed",
        )
        .order_by(EngineRun.created_at.desc())
        .limit(7),
    )
    run_order = [row[0] for row in runs_ord.all()]
    run_order.reverse()

    aggregated: list[CitationRow] = []
    for dom, items in by_domain.items():
        citation_ids = [c.id for c, _, _ in items]
        times = len(items)
        engines = {e.name for _, _, e in items}
        engine_label = sorted(engines)[0] if engines else ""
        first_ts = min(
            (c.created_at for c, _, _ in items if c.created_at),
            default=None,
        )
        first_seen = first_ts.date() if first_ts else None
        preview = next((a.query_text[:120] for _, a, _ in items if a.query_text), None)
        trend_counts: list[int] = []
        for rid in run_order:
            n = sum(1 for c, a, _ in items if a.run_id == rid)
            trend_counts.append(n)
        while len(trend_counts) < 7:
            trend_counts.insert(0, 0)
        trend_counts = trend_counts[-7:]

        aggregated.append(
            CitationRow(
                domain=dom,
                engine=engine_label,
                times_cited=times,
                is_client_domain=_is_client_domain(dom, brand, project),
                first_seen=first_seen,
                query_preview=preview,
                trend=trend_counts,
                citation_ids=citation_ids[:50],
            ),
        )

    aggregated.sort(key=lambda x: (-x.times_cited, x.domain))
    total = len(aggregated)
    start = (page - 1) * limit
    page_items = aggregated[start : start + limit]

    return CitationsListResponse(
        total=total,
        citations=page_items,
        updated_at=datetime.utcnow(),
    )


async def build_citation_domain_detail(
    db: AsyncSession,
    project_id: UUID,
    domain: str,
) -> CitationDomainDetailResponse | None:
    run_ids = await _all_project_run_ids(db, project_id)
    if not run_ids:
        return CitationDomainDetailResponse(domain=domain, all_queries=[])

    result = await db.execute(
        select(Citation, Answer, Engine)
        .join(Answer, Citation.answer_id == Answer.id)
        .join(Engine, Answer.engine_id == Engine.id)
        .where(Answer.run_id.in_(run_ids)),
    )
    out: list[CitationQueryDetail] = []
    dom_lower = domain.casefold()
    for cit, ans, eng in result.all():
        if _domain_from_url(cit.source_url).casefold() != dom_lower:
            continue
        excerpt = (ans.raw_response or "")[:280]
        cited = cit.created_at.date() if cit.created_at else None
        out.append(
            CitationQueryDetail(
                query=ans.query_text or "",
                engine=eng.name,
                ai_response_excerpt=excerpt,
                cited_at=cited,
            ),
        )
    if not out:
        return None
    return CitationDomainDetailResponse(domain=domain, all_queries=out[:200])


async def build_competitors_comparison(
    db: AsyncSession,
    project_id: UUID,
    project: Project,
    brand: Brand | None,
    period: str,
) -> CompetitorsComparisonResponse:
    since = _period_cutoff(period)
    run_ids = await _run_ids_since(db, project_id, since)
    if not run_ids:
        return CompetitorsComparisonResponse(
            brands=[],
            updated_at=datetime.utcnow(),
            period=period,
        )

    # Build brand list: client + competitors
    labels: list[tuple[str, bool]] = []
    if brand:
        lab = _domain_from_url(brand.website or "") or (project.domain or brand.name)
        labels.append((lab, True))
        comp_result = await db.execute(
            select(Competitor).where(Competitor.brand_id == brand.id),
        )
        for comp in comp_result.scalars().all():
            lab = _domain_from_url(comp.website or "") or comp.name
            labels.append((lab, False))

    if not labels:
        fallback = project.domain or (brand.name if brand else "client")
        labels.append((fallback, True))

    eng_result = await db.execute(
        select(Engine).where(Engine.is_active.is_(True)),
    )
    eng_list = list(eng_result.scalars().all())

    comparison: list[CompetitorComparisonBrand] = []
    for domain_label, is_client in labels:
        brand_mentions = await db.execute(
            select(func.count())
            .select_from(Mention)
            .join(Answer, Mention.answer_id == Answer.id)
            .where(
                Answer.run_id.in_(run_ids),
                Mention.entity_type == "brand",
                Mention.entity_name.ilike(f"%{domain_label}%"),
            ),
        )
        total_mentions = (
            await db.execute(
                select(func.count())
                .select_from(Mention)
                .join(Answer, Mention.answer_id == Answer.id)
                .where(
                    Answer.run_id.in_(run_ids),
                    Mention.entity_type == "brand",
                ),
            )
        ).scalar() or 0
        om = brand_mentions.scalar() or 0
        overall_sov = round(100.0 * om / total_mentions, 1) if total_mentions else 0.0

        by_platform: dict[str, CompetitorPlatformSlice] = {}
        for eng in eng_list:
            pk = _platform_key(eng)
            m_count = (
                await db.execute(
                    select(func.count())
                    .select_from(Mention)
                    .join(Answer, Mention.answer_id == Answer.id)
                    .where(
                        Answer.run_id.in_(run_ids),
                        Answer.engine_id == eng.id,
                        Mention.entity_type == "brand",
                        Mention.entity_name.ilike(f"%{domain_label}%"),
                    ),
                )
            ).scalar() or 0
            eng_total = (
                await db.execute(
                    select(func.count())
                    .select_from(Mention)
                    .join(Answer, Mention.answer_id == Answer.id)
                    .where(
                        Answer.run_id.in_(run_ids),
                        Answer.engine_id == eng.id,
                        Mention.entity_type == "brand",
                    ),
                )
            ).scalar() or 0
            sov = round(100.0 * m_count / eng_total, 1) if eng_total else 0.0
            pos = (
                await db.execute(
                    select(func.avg(Mention.position_in_answer))
                    .join(Answer, Mention.answer_id == Answer.id)
                    .where(
                        Answer.run_id.in_(run_ids),
                        Answer.engine_id == eng.id,
                        Mention.entity_type == "brand",
                        Mention.entity_name.ilike(f"%{domain_label}%"),
                        Mention.position_in_answer.isnot(None),
                    ),
                )
            ).scalar()
            rank = float(pos) if pos is not None else 0.0
            by_platform[pk] = CompetitorPlatformSlice(sov=sov, rank=round(rank, 2))

        trend_vals: list[float] = []
        for start_dt, end_dt, _ in _week_ranges(5):
            wr = await db.execute(
                select(EngineRun.id).where(
                    EngineRun.project_id == project_id,
                    EngineRun.created_at >= start_dt,
                    EngineRun.created_at < end_dt,
                    EngineRun.id.in_(run_ids),
                ),
            )
            w_run_ids = [row[0] for row in wr.all()]
            if not w_run_ids:
                trend_vals.append(0.0)
                continue
            t_total = (
                await db.execute(
                    select(func.count())
                    .select_from(Mention)
                    .join(Answer, Mention.answer_id == Answer.id)
                    .where(
                        Answer.run_id.in_(w_run_ids),
                        Mention.entity_type == "brand",
                    ),
                )
            ).scalar() or 0
            t_brand = (
                await db.execute(
                    select(func.count())
                    .select_from(Mention)
                    .join(Answer, Mention.answer_id == Answer.id)
                    .where(
                        Answer.run_id.in_(w_run_ids),
                        Mention.entity_type == "brand",
                        Mention.entity_name.ilike(f"%{domain_label}%"),
                    ),
                )
            ).scalar() or 0
            trend_vals.append(
                round(100.0 * t_brand / t_total, 1) if t_total else 0.0,
            )

        comparison.append(
            CompetitorComparisonBrand(
                domain=domain_label,
                is_client=is_client,
                overall_sov=overall_sov,
                by_platform=by_platform,
                trend=trend_vals,
            ),
        )

    return CompetitorsComparisonResponse(
        brands=comparison,
        updated_at=datetime.utcnow(),
        period=period,
    )
