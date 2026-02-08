/**
 * FbaShipment.gs
 * FBA納品プラン作成のメイン処理
 * 
 * 使用するScript Properties:
 * - LWA_CLIENT_ID: LWAクライアントID
 * - LWA_CLIENT_SECRET: LWAクライアントシークレット
 * - LWA_REFRESH_TOKEN: LWAリフレッシュトークン
 * - SELLER_ID: セラーID
 * - MARKETPLACE_ID: マーケットプレイスID（日本: A1VC38T7YXB528）
 * - SP_API_ENDPOINT: SP-APIエンドポイント（例: https://sellingpartnerapi-fe.amazon.com）
 * - LWA_TOKEN_ENDPOINT: LWAトークンエンドポイント（https://api.amazon.com/auth/o2/token）
 * - SHIP_FROM_NAME: 発送者名
 * - SHIP_FROM_ADDRESS_LINE1: 住所1
 * - SHIP_FROM_ADDRESS_LINE2: 住所2（任意）
 * - SHIP_FROM_CITY: 市区町村
 * - SHIP_FROM_STATE: 都道府県
 * - SHIP_FROM_POSTAL_CODE: 郵便番号
 * - SHIP_FROM_COUNTRY_CODE: 国コード（JP）
 * - SHIP_FROM_PHONE: 電話番号
 */

// ===========================================
// メイン処理
// ===========================================

/**
 * メイン処理: FBA納品プランを作成する
 * メニューから呼び出されるエントリーポイント
 */
function spapi_createShipmentPlan() {
  try {
    const skuCounts = spapi_getSelectedSkus_();

    if (Object.keys(skuCounts).length === 0) {
      Browser.msgBox("エラー", "選択された行にSKUが見つかりません。\\nY列にSKUが入力されているか確認してください。", Browser.Buttons.OK);
      return;
    }

    const confirmed = spapi_confirmSkus_(skuCounts);
    if (!confirmed) {
      return;
    }

    const result = spapi_createFbaInboundPlan_(skuCounts);
    spapi_showResult_(result);

  } catch (error) {
    console.error("FBA納品プラン作成エラー:", error.message);
    Browser.msgBox("エラー", "処理中にエラーが発生しました:\\n" + error.message, Browser.Buttons.OK);
  }
}

// ===========================================
// SKU取得処理
// ===========================================

/**
 * 選択範囲の各行からY列（25列目）のSKUを取得し、集計する
 * @returns {Object} SKUをキー、個数を値とするオブジェクト
 */
function spapi_getSelectedSkus_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rangeList = sheet.getActiveRangeList();

  if (!rangeList) {
    console.log("選択範囲がありません");
    return {};
  }

  const ranges = rangeList.getRanges();
  const SKU_COLUMN = 25;

  const selectedRows = new Set();
  for (const range of ranges) {
    const rangeStartRow = range.getRow();
    const rangeNumRows = range.getNumRows();
    for (let i = 0; i < rangeNumRows; i++) {
      const rowNum = rangeStartRow + i;
      if (!sheet.isRowHiddenByFilter(rowNum)) {
        selectedRows.add(rowNum);
      }
    }
  }

  if (selectedRows.size === 0) {
    return {};
  }

  const rowArray = Array.from(selectedRows);
  const minRow = Math.min(...rowArray);
  const maxRow = Math.max(...rowArray);
  const skuValues = sheet.getRange(minRow, SKU_COLUMN, maxRow - minRow + 1, 1).getValues();

  const skuCounts = {};
  for (const rowNum of rowArray) {
    const sku = skuValues[rowNum - minRow][0];
    if (sku && String(sku).trim() !== "") {
      const skuStr = String(sku).trim();
      skuCounts[skuStr] = (skuCounts[skuStr] || 0) + 1;
    }
  }

  console.log("SKU集計完了:", JSON.stringify(skuCounts));
  return skuCounts;
}

// ===========================================
// ユーザー確認ダイアログ
// ===========================================

/**
 * SKU一覧を表示し、ユーザーに確認を求める
 * @param {Object} skuCounts - SKUと個数のマップ
 * @returns {boolean} ユーザーが「はい」を選択した場合true
 */
