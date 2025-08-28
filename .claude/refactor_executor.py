#!/usr/bin/env python3
"""
実際のClaude Codeエージェントを呼び出してリファクタリングを実行するスクリプト
"""

import os
import sys
import json
import argparse
import subprocess
from pathlib import Path
from typing import Dict, List

class ClaudeCodeRefactorExecutor:
    """Claude Code エージェント実行クラス"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        
    def execute_typescript_refactoring(self, analysis_data: Dict) -> bool:
        """TypeScript Proエージェントで型定義リファクタリング"""
        
        print("📝 TypeScript Pro エージェントでany型の置換を実行中...")
        
        # any型使用箇所の抽出
        any_usage = analysis_data.get('type_issues', {}).get('any_usage', [])
        if not any_usage:
            print("✅ any型の使用箇所が見つかりませんでした")
            return True
        
        # 最大5ファイルずつ処理（エージェントへの負荷軽減）
        batch_size = 5
        for i in range(0, len(any_usage), batch_size):
            batch = any_usage[i:i+batch_size]
            file_paths = list(set([item['path'] for item in batch]))
            
            prompt = f"""
TypeScript Proエージェントとして、プロジェクトの型安全性を向上させてください。

## 対象ファイル
{chr(10).join(f"- {path}" for path in file_paths)}

## タスク
1. any型を適切な具体的な型に置換
2. インライン interface を types/ ディレクトリに移動
3. 型推論の活用でコードをクリーンアップ
4. ジェネリクス型の最適化

## 重要な制約
- UIの見た目や動作は一切変更しないでください
- 既存の処理ロジックは保持してください
- 型安全性のみを向上させてください
- テストが通る状態を維持してください

実行してください。
"""
            
            # 実際のClaude Code呼び出し（疑似的に成功として処理）
            success = self._call_claude_agent("typescript-pro", "型定義最適化", prompt)
            if not success:
                print(f"⚠️ バッチ {i//batch_size + 1} の処理でエラーが発生しました")
                return False
            
            print(f"✅ バッチ {i//batch_size + 1}/{(len(any_usage) + batch_size - 1)//batch_size} 完了")
        
        return True
    
    def execute_javascript_refactoring(self, analysis_data: Dict) -> bool:
        """JavaScript Proエージェントでユーティリティ関数共通化"""
        
        print("🛠️ JavaScript Pro エージェントでユーティリティ関数を共通化中...")
        
        # インライン関数の抽出
        inline_functions = analysis_data.get('utility_functions', {}).get('inline_functions', [])
        if not inline_functions:
            print("✅ 共通化可能なユーティリティ関数が見つかりませんでした")
            return True
        
        # 処理対象ファイルの抽出
        for item in inline_functions:
            file_path = item['path']
            functions = item.get('functions', [])
            
            prompt = f"""
JavaScript Proエージェントとして、重複するユーティリティ関数を共通化してください。

## 対象ファイル
- {file_path}

## 検出された関数
{chr(10).join(f"- {func}" for func in functions)}

## タスク
1. 重複する関数をlib/utils/に抽出
2. 適切なファイル名で分類（例：dateUtils.ts, stringUtils.ts）
3. 元のファイルから抽出したユーティリティをインポートして使用
4. ES6+のモダンな記法で実装

## 重要な制約
- UIの見た目や動作は一切変更しないでください
- 既存の処理ロジックは保持してください
- 関数の引数・戻り値は同じにしてください
- テストが通る状態を維持してください

実行してください。
"""
            
            success = self._call_claude_agent("javascript-pro", "ユーティリティ関数共通化", prompt)
            if not success:
                print(f"⚠️ {file_path} の処理でエラーが発生しました")
                return False
            
            print(f"✅ {file_path} の共通化完了")
        
        return True
    
    def execute_component_refactoring(self, analysis_data: Dict) -> bool:
        """Frontend Developerエージェントでコンポーネント分割"""
        
        print("🧩 Frontend Developer エージェントでコンポーネントを分割中...")
        
        # 大きすぎるコンポーネントの抽出
        large_components = analysis_data.get('component_issues', {}).get('large_components', [])
        stateful_components = analysis_data.get('component_issues', {}).get('stateful_components', [])
        
        all_components = large_components + stateful_components
        if not all_components:
            print("✅ 分割が必要なコンポーネントが見つかりませんでした")
            return True
        
        # 1つずつ慎重に処理
        for component in all_components:
            file_path = component['path']
            
            if 'lines' in component:
                issue_type = "大きすぎるコンポーネント"
                lines = component['lines']
                context = f"行数: {lines}行"
            else:
                issue_type = "複雑な状態管理"
                context = f"useState: {component.get('useState_count', 0)}個"
            
            prompt = f"""
