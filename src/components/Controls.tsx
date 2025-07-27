'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { CanvasPoseData } from './Canvas3D'

type PoseData = CanvasPoseData

interface Pose {
  id: string
  name: string
  data: PoseData // 関節角度や位置データ
  timestamp: number
}

interface ControlsProps {
  onPoseSave?: (pose: Pose) => void
  onPoseLoad?: (pose: Pose) => void
  onPoseDelete?: (poseId: string) => void
  onPlay?: () => void
  poses?: Pose[]
}

export default function Controls({
  onPoseSave,
  onPoseLoad,
  onPoseDelete,
  onPlay,
  poses = []
}: ControlsProps) {
  const router = useRouter()
  const [currentPoseName, setCurrentPoseName] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedPose, setSelectedPose] = useState<string | null>(null)

  const handleSavePose = useCallback(() => {
    if (!currentPoseName.trim()) {
      alert('ステップ名を入力してください')
      return
    }

    const newPose: Pose = {
      id: `pose_${Date.now()}`,
      name: currentPoseName.trim(),
      data: {
        // Placeholder values, actual data is supplied by parent
        model: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        bones: {}
      },
      timestamp: Date.now()
    }

    onPoseSave?.(newPose)
    setCurrentPoseName('')
    alert(`ステップ「${newPose.name}」を保存しました`)
  }, [currentPoseName, onPoseSave])

  const handleLoadPose = useCallback((pose: Pose) => {
    onPoseLoad?.(pose)
    setSelectedPose(pose.id)
    alert(`ステップ「${pose.name}」を読み込みました`)
  }, [onPoseLoad])

  const handleDeletePose = useCallback((poseId: string, poseName: string) => {
    if (confirm(`ステップ「${poseName}」を削除しますか？`)) {
      onPoseDelete?.(poseId)
      if (selectedPose === poseId) {
        setSelectedPose(null)
      }
    }
  }, [onPoseDelete, selectedPose])

  const handleExportPoses = useCallback(() => {
    if (poses.length === 0) {
      alert('エクスポートするステップがありません')
      return
    }

    const dataStr = JSON.stringify(poses, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `climbing_poses_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [poses])

  const handleImportPoses = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedPoses = JSON.parse(e.target?.result as string)
        if (Array.isArray(importedPoses)) {
          importedPoses.forEach(pose => onPoseSave?.(pose))
          alert(`${importedPoses.length}個のステップをインポートしました`)
        }
      } catch (error) {
        alert('ファイルの読み込みに失敗しました')
        console.error('Import error:', error)
      }
    }
    reader.readAsText(file)
    event.target.value = '' // reset input so same file can be selected again
  }, [onPoseSave])

  return (
    <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg shadow-lg min-w-80">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => router.push('/')}
          className="text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-500 transition-colors"
        >
          トップへ戻る
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600 transition-colors"
        >
          {isExpanded ? '縮小' : '展開'}
        </button>
      </div>
      <h3 className="text-lg font-bold mb-2">ステップ管理</h3>

      {/* ステップ保存セクション */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">新しいステップを保存</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentPoseName}
            onChange={(e) => setCurrentPoseName(e.target.value)}
            placeholder="ステップ名を入力"
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleSavePose()}
          />
          <button
            onClick={handleSavePose}
            disabled={!currentPoseName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 保存済みステップリスト */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              保存済みステップ ({poses.length}個)
            </label>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {poses.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  保存されたステップはありません
                </p>
              ) : (
                poses.map((pose) => (
                  <div
                    key={pose.id}
                    className={`flex items-center gap-2 p-2 rounded border ${
                      selectedPose === pose.id
                        ? 'border-blue-500 bg-blue-900 bg-opacity-50'
                        : 'border-gray-600 bg-gray-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{pose.name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(pose.timestamp).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadPose(pose)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      読込
                    </button>
                    <button
                      onClick={() => handleDeletePose(pose.id, pose.name)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
            </div>
            {poses.length > 0 && (
              <button
                onClick={onPlay}
                className="mt-2 w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                再生
              </button>
            )}
          </div>

          {/* エクスポート/インポート */}
          <div className="border-t border-gray-600 pt-4">
            <label className="block text-sm font-medium mb-2">データ管理</label>
            <div className="flex gap-2">
              <button
                onClick={handleExportPoses}
                disabled={poses.length === 0}
                className="flex-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
              >
                エクスポート
              </button>
              <label className="flex-1 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 cursor-pointer transition-colors text-sm text-center">
                インポート
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportPoses}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* デバッグ情報 */}
          <div className="border-t border-gray-600 pt-4 mt-4">
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-white">デバッグ情報</summary>
              <div className="mt-2 p-2 bg-gray-900 rounded font-mono">
                <div>選択中ステップ: {selectedPose || 'なし'}</div>
                <div>総ステップ数: {poses.length}</div>
                <div>展開状態: {isExpanded ? 'true' : 'false'}</div>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  )
}