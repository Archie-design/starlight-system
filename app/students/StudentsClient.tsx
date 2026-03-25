'use client'

import { SWRConfig } from 'swr'
import StudentGrid from '@/components/StudentGrid'
import FilterBar from '@/components/StudentGrid/FilterBar'
import Toolbar from '@/components/StudentGrid/Toolbar'
import OrgChart from '@/components/OrgChart'
import ImportWizard from '@/components/ImportWizard'
import NewStudentModal from '@/components/NewStudentModal'
import Link from 'next/link'
import { Suspense } from 'react'
import { useStudentStore } from '@/store/useStudentStore'

function StudentsLayout() {
  const { view } = useStudentStore()

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 頂部標題列 */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-blue-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-yellow-300 text-lg leading-none">★</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">星光超級表格系統</h1>
        </div>
        <Link href="/history" className="text-xs text-blue-200/70 hover:text-white transition-colors hidden sm:block">
          匯入紀錄 →
        </Link>
      </header>

      {/* 工具列 */}
      <Toolbar />

      {view === 'grid' ? (
        <>
          {/* 篩選列 */}
          <Suspense fallback={<div className="h-8 bg-slate-100 border-b border-slate-300" />}>
            <FilterBar />
          </Suspense>
          {/* 主表格 */}
          <div className="flex-1 min-h-0">
            <StudentGrid />
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0">
          <OrgChart />
        </div>
      )}

      {/* 匯入 Modal */}
      <ImportWizard />

      {/* 新增學員 Modal */}
      <NewStudentModal />
    </div>
  )
}

export default function StudentsClient() {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <StudentsLayout />
    </SWRConfig>
  )
}
