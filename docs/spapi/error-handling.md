# SP-API エラーハンドリング

本ドキュメントでは、SP-APIのエラーハンドリングについて説明する。

---

## HTTPステータスコード

### 成功レスポンス

| コード | 説明 |
|--------|------|
| 200 | OK - リクエスト成功 |
| 201 | Created - リソース作成成功 |
| 202 | Accepted - リクエスト受付済み（非同期処理） |
| 204 | No Content - 成功（レスポンスボディなし） |

### クライアントエラー

| コード | 説明 | 対処 |
|--------|------|------|
| 400 | Bad Request | リクエストパラメータを確認 |
| 401 | Unauthorized | アクセストークンを再取得 |
| 403 | Forbidden | 権限・承認状態を確認 |
| 404 | Not Found | リソースIDを確認 |
| 415 | Unsupported Media Type | Content-Typeを確認 |
| 429 | Too Many Requests | レート制限、待機してリトライ |

### サーバーエラー

| コード | 説明 | 対処 |
|--------|------|------|
| 500 | Internal Server Error | 時間をおいてリトライ |
| 502 | Bad Gateway | 時間をおいてリトライ |
| 503 | Service Unavailable | 時間をおいてリトライ |
| 504 | Gateway Timeout | 時間をおいてリトライ |

---

## エラーレスポンス構造

### 基本形式

| フィールド | 説明 |
|-----------|------|
| errors | エラー配列 |
| errors[].code | エラーコード |
| errors[].message | エラーメッセージ |
| errors[].details | 詳細情報（オプション） |

---

## レート制限（429エラー）

### レート制限の仕組み

SP-APIは「トークンバケット」方式でレート制限を実施。

| 用語 | 説明 |
|------|------|
| Rate | 1秒あたりの最大リクエスト数 |
| Burst | 瞬間的に許容される最大リクエスト数 |

### 429エラー時の対応

1. レスポンスヘッダーの x-amzn-RequestId を記録
2. 指定された待機時間（通常1-5秒）後にリトライ
3. 最大リトライ回数を設定して無限ループを防止

### リトライ戦略

| リトライ回数 | 待機時間 |
|------------|---------|
| 1回目 | 1秒 |
| 2回目 | 2秒 |
| 3回目 | 4秒 |
| 4回目以降 | 5秒固定 |

---

## 主要なエラーコード

### 認証関連

| コード | 説明 |
|--------|------|
| InvalidInput | 入力パラメータが不正 |
| InvalidParameterValue | パラメータ値が不正 |
| Unauthorized | 認証失敗 |
| AccessDenied | アクセス拒否 |
| ResourceNotFound | リソースが見つからない |

### Listings Items API

| コード | 説明 |
|--------|------|
| INVALID_ATTRIBUTE_VALUE | 属性値が不正 |
| MISSING_REQUIRED_ATTRIBUTE | 必須属性が不足 |
| INVALID_PRODUCT_TYPE | 商品タイプが不正 |
| DUPLICATE_SKU | SKUが重複 |
| INVALID_ASIN | ASINが無効 |

### Fulfillment Inbound API

| コード | 説明 |
|--------|------|
| INVALID_PREP_OWNER | prepOwner値が不正 |
| INVALID_SKU | SKUが無効 |
| INVALID_ADDRESS | 住所形式が不正 |
| INVALID_QUANTITY | 数量が不正 |

---

## 本プロジェクトでのエラーハンドリング実装

### 関連ファイル

| ファイル | 関数 | 役割 |
|---------|------|------|
| utils_SpApiHelper.js | utils_handleSpApiError | SP-APIエラー処理 |
| utils_SpApiHelper.js | utils_makeSpApiRequestWithRetry | リトライ付きリクエスト |
| spapi_registerProducts.js | spapi_detectErrorType | エラータイプ検出 |

### エラータイプ検出ロジック

| 検出パターン | エラータイプ |
|------------|-------------|
| invalid_asin, asin | INVALID_ASIN |
| invalid_sku, sku | INVALID_SKU |
| price | INVALID_PRICE |
| unauthorized, 403 | UNAUTHORIZED |
| throttl, 429 | THROTTLED |
| product_type | INVALID_PRODUCT_TYPE |
| その他 | UNKNOWN |

---

## エラー処理のベストプラクティス

### 1. ログ出力

| 項目 | 出力内容 |
|------|---------|
| リクエスト情報 | URL、メソッド、ヘッダー（認証情報除く） |
| レスポンス情報 | ステータスコード、エラーメッセージ |
| タイムスタンプ | エラー発生日時 |
| リクエストID | x-amzn-RequestId ヘッダー値 |

### 2. ユーザーへの通知

| エラー種類 | 通知方法 |
|-----------|---------|
| 認証エラー | 設定確認を促すメッセージ |
| レート制限 | リトライ中であることを通知 |
| バリデーションエラー | 具体的な修正箇所を提示 |
| サーバーエラー | 時間をおいて再実行を促す |

### 3. 結果の記録

| 項目 | 記録先 |
|------|--------|
| 処理結果 | シートの結果列（成功/エラー） |
| エラー詳細 | 結果列にメッセージを表示 |
| 背景色 | 成功=緑、スキップ=黄、エラー=赤 |

---

## リトライ実装例

### 設定値

| 項目 | 推奨値 |
|------|--------|
| 最大リトライ回数 | 3回 |
| 初期待機時間 | 1000ms |
| 最大待機時間 | 5000ms |
| バックオフ係数 | 2（指数バックオフ） |

### リトライ対象

| 対象 | 理由 |
|------|------|
| 429 Too Many Requests | レート制限は一時的 |
| 500 Internal Server Error | サーバー側の一時的問題 |
| 502 Bad Gateway | ゲートウェイの一時的問題 |
| 503 Service Unavailable | サービスの一時的停止 |
| 504 Gateway Timeout | タイムアウトは一時的 |

### リトライ対象外

| 対象外 | 理由 |
|--------|------|
| 400 Bad Request | リクエスト内容の修正が必要 |
| 401 Unauthorized | 認証情報の再取得が必要 |
| 403 Forbidden | 権限の確認が必要 |
| 404 Not Found | リソースが存在しない |

---

## 公式リファレンス

- エラーレスポンス: https://developer-docs.amazon.com/sp-api/docs/response-format
- レート制限: https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits-in-the-sp-api
