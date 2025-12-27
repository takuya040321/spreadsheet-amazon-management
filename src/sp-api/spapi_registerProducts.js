/**
 * Amazon SP-API 商品登録スクリプト（リファクタリング版）
 * 
 * 主な変更点:
 * - チェックボックス基準から選択セル基準に変更
 * - X列による重複チェック機能を追加
 * - Y列によるスキップロジックを追加
 * - 登録前の承認フローを追加
 */

// ============================================
// 設定定義
// ============================================

/**
 * 重複チェック・スキップチェック用の列設定
 * 必要に応じて列番号を変更してください
 */
const DUPLICATE_CHECK_CONFIG = {
  DUPLICATE_COLUMN: 24,  // X列: 重複チェック対象列
  SKIP_COLUMN: 25,       // Y列: スキップ判定列（値があればスキップ）
};

// ============================================
// プロパティから設定値を取得
// ============================================

function spapi_spapi_getScriptConfig() {
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
// 登録処理の実行（修正版 - 重複行へのY列コピー追加）
// ============================================

function spapi_spapi_executeRegistration(sheet, accessToken, scriptConfig, processableRows, analysisResult) {
  const results = [];
  
  for (const row of processableRows) {
    const { rowNumber, asin, sku, price, duplicateValue } = row;
    
    Logger.log("--- 処理開始: 行 " + rowNumber + " ---");
    
    // SKU存在チェック
    try {
      const skuExists = spapi_checkSkuExists(accessToken, sku, scriptConfig);
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
        spapi_updateResultCell(sheet, rowNumber, result);
        spapi_copySkuToColumn(sheet, rowNumber, sku);
        Logger.log("SKU存在のためスキップ: " + sku);
        continue;
      }
    } catch (e) {
      Logger.log("SKU存在チェックエラー (行 " + rowNumber + "): " + e.message);
    }
    
    // 商品登録処理
    try {
      const response = spapi_putListing(accessToken, sku, asin, price, scriptConfig);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "成功",
        errorType: null,
        message: response.status || "FBA出品登録完了",
      };
      results.push(result);
      spapi_updateResultCell(sheet, rowNumber, result);
      spapi_copySkuToColumn(sheet, rowNumber, sku);
      
      // Y列にX列の値をコピー（登録成功した行）
      spapi_copyValueToSkipColumn(sheet, rowNumber, duplicateValue);
      
      // 重複行にもY列をコピー
      spapi_copyValueToDuplicateRows(sheet, duplicateValue, analysisResult);
      
      Logger.log("登録成功: 行 " + rowNumber);
    } catch (e) {
      Logger.log("商品登録エラー (行 " + rowNumber + "): " + e.message);
      const errorType = spapi_detectErrorType(e.message);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "エラー",
        errorType,
        message: e.message,
      };
      results.push(result);
      spapi_updateResultCell(sheet, rowNumber, result);
    }
    
    Logger.log("--- 処理完了: 行 " + rowNumber + " ---");
    Utilities.sleep(1000);
  }
  
  return results;
}

// ============================================
// Y列（スキップ列）に値をコピー
// ============================================

/**
 * Y列にX列の値をコピーする
 * @param {Sheet} sheet - 対象シート
 * @param {number} rowNumber - 行番号
 * @param {string} value - コピーする値
 */
function spapi_spapi_copyValueToSkipColumn(sheet, rowNumber, value) {
  if (!value || value.trim() === "") {
    Logger.log("コピーする値が空のため、Y列コピーをスキップ: 行 " + rowNumber);
    return;
  }
  
  const skipColumn = DUPLICATE_CHECK_CONFIG.SKIP_COLUMN;
  sheet.getRange(rowNumber, skipColumn).setValue(value);
  Logger.log("Y列にコピー完了: 行 " + rowNumber + ", 値: " + value);
}

/**
 * 重複行のY列にもX列の値をコピーする
 * @param {Sheet} sheet - 対象シート
 * @param {string} duplicateValue - X列の値（重複キー）
 * @param {Object} analysisResult - 分析結果
 */
