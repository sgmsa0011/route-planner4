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

// 背景壁コンポーネント（アスペクト比対応）
function BackgroundWall({ imageUrl }: { imageUrl?: string }) {
  const texture = useTexture(imageUrl || '/wall.jpg')
  const [dimensions, setDimensions] = useState({ width: 8, height: 6 })

  useEffect(() => {
    if (texture && texture.image) {
      const img = texture.image
      const aspectRatio = img.width / img.height
      const maxWidth = 10
      const maxHeight = 8

      let width, height
      if (aspectRatio > maxWidth / maxHeight) {
        // 幅が制限要素
        width = maxWidth
        height = maxWidth / aspectRatio
      } else {
        // 高さが制限要素
        height = maxHeight
        width = maxHeight * aspectRatio
      }

      setDimensions({ width, height })
      console.log('背景画像サイズ調整:', `${img.width}x${img.height} → ${width.toFixed(1)}x${height.toFixed(1)}`)
    }
  }, [texture])

  return (
    <mesh position={[0, 0, -2]} rotation={[0, 0, 0]}>
      <planeGeometry args={[dimensions.width, dimensions.height]} />
      <meshBasicMaterial
        map={texture}
        transparent={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
  }

// Magic Poser準拠：19個関節選択
function selectMagicPoserJoints(allBones: THREE.Bone[]): THREE.Bone[] {
  const selectedJoints: THREE.Bone[] = []
  const usedNames = new Set<string>()

  // Magic Poserの19個関節定義
  const jointTargets = [
    // 頭部・首 (2個)
    { pattern: /head|skull/i, label: '頭部', priority: 1 },
    { pattern: /neck/i, label: '首', priority: 1 },

    // 胴体 (2個)
    { pattern: /spine.*(?:chest|upper|1)/i, label: '胸部', priority: 1 },
    { pattern: /pelvis|hips/i, label: '腰', priority: 1 },

    // 腕関節 (6個)
    { pattern: /(left|l).*shoulder/i, label: '左肩', priority: 2 },
    { pattern: /(right|r).*shoulder/i, label: '右肩', priority: 2 },
    { pattern: /(left|l).*(upperarm|arm)(?!.*hand)/i, label: '左上腕', priority: 2 },
    { pattern: /(right|r).*(upperarm|arm)(?!.*hand)/i, label: '右上腕', priority: 2 },
    { pattern: /(left|l).*forearm/i, label: '左前腕', priority: 2 },
    { pattern: /(right|r).*forearm/i, label: '右前腕', priority: 2 },

    // 手 (2個)
    { pattern: /(left|l).*hand$/i, label: '左手', priority: 3 },
    { pattern: /(right|r).*hand$/i, label: '右手', priority: 3 },

    // 脚関節 (8個) - Mixamorig命名規則対応
    { pattern: /(left|l).*upleg/i, label: '左太もも', priority: 2 },
    { pattern: /(right|r).*upleg/i, label: '右太もも', priority: 2 },
    { pattern: /(left|l).*leg(?!.*up)/i, label: '左すね', priority: 2 },
    { pattern: /(right|r).*leg(?!.*up)/i, label: '右すね', priority: 2 },
    { pattern: /(left|l).*foot(?!.*toe)/i, label: '左足首', priority: 3 },
    { pattern: /(right|r).*foot(?!.*toe)/i, label: '右足首', priority: 3 },
    { pattern: /(left|l).*toebase/i, label: '左足先', priority: 3 },
    { pattern: /(right|r).*toebase/i, label: '右足先', priority: 3 }
  ]

    console.log('🎯 Magic Poser関節選択開始...')

  // 🔍 実際の骨名をすべて表示（デバッグ用）
  console.log('📋 利用可能な全骨名:')
  allBones.forEach((bone, index) => {
    console.log(`${index + 1}. ${bone.name}`)
  })

  // 除外すべきパターン
  const excludePatterns = [
    'finger', 'thumb', 'index', 'middle', 'ring', 'pinky',
    'toe', 'end', 'twist', 'roll', 'bend', 'meta'
  ]

  // 各関節タイプに対して最適な骨を選択
  jointTargets.forEach(target => {
    const candidates = allBones.filter(bone => {
      const name = bone.name.toLowerCase()

      // 除外パターンのチェック
      const shouldExclude = excludePatterns.some(exclude => name.includes(exclude))
      if (shouldExclude) return false

      // 既に使用済みの場合は除外
      if (usedNames.has(bone.name)) return false

      // ターゲットパターンにマッチするかチェック
      return target.pattern.test(bone.name)
    })

    if (candidates.length > 0) {
      // 名前が短く、シンプルなものを優先選択
      const best = candidates.reduce((prev, curr) => {
        const prevScore = prev.name.length + (prev.name.includes('twist') ? 100 : 0)
        const currScore = curr.name.length + (curr.name.includes('twist') ? 100 : 0)
        return currScore < prevScore ? curr : prev
      })

      selectedJoints.push(best)
      usedNames.add(best.name)
      console.log(`✅ ${target.label}: ${best.name}`)
    } else {
      console.log(`❌ ${target.label}: 見つからない`)
    }
  })

  console.log(`🎯 拡張関節選択完了: ${selectedJoints.length}個（太もも・すね追加版）`)
  return selectedJoints
}

// 関節の重要度情報取得
function getJointInfo(boneName: string) {
  const name = boneName.toLowerCase()

  // 重要関節（赤色・大きめ）
  if (name.includes('head') || name.includes('hand') || name.includes('foot')) {
    return {
      type: 'important',
      size: 0.15,
      color: '#ff6b6b',
      label: boneName
    }
  }

  // 脚関節（緑色・中サイズ）
  if (name.includes('leg') || name.includes('hip')) {
    return {
      type: 'leg',
      size: 0.12,
      color: '#4CAF50',
      label: boneName
    }
  }

  // 一般関節（青色・標準）
  return {
    type: 'normal',
    size: 0.1,
    color: '#4ecdc4',
    label: boneName
  }
}

// 関節コントロールポイント（復活・改善版）
function JointControl({
  bone,
  onDrag,
  isVisible
}: {
  bone: THREE.Bone
  onDrag: (bone: THREE.Bone, screenDelta: { x: number, y: number }) => void
  isVisible: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [worldPosition] = useState(new THREE.Vector3())
  const [lastMousePos, setLastMousePos] = useState<{ x: number, y: number } | null>(null)
  const jointInfo = getJointInfo(bone.name)

  useFrame(() => {
    if (meshRef.current && bone) {
      // ボーンのワールド座標を取得
      bone.getWorldPosition(worldPosition)
      meshRef.current.position.copy(worldPosition)
    }
  })

    const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    // 左クリックのみ受け付ける
    if (event.nativeEvent.button !== 0) return

    event.stopPropagation()
    event.nativeEvent.preventDefault()
    setIsDragging(true)

        // 🎯 ドラッグ開始位置を記録
    const startPos = {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY
    }
    setLastMousePos(startPos)

    console.log('✅ ドラッグ開始:', bone.name, '開始位置:', startPos)
  }, [bone.name])

    const handlePointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return

    event.stopPropagation()
    event.nativeEvent.preventDefault()
    setIsDragging(false)
    setLastMousePos(null)

    console.log('✅ ドラッグ終了:', bone.name)
  }, [isDragging, bone.name])

    const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    // デバッグログは実際にドラッグ中のみ
    if (isDragging && lastMousePos) {
      console.log('📍 [PointerMove] ドラッグ中のマウス移動:', bone.name, {
        buttons: event.nativeEvent.buttons,
        clientX: event.nativeEvent.clientX,
        clientY: event.nativeEvent.clientY
      })
    }

    if (!isDragging || !lastMousePos) {
      // 不要なログを削除
      return
    }

    // 🔧 重要：マウスボタンが実際に押されているかチェック
    if (event.nativeEvent.buttons === 0) {
      // ボタンが離されている場合はドラッグ終了
      setIsDragging(false)
      setLastMousePos(null)
      console.log('✅ ボタンリリース検出でドラッグ終了:', bone.name)
      return
    }

        // 左ボタンが押されている場合のみポーズ編集
    if (event.nativeEvent.buttons === 1) {
      event.stopPropagation()
      event.nativeEvent.preventDefault()

      // 🎯 マウス移動量（スクリーン座標）を計算
      const currentMousePos = {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY
      }

      const screenDelta = {
        x: currentMousePos.x - lastMousePos.x,
        y: currentMousePos.y - lastMousePos.y
      }

      console.log('🎯 [PointerMove] 関節:', bone.name, '移動量:', screenDelta)

      // 微小な移動は無視（ノイズ対策）
      if (Math.abs(screenDelta.x) > 1 || Math.abs(screenDelta.y) > 1) {
        // 移動量を関節ドラッグハンドラーに渡す
        console.log('🎯 [PointerMove] ドラッグハンドラー呼び出し開始')
        onDrag(bone, screenDelta)
        console.log('🎯 [PointerMove] ドラッグハンドラー呼び出し完了')
      } else {
        console.log('🎯 [PointerMove] 微小移動のため無視 - deltaX:', Math.abs(screenDelta.x), 'deltaY:', Math.abs(screenDelta.y))
      }

      // 次回計算用に現在位置を保存
      setLastMousePos(currentMousePos)
    } else {
      console.log('⚠️ [PointerMove] ボタン状態が不正:', event.nativeEvent.buttons)
    }
  }, [isDragging, lastMousePos, bone, onDrag])

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false)
    // ポインターが関節から離れた場合、ドラッグ中でもホバー解除
  }, [])

  // 🔧 グローバルマウスイベントでドラッグ状態を確実に管理
  useEffect(() => {
    if (!isDragging) return

    console.log('🔧 [GlobalMouse] イベント登録:', bone.name)

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!lastMousePos) return

      // 左ボタンが押されている場合のみ
      if (event.buttons === 1) {
        const currentMousePos = {
          x: event.clientX,
          y: event.clientY
        }

        const screenDelta = {
          x: currentMousePos.x - lastMousePos.x,
          y: currentMousePos.y - lastMousePos.y
        }

        // 微小な移動は無視
        if (Math.abs(screenDelta.x) > 1 || Math.abs(screenDelta.y) > 1) {
          console.log('🔧 [GlobalMove] 関節:', bone.name, '移動量:', screenDelta)
          onDrag(bone, screenDelta)
          setLastMousePos(currentMousePos)
        }
      } else if (event.buttons === 0) {
        // ボタンが離された場合はドラッグ終了
        setIsDragging(false)
        setLastMousePos(null)
        console.log('✅ [GlobalMove] ボタンリリース検出でドラッグ終了:', bone.name)
      }
    }

        const handleGlobalMouseUp = () => {
      console.log('✅ [GlobalMouseUp] ドラッグ終了:', bone.name)
      setIsDragging(false)
      setLastMousePos(null)
    }

    const handleGlobalMouseLeave = () => {
      console.log('✅ [GlobalMouseLeave] ドラッグ終了:', bone.name)
      setIsDragging(false)
      setLastMousePos(null)
    }

    // ドラッグ状態を強制リセットするタイマー（3秒後）
    const resetTimer = setTimeout(() => {
      if (isDragging) {
        console.log('⏰ [AutoReset] 3秒経過でドラッグ状態をリセット:', bone.name)
        setIsDragging(false)
        setLastMousePos(null)
      }
    }, 3000)

    // ウィンドウ全体でマウスアップを監視
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mouseleave', handleGlobalMouseLeave)

    return () => {
      console.log('🔧 [GlobalMouse] イベント解除:', bone.name)
      clearTimeout(resetTimer)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mouseleave', handleGlobalMouseLeave)
    }
  }, [isDragging, lastMousePos, bone, onDrag])

  if (!isVisible) return null

  // 関節情報に基づくサイズと色
  const sphereSize = jointInfo.size
  const baseColor = jointInfo.color
  const hoverColor = jointInfo.type === 'important' ? '#ff9999' :
                     jointInfo.type === 'leg' ? '#66BB6A' : '#6fe6dd'
  const dragColor = '#ffff00'

  return (
    <group>
      {/* メイン関節球 */}
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <sphereGeometry args={[sphereSize, 12, 12]} />
        <meshBasicMaterial
          color={isDragging ? dragColor : (isHovered ? hoverColor : baseColor)}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* ホバー時のリング */}
      {isHovered && (
        <mesh position={worldPosition}>
          <ringGeometry args={[sphereSize * 1.5, sphereSize * 2, 16]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
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
  const [modelTransform, setModelTransform] = useState({
    position: new THREE.Vector3(0, -1, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1)
  })

  // カメラ参照を取得してドラッグ操作に活用
  const { camera } = useThree()

  const gltf = useGLTF(modelUrl || '/model.glb')

  // 🔍 SkinnedMeshの更新状況監視
  useFrame(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          child.skeleton.update()

          // ポーズ編集中のみSkinnedMesh更新ログ
          if (operationMode === 'pose') {
            // console.log('🔍 [SkinnedMesh] 更新:', child.name)
          }
        }
      })
    }
  })

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

      // Magic Poser準拠の19個関節のみを選択
      const magicPoserJoints = selectMagicPoserJoints(foundBones)
      setBones(magicPoserJoints)
      setOriginalPose(originalBoneData)

      // モデル位置設定
      modelRef.current.position.copy(modelTransform.position)
      modelRef.current.scale.copy(modelTransform.scale)
      modelRef.current.rotation.copy(modelTransform.rotation)

      console.log('🎯 拡張ポーズ編集モデル読み込み完了:', magicPoserJoints.length, '個の主要関節')

      setTimeout(() => {
        setIsModelReady(true)
      }, 200)
    }
  }, [gltf.scene, modelTransform])

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

  // リセット機能（改善版）
  useEffect(() => {
    if (resetTrigger && originalPose && modelRef.current) {
      // ボーンのみリセット（モデルTransformは保持）
      bones.forEach((bone) => {
        const original = originalPose[bone.name]
        if (original) {
          bone.position.copy(original.position)
          bone.rotation.copy(original.rotation)
          bone.quaternion.copy(original.quaternion)
        }
      })

      console.log('ポーズリセット完了（モデル変形は保持）')

      // ポーズ変更を通知
      if (onPoseChange) {
        const poseData = extractCurrentPose()
        onPoseChange(poseData)
      }
    }
  }, [resetTrigger, bones, originalPose, onPoseChange])

    // 🔍 デバッグ強化：マウス移動とポーズ変更の詳細確認
  const handleJointDrag = useCallback((bone: THREE.Bone, screenDelta: { x: number, y: number }) => {
    const DEBUG_MODE = true  // デバッグモードのオンオフ

    console.log('🔥 [handleJointDrag] 開始 - 関節:', bone.name, '移動量:', screenDelta)

    if (DEBUG_MODE) {
      console.log('🔍 [ドラッグ詳細] 関節:', bone.name)
      console.log('🔍 [マウス移動量] X:', screenDelta.x, 'Y:', screenDelta.y)
    }

    // カメラ基準の回転軸を計算
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize()

    // 角度計算
    const SENSITIVITY = 0.005
    const yaw = screenDelta.x * SENSITIVITY
    const pitch = -screenDelta.y * SENSITIVITY

    // ボーン種類に応じて回転量を調整
    const name = bone.name.toLowerCase()
    let yawFactor = 1
    let pitchFactor = 1
    if (name.includes('foot')) {
      yawFactor = 1.5
      pitchFactor = 3.0
    } else if (name.includes('leg') && name.includes('up')) {
      yawFactor = 1.2
      pitchFactor = 2.5
    } else if (name.includes('leg')) {
      yawFactor = 0.8
      pitchFactor = 2.0
    } else if (name.includes('hand') || name.includes('arm')) {
      yawFactor = 1.5
      pitchFactor = 1.0
    } else if (name.includes('head')) {
      yawFactor = 0.8
      pitchFactor = 0.5
    } else if (name.includes('spine')) {
      yawFactor = 0.6
      pitchFactor = 0.3
    }

    // 回転適用
    bone.rotateOnWorldAxis(right, pitch * pitchFactor)
    bone.rotateOnWorldAxis(camera.up, yaw * yawFactor)

    // 更新を確実に反映
    bone.updateMatrix()
    bone.updateMatrixWorld(true)

    if (onPoseChange) {
      const poseData = extractCurrentPose()
      onPoseChange(poseData)
    }

    console.log('🔥 [handleJointDrag] 処理完了')
  }, [camera, onPoseChange, extractCurrentPose])

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
    return null // 水色立方体を削除
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
              // モデル変形を記録
              setModelTransform({
                position: modelRef.current.position.clone(),
                rotation: modelRef.current.rotation.clone(),
                scale: modelRef.current.scale.clone()
              })

              const poseData = extractCurrentPose()
              onPoseChange(poseData)
            }
          }}
        />
      )}

      {/* 関節コントロールポイント（ポーズ編集モード時のみ） */}
      {bones.map((bone) => (
        <JointControl
          key={bone.uuid}
          bone={bone}
          onDrag={handleJointDrag}
          isVisible={operationMode === 'pose'}
        />
      ))}
    </group>
  )
}

// フォールバック用モデル（削除）
function FallbackModel() {
  return null // 何も表示しない
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
        enabled={operationMode === 'view'}
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
          {operationMode === 'pose' && (
            <div className="text-green-300">🤸 関節操作可能</div>
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
                 {operationMode === 'pose' && (
           <div className="text-xs space-y-1">
             <div className="text-gray-300">ポーズ編集 (デバッグ強化版):</div>
             <div className="text-red-200">• 赤球: 重要関節（手・足・頭）</div>
             <div className="text-green-200">• 緑球: 脚関節（太もも・すね）</div>
             <div className="text-cyan-200">• 青球: 一般関節（肩・腕・胴体）</div>
             <div className="text-yellow-200">• ドラッグで関節移動・連動動作</div>
             <div className="text-orange-200">🔍 コンソールでドラッグ詳細確認可能</div>
           </div>
         )}
      </div>
    </div>
  )
}