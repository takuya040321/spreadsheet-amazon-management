/**
 * 商品管理シート転記機能
 * Amazon売上データを商品管理シートに転記する
 */

/**
 * 日付をDateオブジェクトに変換する（時刻部分を除去）
 * @param {Date|string} dateValue - 変換する日付
 * @returns {Date|null} 日付のみのDateオブジェクト、変換失敗時はnull
 */
function amazon_amazon_parseDateOnly(dateValue) {
  if (!dateValue) return null;
  
  let targetDate;
  
  if (dateValue instanceof Date) {
    targetDate = dateValue;
  } else {
    const dateString = String(dateValue);
    // "2025/11/30 14:20:38 JST" のような形式から日付部分を抽出
    const dateMatch = dateString.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch) {
      targetDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
    } else {
      // 別の形式の場合はDateオブジェクトに変換を試みる
      targetDate = new Date(dateString);
    }
  }
  
  if (isNaN(targetDate.getTime())) {
    return null;
  }
  
  // 時刻を0時0分0秒にリセットして日付のみにする
  return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
}

function amazon_transferToProductSheet() {
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
    transferredCount = amazon_processTransferRows(amazonData, amazonSalesSheet, productSheet, startIndex);
    
    console.log(`${transferredCount}行のデータを商品管理シートに転記しました。`);
    return `${transferredCount}行のデータを商品管理シートに転記しました。`;
    
  } catch (error) {
    console.error("商品管理シート転記エラー:", error);
    throw error;
  }
}

function amazon_processTransferRows(amazonData, amazonSalesSheet, productSheet, startIndex) {
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
        // 注文の処理
        success = amazon_transferSalesData(amazonSalesSheet, productSheet, row, targetRow);
        break;
        
      case "返金":
        // 返金の処理
        success = amazon_processRefundData(amazonSalesSheet, productSheet, row, targetRow);
        break;
        
      case "配送サービス":
        // 配送サービスの処理
        success = amazon_processShippingService(amazonSalesSheet, productSheet, row, targetRow);
        break;
        
      case "調整":
        // 調整の処理
        success = amazon_processAdjustmentData(amazonSalesSheet, productSheet, row, targetRow, amazonData[i]);
        break;
        
      default:
        // 未対応のトランザクション種類
        console.log(`行 ${row}: 未対応のトランザクション種類: ${transactionType}`);
        success = false;
        break;
    }
    
    if (success) {
      transferredCount++;
    }
  }
  
  return transferredCount;
}

function amazon_transferSalesData(amazonSalesSheet, productSheet, sourceRow, targetRow) {
  try {
    // targetRowがカンマ区切りの場合に分割して処理
    const targetRows = String(targetRow).split(",").map(row => parseInt(row.trim())).filter(row => !isNaN(row));
    
    if (targetRows.length === 0) {
      console.log(`${sourceRow}行目: 有効な転記先行番号が見つかりません（${targetRow}）`);
      return false;
    }
    
    // 売上データの取得
    const saleDate = amazonSalesSheet.getRange(sourceRow, 6).getValue(); // F列
    const sPrice = amazonSalesSheet.getRange(sourceRow, 19).getValue() || 0; // S列
    const tPrice = amazonSalesSheet.getRange(sourceRow, 20).getValue() || 0; // T列
    const revenue = amazonSalesSheet.getRange(sourceRow, 33).getValue() || 0; // AG列
    
    // 日付をDateオブジェクトに変換
    const formattedDate = amazon_parseDateOnly(saleDate);
    
    // 販売価格（S列＋T列）を行数で分割
    const totalSalePrice = Number(sPrice) + Number(tPrice);
    const dividedSalePrice = totalSalePrice / targetRows.length;
    
    // 入金価格（AG列）を行数で分割
    const totalRevenue = Number(revenue);
    const dividedRevenue = totalRevenue / targetRows.length;
    
    // 複数の商品管理シート行に転記
    let successCount = 0;
    for (const row of targetRows) {
      try {
        // 商品管理シートに転記
        if (formattedDate) {
          const cell = productSheet.getRange(row, 28);
          cell.setValue(formattedDate);
          cell.setNumberFormat("yyyy/mm/dd"); // 日付形式を設定
        }
        
        if (totalSalePrice !== 0) {
          productSheet.getRange(row, 29).setValue(dividedSalePrice); // AC列（販売価格）
        }
        
        if (revenue !== 0) {
          productSheet.getRange(row, 30).setValue(dividedRevenue); // AD列（入金価格）
        }
        
        // 売却廃却チェックボックスをTrueに設定
        productSheet.getRange(row, 32).setValue(true); // AF列（売却廃却）
        
        successCount++;
        console.log(`${sourceRow}行目の売上データを商品管理シート${row}行目に転記完了（販売価格: ${dividedSalePrice}, 入金価格: ${dividedRevenue}）`);
        
      } catch (rowError) {
        console.error(`${sourceRow}行目から商品管理シート${row}行目への転記エラー:`, rowError);
      }
    }
    
    if (successCount > 0) {
      // Amazon売上シートのA列に「転記済み」、E列に転記日を記録
      const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
      amazonSalesSheet.getRange(sourceRow, 1).setValue("転記済み"); // A列
      amazonSalesSheet.getRange(sourceRow, 5).setValue(today); // E列
      
      console.log(`${sourceRow}行目: ${successCount}行の転記が完了しました（${targetRows.join(",")}行目、各行 販売価格: ${dividedSalePrice}, 入金価格: ${dividedRevenue}）`);
      return true;
    } else {
      console.error(`${sourceRow}行目: すべての転記に失敗しました`);
      return false;
    }
    
  } catch (error) {
    console.error(`${sourceRow}行目の売上データ転記エラー:`, error);
    return false;
  }
}

