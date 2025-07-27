'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CanvasPoseData } from '@/components/Canvas3D'

// 画像をリサイズしてデータURLを返すユーティリティ
const resizeImage = (file: File, maxW = 1024, maxH = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas error'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = err => reject(err)
    const reader = new FileReader()
    reader.onload = e => {
      img.src = e.target?.result as string
    }
    reader.onerror = err => reject(err)
    reader.readAsDataURL(file)
  })
}

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
    try {
      localStorage.setItem('climbing-courses', JSON.stringify(list))
    } catch (e) {
      console.error(e)
      alert('データ保存に失敗しました。画像が大きすぎる可能性があります。')
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return alert('コース名を入力してください')
    let bg = ''
    if (bgFile) {
      try {
        bg = await resizeImage(bgFile)
      } catch (e) {
        console.error(e)
        alert('画像の読み込みに失敗しました')
      }
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
      <div className="p-4 bg-gray-800 rounded space-y-3">
        <h2 className="font-semibold">新規コース作成</h2>
        <input
          type="text"
          placeholder="コース名"
          value={name}
          onChange={e => setName(e.target.value)}
          className="px-2 py-1 text-black bg-white w-full rounded"
        />
        <div className="flex items-center space-x-2">
          <label className="px-3 py-1 bg-gray-700 text-white rounded cursor-pointer">
            コース画像を選択
            <input
              type="file"
              accept="image/*"
              onChange={e => setBgFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          <span className="text-sm text-gray-300">
            {bgFile?.name || 'wall.jpg(サンプル)'}
          </span>
        </div>
        <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 rounded text-white mt-2">作成</button>
      </div>
      <div className="p-4 bg-gray-800 rounded">
        <h2 className="font-semibold mb-2">既存コース</h2>
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
