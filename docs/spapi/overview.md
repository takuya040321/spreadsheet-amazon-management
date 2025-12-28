# Amazon SP-API 概要

本ドキュメントでは、Amazon Selling Partner API（SP-API）の概要と本プロジェクトでの利用方法を説明する。

---

## SP-API とは

Amazon Selling Partner API（SP-API）は、セラーやベンダーが注文、出荷、支払い、在庫などのビジネス情報にアクセスできるREST APIである。Amazon Marketplace Web Service（MWS）の後継として開発された。

### 主な特徴

| 項目 | 説明 |
|------|------|
| プロトコル | REST API（JSON形式） |
| 認証方式 | Login with Amazon（LWA）OAuth 2.0 |
| レート制限 | APIごとに設定（リクエスト/秒、バースト値） |
| リージョン | 北米、ヨーロッパ、極東の3リージョン |

---

## 本プロジェクトで使用するAPI

| API名 | バージョン | 用途 |
|-------|-----------|------|
| Listings Items API | v2021-08-01 | 商品登録・更新 |
| Catalog Items API | v2022-04-01 | 商品タイプ取得・カタログ情報取得 |
| Fulfillment Inbound API | v2024-03-20 | FBA納品プラン作成 |
| Finances API | v0 / v2024-06-19 | 売上レポート・財務イベント取得 |

---

## 日本マーケットプレイス設定

| 設定項目 | 値 |
|----------|-----|
| Marketplace ID | A1VC38T7YXB528 |
| Country Code | JP |
| SP-API Endpoint | https://sellingpartnerapi-fe.amazon.com |
| LWA Token Endpoint | https://api.amazon.com/auth/o2/token |
| AWS Region | us-west-2 |

---

## 認証フロー

SP-APIの認証はLogin with Amazon（LWA）を使用したOAuth 2.0ベースで行われる。

### 認証に必要な情報

| 情報 | 説明 |
|------|------|
| LWA Client ID | Seller Centralで取得するクライアント識別子 |
| LWA Client Secret | Seller Centralで取得するクライアントシークレット |
| Refresh Token | アプリケーション承認後に取得する更新トークン |

### アクセストークン取得

アクセストークンはRefresh Tokenを使用して取得する。有効期限は1時間（3600秒）。

リクエスト先: https://api.amazon.com/auth/o2/token

リクエストパラメータ:
- grant_type: refresh_token
- refresh_token: 取得したリフレッシュトークン
- client_id: LWA Client ID
- client_secret: LWA Client Secret

---

## APIリクエストの基本構造

### 必須ヘッダー

| ヘッダー | 説明 |
|---------|------|
| x-amz-access-token | LWAアクセストークン |
| Accept | application/json |
| Content-Type | application/json（POST/PUT時） |

### レスポンス形式

すべてのAPIはJSON形式でレスポンスを返す。エラー時はHTTPステータスコードとエラー詳細が含まれる。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| authentication.md | 認証処理の詳細 |
| listings-api.md | Listings Items API仕様 |
| catalog-api.md | Catalog Items API仕様 |
| fulfillment-inbound-api.md | Fulfillment Inbound API仕様 |
| finances-api.md | Finances API仕様 |

---

## 公式リファレンス

- SP-API公式ドキュメント: https://developer-docs.amazon.com/sp-api
- SP-APIモデル: https://developer-docs.amazon.com/sp-api/docs/sp-api-models
- リリースノート: https://developer-docs.amazon.com/sp-api/docs/sp-api-release-notes
- マーケットプレイスID一覧: https://developer-docs.amazon.com/sp-api/docs/marketplace-ids
- エンドポイント一覧: https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints
