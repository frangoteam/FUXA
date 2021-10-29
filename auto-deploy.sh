#!/bin/bash
set -eu
set -o pipefail

while true
do
  UPSTREAM=${1:-'@{u}'}
  LOCAL=$(git rev-parse @)
  REMOTE=$(git rev-parse "$UPSTREAM")
  BASE=$(git merge-base @ "$UPSTREAM")
  git fetch
  if [ "$LOCAL" = "$REMOTE" ]; then
      echo "$(date) :: Up-to-date"
  elif [ "$LOCAL" = "$BASE" ]; then
      echo "$(date) :: Need to pull"
      git pull -v && docker-compose build && docker-compose up -d
  elif [ "$REMOTE" = "$BASE" ]; then
      echo "$(date) :: Need to push"
  else
      echo "$(date) :: Diverged"
  fi
  sleep 10
done