function amazon_processRefundData(amazonSalesSheet, productSheet, sourceRow, targetRow) {
  try {
    // targetRowがカンマ区切りの場合に分割して処理
    const targetRows = String(targetRow).split(",").map(row => parseInt(row.trim())).filter(row => !isNaN(row));
    
    if (targetRows.length === 0) {
      console.log(`${sourceRow}行目: 有効な返金対象行番号が見つかりません（${targetRow}）`);
      return false;
    }
    
    // 複数の商品管理シート行の売上データをクリア
    let successCount = 0;
    for (const row of targetRows) {
      try {
        // 商品管理シートの売上データをクリア
        productSheet.getRange(row, 28).clearContent(); // AB列（売上日）
        productSheet.getRange(row, 29).clearContent(); // AC列（販売価格）
        productSheet.getRange(row, 30).clearContent(); // AD列（入金価格）
        productSheet.getRange(row, 32).setValue(false); // AF列（売却廃却）をfalseに設定
        
        successCount++;
        console.log(`${sourceRow}行目の返金処理完了（商品管理シート${row}行目の売上データをクリア）`);
        
      } catch (rowError) {
        console.error(`${sourceRow}行目から商品管理シート${row}行目への返金処理エラー:`, rowError);
      }
    }
    
    if (successCount > 0) {
      // Amazon売上シートのA列に「返金処理済み」、E列に処理日を記録
      const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
      amazonSalesSheet.getRange(sourceRow, 1).setValue("返金処理済み"); // A列
      amazonSalesSheet.getRange(sourceRow, 5).setValue(today); // E列
      
      // B列から参照されている元の注文行も「返金処理済み」に更新
      try {
        const bColumnValue = amazonSalesSheet.getRange(sourceRow, 2).getValue(); // B列の値を取得
        if (bColumnValue && typeof bColumnValue === "string" && bColumnValue.startsWith("=B")) {
          // "=B123"のような形式から行番号を抽出
          const referencedRow = parseInt(bColumnValue.substring(2));
          if (!isNaN(referencedRow)) {
            amazonSalesSheet.getRange(referencedRow, 1).setValue("返金処理済み"); // 参照先行のA列
            console.log(`${referencedRow}行目（元の注文行）もA列を「返金処理済み」に更新しました`);
          }
        }
      } catch (refError) {
        console.error(`${sourceRow}行目の参照先行更新エラー:`, refError);
      }
      
      console.log(`${sourceRow}行目: ${successCount}行の返金処理が完了しました（${targetRows.join(",")}行目）`);
      return true;
    } else {
      console.error(`${sourceRow}行目: すべての返金処理に失敗しました`);
      return false;
    }
    
  } catch (error) {
    console.error(`${sourceRow}行目の返金処理エラー:`, error);
    return false;
  }
}

