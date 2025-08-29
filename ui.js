/**
 * UI機能とボタンハンドラー
 * 各機能をボタンから呼び出すためのインターフェース
 */

// =====================
// メインUI関数
// =====================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Amazon売上管理")
    .addItem("1. CSVファイル読込", "handleCsvImport")
    .addItem("2. データ処理", "handleDataProcessing")
    .addItem("3. 商品管理転記", "handleTransfer")
    .addToUi();
}

// =====================
// ボタンハンドラー関数
// =====================

/**
 * ボタン1: CSVファイル読込
 */
function handleCsvImport() {
  try {
    showCsvImportDialog();
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("CSV読込エラー:", error);
  }
}

/**
 * ボタン2: データ処理
 */
function handleDataProcessing() {
  try {
    const result = processData();
    SpreadsheetApp.getUi().alert("データ処理が完了しました。\n" + result);
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("データ処理エラー:", error);
  }
}

/**
 * ボタン3: 商品管理転記
 */
function handleTransfer() {
  try {
    const result = transferToProductSheet();
    SpreadsheetApp.getUi().alert("商品管理シートへの転記が完了しました。\n" + result);
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("転記エラー:", error);
  }
}

// =====================
// ダイアログ関数
// =====================

/**
 * CSV読込ダイアログを表示
 */
function showCsvImportDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("csvDialog")
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "CSV読み込み");
}

/**
 * CSVコンテンツ処理（ダイアログから呼び出される）
 */
function processCsvContent(csvContent) {
  try {
    console.log("Processing CSV content from dialog...");
    const csvData = parseCsvContent(csvContent);
    console.log("Parsed CSV data:", csvData.length, "rows");
    const result = writeToAmazonSalesSheet(csvData);
    console.log("Data written to sheet successfully");
    return { success: true, message: "CSV読み込みが完了しました。\n" + result };
  } catch (error) {
    console.error("processCsvContent error:", error);
    throw new Error("CSVファイルの処理に失敗しました: " + error.message);
  }
}