function spapi_spapi_copyValueToDuplicateRows(sheet, duplicateValue, analysisResult) {
  if (!duplicateValue || duplicateValue.trim() === "" || duplicateValue === "(空白)") {
    return;
  }
  
  // スキップされた重複行を取得
  const duplicateSkippedRows = analysisResult.skippedRows.filter(
    row => row.skipReason === "重複（X列）" && row.duplicateValue === duplicateValue
  );
  
  if (duplicateSkippedRows.length === 0) {
    return;
  }
  
  const skipColumn = DUPLICATE_CHECK_CONFIG.SKIP_COLUMN;
  
  duplicateSkippedRows.forEach(row => {
    sheet.getRange(row.rowNumber, skipColumn).setValue(duplicateValue);
    Logger.log("重複行のY列にコピー完了: 行 " + row.rowNumber + ", 値: " + duplicateValue);
  });
}

// ============================================
// メイン関数（修正版 - analysisResultを渡す）
// ============================================

function spapi_registerSelectedProducts() {
  const scriptConfig = spapi_getScriptConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 選択範囲から対象行を取得
  const targetRows = spapi_getTargetRowsFromSelection(sheet);
  if (targetRows.length === 0) {
    spapi_showResult("エラー", "セルを選択してください。データ開始行より上の行は処理対象外です。");
    return;
  }
  
  // 対象行のデータを取得
  const rowDataList = spapi_getRowDataList(sheet, targetRows);
  
  // 重複チェックとスキップ対象の抽出
  const analysisResult = spapi_analyzeTargetRows(rowDataList);
  
  // 処理対象がない場合は終了
  if (analysisResult.processableRows.length === 0) {
    spapi_showResult("情報", "処理対象の行がありません。\n（スキップ: " + analysisResult.skippedRows.length + " 行、バリデーションエラー: " + analysisResult.validationErrors.length + " 行）");
    return;
  }
  
  // 登録前の確認ダイアログ
  const isApproved = spapi_showApprovalDialog(analysisResult);
  if (!isApproved) {
    spapi_showResult("キャンセル", "処理がキャンセルされました。");
    return;
  }
  
  // アクセストークンを取得
  let accessToken;
  try {
    accessToken = spapi_getAccessToken(scriptConfig);
  } catch (e) {
    spapi_showResult("認証エラー", "アクセストークン取得に失敗しました: " + e.message);
    return;
  }
  
  // 登録処理を実行（analysisResultを追加で渡す）
  const results = spapi_executeRegistration(
    sheet,
    accessToken,
    scriptConfig,
    analysisResult.processableRows,
    analysisResult  // 追加
  );
  
  // 結果を表示
  const successCount = results.filter(r => r.status === "成功").length;
  const errorCount = results.filter(r => r.status !== "成功").length;
  
  if (results.length === 0) {
    spapi_showResult("情報", "処理対象の行がありません。");
    return;
  }
  
  spapi_showResultDialog(results, successCount, errorCount);
}

// ============================================
// 選択範囲から対象行を取得
// ============================================

/**
 * ユーザーが選択しているセルから対象行番号を抽出する
 * @param {Sheet} sheet - 対象シート
 * @returns {number[]} - 対象行番号の配列（重複なし、昇順）
 */
function spapi_spapi_getTargetRowsFromSelection(sheet) {
  const selection = sheet.getActiveRange();
  if (!selection) return [];
  
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  const targetRows = [];
  
  for (let i = 0; i < numRows; i++) {
    const rowNumber = startRow + i;
    if (rowNumber >= PROFIT_SHEET_CONFIG.DATA_START_ROW) {
      targetRows.push(rowNumber);
    }
  }
  
  return [...new Set(targetRows)].sort((a, b) => a - b);
}

// ============================================
// 行データの取得
// ============================================

/**
 * 対象行のデータを取得する
 * @param {Sheet} sheet - 対象シート
 * @param {number[]} targetRows - 対象行番号の配列
 * @returns {Object[]} - 行データオブジェクトの配列
 */
