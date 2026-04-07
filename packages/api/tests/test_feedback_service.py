import asyncio
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.feedback import FeedbackEntry
from app.schemas.feedback import FeedbackCreate
from app.services.feedback import FeedbackService


def test_feedback_service_upserts_and_clears_user_votes():
    async def run_test():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        async with engine.begin() as conn:
            await conn.exec_driver_sql("CREATE TABLE users (id CHAR(32) PRIMARY KEY)")
            await conn.run_sync(FeedbackEntry.__table__.create)

            user_id = uuid4()
            await conn.execute(
                text("INSERT INTO users (id) VALUES (:id)"),
                {"id": user_id.hex},
            )

        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with session_factory() as session:
            service = FeedbackService(session)
            entity_id = uuid4()

            first = await service.create_feedback(
                user_id,
                FeedbackCreate(
                    entity_type="answer",
                    entity_id=entity_id,
                    feedback="like",
                ),
            )
            second = await service.create_feedback(
                user_id,
                FeedbackCreate(
                    entity_type="answer",
                    entity_id=entity_id,
                    feedback="dislike",
                ),
            )

            assert second.id == first.id
            assert second.feedback == "dislike"

            mine = await service.get_my_feedback(
                user_id,
                "answer",
                entity_id,
            )
            assert mine is not None
            assert mine.feedback == "dislike"

            all_feedback = await service.list_feedback(
                entity_type="answer",
                entity_id=entity_id,
            )
            assert len(all_feedback) == 1

            cleared = await service.clear_my_feedback(
                user_id,
                "answer",
                entity_id,
            )
            assert cleared is True
            assert await service.get_my_feedback(user_id, "answer", entity_id) is None

        await engine.dispose()

    asyncio.run(run_test())
