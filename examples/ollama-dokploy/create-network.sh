#!/usr/bin/env bash
set -euo pipefail

NETWORK_NAME="${1:-ollama-internal}"

if docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
  echo "Docker-Netz ${NETWORK_NAME} existiert bereits."
  exit 0
fi

docker network create \
  --driver bridge \
  --internal \
  "${NETWORK_NAME}"

echo "Internes Docker-Netz ${NETWORK_NAME} wurde erstellt."
