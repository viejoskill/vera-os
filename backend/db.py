"""Infra layer. The ONLY module that owns the SQLAlchemy engine/session.
Swapping Postgres for another SQL backend later touches only this file.
Engine is created lazily so the app boots even before DATABASE_URL is set."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

import config

Base = declarative_base()

_engine = None
_session_factory = None


def _init() -> None:
    global _engine, _session_factory
    if _engine is not None:
        return
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    async_url = config.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    _engine = create_async_engine(
        async_url,
        pool_size=10,
        max_overflow=5,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=False,
        echo=False,
        connect_args={"statement_cache_size": 0, "command_timeout": 30},
    )
    _session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )


async def get_db():
    _init()
    async with _session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
