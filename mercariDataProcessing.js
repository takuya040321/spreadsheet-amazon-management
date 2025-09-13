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
    const fValue = rowData[5]; // F列の値（0ベースなので5）
    const oValue = rowData[14]; // O列の値（0ベースなので14）
    
    console.log(`行 ${row} を処理中: F列=${fValue}, O列=${oValue}`);
    
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
    
    // F列が空白の場合は転記対象外
    if (!fValue || fValue === "" || fValue === null) {
      return {
        aValue: "転記対象外",
        bValue: "",
        cValue: "",
        dValue: today
      };
    }
    
    // O列の値から数量を取得（「個」「つ」の前の数字のみ抽出）
    let quantity = 1; // デフォルトは1個
    if (oValue && typeof oValue === "string") {
      // 半角・全角数字の後に「個」「つ」が続くパターンをマッチ
      const quantityMatch = oValue.match(/([0-9０-９]+)[個つ]/);
      if (quantityMatch) {
        // 全角数字を半角に変換してからparseInt
        const numberStr = quantityMatch[1].replace(/[０-９]/g, function(s) {
          return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
        quantity = parseInt(numberStr, 10);
      }
    }
    
    console.log(`検索する数量: ${quantity}個`);
    
    // 指定された数量分、F列の値で商品管理シートのY列を検索
    const foundRows = [];
    for (let i = 0; i < quantity; i++) {
      const foundRow = searchSKUInArray(productData, fValue, usedProductRows);
      if (!foundRow) {
        console.log(`行 ${row}: F列の値 "${fValue}" の${i + 1}個目が商品管理シートのY列で見つかりませんでした`);
        break; // 見つからない場合は処理を中断
      }
      
      // 使用済み行として記録（次の検索で除外される）
      usedProductRows.add(foundRow);
      foundRows.push(foundRow);
      console.log(`${i + 1}個目見つかりました: 行番号${foundRow}`);
    }
    
    if (foundRows.length === 0) {
      console.log(`行 ${row}: F列の値 "${fValue}" が商品管理シートのY列で見つかりませんでした`);
      return null;
    }
    
    // 複数の行番号をカンマ区切りでB列に記載
    const bValue = foundRows.join(",");
    // 最初の行へのリンクをC列に記載（複数ある場合は最初の行のリンクのみ）
    const firstRow = foundRows[0];
    const cValue = `=HYPERLINK("#gid=431646422&range=AB${firstRow}", "リンク")`;
    
    return {
      aValue: "",
      bValue: bValue,
      cValue: cValue,
      dValue: today
    };
    
  } catch (error) {
    console.error(`Error processing row ${row}:`, error);
    return null;
  }
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

function searchProductByYColumn(productData, searchValue, usedProductRows = new Set()) {
  for (let i = 0; i < productData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const yColumnValue = productData[i][24]; // Y列（0始まりなので24）
    
    // ステータス計算（A列の状態を判定）
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
    
    // 「4.販売/処分済」以外のステータスかつY列の値が一致する場合
    if (String(yColumnValue).trim() === String(searchValue).trim() && status !== "4.販売/処分済") {
      return row;
    }
  }
  
  return null;
}