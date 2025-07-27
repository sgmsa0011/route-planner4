'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CanvasPoseData } from '@/components/Canvas3D'

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

export default function Home() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [name, setName] = useState('')
  const [bgFile, setBgFile] = useState<File | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('climbing-courses')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setCourses(parsed)
      } catch {}
    }
  }, [])

  const saveCourses = (list: Course[]) => {
    setCourses(list)
    localStorage.setItem('climbing-courses', JSON.stringify(list))
  }

  const handleCreate = async () => {
    if (!name.trim()) return alert('コース名を入力してください')
    let bg = ''
    if (bgFile) {
      bg = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target?.result as string)
        reader.readAsDataURL(bgFile)
      })
    }
    const id = `course_${Date.now()}`
    const newCourse: Course = { id, name: name.trim(), background: bg, steps: [] }
    const updated = [...courses, newCourse]
    saveCourses(updated)
    router.push(`/editor?id=${id}`)
  }

  const handleOpen = (id: string) => {
    router.push(`/editor?id=${id}`)
  }

  const handleDelete = (id: string) => {
    if (!confirm('このコースを削除しますか？')) return
    const updated = courses.filter(c => c.id !== id)
    saveCourses(updated)
  }

  return (
    <div className="p-8 space-y-6 text-white bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold">ボルダリングコース管理</h1>
      <div className="p-4 bg-gray-800 rounded space-y-2">
        <h2 className="font-semibold">新規コース作成</h2>
        <input
          type="text"
          placeholder="コース名"
          value={name}
          onChange={e => setName(e.target.value)}
          className="px-2 py-1 text-black w-full rounded"
        />
        <input type="file" accept="image/*" onChange={e => setBgFile(e.target.files?.[0] || null)} />
        <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 rounded text-white mt-2">作成</button>
      </div>
      <div className="p-4 bg-gray-800 rounded">
        <h2 className="font-semibold mb-2">作成済コース</h2>
        {courses.length === 0 && <p>保存されたコースはありません</p>}
        <ul className="space-y-2">
          {courses.map(c => (
            <li key={c.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
              <span>{c.name}</span>
              <div className="space-x-2">
                <button onClick={() => handleOpen(c.id)} className="px-2 py-1 bg-green-600 rounded text-sm">開く</button>
                <button onClick={() => handleDelete(c.id)} className="px-2 py-1 bg-red-600 rounded text-sm">削除</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
