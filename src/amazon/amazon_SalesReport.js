/**
 * SP-API販売詳細レポート出力システム
 * 
 * Amazonセラーセントラルのペイメントレポート（トランザクション）と同等のデータを
 * Finances APIから取得し、CSVファイルとしてGoogleドライブに保存する
 */

// =============================================================================
// 定数定義
// =============================================================================

const CSV_HEADERS = [
  "日付/時間",
  "決済番号",
  "トランザクションの種類",
  "注文番号",
  "SKU",
  "商品名",
  "数量",
  "Amazon 出品サービス",
  "フルフィルメント",
  "市町村",
  "都道府県",
  "郵便番号",
  "税金徴収型",
  "商品売上",
  "商品の売上税",
  "配送料",
  "配送料の税金",
  "ギフト包装手数料",
  "ギフト包装クレジットの税金",
  "Amazonポイントの費用",
  "プロモーション割引額",
  "プロモーション割引の税金",
  "源泉徴収税を伴うマーケットプレイス",
  "手数料",
  "FBA 手数料",
  "トランザクションに関するその他の手数料",
  "その他",
  "合計"
];

// =============================================================================
// メニュー・UI関連
// =============================================================================

/**
 * 月選択ダイアログを表示する
 */
function amazon_showMonthSelectionDialog() {
  const html = HtmlService.createHtmlOutput(amazon_getDialogHtml())
    .setWidth(350)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, "対象月を選択");
}

/**
 * ダイアログのHTMLを生成する
 */
