/**
 * onOpen.gs
 * スプレッドシート起動時にカスタムメニューを追加する
 */

/**
 * スプレッドシートを開いた時に実行される関数
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu("カスタム")
    .addItem("商品登録", "registerSelectedProducts")
    .addItem("納品プラン作成", "createShipmentPlan")
    .addItem("商品ラベル生成", "generateFbaLabelsFromSelection")
    .addItem("販売詳細レポートを出力", "showMonthSelectionDialog")
    .addToUi();
}
