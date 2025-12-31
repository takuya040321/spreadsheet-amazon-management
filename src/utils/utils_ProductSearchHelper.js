function utils_calculateProductStatus(rowData) {
  const zCol = rowData[25];  // Z列: 商品受領フラグ
  const aaCol = rowData[26]; // AA列: 販売中フラグ
  const afCol = rowData[31]; // AF列: 売却廃却フラグ

  if (afCol === true) {
    return PRODUCT_STATUS.SOLD;
  } else if (aaCol === true) {
    return PRODUCT_STATUS.ON_SALE;
  } else if (zCol === true) {
    return PRODUCT_STATUS.RECEIVED;
  } else {
    return PRODUCT_STATUS.NOT_RECEIVED;
  }
}

function utils_searchProductByYColumn(productData, searchValue, usedProductRows, dataStartRow) {
  usedProductRows = usedProductRows || new Set();
  dataStartRow = dataStartRow || 3;
  const yColumnIndex = 24; // Y列（0始まり）

  for (let i = 0; i < productData.length; i++) {
    const row = i + dataStartRow;
    const yColumnValue = productData[i][yColumnIndex];

    if (usedProductRows.has(row)) {
      continue;
    }

    const status = utils_calculateProductStatus(productData[i]);

    if (status === PRODUCT_STATUS.SOLD) {
      continue;
    }

    if (String(yColumnValue).trim() === String(searchValue).trim()) {
      return row;
    }
  }

  return null;
}

function utils_searchMultipleProducts(productData, searchValue, quantity, usedProductRows, dataStartRow) {
  usedProductRows = usedProductRows || new Set();
  dataStartRow = dataStartRow || 3;
  const foundRows = [];

  for (let q = 0; q < quantity; q++) {
    const row = utils_searchProductByYColumn(productData, searchValue, usedProductRows, dataStartRow);
    if (row) {
      foundRows.push(row);
      usedProductRows.add(row);
    }
  }

  return foundRows;
}

function utils_getProductDataFromSheet(productSheet, dataStartRow) {
  dataStartRow = dataStartRow || 3;
  const lastRow = productSheet.getLastRow();

  if (lastRow < dataStartRow) {
    return [];
  }

  const dataRowCount = lastRow - dataStartRow + 1;
  return productSheet.getRange(dataStartRow, 1, dataRowCount, 33).getValues();
}

function utils_batchUpdateSheetColumn(sheet, updates, columnIndex) {
  if (updates.length === 0) {
    return;
  }

  updates.forEach(function(update) {
    sheet.getRange(update.row, columnIndex).setValue(update.value);
  });
}

function utils_batchUpdateMultipleColumns(sheet, rowUpdates) {
  if (rowUpdates.length === 0) {
    return;
  }

  rowUpdates.forEach(function(update) {
    const columns = update.columns;
    for (const colIndex in columns) {
      if (columns.hasOwnProperty(colIndex)) {
        sheet.getRange(update.row, parseInt(colIndex)).setValue(columns[colIndex]);
      }
    }
  });
}

function utils_setHyperlink(sheet, row, column, url, displayText) {
  const formula = '=HYPERLINK("' + url + '","' + displayText + '")';
  sheet.getRange(row, column).setFormula(formula);
}

function utils_createProductSheetLink(row, sheetName) {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const sheetId = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getSheetId();
  return "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit#gid=" + sheetId + "&range=A" + row;
}
