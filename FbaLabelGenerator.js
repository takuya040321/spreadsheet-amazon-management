/**
 * メイン関数: 選択行からFBA商品ラベルを生成
 */
function generateFbaLabelsFromSelection() {
  try {
    // 1. 選択範囲からSKUを取得
    const skuData = getSkusFromSelection();
    
    if (!skuData || skuData.length === 0) {
      showAlert("エラー", "SKUが見つかりません。\nY列にSKUが入力されている行を選択してください。");
      return;
    }
    
    // 2. SKU集計
    const skuSummary = aggregateSkus(skuData);
    
    // 3. SP-APIでSKU情報取得
    showMessage("処理中", "Amazon SP-APIからSKU情報を取得しています...");
    const skuDetails = fetchSkuDetailsFromSpApi(Object.keys(skuSummary));
    
    // 4. 未登録SKUチェック
    const unregisteredSkus = checkUnregisteredSkus(skuSummary, skuDetails);
    if (unregisteredSkus.length > 0) {
      showAlert(
        "未登録SKUエラー", 
        "以下のSKUが登録されていません:\n\n" + unregisteredSkus.join("\n") + 
        "\n\n処理を中止しました。"
      );
      return;
    }
    
    // 5. 確認ダイアログ表示
    const confirmMessage = createConfirmationMessage(skuSummary, skuDetails);
    const response = showConfirmDialog("ラベル生成確認", confirmMessage);
    
    if (response !== "yes") {
      showMessage("キャンセル", "処理をキャンセルしました。");
      return;
    }
    
    // 6. ラベルデータ作成
    const labelData = createLabelData(skuSummary, skuDetails);
    
    // 7. HTMLでラベル表示
    showLabelHtml(labelData);
    
  } catch (error) {
    showAlert("エラー", "処理中にエラーが発生しました:\n" + error.toString());
    Logger.log("Error in generateFbaLabelsFromSelection: " + error);
  }
}

/**
 * 選択範囲からSKUを取得
 * @return {Array<string>} SKUの配列
 */
function getSkusFromSelection() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const selection = sheet.getActiveRange();
  
  if (!selection) {
    return [];
  }
  
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  const skus = [];
  
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    
    // ヘッダー行はスキップ
    if (row <= PRODUCT_MANAGEMENT_CONFIG.DATA_START_ROW - 1) {
      continue;
    }
    
    const sku = sheet.getRange(row, PRODUCT_MANAGEMENT_CONFIG.COLUMN.SKU_COPY).getValue();
    
    if (sku && sku.toString().trim() !== "") {
      skus.push(sku.toString().trim());
    }
  }
  
  return skus;
}

/**
 * SKUを集計（種類と個数）
 * @param {Array<string>} skus - SKUの配列
 * @return {Object} SKUごとの個数 {sku: count}
 */
function aggregateSkus(skus) {
  const summary = {};
  
  skus.forEach(sku => {
    if (summary[sku]) {
      summary[sku]++;
    } else {
      summary[sku] = 1;
    }
  });
  
  return summary;
}

/**
 * SP-APIからSKU詳細情報を取得
 * @param {Array<string>} skus - SKUの配列
 * @return {Object} SKU詳細情報 {sku: {fnsku, productName, asin}}
 */
function fetchSkuDetailsFromSpApi(skus) {
  const accessToken = getSpApiAccessToken();
  const skuDetails = {};
  
  // FBA Inventory APIは最大50件まで一度に取得可能
  const batchSize = 50;
  
  for (let i = 0; i < skus.length; i += batchSize) {
    const batch = skus.slice(i, i + batchSize);
    const batchDetails = fetchInventorySummaries(accessToken, batch);
    Object.assign(skuDetails, batchDetails);
  }
  
  return skuDetails;
}

/**
 * SP-API Access Token取得
 * @return {string} アクセストークン
 */
function getSpApiAccessToken() {
  // スクリプトプロパティからLWAトークンエンドポイント等の情報を取得
  const scriptProperties = PropertiesService.getScriptProperties();
  const lwaTokenEndpoint = scriptProperties.getProperty("LWA_TOKEN_ENDPOINT");
  const lwaRefreshToken = scriptProperties.getProperty("LWA_REFRESH_TOKEN");
  const lwaClientId = scriptProperties.getProperty("LWA_CLIENT_ID");
  const lwaClientSecret = scriptProperties.getProperty("LWA_CLIENT_SECRET");

  const payload = {
    grant_type: "refresh_token",
    refresh_token: lwaRefreshToken,
    client_id: lwaClientId,
    client_secret: lwaClientSecret
  };

  const options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: payload,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(lwaTokenEndpoint, options);
  const result = JSON.parse(response.getContentText());

  if (!result.access_token) {
    throw new Error("Access Token取得失敗: " + response.getContentText());
  }

  return result.access_token;
}

