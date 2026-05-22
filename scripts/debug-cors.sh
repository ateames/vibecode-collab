#!/usr/bin/env bash
# CORS / API reachability probe — writes NDJSON to Cursor debug log.
set -euo pipefail

API_URL="${API_URL:-https://api.vibecodecollab.com}"
ORIGIN="${ORIGIN:-https://dev-prod-1.vibecodecollab-prod.pages.dev}"
LOG_PATH="${DEBUG_LOG_PATH:-/Users/ateames/Tech_Projects/vibecode-collab/.cursor/debug-0bf2cf.log}"
SESSION_ID="${DEBUG_SESSION_ID:-0bf2cf}"
RUN_ID="${RUN_ID:-pre-fix}"

log() {
  local hypothesis_id="$1" location="$2" message="$3" data="$4"
  local ts
  ts="$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || date +%s000)"
  printf '%s\n' "{\"sessionId\":\"${SESSION_ID}\",\"runId\":\"${RUN_ID}\",\"hypothesisId\":\"${hypothesis_id}\",\"location\":\"${location}\",\"message\":\"${message}\",\"data\":${data},\"timestamp\":${ts}}" >>"${LOG_PATH}"
}

probe() {
  local method="$1" path="$2" hypothesis="$3"
  local out headers code acao
  out="$(mktemp)"
  headers="$(curl -sS -D - -o /dev/null -X "${method}" \
    "${API_URL}${path}" \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: content-type" \
    -w "\n__HTTP_CODE__:%{http_code}" 2>&1 || true)"
  code="$(echo "${headers}" | sed -n 's/.*__HTTP_CODE__:\([0-9]*\).*/\1/p' | tail -1)"
  acao="$(echo "${headers}" | grep -i '^access-control-allow-origin:' | tail -1 | tr -d '\r' || true)"
  log "${hypothesis}" "debug-cors.sh:probe" "${method} ${path}" \
    "{\"httpCode\":\"${code:-000}\",\"acao\":\"${acao:-none}\",\"origin\":\"${ORIGIN}\"}"
  rm -f "${out}"
}

mkdir -p "$(dirname "${LOG_PATH}")"
probe OPTIONS "/nodeinfo/2.1" "H1"
probe OPTIONS "/api/v3/site" "H2"
probe GET "/nodeinfo/2.1" "H3"

echo "Logged to ${LOG_PATH} (runId=${RUN_ID})"
echo "Origin: ${ORIGIN}"
curl -sS -o /dev/null -w "GET /nodeinfo/2.1 => HTTP %{http_code}\n" \
  "${API_URL}/nodeinfo/2.1" -H "Origin: ${ORIGIN}" || true
