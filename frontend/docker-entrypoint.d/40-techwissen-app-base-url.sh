#!/bin/sh
set -eu

normalize_base_path() {
  value="$(printf '%s' "$1" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  case "$value" in
    http://*|https://*)
      echo "ERROR: APP_BASE_URL erwartet nur den Anwendungspfad, z. B. /techwissen, keine vollständige URL." >&2
      exit 1
      ;;
  esac

  case "$value" in
    *\?*|*\#*)
      echo "ERROR: APP_BASE_URL darf keine Query-Parameter oder URL-Fragmente enthalten." >&2
      exit 1
      ;;
  esac

  value="/${value#/}"
  while [ "${value%/}" != "$value" ]; do
    value="${value%/}"
  done

  while printf '%s' "$value" | grep -q '//'; do
    value="$(printf '%s' "$value" | sed 's|//|/|g')"
  done

  if [ -z "$value" ] || [ "$value" = "/" ]; then
    echo "ERROR: TechWissen benötigt einen Unterpfad. Setze APP_BASE_URL=/pfad oder verwende den Repository-Fallback." >&2
    exit 1
  fi

  old_ifs="$IFS"
  IFS='/'
  for segment in $value; do
    if [ "$segment" = "." ] || [ "$segment" = ".." ]; then
      echo "ERROR: APP_BASE_URL darf keine relativen Pfadsegmente wie . oder .. enthalten." >&2
      exit 1
    fi
  done
  IFS="$old_ifs"

  printf '%s' "$value"
}

BAKED_BASE_PATH="$(cat /etc/techwissen/app-base-path)"
RESOLVED_BASE_PATH="$BAKED_BASE_PATH"

if [ -n "${APP_BASE_URL:-}" ]; then
  RESOLVED_BASE_PATH="$(normalize_base_path "$APP_BASE_URL")"
fi

if [ "$RESOLVED_BASE_PATH" != "$BAKED_BASE_PATH" ]; then
  echo "ERROR: APP_BASE_URL wurde seit dem Frontend-Build geändert." >&2
  echo "Build-Pfad: $BAKED_BASE_PATH, Runtime-Pfad: $RESOLVED_BASE_PATH" >&2
  echo "Bitte TechWissen mit der aktuellen APP_BASE_URL neu bauen/deployen." >&2
  exit 1
fi

REGEX_BASE_PATH="$(printf '%s' "$RESOLVED_BASE_PATH" | sed 's/[][\\.^$*+?{}|()]/\\&/g')"
SED_LITERAL="$(printf '%s' "$RESOLVED_BASE_PATH" | sed 's/[&|]/\\&/g')"
SED_REGEX="$(printf '%s' "$REGEX_BASE_PATH" | sed 's/[&|]/\\&/g')"

sed \
  -e "s|__RESOLVED_BASE_PATH_LITERAL__|$SED_LITERAL|g" \
  -e "s|__RESOLVED_BASE_PATH_REGEX__|$SED_REGEX|g" \
  /etc/techwissen/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf
