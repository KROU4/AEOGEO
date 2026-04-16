"""Temporal worker entry-point.

Connects to the Temporal server and polls the "aeogeo-pipeline" task queue.
Run with:  uv run python -m app.workflows.worker
"""

from __future__ import annotations

import asyncio
import logging
import signal

from temporalio.client import Client
from temporalio.worker import Worker

from app.config import get_settings
from app.workflows.activities import (
    dispatch_run_completed_event_activity,
    score_run_activity,
)
from app.workflows.full_pipeline import FullPipelineWorkflow
from app.workflows.run_engine import (
    RunEngineWorkflow,
    update_run_status_activity,
    load_run_queries_activity,
    execute_single_query_activity,
)
from app.workflows.parse_answers import ParseAnswersWorkflow, parse_run_answers_activity
from app.workflows.score_run import ScoreRunWorkflow
from app.workflows.scheduled_run import ScheduledRunWorkflow, create_engine_run_activity
from app.workflows.site_audit import SiteAuditWorkflow, run_site_audit_activity
from app.workflows.content_audit import (
    ContentAuditWorkflow,
    run_content_audit_activity,
)

logger = logging.getLogger(__name__)

TASK_QUEUE = "aeogeo-pipeline"

_shutdown_event = asyncio.Event()


def _signal_handler() -> None:
    logger.info("Shutdown signal received, draining worker...")
    _shutdown_event.set()


async def main() -> None:
    """Start the Temporal worker and block until a shutdown signal is received."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    temporal_host = get_settings().temporal_host
    logger.info("Connecting to Temporal at %s", temporal_host)

    client = await Client.connect(temporal_host)

    worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[
            FullPipelineWorkflow,
            RunEngineWorkflow,
            ParseAnswersWorkflow,
            ScoreRunWorkflow,
            ScheduledRunWorkflow,
            SiteAuditWorkflow,
            ContentAuditWorkflow,
        ],
        activities=[
            parse_run_answers_activity,
            score_run_activity,
            dispatch_run_completed_event_activity,
            update_run_status_activity,
            load_run_queries_activity,
            execute_single_query_activity,
            create_engine_run_activity,
            run_site_audit_activity,
            run_content_audit_activity,
        ],
    )

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _signal_handler)

    logger.info("Worker started on queue '%s'", TASK_QUEUE)

    async with worker:
        await _shutdown_event.wait()

    logger.info("Worker shut down cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
