#!/bin/sh
set -e

branch="$(git symbolic-ref --quiet --short HEAD || true)"

if [ -z "$branch" ]; then
  echo "Unable to determine current branch."
  exit 1
fi

case "$branch" in
  codex/*)
    exit 0
    ;;
  *)
    echo "Branch name must start with 'codex/'. Current: $branch"
    exit 1
    ;;
esac
