/**
 * メルカリ売上シート UI機能とボタンハンドラー
 * セル上の画像ボタンから各機能を呼び出すためのインターフェース
 */

// =====================
// ボタンハンドラー関数
// =====================

/**
 * ボタン1: CSVファイル読込
 */
function mercari_handleCsvImport() {
  try {
    const htmlOutput = HtmlService.createHtmlOutputFromFile("mercariCsvDialog")
      .setWidth(500)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, "メルカリCSV読み込み");
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("メルカリCSV読込エラー:", error);
  }
}

/**
 * ボタン2: データ処理
 */
function mercari_handleDataProcessing() {
  try {
    const result = processMercariData();
    SpreadsheetApp.getUi().alert("データ処理が完了しました。\n" + result);
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("データ処理エラー:", error);
  }
}

/**
 * ボタン3: 商品管理転記
 */
function mercari_handleTransfer() {
  try {
    const result = transferMercariToProductSheet();
    SpreadsheetApp.getUi().alert("商品管理シートへの転記が完了しました。\n" + result);
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("転記エラー:", error);
  }
}


/**
 * CSVコンテンツ処理（ダイアログから呼び出される）
 */
function mercari_processCsvContent(csvContent) {
  try {
    console.log("ダイアログからメルカリCSVコンテンツを処理中...");
    const csvData = mercari_parseCsvContent(csvContent);
    console.log("メルカリCSVデータを解析しました:", csvData.length, "行");
    const result = mercari_writeToSalesSheet(csvData);
    console.log("メルカリシートへのデータ書き込みが完了しました");
    return { success: true, message: "メルカリCSV読み込みが完了しました。\n" + result };
  } catch (error) {
    console.error("CSVコンテンツ処理エラー:", error);
    throw new Error("メルカリCSVファイルの処理に失敗しました: " + error.message);
  }
}

function mercari_parseCsvContent(csvContent) {
  const lines = csvContent.split("\n");
  
  if (lines.length < 2) {
    throw new Error("CSVファイルの形式が正しくありません（ヘッダー行とデータが必要）。");
  }

  // ヘッダー行をスキップしてデータ行から処理開始
  const dataLines = lines.slice(1);
  const parsedData = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (line) {
      const row = utils_parseCSVLine(line);
      if (row && row.length > 0) {
        parsedData.push(row);
      }
    }
  }

  return parsedData;
}

function mercari_writeToSalesSheet(csvData) {
  console.log("writeToMercariSalesSheetが呼び出されました。データ行数:", csvData.length);
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName("メルカリ売上");
  
  if (!sheet) {
    console.log("新しいメルカリ売上シートを作成中");
    sheet = spreadsheet.insertSheet("メルカリ売上");
  }

  if (csvData.length === 0) {
    throw new Error("読み込むデータがありません。");
  }

  const existingData = mercari_getExistingData(sheet);
  const newData = mercari_filterDuplicates(csvData, existingData);
  console.log("重複フィルタリング後のデータ行数:", newData.length);

  if (newData.length === 0) {
    console.log("追加する新しいデータはありません");
    return "重複データのため、新しいデータはありませんでした。";
  }

  const lastRow = sheet.getLastRow();
  const startCol = 7; // G列から開始
  const startRow = lastRow + 1;
  const numRows = newData.length;
  const numCols = newData[0].length;
  
  console.log("シートへの書き込み開始位置 - 行:", startRow, "列:", startCol);
  console.log("書き込み範囲:", numRows, "行 x", numCols, "列");
  
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  range.setValues(newData);

  console.log(newData.length + "行のデータをメルカリ売上シートに追加しました。");
  return `${newData.length}行のデータを追加しました。`;
}

function mercari_getExistingData(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return [];
  }

  const range = sheet.getRange(1, 7, lastRow, sheet.getLastColumn() - 6);
  return range.getValues().filter(row => row.some(cell => cell !== ""));
}

function mercari_filterDuplicates(newData, existingData) {
  if (existingData.length === 0) {
    return newData;
  }

  return newData.filter(newRow => {
    return !existingData.some(existingRow => {
      return utils_arraysEqual(newRow, existingRow);
    });
  });
}

