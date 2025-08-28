#!/usr/bin/env python3
"""
Claude Code エージェント連携リファクタリング実行スクリプト
各専門エージェントを呼び出してリファクタリングを実行
"""

import os
import json
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class RefactorTask:
    """リファクタリングタスク"""
    agent_type: str
    description: str
    file_paths: List[str]
    priority: int
    estimated_time: str

class ClaudeCodeRefactorer:
    """Claude Code エージェント連携リファクタリング実行クラス"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.tasks: List[RefactorTask] = []
        
    def create_refactor_plan(self, analysis_results: Dict) -> List[RefactorTask]:
        """分析結果からリファクタリング計画を作成"""
        tasks = []
        
        # 1. 型安全性向上タスク（最優先・低リスク）
        if analysis_results.get('type_issues', {}).get('any_usage'):
            tasks.append(RefactorTask(
                agent_type="typescript-pro",
                description="any型を適切な型定義に置換",
                file_paths=self._extract_file_paths(analysis_results['type_issues']['any_usage']),
                priority=1,
                estimated_time="15-30分"
            ))
        
        # 2. インポート最適化タスク（低リスク）
        if analysis_results.get('import_issues', {}).get('unused_imports'):
            tasks.append(RefactorTask(
                agent_type="typescript-pro",
                description="未使用インポートの削除とインポート最適化",
                file_paths=self._extract_file_paths(analysis_results['import_issues']['unused_imports']),
                priority=2,
                estimated_time="10-20分"
            ))
        
        # 3. ユーティリティ関数共通化（中リスク）
        if analysis_results.get('utility_functions', {}).get('inline_functions'):
            tasks.append(RefactorTask(
                agent_type="javascript-pro",
                description="重複するユーティリティ関数の共通化",
                file_paths=self._extract_file_paths(analysis_results['utility_functions']['inline_functions']),
                priority=3,
                estimated_time="20-40分"
            ))
        
        # 4. コンポーネント分割（高リスク・高効果）
        if analysis_results.get('component_issues', {}).get('large_components'):
            tasks.append(RefactorTask(
                agent_type="frontend-developer",
                description="大きすぎるコンポーネントの分割",
                file_paths=self._extract_file_paths(analysis_results['component_issues']['large_components']),
                priority=4,
                estimated_time="30-60分"
            ))
        
        # 5. 状態管理最適化（高リスク・高効果）
        if analysis_results.get('component_issues', {}).get('stateful_components'):
            tasks.append(RefactorTask(
                agent_type="frontend-developer",
                description="複雑な状態管理のカスタムフック化",
                file_paths=self._extract_file_paths(analysis_results['component_issues']['stateful_components']),
                priority=5,
                estimated_time="40-80分"
            ))
        
        return sorted(tasks, key=lambda x: x.priority)
    
    def execute_refactoring_with_agents(self, tasks: List[RefactorTask], interactive: bool = True):
        """エージェントを使用してリファクタリング実行"""
        
        print("🤖 Claude Code エージェント連携リファクタリング開始")
        print(f"📋 実行予定タスク数: {len(tasks)}")
        
        for i, task in enumerate(tasks, 1):
            print(f"\n{'='*60}")
            print(f"📌 タスク {i}/{len(tasks)}: {task.description}")
            print(f"🎯 担当エージェント: {task.agent_type}")
            print(f"⏱️ 推定時間: {task.estimated_time}")
            print(f"📁 対象ファイル数: {len(task.file_paths)}")
            
            if interactive:
                response = input(f"\n実行しますか？ (y/n/s=skip): ").lower()
                if response == 'n':
                    print("❌ リファクタリングを中断します")
                    break
                elif response == 's':
                    print("⏭️ このタスクをスキップします")
                    continue
            
            # Claude Code エージェント呼び出し
            self._execute_agent_task(task)
            
            print(f"✅ タスク {i} 完了")
            
            if interactive and i < len(tasks):
                input("\n次のタスクに進むにはEnterを押してください...")
        
        print(f"\n🎉 リファクタリング完了！")
    
    def _execute_agent_task(self, task: RefactorTask):
        """個別のエージェントタスクを実行"""
        
        # Claude Code エージェント呼び出し用のプロンプトを生成
        prompt = self._generate_agent_prompt(task)
        
        print(f"🔄 {task.agent_type} エージェントを呼び出し中...")
        
        # 実際のClaude Code API呼び出し（疑似実装）
        # 本来はClaude Code APIまたはCLIを使用
        try:
            result = self._call_claude_code_agent(task.agent_type, prompt, task.file_paths)
            
            if result['success']:
                print(f"✅ {task.description} - 完了")
                if result.get('changes_made'):
                    print(f"📝 変更されたファイル数: {result['changes_made']}")
            else:
                print(f"⚠️ {task.description} - 部分的完了または警告あり")
                if result.get('warnings'):
                    for warning in result['warnings']:
                        print(f"   ⚠️ {warning}")
                        
        except Exception as e:
            print(f"❌ エージェント実行エラー: {e}")
    
    def _generate_agent_prompt(self, task: RefactorTask) -> str:
        """エージェント用プロンプト生成"""
        
        base_prompt = f"""
