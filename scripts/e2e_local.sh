#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-3002}"
API_BASE="http://${API_HOST}:${API_PORT}"

MODULE_HOST="${MODULE_HOST:-127.0.0.1}"
COMBAT_PORT="${COMBAT_PORT:-4021}"
MOVEMENT_PORT="${MOVEMENT_PORT:-4022}"
PLAYER_PORT="${PLAYER_PORT:-4023}"
COMBAT_BASE="http://${MODULE_HOST}:${COMBAT_PORT}"
MOVEMENT_BASE="http://${MODULE_HOST}:${MOVEMENT_PORT}"
PLAYER_BASE="http://${MODULE_HOST}:${PLAYER_PORT}"

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
  if [[ -n "${COMBAT_PID:-}" ]]; then kill "${COMBAT_PID}" 2>/dev/null; fi
  if [[ -n "${MOVEMENT_PID:-}" ]]; then kill "${MOVEMENT_PID}" 2>/dev/null; fi
  if [[ -n "${PLAYER_PID:-}" ]]; then kill "${PLAYER_PID}" 2>/dev/null; fi
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
kill_listeners "${COMBAT_PORT}"
kill_listeners "${MOVEMENT_PORT}"
kill_listeners "${PLAYER_PORT}"

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

echo "Seeding registered server (${SERVER_ID})..."
SERVER_TOKEN_HASH="$(python3 - <<'PY' "${INGEST_TOKEN}"
import hashlib, sys
print(hashlib.sha256(sys.argv[1].encode("utf-8")).hexdigest())
PY
)"
PGPASSWORD="${PG_PASS}" psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c \
  "insert into public.servers (id, first_seen_at, last_seen_at, auth_token_hash, auth_token_first_seen_at, owner_user_id, registered_at) values ('${SERVER_ID}', now(), now(), '${SERVER_TOKEN_HASH}', now(), '00000000-0000-0000-0000-000000000000', now()) on conflict (id) do update set auth_token_hash = excluded.auth_token_hash, owner_user_id = excluded.owner_user_id, registered_at = excluded.registered_at, last_seen_at = now();" \
  >/dev/null

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

echo "Starting combat module..."
COMBAT_LOG="${COMBAT_LOG:-/tmp/asyncanticheat_combat_module.log}"
(
  cd "${ROOT_DIR}/modules/combat_module"
  HOST="${MODULE_HOST}" \
  PORT="${COMBAT_PORT}" \
  API_BASE="${API_BASE}" \
  MODULE_CALLBACK_TOKEN="${MODULE_CALLBACK_TOKEN}" \
  RUST_LOG="info,combat_module=debug" \
  cargo run >"${COMBAT_LOG}" 2>&1
) &
COMBAT_PID="$!"

echo "Starting movement module..."
MOVEMENT_LOG="${MOVEMENT_LOG:-/tmp/asyncanticheat_movement_module.log}"
(
  cd "${ROOT_DIR}/modules/movement_module"
  HOST="${MODULE_HOST}" \
  PORT="${MOVEMENT_PORT}" \
  API_BASE="${API_BASE}" \
  MODULE_CALLBACK_TOKEN="${MODULE_CALLBACK_TOKEN}" \
  RUST_LOG="info,movement_module=debug" \
  cargo run >"${MOVEMENT_LOG}" 2>&1
) &
MOVEMENT_PID="$!"

echo "Starting player module..."
PLAYER_LOG="${PLAYER_LOG:-/tmp/asyncanticheat_player_module.log}"
(
  cd "${ROOT_DIR}/modules/player_module"
  HOST="${MODULE_HOST}" \
  PORT="${PLAYER_PORT}" \
  API_BASE="${API_BASE}" \
  MODULE_CALLBACK_TOKEN="${MODULE_CALLBACK_TOKEN}" \
  RUST_LOG="info,player_module=debug" \
  cargo run >"${PLAYER_LOG}" 2>&1
) &
PLAYER_PID="$!"

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

wait_health() {
  local name="$1"
  local base="$2"
  local log="$3"
  echo "Waiting for ${name} /health..."
  local ok=0
  for i in {1..240}; do
    if curl -sS "${base}/health" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 0.25
  done
  if [[ "${ok}" != "1" ]]; then
    echo "ERROR: ${name} did not become healthy at ${base}" >&2
    echo "--- ${name} log (tail) ---" >&2
    tail -n 200 "${log}" >&2 || true
    exit 1
  fi
}

wait_health "combat module" "${COMBAT_BASE}" "${COMBAT_LOG}"
wait_health "movement module" "${MOVEMENT_BASE}" "${MOVEMENT_LOG}"
wait_health "player module" "${PLAYER_BASE}" "${PLAYER_LOG}"

echo "Sending sample batch..."
API_BASE="${API_BASE}" INGEST_TOKEN="${INGEST_TOKEN}" SERVER_ID="${SERVER_ID}" SESSION_ID="${SESSION_ID}" \
  bash "${ROOT_DIR}/scripts/send_sample_batch.sh" >/dev/null

echo "Waiting for callbacks..."
sleep 2

echo "Querying findings from Postgres..."
count="$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -Atc "select count(*) from public.findings where server_id='${SERVER_ID}';" | tr -d '\r')"
echo "findings_count=${count}"

if [[ "${count}" -lt 1 ]]; then
  echo "ERROR: expected findings to be inserted" >&2
  exit 1
fi

echo "E2E OK"


