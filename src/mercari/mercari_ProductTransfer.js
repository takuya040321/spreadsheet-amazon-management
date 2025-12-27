/**
 * メルカリ売上シート商品管理シート転記機能
 * メルカリ売上データを商品管理シートに転記する
 */

function mercari_transferToProductSheet() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const mercariSalesSheet = spreadsheet.getSheetByName("メルカリ売上");
    const productSheet = spreadsheet.getSheetByName("商品管理");
    
    if (!mercariSalesSheet) {
      throw new Error("メルカリ売上シートが見つかりません。");
    }
    
    if (!productSheet) {
      throw new Error("商品管理シートが見つかりません。");
    }
    
    const lastRow = mercariSalesSheet.getLastRow();
    let transferredCount = 0;
    
    // メルカリ売上シートの全データを一括取得
    const mercariData = mercariSalesSheet.getRange(3, 1, lastRow - 2, mercariSalesSheet.getLastColumn()).getValues();

    // A列の空白の最初の行を効率的に取得
    const aColumn = mercariData.map(row => row[0]); // A列のデータのみ抽出
    const startIndex = aColumn.findIndex(value => value === "" || value === null);
    
    // 処理対象行が見つからない場合は処理終了
    if (startIndex === -1) {
      console.log("A列に空白行が見つかりませんでした");
      return "転記対象の空白行がありませんでした。";
    }
    
    // 空白行から処理開始
    transferredCount = mercari_processTransferRows(mercariData, mercariSalesSheet, productSheet, startIndex);
    
    console.log(`${transferredCount}行のデータを商品管理シートに転記しました。`);
    return `${transferredCount}行のデータを商品管理シートに転記しました。`;
    
  } catch (error) {
    console.error("商品管理シート転記エラー:", error);
    throw error;
  }
}

function mercari_processTransferRows(mercariData, mercariSalesSheet, productSheet, startIndex) {
  let transferredCount = 0;
  
  for (let i = startIndex; i < mercariData.length; i++) {
    const row = i + 3; // 実際の行番号（3行目から開始）
    const status = mercariData[i][0]; // A列のステータス
    const targetRow = mercariData[i][1]; // B列の行番号
    
    // A列が空白でない行はスキップ
    if (status !== "" && status !== null) {
      continue;
    }
    
    // B列が空白の場合はスキップ
    if (!targetRow || targetRow === "" || targetRow === null) {
      console.log(`${row}行目: B列（転記先行番号）が空白のためスキップ`);
      continue;
    }
    
    try {
      // targetRowがカンマ区切りの場合に分割して処理
      const targetRows = String(targetRow).split(",").map(row => parseInt(row.trim())).filter(row => !isNaN(row));
      
      if (targetRows.length === 0) {
        console.log(`${row}行目: 有効な転記先行番号が見つかりません（${targetRow}）`);
        continue;
      }
      
      // メルカリ売上データの取得
      const saleDate = mercariSalesSheet.getRange(row, 13).getValue(); // M列（売上日）
      const salePrice = mercariSalesSheet.getRange(row, 19).getValue() || 0; // S列（売上価格）
      const revenue = mercariSalesSheet.getRange(row, 18).getValue() || 0; // R列（入金額）
      
      // 日付をYYYY/MM/DD形式に変換
      let formattedDate = "";
      if (saleDate instanceof Date) {
        formattedDate = Utilities.formatDate(saleDate, "Asia/Tokyo", "yyyy/MM/dd");
      } else if (saleDate) {
        formattedDate = String(saleDate);
      }
      
      // 販売価格を行数で分割
      const totalSalePrice = Number(salePrice);
      const dividedSalePrice = totalSalePrice / targetRows.length;
      
      // 入金価格を行数で分割
      const totalRevenue = Number(revenue);
      const dividedRevenue = totalRevenue / targetRows.length;
      
      // 複数の商品管理シート行に転記
      let successCount = 0;
      for (const targetRowNum of targetRows) {
        try {
          // 商品管理シートに転記
          if (formattedDate) {
            productSheet.getRange(targetRowNum, 28).setValue(formattedDate); // AB列（売上日）
          }
          
          if (totalSalePrice !== 0) {
            productSheet.getRange(targetRowNum, 29).setValue(dividedSalePrice); // AC列（販売価格）
          }
          
          if (totalRevenue !== 0) {
            productSheet.getRange(targetRowNum, 30).setValue(dividedRevenue); // AD列（入金価格）
          }
          
          // 売却廃却チェックボックスをTrueに設定
          productSheet.getRange(targetRowNum, 32).setValue(true); // AF列（売却廃却）
          
          successCount++;
          console.log(`${row}行目のメルカリ売上データを商品管理シート${targetRowNum}行目に転記完了（販売価格: ${dividedSalePrice}, 入金価格: ${dividedRevenue}）`);
          
        } catch (rowError) {
          console.error(`${row}行目から商品管理シート${targetRowNum}行目への転記エラー:`, rowError);
        }
      }
      
      if (successCount > 0) {
        // メルカリ売上シートのA列に「転記済み」、E列に転記日を記録
        const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
        mercariSalesSheet.getRange(row, 1).setValue("転記済み"); // A列
        mercariSalesSheet.getRange(row, 5).setValue(today); // E列
        
        console.log(`${row}行目: ${successCount}行の転記が完了しました（${targetRows.join(",")}行目、各行 販売価格: ${dividedSalePrice}, 入金価格: ${dividedRevenue}）`);
        transferredCount++;
      } else {
        console.error(`${row}行目: すべての転記に失敗しました`);
      }
      
    } catch (error) {
      console.error(`${row}行目のメルカリ売上データ転記エラー:`, error);
    }
  }
  
  return transferredCount;
}

