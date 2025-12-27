/**
 * UI機能とボタンハンドラー
 * セル上の画像ボタンから各機能を呼び出すためのインターフェース
 */

// =====================
// ボタンハンドラー関数
// =====================

/**
 * ボタン1: CSVファイル読込
 */
function amazon_handleCsvImport() {
  try {
    const htmlOutput = HtmlService.createHtmlOutputFromFile("amazonCsvDialog")
      .setWidth(500)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, "CSV読み込み");
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("CSV読込エラー:", error);
  }
}

/**
 * ボタン2: データ処理
 */
function amazon_handleDataProcessing() {
  try {
    const result = processAmazonData();
    SpreadsheetApp.getUi().alert("データ処理が完了しました。\n" + result);
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("データ処理エラー:", error);
  }
}

/**
 * ボタン3: 商品管理転記
 */
function amazon_handleTransfer() {
  try {
    const result = transferAmazonToProductSheet();
    SpreadsheetApp.getUi().alert("商品管理シートへの転記が完了しました。\n" + result);
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("転記エラー:", error);
  }
}


/**
 * CSVコンテンツ処理（ダイアログから呼び出される）
 */
function amazon_processCsvContent(csvContent) {
  try {
    console.log("Processing CSV content from dialog...");
    const csvData = amazon_parseCsvContent(csvContent);
    console.log("Parsed CSV data:", csvData.length, "rows");
    const result = amazon_writeToSalesSheet(csvData);
    console.log("Data written to sheet successfully");
    return { success: true, message: "CSV読み込みが完了しました。\n" + result };
  } catch (error) {
    console.error("processCsvContent error:", error);
    throw new Error("CSVファイルの処理に失敗しました: " + error.message);
  }
}

function amazon_parseCsvContent(csvContent) {
  const lines = csvContent.split("\n");
  
  if (lines.length < 9) {
    throw new Error("CSVファイルの形式が正しくありません（9行目以降にデータが必要）。");
  }

  const dataLines = lines.slice(8);
  const parsedData = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (line) {
      const row = amazon_parseCSVLine(line);
      if (row && row.length > 0) {
        parsedData.push(row);
      }
    }
  }

  return parsedData;
}

function amazon_parseCSVLine(line) {
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

function amazon_writeToSalesSheet(csvData) {
  console.log("writeToAmazonSalesSheet called with", csvData.length, "rows");
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName("Amazon売上");
  
  if (!sheet) {
    console.log("Creating new Amazon売上 sheet");
    sheet = spreadsheet.insertSheet("Amazon売上");
  }

  if (csvData.length === 0) {
    throw new Error("読み込むデータがありません。");
  }

  const existingData = amazon_getExistingData(sheet);
  const newData = amazon_filterDuplicates(csvData, existingData);
  console.log("After duplicate filtering:", newData.length, "rows");

  if (newData.length === 0) {
    console.log("No new data to add");
    return "重複データのため、新しいデータはありませんでした。";
  }

  const lastRow = sheet.getLastRow();
  const startCol = 6;
  const startRow = lastRow + 1;
  const numRows = newData.length;
  const numCols = newData[0].length;
  
  console.log("Writing to sheet starting at row", startRow, "column", startCol);
  console.log("Range:", numRows, "x", numCols);
  
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  range.setValues(newData);

  console.log(`${newData.length}行のデータを「Amazon売上」シートに追加しました。`);
  return `${newData.length}行のデータを追加しました。`;
}

function amazon_getExistingData(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return [];
  }

  const range = sheet.getRange(1, 6, lastRow, sheet.getLastColumn() - 5);
  return range.getValues().filter(row => row.some(cell => cell !== ""));
}

function amazon_filterDuplicates(newData, existingData) {
  if (existingData.length === 0) {
    return newData;
  }

  return newData.filter(newRow => {
    return !existingData.some(existingRow => {
      return amazon_arraysEqual(newRow, existingRow);
    });
  });
}

function amazon_arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (String(a[i]).trim() !== String(b[i]).trim()) {
      return false;
    }
  }
  
  return true;
}

