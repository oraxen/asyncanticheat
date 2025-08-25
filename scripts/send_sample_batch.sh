#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3002}"
INGEST_TOKEN="${INGEST_TOKEN:-local_ingest}"
SERVER_ID="${SERVER_ID:-test-server}"
SESSION_ID="${SESSION_ID:-test-session}"

tmp_dir="${TMPDIR:-/tmp}"
gz_path="${tmp_dir%/}/asyncanticheat-sample.ndjson.gz"

python3 - <<'PY' "${gz_path}" "${SERVER_ID}" "${SESSION_ID}"
import gzip, json, sys, uuid

out_path = sys.argv[1]
server_id = sys.argv[2]
session_id = sys.argv[3]

player_uuid = str(uuid.UUID("11111111-1111-1111-1111-111111111111"))

meta = {
  "server_id": server_id,
  "session_id": session_id,
  "created_at_ms": 1000,
  "event_count": 3,
}

events = [
  {"ts": 1000, "dir": "serverbound", "pkt": "PLAY_CLIENT_PLAYER_POSITION", "uuid": player_uuid, "name": "Demo", "fields": {"x": 0.0, "y": 64.0, "z": 0.0}},
  {"ts": 1100, "dir": "serverbound", "pkt": "PLAY_CLIENT_PLAYER_POSITION", "uuid": player_uuid, "name": "Demo", "fields": {"x": 100.0, "y": 64.0, "z": 0.0}},  # big jump -> speed check
  {"ts": 1200, "dir": "serverbound", "pkt": "PLAY_CLIENT_PLAYER_DIGGING", "uuid": player_uuid, "name": "Demo", "fields": {"action": "START_DESTROY_BLOCK", "x": 1, "y": 64, "z": 1}},
]

with gzip.open(out_path, "wt", encoding="utf-8") as f:
  f.write(json.dumps(meta, separators=(",",":")) + "\n")
  for ev in events:
    f.write(json.dumps(ev, separators=(",",":")) + "\n")
print(out_path)
PY

echo "Posting sample batch: ${gz_path}"
curl -sS \
  -H "Authorization: Bearer ${INGEST_TOKEN}" \
  -H "Content-Type: application/x-ndjson" \
  -H "Content-Encoding: gzip" \
  -H "X-Server-Id: ${SERVER_ID}" \
  -H "X-Session-Id: ${SESSION_ID}" \
  --data-binary "@${gz_path}" \
  "${API_BASE%/}/ingest" | cat
echo


