# Claude Code カスタムコマンド

## refactor - プロジェクト全体リファクタリング

### 概要
プロジェクト全体をリファクタリング（UIと処理に影響なし）

### 使用方法
```
/refactor [オプション]
```

### オプション
- `--analyze-only` - 分析のみ実行、実際の変更は行わない
- `--components` - コンポーネントのリファクタリングのみ
- `--utils` - ユーティリティ関数のリファクタリングのみ
- `--types` - 型定義の整理のみ
- `--all` - 全てのリファクタリングを実行（デフォルト）

### 使用例
- `/refactor` - 段階的リファクタリング実行（推奨）
- `/refactor --analyze-only` - プロジェクト分析のみ実行
- `/refactor --types` - 型定義最適化のみ
- `/refactor --components` - コンポーネント分割のみ

### 効果
- コードの可読性向上
- 保守性の向上
- 重複コードの削減
- 型安全性の強化
- パフォーマンス改善
- テストしやすさの向上

### 安全性
- UIに影響なし
- 既存の処理ロジックは保持
- 自動バックアップ作成
- 段階的リファクタリング可能
- ドライランモード対応

## analyze - コード品質分析

### 概要
コード品質の詳細分析

### 使用方法
```
/analyze [オプション]
```

### オプション
- `--output` - レポート出力ファイル名 (デフォルト: refactor_report.md)
- `--categories` - 分析カテゴリ指定 (components, types, utils, imports)

### 使用例
- `/analyze` - 全体コード分析実行
- `/analyze --categories components types` - コンポーネントと型定義のみ分析

## コード品質改善ワークフロー

段階的なコード品質改善プロセス：

1. `/analyze` - 現状分析とレポート生成
2. `/refactor --analyze-only` - リファクタリング影響範囲の確認
3. `/refactor --types` - 型安全性向上（低リスク）
4. `/refactor --utils` - ユーティリティ関数共通化
5. `/refactor --components` - コンポーネント分割・最適化

## メタデータ
- バージョン: 1.0.0
- 作成日: 2024-08-04
- 作成者: Claude Code Assistant
- プロジェクト: sedori-app
- 説明: UI/処理に影響しないコード品質向上のためのリファクタリングコマンド群