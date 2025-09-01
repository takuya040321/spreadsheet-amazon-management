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
function handleCsvImport() {
  try {
    const htmlOutput = HtmlService.createHtmlOutputFromFile("csvDialog")
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

function parseCsvContent(csvContent) {
  const lines = csvContent.split("\n");
  
  if (lines.length < 9) {
    throw new Error("CSVファイルの形式が正しくありません（9行目以降にデータが必要）。");
  }

  const dataLines = lines.slice(8);
  const parsedData = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (line) {
      const row = parseCSVLine(line);
      if (row && row.length > 0) {
        parsedData.push(row);
      }
    }
  }

  return parsedData;
}

function parseCSVLine(line) {
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

function writeToAmazonSalesSheet(csvData) {
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

  const existingData = getExistingData(sheet);
  const newData = filterDuplicates(csvData, existingData);
  console.log("After duplicate filtering:", newData.length, "rows");

  if (newData.length === 0) {
    console.log("No new data to add");
    return "重複データのため、新しいデータはありませんでした。";
  }

  const lastRow = sheet.getLastRow();
  const startCol = 7;
  console.log("Writing to sheet starting at row", lastRow + 1, "column", startCol);
  
  for (let i = 0; i < newData.length; i++) {
    const row = newData[i];
    const targetRow = lastRow + i + 1;
    
    for (let j = 0; j < row.length; j++) {
      sheet.getRange(targetRow, startCol + j).setValue(row[j]);
    }
  }

  console.log(`${newData.length}行のデータを「Amazon売上」シートに追加しました。`);
  return `${newData.length}行のデータを追加しました。`;
}

function getExistingData(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return [];
  }

  const range = sheet.getRange(1, 7, lastRow, sheet.getLastColumn() - 6);
  return range.getValues().filter(row => row.some(cell => cell !== ""));
}

function filterDuplicates(newData, existingData) {
  if (existingData.length === 0) {
    return newData;
  }

  return newData.filter(newRow => {
    return !existingData.some(existingRow => {
      return arraysEqual(newRow, existingRow);
    });
  });
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (String(a[i]).trim() !== String(b[i]).trim()) {
      return false;
    }
  }
  
  return true;
}

