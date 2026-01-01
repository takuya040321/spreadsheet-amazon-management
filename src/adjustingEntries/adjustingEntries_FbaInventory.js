/**
 * FBA在庫調整機能
 * 年末FBA在庫シートの在庫数と商品管理シートのAF列を同期
 */

var ADJUSTING_ENTRIES_CONFIG = {
  FBA_SHEET_NAME: "年末FBA在庫",
  PRODUCT_SHEET_NAME: "商品管理",
  FBA_DATA_START_ROW: 2,
  PRODUCT_DATA_START_ROW: 3,
  FBA_SKU_COL: 4,
  FBA_INVENTORY_COL: 19,
  FBA_RESULT_COL: 22,
  FBA_ERROR_COL: 23,
  PRODUCT_SKU_COL: 25,
  PRODUCT_AF_COL: 32,
  GRAY_COLOR: "#D3D3D3"
};

function adjustingEntries_adjustFbaInventory() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var fbaSheet = spreadsheet.getSheetByName(ADJUSTING_ENTRIES_CONFIG.FBA_SHEET_NAME);
  var productSheet = spreadsheet.getSheetByName(ADJUSTING_ENTRIES_CONFIG.PRODUCT_SHEET_NAME);

  if (!fbaSheet) {
    ui.alert("エラー", "「年末FBA在庫」シートが見つかりません。", ui.ButtonSet.OK);
    return;
  }

  if (!productSheet) {
    ui.alert("エラー", "「商品管理」シートが見つかりません。", ui.ButtonSet.OK);
    return;
  }

  var fbaData = adjustingEntries_getFbaInventoryData(fbaSheet);

  if (fbaData.length === 0) {
    ui.alert("情報", "処理対象のデータがありません。", ui.ButtonSet.OK);
    return;
  }

  var response = ui.alert(
    "確認",
    "FBA在庫調整を実行します。\n\n処理対象SKU: " + fbaData.length + "件\n\n続行しますか？",
    ui.ButtonSet.OK_CANCEL
  );

  if (response !== ui.Button.OK) {
    return;
  }

  var productData = adjustingEntries_getProductData(productSheet);
  var result = adjustingEntries_processAllSkus(fbaSheet, productSheet, fbaData, productData);

  ui.alert(
    "完了",
    "FBA在庫調整が完了しました。\n\n" +
    "処理SKU数: " + result.totalCount + "件\n" +
    "成功: " + result.successCount + "件\n" +
    "エラー: " + result.errorCount + "件\n" +
    "スキップ: " + result.skipCount + "件",
    ui.ButtonSet.OK
  );
}

function adjustingEntries_getFbaInventoryData(fbaSheet) {
  var lastRow = fbaSheet.getLastRow();
  if (lastRow < ADJUSTING_ENTRIES_CONFIG.FBA_DATA_START_ROW) {
    return [];
  }

  var dataRange = fbaSheet.getRange(
    ADJUSTING_ENTRIES_CONFIG.FBA_DATA_START_ROW,
    1,
    lastRow - ADJUSTING_ENTRIES_CONFIG.FBA_DATA_START_ROW + 1,
    ADJUSTING_ENTRIES_CONFIG.FBA_ERROR_COL
  );
  var values = dataRange.getValues();

  var fbaData = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var sku = row[ADJUSTING_ENTRIES_CONFIG.FBA_SKU_COL - 1];
    var inventory = row[ADJUSTING_ENTRIES_CONFIG.FBA_INVENTORY_COL - 1];
    var resultStatus = row[ADJUSTING_ENTRIES_CONFIG.FBA_RESULT_COL - 1];

    if (sku && resultStatus !== "OK") {
      fbaData.push({
        rowIndex: i + ADJUSTING_ENTRIES_CONFIG.FBA_DATA_START_ROW,
        sku: String(sku).trim(),
        inventoryCount: parseInt(inventory, 10) || 0
      });
    }
  }

  return fbaData;
}

function adjustingEntries_getProductData(productSheet) {
  var lastRow = productSheet.getLastRow();
  if (lastRow < ADJUSTING_ENTRIES_CONFIG.PRODUCT_DATA_START_ROW) {
    return [];
  }

  var dataRange = productSheet.getRange(
    ADJUSTING_ENTRIES_CONFIG.PRODUCT_DATA_START_ROW,
    1,
    lastRow - ADJUSTING_ENTRIES_CONFIG.PRODUCT_DATA_START_ROW + 1,
    ADJUSTING_ENTRIES_CONFIG.PRODUCT_AF_COL
  );

  return dataRange.getValues();
}

