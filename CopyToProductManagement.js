/**
 * スプレッドシート商品データコピースクリプト
 * 
 * 機能概要：
 * - A列のチェックボックスがONの行を対象
 * - B列の個数分だけ「商品管理」シートにデータをコピー
 * - コピー対象列：C列～O列、Y列
 * 
 * シート構成：
 * - 1行目：（任意）
 * - 2行目：ヘッダー行
 * - 3行目以降：データ行（チェックボックスは3行目から）
 */

// 定数定義
const DATA_START_ROW = 3;  // データ開始行（ヘッダーの次の行）
const TARGET_SHEET_NAME = "商品管理";

/**
 * メイン処理：チェックされた行のデータを商品管理シートにコピー
 */
function copyCheckedRowsToProductManagement() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getActiveSheet();
  
  // 「商品管理」シートの存在確認
  const targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);
  if (!targetSheet) {
    SpreadsheetApp.getUi().alert("エラー: 「" + TARGET_SHEET_NAME + "」シートが見つかりません。");
    Logger.log("エラー: 「" + TARGET_SHEET_NAME + "」シートが存在しません");
    return;
  }
  
  // ソースシートのデータ範囲を取得
  const lastRow = sourceSheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    SpreadsheetApp.getUi().alert("コピー対象のデータがありません。");
    Logger.log("データなし: ソースシートにデータ行がありません");
    return;
  }
  
  // データ行数を計算
  const dataRowCount = lastRow - DATA_START_ROW + 1;
  
  // A列（チェックボックス）とB列（個数）を取得（3行目から）
  const checkboxRange = sourceSheet.getRange(DATA_START_ROW, 1, dataRowCount, 1).getValues();
  const quantityRange = sourceSheet.getRange(DATA_START_ROW, 2, dataRowCount, 1).getValues();
  
  // C列～O列のデータを取得（列3から列15まで、13列分）
  const dataRangeCO = sourceSheet.getRange(DATA_START_ROW, 3, dataRowCount, 13).getValues();
  
  // Y列のデータを取得（列25）
  const dataRangeY = sourceSheet.getRange(DATA_START_ROW, 25, dataRowCount, 1).getValues();
  
  Logger.log("ソースシート: " + sourceSheet.getName());
  Logger.log("データ開始行: " + DATA_START_ROW);
  Logger.log("データ行数: " + dataRowCount);
  
  // コピー用データを格納する配列
  const rowsToCopyCO = [];  // C列～O列用
  const rowsToCopyY = [];   // Y列用
  const processedSourceRows = [];  // 処理したコピー元の行番号を記録
  let processedRows = 0;
  let skippedRows = 0;
  
  // チェックされた行を処理
  for (let i = 0; i < checkboxRange.length; i++) {
    const isChecked = checkboxRange[i][0];
    const quantity = quantityRange[i][0];
    const rowNumber = i + DATA_START_ROW; // 実際の行番号（3行目から）
    
    // チェックボックスがONの場合のみ処理
    if (isChecked === true) {
      // 個数のバリデーション
      const validQuantity = validateQuantity(quantity, rowNumber);
      
      if (validQuantity === null) {
        skippedRows++;
        continue;
      }
      
      // C列～O列のデータを取得
      const rowDataCO = dataRangeCO[i];
      
      // Y列のデータを取得
      const rowDataY = dataRangeY[i][0];
      
      // 空行チェック（C列～O列がすべて空かどうか）
      const isEmptyRow = rowDataCO.every(cell => cell === "" || cell === null);
      if (isEmptyRow) {
        Logger.log("行 " + rowNumber + ": 空行のためスキップ");
        skippedRows++;
        continue;
      }
      
      // 個数分のデータを配列に追加
      for (let j = 0; j < validQuantity; j++) {
        // C列～O列のデータ（13列分）
        rowsToCopyCO.push(rowDataCO.slice());
        
        // Y列のデータ（1列分）
        rowsToCopyY.push([rowDataY]);
      }
      
      // 処理した行番号を記録
      processedSourceRows.push(rowNumber);
      
      processedRows++;
      Logger.log("行 " + rowNumber + ": " + validQuantity + "行分コピー対象に追加");
    }
  }
  
  // コピーするデータがない場合
  if (rowsToCopyCO.length === 0) {
    SpreadsheetApp.getUi().alert("コピー対象のデータがありません。\nチェックボックスを確認してください。");
    Logger.log("コピー対象なし");
    return;
  }
  
  // 商品管理シートの最終行を取得
  const targetLastRow = getLastRowWithData(targetSheet);
  const insertStartRow = targetLastRow + 1;
  
  Logger.log("商品管理シートの最終行: " + targetLastRow);
  Logger.log("挿入開始行: " + insertStartRow);
  Logger.log("挿入行数: " + rowsToCopyCO.length);
  
  // 一括書き込み（C列～O列とY列のみを書き込み、他の列は影響を与えない）
  try {
    // C列～O列に書き込み（列3から13列分）
    const targetRangeCO = targetSheet.getRange(insertStartRow, 3, rowsToCopyCO.length, 13);
    targetRangeCO.setValues(rowsToCopyCO);
    
    // Y列に書き込み（列25）
    const targetRangeY = targetSheet.getRange(insertStartRow, 25, rowsToCopyY.length, 1);
    targetRangeY.setValues(rowsToCopyY);
    
    Logger.log("コピー完了: " + rowsToCopyCO.length + "行");
    
    // コピー元のデータを削除（C列～O列、Y列）
    for (const rowNumber of processedSourceRows) {
      // C列～O列をクリア（列3から13列分）
      sourceSheet.getRange(rowNumber, 3, 1, 13).clearContent();
      
      // Y列をクリア（列25）
      sourceSheet.getRange(rowNumber, 25, 1, 1).clearContent();
      
      Logger.log("コピー元 行 " + rowNumber + ": データ削除完了");
    }
    
    // 処理完了メッセージ
    const message = rowsToCopyCO.length + "行分のデータをコピーしました。\n" +
                    "（チェック行数: " + processedRows + "行、スキップ: " + skippedRows + "行）\n" +
                    "コピー元のデータは削除されました。";
    SpreadsheetApp.getUi().alert(message);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    Logger.log("書き込みエラー: " + error.message);
  }
}