function amazon_amazon_getDialogHtml() {
  // デフォルト値として前月を設定
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultValue = Utilities.amazon_formatDate(lastMonth, "Asia/Tokyo", "yyyyMM");
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        input[type="text"] {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
        }
        .button-group {
          text-align: right;
          margin-top: 20px;
        }
        button {
          padding: 8px 16px;
          margin-left: 10px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-primary {
          background-color: #4285f4;
          color: white;
        }
        .btn-secondary {
          background-color: #f1f1f1;
          color: #333;
        }
        .hint {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="form-group">
        <label for="targetMonth">対象月（YYYYMM形式）</label>
        <input type="text" id="targetMonth" value="${defaultValue}" placeholder="例: 202501">
        <div class="hint">例: 2025年1月の場合は「202501」と入力</div>
      </div>
      <div class="button-group">
        <button class="btn-secondary" onclick="google.script.host.close()">キャンセル</button>
        <button class="btn-primary" onclick="executeReport()">実行</button>
      </div>
      <script>
        function executeReport() {
          const targetMonth = document.getElementById("targetMonth").value.trim();
          
          // バリデーション
          if (!/^\\d{6}$/.test(targetMonth)) {
            alert("YYYYMM形式で入力してください（例: 202501）");
            return;
          }
          
          const year = parseInt(targetMonth.substring(0, 4), 10);
          const month = parseInt(targetMonth.substring(4, 6), 10);
          
          if (month < 1 || month > 12) {
            alert("月は01〜12の範囲で入力してください");
            return;
          }
          
          // 未来の月チェック
          const now = new Date();
          const inputDate = new Date(year, month - 1, 1);
          if (inputDate > now) {
            alert("未来の月は指定できません");
            return;
          }
          
          // 処理実行
          document.body.innerHTML = "<p>処理中です。しばらくお待ちください...</p>";
          google.script.run
            .withSuccessHandler(function(result) {
              alert(result);
              google.script.host.close();
            })
            .withFailureHandler(function(error) {
              alert("エラーが発生しました:\\n" + error.message);
              google.script.host.close();
            })
            .generateReport(targetMonth);
        }
      </script>
    </body>
    </html>
  `;
}

// =============================================================================
// メイン処理
// =============================================================================

/**
 * レポート生成のメイン関数
 * @param {string} targetMonth - 対象月（YYYYMM形式）
 * @returns {string} 完了メッセージ
 */
function amazon_generateReport(targetMonth) {
  console.log(`レポート生成開始: ${targetMonth}`);
  
  // 対象期間を計算
  const year = parseInt(targetMonth.substring(0, 4), 10);
  const month = parseInt(targetMonth.substring(4, 6), 10);
  const { startDate, endDate } = amazon_getDateRange(year, month);
  
  console.log(`対象期間: ${startDate.toISOString()} 〜 ${endDate.toISOString()}`);
  
  // アクセストークンを取得
  const accessToken = amazon_getAccessToken();
  
  // Finances APIからデータを取得
  const financialEvents = amazon_fetchFinancialEvents(accessToken, startDate, endDate);
  console.log(`取得したイベント数: ${financialEvents.length}`);
  
  // CSVデータに変換
  const csvRows = amazon_convertToCsvRows(financialEvents);
  console.log(`CSV行数: ${csvRows.length}`);
  
  // CSVファイルを作成してドライブに保存
  const fileName = amazon_saveToGoogleDrive(csvRows, targetMonth);
  
  console.log(`レポート生成完了: ${fileName}`);
  return `レポートを作成しました。\n\nファイル名: ${fileName}`;
}

/**
 * 対象月の開始日と終了日を取得する
 * @param {number} year - 年
 * @param {number} month - 月（1-12）
 * @returns {Object} 開始日と終了日
 */
function amazon_amazon_getDateRange(year, month) {
  // JST基準で開始日時を設定（月初 00:00:00 JST）
  const startDate = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0, 0));
  
  // JST基準で終了日時を設定（月末 23:59:59.999 JST）
  const endDate = new Date(Date.UTC(year, month, 1, -9, 0, 0, -1));
  
  return { startDate, endDate };
}

// =============================================================================
// SP-API認証
// =============================================================================

/**
 * LWAアクセストークンを取得する
 * @returns {string} アクセストークン
 */
function amazon_amazon_getAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty("LWA_CLIENT_ID");
  const clientSecret = props.getProperty("LWA_CLIENT_SECRET");
  const refreshToken = props.getProperty("LWA_REFRESH_TOKEN");
  const tokenEndpoint = props.getProperty("LWA_TOKEN_ENDPOINT");
  
  if (!clientId || !clientSecret || !refreshToken || !tokenEndpoint) {
    throw new Error("LWA認証情報がスクリプトプロパティに設定されていません");
  }
  
  const payload = {
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  };
  
  const options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: payload,
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(tokenEndpoint, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode !== 200) {
    console.error(`LWA認証エラー: ${responseBody}`);
    throw new Error(`LWA認証に失敗しました（ステータス: ${responseCode}）`);
  }
  
  const tokenData = JSON.parse(responseBody);
  return tokenData.access_token;
}

// =============================================================================
// Finances API
// =============================================================================

/**
 * Finances APIからファイナンシャルイベントを取得する
 * @param {string} accessToken - アクセストークン
 * @param {Date} startDate - 開始日
 * @param {Date} endDate - 終了日
 * @returns {Array} ファイナンシャルイベントの配列
 */
function amazon_amazon_fetchFinancialEvents(accessToken, startDate, endDate) {
  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty("SP_API_ENDPOINT");
  
  if (!endpoint) {
    throw new Error("SP_API_ENDPOINTがスクリプトプロパティに設定されていません");
  }
  
  const allEvents = [];
  let nextToken = null;
  let pageCount = 0;
  const maxPages = 100; // 無限ループ防止
  
  do {
    pageCount++;
    console.log(`Finances API呼び出し: ページ ${pageCount}`);
    
    // APIリクエストURLを構築
    let url = `${endpoint}/finances/v0/financialEvents`;
    const params = new URLSearchParams();
    
    if (nextToken) {
      params.append("NextToken", nextToken);
    } else {
      params.append("PostedAfter", startDate.toISOString());
      params.append("PostedBefore", endDate.toISOString());
    }
    
    url += "?" + params.toString();
    
    const options = {
      method: "get",
      headers: {
        "x-amz-access-token": accessToken,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    // レート制限対応（429エラー）
    if (responseCode === 429) {
      console.log("レート制限に達しました。5秒待機します...");
      Utilities.sleep(5000);
      continue;
    }
    
    if (responseCode !== 200) {
      console.error(`Finances APIエラー: ${responseBody}`);
      throw new Error(`Finances APIの呼び出しに失敗しました（ステータス: ${responseCode}）`);
    }
    
    const data = JSON.parse(responseBody);
    const payload = data.payload || {};
    const financialEvents = payload.FinancialEvents || {};
    
    // 各種イベントを収集
    amazon_collectShipmentEvents(financialEvents.ShipmentEventList, allEvents);
    amazon_collectRefundEvents(financialEvents.RefundEventList, allEvents);
    amazon_collectServiceFeeEvents(financialEvents.ServiceFeeEventList, allEvents);
    amazon_collectAdjustmentEvents(financialEvents.AdjustmentEventList, allEvents);
    
    nextToken = payload.NextToken || null;
    
    // レート制限を考慮して待機
    Utilities.sleep(2000);
    
  } while (nextToken && pageCount < maxPages);
  
  if (pageCount >= maxPages) {
    console.warn("最大ページ数に達しました。一部のデータが取得できていない可能性があります。");
  }
  
  return allEvents;
}

/**
 * 出荷イベントを収集する
 */
function amazon_amazon_collectShipmentEvents(shipmentEventList, allEvents) {
  if (!shipmentEventList) return;
  
  for (const event of shipmentEventList) {
    const postedDate = event.PostedDate || "";
    const orderId = event.AmazonOrderId || "";
    const marketplaceName = event.MarketplaceName || "";
    
    const itemList = event.ShipmentItemList || [];
    for (const item of itemList) {
      const row = amazon_createEventRow(postedDate, "Order", orderId, item, marketplaceName);
      allEvents.push(row);
    }
  }
}

/**
 * 返金イベントを収集する
 */
function amazon_amazon_collectRefundEvents(refundEventList, allEvents) {
  if (!refundEventList) return;
  
  for (const event of refundEventList) {
    const postedDate = event.PostedDate || "";
    const orderId = event.AmazonOrderId || "";
    const marketplaceName = event.MarketplaceName || "";
    
    const itemList = event.ShipmentItemAdjustmentList || [];
    for (const item of itemList) {
      const row = amazon_createEventRow(postedDate, "Refund", orderId, item, marketplaceName);
      allEvents.push(row);
    }
  }
}

/**
 * サービス料金イベントを収集する
 */
function amazon_amazon_collectServiceFeeEvents(serviceFeeEventList, allEvents) {
  if (!serviceFeeEventList) return;
  
  for (const event of serviceFeeEventList) {
    const row = {
      dateTime: "",
      settlementId: "",
      transactionType: "Service Fee",
      orderId: event.AmazonOrderId || "",
      sku: event.SellerSKU || "",
      productName: "",
      quantity: "",
      amazonService: "",
      fulfillment: "",
      city: "",
      state: "",
      postalCode: "",
      taxCollectionModel: "",
      productSales: 0,
      productSalesTax: 0,
      shippingCredits: 0,
      shippingCreditsTax: 0,
      giftWrapCredits: 0,
      giftWrapCreditsTax: 0,
      pointsFee: 0,
      promotionalRebates: 0,
      promotionalRebatesTax: 0,
      withholdingTax: "",
      sellingFees: amazon_sumFeeList(event.FeeList),
      fbaFees: 0,
      otherTransactionFees: 0,
      other: 0,
      total: amazon_sumFeeList(event.FeeList)
    };
    allEvents.push(row);
  }
}

/**
 * 調整イベントを収集する
 */
function amazon_amazon_collectAdjustmentEvents(adjustmentEventList, allEvents) {
  if (!adjustmentEventList) return;
  
  for (const event of adjustmentEventList) {
    const postedDate = event.PostedDate || "";
    const adjustmentType = event.AdjustmentType || "Adjustment";
    
    const itemList = event.AdjustmentItemList || [];
    for (const item of itemList) {
      const row = {
        dateTime: amazon_formatDate(postedDate),
        settlementId: "",
        transactionType: adjustmentType,
        orderId: "",
        sku: item.SellerSKU || "",
        productName: "",
        quantity: item.Quantity || "",
        amazonService: "",
        fulfillment: "",
        city: "",
        state: "",
        postalCode: "",
        taxCollectionModel: "",
        productSales: 0,
        productSalesTax: 0,
        shippingCredits: 0,
        shippingCreditsTax: 0,
        giftWrapCredits: 0,
        giftWrapCreditsTax: 0,
        pointsFee: 0,
        promotionalRebates: 0,
        promotionalRebatesTax: 0,
        withholdingTax: "",
        sellingFees: 0,
        fbaFees: 0,
        otherTransactionFees: 0,
        other: amazon_getAmountValue(item.TotalAmount),
        total: amazon_getAmountValue(item.TotalAmount)
      };
      allEvents.push(row);
    }
  }
}

/**
 * イベント行を作成する
 */
function amazon_amazon_createEventRow(postedDate, transactionType, orderId, item, marketplaceName) {
  const itemChargeList = item.ItemChargeList || [];
  const itemFeeList = item.ItemFeeList || [];
  const promotionList = item.PromotionList || [];
  
  // 各種金額を集計
  const charges = amazon_sumChargesByType(itemChargeList);
  const fees = amazon_sumFeesByType(itemFeeList);
  const promotions = amazon_sumPromotions(promotionList);
  
  // 合計を計算
  const total = 
    charges.principal + charges.principalTax +
    charges.shipping + charges.shippingTax +
    charges.giftWrap + charges.giftWrapTax +
    fees.commission + fees.fba + fees.other +
    promotions.total +
    amazon_getAmountValue(item.PointsGranted?.PointsMonetaryValue) * -1;
  
  return {
    dateTime: amazon_formatDate(postedDate),
    settlementId: "",
    transactionType: transactionType,
    orderId: orderId,
    sku: item.SellerSKU || "",
    productName: item.ProductDescription || "",
    quantity: item.QuantityShipped || item.Quantity || "",
    amazonService: marketplaceName,
    fulfillment: amazon_detectFulfillment(itemFeeList),
    city: "",
    state: "",
    postalCode: "",
    taxCollectionModel: "",
    productSales: charges.principal,
    productSalesTax: charges.principalTax,
    shippingCredits: charges.shipping,
    shippingCreditsTax: charges.shippingTax,
    giftWrapCredits: charges.giftWrap,
    giftWrapCreditsTax: charges.giftWrapTax,
    pointsFee: amazon_getAmountValue(item.PointsGranted?.PointsMonetaryValue) * -1,
    promotionalRebates: promotions.total,
    promotionalRebatesTax: 0,
    withholdingTax: "",
    sellingFees: fees.commission,
    fbaFees: fees.fba,
    otherTransactionFees: fees.other,
    other: 0,
    total: total
  };
}

/**
 * 請求タイプ別に金額を集計する
 */
function amazon_amazon_sumChargesByType(chargeList) {
  const result = {
    principal: 0,
    principalTax: 0,
    shipping: 0,
    shippingTax: 0,
    giftWrap: 0,
    giftWrapTax: 0
  };
  
  for (const charge of chargeList) {
    const chargeType = charge.ChargeType || "";
    const amount = amazon_getAmountValue(charge.ChargeAmount);
    
    switch (chargeType) {
      case "Principal":
        result.principal += amount;
        break;
      case "Tax":
        result.principalTax += amount;
        break;
      case "ShippingCharge":
        result.shipping += amount;
        break;
      case "ShippingTax":
        result.shippingTax += amount;
        break;
      case "GiftWrap":
        result.giftWrap += amount;
        break;
      case "GiftWrapTax":
        result.giftWrapTax += amount;
        break;
    }
  }
  
  return result;
}

/**
 * 手数料タイプ別に金額を集計する
 */
function amazon_amazon_sumFeesByType(feeList) {
  const result = {
    commission: 0,
    fba: 0,
    other: 0
  };
  
  const fbaFeeTypes = [
    "FBAPerUnitFulfillmentFee",
    "FBAPerOrderFulfillmentFee",
    "FBAWeightBasedFee",
    "FBAPickAndPack"
  ];
  
  const commissionTypes = [
    "Commission",
    "ReferralFee"
  ];
  
  for (const fee of feeList) {
    const feeType = fee.FeeType || "";
    const amount = amazon_getAmountValue(fee.FeeAmount);
    
    if (commissionTypes.includes(feeType)) {
      result.commission += amount;
    } else if (fbaFeeTypes.some(t => feeType.includes(t) || feeType.startsWith("FBA"))) {
      result.fba += amount;
    } else {
      result.other += amount;
    }
  }
  
  return result;
}

/**
 * プロモーション金額を集計する
 */
function amazon_amazon_sumPromotions(promotionList) {
  let total = 0;
  
  for (const promo of promotionList) {
    total += amazon_getAmountValue(promo.PromotionAmount);
  }
  
  return { total };
}

/**
 * 手数料リストの合計を計算する
 */
function amazon_amazon_sumFeeList(feeList) {
  if (!feeList) return 0;
  
  let total = 0;
  for (const fee of feeList) {
    total += amazon_getAmountValue(fee.FeeAmount);
  }
  return total;
}

/**
 * 金額オブジェクトから数値を取得する
 */
function amazon_amazon_getAmountValue(amountObj) {
  if (!amountObj) return 0;
  return parseFloat(amountObj.CurrencyAmount) || 0;
}

/**
 * FBA/MFNを判定する
 */
function amazon_amazon_detectFulfillment(feeList) {
  if (!feeList) return "";
  
  for (const fee of feeList) {
    const feeType = fee.FeeType || "";
    if (feeType.startsWith("FBA") || feeType.includes("Fulfillment")) {
      return "Amazon";
    }
  }
  return "出品者";
}

/**
 * 日付をフォーマットする
 */
function amazon_amazon_formatDate(isoDateString) {
  if (!isoDateString) return "";
  
  try {
    const date = new Date(isoDateString);
    return Utilities.amazon_formatDate(date, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
  } catch (e) {
    return isoDateString;
  }
}

// =============================================================================
// CSV出力
// =============================================================================

/**
 * イベントデータをCSV行に変換する
 */
function amazon_amazon_convertToCsvRows(events) {
  const rows = [];
  
  // ヘッダー行
  rows.push(CSV_HEADERS);
  
  // データ行
  for (const event of events) {
    const row = [
      event.dateTime,
      event.settlementId,
      event.transactionType,
      event.orderId,
      event.sku,
      event.productName,
      event.quantity,
      event.amazonService,
      event.fulfillment,
      event.city,
      event.state,
      event.postalCode,
      event.taxCollectionModel,
      amazon_formatNumber(event.productSales),
      amazon_formatNumber(event.productSalesTax),
      amazon_formatNumber(event.shippingCredits),
      amazon_formatNumber(event.shippingCreditsTax),
      amazon_formatNumber(event.giftWrapCredits),
      amazon_formatNumber(event.giftWrapCreditsTax),
      amazon_formatNumber(event.pointsFee),
      amazon_formatNumber(event.promotionalRebates),
      amazon_formatNumber(event.promotionalRebatesTax),
      event.withholdingTax,
      amazon_formatNumber(event.sellingFees),
      amazon_formatNumber(event.fbaFees),
      amazon_formatNumber(event.otherTransactionFees),
      amazon_formatNumber(event.other),
      amazon_formatNumber(event.total)
    ];
    rows.push(row);
  }
  
  return rows;
}

/**
 * 数値をフォーマットする
 */
function amazon_amazon_formatNumber(value) {
  if (value === 0 || value === null || value === undefined) {
    return "0";
  }
  return value.toString();
}

/**
 * CSVファイルをGoogleドライブに保存する
 */
function amazon_amazon_saveToGoogleDrive(csvRows, targetMonth) {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("DRIVE_FOLDER_ID");
  
  if (!folderId) {
    throw new Error("DRIVE_FOLDER_IDがスクリプトプロパティに設定されていません");
  }
  
  const folder = DriveApp.getFolderById(folderId);
  
  // ファイル名を決定（重複時は連番付与）
  const baseFileName = `販売詳細レポート_${targetMonth}`;
  const fileName = amazon_getUniqueFileName(folder, baseFileName, "csv");
  
  // CSV文字列を生成（BOM付きUTF-8）
  const csvContent = csvRows.map(row => 
    row.map(cell => amazon_escapeCsvCell(cell)).join(",")
  ).join("\r\n");
  
  const bom = "\uFEFF";
  const blob = Utilities.newBlob(bom + csvContent, "text/csv", fileName);
  
  // ファイルを保存
  folder.createFile(blob);
  
  return fileName;
}

/**
 * 重複しないファイル名を取得する
 */
function amazon_amazon_getUniqueFileName(folder, baseName, extension) {
  let fileName = `${baseName}.${extension}`;
  let counter = 1;
  
  while (folder.getFilesByName(fileName).hasNext()) {
    fileName = `${baseName}_${counter}.${extension}`;
    counter++;
  }
  
  return fileName;
}

/**
 * CSVセルをエスケープする
 */
function amazon_amazon_escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  
  const strValue = String(value);
  
  // カンマ、ダブルクォート、改行を含む場合はエスケープ
  if (strValue.includes(",") || strValue.includes("\"") || strValue.includes("\n") || strValue.includes("\r")) {
    return "\"" + strValue.replace(/"/g, "\"\"") + "\"";
  }
  
  return strValue;
}