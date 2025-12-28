# SP-API 認証処理

本ドキュメントでは、SP-APIの認証処理について詳細を説明する。

---

## 認証方式

SP-APIはLogin with Amazon（LWA）を使用したOAuth 2.0ベースの認証を採用している。

---

## 必要な認証情報

### スクリプトプロパティに設定する値

| プロパティ名 | 説明 | 取得場所 |
|-------------|------|---------|
| LWA_CLIENT_ID | LWAクライアントID | Seller Central > アプリ&サービス > アプリ開発 |
| LWA_CLIENT_SECRET | LWAクライアントシークレット | 同上 |
| LWA_REFRESH_TOKEN | リフレッシュトークン | アプリケーション承認後に取得 |
| LWA_TOKEN_ENDPOINT | トークンエンドポイント | https://api.amazon.com/auth/o2/token |
| SELLER_ID | セラーID | Seller Central > 設定 > 出品用アカウント情報 |
| MARKETPLACE_ID | マーケットプレイスID | 日本: A1VC38T7YXB528 |
| SP_API_ENDPOINT | SP-APIエンドポイント | https://sellingpartnerapi-fe.amazon.com |

---

## アクセストークン取得フロー

### リクエスト仕様

| 項目 | 値 |
|------|-----|
| Method | POST |
| URL | https://api.amazon.com/auth/o2/token |
| Content-Type | application/x-www-form-urlencoded |

### リクエストパラメータ

| パラメータ | 値 |
|-----------|-----|
| grant_type | refresh_token |
| refresh_token | LWA_REFRESH_TOKENの値 |
| client_id | LWA_CLIENT_IDの値 |
| client_secret | LWA_CLIENT_SECRETの値 |

### レスポンス

| フィールド | 説明 |
|-----------|------|
| access_token | APIリクエストに使用するアクセストークン |
| token_type | トークンタイプ（bearer） |
| expires_in | 有効期限（秒）※通常3600秒 |

---

## トークンの有効期限

| 項目 | 有効期限 |
|------|---------|
| アクセストークン | 1時間（3600秒） |
| リフレッシュトークン | 無期限（ただし再承認で無効化） |

---

## API呼び出し時のヘッダー設定

SP-APIを呼び出す際は以下のヘッダーを設定する。

| ヘッダー | 値 | 必須 |
|---------|-----|------|
| x-amz-access-token | 取得したアクセストークン | Yes |
| Authorization | Bearer {アクセストークン} | API依存 |
| Accept | application/json | Yes |
| Content-Type | application/json | POST/PUT時 |

---

## エラーハンドリング

### 認証エラーの種類

| HTTPステータス | エラー | 原因 |
|--------------|--------|------|
| 400 | invalid_grant | リフレッシュトークンが無効または期限切れ |
| 400 | invalid_client | クライアントID/シークレットが不正 |
| 401 | Unauthorized | アクセストークンが無効または期限切れ |
| 403 | Forbidden | 権限不足またはアプリケーション未承認 |

### リトライ戦略

| エラー | 対応 |
|--------|------|
| 401 Unauthorized | アクセストークンを再取得してリトライ |
| 429 Too Many Requests | 指定時間待機してリトライ |
| 500 Internal Server Error | 一定時間後にリトライ |

---

## 本プロジェクトでの実装

### 関連ファイル

| ファイル | 関数 | 役割 |
|---------|------|------|
| utils_SpApiHelper.js | utils_getSpApiAccessToken | アクセストークン取得 |
| utils_SpApiHelper.js | utils_getSpApiConfig | SP-API設定取得 |
| utils_SpApiHelper.js | utils_makeSpApiRequest | APIリクエスト実行 |
| utils_SpApiHelper.js | utils_makeSpApiRequestWithRetry | リトライ付きリクエスト |
| spapi_registerProducts.js | spapi_getAccessToken | 商品登録用トークン取得 |
| spapi_Shipment.js | spapi_getAccessToken_ | 納品プラン用トークン取得 |

---

## セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| 認証情報の保管 | スクリプトプロパティに保存（コードに直接記載しない） |
| トークン漏洩防止 | ログ出力時はトークン全体を表示しない |
| HTTPS通信 | すべてのAPI通信はHTTPSを使用 |

---

## 公式リファレンス

- 認証ガイド: https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api
- 自己承認: https://developer-docs.amazon.com/sp-api/docs/self-authorization
- 承認ワークフロー: https://developer-docs.amazon.com/sp-api/docs/onboarding-step-6-set-up-the-authorization-workflow
