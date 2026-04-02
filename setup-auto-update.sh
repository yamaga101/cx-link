#!/bin/bash
# setup-auto-update.sh
# Link Summarizer Chrome拡張機能の自動更新セットアップスクリプト（Mac用）
# LaunchAgent をインストールして2分ごとの自動更新を有効にする

set -e

# スクリプトのディレクトリ（拡張機能のディレクトリ）を取得
EXTENSION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_SRC="$EXTENSION_DIR/auto-update.plist"
PLIST_LABEL="com.yamaga101.cx-link-auto-update"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

echo "=== Link Summarizer 自動更新セットアップ ==="
echo "拡張機能ディレクトリ: $EXTENSION_DIR"
echo ""

# auto-update.sh に実行権限を付与
echo "[1/4] auto-update.sh に実行権限を付与..."
chmod +x "$EXTENSION_DIR/auto-update.sh"
echo "      完了"

# LaunchAgents ディレクトリが存在することを確認
mkdir -p "$HOME/Library/LaunchAgents"

# plist をコピーしてパスを置換
echo "[2/4] plist を ~/Library/LaunchAgents/ にインストール..."
sed "s|__EXTENSION_DIR__|$EXTENSION_DIR|g" "$PLIST_SRC" > "$PLIST_DEST"
echo "      完了: $PLIST_DEST"

# 既存のエージェントをアンロード（エラーは無視）
echo "[3/4] 既存のエージェントをアンロード（初回は無視）..."
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# エージェントをロード
echo "[4/4] LaunchAgent をロード..."
launchctl load "$PLIST_DEST"
echo "      完了"

echo ""
echo "=== セットアップ完了 ==="
echo "2分ごとに自動更新が実行されます。"
echo "ログファイル: $EXTENSION_DIR/auto-update.log"
echo ""
echo "停止する場合: launchctl unload $PLIST_DEST"
echo "再起動する場合: launchctl load $PLIST_DEST"
