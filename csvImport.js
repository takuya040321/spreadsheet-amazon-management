function importCsvFile(fileId) {
  if (!fileId) {
    throw new Error("ファイルIDが入力されていません。");
  }

  try {
    const file = DriveApp.getFileById(fileId);
    const csvContent = file.getBlob().getDataAsString("UTF-8");
    return processCsvContent(csvContent);
  } catch (error) {
    throw new Error("CSVファイルの読込に失敗しました: " + error.message);
  }
}

// 重複する関数はui.jsに移動済み
// このファイルは後方互換性のためのみ保持