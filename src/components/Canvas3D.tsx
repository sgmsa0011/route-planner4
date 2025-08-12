'use client'

import React, { Suspense, useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, useGLTF, useTexture, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { FABRIKSolver, createIKChainFromBones, type IKChain } from '@/lib/ik'
import { OperationMode } from './Toolbar'

const modeLabel: Record<OperationMode, string> = {
  view: '視点操作',
  transform: 'モデル操作',
  pose: 'ポーズ編集'
}

export interface CanvasPoseData {
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
  onPoseChange?: (poseData: CanvasPoseData) => void
  onModeChange?: (mode: OperationMode) => void
  resetTrigger?: number
  presetPose?: string | null
  loadPoseData?: CanvasPoseData | null
  gizmoMode?: 'translate' | 'rotate'
  onGizmoModeChange?: (mode: 'translate' | 'rotate') => void
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
  // すべての関節は同一扱い（色・サイズ統一）
  return {
    type: 'normal',
    size: 0.1,
    color: '#4ecdc4',
    label: boneName
  }
}

// 関節コントロールポイント（IK対応版）
function JointControl({
  bone,
  onPointerDown,
  isDragging,
  isVisible
}: {
  bone: THREE.Bone
  onPointerDown: (bone: THREE.Bone, event: ThreeEvent<PointerEvent>) => void
  isDragging: boolean
  isVisible: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [worldPosition] = useState(new THREE.Vector3())
  const jointInfo = getJointInfo(bone.name)

  useFrame(() => {
    if (meshRef.current && bone) {
      bone.getWorldPosition(worldPosition)
      meshRef.current.position.copy(worldPosition)
    }
  })

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.button !== 0) return
    event.stopPropagation()
    onPointerDown(bone, event)
  }, [bone, onPointerDown])

  if (!isVisible) return null

  const sphereSize = jointInfo.size
  const baseColor = jointInfo.color
  const hoverColor = '#6fe6dd'
  const dragColor = '#ffff00'

  return (
    <group>
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      >
        <sphereGeometry args={[sphereSize, 12, 12]} />
        <meshBasicMaterial
          color={isDragging ? dragColor : (isHovered ? hoverColor : baseColor)}
          transparent
          opacity={0.8}
        />
      </mesh>
      {isHovered && !isDragging && (
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
  onTransformModeChange,
  onGizmoModeChange,
}: {
  operationMode: OperationMode
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void
  onGizmoModeChange?: (mode: 'translate' | 'rotate') => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.shiftKey) return

      const targetMode = operationMode === 'transform' ? 'model' : 'bone'

      switch (event.key.toLowerCase()) {
        case 't':
          event.preventDefault();
          if (targetMode === 'model') onTransformModeChange('translate');
          else if (onGizmoModeChange) onGizmoModeChange('translate');
          console.log(`${targetMode} mode: Translate (T)`);
          break
        case 'r':
          event.preventDefault();
          if (targetMode === 'model') onTransformModeChange('rotate');
          else if (onGizmoModeChange) onGizmoModeChange('rotate');
          console.log(`${targetMode} mode: Rotate (R)`);
          break
        case 's':
          event.preventDefault();
          if (targetMode === 'model') onTransformModeChange('scale');
          console.log(`${targetMode} mode: Scale (S)`);
          break
        case 'escape':
          event.preventDefault()
          console.log('選択解除 (ESC)')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [operationMode, onTransformModeChange, onGizmoModeChange])

  return null
}

// 頭部クリック検出用コンポーネント
function HeadClickTarget({
  bone,
  operationMode,
  onSingle,
  onDouble
}: {
  bone: THREE.Bone | null
  operationMode: OperationMode
  onSingle: () => void
  onDouble: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const clickTimer = useRef<NodeJS.Timeout | null>(null)

  const modeColors: Record<OperationMode, string> = {
    view: '#888888',
    transform: '#f87171',
    pose: '#4ecdc4'
  }

  useFrame(() => {
    if (meshRef.current && bone) {
      bone.getWorldPosition(meshRef.current.position)
    }
  })

  const handleClick = useCallback(() => {
    if (clickTimer.current) return
    clickTimer.current = setTimeout(() => {
      onSingle()
      clickTimer.current = null
    }, 250)
  }, [onSingle])

  const handleDoubleClick = useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    onDouble()
  }, [onDouble])

  return (
    <mesh ref={meshRef} onClick={handleClick} onDoubleClick={handleDoubleClick}>
      <sphereGeometry args={[0.25, 8, 8]} />
      <meshBasicMaterial
        color={modeColors[operationMode]}
        transparent
        opacity={0.4}
      />
    </mesh>
  )
}

