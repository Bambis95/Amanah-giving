#!/usr/bin/env python
# -*- coding: utf-8 -*-

import asyncio
import importlib
import os
import pkgutil
from logging.config import fileConfig
from pathlib import Path

from dotenv import load_dotenv
import models
from alembic import context
from core.database import Base
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

# Charger backend/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL is not defined in backend/.env")

config = context.config
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Importer automatiquement tous les modèles ORM
for _, module_name, _ in pkgutil.iter_modules(models.__path__):
    importlib.import_module(f"{models.__name__}.{module_name}")


def alembic_include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name in ["sessions"]:
        return False
    return True


async def run_migrations_online():
    connectable = create_async_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(
            lambda sync_conn: context.configure(
                connection=sync_conn,
                target_metadata=target_metadata,
                compare_type=True,
                compare_server_default=True,
                include_object=alembic_include_object,
            )
        )

        async with connection.begin():
            await connection.run_sync(
                lambda sync_conn: context.run_migrations()
            )

    await connectable.dispose()


def run_migrations():
    try:
        asyncio.get_running_loop()
        asyncio.create_task(run_migrations_online())
    except RuntimeError:
        asyncio.run(run_migrations_online())


run_migrations()