function spapi_confirmSkus_(skuCounts) {
  // SKU一覧を文字列で整形
  let message = "以下の内容でFBA納品プランを作成しますか？\\n\\n";
  message += "【SKU一覧】\\n";
  message += "------------------------\\n";
  
  let totalCount = 0;
  for (const [sku, count] of Object.entries(skuCounts)) {
    message += `${sku}: ${count}個\\n`;
    totalCount += count;
  }
  
  message += "------------------------\\n";
  message += `合計: ${Object.keys(skuCounts).length}種類 / ${totalCount}個\\n`;
  
  const response = Browser.msgBox("FBA納品プラン作成確認", message, Browser.Buttons.YES_NO);
  return response === "yes";
}

// ===========================================
// SP-API連携処理
// ===========================================

/**
 * SP-APIのアクセストークンを取得する
 * @returns {string} アクセストークン
 */
function spapi_getAccessToken_() {
  return utils_getSpApiAccessToken();
}

/**
 * 出荷元住所をScript Propertiesから取得する
 * @returns {Object} 住所オブジェクト
 */
function spapi_getSourceAddress_() {
  return utils_getSourceAddress();
}

/**
 * SP-API Fulfillment Inbound API 2024-03-20を使用して納品プランを作成する
 * @param {Object} skuCounts - SKUと個数のマップ
 * @returns {Object} API レスポンス（inboundPlanId等を含む）
 */
function spapi_createFbaInboundPlan_(skuCounts) {
  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty("SP_API_ENDPOINT") || "https://sellingpartnerapi-fe.amazon.com";
  const marketplaceId = props.getProperty("MARKETPLACE_ID");
  
  if (!marketplaceId) {
    throw new Error("MARKETPLACE_IDがScript Propertiesに設定されていません。");
  }
  
  // アクセストークンを取得
  const accessToken = spapi_getAccessToken_();
  
  // 出荷元住所を取得
  const sourceAddress = spapi_getSourceAddress_();
  
  // SKU一覧を取得
  const mskus = Object.keys(skuCounts);
  
  spapi_setPrepDetails_(endpoint, accessToken, marketplaceId, mskus);
  Utilities.sleep(1000);
  
  // リクエストボディを構築
  // 3ヶ月後の日付を計算（消費期限用）
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + 3);
  const expiration = Utilities.formatDate(expirationDate, "Asia/Tokyo", "yyyy-MM-dd");
  
  // 納品プラン名を生成（日時を含める）
  const now = new Date();
  const planName = Utilities.formatDate(now, "Asia/Tokyo", "yyyyMMdd_HHmmss") + "_GAS作成";
  
  // items配列を作成（各SKUと数量）
  const items = spapi_buildItemsArray_(skuCounts, expiration, {});
  
  const requestBody = {
    destinationMarketplaces: [marketplaceId],
    items: items,
    sourceAddress: sourceAddress,
    name: planName
  };
  
  const apiPath = "/inbound/fba/2024-03-20/inboundPlans";
  const url = endpoint + apiPath;
  
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-amz-access-token": accessToken,
      "Accept": "application/json"
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
  
  let response = UrlFetchApp.fetch(url, options);
  let responseCode = response.getResponseCode();
  let responseBody = response.getContentText();
  
  // prepOwnerエラーの場合、該当SKUをNONEにしてリトライ
  if (responseCode === 400) {
    const retryResult = spapi_handlePrepOwnerError_(responseBody, skuCounts, expiration, endpoint, apiPath, accessToken, marketplaceId, sourceAddress, planName);
    if (retryResult) {
      return retryResult;
    }
  }
  
  if (responseCode !== 200 && responseCode !== 202) {
    // エラーレスポンスをパース
    let errorMessage = responseBody;
    try {
      const errorData = JSON.parse(responseBody);
      if (errorData.errors && errorData.errors.length > 0) {
        errorMessage = errorData.errors.map(e => `${e.code}: ${e.message}`).join("\\n");
      }
    } catch (e) {
      // JSONパースに失敗した場合はそのまま使用
    }
    throw new Error("SP-APIエラー (HTTP " + responseCode + "):\\n" + errorMessage);
  }
  
  return JSON.parse(responseBody);
}

// ===========================================
// 梱包カテゴリー設定処理
// ===========================================

/**
 * setPrepDetails APIを呼び出して、SKUの梱包カテゴリーを設定する
 * @param {string} endpoint - SP-APIエンドポイント
 * @param {string} accessToken - アクセストークン
 * @param {string} marketplaceId - マーケットプレイスID
 * @param {Array} mskus - 設定するSKUの配列
 */
