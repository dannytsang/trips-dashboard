#!/usr/bin/env bash
set -euo pipefail

# Vercel's Ignored Build Step contract:
#   exit 0 => skip/cancel this deployment build
#   exit 1 => continue with build/deploy
#
# We skip documentation-only pushes so spec/README markdown changes do not
# trigger a Vercel build for this mostly-static dashboard shell.

BASE_SHA="${VERCEL_IGNORE_BASE:-${VERCEL_GIT_PREVIOUS_SHA:-}}"

if [[ -z "${BASE_SHA}" ]]; then
  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    BASE_SHA="HEAD^"
  else
    echo "No previous commit available; running Vercel build."
    exit 1
  fi
fi

if ! git rev-parse --verify "${BASE_SHA}" >/dev/null 2>&1; then
  echo "Previous commit ${BASE_SHA} is unavailable; running Vercel build."
  exit 1
fi

mapfile -t changed_files < <(git diff --name-only "${BASE_SHA}" HEAD --)

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No changed files detected; skipping Vercel build."
  exit 0
fi

for file in "${changed_files[@]}"; do
  case "${file}" in
    README.md|docs/*|*.md)
      ;;
    *)
      echo "Build required: ${file} changed."
      exit 1
      ;;
  esac
done

echo "Skipping Vercel build: only markdown/docs files changed."
exit 0
