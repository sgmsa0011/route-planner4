'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

export type OperationMode = 'view' | 'transform' | 'pose'

interface ToolbarProps {
  currentMode: OperationMode
  onModeChange: (mode: OperationMode) => void
  onResetPose?: () => void
  onPresetPose?: (poseType: 'tpose' | 'relax' | 'sit') => void
}

export default function Toolbar({
  currentMode,
  onModeChange,
  onResetPose,
  onPresetPose
}: ToolbarProps) {
  const router = useRouter()
  const modeConfig = {
    view: {
      icon: '👁️',
      label: '視点操作',
      description: '• マウス左ドラッグ：視点回転\n• マウス右ドラッグ：視点移動\n• ホイール：ズーム'
    },
    transform: {
      icon: '🔧',
      label: 'モデル操作',
      description: '• ドラッグ：モデル操作\n• R/T/Sキー：モード切替'
    },
    pose: {
      icon: '🤸',
      label: 'ポーズ編集',
      description: '• 関節をドラッグ：ポーズ変更\n• 右クリック：関節リセット\n• プリセット：基本ポーズ適用'
    }
  }

  return (
    <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white rounded-lg shadow-lg">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-gray-600 flex items-center justify-between">
        <h2 className="text-lg font-bold">ボルダリングポーズ検討</h2>
        <button
          onClick={() => router.push('/')}
          className="px-2 py-1 text-sm bg-blue-600 rounded hover:bg-blue-500"
        >
          トップへ戻る
        </button>
      </div>

      {/* モード切り替えボタン */}
      <div className="p-3">
        <div className="flex gap-1 mb-3">
          {(Object.keys(modeConfig) as OperationMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                currentMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="text-base">{modeConfig[mode].icon}</span>
              <span>{modeConfig[mode].label}</span>
            </button>
          ))}
        </div>

        {/* ポーズモード時の追加コントロール */}
        {currentMode === 'pose' && (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <div className="mb-2">
              <label className="block text-xs font-medium mb-1 text-gray-300">
                プリセットポーズ
              </label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => onPresetPose?.('tpose')}
                  className="px-2 py-1 text-xs bg-green-700 rounded hover:bg-green-600 transition-colors"
                >
                  Tポーズ
                </button>
                <button
                  onClick={() => onPresetPose?.('relax')}
                  className="px-2 py-1 text-xs bg-green-700 rounded hover:bg-green-600 transition-colors"
                >
                  リラックス
                </button>
                <button
                  onClick={() => onPresetPose?.('sit')}
                  className="px-2 py-1 text-xs bg-green-700 rounded hover:bg-green-600 transition-colors"
                >
                  座り
                </button>
              </div>
            </div>

            <button
              onClick={onResetPose}
              className="w-full px-3 py-1 text-xs bg-red-700 rounded hover:bg-red-600 transition-colors"
            >
              ポーズリセット
            </button>
          </div>
        )}

        {/* transformモード時の追加コントロール */}
        {currentMode === 'transform' && (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <div className="text-xs text-gray-400">
              <div className="mb-1">キーボードショートカット:</div>
              <div>• R：回転モード</div>
              <div>• T：移動モード</div>
              <div>• S：スケールモード</div>
              <div>• Esc：選択解除</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}