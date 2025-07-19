'use client'

import React, { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

interface SceneProps {
  modelUrl?: string
  backgroundImageUrl?: string
}

// 背景壁コンポーネント
function BackgroundWall({ imageUrl }: { imageUrl?: string }) {
  const texture = useTexture(imageUrl || '/wall.jpg')

  return (
    <mesh position={[0, 0, -5]} rotation={[0, 0, 0]}>
      <planeGeometry args={[20, 15]} />
      <meshStandardMaterial
        map={texture}
        transparent={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// 人物モデルコンポーネント
function HumanModel({ modelUrl }: { modelUrl?: string }) {
  const modelRef = useRef<THREE.Group>(null)

  // Hooksは常に同じ順序で呼び出す
  const gltf = useGLTF(modelUrl || '/model.glb')

  if (!gltf || !gltf.scene) {
    // モデルが正しく読み込まれなかった場合のフォールバック
    return (
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 2, 0.5]} />
        <meshStandardMaterial color="#ff6b6b" />
      </mesh>
    )
  }

  // モデルを複製して操作可能にする
  const clonedScene = gltf.scene.clone()

  return (
    <primitive
      ref={modelRef}
      object={clonedScene}
      position={[0, -3, 0]}
      scale={[1, 1, 1]}
      castShadow
      receiveShadow
    />
  )
}

// フォールバック用モデルコンポーネント
function FallbackModel() {
  return (
    <mesh position={[0, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[1, 2, 0.5]} />
      <meshStandardMaterial color="#4facfe" />
    </mesh>
  )
}

// ライティング設定
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
    </>
  )
}

// メインシーンコンポーネント
function Scene({ modelUrl, backgroundImageUrl }: SceneProps) {
  return (
    <>
      <Lighting />

      {/* 背景壁 */}
      <Suspense fallback={null}>
        <BackgroundWall imageUrl={backgroundImageUrl} />
      </Suspense>

      {/* 人物モデル */}
      <Suspense fallback={<FallbackModel />}>
        <HumanModel modelUrl={modelUrl} />
      </Suspense>

      {/* グリッド（床） */}
      <Grid
        infiniteGrid
        fadeDistance={50}
        fadeStrength={5}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d4b4b"
      />

      {/* 環境設定 */}
      <Environment preset="warehouse" />

      {/* カメラコントロール */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  )
}

// メインCanvasコンポーネント
export default function Canvas3D({ modelUrl, backgroundImageUrl }: SceneProps) {
  return (
    <div className="w-full h-screen bg-gray-900">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [5, 5, 5],
          fov: 50,
          near: 0.1,
          far: 1000
        }}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true
        }}
        style={{ background: 'linear-gradient(to bottom, #1a1a2e, #16213e)' }}
      >
        <Scene modelUrl={modelUrl} backgroundImageUrl={backgroundImageUrl} />
      </Canvas>

      {/* UI オーバーレイ */}
      <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2">ボルダリングポーズ検討</h2>
        <div className="space-y-1 text-sm">
          <p>• マウス左ドラッグ：視点回転</p>
          <p>• マウス右ドラッグ：視点移動</p>
          <p>• ホイール：ズーム</p>
        </div>
      </div>
    </div>
  )
}