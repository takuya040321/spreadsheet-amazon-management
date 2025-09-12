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
function handleMercariCsvImport() {
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
function handleMercariDataProcessing() {
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
function handleMercariTransfer() {
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
function processMercariCsvContent(csvContent) {
  try {
    console.log("Processing Mercari CSV content from dialog...");
    const csvData = parseMercariCsvContent(csvContent);
    console.log("Parsed Mercari CSV data:", csvData.length, "rows");
    const result = writeToMercariSalesSheet(csvData);
    console.log("Data written to Mercari sheet successfully");
    return { success: true, message: "メルカリCSV読み込みが完了しました。\n" + result };
  } catch (error) {
    console.error("processCsvContent error:", error);
    throw new Error("メルカリCSVファイルの処理に失敗しました: " + error.message);
  }
}

function parseMercariCsvContent(csvContent) {
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
      const row = parseMercariCSVLine(line);
      if (row && row.length > 0) {
        parsedData.push(row);
      }
    }
  }

  return parsedData;
}

function parseMercariCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
    i++;
  }
  
  result.push(current);
  return result;
}

function writeToMercariSalesSheet(csvData) {
  console.log("writeToMercariSalesSheet called with", csvData.length, "rows");
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName("メルカリ売上");
  
  if (!sheet) {
    console.log("Creating new メルカリ売上 sheet");
    sheet = spreadsheet.insertSheet("メルカリ売上");
  }

  if (csvData.length === 0) {
    throw new Error("読み込むデータがありません。");
  }

  const existingData = getMercariExistingData(sheet);
  const newData = filterMercariDuplicates(csvData, existingData);
  console.log("After duplicate filtering:", newData.length, "rows");

  if (newData.length === 0) {
    console.log("No new data to add");
    return "重複データのため、新しいデータはありませんでした。";
  }

  const lastRow = sheet.getLastRow();
  const startCol = 7; // G列から開始
  const startRow = lastRow + 1;
  const numRows = newData.length;
  const numCols = newData[0].length;
  
  console.log("Writing to sheet starting at row", startRow, "column", startCol);
  console.log("Range:", numRows, "x", numCols);
  
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  range.setValues(newData);

  console.log(`${newData.length}行のデータを「メルカリ売上」シートに追加しました。`);
  return `${newData.length}行のデータを追加しました。`;
}

function getMercariExistingData(sheet) {
  const gColumnLastRow = sheet.getRange("G:G").getLastRow();
  if (gColumnLastRow < 1) {
    return [];
  }

  const range = sheet.getRange(1, 7, lastRow, sheet.getLastColumn() - 6);
  return range.getValues().filter(row => row.some(cell => cell !== ""));
}

function filterMercariDuplicates(newData, existingData) {
  if (existingData.length === 0) {
    return newData;
  }

  return newData.filter(newRow => {
    return !existingData.some(existingRow => {
      return mercariArraysEqual(newRow, existingRow);
    });
  });
}

function mercariArraysEqual(a, b) {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (String(a[i]).trim() !== String(b[i]).trim()) {
      return false;
    }
  }
  
  return true;
}