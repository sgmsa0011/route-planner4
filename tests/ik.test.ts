import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createIKChainFromBones, FABRIKSolver } from '../src/lib/ik'

describe('createIKChainFromBones', () => {
  it('returns chain with expected number of joints and target', () => {
    const bones = [new THREE.Bone(), new THREE.Bone(), new THREE.Bone()]
    bones.forEach((bone, i) => {
      bone.name = `bone_${i}`
      bone.position.set(0, i, 0)
    })
    const target = new THREE.Vector3(0, 3, 0)
    const chain = createIKChainFromBones(bones, target, 'test')
    expect(chain.joints.length).toBe(3)
    expect(chain.target).toEqual(target)
    expect(chain.effector).toEqual(chain.joints[2])
  })
})

describe('FABRIKSolver.solve', () => {
  it('converges when the target is reachable', () => {
    const bones = [new THREE.Bone(), new THREE.Bone(), new THREE.Bone()]
    bones.forEach((bone, i) => {
      bone.name = `b_${i}`
      bone.position.set(0, i, 0)
    })
    const target = new THREE.Vector3(0, 1.5, 0)
    const chain = createIKChainFromBones(bones, target, 'solver')
    const solver = new FABRIKSolver(chain, 0.001, 50)
    const result = solver.solve()
    expect(result).toBe(true)
    expect(chain.joints[2].position.distanceTo(target)).toBeLessThan(0.01)
  })
})