function spapi_setPrepDetails_(endpoint, accessToken, marketplaceId, mskus) {
  const apiPath = "/inbound/fba/2024-03-20/items/prepDetails";
  const url = endpoint + apiPath;
  
  // リクエストボディを構築
  // デフォルトは prepCategory: "NONE", prepTypes: ["ITEM_NO_PREP"]
  const mskuPrepDetails = mskus.map(msku => ({
    msku: msku,
    prepCategory: "NONE",
    prepTypes: ["ITEM_NO_PREP"]
  }));
  
  const requestBody = {
    marketplaceId: marketplaceId,
    mskuPrepDetails: mskuPrepDetails
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-amz-access-token": accessToken,
      "Accept": "application/json"
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode !== 200 && responseCode !== 202) {
    console.warn("setPrepDetails APIエラー:", responseBody);
  }
}

/**
 * items配列を構築する
 * @param {Object} skuCounts - SKUと個数のマップ
 * @param {string} expiration - 消費期限（yyyy-MM-dd形式）
 * @param {Object} prepOwnerOverrides - prepOwnerを上書きするSKUのマップ（SKU: "NONE"）
 * @returns {Array} items配列
 */
function spapi_buildItemsArray_(skuCounts, expiration, prepOwnerOverrides) {
  const items = [];
  for (const [msku, quantity] of Object.entries(skuCounts)) {
    const prepOwner = prepOwnerOverrides[msku] || "SELLER";
    items.push({
      msku: msku,
      quantity: quantity,
      prepOwner: prepOwner,
      labelOwner: "SELLER",
      expiration: expiration
    });
  }
  return items;
}

/**
 * prepOwnerエラーを解析し、該当SKUをNONEにしてリトライする
 * @param {string} responseBody - エラーレスポンス
 * @param {Object} skuCounts - SKUと個数のマップ
 * @param {string} expiration - 消費期限
 * @param {string} endpoint - APIエンドポイント
 * @param {string} apiPath - APIパス
 * @param {string} accessToken - アクセストークン
 * @param {string} marketplaceId - マーケットプレイスID
 * @param {Object} sourceAddress - 出荷元住所
 * @param {string} planName - 納品プラン名
 * @returns {Object|null} 成功時はAPIレスポンス、リトライ不要または失敗時はnull
 */
