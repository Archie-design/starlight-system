'use client'

import { SWRConfig } from 'swr'
import StudentGrid from '@/components/StudentGrid'
import FilterBar from '@/components/StudentGrid/FilterBar'
import Toolbar from '@/components/StudentGrid/Toolbar'
import OrgChart from '@/components/OrgChart'
import dynamic from 'next/dynamic'
import ImportWizard from '@/components/ImportWizard'
import NewStudentModal from '@/components/NewStudentModal'
import NavButton from '@/components/NavButton'
import LogoutButton from '@/components/LogoutButton'
import { useSearchParams, usePathname } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { useStudentStore } from '@/store/useStudentStore'
import { APP_NAME } from '@/lib/config'

// 關聯圖含 @xyflow/react，僅切到該檢視才載入，避免拖累初次載入
const RelationshipNetwork = dynamic(() => import('@/components/RelationshipNetwork'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-slate-400 text-sm">載入關聯圖…</div>,
})
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

function SearchParamHandler() {
  const searchParams = useSearchParams()
  const { setFilter } = useStudentStore()

  useEffect(() => {
    const search = searchParams.get('search')
    if (search) {
      setFilter('name', search)
    }
  }, [searchParams, setFilter])

  return null
}

function StudentsLayout() {
  const { view, role, displayName, username } = useStudentStore()
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-dvh bg-white">
      {/* 頂部標題列 */}
      <header className="flex flex-wrap items-center justify-between gap-y-1 px-4 py-2.5 bg-blue-800 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-yellow-300 text-lg leading-none">★</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">{APP_NAME}</h1>
        </div>
        <div className="flex items-center gap-3">
          <NavButton href="/dashboard" active={pathname === '/dashboard'} className="text-xs text-blue-200/70 hover:text-white transition-colors">儀表板 →</NavButton>
          <NavButton href="/maintenance" active={pathname === '/maintenance'} className="text-xs text-blue-200/70 hover:text-white transition-colors">資料維護 →</NavButton>
          <NavButton href="/counselors" active={pathname === '/counselors'} className="text-xs text-blue-200/70 hover:text-white transition-colors">關懷長專區 →</NavButton>
          <NavButton href="/spirit" active={pathname === '/spirit'} className="text-xs text-blue-200/70 hover:text-white transition-colors">心之使者 →</NavButton>
          <NavButton href="/history" active={pathname === '/history'} className="text-xs text-blue-200/70 hover:text-white transition-colors">匯入紀錄 →</NavButton>
          {role !== 'admin' && (
            <NavButton href="/admin/users" active={pathname === '/admin/users'} className="text-xs text-amber-200/90 hover:text-white transition-colors">帳號管理 →</NavButton>
          )}
          {(displayName || username) && (
            <span className="text-xs text-blue-100/80">👤 {displayName || username}</span>
          )}
          <LogoutButton />
        </div>
      </header>

      {/* 工具列 */}
      <Toolbar />

      {view === 'grid' ? (
        <>
          {/* 篩選列 */}
          <div className="px-4 pt-2">
            <Suspense fallback={<div className="h-9 bg-slate-100 border border-slate-300 rounded-lg" />}>
              <FilterBar />
            </Suspense>
          </div>
          {/* 主表格 */}
          <div className="flex-1 min-h-0 px-4 py-2">
            <StudentGrid />
          </div>
        </>
      ) : view === 'org' ? (
        <div className="flex-1 min-h-0">
          <OrgChart />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <RelationshipNetwork />
        </div>
      )}

      {/* 匯入 Modal */}
      <ImportWizard />

      {/* 新增學員 Modal */}
      <NewStudentModal />

      {/* URL 參數處理器 */}
      <Suspense fallback={null}>
        <SearchParamHandler />
      </Suspense>
    </div>
  )
}

export default function StudentsClient({ role, system, username, displayName }: { role: UserRole; system: SheetSystem; username: string; displayName: string | null }) {
  const setRole = useStudentStore((s) => s.setRole)
  const setActiveTab = useStudentStore((s) => s.setActiveTab)
  const setUsername = useStudentStore((s) => s.setUsername)
  const setDisplayName = useStudentStore((s) => s.setDisplayName)

  // 掛載即以登入者身分覆寫 store，避免閃現他體系
  useEffect(() => {
    setRole(role)
    setActiveTab(system)
    setUsername(username)
    setDisplayName(displayName)
  }, [role, system, username, displayName, setRole, setActiveTab, setUsername, setDisplayName])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <StudentsLayout />
    </SWRConfig>
  )
}
