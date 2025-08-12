'use client'
import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Toolbar, { OperationMode } from '@/components/Toolbar'
import Controls from '@/components/Controls'
import type { CanvasPoseData } from '@/components/Canvas3D'

const Canvas3D = dynamic(() => import('@/components/Canvas3D'), { ssr: false })

interface Step {
  id: string
  name: string
  data: CanvasPoseData
  timestamp: number
}

interface Course {
  id: string
  name: string
  background: string
  steps: Step[]
}

function EditorContent() {
  const params = useSearchParams()
  const router = useRouter()
  const courseId = params.get('id')
  const [course, setCourse] = useState<Course | null>(null)
  const [currentStep, setCurrentStep] = useState<Step | null>(null)
  const [currentData, setCurrentData] = useState<CanvasPoseData | null>(null)
  const [loadData, setLoadData] = useState<CanvasPoseData | null>(null)
  const [mode, setMode] = useState<OperationMode>('view')
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate'>('translate')
  const [resetTrigger, setResetTrigger] = useState(0)
  const [preset, setPreset] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    const saved = localStorage.getItem('climbing-courses')
    if (saved) {
      try {
        const list: Course[] = JSON.parse(saved)
        const found = list.find(c => c.id === courseId)
        if (found) setCourse(found)
        else router.push('/')
      } catch {
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }, [courseId, router])

  // save course to storage
  useEffect(() => {
    if (!course) return
    const saved = localStorage.getItem('climbing-courses')
    let list: Course[] = []
    if (saved) {
      try { list = JSON.parse(saved) } catch {}
    }
    const idx = list.findIndex(c => c.id === course.id)
    if (idx >= 0) list[idx] = course
    else list.push(course)
    try {
      localStorage.setItem('climbing-courses', JSON.stringify(list))
    } catch (e) {
      console.error(e)
      alert('データ保存に失敗しました。画像が大きすぎる可能性があります。')
    }
  }, [course])

  const handleStepSave = useCallback((step: Step) => {
    if (currentData) step = { ...step, data: currentData }
    setCourse(c => {
      if (!c) return c
      const steps = [...c.steps]
      const idx = steps.findIndex(s => s.id === step.id)
      if (idx >= 0) steps[idx] = step
      else steps.push(step)
      return { ...c, steps }
    })
  }, [currentData])

  const handleStepLoad = useCallback((step: Step) => {
    setCurrentStep(step)
    setLoadData({ ...step.data })
  }, [])

  const handleStepDelete = useCallback((id: string) => {
    setCourse(c => {
      if (!c) return c
      const steps = c.steps.filter(s => s.id !== id)
      return { ...c, steps }
    })
    if (currentStep?.id === id) setCurrentStep(null)
  }, [currentStep])

  const handlePlay = useCallback(() => {
    if (!course || course.steps.length === 0) return
    let index = 0
    handleStepLoad(course.steps[0])
    const timer = setInterval(() => {
      index++
      if (!course.steps[index]) { clearInterval(timer); return }
      handleStepLoad(course.steps[index])
    }, 1500)
  }, [course, handleStepLoad])

  const handlePoseChange = (d: CanvasPoseData) => setCurrentData(d)

  const handleReset = () => { setResetTrigger(v => v + 1); setCurrentStep(null) }

  if (!course) return <div className="text-white p-4">コースを読み込み中...</div>

  return (
    <main className="relative w-full h-screen overflow-hidden">
      <Canvas3D
        modelUrl="/model.glb"
        backgroundImageUrl={course.background || '/wall.jpg'}
        operationMode={mode}
        onModeChange={setMode}
        onPoseChange={handlePoseChange}
        resetTrigger={resetTrigger}
        presetPose={preset}
        loadPoseData={loadData}
        gizmoMode={gizmoMode}
        onGizmoModeChange={setGizmoMode}
      />
      <Toolbar
        currentMode={mode}
        onModeChange={setMode}
        onResetPose={handleReset}
        onPresetPose={(p) => setPreset(p)}
        gizmoMode={gizmoMode}
        onGizmoModeChange={setGizmoMode}
      />
      <Controls
        poses={course.steps}
        onPoseSave={handleStepSave}
        onPoseLoad={handleStepLoad}
        onPoseDelete={handleStepDelete}
        onPlay={handlePlay}
      />
    </main>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="text-white p-4">読み込み中...</div>}>
      <EditorContent />
    </Suspense>
  )
}
