/**
 * Amazonセラーセントラル売上データ自動転記システム
 * 
 * ファイル構成:
 * - ui.js: UI機能とボタンハンドラー
 * - csvImport.js: CSVファイル読込機能
 * - dataProcessing.js: 転記先行検索・データ処理機能
 * - productTransfer.js: 商品管理シート転記機能
 * - csvDialog.html: CSVアップロードダイアログ
 * - csv-upload.html: ダイアログ用CSS
 * 
 * 使用手順:
 * 1. メニューから「1. CSVファイル読込」を実行
 * 2. メニューから「2. データ処理」を実行
 * 3. メニューから「3. 商品管理転記」を実行
 */

// 各機能は独立したファイルに定義されています
// メインのエントリーポイントはui.jsのonOpen()関数です