// 人物モデルコンポーネント（拡張版）
function HumanModel({
  modelUrl,
  operationMode,
  onPoseChange,
  onModeChange,
  resetTrigger,
  presetPose,
  loadPoseData,
  gizmoMode = 'translate',
  onGizmoModeChange,
}: {
  modelUrl?: string
  operationMode: OperationMode
  onPoseChange?: (poseData: CanvasPoseData) => void
  onModeChange?: (mode: OperationMode) => void
  resetTrigger?: number
  presetPose?: string | null
  loadPoseData?: CanvasPoseData | null
  gizmoMode?: 'translate' | 'rotate'
  onGizmoModeChange?: (mode: 'translate' | 'rotate') => void
}) {
  const modelRef = useRef<THREE.Group>(null)
  const innerModelRef = useRef<THREE.Group>(null)
  const [waistOffset, setWaistOffset] = useState(new THREE.Vector3(0, 0, 0))
  const [isModelReady, setIsModelReady] = useState(false)
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate')
  const [bones, setBones] = useState<THREE.Bone[]>([])
  const [headBone, setHeadBone] = useState<THREE.Bone | null>(null)
  const [originalPose, setOriginalPose] = useState<Record<string, BoneData> | null>(null)
  const [ikChains, setIkChains] = useState<Record<string, THREE.Bone[]>>({})
  const [activeIKChain, setActiveIKChain] = useState<IKChain | null>(null)
  const [ikTarget, setIkTarget] = useState<THREE.Vector3 | null>(null)
  const [modelTransform, setModelTransform] = useState({
    position: new THREE.Vector3(0, -1, 0),
    // 初期向きを後ろ向き(180度回転)にし、大きさを1.5倍に設定
    rotation: new THREE.Euler(0, Math.PI, 0),
    scale: new THREE.Vector3(1.5, 1.5, 1.5)
  })

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

      // IK チェーンを定義
      const chains: Record<string, THREE.Bone[]> = {};
      const findBone = (pattern: RegExp) => magicPoserJoints.find(b => pattern.test(b.name));

      // Right Arm
      const rightShoulder = findBone(/(right|r).*shoulder/i);
      const rightUpperArm = findBone(/(right|r).*(upperarm|arm)(?!.*hand)/i);
      const rightForearm = findBone(/(right|r).*forearm/i);
      const rightHand = findBone(/(right|r).*hand$/i);
      if (rightShoulder && rightUpperArm && rightForearm && rightHand) {
          chains['rightArm'] = [rightShoulder, rightUpperArm, rightForearm, rightHand];
      }

      // Left Arm
      const leftShoulder = findBone(/(left|l).*shoulder/i);
      const leftUpperArm = findBone(/(left|l).*(upperarm|arm)(?!.*hand)/i);
      const leftForearm = findBone(/(left|l).*forearm/i);
      const leftHand = findBone(/(left|l).*hand$/i);
      if (leftShoulder && leftUpperArm && leftForearm && leftHand) {
          chains['leftArm'] = [leftShoulder, leftUpperArm, leftForearm, leftHand];
      }

      // Right Leg
      const rightUpLeg = findBone(/(right|r).*upleg/i);
      const rightLeg = findBone(/(right|r).*leg(?!.*up)/i);
      const rightFoot = findBone(/(right|r).*foot(?!.*toe)/i);
      if (rightUpLeg && rightLeg && rightFoot) {
          chains['rightLeg'] = [rightUpLeg, rightLeg, rightFoot];
      }

      // Left Leg
      const leftUpLeg = findBone(/(left|l).*upleg/i);
      const leftLeg = findBone(/(left|l).*leg(?!.*up)/i);
      const leftFoot = findBone(/(left|l).*foot(?!.*toe)/i);
      if (leftUpLeg && leftLeg && leftFoot) {
          chains['leftLeg'] = [leftUpLeg, leftLeg, leftFoot];
      }

      setIkChains(chains);
      console.log('IK Chains defined:', chains);

      const head = magicPoserJoints.find(b => /head|skull/i.test(b.name)) || null
      setHeadBone(head)
      setOriginalPose(originalBoneData)

      // ウエスト位置を計算（骨があれば優先）
      const pelvis = magicPoserJoints.find(b => /pelvis|hips/i.test(b.name))
      if (pelvis) {
        gltf.scene.updateMatrixWorld(true)
        const pelvisPos = new THREE.Vector3()
        pelvis.getWorldPosition(pelvisPos)
        setWaistOffset(pelvisPos)
      } else {
        const bbox = new THREE.Box3().setFromObject(gltf.scene)
        const height = bbox.max.y - bbox.min.y
        const waist = new THREE.Vector3(0, bbox.min.y + height * 0.5, 0)
        setWaistOffset(waist)
      }

      // モデル位置設定はJSX側で行うため、ここではオフセットのみ更新

      console.log('🎯 拡張ポーズ編集モデル読み込み完了:', magicPoserJoints.length, '個の主要関節')

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

  // 外部からポーズデータを読み込んだときの適用処理
  useEffect(() => {
    if (loadPoseData && modelRef.current) {
      // モデルの位置・回転・スケールを適用
      modelRef.current.position
        .fromArray(loadPoseData.model.position)
        .add(waistOffset)
      modelRef.current.rotation.fromArray(loadPoseData.model.rotation as [number, number, number])
      modelRef.current.scale.fromArray(loadPoseData.model.scale)

      // 各ボーンのデータを適用
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Bone && loadPoseData.bones[child.name]) {
          const data = loadPoseData.bones[child.name]
          child.position.fromArray(data.position)
          child.rotation.fromArray(data.rotation as [number, number, number])
          child.quaternion.fromArray(data.quaternion)
        }
      })

      if (onPoseChange) {
        const poseData = extractCurrentPose()
        onPoseChange(poseData)
      }
    }
  }, [loadPoseData, waistOffset])

    // 🔍 デバッグ強化：マウス移動とポーズ変更の詳細確認
  // 現在のポーズ抽出
  const extractCurrentPose = useCallback((): CanvasPoseData => {
    const poseData: CanvasPoseData = {
      model: {
        position:
          (modelRef.current?.position.toArray() as [number, number, number]) || [
            0,
            -1,
            0
          ],
        rotation:
          (modelRef.current?.rotation
            .toArray()
            .slice(0, 3) as [number, number, number]) || [0, 0, 0],
        scale:
          (modelRef.current?.scale.toArray() as [number, number, number]) || [
            1,
            1,
            1
          ]
      },
      bones: {}
    }

    bones.forEach((bone) => {
      poseData.bones[bone.name] = {
        position: bone.position.toArray() as [number, number, number],
        rotation: bone.rotation
          .toArray()
          .slice(0, 3) as [number, number, number],
        quaternion: bone.quaternion.toArray() as [
          number,
          number,
          number,
          number
        ]
      }
    })

    return poseData
  }, [bones])

  const [selectedBone, setSelectedBone] = useState<THREE.Bone | null>(null)
  const [isIKDragging, setIsIKDragging] = useState(false)
  const { camera, raycaster, size, controls } = useThree()
  const dragPlane = useRef(new THREE.Plane())
  const initialBoneMatrix = useRef(new THREE.Matrix4())

  // IK states from previous implementation
  const [activeIKChain, setActiveIKChain] = useState<IKChain | null>(null)
  const [ikTarget, setIkTarget] = useState<THREE.Vector3 | null>(null)

  const handleJointPointerDown = useCallback((bone: THREE.Bone, event: ThreeEvent<PointerEvent>) => {
    if (operationMode !== 'pose') {
      setSelectedBone(null)
      return
    }
    event.stopPropagation()
    setSelectedBone(bone)
  }, [operationMode])

  // Unselect bone when clicking away from the model
  useEffect(() => {
    const handlePointerMissed = (event: PointerEvent) => {
      if ((event.target as HTMLElement).tagName === 'CANVAS') {
        setSelectedBone(null)
      }
    }
    const canvas = document.querySelector('canvas')
    canvas?.addEventListener('pointerdown', handlePointerMissed)
    return () => canvas?.removeEventListener('pointerdown', handlePointerMissed)
  }, [])

  const handleGizmoDragChange = useCallback((isDragging: boolean) => {
    setIsIKDragging(isDragging)
    if (controls) (controls as any).enabled = !isDragging

    if (isDragging && selectedBone) {
      initialBoneMatrix.current.copy(selectedBone.matrixWorld)

      const chainName = Object.keys(ikChains).find(name =>
        ikChains[name].some(b => b.uuid === selectedBone.uuid)
      )
      if (chainName) {
        const chain = ikChains[chainName]
        const targetPos = new THREE.Vector3()
        chain[chain.length - 1].getWorldPosition(targetPos)
        const ikChainForSolver = createIKChainFromBones(chain, targetPos, chainName)
        const worldPositions = chain.map(b => b.getWorldPosition(new THREE.Vector3()))
        ikChainForSolver.joints.forEach((j, i) => j.position.copy(worldPositions[i]))
        setActiveIKChain(ikChainForSolver)
      }
    } else {
      setActiveIKChain(null)
    }
  }, [controls, selectedBone, ikChains])

  const handleGizmoChange = () => {
    if (!selectedBone) return

    if (gizmoMode === 'translate' && activeIKChain) {
      // Revert bone's direct movement
      const parentInverse = selectedBone.parent?.matrixWorld.clone().invert()
      if (parentInverse) {
        const newMatrix = initialBoneMatrix.current.clone().multiply(parentInverse)
        newMatrix.decompose(selectedBone.position, selectedBone.quaternion, selectedBone.scale)
      }

      // Update IK target
      const newTargetPos = new THREE.Vector3()
      selectedBone.getWorldPosition(newTargetPos)
      setIkTarget(newTargetPos)

    } else {
      // For rotation, TransformControls modifies the bone directly.
      // Just need to broadcast the change.
      if (onPoseChange) onPoseChange(extractCurrentPose())
    }
  }

  useFrame(() => {
    if (isIKDragging && activeIKChain && ikTarget) {
      activeIKChain.target.copy(ikTarget)
      const solver = new FABRIKSolver(activeIKChain, 0.01, 15)
      if (solver.solve()) {
        const chainBones = ikChains[activeIKChain.name]
        if (!chainBones) return

        for (let i = 0; i < chainBones.length - 1; i++) {
          const bone = chainBones[i]
          const nextSolvedPosition = activeIKChain.joints[i + 1].position
          const parent = bone.parent
          if (parent) {
            const targetLocal = parent.worldToLocal(nextSolvedPosition.clone())
            const lookAtMatrix = new THREE.Matrix4().lookAt(bone.position, targetLocal, bone.up)
            const newQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix)
            bone.quaternion.slerp(newQuaternion, 0.6)
          }
        }
        if (onPoseChange) onPoseChange(extractCurrentPose())
      }
    }
  })

  if (!gltf || !gltf.scene) {
    return null
  }

  return (
    <group>
      {/* キーボードハンドラー */}
      <KeyboardHandler
        operationMode={operationMode}
        onTransformModeChange={setTransformMode}
      />

      {/* 3Dモデル */}
      <group
        ref={modelRef}
        position={modelTransform.position.clone().add(waistOffset)}
        rotation={modelTransform.rotation}
        scale={modelTransform.scale}
      >
        <primitive
          ref={innerModelRef}
          object={gltf.scene}
          position={waistOffset.clone().negate()}
        />
      </group>

      {/* 頭部クリック検出 */}
      {headBone && (
        <HeadClickTarget
          bone={headBone}
          operationMode={operationMode}
          onSingle={() => onModeChange && onModeChange('pose')}
          onDouble={() => onModeChange && onModeChange('transform')}
        />
      )}

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
            if (modelRef.current) {
              // スケールモードでは縦横比を維持する
              if (transformMode === 'scale') {
                const uniform = modelRef.current.scale.x
                modelRef.current.scale.set(uniform, uniform, uniform)
              }

              // モデル変形を記録
              setModelTransform({
                position: modelRef.current.position
                  .clone()
                  .sub(waistOffset),
                rotation: modelRef.current.rotation.clone(),
                scale: modelRef.current.scale.clone()
              })

              if (onPoseChange) {
                const poseData = extractCurrentPose()
                onPoseChange(poseData)
              }
            }
          }}
        />
      )}

      {/* 関節コントロールポイント（ポーズ編集モード時のみ） */}
      {bones.map((bone) => (
        <JointControl
          key={bone.uuid}
          bone={bone}
          onPointerDown={handleJointPointerDown}
          isDragging={selectedBone?.uuid === bone.uuid}
          isVisible={operationMode === 'pose'}
        />
      ))}

      {/* TransformControls for selected bone */}
      {selectedBone && operationMode === 'pose' && (
        <TransformControls
            object={selectedBone}
            mode={gizmoMode}
            onObjectChange={handleGizmoChange}
            onDraggingChanged={handleGizmoDragChange}
            space={gizmoMode === 'translate' ? 'world' : 'local'}
            size={0.5}
        />
      )}
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
  onModeChange,
  resetTrigger,
  presetPose,
  loadPoseData,
  gizmoMode,
  onGizmoModeChange,
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
          onModeChange={onModeChange}
          resetTrigger={resetTrigger}
          presetPose={presetPose}
          loadPoseData={loadPoseData}
          gizmoMode={gizmoMode}
          onGizmoModeChange={onGizmoModeChange}
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
  onModeChange,
  resetTrigger,
  presetPose,
  loadPoseData,
  gizmoMode,
  onGizmoModeChange,
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
        onPointerMissed={() => onModeChange && onModeChange('view')}
      >
        <Scene
          modelUrl={modelUrl}
          backgroundImageUrl={backgroundImageUrl}
          operationMode={operationMode}
          onPoseChange={onPoseChange}
          onModeChange={onModeChange}
          resetTrigger={resetTrigger}
          presetPose={presetPose}
          loadPoseData={loadPoseData}
          gizmoMode={gizmoMode}
          onGizmoModeChange={onGizmoModeChange}
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

      {/* 操作ガイドパネルはToolbarに統合 */}
    </div>
  )
}