function amazon_amazon_processShippingService(amazonSalesSheet, productSheet, sourceRow, targetRow) {
  try {
    // targetRowがカンマ区切りの場合に分割して処理
    const targetRows = String(targetRow).split(",").map(row => parseInt(row.trim())).filter(row => !isNaN(row));
    
    if (targetRows.length === 0) {
      console.log(`${sourceRow}行目: 有効な配送サービス対象行番号が見つかりません（${targetRow}）`);
      return false;
    }
    
    // AG列のデータ取得
    const agData = amazonSalesSheet.getRange(sourceRow, 33).getValue(); // AG列
    
    if (agData) {
      // マイナス記号を除去
      let transferData = String(agData);
      if (transferData.startsWith("-")) {
        transferData = transferData.substring(1);
      }
      
      // 数値として処理して行数で分割
      const agValue = parseFloat(transferData);
      if (!isNaN(agValue)) {
        const dividedValue = agValue / targetRows.length;
        
        // 各行にAE列に分割された値を記入
        let successCount = 0;
        for (const row of targetRows) {
          try {
            productSheet.getRange(row, 31).setValue(dividedValue); // AE列
            successCount++;
            console.log(`${sourceRow}行目の配送サービスを商品管理シート${row}行目に記入（値: ${dividedValue}）`);
          } catch (rowError) {
            console.error(`${sourceRow}行目から商品管理シート${row}行目への配送サービス記入エラー:`, rowError);
          }
        }
        
        if (successCount > 0) {
          // Amazon売上シートのA列に「転記済み」、E列に転記日を記録
          const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
          amazonSalesSheet.getRange(sourceRow, 1).setValue("転記済み"); // A列
          amazonSalesSheet.getRange(sourceRow, 5).setValue(today); // E列
          
          console.log(`${sourceRow}行目: ${successCount}行の配送サービス処理が完了しました（${targetRows.join(",")}行目、各行${dividedValue}）`);
          return true;
        } else {
          console.error(`${sourceRow}行目: すべての配送サービス処理に失敗しました`);
          return false;
        }
      } else {
        // 数値でない場合は従来通り全行に同じ値を記入
        let successCount = 0;
        for (const row of targetRows) {
          try {
            productSheet.getRange(row, 31).setValue(transferData); // AE列
            successCount++;
            console.log(`${sourceRow}行目の配送サービスを商品管理シート${row}行目に記入（値: ${transferData}）`);
          } catch (rowError) {
            console.error(`${sourceRow}行目から商品管理シート${row}行目への配送サービス記入エラー:`, rowError);
          }
        }
        
        if (successCount > 0) {
          // Amazon売上シートのA列に「転記済み」、E列に転記日を記録
          const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
          amazonSalesSheet.getRange(sourceRow, 1).setValue("転記済み"); // A列
          amazonSalesSheet.getRange(sourceRow, 5).setValue(today); // E列
          
          console.log(`${sourceRow}行目: ${successCount}行の配送サービス処理が完了しました（${targetRows.join(",")}行目）`);
          return true;
        } else {
          console.error(`${sourceRow}行目: すべての配送サービス処理に失敗しました`);
          return false;
        }
      }
    } else {
      console.log(`${sourceRow}行目: AG列にデータがありません`);
      return false;
    }
    
  } catch (error) {
    console.error(`${sourceRow}行目の配送サービス処理エラー:`, error);
    return false;
  }
}

function amazon_amazon_processAdjustmentData(amazonSalesSheet, productSheet, sourceRow, targetRow, rowData) {
  try {
    // targetRowがカンマ区切りの場合に分割して処理
    const targetRows = String(targetRow).split(",").map(row => parseInt(row.trim())).filter(row => !isNaN(row));
    
    if (targetRows.length === 0) {
      console.log(`${sourceRow}行目: 有効な調整対象行番号が見つかりません（${targetRow}）`);
      return false;
    }
    
    // J列とL列の数値を取得
    const jValue = rowData[9] || 0; // J列（0ベースなので9）
    const lValue = parseInt(rowData[11]) || 1; // L列（0ベースなので11）
    
    // 売上データの取得
    const saleDate = rowData[5]; // F列（日付/時間）
    const sPrice = rowData[18] || 0; // S列（商品売上）
    const tPrice = rowData[19] || 0; // T列（商品の売上税）
    const revenue = rowData[32] || 0; // AG列（合計（振込金額））
    
    // 日付をDateオブジェクトに変換
    const formattedDate = amazon_parseDateOnly(saleDate);
    
    // L列の数値分だけ処理を繰り返す
    let totalSuccessCount = 0;
    const processedRows = [];
    
    for (let i = 0; i < lValue && i < targetRows.length; i++) {
      const row = targetRows[i];
      try {
        // 商品管理シートに転記（AC列は除く）
        if (formattedDate) {
          const cell = productSheet.getRange(row, 28);
          cell.setValue(formattedDate);
          cell.setNumberFormat("yyyy/mm/dd"); // 日付形式を設定
        }
        
        if (revenue !== 0) {
          productSheet.getRange(row, 30).setValue(revenue); // AD列（入金価格）
        }
        
        // 売却廃却チェックボックスをTrueに設定
        productSheet.getRange(row, 32).setValue(true); // AF列（売却廃却）
        
        totalSuccessCount++;
        processedRows.push(row);
        console.log(`${sourceRow}行目の調整データを商品管理シート${row}行目に転記完了`);
        
      } catch (rowError) {
        console.error(`${sourceRow}行目から商品管理シート${row}行目への調整転記エラー:`, rowError);
      }
    }
    
    if (totalSuccessCount > 0) {
      // Amazon売上シートのA列に「転記済み」、E列に転記日を記録
      const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
      amazonSalesSheet.getRange(sourceRow, 1).setValue("転記済み"); // A列
      amazonSalesSheet.getRange(sourceRow, 5).setValue(today); // E列
      
      console.log(`${sourceRow}行目: ${totalSuccessCount}行の調整処理が完了しました（${processedRows.join(",")}行目）`);
      return true;
    } else {
      console.error(`${sourceRow}行目: すべての調整処理に失敗しました`);
      return false;
    }
    
  } catch (error) {
    console.error(`${sourceRow}行目の調整処理エラー:`, error);
    return false;
  }
}