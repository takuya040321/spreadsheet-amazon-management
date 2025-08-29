/**
 * データ処理機能
 * 転記先行検索・データ処理機能を実装
 */

function processData() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const amazonSalesSheet = spreadsheet.getSheetByName("Amazon売上");
    
    if (!amazonSalesSheet) {
      throw new Error("Amazon売上シートが見つかりません。");
    }
    
    const productSheet = spreadsheet.getSheetByName("商品管理");
    if (!productSheet) {
      throw new Error("商品管理シートが見つかりません。");
    }
    
    const lastRow = amazonSalesSheet.getLastRow();
    if (lastRow < 3) {
      throw new Error("処理対象のデータがありません。");
    }
    
    let processedCount = 0;
    
    // 3行目以降を処理対象とする
    for (let row = 3; row <= lastRow; row++) {
      const aValue = amazonSalesSheet.getRange(row, 1).getValue();
      
      // A列が空白の行を処理対象とする
      if (aValue === "" || aValue === null) {
        const result = processDataRow(amazonSalesSheet, productSheet, row);
        if (result) {
          processedCount++;
        }
      }
    }
    
    console.log(`${processedCount}行のデータを処理しました。`);
    return `${processedCount}行のデータを処理しました。`;
    
  } catch (error) {
    console.error("processData error:", error);
    throw error;
  }
}

function processDataRow(amazonSalesSheet, productSheet, row) {
  try {
    const transactionType = amazonSalesSheet.getRange(row, 8).getValue(); // H列
    const productName = amazonSalesSheet.getRange(row, 11).getValue(); // K列
    const orderNumber = amazonSalesSheet.getRange(row, 15).getValue(); // O列
    const sku = amazonSalesSheet.getRange(row, 16).getValue(); // P列
    
    console.log(`Processing row ${row}: ${transactionType}`);
    
    // トランザクション種類別処理
    switch (transactionType) {
      case "FBA在庫関連の手数料":
      case "振込み":
      case "注文外料金":
        // A列を転記対象外に設定
        amazonSalesSheet.getRange(row, 1).setValue("転記対象外");
        break;
        
      case "配送サービス":
        // 処理なし
        break;
        
      case "調整":
        return processAdjustment(amazonSalesSheet, productSheet, row, productName, sku);
        
      case "返金":
        return processRefund(amazonSalesSheet, productSheet, row, orderNumber);
        
      case "注文":
        return processSKUSearch(amazonSalesSheet, productSheet, row, sku);
        
      default:
        console.log(`Unknown transaction type: ${transactionType}`);
        break;
    }
    
    // 処理日記録
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
    amazonSalesSheet.getRange(row, 4).setValue(today); // D列
    
    return true;
    
  } catch (error) {
    console.error(`Error processing row ${row}:`, error);
    return false;
  }
}

function processAdjustment(amazonSalesSheet, productSheet, row, productName, sku) {
  if (productName && productName.includes("FBA在庫の返金 - 購入者による返品:")) {
    // A列を転記対象外に設定
    amazonSalesSheet.getRange(row, 1).setValue("転記対象外");
  } else {
    // 紛失関連の処理：SKU検索・行番号記録
    return processSKUSearch(amazonSalesSheet, productSheet, row, sku);
  }
  return true;
}

function processRefund(amazonSalesSheet, productSheet, row, orderNumber) {
  if (!orderNumber) {
    console.log(`Row ${row}: No order number found, skipping`);
    return false;
  }
  
  // 注文番号検索・ステータス更新処理
  const foundRow = searchOrderNumber(productSheet, orderNumber);
  if (foundRow) {
    amazonSalesSheet.getRange(row, 1).setValue(foundRow); // A列に行番号記録
    amazonSalesSheet.getRange(row, 2).setValue("返金"); // B列にステータス記録
    return true;
  } else {
    console.log(`Row ${row}: Order number ${orderNumber} not found, skipping`);
    return false;
  }
}

function processSKUSearch(amazonSalesSheet, productSheet, row, sku) {
  if (!sku) {
    console.log(`Row ${row}: No SKU found, skipping`);
    return false;
  }
  
  const foundRow = searchSKU(productSheet, sku);
  if (foundRow) {
    amazonSalesSheet.getRange(row, 1).setValue(foundRow); // A列に行番号記録
    amazonSalesSheet.getRange(row, 2).setValue("販売"); // B列にステータス記録
    return true;
  } else {
    console.log(`Row ${row}: SKU ${sku} not found, skipping`);
    return false;
  }
}

function searchSKU(productSheet, sku) {
  const lastRow = productSheet.getLastRow();
  
  for (let row = 2; row <= lastRow; row++) {
    const sheetSku = productSheet.getRange(row, getColumnByHeader(productSheet, "SKU")).getValue();
    const status = getProductStatus(productSheet, row);
    
    // 「4.販売/処分済」以外のステータスを検索対象とする
    if (String(sheetSku).trim() === String(sku).trim() && status !== "4.販売/処分済") {
      return row;
    }
  }
  
  return null;
}

function searchOrderNumber(productSheet, orderNumber) {
  const lastRow = productSheet.getLastRow();
  
  for (let row = 2; row <= lastRow; row++) {
    const sheetOrderNumber = productSheet.getRange(row, getColumnByHeader(productSheet, "注文番号")).getValue();
    
    if (String(sheetOrderNumber).trim() === String(orderNumber).trim()) {
      return row;
    }
  }
  
  return null;
}

function getProductStatus(productSheet, row) {
  // IFS関数による動的ステータス計算の実装
  const zCol = productSheet.getRange(row, 26).getValue(); // Z列
  const aaCol = productSheet.getRange(row, 27).getValue(); // AA列
  const afCol = productSheet.getRange(row, 32).getValue(); // AF列
  
  if (afCol === true) {
    return "4.販売/処分済";
  } else if (aaCol === true) {
    return "3.販売中";
  } else if (zCol === true) {
    return "2.受領/検品済";
  } else {
    return "1.商品未受領";
  }
}

function getColumnByHeader(sheet, headerName) {
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  for (let col = 0; col < headerRow.length; col++) {
    if (String(headerRow[col]).trim() === headerName) {
      return col + 1;
    }
  }
  
  throw new Error(`Header "${headerName}" not found`);
}