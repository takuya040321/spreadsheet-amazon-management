/**
 * CSV読み込み実行ボタン用JavaScript
 */

function handleCsvUpload() {
    const fileInput = document.querySelector("input[type=\"file\"]");
    const file = fileInput.files[0];
    
    if (!file) {
        alert("ファイルが選択されていません。");
        return;
    }
    
    if (!file.name.endsWith(".csv")) {
        alert("CSVファイルを選択してください。");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvContent = e.target.result;
        
        google.script.run
            .withSuccessHandler(function(result) {
                alert("CSV読み込みが完了しました。");
                google.script.host.close();
            })
            .withFailureHandler(function(error) {
                alert("エラー: " + error.message);
            })
            .processCsvContent(csvContent);
    };
    
    reader.readAsText(file, "UTF-8");
}

function closeDialog() {
    google.script.host.close();
}