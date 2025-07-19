import * as THREE from 'three'

export interface Joint {
  name: string
  position: THREE.Vector3
  rotation: THREE.Quaternion
  constraints?: {
    minRotation?: THREE.Euler
    maxRotation?: THREE.Euler
  }
}

export interface IKChain {
  name: string
  joints: Joint[]
  target: THREE.Vector3
  effector: Joint // エンドエフェクター（末端の関節）
}

export interface PoseData {
  joints: Record<string, {
    position: [number, number, number]
    rotation: [number, number, number]
  }>
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
}

/**
 * 基本的なFABRIK（Forward And Backward Reaching Inverse Kinematics）アルゴリズム
 */
export class FABRIKSolver {
  private chain: IKChain
  private tolerance: number
  private maxIterations: number

  constructor(chain: IKChain, tolerance = 0.01, maxIterations = 10) {
    this.chain = chain
    this.tolerance = tolerance
    this.maxIterations = maxIterations
  }

  /**
   * IKソルブ（簡易版）
   */
  solve(): boolean {
    const { joints, target } = this.chain

    if (joints.length < 2) return false

    // 各関節間の距離を保存
    const distances: number[] = []
    for (let i = 0; i < joints.length - 1; i++) {
      distances[i] = joints[i].position.distanceTo(joints[i + 1].position)
    }

    // ターゲットまでの総距離
    const totalDistance = distances.reduce((sum, dist) => sum + dist, 0)
    const startToTarget = joints[0].position.distanceTo(target)

        // ターゲットが到達可能範囲外の場合
    if (startToTarget > totalDistance) {
      // 可能な限りターゲット方向に伸ばす
      const direction = target.clone().sub(joints[0].position).normalize()
      let currentPos = joints[0].position.clone()

      for (let i = 1; i < joints.length; i++) {
        currentPos = currentPos.add(direction.clone().multiplyScalar(distances[i - 1]))
        joints[i].position.copy(currentPos)
      }
      return false
    }

    // FABRIK アルゴリズム
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      // Forward reach（ターゲットから逆算）
      joints[joints.length - 1].position.copy(target)

      for (let i = joints.length - 2; i >= 0; i--) {
        const direction = joints[i].position.clone()
          .sub(joints[i + 1].position)
          .normalize()
        joints[i].position.copy(
          joints[i + 1].position.clone()
            .add(direction.multiplyScalar(distances[i]))
        )
      }

      // Backward reach（ルートから順算）
      for (let i = 1; i < joints.length; i++) {
        const direction = joints[i].position.clone()
          .sub(joints[i - 1].position)
          .normalize()
        joints[i].position.copy(
          joints[i - 1].position.clone()
            .add(direction.multiplyScalar(distances[i - 1]))
        )
      }

      // 収束判定
      const endEffectorDistance = joints[joints.length - 1].position.distanceTo(target)
      if (endEffectorDistance < this.tolerance) {
        return true
      }
    }

    return false
  }

  /**
   * 関節の回転を更新
   */
  updateRotations(): void {
    for (let i = 0; i < this.chain.joints.length - 1; i++) {
      const joint = this.chain.joints[i]
      const nextJoint = this.chain.joints[i + 1]

      // 次の関節への方向ベクトル
      const direction = nextJoint.position.clone().sub(joint.position).normalize()

      // デフォルトの方向（Y軸正方向）から目標方向への回転を計算
      const defaultDirection = new THREE.Vector3(0, 1, 0)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultDirection, direction)

      joint.rotation.copy(quaternion)
    }
  }
}

/**
 * 基本的なボーン構造からIKチェーンを作成
 */
export function createIKChainFromBones(
  bones: THREE.Bone[],
  targetPosition: THREE.Vector3,
  chainName: string
): IKChain {
  const joints: Joint[] = bones.map((bone, index) => ({
    name: bone.name || `joint_${index}`,
    position: bone.position.clone(),
    rotation: bone.quaternion.clone(),
    constraints: {
      // デフォルトの制約（必要に応じて調整）
      minRotation: new THREE.Euler(-Math.PI / 2, -Math.PI / 2, -Math.PI / 2),
      maxRotation: new THREE.Euler(Math.PI / 2, Math.PI / 2, Math.PI / 2)
    }
  }))

  return {
    name: chainName,
    joints,
    target: targetPosition,
    effector: joints[joints.length - 1]
  }
}