function spapi_spapi_getRowDataList(sheet, targetRows) {
  const lastColumn = Math.max(
    PROFIT_SHEET_CONFIG.COLUMN.SKU,
    DUPLICATE_CHECK_CONFIG.DUPLICATE_COLUMN,
    DUPLICATE_CHECK_CONFIG.SKIP_COLUMN
  );
  
  return targetRows.map(rowNumber => {
    const rowData = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
    return {
      rowNumber: rowNumber,
      asin: String(rowData[PROFIT_SHEET_CONFIG.COLUMN.ASIN - 1] || "").trim(),
      sku: String(rowData[PROFIT_SHEET_CONFIG.COLUMN.SKU - 1] || "").trim(),
      price: rowData[PROFIT_SHEET_CONFIG.COLUMN.PRICE - 1],
      duplicateValue: String(rowData[DUPLICATE_CHECK_CONFIG.DUPLICATE_COLUMN - 1] || "").trim(),
      skipValue: rowData[DUPLICATE_CHECK_CONFIG.SKIP_COLUMN - 1],
    };
  });
}

// ============================================
// 重複チェック・スキップ対象の分析
// ============================================

/**
 * 対象行の重複チェックとスキップ対象の抽出を行う
 * @param {Object[]} rowDataList - 行データオブジェクトの配列
 * @returns {Object} - 分析結果
 */
function spapi_spapi_analyzeTargetRows(rowDataList) {
  // X列の値でグループ化して重複を検出
  const duplicateGroups = spapi_groupByDuplicateValue(rowDataList);
  const duplicateValues = new Set();
  
  Object.entries(duplicateGroups).forEach(([value, rows]) => {
    if (rows.length > 1 && value !== "(空白)") {
      duplicateValues.add(value);
    }
  });
  
  // 重複行とスキップ対象を分類
  const skippedRows = [];
  const validationErrors = [];
  const processableRows = [];
  
  rowDataList.forEach(row => {
    // Y列に値がある場合はスキップ
    if (spapi_hasSkipValue(row.skipValue)) {
      skippedRows.push({ ...row, skipReason: "Y列に値あり" });
      return;
    }
    
    // 重複している場合はスキップ（同じ値の2行目以降）
    if (duplicateValues.has(row.duplicateValue)) {
      const group = duplicateGroups[row.duplicateValue];
      if (group.indexOf(row) > 0) {
        skippedRows.push({ ...row, skipReason: "重複（X列）" });
        return;
      }
    }
    
    // バリデーションチェック
    const validation = spapi_validateRowData(row);
    if (!validation.isValid) {
      validationErrors.push({ ...row, validationError: validation.message });
      return;
    }
    
    processableRows.push(row);
  });
  
  return {
    totalSelected: rowDataList.length,
    duplicateValues: duplicateValues,
    skippedRows: skippedRows,
    validationErrors: validationErrors,
    processableRows: processableRows,
  };
}

/**
 * X列の値でグループ化する
 * @param {Object[]} rowDataList - 行データオブジェクトの配列
 * @returns {Object} - 値をキーとしたグループ
 */
function spapi_spapi_groupByDuplicateValue(rowDataList) {
  const groups = {};
  rowDataList.forEach(row => {
    const key = row.duplicateValue || "(空白)";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  });
  return groups;
}

/**
 * Y列にスキップ対象の値があるか判定する
 * @param {*} value - Y列の値
 * @returns {boolean} - スキップ対象かどうか
 */
function spapi_spapi_hasSkipValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

/**
 * 行データのバリデーションを行う
 * @param {Object} row - 行データオブジェクト
 * @returns {Object} - バリデーション結果
 */
function spapi_spapi_validateRowData(row) {
  if (!row.asin) {
    return { isValid: false, message: "ASINが未設定です" };
  }
  if (!row.sku) {
    return { isValid: false, message: "SKUが未設定です" };
  }
  if (!row.price || isNaN(row.price) || row.price <= 0) {
    return { isValid: false, message: "価格が無効です" };
  }
  return { isValid: true, message: "" };
}

