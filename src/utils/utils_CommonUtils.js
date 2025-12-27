function utils_parseCSVLine(line) {
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

function utils_arraysEqual(a, b) {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (String(a[i]).trim() !== String(b[i]).trim()) {
      return false;
    }
  }

  return true;
}

function utils_getSheetOrError(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("シート「" + sheetName + "」が見つかりません。");
  }

  return sheet;
}

function utils_getSheetOrCreate(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

function utils_showAlert(message) {
  SpreadsheetApp.getUi().alert(message);
}

function utils_showError(error) {
  SpreadsheetApp.getUi().alert("エラーが発生しました: " + error.message);
  console.error(error);
}

function utils_formatDateJST(date, format) {
  return Utilities.formatDate(date, "Asia/Tokyo", format || "yyyy/MM/dd");
}

function utils_parseDateOnly(dateTimeString) {
  if (!dateTimeString) {
    return null;
  }

  const dateStr = String(dateTimeString);

  if (dateStr.includes("T")) {
    const datePart = dateStr.split("T")[0];
    const [year, month, day] = datePart.split("-");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length >= 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }

  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length >= 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }

  return null;
}

function utils_parseMultipleRows(targetRowValue) {
  if (!targetRowValue) {
    return [];
  }

  return String(targetRowValue)
    .split(",")
    .map(row => parseInt(row.trim()))
    .filter(row => !isNaN(row));
}

function utils_filterDuplicates(newData, existingData) {
  if (existingData.length === 0) {
    return newData;
  }

  return newData.filter(newRow => {
    return !existingData.some(existingRow => {
      return arraysEqual(newRow, existingRow);
    });
  });
}

function utils_getExistingData(sheet, startColumn) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return [];
  }

  const lastCol = sheet.getLastColumn();
  if (lastCol < startColumn) {
    return [];
  }

  const range = sheet.getRange(1, startColumn, lastRow, lastCol - startColumn + 1);
  return range.getValues().filter(row => row.some(cell => cell !== ""));
}
