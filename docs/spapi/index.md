# SP-API 仕様書

本ディレクトリには、Amazon Selling Partner API（SP-API）の仕様書を格納する。

---

## ドキュメント一覧

| ドキュメント | 内容 |
|-------------|------|
| [overview.md](./overview.md) | SP-API概要、認証フロー、エンドポイント情報 |
| [authentication.md](./authentication.md) | 認証処理の詳細、トークン取得、セキュリティ |
| [listings-api.md](./listings-api.md) | Listings Items API（商品登録）仕様 |
| [catalog-api.md](./catalog-api.md) | Catalog Items API（商品タイプ取得）仕様 |
| [fulfillment-inbound-api.md](./fulfillment-inbound-api.md) | Fulfillment Inbound API（FBA納品）仕様 |
| [finances-api.md](./finances-api.md) | Finances API（売上レポート）仕様 |
| [error-handling.md](./error-handling.md) | エラーハンドリング、リトライ戦略 |

---

## 本プロジェクトでのSP-API利用

### 対応機能

| 機能 | 使用API | 実装ファイル |
|------|---------|-------------|
| 商品登録 | Listings Items API, Catalog Items API | spapi_registerProducts.js |
| FBA納品プラン作成 | Fulfillment Inbound API | spapi_Shipment.js |
| 売上レポート出力 | Finances API | amazon_SalesReport.js |

### 共通処理

| 処理 | 実装ファイル |
|------|-------------|
| アクセストークン取得 | utils_SpApiHelper.js |
| APIリクエスト送信 | utils_SpApiHelper.js |
| エラーハンドリング | utils_SpApiHelper.js |
| 出荷元住所取得 | utils_SpApiHelper.js |

---

## 日本マーケットプレイス設定

| 項目 | 値 |
|------|-----|
| Marketplace ID | A1VC38T7YXB528 |
| Country Code | JP |
| SP-API Endpoint | https://sellingpartnerapi-fe.amazon.com |
| AWS Region | us-west-2 |
| LWA Token Endpoint | https://api.amazon.com/auth/o2/token |

---

## 必須スクリプトプロパティ

| プロパティ | 説明 |
|-----------|------|
| LWA_CLIENT_ID | LWAクライアントID |
| LWA_CLIENT_SECRET | LWAクライアントシークレット |
| LWA_REFRESH_TOKEN | リフレッシュトークン |
| SELLER_ID | セラーID |
| MARKETPLACE_ID | マーケットプレイスID |
| SP_API_ENDPOINT | SP-APIエンドポイント |
| LWA_TOKEN_ENDPOINT | LWAトークンエンドポイント |

### FBA納品用追加プロパティ

| プロパティ | 説明 |
|-----------|------|
| SHIP_FROM_NAME | 出荷元名 |
| SHIP_FROM_ADDRESS_LINE1 | 出荷元住所1 |
| SHIP_FROM_ADDRESS_LINE2 | 出荷元住所2 |
| SHIP_FROM_CITY | 出荷元市区町村 |
| SHIP_FROM_STATE | 出荷元都道府県 |
| SHIP_FROM_POSTAL_CODE | 出荷元郵便番号 |
| SHIP_FROM_COUNTRY_CODE | 出荷元国コード |
| SHIP_FROM_PHONE | 出荷元電話番号 |

---

## 公式リファレンス

| リソース | URL |
|---------|-----|
| SP-API公式ドキュメント | https://developer-docs.amazon.com/sp-api |
| Seller Central開発者ポータル | https://developer.amazonservices.com/ |
| SP-APIモデル | https://developer-docs.amazon.com/sp-api/docs/sp-api-models |
| リリースノート | https://developer-docs.amazon.com/sp-api/docs/sp-api-release-notes |
| マーケットプレイスID | https://developer-docs.amazon.com/sp-api/docs/marketplace-ids |
| エンドポイント | https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025/12/28 | 初版作成 |
