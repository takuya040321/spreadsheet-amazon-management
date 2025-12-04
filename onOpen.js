/**
 * onOpen.gs
 * スプレッドシート起動時にカスタムメニューを追加する
 */

/**
 * スプレッドシートを開いた時に実行される関数
 * カスタムメニュー「FBA納品」を追加する
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu("カスタム")
    .addItem("納品プラン作成", "createShipmentPlan")
    .addItem("商品ラベル生成", "generateFbaLabelsFromSelection")
    .addToUi();
}