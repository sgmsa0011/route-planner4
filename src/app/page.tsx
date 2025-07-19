'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Controls from '@/components/Controls'

// Canvas3Dコンポーネントを動的インポート（SSR回避）
const Canvas3D = dynamic(() => import('@/components/Canvas3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">3Dシーンを読み込み中...</div>
    </div>
  )
})

interface PoseData {
  joints: Record<string, { position: [number, number, number]; rotation: [number, number, number] }>
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
}

interface Pose {
  id: string
  name: string
  data: PoseData
  timestamp: number
}

interface FileStatus {
  model: boolean
  background: boolean
}

export default function Home() {
  const [poses, setPoses] = useState<Pose[]>([])
  const [currentPose, setCurrentPose] = useState<Pose | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fileStatus, setFileStatus] = useState<FileStatus>({ model: false, background: false })

  // ファイルの存在確認
  useEffect(() => {
    const checkFiles = async () => {
      try {
        // モデルファイルの存在確認
        const modelResponse = await fetch('/model.glb', { method: 'HEAD' })
        const modelExists = modelResponse.ok

        // 背景画像の存在確認
        const backgroundResponse = await fetch('/wall.jpg', { method: 'HEAD' })
        const backgroundExists = backgroundResponse.ok

        setFileStatus({
          model: modelExists,
          background: backgroundExists
        })

        console.log('ファイル存在確認:', {
          'model.glb': modelExists,
          'wall.jpg': backgroundExists
        })
      } catch (error) {
        console.error('ファイル存在確認エラー:', error)
        setFileStatus({ model: false, background: false })
      }
    }

    checkFiles()
  }, [])

  // ローカルストレージからポーズデータを読み込み
  useEffect(() => {
    try {
      const savedPoses = localStorage.getItem('climbing-poses')
      if (savedPoses) {
        const parsedPoses = JSON.parse(savedPoses)
        setPoses(Array.isArray(parsedPoses) ? parsedPoses : [])
      }
    } catch (error) {
      console.error('ポーズデータの読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ポーズデータをローカルストレージに保存
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('climbing-poses', JSON.stringify(poses))
      } catch (error) {
        console.error('ポーズデータの保存に失敗しました:', error)
      }
    }
  }, [poses, isLoading])

  const handlePoseSave = (pose: Pose) => {
    setPoses(prev => {
      const existingIndex = prev.findIndex(p => p.id === pose.id)
      if (existingIndex >= 0) {
        // 既存のポーズを更新
        const updated = [...prev]
        updated[existingIndex] = pose
        return updated
      } else {
        // 新しいポーズを追加
        return [...prev, pose]
      }
    })

    console.log('ポーズを保存しました:', pose)
  }

  const handlePoseLoad = (pose: Pose) => {
    setCurrentPose(pose)
    // TODO: 実際のモデルにポーズを適用する処理を実装
    console.log('ポーズを読み込みました:', pose)
  }

  const handlePoseDelete = (poseId: string) => {
    setPoses(prev => prev.filter(p => p.id !== poseId))

    if (currentPose?.id === poseId) {
      setCurrentPose(null)
    }

    console.log('ポーズを削除しました:', poseId)
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">アプリケーションを読み込み中...</div>
      </div>
    )
  }

  // 不足しているファイルをリストアップ
  const missingFiles = []
  if (!fileStatus.model) missingFiles.push('model.glb')
  if (!fileStatus.background) missingFiles.push('wall.jpg')

  return (
    <main className="relative w-full h-screen overflow-hidden">
      {/* 3Dキャンバス */}
      <Canvas3D
        modelUrl="/model.glb"
        backgroundImageUrl="/wall.jpg"
      />

      {/* コントロールパネル */}
      <Controls
        poses={poses}
        onPoseSave={handlePoseSave}
        onPoseLoad={handlePoseLoad}
        onPoseDelete={handlePoseDelete}
      />

      {/* デバッグ情報（開発時のみ表示） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 text-white p-2 rounded text-xs">
          <div>現在のポーズ: {currentPose?.name || 'なし'}</div>
          <div>保存済みポーズ数: {poses.length}</div>
          <div>環境: {process.env.NODE_ENV}</div>
          <div>モデルファイル: {fileStatus.model ? '✅' : '❌'}</div>
          <div>背景画像: {fileStatus.background ? '✅' : '❌'}</div>
        </div>
      )}

      {/* ファイル不足警告（実際にファイルが存在しない場合のみ表示） */}
      {missingFiles.length > 0 && (
        <div className="absolute bottom-4 right-4 text-white text-xs bg-red-900 bg-opacity-90 p-3 rounded shadow-lg">
          <div className="font-bold mb-1">⚠️ 必要なファイルが見つかりません</div>
          <div className="text-xs text-red-200">publicフォルダに以下のファイルを配置してください：</div>
          <ul className="mt-1 text-xs">
            {missingFiles.map(file => (
              <li key={file} className="ml-2">• {file}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ファイル確認完了メッセージ（すべてのファイルが存在する場合） */}
      {missingFiles.length === 0 && process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 right-4 text-white text-xs bg-green-900 bg-opacity-80 p-2 rounded">
          ✅ すべてのファイルが正常に配置されています
        </div>
      )}
    </main>
  )
}
