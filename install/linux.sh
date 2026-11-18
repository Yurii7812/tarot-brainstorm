#!/bin/sh
# このフォルダを「アプリ」として使えるようにする（起動コマンド・メニュー・アイコン）。何度実行しても同じ結果になる
#   起動コマンド: ~/.local/bin/tarot-brainstorm   メニュー: タロット・ブレインストーミング
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN="$HOME/.local/bin"; APPS="$HOME/.local/share/applications"; ICONS="$HOME/.local/share/icons/hicolor/scalable/apps"
mkdir -p "$BIN" "$APPS" "$ICONS"
# 部品と Electron 本体（無ければ入れる）
[ -d "$ROOT/node_modules/electron/dist" ] || (cd "$ROOT" && npm install --no-audit --no-fund && node node_modules/electron/install.js)
cp "$ROOT/build/icon.svg" "$ICONS/tarot-brainstorm.svg"
cat > "$BIN/tarot-brainstorm" <<LAUNCHER
#!/bin/sh
exec "$ROOT/tarot.sh" "\$@"
LAUNCHER
chmod +x "$BIN/tarot-brainstorm"
cat > "$APPS/tarot-brainstorm.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=タロット・ブレインストーミング
Name[en]=Tarot Brainstorm
GenericName=Tarot Brainstorm
GenericName[ja]=タロット
Keywords=tarot;Tarot;brainstorm;brainstorming;card;cards;spread;タロット;ブレインストーミング;
Comment=スプレッドにカードを置いて、意味とつながりを書き出す
Exec=$BIN/tarot-brainstorm
Icon=tarot-brainstorm
Terminal=false
Categories=Office;
StartupWMClass=tarot-brainstorm
DESKTOP
update-desktop-database "$APPS" >/dev/null 2>&1 || true
# KDE のメニュー検索のキャッシュを作り直す（無ければ何もしない）
for k in kbuildsycoca6 kbuildsycoca5; do command -v "$k" >/dev/null 2>&1 && { "$k" >/dev/null 2>&1 || true; break; }; done
echo "入れました。メニューの「タロット・ブレインストーミング」か、tarot-brainstorm で起動できます"
