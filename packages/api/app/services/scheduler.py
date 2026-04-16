"""SchedulerService — CRUD for scheduled runs + Temporal cron schedule management."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.scheduled_run import ScheduledRun
from app.schemas.scheduled_run import (
    ScheduledRunCreate,
    ScheduledRunResponse,
    ScheduledRunUpdate,
)

logger = logging.getLogger(__name__)

TASK_QUEUE = "aeogeo-pipeline"


class SchedulerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create_schedule(
        self,
        project_id: UUID,
        data: ScheduledRunCreate,
    ) -> ScheduledRunResponse:
        schedule = ScheduledRun(
            project_id=project_id,
            query_set_id=data.query_set_id,
            engine_ids=[str(eid) for eid in data.engine_ids],
            cron_expression=data.cron_expression,
            sample_count=data.sample_count,
            is_active=True,
        )
        self.db.add(schedule)
        await self.db.flush()
        await self.db.refresh(schedule)

        # Best-effort: start the Temporal cron schedule
        await self._start_temporal_schedule(schedule)

        await self.db.commit()
        await self.db.refresh(schedule)
        return ScheduledRunResponse.model_validate(schedule)

    async def list_schedules(
        self,
        project_id: UUID,
    ) -> list[ScheduledRunResponse]:
        result = await self.db.execute(
            select(ScheduledRun)
            .where(ScheduledRun.project_id == project_id)
            .order_by(ScheduledRun.created_at.desc())
        )
        rows = result.scalars().all()
        return [ScheduledRunResponse.model_validate(r) for r in rows]

    async def get_schedule(
        self,
        schedule_id: UUID,
        project_id: UUID,
    ) -> ScheduledRun | None:
        result = await self.db.execute(
            select(ScheduledRun).where(
                ScheduledRun.id == schedule_id,
                ScheduledRun.project_id == project_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_schedule(
        self,
        schedule_id: UUID,
        project_id: UUID,
        data: ScheduledRunUpdate,
    ) -> ScheduledRunResponse | None:
        schedule = await self.get_schedule(schedule_id, project_id)
        if schedule is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        cron_changed = False

        for key, value in updates.items():
            if key == "engine_ids" and value is not None:
                value = [str(eid) for eid in value]
            if key == "cron_expression" and value != schedule.cron_expression:
                cron_changed = True
            setattr(schedule, key, value)

        await self.db.flush()
        await self.db.refresh(schedule)

        # If the schedule was paused/resumed or cron changed, update Temporal
        if "is_active" in updates or cron_changed:
            if schedule.is_active:
                # Delete old schedule and recreate with (possibly new) cron
                await self._delete_temporal_schedule(schedule_id)
                await self._start_temporal_schedule(schedule)
            else:
                # Paused: delete the Temporal schedule
                await self._delete_temporal_schedule(schedule_id)

        await self.db.commit()
        await self.db.refresh(schedule)
        return ScheduledRunResponse.model_validate(schedule)

    async def delete_schedule(
        self,
        schedule_id: UUID,
        project_id: UUID,
    ) -> bool:
        schedule = await self.get_schedule(schedule_id, project_id)
        if schedule is None:
            return False

        # Remove Temporal schedule first (best-effort)
        await self._delete_temporal_schedule(schedule_id)

        await self.db.delete(schedule)
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Temporal helpers
    # ------------------------------------------------------------------

    async def _start_temporal_schedule(self, schedule: ScheduledRun) -> None:
        """Create a Temporal schedule with cron expression. Best-effort."""
        try:
            from temporalio.client import Client as TemporalClient, Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleIntervalSpec

            client = await TemporalClient.connect(get_settings().temporal_host)

            schedule_id = f"scheduled-run-{schedule.id}"
            await client.create_schedule(
                schedule_id,
                Schedule(
                    action=ScheduleActionStartWorkflow(
                        "ScheduledRunWorkflow",
                        args=[
                            {
                                "schedule_id": str(schedule.id),
                                "project_id": str(schedule.project_id),
                                "query_set_id": str(schedule.query_set_id),
                                "engine_ids": schedule.engine_ids,
                                "sample_count": schedule.sample_count,
                            }
                        ],
                        id=f"scheduled-pipeline-{schedule.id}",
                        task_queue=TASK_QUEUE,
                    ),
                    spec=ScheduleSpec(
                        cron_expressions=[schedule.cron_expression],
                    ),
                ),
            )
            logger.info(
                "Created Temporal schedule %s with cron=%s",
                schedule_id,
                schedule.cron_expression,
            )
        except Exception:
            logger.warning(
                "Failed to create Temporal schedule for %s — "
                "DB record saved, Temporal unavailable",
                schedule.id,
                exc_info=True,
            )

    async def _delete_temporal_schedule(self, schedule_id: UUID) -> None:
        """Delete a Temporal schedule by its ID. Best-effort."""
        try:
            from temporalio.client import Client as TemporalClient

            client = await TemporalClient.connect(get_settings().temporal_host)

            handle = client.get_schedule_handle(f"scheduled-run-{schedule_id}")
            await handle.delete()
            logger.info("Deleted Temporal schedule scheduled-run-%s", schedule_id)
        except Exception:
            logger.warning(
                "Failed to delete Temporal schedule for %s — "
                "Temporal may be unavailable",
                schedule_id,
                exc_info=True,
            )
