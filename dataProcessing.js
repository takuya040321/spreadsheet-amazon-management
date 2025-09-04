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
    
    // Amazon売上シートの全データを一括取得
    const amazonData = amazonSalesSheet.getRange(3, 1, lastRow - 2, amazonSalesSheet.getLastColumn()).getValues();
    
    // 商品管理シートの全データを一括取得
    const productData = getProductSheetData(productSheet);
    
    // 使用済みの商品管理シート行番号を管理
    const usedProductRows = new Set();
    
    // A列の空白の最初の行を効率的に取得
    const aColumn = amazonData.map(row => row[0]); // A列のデータのみ抽出
    const startIndex = aColumn.findIndex(value => value === "" || value === null);
    
    // 空白行が見つからない場合は処理終了
    if (startIndex === -1) {
      console.log("A列に空白行が見つかりませんでした");
      return "処理対象の空白行がありませんでした。";
    }
    
    // 空白行から処理開始
    const result = processAmazonRows(amazonData, productData, startIndex, usedProductRows);
    const updates = result.updates;
    const processedCount = result.processedCount;
    
    // 結果を一括書き込み
    if (updates.length > 0) {
      batchUpdateAmazonSheet(amazonSalesSheet, updates);
    }
    
    console.log(`${processedCount}行のデータを処理しました。`);
    return `${processedCount}行のデータを処理しました。`;
    
  } catch (error) {
    console.error("processData error:", error);
    throw error;
  }
}

function processAmazonRows(amazonData, productData, startIndex, usedProductRows) {
  const updates = [];
  let processedCount = 0;
  
  for (let i = startIndex; i < amazonData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const aValue = amazonData[i][0]; // A列の値
    
    // A列が空白でない行はスキップ
    if (aValue !== "" && aValue !== null) {
      continue;
    }
    
    const result = processDataRow(amazonData[i], productData, row, usedProductRows, amazonData);
    if (!result) {
      continue;
    }
    
    // 使用済み行の管理は各処理関数内で実行
    updates.push({
      row: row,
      aValue: result.aValue,
      bValue: result.bValue,
      cValue: result.cValue || "", // cValueが存在しない場合は空文字
      dValue: result.dValue
    });
    processedCount++;
  }
  
  return { updates, processedCount };
}

function processDataRow(rowData, productData, row, usedProductRows, amazonData) {
  try {
    const transactionType = rowData[7]; // H列（0ベースなので7）
    const productName = rowData[10]; // K列
    const orderNumber = rowData[11]; // L列（0ベースなので11）
    const sku = rowData[9]; // J列（0ベースなので9）
    
    console.log(`行 ${row} を処理中: ${transactionType}`);
    
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
    
    // トランザクション種類別処理
    switch (transactionType) {
      case "FBA 在庫関連の手数料":
      case "振込み":
      case "注文外料金":
        // A列を転記対象外に設定
        return {
          aValue: "転記対象外",
          bValue: "",
          cValue: "",
          dValue: today
        };
        
      case "配送サービス":
        const orderNumberFromI = rowData[8]; // I列の注文番号（0ベースなので8）
        return processDeliveryService(row, orderNumberFromI, today, amazonData);
        
      case "調整":
        return processAdjustment(productData, row, productName, sku, today);
        
      case "返金":
        return processRefund(productData, row, orderNumber, today);
        
      case "注文":
        const quantity = parseInt(rowData[11]) || 1; // L列の数量（デフォルト1）
        return processSKUSearchWithQuantity(productData, row, sku, today, usedProductRows, quantity);
        
      default:
        console.log(`不明なトランザクション種類: ${transactionType}`);
        return {
          aValue: "",
          bValue: "",
          cValue: "",
          dValue: today
        };
    }
    
  } catch (error) {
    console.error(`Error processing row ${row}:`, error);
    return null;
  }
}

function processAdjustment(productData, row, productName, sku, today) {
  if (productName && productName.includes("FBA在庫の返金 - 購入者による返品:")) {
    // A列を転記対象外に設定
    return {
      aValue: "転記対象外",
      bValue: "",
      cValue: "",
      dValue: today
    };
  } else {
    // 紛失関連の処理：SKU検索・行番号記録
    return processSKUSearch(productData, row, sku, today);
  }
}

function processRefund(productData, row, orderNumber, today) {
  if (!orderNumber) {
    console.log(`行 ${row}: 注文番号が見つかりませんでした、スキップします`);
    return null;
  }
  
  // 注文番号検索・ステータス更新処理
  const foundRow = searchOrderNumberInArray(productData, orderNumber);
  if (foundRow) {
    return {
      aValue: foundRow,
      bValue: "返金",
      cValue: "",
      dValue: today
    };
  } else {
    console.log(`行 ${row}: 注文番号 ${orderNumber} が見つかりませんでした、スキップします`);
    return null;
  }
}

function processSKUSearchWithQuantity(productData, row, sku, today, usedProductRows, quantity) {
  if (!sku) {
    console.log(`行 ${row}: SKUが見つかりませんでした、スキップします`);
    return null;
  }
  
  const foundRows = [];
  
  // 数量分だけ繰り返し検索
  for (let i = 0; i < quantity; i++) {
    const foundRow = searchSKUInArray(productData, sku, usedProductRows);
    if (foundRow) {
      foundRows.push(foundRow);
      usedProductRows.add(foundRow); // 即座に使用済みに追加
    } else {
      console.log(`行 ${row}: SKU ${sku} が数量 ${i + 1} で見つかりませんでした、検索を停止します`);
      break;
    }
  }
  
  if (foundRows.length > 0) {
    const firstRow = foundRows[0]; // 最初の行のみリンク対象
    return {
      aValue: "", // 使用しない
      bValue: foundRows.join(","), // カンマ区切りで複数行番号
      cValue: `=HYPERLINK("'商品管理'!A${firstRow}", "リンク")`, // 商品管理シートの該当行へのリンク
      dValue: today
    };
  } else {
    console.log(`行 ${row}: 一致するSKU ${sku} が見つかりませんでした`);
    return null;
  }
}

