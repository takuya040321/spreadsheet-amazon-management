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

    // A列の空白の最初の行を効率的に取得
    const aColumn = amazonData.map(row => row[0]); // A列のデータのみ抽出
    const startIndex = aColumn.findIndex(value => value === "" || value === null);
    
    // 処理対象行が見つからない場合は処理終了
    if (startIndex === -1) {
      console.log("A列に空白行が見つかりませんでした");
      return "転記対象の空白行がありませんでした。";
    }
    
    // 空白行から処理開始
    transferredCount = processTransferRows(amazonData, amazonSalesSheet, productSheet, startIndex);
    
    console.log(`${transferredCount}行のデータを商品管理シートに転記しました。`);
    return `${transferredCount}行のデータを商品管理シートに転記しました。`;
    
  } catch (error) {
    console.error("商品管理シート転記エラー:", error);
    throw error;
  }
}

function processTransferRows(amazonData, amazonSalesSheet, productSheet, startIndex) {
  const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
  let transferredCount = 0;
  
  for (let i = startIndex; i < amazonData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const status = amazonData[i][0]; // A列のステータス
    const targetRow = amazonData[i][1]; // B列の行番号
    const transactionType = amazonData[i][7]; // H列
    
    // A列が空白でない行はスキップ
    if (status !== "" && status !== null) {
      continue;
    }
    
    let success = false;
    
    switch (transactionType) {
      case "注文":
      case "返金":
        // 注文・返金の処理
        success = transferSalesData(amazonSalesSheet, productSheet, row, targetRow);
        break;
        
      case "配送サービス":
        // 配送サービスの処理
        success = processShippingService(amazonSalesSheet, productSheet, row, targetRow);
        break;
        
      default:
        // 未対応のトランザクション種類
        console.log(`行 ${row}: 未対応のトランザクション種類: ${transactionType}`);
        success = false;
        break;
    }
    
    if (success) {
      // Amazon売上シートのE列に処理実行日を記録
      amazonSalesSheet.getRange(row, 5).setValue(today);
      transferredCount++;
    }
  }
  
  return transferredCount;
}

function processSalesDataTransfer(rowData, sourceRow, targetRow) {
  try {
    // 売上データの取得
    const saleDate = rowData[5]; // F列（日付/時間）
    const sPrice = rowData[18] || 0; // S列（商品売上）
    const tPrice = rowData[19] || 0; // T列（商品の売上税）
    const revenue = rowData[32] || 0; // AG列（合計（振込金額））
    
    // 日付をYYYY/MM/DD形式に変換
    let formattedDate = "";
    if (saleDate instanceof Date) {
      formattedDate = Utilities.formatDate(saleDate, "Asia/Tokyo", "yyyy/MM/dd");
    } else if (saleDate) {
      formattedDate = String(saleDate);
    }
    
    // 販売価格（S列＋T列）
    const totalSalePrice = Number(sPrice) + Number(tPrice);
    
    console.log(`${sourceRow}行目の売上データを商品管理シート${targetRow}行目に転記しました`);
    
    return {
      type: "sales",
      sourceRow: sourceRow,
      targetRow: targetRow,
      formattedDate: formattedDate,
      totalSalePrice: totalSalePrice,
      revenue: revenue
    };
    
  } catch (error) {
    console.error(`${sourceRow}行目の売上データ処理エラー:`, error);
    return null;
  }
}

function processShippingServiceData(rowData, sourceRow, targetRow) {
  try {
    // 配送サービスデータの取得
    const iData = rowData[8]; // I列
    const agData = rowData[32]; // AG列
    
    // 転記データの作成
    let transferData = "";
    if (iData) transferData += String(iData);
    if (agData) {
      if (transferData) transferData += " / ";
      transferData += String(agData);
    }
    
    console.log(`${sourceRow}行目の配送サービスを商品管理シート${targetRow}行目に転記しました`);
    
    return {
      type: "shipping",
      sourceRow: sourceRow,
      targetRow: targetRow,
      transferData: transferData
    };
    
  } catch (error) {
    console.error(`${sourceRow}行目の配送サービス処理エラー:`, error);
    return null;
  }
}

function batchUpdateTransferSheet(amazonSalesSheet, productSheet, updates) {
  const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
  
  // Amazon売上シートのE列更新データを準備
  const amazonUpdates = [];
  
  // 商品管理シートの更新データを準備
  const productUpdates = [];
  
  updates.forEach(update => {
    // Amazon売上シートのE列に処理実行日を記録
    amazonUpdates.push([update.sourceRow, 5, today]);
    
    if (update.type === "sales") {
      // 売上データの転記
      if (update.formattedDate) {
        productUpdates.push([update.targetRow, 28, update.formattedDate]); // AB列（売上日）
      }
      if (update.totalSalePrice !== 0) {
        productUpdates.push([update.targetRow, 29, update.totalSalePrice]); // AC列（販売価格）
      }
      if (update.revenue !== 0) {
        productUpdates.push([update.targetRow, 30, update.revenue]); // AD列（入金価格）
      }
      productUpdates.push([update.targetRow, 32, true]); // AF列（売却廃却）
      
    } else if (update.type === "shipping") {
      // 配送サービスの転記
      if (update.transferData) {
        productUpdates.push([update.targetRow, 31, update.transferData]); // AE列
      }
    }
  });
  
  // Amazon売上シートの一括更新
  if (amazonUpdates.length > 0) {
    amazonUpdates.forEach(([row, col, value]) => {
      amazonSalesSheet.getRange(row, col).setValue(value);
    });
  }
  
  // 商品管理シートの一括更新
  if (productUpdates.length > 0) {
    productUpdates.forEach(([row, col, value]) => {
      productSheet.getRange(row, col).setValue(value);
    });
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
    
    // Amazon売上シートのA列に「転記済み」、E列に転記日を記録
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
    amazonSalesSheet.getRange(sourceRow, 1).setValue("転記済み"); // A列
    amazonSalesSheet.getRange(sourceRow, 5).setValue(today); // E列
    
    console.log(`${sourceRow}行目の売上データを商品管理シート${targetRow}行目に転記完了`);
    return true;
    
  } catch (error) {
    console.error(`${sourceRow}行目の売上データ転記エラー:`, error);
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
    
    console.log(`${sourceRow}行目の配送サービス処理完了（商品管理シート${targetRow}行目）`);
    return true;
    
  } catch (error) {
    console.error(`${sourceRow}行目の配送サービス処理エラー:`, error);
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
    console.error("転記データ検証エラー:", error);
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
    console.error("転記サマリー取得エラー:", error);
    return null;
  }
}