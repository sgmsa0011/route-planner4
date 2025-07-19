'use client'

import React, { Suspense, useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, useGLTF, useTexture, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { OperationMode } from './Toolbar'

interface PoseData {
  model: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  bones: Record<string, {
    position: [number, number, number]
    rotation: [number, number, number]
    quaternion: [number, number, number, number]
  }>
}

interface BoneData {
  position: THREE.Vector3
  rotation: THREE.Euler
  quaternion: THREE.Quaternion
}

interface SceneProps {
  modelUrl?: string
  backgroundImageUrl?: string
  operationMode: OperationMode
  onPoseChange?: (poseData: PoseData) => void
  resetTrigger?: number
  presetPose?: string | null
}

// 背景壁コンポーネント
function BackgroundWall({ imageUrl }: { imageUrl?: string }) {
  const texture = useTexture(imageUrl || '/wall.jpg')

  return (
    <mesh position={[0, 0, -2]} rotation={[0, 0, 0]}>
      <planeGeometry args={[8, 6]} />
      <meshBasicMaterial
        map={texture}
        transparent={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

// キーボードハンドラーコンポーネント
function KeyboardHandler({
  operationMode,
  onTransformModeChange
}: {
  operationMode: OperationMode
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void
}) {
  useEffect(() => {
    if (operationMode !== 'transform') return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl、Alt、Shiftが押されている場合は無視
      if (event.ctrlKey || event.altKey || event.shiftKey) return

      switch (event.key.toLowerCase()) {
        case 't':
          event.preventDefault()
          onTransformModeChange('translate')
          console.log('変形モード: 移動 (T)')
          break
        case 'r':
          event.preventDefault()
          onTransformModeChange('rotate')
          console.log('変形モード: 回転 (R)')
          break
        case 's':
          event.preventDefault()
          onTransformModeChange('scale')
          console.log('変形モード: スケール (S)')
          break
        case 'escape':
          event.preventDefault()
          console.log('選択解除 (ESC)')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [operationMode, onTransformModeChange])

  return null
}

// 人物モデルコンポーネント（拡張版）
function HumanModel({
  modelUrl,
  operationMode,
  onPoseChange,
  resetTrigger,
  presetPose
}: {
  modelUrl?: string
  operationMode: OperationMode
  onPoseChange?: (poseData: PoseData) => void
  resetTrigger?: number
  presetPose?: string | null
}) {
  const modelRef = useRef<THREE.Group>(null)
  const [isModelReady, setIsModelReady] = useState(false)
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate')
  const [bones, setBones] = useState<THREE.Bone[]>([])
  const [originalPose, setOriginalPose] = useState<Record<string, BoneData> | null>(null)

  const gltf = useGLTF(modelUrl || '/model.glb')

  // モデル初期設定（ボーン情報含む）
  useEffect(() => {
    if (gltf.scene && modelRef.current) {
      const foundBones: THREE.Bone[] = []
      const originalBoneData: Record<string, BoneData> = {}

      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Bone) {
          foundBones.push(child)
          originalBoneData[child.name] = {
            position: child.position.clone(),
            rotation: child.rotation.clone(),
            quaternion: child.quaternion.clone()
          }
        }
      })

      setBones(foundBones)
      setOriginalPose(originalBoneData)

      // モデル位置設定
      modelRef.current.position.set(0, -1, 0)
      modelRef.current.scale.set(1, 1, 1)
      modelRef.current.rotation.set(0, 0, 0)

      console.log('モデル読み込み完了:', foundBones.length, 'ボーン')

      setTimeout(() => {
        setIsModelReady(true)
      }, 200)
    }
  }, [gltf.scene])

  // プリセットポーズ適用
  useEffect(() => {
    if (presetPose && bones.length > 0 && originalPose) {
      applyPresetPose(presetPose)
    }
  }, [presetPose, bones, originalPose])

  // プリセットポーズ適用関数
  const applyPresetPose = useCallback((poseType: string) => {
    if (!bones.length || !originalPose) return

    console.log('プリセットポーズ適用開始:', poseType, bones.length)

    bones.forEach((bone) => {
      const original = originalPose[bone.name]
      if (!original) return

      switch (poseType) {
        case 'tpose':
          // Tポーズ（腕を水平に）
          if (bone.name.toLowerCase().includes('upperarm') || bone.name.toLowerCase().includes('shoulder')) {
            if (bone.name.toLowerCase().includes('left')) {
              bone.rotation.z = Math.PI / 2
            } else if (bone.name.toLowerCase().includes('right')) {
              bone.rotation.z = -Math.PI / 2
            }
          } else {
            bone.rotation.copy(original.rotation)
          }
          break

        case 'relax':
          // リラックスポーズ
          if (bone.name.toLowerCase().includes('upperarm')) {
            bone.rotation.z = bone.name.toLowerCase().includes('left') ? 0.3 : -0.3
            bone.rotation.x = 0.2
          } else if (bone.name.toLowerCase().includes('lowerarm') || bone.name.toLowerCase().includes('forearm')) {
            bone.rotation.z = bone.name.toLowerCase().includes('left') ? 0.5 : -0.5
          } else {
            bone.rotation.copy(original.rotation)
          }
          break

        case 'sit':
          // 座りポーズ
          if (bone.name.toLowerCase().includes('upperleg') || bone.name.toLowerCase().includes('thigh')) {
            bone.rotation.x = -Math.PI / 3
          } else if (bone.name.toLowerCase().includes('lowerleg') || bone.name.toLowerCase().includes('calf')) {
            bone.rotation.x = Math.PI / 3
          } else {
            bone.rotation.copy(original.rotation)
          }
          break

        default:
          bone.rotation.copy(original.rotation)
      }
    })

    console.log('プリセットポーズ適用完了:', poseType)

    // ポーズ変更を通知
    if (onPoseChange) {
      const poseData = extractCurrentPose()
      onPoseChange(poseData)
    }
  }, [bones, originalPose, onPoseChange])

  // リセット機能
  useEffect(() => {
    if (resetTrigger && originalPose && modelRef.current) {
      // ボーンリセット
      bones.forEach((bone) => {
        const original = originalPose[bone.name]
        if (original) {
          bone.position.copy(original.position)
          bone.rotation.copy(original.rotation)
          bone.quaternion.copy(original.quaternion)
        }
      })

      // モデル自体のリセット
      modelRef.current.position.set(0, -1, 0)
      modelRef.current.rotation.set(0, 0, 0)
      modelRef.current.scale.set(1, 1, 1)

      console.log('ポーズリセット完了')
    }
  }, [resetTrigger, bones, originalPose])

  // 現在のポーズ抽出
  const extractCurrentPose = useCallback((): PoseData => {
    const poseData: PoseData = {
      model: {
        position: modelRef.current?.position.toArray() as [number, number, number] || [0, -1, 0],
        rotation: modelRef.current?.rotation.toArray().slice(0, 3) as [number, number, number] || [0, 0, 0],
        scale: modelRef.current?.scale.toArray() as [number, number, number] || [1, 1, 1]
      },
      bones: {}
    }

    bones.forEach((bone) => {
      poseData.bones[bone.name] = {
        position: bone.position.toArray() as [number, number, number],
        rotation: bone.rotation.toArray().slice(0, 3) as [number, number, number],
        quaternion: bone.quaternion.toArray() as [number, number, number, number]
      }
    })

    return poseData
  }, [bones])

  if (!gltf || !gltf.scene) {
    return (
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 1.5, 0.3]} />
        <meshBasicMaterial color="#ff6b6b" />
      </mesh>
    )
  }

  return (
    <group>
      {/* キーボードハンドラー */}
      <KeyboardHandler
        operationMode={operationMode}
        onTransformModeChange={setTransformMode}
      />

      {/* 3Dモデル */}
      <primitive
        ref={modelRef}
        object={gltf.scene}
        position={[0, -1, 0]}
        scale={[1, 1, 1]}
      />

      {/* TransformControls（拡張版） */}
      {operationMode === 'transform' && isModelReady && modelRef.current && (
        <TransformControls
          object={modelRef.current}
          mode={transformMode}
          showX={true}
          showY={true}
          showZ={transformMode !== 'scale'}
          size={1}
          space={transformMode === 'rotate' ? 'local' : 'world'}
          onObjectChange={() => {
            if (onPoseChange && modelRef.current) {
              const poseData = extractCurrentPose()
              onPoseChange(poseData)
            }
          }}
        />
      )}
    </group>
  )
}

// フォールバック用モデル
function FallbackModel() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[0.5, 1.5, 0.3]} />
      <meshBasicMaterial color="#4facfe" />
    </mesh>
  )
}

