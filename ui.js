function showCsvImportDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("csvDialog")
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "CSV読み込み");
}

function processCsvContent(csvContent) {
  try {
    const csvData = parseCsvContent(csvContent);
    writeToAmazonSalesSheet(csvData);
    return { success: true, message: "CSV読み込みが完了しました。" };
  } catch (error) {
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

function showDriveFileSelector() {
  try {
    const files = DriveApp.searchFiles('mimeType="text/csv" or name contains ".csv"');
    const fileList = [];
    
    while (files.hasNext() && fileList.length < 20) {
      const file = files.next();
      fileList.push({
        id: file.getId(),
        name: file.getName(),
        lastUpdated: file.getLastUpdated().toLocaleDateString("ja-JP")
      });
    }
    
    if (fileList.length === 0) {
      throw new Error("CSVファイルが見つかりません。Google DriveにCSVファイルをアップロードしてください。");
    }
    
    fileList.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    
    return fileList;
  } catch (error) {
    throw new Error("ファイル選択中にエラーが発生しました: " + error.message);
  }
}

function handleDataProcessing() {
  try {
    processData();
    SpreadsheetApp.getUi().alert("データ処理が完了しました。");
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("データ処理エラー:", error);
  }
}

function handleTransfer() {
  try {
    transferToProductSheet();
    SpreadsheetApp.getUi().alert("商品管理シートへの転記が完了しました。");
  } catch (error) {
    SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
    console.error("転記エラー:", error);
  }
}