function processDeliveryService(row, orderNumber, today, amazonData) {
  if (!orderNumber) {
    console.log(`行 ${row}: I列に注文番号が見つかりませんでした、スキップします`);
    return null;
  }
  
  // Amazon売上シート内でI列の注文番号を検索
  const foundRow = searchOrderNumberInAmazonData(amazonData, orderNumber);
  if (foundRow) {
    return {
      aValue: "", // 使用しない
      bValue: `=B${foundRow}`, // 見つかった行のB列を参照
      cValue: "",
      dValue: today
    };
  } else {
    console.log(`行 ${row}: 注文番号 ${orderNumber} がI列で見つかりませんでした、スキップします`);
    return null;
  }
}

function processSKUSearch(productData, row, sku, today, usedProductRows) {
  if (!sku) {
    console.log(`行 ${row}: SKUが見つかりませんでした、スキップします`);
    return null;
  }
  
  const foundRow = searchSKUInArray(productData, sku, usedProductRows);
  if (foundRow) {
    return {
      aValue: "", // 使用しない
      bValue: foundRow,
      cValue: `=HYPERLINK("'商品管理'!A${foundRow}", "リンク")`, // 商品管理シートへのリンク
      dValue: today
    };
  } else {
    console.log(`行 ${row}: SKU ${sku} が見つかりませんでした、スキップします`);
    return null;
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

function getProductSheetData(productSheet) {
  const lastRow = productSheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  
  return productSheet.getRange(3, 1, lastRow - 2, productSheet.getLastColumn()).getValues();
}

function batchUpdateAmazonSheet(amazonSalesSheet, updates) {
  // A列、B列、C列、D列の更新を一括で実行
  const aUpdates = [];
  const bUpdates = [];
  const cUpdates = [];
  const dUpdates = [];
  
  updates.forEach(update => {
    if (update.aValue !== "") {
      aUpdates.push([update.row, 1, update.aValue]);
    }
    if (update.bValue !== "") {
      bUpdates.push([update.row, 2, update.bValue]);
    }
    if (update.cValue !== undefined && update.cValue !== "") {
      cUpdates.push([update.row, 3, update.cValue]);
    }
    if (update.dValue !== "") {
      dUpdates.push([update.row, 4, update.dValue]);
    }
  });
  
  // バッチ更新実行
  if (aUpdates.length > 0) {
    aUpdates.forEach(([row, col, value]) => {
      amazonSalesSheet.getRange(row, col).setValue(value);
    });
  }
  
  if (bUpdates.length > 0) {
    bUpdates.forEach(([row, col, value]) => {
      amazonSalesSheet.getRange(row, col).setValue(value);
    });
  }
  
  if (cUpdates.length > 0) {
    cUpdates.forEach(([row, col, value]) => {
      amazonSalesSheet.getRange(row, col).setValue(value);
    });
  }
  
  if (dUpdates.length > 0) {
    dUpdates.forEach(([row, col, value]) => {
      amazonSalesSheet.getRange(row, col).setValue(value);
    });
  }
}

function searchSKUInArray(productData, sku, usedProductRows = new Set()) {
  for (let i = 0; i < productData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const skuColumnIndex = 24; // Y列（0始まりなので24）
    const sheetSku = productData[i][skuColumnIndex];
    const status = getProductStatusFromArray(productData[i]);
    
    // 使用済みの行はスキップ
    if (usedProductRows.has(row)) {
      continue;
    }
    
    // 「4.販売/処分済」以外のステータスを検索対象とする
    if (String(sheetSku).trim() === String(sku).trim() && status !== "4.販売/処分済") {
      return row;
    }
  }
  
  return null;
}

function searchOrderNumberInAmazonData(amazonData, orderNumber) {
  for (let i = 0; i < amazonData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const sheetOrderNumber = amazonData[i][8]; // I列（0ベースなので8）
    
    if (String(sheetOrderNumber).trim() === String(orderNumber).trim()) {
      return row;
    }
  }
  
  return null;
}

function searchOrderNumberInArray(productData, orderNumber) {
  for (let i = 0; i < productData.length; i++) {
    const row = i + 2; // 実際の行番号
    const orderColumnIndex = getOrderNumberColumnIndex(); // 注文番号列のインデックスを取得
    const sheetOrderNumber = productData[i][orderColumnIndex];
    
    if (String(sheetOrderNumber).trim() === String(orderNumber).trim()) {
      return row;
    }
  }
  
  return null;
}

function getProductStatusFromArray(rowData) {
  // IFS関数による動的ステータス計算の実装（0ベースインデックス）
  const zCol = rowData[25]; // Z列（26列目）
  const aaCol = rowData[26]; // AA列（27列目）
  const afCol = rowData[31]; // AF列（32列目）
  
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


function getOrderNumberColumnIndex() {
  // 注文番号列のインデックスを返す（商品管理シートの構造に依存）
  // 実際のシート構造に合わせて調整が必要
  return 10; // 仮の値、実際の列位置に合わせて変更
}