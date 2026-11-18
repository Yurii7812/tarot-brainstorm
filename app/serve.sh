#!/bin/sh
# リポジトリのルートで簡易サーバーを起動する（画像出力は http 経由でないと動かない）。
cd "$(dirname "$0")/.." || exit 1
PORT="${1:-8765}"
echo "http://localhost:$PORT/app/"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