// ============================================
// 承認ダイアログ
// ============================================

/**
 * 登録前の確認ダイアログを表示する
 * @param {Object} analysisResult - 分析結果
 * @returns {boolean} - ユーザーが承認したかどうか
 */
function spapi_spapi_showApprovalDialog(analysisResult) {
  const { totalSelected, skippedRows, validationErrors, processableRows } = analysisResult;
  
  let message = "選択: " + totalSelected + " 行\n";
  message += "登録対象: " + processableRows.length + " 行\n";
  
  if (skippedRows.length > 0) {
    message += "スキップ: " + skippedRows.length + " 行\n";
  }
  if (validationErrors.length > 0) {
    message += "エラー: " + validationErrors.length + " 行\n";
  }
  
  message += "\nこの内容で登録処理を進めますか？";
  
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert("登録確認", message, ui.ButtonSet.YES_NO);
  
  return response === ui.Button.YES;
}

// ============================================
// 登録処理の実行
// ============================================

/**
 * 登録処理を実行する
 * @param {Sheet} sheet - 対象シート
 * @param {string} accessToken - アクセストークン
 * @param {Object} scriptConfig - スクリプト設定
 * @param {Object[]} processableRows - 処理対象行の配列
 * @returns {Object[]} - 処理結果の配列
 */
function spapi_spapi_executeRegistration(sheet, accessToken, scriptConfig, processableRows) {
  const results = [];
  
  for (const row of processableRows) {
    const { rowNumber, asin, sku, price } = row;
    
    // SKU存在チェック
    try {
      const skuExists = spapi_checkSkuExists(accessToken, sku, scriptConfig);
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
        spapi_updateResultCell(sheet, rowNumber, result);
        spapi_copySkuToColumn(sheet, rowNumber, sku);
        continue;
      }
    } catch (e) {
      Logger.log("SKU存在チェックエラー (行 " + rowNumber + "): " + e.message);
    }
    
    // 商品登録処理
    try {
      const response = spapi_putListing(accessToken, sku, asin, price, scriptConfig);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "成功",
        errorType: null,
        message: response.status || "FBA出品登録完了",
      };
      results.push(result);
      spapi_updateResultCell(sheet, rowNumber, result);
      spapi_copySkuToColumn(sheet, rowNumber, sku);
    } catch (e) {
      const errorType = spapi_detectErrorType(e.message);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "エラー",
        errorType,
        message: e.message,
      };
      results.push(result);
      spapi_updateResultCell(sheet, rowNumber, result);
    }
    
    Utilities.sleep(1000);
  }
  
  return results;
}

// ============================================
// アクセストークン取得（修正版）
// ============================================

function spapi_spapi_getAccessToken(config) {
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
  
  Logger.log("トークン取得リクエスト送信: " + config.LWA_TOKEN_ENDPOINT);
  
  const response = UrlFetchApp.fetch(config.LWA_TOKEN_ENDPOINT, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  Logger.log("トークン取得レスポンス (HTTP " + statusCode + ")");
  
  if (statusCode !== 200) {
    throw new Error("トークン取得失敗 (HTTP " + statusCode + "): " + responseText);
  }
  
  const json = JSON.parse(responseText);
  
  if (!json.access_token) {
    Logger.log("レスポンス内容: " + responseText);
    throw new Error("アクセストークンが応答に含まれていません");
  }
  
  // トークンの存在確認（デバッグ用：先頭10文字のみ表示）
  Logger.log("アクセストークン取得成功: " + json.access_token.substring(0, 10) + "...");
  
  return json.access_token;
}

// ============================================
// SKU存在チェック（修正版）
// ============================================

function spapi_spapi_checkSkuExists(accessToken, sku, config) {
  // アクセストークンの検証
  if (!accessToken || accessToken.trim() === "") {
    throw new Error("アクセストークンが空です");
  }
  
  const url = config.SP_API_ENDPOINT +
              "/listings/2021-08-01/items/" +
              config.SELLER_ID + "/" +
              encodeURIComponent(sku) +
              "?marketplaceIds=" + config.MARKETPLACE_ID;
  
  Logger.log("SKU存在チェック: " + url);
  
  const headers = {
    "Authorization": "Bearer " + accessToken,
    "Accept": "application/json",
    "x-amz-access-token": accessToken  // 追加：SP-API用ヘッダー
  };
  
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });
  
  const code = res.getResponseCode();
  Logger.log("SKU存在チェック結果 (HTTP " + code + "): " + sku);
  
  return code === 200;
}