// 軽量ライティング
function MinimalLighting() {
  return (
    <>
      <ambientLight intensity={0.8} color="#ffffff" />
      <directionalLight
        position={[5, 5, 5]}
        intensity={0.4}
        color="#ffffff"
        castShadow={false}
      />
    </>
  )
}

// メインシーンコンポーネント
function Scene({
  modelUrl,
  backgroundImageUrl,
  operationMode,
  onPoseChange,
  resetTrigger,
  presetPose
}: SceneProps) {
  return (
    <>
      <MinimalLighting />

      {/* 背景壁 */}
      <Suspense fallback={null}>
        <BackgroundWall imageUrl={backgroundImageUrl} />
      </Suspense>

      {/* 人物モデル */}
      <Suspense fallback={<FallbackModel />}>
        <HumanModel
          modelUrl={modelUrl}
          operationMode={operationMode}
          onPoseChange={onPoseChange}
          resetTrigger={resetTrigger}
          presetPose={presetPose}
        />
      </Suspense>

      {/* OrbitControls */}
      <OrbitControls
        enableDamping={false}
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={8}
        target={[0, 0, 0]}
        enabled={operationMode !== 'transform'}
      />
    </>
  )
}

// メインCanvasコンポーネント
export default function Canvas3D({
  modelUrl,
  backgroundImageUrl,
  operationMode = 'view',
  onPoseChange,
  resetTrigger,
  presetPose
}: SceneProps) {
  const [debugInfo, setDebugInfo] = useState({
    camera: [0, 0, 0],
    sceneObjects: 0,
    isReady: false
  })

  return (
    <div className="w-full h-screen bg-gray-900 relative">
      <Canvas
        shadows={false}
        dpr={[1, 1]}
        camera={{
          position: [3, 2, 3],
          fov: 50,
          near: 0.1,
          far: 20
        }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "low-power",
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false
        }}
        style={{ background: '#2a2a3e' }}
        onCreated={({ gl, camera }) => {
          console.log('WebGL初期化完了')
          setDebugInfo(prev => ({
            ...prev,
            camera: [camera.position.x, camera.position.y, camera.position.z],
            isReady: true
          }))
        }}
      >
        <Scene
          modelUrl={modelUrl}
          backgroundImageUrl={backgroundImageUrl}
          operationMode={operationMode}
          onPoseChange={onPoseChange}
          resetTrigger={resetTrigger}
          presetPose={presetPose}
        />
      </Canvas>

      {/* デバッグ情報（Canvas外に配置） */}
      {process.env.NODE_ENV === 'development' && debugInfo.isReady && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white p-2 rounded text-xs max-w-xs">
          <div>カメラ: [{debugInfo.camera.map(n => n.toFixed(1)).join(', ')}]</div>
          <div>操作モード: {operationMode}</div>
          {operationMode === 'transform' && (
            <div className="text-yellow-300">⚠️ TransformControls</div>
          )}
        </div>
      )}

      {/* 現在のモード表示 */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded text-sm">
        現在のモード: {operationMode}
        {operationMode === 'view' && <div className="text-xs text-gray-300">マウスで視点操作可能</div>}
        {operationMode === 'transform' && (
          <div className="text-xs space-y-1">
            <div className="text-gray-300">3D操作可能:</div>
            <div className="text-yellow-200">• T: 移動 / R: 回転 / S: スケール</div>
            <div className="text-green-200">• ESC: 選択解除</div>
          </div>
        )}
        {operationMode === 'pose' && <div className="text-xs text-gray-300">プリセットポーズ選択可能</div>}
      </div>
    </div>
  )
}