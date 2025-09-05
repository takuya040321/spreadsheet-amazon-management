/**
 * 商品管理シート転記機能
 * Amazon売上データを商品管理シートに転記する
 */

function transferToProductSheet() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const amazonSalesSheet = spreadsheet.getSheetByName("Amazon売上");
    const productSheet = spreadsheet.getSheetByName("商品管理");
    
    if (!amazonSalesSheet) {
      throw new Error("Amazon売上シートが見つかりません。");
    }
    
    if (!productSheet) {
      throw new Error("商品管理シートが見つかりません。");
    }
    
    const lastRow = amazonSalesSheet.getLastRow();
    let transferredCount = 0;
    
    // Amazon売上シートの全データを一括取得
    const amazonData = amazonSalesSheet.getRange(3, 1, lastRow - 2, amazonSalesSheet.getLastColumn()).getValues();

    // A列の値がある最初の行を効率的に取得
    const aColumn = amazonData.map(row => row[0]); // A列のデータのみ抽出
    const startIndex = aColumn.findIndex(value => value && typeof value === "number" && value > 0);
    
    // 処理対象行が見つからない場合は処理終了
    if (startIndex === -1) {
      console.log("A列に値がある行が見つかりませんでした");
      return "転記対象の行がありませんでした。";
    }
    
    const startRow = startIndex + 3; // 実際の行番号（3行目からの相対位置を加算）
    
    // 処理対象行から処理開始
    for (let row = startRow; row <= lastRow; row++) {
      const status = amazonSalesSheet.getRange(row, 1).getValue(); // A列のステータス
      const targetRow = amazonSalesSheet.getRange(row, 2).getValue(); // B列の行番号
      const transactionType = amazonSalesSheet.getRange(row, 8).getValue(); // H列
      
      // 転記対象の判定（B列に行番号があり、A列が転記対象外でない）
      if (targetRow && typeof targetRow === "number" && targetRow > 0 && status !== "転記対象外") {
        
        if (transactionType === "配送サービス") {
          // 配送サービスの特別処理
          const result = processShippingService(amazonSalesSheet, productSheet, row, targetRow);
          if (result) transferredCount++;
        } else {
          // 通常の売上データ転記処理
          const result = transferSalesData(amazonSalesSheet, productSheet, row, targetRow);
          if (result) transferredCount++;
        }
        
        // E列に処理実行日を記録
        const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
        amazonSalesSheet.getRange(row, 5).setValue(today);
      }
    }
    
    console.log(`${transferredCount}行のデータを商品管理シートに転記しました。`);
    return `${transferredCount}行のデータを商品管理シートに転記しました。`;
    
  } catch (error) {
    console.error("transferToProductSheet error:", error);
    throw error;
  }
}

function transferSalesData(amazonSalesSheet, productSheet, sourceRow, targetRow) {
  try {
    // 売上データの取得
    const saleDate = amazonSalesSheet.getRange(sourceRow, 6).getValue(); // F列
    const sPrice = amazonSalesSheet.getRange(sourceRow, 19).getValue() || 0; // S列
    const tPrice = amazonSalesSheet.getRange(sourceRow, 20).getValue() || 0; // T列
    const revenue = amazonSalesSheet.getRange(sourceRow, 33).getValue() || 0; // AG列
    
    // 日付をYYYY/MM/DD形式に変換
    let formattedDate = "";
    if (saleDate instanceof Date) {
      formattedDate = Utilities.formatDate(saleDate, "Asia/Tokyo", "yyyy/MM/dd");
    } else if (saleDate) {
      formattedDate = String(saleDate);
    }
    
    // 商品管理シートに転記
    if (formattedDate) {
      productSheet.getRange(targetRow, 28).setValue(formattedDate); // AB列（売上日）
    }
    
    // 販売価格（S列＋T列）
    const totalSalePrice = Number(sPrice) + Number(tPrice);
    if (totalSalePrice !== 0) {
      productSheet.getRange(targetRow, 29).setValue(totalSalePrice); // AC列（販売価格）
    }
    
    // 入金価格（AG列）
    if (revenue !== 0) {
      productSheet.getRange(targetRow, 30).setValue(revenue); // AD列（入金価格）
    }
    
    // 売却廃却チェックボックスをTrueに設定
    productSheet.getRange(targetRow, 32).setValue(true); // AF列（売却廃却）
    
    console.log(`Transferred sales data for row ${sourceRow} to product row ${targetRow}`);
    return true;
    
  } catch (error) {
    console.error(`Error transferring sales data for row ${sourceRow}:`, error);
    return false;
  }
}

function processShippingService(amazonSalesSheet, productSheet, sourceRow, targetRow) {
  try {
    // 配送サービスデータの取得
    const iData = amazonSalesSheet.getRange(sourceRow, 9).getValue(); // I列
    const agData = amazonSalesSheet.getRange(sourceRow, 33).getValue(); // AG列
    
    // 商品管理シートのAE列に転記
    let transferData = "";
    if (iData) transferData += String(iData);
    if (agData) {
      if (transferData) transferData += " / ";
      transferData += String(agData);
    }
    
    if (transferData) {
      productSheet.getRange(targetRow, 31).setValue(transferData); // AE列
    }
    
    console.log(`Processed shipping service for row ${sourceRow} to product row ${targetRow}`);
    return true;
    
  } catch (error) {
    console.error(`Error processing shipping service for row ${sourceRow}:`, error);
    return false;
  }
}

function validateTransferData(amazonSalesSheet, productSheet) {
  try {
    const amazonLastRow = amazonSalesSheet.getLastRow();
    const productLastRow = productSheet.getLastRow();
    
    console.log(`Amazon売上シート: ${amazonLastRow}行`);
    console.log(`商品管理シート: ${productLastRow}行`);
    
    // 基本的なバリデーション
    if (amazonLastRow < 3) {
      throw new Error("Amazon売上シートに転記対象データがありません。");
    }
    
    if (productLastRow < 2) {
      throw new Error("商品管理シートにデータがありません。");
    }
    
    return true;
    
  } catch (error) {
    console.error("validateTransferData error:", error);
    throw error;
  }
}

function getTransferSummary(amazonSalesSheet) {
  try {
    const lastRow = amazonSalesSheet.getLastRow();
    let summary = {
      totalRows: 0,
      transferableRows: 0,
      shippingServiceRows: 0,
      excludedRows: 0
    };
    
    for (let row = 3; row <= lastRow; row++) {
      const targetRow = amazonSalesSheet.getRange(row, 1).getValue();
      const status = amazonSalesSheet.getRange(row, 2).getValue();
      const transactionType = amazonSalesSheet.getRange(row, 8).getValue();
      
      summary.totalRows++;
      
      if (targetRow && typeof targetRow === "number" && targetRow > 0) {
        if (status === "転記対象外") {
          summary.excludedRows++;
        } else if (transactionType === "配送サービス") {
          summary.shippingServiceRows++;
        } else {
          summary.transferableRows++;
        }
      }
    }
    
    return summary;
    
  } catch (error) {
    console.error("getTransferSummary error:", error);
    return null;
  }
}