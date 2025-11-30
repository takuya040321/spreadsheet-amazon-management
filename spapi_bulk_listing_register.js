/**
 * Amazon SP-API 商品登録スクリプト
 * 
 * 【セットアップ手順】
 * 1. このコードをGASエディタに貼り付け
 * 2. CONFIG内の認証情報を設定
 * 3. スプレッドシートにボタンを配置し、registerSelectedProducts関数を割り当て
 */

// ============================================
// 設定（ここに認証情報を入力）
// ============================================
const CONFIG = {
    // LWA認証情報
    LWA_CLIENT_ID: "ここにClient IDを入力",
    LWA_CLIENT_SECRET: "ここにClient Secretを入力",
    LWA_REFRESH_TOKEN: "ここにRefresh Tokenを入力",
    
    // SP-API情報
    SELLER_ID: "ここにセラーIDを入力",
    MARKETPLACE_ID: "A1VC38T7YXB528", // 日本
    
    // APIエンドポイント（日本）
    SP_API_ENDPOINT: "https://sellingpartnerapi-fe.amazon.com",
    LWA_TOKEN_ENDPOINT: "https://api.amazon.com/auth/o2/token",
    
    // スプレッドシート列設定（1始まり）
    COLUMN: {
      CHECKBOX: 1,     // A列：チェックボックス
      PRODUCT_NAME: 5, // E列：商品名（結果表示用）
      ASIN: 6,         // F列：ASIN
      PRICE: 8,        // H列：価格
      SKU: 24          // X列：SKU
    },
    
    // データ開始行（ヘッダー行の次）
    DATA_START_ROW: 3  // 2行目がヘッダー、3行目からデータ
  };
  
  // ============================================
  // メイン関数（ボタンから呼び出す）
  // ============================================
  function registerSelectedProducts() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    // データがない場合
    if (lastRow < CONFIG.DATA_START_ROW) {
      showResult("エラー", "処理対象のデータがありません。");
      return;
    }
    
    // アクセストークンを取得
    let accessToken;
    try {
      accessToken = getAccessToken();
    } catch (e) {
      showResult("認証エラー", "アクセストークンの取得に失敗しました。\n" + e.message);
      return;
    }
    
    // チェックされた行を取得
    const dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, CONFIG.COLUMN.SKU);
    const data = dataRange.getValues();
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // 各行を処理
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const isChecked = row[CONFIG.COLUMN.CHECKBOX - 1];
      
      // チェックされていない行はスキップ
      if (isChecked !== true) {
        continue;
      }
      
      const rowNumber = i + CONFIG.DATA_START_ROW;
      const asin = String(row[CONFIG.COLUMN.ASIN - 1]).trim();
      const sku = String(row[CONFIG.COLUMN.SKU - 1]).trim();
      const price = row[CONFIG.COLUMN.PRICE - 1];
      
      // 必須項目のバリデーション
      if (!asin || !sku) {
        const result = {
          row: rowNumber,
          sku: sku || "(未設定)",
          asin: asin || "(未設定)",
          status: "エラー",
          errorType: "VALIDATION",
          message: "ASINまたはSKUが空です"
        };
        results.push(result);
        updateResultCell(sheet, rowNumber, result);
        errorCount++;
        continue;
      }
      
      if (!price || isNaN(price) || price <= 0) {
        const result = {
          row: rowNumber,
          sku: sku,
          asin: asin,
          status: "エラー",
          errorType: "VALIDATION",
          message: "価格が無効です"
        };
        results.push(result);
        updateResultCell(sheet, rowNumber, result);
        errorCount++;
        continue;
      }
      
      // 商品登録APIを呼び出し
      try {
        const response = putListing(accessToken, sku, asin, price);
        const result = {
          row: rowNumber,
          sku: sku,
          asin: asin,
          status: "成功",
          errorType: null,
          message: response.status || "登録完了"
        };
        results.push(result);
        updateResultCell(sheet, rowNumber, result);
        successCount++;
      } catch (e) {
        const errorType = detectErrorType(e.message);
        const result = {
          row: rowNumber,
          sku: sku,
          asin: asin,
          status: "エラー",
          errorType: errorType,
          message: e.message
        };
        results.push(result);
        updateResultCell(sheet, rowNumber, result);
        errorCount++;
      }
      
      // API制限対策：リクエスト間に待機時間を入れる
      Utilities.sleep(500);
    }
    
    // 結果がない場合
    if (results.length === 0) {
      showResult("情報", "チェックされた行がありません。");
      return;
    }
    
    // 結果を表示
    showResultDialog(results, successCount, errorCount);
  }
  
  // ============================================
  // LWAアクセストークン取得
  // ============================================
  function getAccessToken() {
    const payload = {
      grant_type: "refresh_token",
      refresh_token: CONFIG.LWA_REFRESH_TOKEN,
      client_id: CONFIG.LWA_CLIENT_ID,
      client_secret: CONFIG.LWA_CLIENT_SECRET
    };
    
    const options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: payload,
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(CONFIG.LWA_TOKEN_ENDPOINT, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode !== 200) {
      throw new Error("トークン取得失敗 (HTTP " + statusCode + "): " + responseText);
    }
    
    const json = JSON.parse(responseText);
    
    if (!json.access_token) {
      throw new Error("アクセストークンが応答に含まれていません");
    }
    
    return json.access_token;
  }
  
  // ============================================
  // Listings API: 商品登録（PUT）
  // ============================================
  function putListing(accessToken, sku, asin, price) {
    const encodedSku = encodeURIComponent(sku);
    const url = CONFIG.SP_API_ENDPOINT + 
                "/listings/2021-08-01/items/" + 
                CONFIG.SELLER_ID + "/" + 
                encodedSku +
                "?marketplaceIds=" + CONFIG.MARKETPLACE_ID;
    
    // リクエストボディ
    const body = {
      productType: "PRODUCT",
      requirements: "LISTING",
      attributes: {
        condition_type: [
          {
            value: "new_new",
            marketplace_id: CONFIG.MARKETPLACE_ID
          }
        ],
        purchasable_offer: [
          {
            marketplace_id: CONFIG.MARKETPLACE_ID,
            currency: "JPY",
            our_price: [
              {
                schedule: [
                  {
                    value_with_tax: price
                  }
                ]
              }
            ]
          }
        ],
        fulfillment_availability: [
          {
            fulfillment_channel_code: "AMAZON_JP",
            marketplace_id: CONFIG.MARKETPLACE_ID
          }
        ],
        merchant_suggested_asin: [
          {
            value: asin,
            marketplace_id: CONFIG.MARKETPLACE_ID
          }
        ],
        // 電池/バッテリーが必要な商品ですか？ → いいえ
        batteries_required: [
          {
            value: false
          }
        ],
        // 商品に適用される危険物規制の種類 → 該当なし
        supplier_declared_dg_hz_regulation: [
          {
            value: "not_applicable"
          }
        ]
      }
    };
    
    const options = {
      method: "put",
      contentType: "application/json",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "x-amz-access-token": accessToken,
        "Accept": "application/json"
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // レスポンス解析
    let json;
    try {
      json = JSON.parse(responseText);
    } catch (e) {
      throw new Error("APIレスポンス解析失敗: " + responseText);
    }
    
    // エラーチェック（出品制限を含む）
    if (statusCode >= 400) {
      const errorInfo = analyzeError(json, statusCode);
      throw new Error(errorInfo.message);
    }
    
    // 警告やエラーがあれば抽出（出品制限チェック含む）
    if (json.issues && json.issues.length > 0) {
      const analysisResult = analyzeIssues(json.issues);
      if (analysisResult.hasRestriction) {
        throw new Error("【出品制限】" + analysisResult.message);
      }
      if (analysisResult.hasError) {
        throw new Error(analysisResult.message);
      }
      return { status: "登録完了（警告あり）: " + analysisResult.message };
    }
    
    return { status: "ACCEPTED" };
  }
  
  // ============================================
  // エラー解析（出品制限検出）
  // ============================================
  function analyzeError(json, statusCode) {
    let isRestriction = false;
    let messages = [];
    
    // errorsフィールドのチェック
    if (json.errors && json.errors.length > 0) {
      json.errors.forEach(function(err) {
        const code = err.code || "";
        const message = err.message || "";
        
        // 出品制限関連のエラーコードをチェック
        if (isRestrictionError(code, message)) {
          isRestriction = true;
          messages.push("【出品制限】" + message);
        } else {
          messages.push(message || code || JSON.stringify(err));
        }
      });
    }
    
    // issuesフィールドのチェック
    if (json.issues && json.issues.length > 0) {
      const analysisResult = analyzeIssues(json.issues);
      if (analysisResult.hasRestriction) {
        isRestriction = true;
      }
      messages.push(analysisResult.message);
    }
    
    // メッセージがない場合
    if (messages.length === 0) {
      if (json.message) {
        messages.push(json.message);
      } else {
        messages.push("HTTP " + statusCode + " エラー");
      }
    }
    
    return {
      isRestriction: isRestriction,
      message: messages.join("; ")
    };
  }
  
  // ============================================
  // Issuesの解析
  // ============================================
  function analyzeIssues(issues) {
    let hasRestriction = false;
    let hasError = false;
    let messages = [];
    
    issues.forEach(function(issue) {
      const code = issue.code || "";
      const message = issue.message || "";
      const severity = issue.severity || "";
      
      // 出品制限チェック
      if (isRestrictionError(code, message)) {
        hasRestriction = true;
        messages.push("【出品制限】" + (message || code));
      } 
      // エラー重大度チェック
      else if (severity === "ERROR") {
        hasError = true;
        messages.push("【エラー】" + (message || code));
      } 
      // 警告
      else {
        messages.push(message || code);
      }
    });
    
    return {
      hasRestriction: hasRestriction,
      hasError: hasError,
      message: messages.join("; ")
    };
  }
  
  // ============================================
  // 出品制限エラー判定
  // ============================================
  function isRestrictionError(code, message) {
    const restrictionPatterns = [
      // エラーコード
      "LISTING_RESTRICTED",
      "PRODUCT_RESTRICTED",
      "BRAND_RESTRICTED",
      "CATEGORY_RESTRICTED",
      "ASIN_RESTRICTED",
      "APPROVAL_REQUIRED",
      "QUALIFICATION_REQUIRED",
      "GATING",
      "UNGATING",
      // メッセージに含まれるキーワード
      "approval",
      "restriction",
      "restricted",
      "not authorized",
      "not eligible",
      "permission",
      "出品許可",
      "出品制限",
      "承認が必要",
      "許可が必要",
      "販売資格"
    ];
    
    const lowerCode = code.toLowerCase();
    const lowerMessage = message.toLowerCase();
    
    for (let i = 0; i < restrictionPatterns.length; i++) {
      const pattern = restrictionPatterns[i].toLowerCase();
      if (lowerCode.indexOf(pattern) !== -1 || lowerMessage.indexOf(pattern) !== -1) {
        return true;
      }
    }
    
    return false;
  }
  
  // ============================================
  // エラータイプ検出
  // ============================================
  function detectErrorType(message) {
    const lowerMessage = message.toLowerCase();
    
    // 出品制限
    if (lowerMessage.indexOf("【出品制限】") !== -1 ||
        lowerMessage.indexOf("restricted") !== -1 ||
        lowerMessage.indexOf("approval") !== -1 ||
        lowerMessage.indexOf("出品制限") !== -1 ||
        lowerMessage.indexOf("出品許可") !== -1) {
      return "RESTRICTION";
    }
    
    // ASIN関連エラー
    if (lowerMessage.indexOf("asin") !== -1 ||
        lowerMessage.indexOf("invalid_asin") !== -1 ||
        lowerMessage.indexOf("asin_not_found") !== -1 ||
        lowerMessage.indexOf("商品が見つかりません") !== -1) {
      return "ASIN_ERROR";
    }
    
    // SKU関連エラー
    if (lowerMessage.indexOf("sku") !== -1 ||
        lowerMessage.indexOf("duplicate") !== -1 ||
        lowerMessage.indexOf("already exists") !== -1 ||
        lowerMessage.indexOf("重複") !== -1) {
      return "SKU_ERROR";
    }
    
    // 価格関連エラー
    if (lowerMessage.indexOf("price") !== -1 ||
        lowerMessage.indexOf("pricing") !== -1 ||
        lowerMessage.indexOf("価格") !== -1) {
      return "PRICE_ERROR";
    }
    
    // 認証エラー
    if (lowerMessage.indexOf("unauthorized") !== -1 ||
        lowerMessage.indexOf("authentication") !== -1 ||
        lowerMessage.indexOf("token") !== -1 ||
        lowerMessage.indexOf("403") !== -1 ||
        lowerMessage.indexOf("401") !== -1 ||
        lowerMessage.indexOf("認証") !== -1) {
      return "AUTH_ERROR";
    }
    
    // レート制限
    if (lowerMessage.indexOf("throttl") !== -1 ||
        lowerMessage.indexOf("rate limit") !== -1 ||
        lowerMessage.indexOf("too many") !== -1 ||
        lowerMessage.indexOf("429") !== -1) {
      return "RATE_LIMIT";
    }
    
    // 属性・バリデーションエラー
    if (lowerMessage.indexOf("attribute") !== -1 ||
        lowerMessage.indexOf("validation") !== -1 ||
        lowerMessage.indexOf("invalid") !== -1 ||
        lowerMessage.indexOf("required") !== -1 ||
        lowerMessage.indexOf("missing") !== -1) {
      return "VALIDATION";
    }
    
    // 在庫・FBA関連
    if (lowerMessage.indexOf("inventory") !== -1 ||
        lowerMessage.indexOf("fulfillment") !== -1 ||
        lowerMessage.indexOf("fba") !== -1 ||
        lowerMessage.indexOf("在庫") !== -1) {
      return "INVENTORY_ERROR";
    }
    
    // サーバーエラー
    if (lowerMessage.indexOf("500") !== -1 ||
        lowerMessage.indexOf("502") !== -1 ||
        lowerMessage.indexOf("503") !== -1 ||
        lowerMessage.indexOf("internal") !== -1 ||
        lowerMessage.indexOf("server error") !== -1) {
      return "SERVER_ERROR";
    }
    
    // その他
    return "OTHER";
  }
  
  // ============================================
  // E列（商品名）の背景色と文字色を設定
  // ============================================
  function updateResultCell(sheet, rowNumber, result) {
    const cell = sheet.getRange(rowNumber, CONFIG.COLUMN.PRODUCT_NAME);
    
    // エラータイプに応じた表示設定
    const displayConfig = getDisplayConfig(result.status, result.errorType);
    
    // セルの書式を設定（値は変更しない＝商品名を維持）
    cell.setBackground(displayConfig.bgColor);
    cell.setFontColor(displayConfig.fontColor);
    cell.setFontWeight("bold");
    
    // ノート（コメント）に結果詳細を追加
    const noteText = "【" + displayConfig.text + "】\n" + (result.message || "");
    cell.setNote(noteText);
  }
  
  // ============================================
  // 表示設定を取得
  // ============================================
  function getDisplayConfig(status, errorType) {
    if (status === "成功") {
      return {
        text: "✓ 成功",
        bgColor: "#d4edda",  // 薄い緑
        fontColor: "#155724"  // 濃い緑
      };
    }
    
    // エラータイプ別の表示設定
    const configs = {
      "RESTRICTION": {
        text: "⚠ 出品制限",
        bgColor: "#fff3cd",  // 薄いオレンジ
        fontColor: "#856404"  // 濃いオレンジ
      },
      "ASIN_ERROR": {
        text: "✗ ASIN不正",
        bgColor: "#f8d7da",  // 薄い赤
        fontColor: "#721c24"  // 濃い赤
      },
      "SKU_ERROR": {
        text: "✗ SKUエラー",
        bgColor: "#f8d7da",
        fontColor: "#721c24"
      },
      "PRICE_ERROR": {
        text: "✗ 価格エラー",
        bgColor: "#f8d7da",
        fontColor: "#721c24"
      },
      "AUTH_ERROR": {
        text: "✗ 認証エラー",
        bgColor: "#e2d5f1",  // 薄い紫
        fontColor: "#5a3d7a"  // 濃い紫
      },
      "RATE_LIMIT": {
        text: "⏳ 制限超過",
        bgColor: "#d1ecf1",  // 薄い水色
        fontColor: "#0c5460"  // 濃い水色
      },
      "VALIDATION": {
        text: "✗ 入力不正",
        bgColor: "#f8d7da",
        fontColor: "#721c24"
      },
      "INVENTORY_ERROR": {
        text: "✗ 在庫エラー",
        bgColor: "#ffeaa7",  // 薄い黄色
        fontColor: "#6c5b00"  // 濃い黄色
      },
      "SERVER_ERROR": {
        text: "⚡ サーバー障害",
        bgColor: "#e2d5f1",
        fontColor: "#5a3d7a"
      },
      "OTHER": {
        text: "✗ エラー",
        bgColor: "#f8d7da",
        fontColor: "#721c24"
      }
    };
    
    return configs[errorType] || configs["OTHER"];
  }
  
  // ============================================
  // 簡易メッセージ表示
  // ============================================
  function showResult(title, message) {
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
  
  // ============================================
  // 結果ダイアログ表示
  // ============================================
  function showResultDialog(results, successCount, errorCount) {
    // エラータイプ別にカウント
    const errorCounts = {};
    results.forEach(function(result) {
      if (result.errorType) {
        errorCounts[result.errorType] = (errorCounts[result.errorType] || 0) + 1;
      }
    });
    
    let html = "<html><head><style>";
    html += "body { font-family: Arial, sans-serif; font-size: 13px; margin: 10px; }";
    html += "h2 { color: #333; margin-bottom: 10px; }";
    html += ".summary { margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px; }";
    html += ".success { color: #28a745; font-weight: bold; }";
    html += ".error { color: #dc3545; font-weight: bold; }";
    html += ".restriction { color: #fd7e14; font-weight: bold; }";
    html += ".error-breakdown { margin: 10px 0; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 5px; }";
    html += ".error-item { display: inline-block; margin: 3px 8px 3px 0; padding: 2px 8px; border-radius: 3px; font-size: 12px; }";
    html += "table { border-collapse: collapse; width: 100%; margin-top: 10px; }";
    html += "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }";
    html += "th { background-color: #4285f4; color: white; }";
    html += "tr:nth-child(even) { background-color: #f9f9f9; }";
    html += ".status-success { color: #155724; background-color: #d4edda; }";
    html += ".status-restriction { color: #856404; background-color: #fff3cd; }";
    html += ".status-error { color: #721c24; background-color: #f8d7da; }";
    html += ".status-auth { color: #5a3d7a; background-color: #e2d5f1; }";
    html += ".status-rate { color: #0c5460; background-color: #d1ecf1; }";
    html += ".info-box { padding: 10px; margin-bottom: 15px; border-radius: 5px; }";
    html += ".info-restriction { background: #fff3cd; border: 1px solid #ffc107; }";
    html += ".info-auth { background: #e2d5f1; border: 1px solid #9b59b6; }";
    html += ".info-rate { background: #d1ecf1; border: 1px solid #17a2b8; }";
    html += "</style></head><body>";
    
    html += "<h2>商品登録結果</h2>";
    html += "<div class='summary'>";
    html += "処理件数: <strong>" + results.length + "件</strong>　";
    html += "<span class='success'>成功: " + successCount + "件</span>　";
    html += "<span class='error'>エラー: " + errorCount + "件</span>";
    html += "</div>";
    
    // エラー内訳表示
    if (errorCount > 0) {
      html += "<div class='error-breakdown'><strong>エラー内訳：</strong><br>";
      const errorLabels = {
        "RESTRICTION": { label: "出品制限", color: "#fff3cd", textColor: "#856404" },
        "ASIN_ERROR": { label: "ASIN不正", color: "#f8d7da", textColor: "#721c24" },
        "SKU_ERROR": { label: "SKUエラー", color: "#f8d7da", textColor: "#721c24" },
        "PRICE_ERROR": { label: "価格エラー", color: "#f8d7da", textColor: "#721c24" },
        "AUTH_ERROR": { label: "認証エラー", color: "#e2d5f1", textColor: "#5a3d7a" },
        "RATE_LIMIT": { label: "制限超過", color: "#d1ecf1", textColor: "#0c5460" },
        "VALIDATION": { label: "入力不正", color: "#f8d7da", textColor: "#721c24" },
        "INVENTORY_ERROR": { label: "在庫エラー", color: "#ffeaa7", textColor: "#6c5b00" },
        "SERVER_ERROR": { label: "サーバー障害", color: "#e2d5f1", textColor: "#5a3d7a" },
        "OTHER": { label: "その他", color: "#f8d7da", textColor: "#721c24" }
      };
      
      for (const type in errorCounts) {
        const config = errorLabels[type] || errorLabels["OTHER"];
        html += "<span class='error-item' style='background:" + config.color + "; color:" + config.textColor + ";'>";
        html += config.label + ": " + errorCounts[type] + "件</span>";
      }
      html += "</div>";
    }
    
    // 出品制限の案内
    if (errorCounts["RESTRICTION"]) {
      html += "<div class='info-box info-restriction'>";
      html += "<strong>⚠️ 出品制限について</strong><br>";
      html += "出品制限がかかっている商品は、セラーセントラルで出品許可申請が必要です。<br>";
      html += "「在庫」→「出品許可申請」から申請できます。";
      html += "</div>";
    }
    
    // 認証エラーの案内
    if (errorCounts["AUTH_ERROR"]) {
      html += "<div class='info-box info-auth'>";
      html += "<strong>🔑 認証エラーについて</strong><br>";
      html += "アクセストークンの有効期限が切れている可能性があります。<br>";
      html += "Refresh Tokenを確認してください。";
      html += "</div>";
    }
    
    // レート制限の案内
    if (errorCounts["RATE_LIMIT"]) {
      html += "<div class='info-box info-rate'>";
      html += "<strong>⏳ API制限超過について</strong><br>";
      html += "短時間に大量のリクエストを送信したため、一時的に制限されています。<br>";
      html += "数分待ってから再実行してください。";
      html += "</div>";
    }
    
    html += "<table><tr><th>行</th><th>SKU</th><th>ASIN</th><th>結果</th><th>詳細</th></tr>";
    
    results.forEach(function(result) {
      let statusClass = "status-error";
      let statusText = result.status;
      
      if (result.status === "成功") {
        statusClass = "status-success";
        statusText = "✓ 成功";
      } else {
        // エラータイプに応じた表示
        switch (result.errorType) {
          case "RESTRICTION":
            statusClass = "status-restriction";
            statusText = "⚠ 出品制限";
            break;
          case "AUTH_ERROR":
          case "SERVER_ERROR":
            statusClass = "status-auth";
            statusText = "✗ " + getErrorTypeLabel(result.errorType);
            break;
          case "RATE_LIMIT":
            statusClass = "status-rate";
            statusText = "⏳ 制限超過";
            break;
          default:
            statusClass = "status-error";
            statusText = "✗ " + getErrorTypeLabel(result.errorType);
        }
      }
      
      html += "<tr>";
      html += "<td>" + result.row + "</td>";
      html += "<td>" + escapeHtml(result.sku) + "</td>";
      html += "<td>" + escapeHtml(result.asin) + "</td>";
      html += "<td class='" + statusClass + "'>" + statusText + "</td>";
      html += "<td>" + escapeHtml(result.message) + "</td>";
      html += "</tr>";
    });
    
    html += "</table>";
    html += "<p style='margin-top:15px; color:#666; font-size:11px;'>※ E列にも結果が反映されています。セルにカーソルを合わせると詳細が表示されます。</p>";
    html += "</body></html>";
    
    const ui = HtmlService.createHtmlOutput(html)
      .setWidth(800)
      .setHeight(600);
    
    SpreadsheetApp.getUi().showModalDialog(ui, "Amazon商品登録結果");
  }
  
  // ============================================
  // エラータイプのラベルを取得
  // ============================================
  function getErrorTypeLabel(errorType) {
    const labels = {
      "RESTRICTION": "出品制限",
      "ASIN_ERROR": "ASIN不正",
      "SKU_ERROR": "SKUエラー",
      "PRICE_ERROR": "価格エラー",
      "AUTH_ERROR": "認証エラー",
      "RATE_LIMIT": "制限超過",
      "VALIDATION": "入力不正",
      "INVENTORY_ERROR": "在庫エラー",
      "SERVER_ERROR": "サーバー障害",
      "OTHER": "エラー"
    };
    return labels[errorType] || "エラー";
  }
  
  // ============================================
  // HTMLエスケープ
  // ============================================
  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // ============================================
  // ボタン作成用メニュー追加（オプション）
  // ============================================
  function onOpen() {
    SpreadsheetApp.getUi()
      .createMenu("Amazon出品")
      .addItem("選択した商品を登録", "registerSelectedProducts")
      .addSeparator()
      .addItem("E列の色をリセット", "resetResultColors")
      .addToUi();
  }
  
  // ============================================
  // E列の色をリセット（商品名列）
  // ============================================
  function resetResultColors() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow < CONFIG.DATA_START_ROW) {
      showResult("情報", "リセット対象のデータがありません。");
      return;
    }
    
    // E列のデータ範囲を取得
    const range = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COLUMN.PRODUCT_NAME, lastRow - CONFIG.DATA_START_ROW + 1, 1);
    
    // 背景色、文字色、太字をリセット
    range.setBackground(null);
    range.setFontColor(null);
    range.setFontWeight("normal");
    range.clearNote();
    
    showResult("完了", "E列の色とノートをリセットしました。");
  }
  
  // ============================================
  // チェックされた行のみ色をリセット
  // ============================================
  function resetCheckedRowColors() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow < CONFIG.DATA_START_ROW) {
      showResult("情報", "リセット対象のデータがありません。");
      return;
    }
    
    const dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, CONFIG.COLUMN.PRODUCT_NAME);
    const data = dataRange.getValues();
    
    let resetCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const isChecked = data[i][CONFIG.COLUMN.CHECKBOX - 1];
      
      if (isChecked === true) {
        const rowNumber = i + CONFIG.DATA_START_ROW;
        const cell = sheet.getRange(rowNumber, CONFIG.COLUMN.PRODUCT_NAME);
        cell.setBackground(null);
        cell.setFontColor(null);
        cell.setFontWeight("normal");
        cell.clearNote();
        resetCount++;
      }
    }
    
    if (resetCount === 0) {
      showResult("情報", "チェックされた行がありません。");
    } else {
      showResult("完了", resetCount + "行の色をリセットしました。");
    }
  }