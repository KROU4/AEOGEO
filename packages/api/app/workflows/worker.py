"""Temporal worker entry-point.

Connects to the Temporal server and polls the "aeogeo-pipeline" task queue.
Run with:  uv run python -m app.workflows.worker
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal

from temporalio.client import Client
from temporalio.worker import Worker

from app.workflows.activities import (
    parse_answers_activity,
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

logger = logging.getLogger(__name__)

TASK_QUEUE = "aeogeo-pipeline"

_shutdown_event = asyncio.Event()


def _signal_handler() -> None:
    logger.info("Shutdown signal received, draining worker...")
    _shutdown_event.set()


async def main() -> None:
    """Start the Temporal worker and block until a shutdown signal is received."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    temporal_host = os.environ.get("TEMPORAL_HOST", "temporal:7233")
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
        ],
        activities=[
            parse_answers_activity,
            parse_run_answers_activity,
            score_run_activity,
            update_run_status_activity,
            load_run_queries_activity,
            execute_single_query_activity,
            create_engine_run_activity,
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