/**
 * ポーズデータからボーンを更新
 */
export function applyPoseToModel(model: THREE.Group, poseData: PoseData): void {
  console.log('ポーズを適用:', poseData)

  // モデルの位置と回転を更新
  model.position.set(poseData.position.x, poseData.position.y, poseData.position.z)
  model.rotation.set(poseData.rotation.x, poseData.rotation.y, poseData.rotation.z)

  // 各関節を更新
  model.traverse((child) => {
    if (child instanceof THREE.Bone && poseData.joints[child.name]) {
      const jointData = poseData.joints[child.name]
      child.position.fromArray(jointData.position)
      child.rotation.fromArray(jointData.rotation)
    }
  })
}

/**
 * 現在のモデルからポーズデータを抽出
 */
export function extractPoseFromModel(model: THREE.Group): PoseData {
  const joints: Record<string, { position: [number, number, number]; rotation: [number, number, number] }> = {}

  model.traverse((child) => {
    if (child instanceof THREE.Bone) {
      joints[child.name] = {
        position: child.position.toArray() as [number, number, number],
        rotation: child.rotation.toArray().slice(0, 3) as [number, number, number]
      }
    }
  })

  return {
    joints,
    position: {
      x: model.position.x,
      y: model.position.y,
      z: model.position.z
    },
    rotation: {
      x: model.rotation.x,
      y: model.rotation.y,
      z: model.rotation.z
    }
  }
}

/**
 * デバッグ用：IKチェーンの可視化
 */
export function createIKChainVisualization(chain: IKChain): THREE.Group {
  const group = new THREE.Group()
  group.name = `ik_chain_${chain.name}`

  // 関節を球体で表示
  chain.joints.forEach((joint, index) => {
    const geometry = new THREE.SphereGeometry(0.05, 8, 8)
    const material = new THREE.MeshBasicMaterial({
      color: index === chain.joints.length - 1 ? 0xff0000 : 0x00ff00
    })
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.copy(joint.position)
    sphere.name = `joint_${joint.name}`
    group.add(sphere)
  })

  // 関節間を線で接続
  for (let i = 0; i < chain.joints.length - 1; i++) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      chain.joints[i].position,
      chain.joints[i + 1].position
    ])
    const material = new THREE.LineBasicMaterial({ color: 0xffffff })
    const line = new THREE.Line(geometry, material)
    line.name = `bone_${i}`
    group.add(line)
  }

  // ターゲット位置を表示
  const targetGeometry = new THREE.SphereGeometry(0.08, 8, 8)
  const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff })
  const targetSphere = new THREE.Mesh(targetGeometry, targetMaterial)
  targetSphere.position.copy(chain.target)
  targetSphere.name = 'target'
  group.add(targetSphere)

  return group
}

/**
 * デフォルトのTポーズデータ
 */
export const DEFAULT_T_POSE: PoseData = {
  joints: {
    // 基本的なTポーズの関節角度（Mixamoモデル用）
    'Hips': { position: [0, 0, 0], rotation: [0, 0, 0] },
    'Spine': { position: [0, 0.1, 0], rotation: [0, 0, 0] },
    'LeftUpperArm': { position: [-0.15, 0, 0], rotation: [0, 0, -Math.PI / 2] },
    'LeftLowerArm': { position: [-0.25, 0, 0], rotation: [0, 0, 0] },
    'RightUpperArm': { position: [0.15, 0, 0], rotation: [0, 0, Math.PI / 2] },
    'RightLowerArm': { position: [0.25, 0, 0], rotation: [0, 0, 0] },
    'LeftUpperLeg': { position: [-0.1, -0.1, 0], rotation: [0, 0, 0] },
    'LeftLowerLeg': { position: [0, -0.4, 0], rotation: [0, 0, 0] },
    'RightUpperLeg': { position: [0.1, -0.1, 0], rotation: [0, 0, 0] },
    'RightLowerLeg': { position: [0, -0.4, 0], rotation: [0, 0, 0] }
  },
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 }
}