#!/bin/sh
# タロット・ブレインストーミングを起動する（初回だけ依存を入れる）
cd "$(dirname "$0")" || exit 1
[ -d node_modules/electron/dist ] || { npm install --no-audit --no-fund && node node_modules/electron/install.js; } || exit 1
exec node_modules/.bin/electron . "$@"
