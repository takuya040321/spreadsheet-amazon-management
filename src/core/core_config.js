/**
 * 利益確認シート構成設定
 * 
 * この定数はスプレッドシートの列構造とデータ開始行のみを定義します。
 * Amazon SP-API認証情報などは別途PropertiesServiceで管理します。
 */
const PROFIT_SHEET_CONFIG = {
  COLUMN: {
    CHECKBOX: 1,      // A列: チェックボックス
    PURCHASE_QTY: 2,  // B列: 購入個数
    PRODUCT_NAME: 5,  // E列: 商品名
    ASIN: 6,          // F列: ASIN
    PRICE: 8,         // H列: 価格
    BREAK_EVEN: 17,   // Q列: 損益分岐点
    SKU: 24,          // X列: SKU
    SKU_COPY: 25      // Y列: 実SKU
  },
  DATA_START_ROW: 3   // データ開始行（2行目がヘッダー）
};

const PRODUCT_MANAGEMENT_CONFIG = {
  COLUMN: {
    STATES: 1,          // A列: 商品ステータス
    PURCHASE_MONTH: 2,  // B列: 仕入月(**月)
    PRODUCT_NAME: 5,    // E列: 商品名
    ASIN: 6,            // F列: ASIN
    PRICE: 8,           // H列: 価格
    SKU: 24,            // X列: SKU
    SKU_COPY: 25        // Y列: 実SKU
  },
  DATA_START_ROW: 3   // データ開始行（2行目がヘッダー）
};

const PRODUCT_STATUS = {
  NOT_RECEIVED: "1.商品未受領",
  RECEIVED: "2.受領/検品済",
  ON_SALE: "3.販売中",
  SOLD: "4.販売/処分済"
};