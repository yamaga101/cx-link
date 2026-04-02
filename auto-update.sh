#!/bin/bash
# auto-update.sh
# Link Summarizer Chrome拡張機能の自動更新スクリプト（Mac/Linux用）
# リポジトリを定期的に git pull して最新に保つ

# スクリプトのディレクトリを基準にする
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/auto-update.log"

# タイムスタンプ付きログ出力関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# ローカル変更チェック（未コミットの変更があればスキップ）
if ! git -C "$SCRIPT_DIR" status --porcelain | grep -q '^'; then
    # ローカル変更なし → pull 実行
    RESULT=$(git -C "$SCRIPT_DIR" pull --ff-only 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
        log "ERROR: git pull 失敗 - $RESULT"
    elif echo "$RESULT" | grep -q "Already up to date"; then
        # 最新状態の場合はログを書かずにサイレント終了
        exit 0
    else
        log "UPDATE: $RESULT"
    fi
else
    log "SKIP: ローカルに未コミットの変更があるためスキップ"
fi
