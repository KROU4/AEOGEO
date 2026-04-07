from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.brand import Brand
from app.models.engine_run import EngineRun
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.models.visibility_score import VisibilityScore
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.utils.pagination import (
    PaginatedResponse,
    apply_cursor_pagination,
    paginate_results,
)


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_projects(
        self,
        tenant_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
    ) -> PaginatedResponse[ProjectResponse]:
        member_count_sq = (
            select(func.count())
            .where(ProjectMember.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )

        avg_score_sq = (
            select(func.round(func.avg(VisibilityScore.total_score), 1))
            .join(EngineRun, VisibilityScore.run_id == EngineRun.id)
            .where(EngineRun.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )

        query = select(
            Project,
            member_count_sq.label("member_count"),
            avg_score_sq.label("avg_score"),
        ).where(Project.tenant_id == tenant_id)
        query = apply_cursor_pagination(query, Project, cursor, limit)

        result = await self.db.execute(query)
        rows = result.all()

        items_raw, next_cursor, has_more = paginate_results(
            rows, limit, created_at_attr="created_at", id_attr="id"
        )

        items = []
        for row in items_raw:
            project = row[0] if hasattr(row, "__getitem__") else row.Project
            mc = row[1] if hasattr(row, "__getitem__") else row.member_count
            avg = row[2] if hasattr(row, "__getitem__") else row.avg_score
            items.append(
                ProjectResponse(
                    id=project.id,
                    name=project.name,
                    description=project.description or "",
                    client_name=project.client_name or "",
                    domain=project.domain,
                    content_locale=project.content_locale,
                    member_count=mc or 0,
                    visibility_score=float(avg) if avg is not None else None,
                    created_at=project.created_at,
                    updated_at=project.updated_at,
                )
            )

        # Recompute next_cursor from the actual Project objects
        if has_more and items:
            from app.utils.pagination import encode_cursor

            last_row = items_raw[-1]
            last_project = (
                last_row[0] if hasattr(last_row, "__getitem__") else last_row.Project
            )
            next_cursor = encode_cursor(last_project.created_at, last_project.id)

        return PaginatedResponse(
            items=items, next_cursor=next_cursor, has_more=has_more
        )

    async def create_project(
        self,
        tenant_id: UUID,
        user_id: UUID,
        data: ProjectCreate,
    ) -> ProjectResponse:
        project = Project(
            name=data.name,
            description=data.description,
            client_name=data.client_name,
            domain=data.domain,
            content_locale=data.content_locale or "en",
            tenant_id=tenant_id,
        )
        self.db.add(project)
        await self.db.flush()

        # Auto-add creator as owner
        membership = ProjectMember(project_id=project.id, user_id=user_id, role="owner")
        self.db.add(membership)

        # Auto-create brand so knowledge/crawl endpoints work immediately
        brand = Brand(
            name=data.name,
            website=data.domain,
            project_id=project.id,
        )
        self.db.add(brand)
        await self.db.commit()
        await self.db.refresh(project)

        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description or "",
            client_name=project.client_name or "",
            domain=project.domain,
            content_locale=project.content_locale,
            member_count=1,
            visibility_score=None,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def get_project(self, project_id: UUID, tenant_id: UUID) -> Project | None:
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id, Project.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def get_project_response(
        self, project_id: UUID, tenant_id: UUID
    ) -> ProjectResponse | None:
        member_count_sq = (
            select(func.count())
            .where(ProjectMember.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )
        avg_score_sq = (
            select(func.round(func.avg(VisibilityScore.total_score), 1))
            .join(EngineRun, VisibilityScore.run_id == EngineRun.id)
            .where(EngineRun.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )
        result = await self.db.execute(
            select(
                Project,
                member_count_sq.label("member_count"),
                avg_score_sq.label("avg_score"),
            ).where(Project.id == project_id, Project.tenant_id == tenant_id)
        )
        row = result.one_or_none()
        if row is None:
            return None

        project, mc, avg = row
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description or "",
            client_name=project.client_name or "",
            domain=project.domain,
            content_locale=project.content_locale,
            member_count=mc or 0,
            visibility_score=float(avg) if avg is not None else None,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def update_project(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: ProjectUpdate,
    ) -> ProjectResponse | None:
        project = await self.get_project(project_id, tenant_id)
        if project is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(project, key, value)

        await self.db.commit()
        await self.db.refresh(project)

        return await self.get_project_response(project_id, tenant_id)

    async def delete_project(self, project_id: UUID, tenant_id: UUID) -> bool:
        project = await self.get_project(project_id, tenant_id)
        if project is None:
            return False

        from app.models.ai_usage_event import AIUsageEvent
        from app.models.answer import Answer
        from app.models.citation import Citation
        from app.models.content import Content
        from app.models.engine import ProjectEngine
        from app.models.engine_run import EngineRun
        from app.models.keyword import Keyword
        from app.models.mention import Mention
        from app.models.recommendation import Recommendation
        from app.models.report import Report
        from app.models.scheduled_run import ScheduledRun
        from app.models.visibility_score import VisibilityScore
        from app.models.widget import Widget

        # Subqueries for engine runs and answers belonging to this project
        run_ids = select(EngineRun.id).where(EngineRun.project_id == project_id)
        answer_ids = select(Answer.id).where(Answer.run_id.in_(run_ids))

        # Delete deepest children first
        await self.db.execute(
            delete(VisibilityScore).where(VisibilityScore.answer_id.in_(answer_ids))
        )
        await self.db.execute(delete(Mention).where(Mention.answer_id.in_(answer_ids)))
        await self.db.execute(
            delete(Citation).where(Citation.answer_id.in_(answer_ids))
        )
        await self.db.execute(delete(Answer).where(Answer.run_id.in_(run_ids)))
        await self.db.execute(
            delete(EngineRun).where(EngineRun.project_id == project_id)
        )
        await self.db.execute(
            delete(ScheduledRun).where(ScheduledRun.project_id == project_id)
        )

        # Nullify AI usage events (nullable FK)
        await self.db.execute(
            update(AIUsageEvent)
            .where(AIUsageEvent.project_id == project_id)
            .values(project_id=None)
        )

        # Delete keywords and recommendations
        await self.db.execute(delete(Keyword).where(Keyword.project_id == project_id))
        await self.db.execute(
            delete(Recommendation).where(Recommendation.project_id == project_id)
        )

        # Delete direct project children
        for model in (ProjectMember, Content, Report, Widget, ProjectEngine):
            await self.db.execute(delete(model).where(model.project_id == project_id))

        # Remaining tables (QuerySet, Brand) have ondelete=CASCADE in DB.
        # Use bulk DELETE to avoid ORM trying to SET NULL on non-nullable FKs.
        await self.db.execute(delete(Project).where(Project.id == project_id))
        await self.db.commit()
        return True

    async def list_members(
        self, project_id: UUID, tenant_id: UUID
    ) -> list[ProjectMemberResponse] | None:
        # Verify project belongs to tenant
        project = await self.get_project(project_id, tenant_id)
        if project is None:
            return None

        result = await self.db.execute(
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .options(selectinload(ProjectMember.user))
        )
        members = result.scalars().all()

        return [
            ProjectMemberResponse(
                user_id=m.user_id,
                name=m.user.name if m.user else "",
                email=m.user.email if m.user else "",
                role=m.role,
                joined_at=None,
            )
            for m in members
        ]

    async def add_member(
        self,
        project_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        role: str,
    ) -> ProjectMemberResponse | None:
        # Verify project belongs to tenant
        project = await self.get_project(project_id, tenant_id)
        if project is None:
            return None

        # Verify user exists and belongs to the same tenant
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            return None

        membership = ProjectMember(project_id=project_id, user_id=user_id, role=role)
        try:
            self.db.add(membership)
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise ValueError("User is already a member of this project")

        return ProjectMemberResponse(
            user_id=user.id,
            name=user.name,
            email=user.email,
            role=role,
            joined_at=None,
        )
