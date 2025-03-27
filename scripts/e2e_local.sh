#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-3002}"
API_BASE="http://${API_HOST}:${API_PORT}"

MODULE_HOST="${MODULE_HOST:-127.0.0.1}"
MODULE_PORT="${MODULE_PORT:-4010}"
MODULE_BASE="http://${MODULE_HOST}:${MODULE_PORT}"

SERVER_ID="${SERVER_ID:-test-server}"
SESSION_ID="${SESSION_ID:-test-session}"

INGEST_TOKEN="${INGEST_TOKEN:-local_ingest}"
MODULE_CALLBACK_TOKEN="${MODULE_CALLBACK_TOKEN:-local_cb}"

PG_CONTAINER="${PG_CONTAINER:-async-anticheat-pg}"
PG_PORT="${PG_PORT:-54329}"
PG_DB="${PG_DB:-async_anticheat}"
PG_USER="${PG_USER:-postgres}"
PG_PASS="${PG_PASS:-postgres}"

LOCAL_STORE_DIR="${LOCAL_STORE_DIR:-/tmp/asyncanticheat_object_store}"

cleanup() {
  set +e
  if [[ -n "${API_PID:-}" ]]; then kill "${API_PID}" 2>/dev/null; fi
  if [[ -n "${MODULE_PID:-}" ]]; then kill "${MODULE_PID}" 2>/dev/null; fi
  docker rm -f "${PG_CONTAINER}" >/dev/null 2>&1
}
trap cleanup EXIT

mkdir -p "${LOCAL_STORE_DIR}"

kill_listeners() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "Killing processes listening on port ${port}: ${pids}"
      kill ${pids} >/dev/null 2>&1 || true
      sleep 0.2
      kill -9 ${pids} >/dev/null 2>&1 || true
    fi
  fi
}

kill_listeners "${API_PORT}"
kill_listeners "${MODULE_PORT}"

echo "Starting Postgres (docker) on port ${PG_PORT}..."
docker rm -f "${PG_CONTAINER}" >/dev/null 2>&1 || true
docker run --rm -d \
  --name "${PG_CONTAINER}" \
  -e POSTGRES_PASSWORD="${PG_PASS}" \
  -e POSTGRES_USER="${PG_USER}" \
  -e POSTGRES_DB="${PG_DB}" \
  -p "${PG_PORT}:5432" \
  postgres:16 >/dev/null

echo "Waiting for Postgres..."
DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@${API_HOST}:${PG_PORT}/${PG_DB}"
pg_ok=0
for i in {1..240}; do
  if PGPASSWORD="${PG_PASS}" psql "${DATABASE_URL}" -Atc "select 1" >/dev/null 2>&1; then
    pg_ok=1
    break
  fi
  sleep 0.25
done
if [[ "${pg_ok}" != "1" ]]; then
  echo "ERROR: Postgres did not become ready on ${DATABASE_URL}" >&2
  docker logs --tail 200 "${PG_CONTAINER}" >&2 || true
  exit 1
fi

echo "Applying schema.sql..."
PGPASSWORD="${PG_PASS}" psql "${DATABASE_URL}" < "${ROOT_DIR}/schema.sql" >/dev/null

echo "Starting async_anticheat_api..."
API_LOG="${API_LOG:-/tmp/asyncanticheat_api.log}"
(
  cd "${ROOT_DIR}"
  HOST="${API_HOST}" \
  PORT="${API_PORT}" \
  DATABASE_URL="${DATABASE_URL}" \
  INGEST_TOKEN="${INGEST_TOKEN}" \
  MODULE_CALLBACK_TOKEN="${MODULE_CALLBACK_TOKEN}" \
  MODULE_HEALTHCHECK_INTERVAL_SECONDS=1 \
  S3_BUCKET="" \
  LOCAL_STORE_DIR="${LOCAL_STORE_DIR}" \
  RUST_LOG="info,async_anticheat_api=debug" \
  cargo run >"${API_LOG}" 2>&1
) &
API_PID="$!"

echo "Starting demo module..."
MODULE_LOG="${MODULE_LOG:-/tmp/asyncanticheat_demo_module.log}"
(
  cd "${ROOT_DIR}/modules/demo_module"
  HOST="${MODULE_HOST}" \
  PORT="${MODULE_PORT}" \
  API_BASE="${API_BASE}" \
  MODULE_CALLBACK_TOKEN="${MODULE_CALLBACK_TOKEN}" \
  SPEED_THRESHOLD_BPS=50 \
  RUST_LOG="info,async_anticheat_demo_module=debug" \
  cargo run >"${MODULE_LOG}" 2>&1
) &
MODULE_PID="$!"

echo "Waiting for API /health..."
api_ok=0
for i in {1..240}; do
  if curl -sS "${API_BASE}/health" >/dev/null 2>&1; then
    api_ok=1
    break
  fi
  sleep 0.25
done
if [[ "${api_ok}" != "1" ]]; then
  echo "ERROR: API did not become healthy at ${API_BASE}" >&2
  echo "--- API log (tail) ---" >&2
  tail -n 200 "${API_LOG}" >&2 || true
  exit 1
fi

echo "Waiting for module /health..."
mod_ok=0
for i in {1..240}; do
  if curl -sS "${MODULE_BASE}/health" >/dev/null 2>&1; then
    mod_ok=1
    break
  fi
  sleep 0.25
done
if [[ "${mod_ok}" != "1" ]]; then
  echo "ERROR: demo module did not become healthy at ${MODULE_BASE}" >&2
  echo "--- demo module log (tail) ---" >&2
  tail -n 200 "${MODULE_LOG}" >&2 || true
  exit 1
fi

echo "Registering module on server ${SERVER_ID}..."
curl -sS \
  -H "Authorization: Bearer ${INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"demo\",\"base_url\":\"${MODULE_BASE}\",\"enabled\":true,\"transform\":\"raw_ndjson_gz\"}" \
  "${API_BASE}/servers/${SERVER_ID}/modules" >/dev/null

echo "Sending sample batch..."
API_BASE="${API_BASE}" INGEST_TOKEN="${INGEST_TOKEN}" SERVER_ID="${SERVER_ID}" SESSION_ID="${SESSION_ID}" \
  bash "${ROOT_DIR}/scripts/send_sample_batch.sh" >/dev/null

echo "Waiting for callbacks..."
sleep 1

echo "Querying findings from Postgres..."
count="$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -Atc "select count(*) from public.findings where server_id='${SERVER_ID}';" | tr -d '\r')"
echo "findings_count=${count}"

if [[ "${count}" -lt 1 ]]; then
  echo "ERROR: expected findings to be inserted" >&2
  exit 1
fi

echo "E2E OK"


