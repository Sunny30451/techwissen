#!/bin/sh
set -eu

BAKED_BASE_PATH="$(cat /etc/techwissen/app-base-path)"
RESOLVED_BASE_PATH="$BAKED_BASE_PATH"

if [ -n "${APP_BASE_URL:-}" ]; then
  case "$APP_BASE_URL" in
    http://*|https://*) ;;
    *)
      echo "ERROR: APP_BASE_URL muss mit http:// oder https:// beginnen." >&2
      exit 1
      ;;
  esac

  CLEAN_APP_BASE_URL="${APP_BASE_URL%%#*}"
  CLEAN_APP_BASE_URL="${CLEAN_APP_BASE_URL%%\?*}"
  URL_WITHOUT_SCHEME="${CLEAN_APP_BASE_URL#*://}"
  URL_PATH="/${URL_WITHOUT_SCHEME#*/}"
  if [ "$URL_WITHOUT_SCHEME" = "${URL_WITHOUT_SCHEME#*/}" ]; then
    URL_PATH="/"
  fi
  URL_PATH="/${URL_PATH#/}"
  URL_PATH="${URL_PATH%/}"
  [ -n "$URL_PATH" ] || URL_PATH="/"
  [ "$URL_PATH" = "/" ] && URL_PATH=""
  RESOLVED_BASE_PATH="$URL_PATH"
fi

if [ "$RESOLVED_BASE_PATH" != "$BAKED_BASE_PATH" ]; then
  echo "ERROR: APP_BASE_URL wurde seit dem Frontend-Build geändert." >&2
  echo "Build-Pfad: $BAKED_BASE_PATH, Runtime-Pfad: $RESOLVED_BASE_PATH" >&2
  echo "Bitte TechWissen mit der aktuellen APP_BASE_URL neu bauen/deployen." >&2
  exit 1
fi

if [ -z "$RESOLVED_BASE_PATH" ]; then
  echo "ERROR: TechWissen benötigt einen Unterpfad. Setze APP_BASE_URL oder verwende den Repository-Fallback." >&2
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