/**
 * FBA Inventory APIでSKU情報取得
 * @param {string} accessToken - SP-API アクセストークン
 * @param {Array<string>} skus - SKUの配列
 * @return {Object} SKU詳細情報
 */
function fetchInventorySummaries(accessToken, skus) {
  const skuDetails = {};
  
  // スクリプトプロパティからSP-API設定を取得
  const scriptProperties = PropertiesService.getScriptProperties();
  const spApiEndpoint = scriptProperties.getProperty("SP_API_ENDPOINT");
  const marketplaceId = scriptProperties.getProperty("MARKETPLACE_ID");
  
  // sellerSkusパラメータを構築
  const sellerSkusParam = skus.map(sku => "sellerSkus=" + encodeURIComponent(sku)).join("&");
  
  const url = spApiEndpoint + 
    "/fba/inventory/v1/summaries?" +
    "details=true&" +
    "marketplaceIds=" + marketplaceId + "&" +
    sellerSkusParam;
  
  const options = {
    method: "get",
    headers: {
      "x-amz-access-token": accessToken,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  if (statusCode !== 200) {
    Logger.log("API Error: " + responseText);
    throw new Error("SP-API呼び出しエラー (Status: " + statusCode + ")");
  }
  
  const data = JSON.parse(responseText);
  
  if (data.payload && data.payload.inventorySummaries) {
    data.payload.inventorySummaries.forEach(item => {
      skuDetails[item.sellerSku] = {
        fnsku: item.fnSku,
        productName: item.productName || "商品名なし",
        asin: item.asin
      };
    });
  }
  
  return skuDetails;
}

/**
 * 未登録SKUをチェック
 * @param {Object} skuSummary - SKU集計 {sku: count}
 * @param {Object} skuDetails - SKU詳細情報
 * @return {Array<string>} 未登録SKUの配列
 */
function checkUnregisteredSkus(skuSummary, skuDetails) {
  const unregistered = [];
  
  Object.keys(skuSummary).forEach(sku => {
    if (!skuDetails[sku]) {
      unregistered.push(sku);
    }
  });
  
  return unregistered;
}

/**
 * 確認メッセージ作成
 * @param {Object} skuSummary - SKU集計
 * @param {Object} skuDetails - SKU詳細情報
 * @return {string} 確認メッセージ
 */
function createConfirmationMessage(skuSummary, skuDetails) {
  let message = "以下のラベルを生成します:\n\n";
  message += "【SKU一覧】\n";
  
  let totalCount = 0;
  Object.keys(skuSummary).forEach(sku => {
    const count = skuSummary[sku];
    const details = skuDetails[sku];
    totalCount += count;
    
    message += `・${sku}\n`;
    message += `  商品名: ${details.productName}\n`;
    message += `  FNSKU: ${details.fnsku}\n`;
    message += `  個数: ${count}枚\n\n`;
  });
  
  message += `合計: ${Object.keys(skuSummary).length}種類 ${totalCount}枚\n\n`;
  message += "ラベルを生成しますか？";
  
  return message;
}

/**
 * ラベルデータ作成
 * @param {Object} skuSummary - SKU集計
 * @param {Object} skuDetails - SKU詳細情報
 * @return {Array<Object>} ラベルデータ配列
 */
function createLabelData(skuSummary, skuDetails) {
  const labelData = [];
  
  Object.keys(skuSummary).forEach(sku => {
    const count = skuSummary[sku];
    const details = skuDetails[sku];
    
    // 個数分のラベルを追加
    for (let i = 0; i < count; i++) {
      labelData.push({
        fnsku: details.fnsku,
        productName: details.productName,
        asin: details.asin
      });
    }
  });
  
  return labelData;
}

/**
 * HTMLでラベル表示
 * @param {Array<Object>} labelData - ラベルデータ
 */
function showLabelHtml(labelData) {
  const template = HtmlService.createTemplateFromFile("FbaLabelView");
  template.labelData = JSON.stringify(labelData);
  
  const html = template.evaluate()
    .setWidth(900)
    .setHeight(650)
    .setTitle("FBA商品ラベル - 印刷用");
  
  SpreadsheetApp.getUi().showModalDialog(html, "FBA商品ラベル");
}

/**
 * アラート表示
 * @param {string} title - タイトル
 * @param {string} message - メッセージ
 */
function showAlert(title, message) {
  SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * メッセージ表示（トースト）
 * @param {string} title - タイトル
 * @param {string} message - メッセージ
 */
function showMessage(title, message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, title, 3);
}

/**
 * 確認ダイアログ表示
 * @param {string} title - タイトル
 * @param {string} message - メッセージ
 * @return {string} "yes" または "no"
 */
function showConfirmDialog(title, message) {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(title, message, ui.ButtonSet.YES_NO);
  
  return result === ui.Button.YES ? "yes" : "no";
}
