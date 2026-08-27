#!/usr/bin/env bash

set -euo pipefail

BACKEND_URL="${1:-http://localhost:3001}"
FRONTEND_URL="${2:-http://localhost:8080}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT:-120}"

fail() {
  echo ""
  echo "SMOKE TEST FALLIDO: $1" >&2
  exit 1
}

echo "==> Esperando a que ${BACKEND_URL}/health responda 200 (máx. ${TIMEOUT_SECONDS}s)"

deadline=$(( SECONDS + TIMEOUT_SECONDS ))
status=""
while (( SECONDS < deadline )); do
  status="$(curl -s -o /dev/null -w '%{http_code}' "${BACKEND_URL}/health" || echo 000)"
  if [[ "$status" == "200" ]]; then
    break
  fi
  printf '.'
  sleep 3
done
echo ""

if [[ "$status" != "200" ]]; then
  fail "/health devolvió '${status}' en lugar de 200 tras ${TIMEOUT_SECONDS}s."
fi

body="$(curl -s "${BACKEND_URL}/health")"
echo "    /health -> $body"
if ! grep -q '"database":"up"' <<<"${body//[[:space:]]/}"; then
  fail "/health respondió 200 pero la base de datos no está operativa."
fi

echo "==> Comprobando la API de promociones"
api_status="$(curl -s -o /dev/null -w '%{http_code}' "${BACKEND_URL}/api/promotions")"
[[ "$api_status" == "200" ]] || fail "GET /api/promotions devolvió ${api_status}."

summary="$(curl -s "${BACKEND_URL}/api/promotions/summary")"
echo "    /api/promotions/summary -> $summary"
grep -q 'validToday' <<<"$summary" || fail "El resumen no incluye el conteo de vigentes hoy."

echo "==> Comprobando el catálogo (verifica que la semilla de la BD se aplicó)"
catalog="$(curl -s "${BACKEND_URL}/api/catalog")"
grep -q '"categories"' <<<"$catalog" || fail "El catálogo no devolvió categorías."
grep -q '"products"' <<<"$catalog" || fail "El catálogo no devolvió productos."

echo "==> Comprobando el frontend"
front_status="$(curl -s -o /dev/null -w '%{http_code}' "${FRONTEND_URL}/")"
[[ "$front_status" == "200" ]] || fail "El frontend devolvió ${front_status}."

proxy_status="$(curl -s -o /dev/null -w '%{http_code}' "${FRONTEND_URL}/health")"
[[ "$proxy_status" == "200" ]] || fail "El proxy /health del frontend devolvió ${proxy_status}."

echo ""
echo "==> SMOKE TEST SUPERADO: la aplicación responde de extremo a extremo."
