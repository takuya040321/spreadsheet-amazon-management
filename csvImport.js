function importCsvFile(fileId) {
  if (!fileId) {
    throw new Error("ファイルIDが入力されていません。");
  }

  try {
    const file = DriveApp.getFileById(fileId);
    const csvContent = file.getBlob().getDataAsString("UTF-8");
    return processCsvContent(csvContent);
  } catch (error) {
    throw new Error("CSVファイルの読込に失敗しました: " + error.message);
  }
}

function writeToAmazonSalesSheet(csvData) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName("Amazon売上");
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Amazon売上");
  }

  if (csvData.length === 0) {
    throw new Error("読み込むデータがありません。");
  }

  const existingData = getExistingData(sheet);
  const newData = filterDuplicates(csvData, existingData);

  if (newData.length === 0) {
    SpreadsheetApp.getUi().alert("重複データのため、新しいデータはありませんでした。");
    return;
  }

  const lastRow = sheet.getLastRow();
  const startCol = 7;
  
  for (let i = 0; i < newData.length; i++) {
    const row = newData[i];
    const targetRow = lastRow + i + 1;
    
    for (let j = 0; j < row.length; j++) {
      sheet.getRange(targetRow, startCol + j).setValue(row[j]);
    }
  }

  console.log(`${newData.length}行のデータを「Amazon売上」シートに追加しました。`);
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