// ============================================
// 商品登録（PUT）（修正版）
// ============================================

function spapi_spapi_putListing(accessToken, sku, asin, price, config) {
  // アクセストークンの検証
  if (!accessToken || accessToken.trim() === "") {
    throw new Error("アクセストークンが空です");
  }
  
  // 商品タイプを取得
  Logger.log("商品タイプ取得開始: ASIN=" + asin);
  const productType = spapi_getProductTypeByAsin(accessToken, asin, config);
  Logger.log("商品タイプ取得完了: " + productType);
  
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
  
  Logger.log("商品登録リクエストボディ: " + JSON.stringify(body));
  Logger.log("商品登録URL: " + url);
  
  const options = {
    method: "put",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Accept": "application/json",
      "x-amz-access-token": accessToken
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };
  
  Logger.log("商品登録リクエスト送信中...");
  
  const res = UrlFetchApp.fetch(url, options);
  
  const status = res.getResponseCode();
  const bodyText = res.getContentText();
  
  Logger.log("商品登録レスポンス (HTTP " + status + "): " + bodyText);
  
  if (status >= 400) {
    throw new Error("登録失敗 (HTTP " + status + "): " + bodyText);
  }
  
  return { status: "FBA出品登録完了" };
}

// ============================================
// 商品タイプ取得（修正版）
// ============================================

function spapi_spapi_getProductTypeByAsin(accessToken, asin, config) {
  if (!accessToken || accessToken.trim() === "") {
    throw new Error("アクセストークンが空です");
  }
  
  // includedData に productTypes を追加
  const url = config.SP_API_ENDPOINT +
              "/catalog/2022-04-01/items/" +
              encodeURIComponent(asin) +
              "?marketplaceIds=" + config.MARKETPLACE_ID +
              "&includedData=summaries,productTypes";
  
  const headers = {
    "Authorization": "Bearer " + accessToken,
    "Accept": "application/json",
    "x-amz-access-token": accessToken
  };
  
  Logger.log("商品タイプ取得URL: " + url);
  
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });
  
  const statusCode = res.getResponseCode();
  const bodyText = res.getContentText();
  
  Logger.log("商品タイプ取得レスポンス (HTTP " + statusCode + ")");
  
  if (statusCode !== 200) {
    throw new Error("商品タイプ取得失敗 (ASIN: " + asin + ", HTTP " + statusCode + "): " + bodyText);
  }
  
  const json = JSON.parse(bodyText);
  
  // productTypes から取得を試みる
  const productTypes = json.productTypes;
  if (productTypes && productTypes.length > 0) {
    // 対象マーケットプレイスの productType を探す
    const targetProductType = productTypes.find(pt => pt.marketplaceId === config.MARKETPLACE_ID);
    if (targetProductType && targetProductType.productType) {
      Logger.log("取得した商品タイプ (productTypes): " + targetProductType.productType);
      return targetProductType.productType;
    }
    // マーケットプレイス指定がなければ最初のものを使用
    if (productTypes[0] && productTypes[0].productType) {
      Logger.log("取得した商品タイプ (productTypes[0]): " + productTypes[0].productType);
      return productTypes[0].productType;
    }
  }
  
  // productTypes がない場合、summaries から取得を試みる（フォールバック）
  const summaries = json.summaries;
  if (summaries && summaries.length > 0) {
    const targetSummary = summaries.find(s => s.marketplaceId === config.MARKETPLACE_ID);
    if (targetSummary && targetSummary.productType) {
      Logger.log("取得した商品タイプ (summaries): " + targetSummary.productType);
      return targetSummary.productType;
    }
    if (summaries[0] && summaries[0].productType) {
      Logger.log("取得した商品タイプ (summaries[0]): " + summaries[0].productType);
      return summaries[0].productType;
    }
  }
  
  // どちらからも取得できない場合
  Logger.log("警告: productTypeが見つかりません");
  Logger.log("productTypes: " + JSON.stringify(productTypes));
  Logger.log("summaries: " + JSON.stringify(summaries).substring(0, 300));
  
  throw new Error("商品タイプが取得できません (ASIN: " + asin + ")");
}

