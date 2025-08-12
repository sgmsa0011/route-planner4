'use client'

import React from 'react'

export type OperationMode = 'view' | 'transform' | 'pose'

interface ToolbarProps {
  currentMode: OperationMode
  onModeChange: (mode: OperationMode) => void
  onResetPose?: () => void
  onPresetPose?: (poseType: 'tpose' | 'relax' | 'sit') => void
  gizmoMode?: 'translate' | 'rotate'
  onGizmoModeChange?: (mode: 'translate' | 'rotate') => void
}

export default function Toolbar({
  currentMode,
  onModeChange,
  onResetPose,
  onPresetPose,
  gizmoMode,
  onGizmoModeChange,
}: ToolbarProps) {
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
      description: '• 関節をドラッグ：ポーズ変更\n• 右クリック：関節リセット'
    }
  }

  return (
    <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white rounded-lg shadow-lg max-w-xs">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-gray-600">
        <h2 className="text-lg font-bold">ルートプランナー</h2>
      </div>

      {/* モード切り替えボタン */}
      <div className="p-3">
        <div className="flex flex-col gap-1 mb-3">
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
          <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => onGizmoModeChange && onGizmoModeChange('translate')}
                className={`w-1/2 px-2 py-1 text-xs rounded transition-colors ${
                  gizmoMode === 'translate' ? 'bg-blue-500 text-white' : 'bg-gray-600 hover:bg-gray-500'
                }`}
              >
                移動 (T)
              </button>
              <button
                onClick={() => onGizmoModeChange && onGizmoModeChange('rotate')}
                className={`w-1/2 px-2 py-1 text-xs rounded transition-colors ${
                  gizmoMode === 'rotate' ? 'bg-blue-500 text-white' : 'bg-gray-600 hover:bg-gray-500'
                }`}
              >
                回転 (R)
              </button>
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
              <div>• R：回転モード</div>
              <div>• T：移動モード</div>
              <div>• S：スケールモード</div>
              <div>• Esc：選択解除</div>
            </div>
          </div>
        )}

        {/* 操作ガイド */}
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="font-bold text-sm mb-1">{modeConfig[currentMode].label} ガイド</div>
          {currentMode === 'view' && (
            <div className="text-xs space-y-0.5">
              <div>• マウス左ドラッグ：視点回転</div>
              <div>• マウス右ドラッグ：視点移動</div>
              <div>• ホイール：ズーム</div>
            </div>
          )}
          {currentMode === 'transform' && (
            <div className="text-xs space-y-0.5">
              <div>• ドラッグ：モデル操作</div>
              <div>• R/T/Sキー：モード切替</div>
              <div className="text-gray-300">3D操作可能:</div>
              <div className="text-yellow-200">• T: 移動 / R: 回転 / S: スケール</div>
              <div className="text-green-200">• ESC: 選択解除</div>
            </div>
          )}
          {currentMode === 'pose' && (
            <div className="text-xs space-y-0.5">
              <div>• 関節をドラッグ：ポーズ変更</div>
              <div>• 右クリック：関節リセット</div>
              <div>• プリセット：基本ポーズ適用</div>
              <div className="text-gray-300">ポーズ編集 (デバッグ強化版):</div>
              <div className="text-cyan-200">• 青球: 全関節共通色</div>
              <div className="text-yellow-200">• ドラッグで関節移動・連動動作</div>
              <div className="text-orange-200">🔍 コンソールでドラッグ詳細確認可能</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}