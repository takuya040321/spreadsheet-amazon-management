/**
 * メルカリ売上データ処理機能
 * 転記先行検索・データ処理機能を実装
 */

function processMercariData() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const mercariSalesSheet = spreadsheet.getSheetByName("メルカリ売上");
    
    if (!mercariSalesSheet) {
      throw new Error("メルカリ売上シートが見つかりません。");
    }
    
    const productSheet = spreadsheet.getSheetByName("商品管理");
    if (!productSheet) {
      throw new Error("商品管理シートが見つかりません。");
    }
    
    const lastRow = mercariSalesSheet.getLastRow();
    if (lastRow < 3) {
      throw new Error("処理対象のデータがありません。");
    }
    
    // メルカリ売上シートの全データを一括取得
    const mercariData = mercariSalesSheet.getRange(3, 1, lastRow - 2, mercariSalesSheet.getLastColumn()).getValues();
    
    // 商品管理シートの全データを一括取得
    const productLastRow = productSheet.getLastRow();
    const productData = productLastRow < 2 ? [] : productSheet.getRange(3, 1, productLastRow - 2, productSheet.getLastColumn()).getValues();
    
    // 使用済みの商品管理シート行番号を管理
    const usedProductRows = new Set();
    
    // A列の空白の最初の行を効率的に取得
    const aColumn = mercariData.map(row => row[0]); // A列のデータのみ抽出
    const startIndex = aColumn.findIndex(value => value === "" || value === null);
    
    // 空白行が見つからない場合は処理終了
    if (startIndex === -1) {
      console.log("A列に空白行が見つかりませんでした");
      return "処理対象の空白行がありませんでした。";
    }
    
    // 空白行から処理開始
    const result = processMercariRows(mercariData, productData, startIndex, usedProductRows);
    const updates = result.updates;
    const processedCount = result.processedCount;
    
    // 結果を一括書き込み
    if (updates.length > 0) {
      batchUpdateMercariSheet(mercariSalesSheet, updates);
    }
    
    console.log(`${processedCount}行のデータを処理しました。`);
    return `${processedCount}行のデータを処理しました。`;
    
  } catch (error) {
    console.error("processData error:", error);
    throw error;
  }
}

function processMercariRows(mercariData, productData, startIndex, usedProductRows) {
  const updates = [];
  let processedCount = 0;
  
  for (let i = startIndex; i < mercariData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const aValue = mercariData[i][0]; // A列の値
    
    // A列が空白でない行はスキップ
    if (aValue !== "" && aValue !== null) {
      continue;
    }
    
    const result = processDataRow(mercariData[i], productData, row, usedProductRows, mercariData);
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

function processDataRow(rowData, productData, row, usedProductRows, mercariData) {
  try {
    const transactionType = rowData[3]; // D列（取引ステータス）（0ベースなので3）
    const productName = rowData[2]; // C列（商品名）
    const itemId = rowData[1]; // B列（商品ID等）
    
    console.log(`行 ${row} を処理中: ${transactionType}`);
    
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
    
    // メルカリの取引ステータス別処理
    switch (transactionType) {
      case "取引完了":
        return processSaleComplete(productData, row, productName, itemId, today, usedProductRows);
        
      case "取引キャンセル":
        return processCancellation(row, today);
        
      case "返品・返金":
        return processRefund(row, today);
        
      default:
        console.log(`未対応の取引ステータス: ${transactionType}`);
        return null;
    }
    
  } catch (error) {
    console.error(`Error processing row ${row}:`, error);
    return null;
  }
}

function processSaleComplete(productData, row, productName, itemId, today, usedProductRows) {
  // 商品名またはアイテムIDでSKU検索
  let sku = extractSKU(productName);
  
  if (!sku && itemId) {
    sku = itemId; // アイテムIDをSKUとして扱う場合
  }
  
  if (!sku) {
    console.log(`行 ${row}: SKUが見つかりませんでした、スキップします`);
    return null;
  }
  
  const foundRow = searchSKUInArray(productData, sku, usedProductRows);
  if (!foundRow) {
    console.log(`行 ${row}: SKU ${sku} が見つかりませんでした、スキップします`);
    return null;
  }
  
  // 使用済み行として記録
  usedProductRows.add(foundRow);
  
  return {
    aValue: "", // 使用しない
    bValue: foundRow,
    cValue: `=HYPERLINK("#gid=431646422&range=AB${foundRow}", "リンク")`, // 商品管理シートへのリンク
    dValue: today
  };
}

function processCancellation(row, today) {
  return {
    aValue: "転記対象外",
    bValue: "",
    cValue: "",
    dValue: today
  };
}

function processRefund(row, today) {
  return {
    aValue: "返金処理済み",
    bValue: "",
    cValue: "",
    dValue: today
  };
}

function extractSKU(productName) {
  if (!productName) return null;
  
  // 商品名からSKUを抽出するロジック
  // 例: "商品名 [SKU-12345]" -> "SKU-12345"
  const skuMatch = productName.match(/\[([^\]]+)\]/);
  if (skuMatch) {
    return skuMatch[1];
  }
  
  return null;
}

function batchUpdateMercariSheet(mercariSalesSheet, updates) {
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
      mercariSalesSheet.getRange(row, col).setValue(value);
    });
  }
  
  if (bUpdates.length > 0) {
    bUpdates.forEach(([row, col, value]) => {
      mercariSalesSheet.getRange(row, col).setValue(value);
    });
  }
  
  if (cUpdates.length > 0) {
    cUpdates.forEach(([row, col, value]) => {
      mercariSalesSheet.getRange(row, col).setValue(value);
    });
  }
  
  if (dUpdates.length > 0) {
    dUpdates.forEach(([row, col, value]) => {
      mercariSalesSheet.getRange(row, col).setValue(value);
    });
  }
}

function searchSKUInArray(productData, sku, usedProductRows = new Set()) {
  for (let i = 0; i < productData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const skuColumnIndex = 24; // Y列（0始まりなので24）
    const sheetSku = productData[i][skuColumnIndex];
    
    // ステータス計算（元getProductStatusFromArray関数の処理）
    const zCol = productData[i][25]; // Z列（26列目）
    const aaCol = productData[i][26]; // AA列（27列目）
    const afCol = productData[i][31]; // AF列（32列目）
    
    let status;
    if (afCol === true) {
      status = "4.販売/処分済";
    } else if (aaCol === true) {
      status = "3.販売中";
    } else if (zCol === true) {
      status = "2.受領/検品済";
    } else {
      status = "1.商品未受領";
    }
    
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