/**
 * 個数の値をバリデーション
 * @param {any} value - 検証する値
 * @param {number} rowNumber - 行番号（ログ用）
 * @returns {number|null} - 有効な個数、または無効な場合はnull
 */
function validateQuantity(value, rowNumber) {
  // 空、null、undefinedチェック
  if (value === "" || value === null || value === undefined) {
    Logger.log("行 " + rowNumber + ": 個数が空のためスキップ");
    return null;
  }
  
  // 数値変換
  const num = Number(value);
  
  // NaNチェック
  if (isNaN(num)) {
    Logger.log("行 " + rowNumber + ": 個数が数値ではありません（値: " + value + "）");
    return null;
  }
  
  // 整数変換
  const intNum = Math.floor(num);
  
  // 0以下チェック
  if (intNum <= 0) {
    Logger.log("行 " + rowNumber + ": 個数が0以下のためスキップ（値: " + intNum + "）");
    return null;
  }
  
  // 上限チェック（安全のため1000を上限とする）
  if (intNum > 1000) {
    Logger.log("行 " + rowNumber + ": 個数が上限（1000）を超えています（値: " + intNum + "）");
    return null;
  }
  
  return intNum;
}


/**
 * シートのC列の最終行を取得
 * @param {Sheet} sheet - 対象シート
 * @returns {number} - 最終行番号（データなしの場合は0）
 */
function getLastRowWithData(sheet) {
  const lastRow = sheet.getLastRow();
  
  // シートにデータがない場合
  if (lastRow === 0) {
    return 0;
  }
  
  // C列（3列目）のデータを取得
  const columnCData = sheet.getRange(1, 3, lastRow, 1).getValues();
  
  // 最終行から上に向かって空でないセルを探す
  for (let i = columnCData.length - 1; i >= 0; i--) {
    const cellValue = columnCData[i][0];
    if (cellValue !== "" && cellValue !== null) {
      return i + 1; // 1始まりの行番号
    }
  }
  
  return 0; // データなし
}


/**
 * スプレッドシートにボタンを設置するためのカスタムメニューを追加
 * スプレッドシートを開いた時に自動実行される
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("商品管理")
    .addItem("チェック行をコピー", "copyCheckedRowsToProductManagement")
    .addSeparator()
    .addItem("使い方を表示", "showUsage")
    .addToUi();
  
  Logger.log("カスタムメニュー「商品管理」を追加しました");
}


/**
 * 使い方を表示
 */
function showUsage() {
  const message = 
    "【使い方】\n\n" +
    "1. A列のチェックボックスにチェックを入れる（3行目以降）\n" +
    "2. B列に個数を入力する\n" +
    "3. メニュー「商品管理」→「チェック行をコピー」を実行\n\n" +
    "【シート構成】\n" +
    "・2行目：ヘッダー行\n" +
    "・3行目以降：データ行\n\n" +
    "【コピー対象列】\n" +
    "C列～O列、Y列\n\n" +
    "【処理内容】\n" +
    "・商品管理シートにC列～O列、Y列のみ転記\n" +
    "・転記後、コピー元のC列～O列、Y列を削除\n\n" +
    "【注意事項】\n" +
    "・「商品管理」シートが必要です\n" +
    "・個数は1～1000の範囲で指定してください\n" +
    "・空行や無効な個数はスキップされます";
  
  SpreadsheetApp.getUi().alert("使い方", message, SpreadsheetApp.getUi().ButtonSet.OK);
}


/**
 * デバッグ用：現在のシート情報を出力
 */
function debugSheetInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  Logger.log("=== シート情報 ===");
  Logger.log("スプレッドシート名: " + ss.getName());
  Logger.log("アクティブシート名: " + sheet.getName());
  Logger.log("最終行: " + sheet.getLastRow());
  Logger.log("最終列: " + sheet.getLastColumn());
  Logger.log("データ開始行: " + DATA_START_ROW);
  
  // 商品管理シートの確認
  const targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);
  if (targetSheet) {
    Logger.log("商品管理シート: 存在します（最終行: " + targetSheet.getLastRow() + "）");
  } else {
    Logger.log("商品管理シート: 存在しません");
  }
  
  // 2行目（ヘッダー）と最初のデータ行を表示
  Logger.log("=== データプレビュー ===");
  Logger.log("2行目（ヘッダー）:");
  const headerRow = sheet.getRange(2, 1, 1, 5).getValues()[0];
  Logger.log("  A=" + headerRow[0] + ", B=" + headerRow[1] + ", C=" + headerRow[2]);
  
  if (sheet.getLastRow() >= DATA_START_ROW) {
    Logger.log("3行目以降（データ行、最初の5行）:");
    const dataRowCount = Math.min(5, sheet.getLastRow() - DATA_START_ROW + 1);
    const previewData = sheet.getRange(DATA_START_ROW, 1, dataRowCount, 3).getValues();
    previewData.forEach((row, index) => {
      Logger.log("  行" + (index + DATA_START_ROW) + ": A=" + row[0] + ", B=" + row[1] + ", C=" + row[2]);
    });
  }
}