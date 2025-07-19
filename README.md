# ボルダリングポーズ検討アプリ

実在するボルダリングコース（写真）を背景に、Magic Poserのような操作性で人物モデルのポーズを段階的に試すことで攻略手順を検討するPCブラウザ向けアプリです。

## 技術スタック

- **Next.js 15** - ReactベースのWebアプリフレームワーク
- **Three.js** - WebGLベース3D描画ライブラリ
- **@react-three/fiber** - React用Three.jsバインディング
- **@react-three/drei** - Three.js補助ユーティリティ
- **TypeScript** - 型安全性のため
- **Tailwind CSS** - UIスタイリング

## 機能

### 基本機能
- ✅ 3Dシーンの表示（背景画像＋人物モデル）
- ✅ OrbitControlsによる自由視点操作
- ✅ ポーズの保存・読み込み・削除
- ✅ ローカルストレージでのデータ永続化
- ✅ ポーズデータのエクスポート/インポート（JSON形式）

### 今後実装予定
- 🔄 実際の3Dモデルでの関節操作（IK制御）
- 🔄 TransformControlsによる直接操作
- 🔄 ホールド位置へのスナップ機能
- 🔄 タッチ操作対応（モバイル）
- 🔄 スクリーンショット/GIF出力

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 必要なファイルの配置

`public/` フォルダに以下のファイルを配置してください：

- `model.glb` - 人物3Dモデル（Mixamo等のリグ付きTポーズモデル推奨）
- `wall.jpg` - ボルダリング壁の背景画像

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリにアクセスできます。

## 使い方

### 基本操作
- **マウス左ドラッグ**: 視点回転
- **マウス右ドラッグ**: 視点移動
- **ホイール**: ズーム

### ポーズ管理
1. **保存**: 右上のコントロールパネルでポーズ名を入力して「保存」ボタン
2. **読み込み**: 保存済みポーズリストから「読込」ボタン
3. **削除**: 保存済みポーズリストから「削除」ボタン
4. **エクスポート**: 「エクスポート」ボタンでJSONファイルをダウンロード
5. **インポート**: 「インポート」ボタンでJSONファイルを読み込み

## プロジェクト構造

```
route-planner4/
├── src/
│   ├── app/
│   │   ├── page.tsx              # メインページ
│   │   ├── layout.tsx            # レイアウト
│   │   └── globals.css           # グローバルスタイル
│   ├── components/
│   │   ├── Canvas3D.tsx          # 3Dシーンコンポーネント
│   │   └── Controls.tsx          # UIコントロールパネル
│   └── lib/
│       └── ik.ts                 # IK制御とポーズ管理のロジック
├── public/
│   ├── model.glb                 # 人物3Dモデル（要配置）
│   └── wall.jpg                  # 背景画像（要配置）
└── requirement.md                # 要件定義書
```

## 開発ガイド

### 新しいポーズ機能の追加

1. `src/lib/ik.ts` でポーズ関連の型やユーティリティを定義
2. `src/components/Canvas3D.tsx` で3Dシーンの表示を担当
3. `src/components/Controls.tsx` でUI操作を実装
4. `src/app/page.tsx` で全体の状態管理

### IK制御の実装

現在、基本的なFABRIKアルゴリズムが実装済みです：

```typescript
import { FABRIKSolver, createIKChainFromBones } from '@/lib/ik'

// IKチェーンの作成と制御例
const chain = createIKChainFromBones(bones, targetPosition, 'leftArm')
const solver = new FABRIKSolver(chain)
const solved = solver.solve()
```

### デバッグ

開発モードでは左下にデバッグ情報が表示されます：
- 現在のポーズ名
- 保存済みポーズ数
- 実行環境

## トラブルシューティング

### 3Dモデルが表示されない
- `public/model.glb` ファイルが正しく配置されているか確認
- ブラウザの開発者ツールでネットワークエラーをチェック
- GLTFファイルの形式が正しいか確認

### 背景画像が表示されない
- `public/wall.jpg` ファイルが正しく配置されているか確認
- 画像ファイルの形式（jpg, png等）が対応しているか確認

### パフォーマンスが悪い
- 3Dモデルのポリゴン数を確認（10k以下推奨）
- ブラウザのハードウェアアクセラレーションが有効か確認
- デバイスのGPU性能を確認

## ライセンス

MIT License

## 今後の拡張予定

- [ ] より高度なIK制御システム
- [ ] 複数ポーズの連続再生
- [ ] VRヘッドセット対応
- [ ] クラウドでのポーズデータ共有
- [ ] AIによるポーズ推奨機能

---

**注意**: このアプリケーションは開発中です。すべての機能が完全に実装されているわけではありません。
