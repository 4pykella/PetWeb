#!/bin/bash
# regen.sh — пересобрать дерево Miki (files.json) и плейлист (playlist.json) прямо на сервере.
# На сервере нет Node.js, поэтому запускаем генераторы в контейнере:
# образ node:20-alpine скачивается один раз.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=node:20-alpine

docker run --rm --user "$(id -u):$(id -g)" --entrypoint node \
  -v "$(pwd)/html:/html" -w /html "$IMAGE" miki/generateFiles.js
docker run --rm --user "$(id -u):$(id -g)" --entrypoint node \
  -v "$(pwd)/html:/html" -w /html "$IMAGE" music/generatePlaylist.js