function spapi_handlePrepOwnerError_(responseBody, skuCounts, expiration, endpoint, apiPath, accessToken, marketplaceId, sourceAddress, planName) {
  try {
    const errorData = JSON.parse(responseBody);
    if (!errorData.errors || errorData.errors.length === 0) {
      return null;
    }
    
    // prepOwnerエラーのSKUを抽出
    const prepOwnerOverrides = {};
    let hasPrepOwnerError = false;
    
    for (const error of errorData.errors) {
      // エラーメッセージからSKUを抽出
      // 例: "ERROR: DHC-2511-0880-1312-1700-B00SY1A5F2 does not require prepOwner but SELLER was assigned"
      const match = error.message.match(/ERROR:\s*(\S+)\s+does not require prepOwner/);
      if (match) {
        prepOwnerOverrides[match[1]] = "NONE";
        hasPrepOwnerError = true;
      }
    }
    
    if (!hasPrepOwnerError) {
      return null;
    }
    
    // items配列を再構築
    const items = spapi_buildItemsArray_(skuCounts, expiration, prepOwnerOverrides);
    
    const requestBody = {
      destinationMarketplaces: [marketplaceId],
      items: items,
      sourceAddress: sourceAddress,
      name: planName
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-amz-access-token": accessToken,
        "Accept": "application/json"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const url = endpoint + apiPath;
    const response = UrlFetchApp.fetch(url, options);
    const retryResponseCode = response.getResponseCode();
    const retryResponseBody = response.getContentText();
    
    if (retryResponseCode === 200 || retryResponseCode === 202) {
      return JSON.parse(retryResponseBody);
    }
    
    // リトライも失敗した場合はnullを返し、元のエラー処理に任せる
    return null;
    
  } catch (e) {
    console.error("リトライ処理中にエラー:", e.message);
    return null;
  }
}

/**
 * 処理結果を表示し、セラーセントラルを開く
 * @param {Object} result - SP-APIのレスポンス
 */
function spapi_showResult_(result) {
  // inboundPlanIdを取得
  const inboundPlanId = result.inboundPlanId;
  const operationId = result.operationId;
  
  if (!inboundPlanId) {
    throw new Error("納品プランIDが取得できませんでした。\\nレスポンス: " + JSON.stringify(result));
  }

  // セラーセントラルの納品プラン画面URL
  // 注意: 実際のURLはAmazonの仕様変更により異なる場合があります
  // 要相談: ログインが必要なため、自動遷移後に再ログインが求められる場合があります
  const sellerCentralUrl = "https://sellercentral.amazon.co.jp/fba/sendtoamazon/confirm_content_step?wf=" + encodeURIComponent(inboundPlanId);
  
  // 結果メッセージを作成
  let message = "FBA納品プランを作成しました！\\n\\n";
  message += "【納品プランID】\\n";
  message += inboundPlanId + "\\n\\n";
  
  if (operationId) {
    message += "【オペレーションID】\\n";
    message += operationId + "\\n\\n";
  }
  
  message += "【セラーセントラルURL】\\n";
  message += sellerCentralUrl + "\\n\\n";
  message += "「OK」を押すとセラーセントラルを開きます。";
  
  Browser.msgBox("FBA納品プラン作成完了", message, Browser.Buttons.OK);
  
  // セラーセントラルを新しいタブで開く
  // 注意: GASからブラウザの新しいタブを直接開くことはできないため、
  // HTMLダイアログを使用してリンクを提供する
  spapi_openUrlInNewTab_(sellerCentralUrl);
}

/**
 * URLを新しいタブで開くためのHTMLダイアログを表示する
 * @param {string} url - 開くURL
 */
function spapi_openUrlInNewTab_(url) {
  const html = HtmlService.createHtmlOutput(
    '<html><head><base target="_blank"></head><body>' +
    '<p>セラーセントラルを開いています...</p>' +
    '<p><a href="' + url + '" target="_blank" id="link">自動で開かない場合はこちらをクリック</a></p>' +
    '<script>' +
    'window.open("' + url + '", "_blank");' +
    'setTimeout(function(){ google.script.host.close(); }, 3000);' +
    '</script>' +
    '</body></html>'
  )
  .setWidth(400)
  .setHeight(150);
  
  SpreadsheetApp.getUi().showModalDialog(html, "セラーセントラルを開く");
}

// ===========================================
// テスト・デバッグ用関数
// ===========================================

/**
 * Script Propertiesの設定状況を確認する（デバッグ用）
 * メニューから直接実行可能
 */
function spapi_checkScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  const keys = [
    "LWA_CLIENT_ID",
    "LWA_CLIENT_SECRET",
    "LWA_REFRESH_TOKEN",
    "SELLER_ID",
    "MARKETPLACE_ID",
    "SP_API_ENDPOINT",
    "LWA_TOKEN_ENDPOINT",
    "SHIP_FROM_NAME",
    "SHIP_FROM_ADDRESS_LINE1",
    "SHIP_FROM_ADDRESS_LINE2",
    "SHIP_FROM_CITY",
    "SHIP_FROM_STATE",
    "SHIP_FROM_POSTAL_CODE",
    "SHIP_FROM_COUNTRY_CODE",
    "SHIP_FROM_PHONE"
  ];
  
  let message = "【Script Properties設定状況】\\n\\n";
  
  for (const key of keys) {
    const value = props.getProperty(key);
    const status = value ? "✓ 設定済み" : "✗ 未設定";
    const displayValue = value ? (key.includes("SECRET") || key.includes("TOKEN") ? "****" : value.substring(0, 20) + (value.length > 20 ? "..." : "")) : "-";
    message += `${key}: ${status}\\n  値: ${displayValue}\\n\\n`;
  }
  
  console.log(message.replace(/\\n/g, "\n"));
  Browser.msgBox("Script Properties確認", message, Browser.Buttons.OK);
}

/**
 * SP-API接続テスト（アクセストークン取得のみ）
 */
function spapi_testSpApiConnection() {
  try {
    console.log("=== SP-API接続テスト開始 ===");
    const accessToken = spapi_getAccessToken_();
    console.log("アクセストークン取得成功");
    Browser.msgBox("接続テスト成功", "SP-APIへの接続に成功しました。\\nアクセストークンを正常に取得できました。", Browser.Buttons.OK);
  } catch (error) {
    console.error("接続テスト失敗:", error.message);
    Browser.msgBox("接続テスト失敗", "SP-APIへの接続に失敗しました。\\n\\nエラー: " + error.message, Browser.Buttons.OK);
  }
}