// ============================================
// 商品登録（PUT）（修正版）
// ============================================

function spapi_spapi_putListing(accessToken, sku, asin, price, config) {
  if (!accessToken || accessToken.trim() === "") {
    throw new Error("アクセストークンが空です");
  }
  
  Logger.log("=== 商品登録開始 ===");
  Logger.log("SKU: " + sku + ", ASIN: " + asin + ", 価格: " + price);
  
  // 商品タイプを取得
  const productType = spapi_getProductTypeByAsin(accessToken, asin, config);
  Logger.log("商品タイプ取得完了: " + productType);
  
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
  
  Logger.log("商品登録URL: " + url);
  Logger.log("商品登録ボディ: " + JSON.stringify(body).substring(0, 500));
  
  const options = {
    method: "put",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Accept": "application/json",
      "x-amz-access-token": accessToken
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };
  
  Logger.log("商品登録リクエスト送信中...");
  
  const res = UrlFetchApp.fetch(url, options);
  
  const status = res.getResponseCode();
  const responseBody = res.getContentText();
  
  Logger.log("商品登録レスポンス (HTTP " + status + "): " + responseBody.substring(0, 500));
  
  if (status >= 400) {
    throw new Error("登録失敗 (HTTP " + status + "): " + responseBody);
  }
  
  Logger.log("=== 商品登録完了 ===");
  return { status: "FBA出品登録完了" };
}

// ============================================
// 登録処理の実行（修正版 - エラーログ強化）
// ============================================

function spapi_spapi_executeRegistration(sheet, accessToken, scriptConfig, processableRows) {
  const results = [];
  
  for (const row of processableRows) {
    const { rowNumber, asin, sku, price } = row;
    
    Logger.log("--- 処理開始: 行 " + rowNumber + " ---");
    
    // SKU存在チェック
    try {
      const skuExists = spapi_checkSkuExists(accessToken, sku, scriptConfig);
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
        spapi_updateResultCell(sheet, rowNumber, result);
        spapi_copySkuToColumn(sheet, rowNumber, sku);
        Logger.log("SKU存在のためスキップ: " + sku);
        continue;
      }
    } catch (e) {
      Logger.log("SKU存在チェックエラー (行 " + rowNumber + "): " + e.message);
    }
    
    // 商品登録処理
    try {
      const response = spapi_putListing(accessToken, sku, asin, price, scriptConfig);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "成功",
        errorType: null,
        message: response.status || "FBA出品登録完了",
      };
      results.push(result);
      spapi_updateResultCell(sheet, rowNumber, result);
      spapi_copySkuToColumn(sheet, rowNumber, sku);
      Logger.log("登録成功: 行 " + rowNumber);
    } catch (e) {
      Logger.log("商品登録エラー (行 " + rowNumber + "): " + e.message);
      const errorType = spapi_detectErrorType(e.message);
      const result = {
        row: rowNumber,
        sku,
        asin,
        status: "エラー",
        errorType,
        message: e.message,
      };
      results.push(result);
      spapi_updateResultCell(sheet, rowNumber, result);
    }
    
    Logger.log("--- 処理完了: 行 " + rowNumber + " ---");
    Utilities.sleep(1000);
  }
  
  return results;
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * エラータイプを検出する
 * @param {string} message - エラーメッセージ
 * @returns {string} - エラータイプ
 */