function adjustingEntries_processAllSkus(fbaSheet, productSheet, fbaData, productData) {
  var result = {
    totalCount: fbaData.length,
    successCount: 0,
    errorCount: 0,
    skipCount: 0
  };

  for (var i = 0; i < fbaData.length; i++) {
    var fbaItem = fbaData[i];
    var processResult = adjustingEntries_processSingleSku(productSheet, productData, fbaItem);

    if (processResult.status === "OK") {
      result.successCount++;
      adjustingEntries_markAsProcessed(fbaSheet, fbaItem.rowIndex, "OK", processResult.message);
    } else if (processResult.status === "SKIP") {
      result.skipCount++;
      adjustingEntries_markAsProcessed(fbaSheet, fbaItem.rowIndex, "OK", "調整不要");
    } else {
      result.errorCount++;
      adjustingEntries_markAsProcessed(fbaSheet, fbaItem.rowIndex, "NG", processResult.error);
    }
  }

  return result;
}

function adjustingEntries_processSingleSku(productSheet, productData, fbaItem) {
  var matchingRows = adjustingEntries_findRowsBySku(productData, fbaItem.sku);

  if (matchingRows.length === 0) {
    return { status: "ERROR", error: "商品管理シートにSKUが見つかりません" };
  }

  var afStatus = adjustingEntries_countAfColumnStatus(productData, matchingRows);
  var targetFalseCount = fbaItem.inventoryCount;
  var currentFalseCount = afStatus.falseCount;

  if (currentFalseCount === targetFalseCount) {
    return { status: "SKIP", error: "" };
  }

  var adjustResult = adjustingEntries_adjustAfColumn(productSheet, afStatus.rows, targetFalseCount, currentFalseCount);

  if (adjustResult.success) {
    return { status: "OK", message: adjustResult.message };
  } else {
    return { status: "ERROR", error: adjustResult.error };
  }
}

function adjustingEntries_findRowsBySku(productData, sku) {
  var matchingRows = [];
  var skuColIndex = ADJUSTING_ENTRIES_CONFIG.PRODUCT_SKU_COL - 1;

  for (var i = 0; i < productData.length; i++) {
    var rowSku = productData[i][skuColIndex];
    if (rowSku && String(rowSku).trim() === sku) {
      matchingRows.push(i + ADJUSTING_ENTRIES_CONFIG.PRODUCT_DATA_START_ROW);
    }
  }

  return matchingRows;
}

function adjustingEntries_countAfColumnStatus(productData, rows) {
  var afColIndex = ADJUSTING_ENTRIES_CONFIG.PRODUCT_AF_COL - 1;
  var trueCount = 0;
  var falseCount = 0;
  var rowDetails = [];

  for (var i = 0; i < rows.length; i++) {
    var rowNum = rows[i];
    var dataIndex = rowNum - ADJUSTING_ENTRIES_CONFIG.PRODUCT_DATA_START_ROW;
    var afValue = productData[dataIndex][afColIndex];
    var isSold = (afValue === true || afValue === "TRUE" || afValue === "true");

    if (isSold) {
      trueCount++;
    } else {
      falseCount++;
    }

    rowDetails.push({
      row: rowNum,
      isSold: isSold
    });
  }

  return {
    trueCount: trueCount,
    falseCount: falseCount,
    rows: rowDetails
  };
}

function adjustingEntries_adjustAfColumn(productSheet, rowDetails, targetFalseCount, currentFalseCount) {
  var afCol = ADJUSTING_ENTRIES_CONFIG.PRODUCT_AF_COL;
  var adjustedCount = 0;
  var adjustmentType = "";

  if (currentFalseCount > targetFalseCount) {
    var toMakeTrue = currentFalseCount - targetFalseCount;
    var falseRows = rowDetails.filter(function(r) { return !r.isSold; });

    for (var i = 0; i < toMakeTrue && i < falseRows.length; i++) {
      productSheet.getRange(falseRows[i].row, afCol).setValue(true);
      adjustedCount++;
    }
    adjustmentType = "Trueに変更: " + adjustedCount + "件";
  } else if (currentFalseCount < targetFalseCount) {
    var toMakeFalse = targetFalseCount - currentFalseCount;
    var trueRows = rowDetails.filter(function(r) { return r.isSold; });
    trueRows.reverse();

    for (var j = 0; j < toMakeFalse && j < trueRows.length; j++) {
      productSheet.getRange(trueRows[j].row, afCol).setValue(false);
      adjustedCount++;
    }
    adjustmentType = "Falseに変更: " + adjustedCount + "件";
  }

  return { success: true, error: "", message: adjustmentType };
}

function adjustingEntries_markAsProcessed(fbaSheet, rowIndex, status, errorMessage) {
  var resultCell = fbaSheet.getRange(rowIndex, ADJUSTING_ENTRIES_CONFIG.FBA_RESULT_COL);
  var errorCell = fbaSheet.getRange(rowIndex, ADJUSTING_ENTRIES_CONFIG.FBA_ERROR_COL);

  resultCell.setValue(status);
  errorCell.setValue(errorMessage);

  if (status === "OK") {
    var lastCol = fbaSheet.getLastColumn();
    var rowRange = fbaSheet.getRange(rowIndex, 1, 1, lastCol);
    rowRange.setBackground(ADJUSTING_ENTRIES_CONFIG.GRAY_COLOR);
  }
}