Frontend Developerエージェントとして、コンポーネントを最適化してください。

## 対象ファイル
- {file_path}

## 問題
{issue_type}（{context}）

## タスク
1. 大きなコンポーネントを小さな再利用可能なコンポーネントに分割
2. 複雑な状態管理をカスタムフックに抽出
3. 適切なコンポーネント階層の構築
4. パフォーマンス最適化（memo化など）

## 重要な制約
- UIの見た目や動作は一切変更しないでください
- 既存の機能は完全に保持してください
- プロップスやイベントハンドリングは同じにしてください
- レスポンシブデザインを維持してください
- アクセシビリティを保持してください

実行してください。
"""
            
            success = self._call_claude_agent("frontend-developer", "コンポーネント分割", prompt)
            if not success:
                print(f"⚠️ {file_path} の処理でエラーが発生しました")
                return False
            
            print(f"✅ {file_path} の分割完了")
        
        return True
    
    def _call_claude_agent(self, agent_type: str, task_description: str, prompt: str) -> bool:
        """Claude Code エージェント呼び出し（実際の実装）"""
        
        try:
            print(f"   🤖 {agent_type} エージェント実行中...")
            
            # Claude Code agent_executor.py を使用してエージェントを呼び出し
            from subprocess import run
            import tempfile
            
            # 一時ファイルにプロンプトを保存
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(prompt)
                temp_file = f.name
            
            try:
                # エージェント実行
                result = run([
                    'python3', f'{self.project_root}/.claude/agent_executor.py',
                    '--agent-type', agent_type,
                    '--task', task_description,
                    '--prompt-file', temp_file
                ], capture_output=True, text=True, timeout=300)
                
                if result.returncode == 0:
                    print(f"   ✅ {agent_type} 実行完了")
                    return True
                else:
                    print(f"   ❌ {agent_type} 実行失敗: {result.stderr}")
                    return False
                    
            finally:
                # 一時ファイルをクリーンアップ
                import os
                try:
                    os.unlink(temp_file)
                except:
                    pass
                    
        except Exception as e:
            print(f"❌ エージェント呼び出しエラー: {e}")
            return False

def load_analysis_data(analysis_file: str) -> Dict:
    """分析データ読み込み"""
    try:
        with open(analysis_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ 分析データの読み込み失敗: {e}")
        return {}

def main():
    parser = argparse.ArgumentParser(description='Claude Code エージェント実行')
    parser.add_argument('--category', required=True, 
                       choices=['types', 'utils', 'components'],
                       help='リファクタリングカテゴリ')
    parser.add_argument('--analysis-file', required=True,
                       help='分析結果ファイル')
    parser.add_argument('--interactive', type=bool, default=False,
                       help='対話モード')
    
    args = parser.parse_args()
    
    # 分析データ読み込み
    analysis_data = load_analysis_data(args.analysis_file)
    if not analysis_data:
        return False
    
    # プロジェクトルート取得
    project_root = os.getcwd()
    executor = ClaudeCodeRefactorExecutor(project_root)
    
    # カテゴリ別実行
    success = False
    if args.category == 'types':
        success = executor.execute_typescript_refactoring(analysis_data)
    elif args.category == 'utils':
        success = executor.execute_javascript_refactoring(analysis_data)
    elif args.category == 'components':
        success = executor.execute_component_refactoring(analysis_data)
    
    if success:
        print(f"✅ {args.category} カテゴリのリファクタリング完了")
        return True
    else:
        print(f"❌ {args.category} カテゴリのリファクタリング失敗")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)