#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${1:-.env}"

REQUIRED_VARS=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
)

echo "==> Verificando variables de entorno obligatorias"

if [[ -f "$ENV_FILE" ]]; then
  echo "    Archivo de entorno: $ENV_FILE"
  set -a && source "$ENV_FILE" && set +a
else
  echo "    Archivo $ENV_FILE no encontrado; se usará el entorno del proceso."
fi

missing=()
for var in "${REQUIRED_VARS[@]}"; do
  value="${!var:-}"
  if [[ -z "$value" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo ""
  echo "ERROR: faltan variables de entorno obligatorias:" >&2
  for var in "${missing[@]}"; do
    echo "  - $var" >&2
  done
  echo "" >&2
  echo "Defínalas en $ENV_FILE (ver .env.example) o como GitHub Secrets." >&2
  exit 1
fi

if [[ -f .env.example ]]; then
  while IFS= read -r key; do
    [[ -z "$key" ]] && continue
    if [[ -z "${!key:-}" ]]; then
      echo "    aviso: '$key' está en .env.example pero no definida (se usará el valor por defecto)."
    fi
  done < <(grep -Eo '^[A-Z_][A-Z0-9_]*=' .env.example | tr -d '=')
fi

echo "==> OK: todas las variables obligatorias están definidas."