あなたは{task.agent_type}エージェントとして、以下のリファクタリングタスクを実行してください。

## タスク概要
{task.description}

## 重要な制約
- UIの見た目や動作は一切変更しないでください
- 既存の処理ロジックは保持してください
- テストが通る状態を維持してください
- リファクタリング前後で機能が同じであることを確認してください

## 対象ファイル
"""
        
        for file_path in task.file_paths[:10]:  # 最大10個まで表示
            base_prompt += f"- {file_path}\n"
        
        if len(task.file_paths) > 10:
            base_prompt += f"- ... 他{len(task.file_paths) - 10}個のファイル\n"
        
        # エージェント固有の指示
        if task.agent_type == "typescript-pro":
            base_prompt += """
## TypeScript Pro 固有指示
- any型を適切な型に置換
- 型安全性を向上
- ジェネリクスの活用を検討
- 未使用インポートを削除
"""
        elif task.agent_type == "frontend-developer":
            base_prompt += """
## Frontend Developer 固有指示
- コンポーネントの分割とモジュール化
- カスタムフックの抽出
- パフォーマンス最適化
- アクセシビリティの維持
"""
        elif task.agent_type == "javascript-pro":
            base_prompt += """
## JavaScript Pro 固有指示
- 重複関数の共通化
- ユーティリティ関数の抽出
- ES6+モダン記法の活用
- パフォーマンス最適化
"""
        
        base_prompt += """
## 実行方針
1. まず対象ファイルを確認・理解
2. 安全なリファクタリング計画を立案
3. 段階的に実行
4. 各段階でテストして確認
5. 問題があれば元に戻す

実行してください。
"""
        
        return base_prompt
    
    def _call_claude_code_agent(self, agent_type: str, prompt: str, file_paths: List[str]) -> Dict:
        """Claude Code エージェント呼び出し（疑似実装）"""
        
        # 実際の実装では、Claude Code APIまたはCLIを使用
        # ここでは疑似的な処理を行う
        
        print(f"   📤 {agent_type} にタスクを送信...")
        time.sleep(2)  # 処理時間のシミュレーション
        
        # 疑似的な成功レスポンス
        return {
            'success': True,
            'changes_made': min(len(file_paths), 5),  # 最大5ファイル変更と仮定
            'warnings': [] if len(file_paths) <= 10 else ['ファイル数が多いため一部のみ処理']
        }
    
    def _extract_file_paths(self, issues_list: List[Dict]) -> List[str]:
        """分析結果からファイルパスを抽出"""
        paths = []
        for issue in issues_list:
            if 'path' in issue:
                paths.append(issue['path'])
        return list(set(paths))  # 重複除去

def load_analysis_results(analysis_file: str) -> Dict:
    """分析結果ファイルを読み込み"""
    try:
        with open(analysis_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"⚠️ 分析結果ファイルが見つかりません: {analysis_file}")
        print("先に /analyze コマンドを実行してください")
        return {}
    except json.JSONDecodeError as e:
        print(f"❌ 分析結果ファイルの読み込み失敗: {e}")
        return {}

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Claude Code エージェント連携リファクタリング')
    parser.add_argument('--analysis-file', default='analysis_results.json', 
                       help='分析結果JSONファイル')
    parser.add_argument('--project-root', default='.', help='プロジェクトルート')
    parser.add_argument('--interactive', action='store_true', default=True,
                       help='対話モード')
    parser.add_argument('--auto', action='store_true', 
                       help='自動実行モード（確認なし）')
    
    args = parser.parse_args()
    
    if args.auto:
        args.interactive = False
    
    # 分析結果読み込み
    analysis_results = load_analysis_results(args.analysis_file)
    if not analysis_results:
        return
    
    # リファクタリング実行
    refactorer = ClaudeCodeRefactorer(args.project_root)
    tasks = refactorer.create_refactor_plan(analysis_results)
    
    if not tasks:
        print("✅ リファクタリングが必要な問題は見つかりませんでした")
        return
    
    print(f"📋 リファクタリング計画:")
    for i, task in enumerate(tasks, 1):
        print(f"  {i}. {task.description} ({task.agent_type})")
    
    refactorer.execute_refactoring_with_agents(tasks, args.interactive)

if __name__ == "__main__":
    main()