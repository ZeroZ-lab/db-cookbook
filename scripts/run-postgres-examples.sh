#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-db_cookbook_lab}"

if ! command -v createdb >/dev/null 2>&1; then
  echo "createdb is required but was not found in PATH." >&2
  exit 127
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but was not found in PATH." >&2
  exit 127
fi

if ! psql -lqt | cut -d '|' -f 1 | grep -qx " ${DB_NAME}"; then
  createdb "${DB_NAME}"
fi

psql "${DB_NAME}" -v ON_ERROR_STOP=1 -f site/public/examples/ecommerce-postgres.sql
psql "${DB_NAME}" -v ON_ERROR_STOP=1 -f site/public/examples/chapter-02-queries.sql

echo "PostgreSQL examples ran successfully against database: ${DB_NAME}"

