'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStudentStore } from '@/store/useStudentStore'
import { useStudents } from '@/hooks/useStudents'
import { useModalDismiss } from '@/lib/hooks/useModalDismiss'
import { REGIONS, ROLES } from '@/lib/constants'

export default function NewStudentModal() {
  const { newStudentOpen, setNewStudentOpen, activeTab } = useStudentStore()
  const { mutate } = useStudents()

  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [role, setRole] = useState('')
  const [region, setRegion] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setId('')
    setName('')
    setGender('')
    setRole('')
    setRegion('')
    setPhone('')
    setError(null)
  }

  const handleClose = () => {
    reset()
    setNewStudentOpen(false)
  }

  const modalRef = useModalDismiss<HTMLDivElement>(handleClose, newStudentOpen)

  if (!newStudentOpen) return null

  const handleSave = async () => {
    if (!id || !name) {
      setError('編號和姓名為必填')
      return
    }
    const numId = Number(id)
    if (!Number.isInteger(numId) || numId <= 0) {
      setError('編號必須為正整數')
      return
    }

    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: dbErr } = await supabase.from('students').insert({
      id: numId,
      name: name.trim(),
      sheet_system: '星光', // 既有欄位、非有效體系；維持 NOT NULL
      // 體系由 business_chain 決定：太陽 → '太陽'，星光體系維持 null（非太陽即星光）
      business_chain: activeTab === '太陽' ? '太陽' : null,
      gender: gender || null,
      role: role || null,
      region: region || null,
      phone: phone.trim() || null,
    })
    setSaving(false)

    if (dbErr) {
      setError(dbErr.message.includes('duplicate') ? '此編號已存在' : dbErr.message)
      return
    }

    await mutate()
    handleClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-student-title"
        className="bg-white rounded-lg shadow-xl w-80 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-student-title" className="text-sm font-semibold text-slate-800 mb-4">新增學員</h2>

        <div className="flex flex-col gap-3">
          <label htmlFor="new-student-id" className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">編號 <span className="text-red-500">*</span></span>
            <input
              id="new-student-id"
              type="number"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="例：568"
              className="border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <label htmlFor="new-student-name" className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">姓名 <span className="text-red-500">*</span></span>
            <input
              id="new-student-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：王小明"
              className="border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <div className="flex gap-2">
            <label htmlFor="new-student-gender" className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-slate-500">性別</span>
              <select
                id="new-student-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">—</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </label>

            <label htmlFor="new-student-region" className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-slate-500">地區</span>
              <select
                id="new-student-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>

          <label htmlFor="new-student-role" className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">角色</span>
            <select
              id="new-student-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">—</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label htmlFor="new-student-phone" className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">手機</span>
            <input
              id="new-student-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="例：0912345678"
              className="border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <div className="text-xs text-slate-400">
            體系：<span className="font-medium text-slate-600">{activeTab}</span>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '儲存中…' : '新增'}
          </button>
        </div>
      </div>
    </div>
  )
}