function spapi_spapi_detectErrorType(message) {
  if (!message) return "UNKNOWN";
  
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("invalid_asin") || lowerMessage.includes("asin")) {
    return "INVALID_ASIN";
  }
  if (lowerMessage.includes("invalid_sku") || lowerMessage.includes("sku")) {
    return "INVALID_SKU";
  }
  if (lowerMessage.includes("price")) {
    return "INVALID_PRICE";
  }
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("403")) {
    return "UNAUTHORIZED";
  }
  if (lowerMessage.includes("throttl") || lowerMessage.includes("429")) {
    return "THROTTLED";
  }
  if (lowerMessage.includes("product_type") || lowerMessage.includes("producttype")) {
    return "INVALID_PRODUCT_TYPE";
  }
  
  return "UNKNOWN";
}

/**
 * 結果ダイアログを表示する
 * @param {string} title - タイトル
 * @param {string} message - メッセージ
 */
function spapi_spapi_showResult(title, message) {
  const ui = SpreadsheetApp.getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
}

/**
 * 詳細結果ダイアログを表示する
 * @param {Object[]} results - 処理結果の配列
 * @param {number} successCount - 成功件数
 * @param {number} errorCount - エラー件数
 */
function spapi_spapi_showResultDialog(results, successCount, errorCount) {
  let message = "処理が完了しました。\n\n";
  message += "成功: " + successCount + " 件\n";
  message += "エラー/スキップ: " + errorCount + " 件\n\n";
  
  message += "【詳細】\n";
  results.forEach(result => {
    const statusIcon = result.status === "成功" ? "✓" : result.status === "スキップ" ? "→" : "✗";
    message += statusIcon + " 行 " + result.row + ": " + result.status;
    if (result.sku) {
      message += " (SKU: " + result.sku + ")";
    }
    if (result.status !== "成功" && result.message) {
      message += "\n   " + result.message;
    }
    message += "\n";
  });
  
  const ui = SpreadsheetApp.getUi();
  ui.alert("登録結果", message, ui.ButtonSet.OK);
}

/**
 * 結果セルを更新する
 * @param {Sheet} sheet - 対象シート
 * @param {number} rowNumber - 行番号
 * @param {Object} result - 処理結果
 */
function spapi_spapi_updateResultCell(sheet, rowNumber, result) {
  // 結果列が定義されている場合のみ更新
  if (!PROFIT_SHEET_CONFIG.COLUMN.RESULT) {
    Logger.log("結果列が未定義のため、セル更新をスキップ: 行 " + rowNumber);
    return;
  }
  
  const resultColumn = PROFIT_SHEET_CONFIG.COLUMN.RESULT;
  const cell = sheet.getRange(rowNumber, resultColumn);
  
  let displayText = result.status;
  if (result.message && result.status !== "成功") {
    displayText += ": " + result.message.substring(0, 50);
    if (result.message.length > 50) {
      displayText += "...";
    }
  }
  
  cell.setValue(displayText);
  
  // 背景色を設定
  if (result.status === "成功") {
    cell.setBackground("#d4edda");  // 緑
  } else if (result.status === "スキップ") {
    cell.setBackground("#fff3cd");  // 黄
  } else {
    cell.setBackground("#f8d7da");  // 赤
  }
}

/**
 * SKUを指定列にコピーする
 * @param {Sheet} sheet - 対象シート
 * @param {number} rowNumber - 行番号
 * @param {string} sku - SKU
 */
function spapi_spapi_copySkuToColumn(sheet, rowNumber, sku) {
  // SKUコピー先列が定義されている場合のみ実行
  if (!PROFIT_SHEET_CONFIG.COLUMN.SKU_COPY) {
    Logger.log("SKUコピー先列が未定義のため、コピーをスキップ: 行 " + rowNumber);
    return;
  }
  
  const skuCopyColumn = PROFIT_SHEET_CONFIG.COLUMN.SKU_COPY;
  sheet.getRange(rowNumber, skuCopyColumn).setValue(sku);
}