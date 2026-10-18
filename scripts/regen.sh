#!/bin/bash
# regen.sh — пересобрать дерево Miki (files.json) и плейлист (playlist.json) прямо на сервере.
# На сервере нет Node.js, поэтому запускаем генераторы в контейнере:
# берём уже собранный образ бота (там Node 20), иначе — node:20-alpine.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=petweb-workdays-bot
docker image inspect "$IMAGE" >/dev/null 2>&1 || IMAGE=node:20-alpine

docker run --rm --user "$(id -u):$(id -g)" --entrypoint node \
  -v "$(pwd)/html:/html" -w /html "$IMAGE" miki/generateFiles.js
docker run --rm --user "$(id -u):$(id -g)" --entrypoint node \
  -v "$(pwd)/html:/html" -w /html "$IMAGE" music/generatePlaylist.js
