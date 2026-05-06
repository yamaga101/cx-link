---
visibility: private
---
# cx-link — Link Summarizer（リンク要約 Chrome 拡張）

## これは何？

右クリックでページを **Gemini API で要約** し、開いている全タブの **ダイジェスト** を生成する
Chrome 拡張。さらに Claude Code から MCP ブリッジ経由でタブ情報を参照できるようにする。

v2.4.0、Manifest V3、3 機能セット:
1. **右クリック要約** — `contextMenus` から選択ページを Gemini で要約
2. **タブ一括ダイジェスト** — 開いている全タブをまとめてダイジェスト HTML 生成
3. **MCP ブリッジ** — Claude Code から `mcp__browser-tabs__*` ツール経由でタブ情報を参照（browser-tabs-mcp とペア）

## なぜあるの？

- 調査・リサーチタスクで、開いた多数のタブを後でまとめて読み返すのが認知負荷大
- Gemini API で要約すれば、タブを閉じても要約だけ残せて整理しやすい
- 朝のブリーフィング・記事 triage で「いま開いてるページ」を Claude Code に渡したい場面が多い
- youtube.com の場合は字幕ベースの要約が可能（host_permissions に明示）
- すべて自分用ツール、有料 SaaS（Glasp, Heptabase 等）の代替

## どう動いてるの？

```
[ 右クリック要約 ]
ユーザー右クリック → contextMenus
        │
        ▼
background.js → Readability で本文抽出（lib/readability.min.js）
        │
        ▼
Gemini API (generativelanguage.googleapis.com)
        │
        ▼
summary.html / summary.css / summary.js で表示

[ タブ一括ダイジェスト ]
拡張アイコンクリック → digest.html
        │
        ▼
全タブ取得 → URL ごとに本文抽出 → Gemini で要約
        │
        ▼
digest.css / digest.js でレンダリング、コピー可能形式で出力

[ MCP ブリッジ ]
lib/mcp-bridge.js
        │
        ▼  (nativeMessaging or fetch)
browser-tabs-mcp (Python WebSocket server)
        │
        ▼
Claude Code session
```

- **API**: Gemini API（`generativelanguage.googleapis.com`）— API key は options ページで設定、`storage` に保管
- **本文抽出**: `lib/readability.min.js`（Mozilla Readability）
- **MCP**: `lib/mcp-bridge.js` で browser-tabs-mcp と通信
- **自動更新**: `auto-update.{sh,plist}` で macOS launchd に登録、定期的に dist 再生成

## 壊れたらどうする？

| 症状 | 対応 |
|------|------|
| 要約が空 | options ページで Gemini API key を確認、quota 超過していないか |
| ダイジェスト生成が遅い | タブ多すぎ（30+）の場合は分割。`background.js` の並列度を確認 |
| MCP 接続が通らない | browser-tabs-mcp 側の WebSocket server（127.0.0.1:8766）が起動しているか確認 |
| YouTube 要約が空 | 字幕が無効化された動画の可能性。host_permissions が `https://*.youtube.com/*` で設定済か確認 |
| 拡張が消える | `auto-update.sh` の dist ディレクトリパスを確認、再 install |

## 止めたらどうなる？

- **即時影響**: 要約・ダイジェスト機能が消える、Claude Code から MCP 経由のタブ参照不可
- **代替**: 手動でページを開いて読む、ChatGPT/Claude にコピペ
- **退職時影響**: 個人ツール、影響なし

## 必要なアカウント・権限

| Resource | Location |
|----------|----------|
| Gemini API key | options ページ → Chrome storage（暗号化なし、`storage.sync` または `storage.local`） |
| Chrome 拡張 | unpacked ロード or 自動更新 |
| 拡張秘密鍵 | manifest 内 `key` フィールド（拡張 ID 固定用） |
| OAuth | 不要（Gemini API は API key auth） |

`permissions`: contextMenus / storage / activeTab / tabs / tabGroups / alarms / nativeMessaging
`host_permissions`: youtube.com / generativelanguage.googleapis.com / `<all_urls>`

## 関連する人・部署

| 関係者 | 関与 |
|--------|------|
| DX推進統括（志柿） | 唯一の利用者 / owner |

## 技術メモ（わかる人向け）

- **Stack**: Vanilla JS（フレームワーク非使用）、Chrome Manifest V3
- **Files (主要)**:
  - `background.js` — Service Worker（API 呼出・contextMenus 登録）
  - `digest.{html,css,js}` — タブ一括ダイジェスト UI
  - `summary.{html,css,js}` — 個別ページ要約 UI
  - `options.{html,css,js}` — 設定画面（API key 等）
  - `lib/readability.min.js` — Mozilla Readability（本文抽出）
  - `lib/mcp-bridge.js` — MCP ブリッジ
  - `auto-reload.js` — 拡張開発時の auto-reload 補助
- **`<all_urls>` host_permission**: 全サイト要約のため必須。Chrome Web Store 公開時は justification 必要
- **MCP ブリッジ仕組み**: nativeMessaging または ローカル fetch（127.0.0.1）。`browser-tabs-mcp` 側 WebSocket と接続
- **拡張秘密鍵**: manifest 内 `key` フィールドで拡張 ID 固定。紛失すると ID が変わり再インストール必要
- **upload_to_drive.py**: dist を Drive にアップロード（バックアップ）
- **次の改善候補**: 要約のローカルキャッシュ、複数 LLM 切替（Gemini + Claude）、要約の Markdown export
