/**
 * Amazon SP-API 商品登録スクリプト
 */

// ============================================
// プロパティから設定値を取得
// ============================================
function getScriptConfig() {
  const props = PropertiesService.getScriptProperties();
  const keys = [
    "LWA_CLIENT_ID",
    "LWA_CLIENT_SECRET",
    "LWA_REFRESH_TOKEN",
    "SELLER_ID",
    "MARKETPLACE_ID",
    "SP_API_ENDPOINT",
    "LWA_TOKEN_ENDPOINT",
  ];

  const config = {};
  keys.forEach(key => {
    const value = props.getProperty(key);
    if (!value) throw new Error("スクリプトプロパティ未設定: " + key);
    config[key] = value;
  });
  return config;
}

// ============================================
// メイン関数
// ============================================
function registerSelectedProducts() {
  const scriptConfig = getScriptConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < PROFIT_SHEET_CONFIG.DATA_START_ROW) {
    showResult("エラー", "処理対象のデータがありません。");
    return;
  }

  // アクセストークンを取得
  let accessToken;
  try {
    accessToken = getAccessToken(scriptConfig);
  } catch (e) {
    showResult("認証エラー", "アクセストークン取得に失敗しました: " + e.message);
    return;
  }

  const dataRange = sheet.getRange(PROFIT_SHEET_CONFIG.DATA_START_ROW, 1, lastRow - PROFIT_SHEET_CONFIG.DATA_START_ROW + 1, PROFIT_SHEET_CONFIG.COLUMN.SKU);
  const data = dataRange.getValues();
  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const isChecked = row[PROFIT_SHEET_CONFIG.COLUMN.CHECKBOX - 1];
    if (isChecked !== true) continue;

    const rowNumber = i + PROFIT_SHEET_CONFIG.DATA_START_ROW;
    const asin = String(row[PROFIT_SHEET_CONFIG.COLUMN.ASIN - 1]).trim();
    const sku = String(row[PROFIT_SHEET_CONFIG.COLUMN.SKU - 1]).trim();
    const price = row[PROFIT_SHEET_CONFIG.COLUMN.PRICE - 1];

    if (!asin || !sku || !price || isNaN(price) || price <= 0) {
      const result = {
        row: rowNumber,
        sku: sku || "(未設定)",
        asin: asin || "(未設定)",
        status: "エラー",
        errorType: "VALIDATION",
        message: "ASIN・SKU・価格を確認してください。",
      };
      results.push(result);
      updateResultCell(sheet, rowNumber, result);
      errorCount++;
      continue;
    }

    try {
      const skuExists = checkSkuExists(accessToken, sku, scriptConfig);
      if (skuExists) {
        const result = {
          row: rowNumber,
          sku,
          asin,
          status: "スキップ",
          errorType: "SKU_EXISTS",
          message: "SKU「" + sku + "」は既に登録済みのためスキップしました",
        };
        results.push(result);
        updateResultCell(sheet, rowNumber, result);
        copySkuToColumn(sheet, rowNumber, sku);
        errorCount++;
        continue;
      }
    } catch (e) {
      Logger.log("SKU存在チェックエラー: " + e.message);
    }

    try {
      const response = putListing(accessToken, sku, asin, price, scriptConfig);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "成功",
        errorType: null,
        message: response.status || "FBA出品登録完了",
      };
      results.push(result);
      updateResultCell(sheet, rowNumber, result);
      copySkuToColumn(sheet, rowNumber, sku);
      successCount++;
    } catch (e) {
      const errorType = detectErrorType(e.message);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "エラー",
        errorType,
        message: e.message,
      };
      results.push(result);
      updateResultCell(sheet, rowNumber, result);
      errorCount++;
    }

    Utilities.sleep(1000); // API負荷抑制
  }

  if (results.length === 0) {
    showResult("情報", "チェックされた行がありません。");
    return;
  }

  showResultDialog(results, successCount, errorCount);
}

// ============================================
// アクセストークン取得
// ============================================
function getAccessToken(config) {
  const payload = {
    grant_type: "refresh_token",
    refresh_token: config.LWA_REFRESH_TOKEN,
    client_id: config.LWA_CLIENT_ID,
    client_secret: config.LWA_CLIENT_SECRET,
  };

  const options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: payload,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(config.LWA_TOKEN_ENDPOINT, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode !== 200) {
    throw new Error("トークン取得失敗 (HTTP " + statusCode + "): " + responseText);
  }

  const json = JSON.parse(responseText);
  if (!json.access_token) throw new Error("アクセストークンが応答に含まれていません");
  return json.access_token;
}

// ============================================
// SKU存在チェック
// ============================================
function checkSkuExists(accessToken, sku, config) {
  const url = config.SP_API_ENDPOINT +
              "/listings/2021-08-01/items/" +
              config.SELLER_ID + "/" +
              encodeURIComponent(sku) +
              "?marketplaceIds=" + config.MARKETPLACE_ID;

  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Accept": "application/json"
    },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  return code === 200;
}

// ============================================
// 商品登録（PUT）
// ============================================
function putListing(accessToken, sku, asin, price, config) {
  const productType = getProductTypeByAsin(accessToken, asin, config);
  const url = config.SP_API_ENDPOINT +
              "/listings/2021-08-01/items/" +
              config.SELLER_ID + "/" +
              encodeURIComponent(sku) +
              "?marketplaceIds=" + config.MARKETPLACE_ID;

  const body = {
    productType: productType,
    requirements: "LISTING_OFFER_ONLY",
    attributes: {
      condition_type: [{ value: "new_new", marketplace_id: config.MARKETPLACE_ID }],
      purchasable_offer: [{
        marketplace_id: config.MARKETPLACE_ID,
        currency: "JPY",
        our_price: [{ schedule: [{ value_with_tax: price }] }]
      }],
      fulfillment_availability: [{ fulfillment_channel_code: "AMAZON_JP" }],
      merchant_suggested_asin: [{ value: asin, marketplace_id: config.MARKETPLACE_ID }],
      batteries_required: [{ value: false }],
      supplier_declared_dg_hz_regulation: [{ value: "not_applicable" }]
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Accept": "application/json"
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const bodyText = res.getContentText();
  if (status >= 400) throw new Error("登録失敗 (HTTP " + status + "): " + bodyText);
  return { status: "FBA出品登録完了" };
}
