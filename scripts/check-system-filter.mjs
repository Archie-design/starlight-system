#!/usr/bin/env node
// ============================================================
// 體系隔離靜態檢查（對應 code review P2 #23）
//
// 背景：students 表的體系隔離完全依賴應用層（每個查詢自己呼叫
// applySystemFilter()），RLS 對 service_role 沒有任何體系範圍限制
// （service_role 本來就是設計成繞過 RLS，這是 Supabase 的既有機制，
// 無法在 RLS 層面收斂）。這個腳本是最後一道防線：掃描所有查詢
// `students` 表的 API route，找出「看起來查了 students 卻沒有明顯
// 體系隔離跡象」的可疑檔案，跑不出違規就直接失敗（exit code 1）。
//
// 這是啟發式（heuristic）靜態掃描，不是型別系統或 AST 級別的保證——
// 只做字串層級比對，會有假陰性（掃不到繞了一手的寫法）也可能有假陽性
// （用到白名單機制之外的合法隔離方式）。用途是攔住最常見的疏漏模式
// （新增 route 時忘記處理體系），不是完整的正確性證明。
//
// 使用方式：node scripts/check-system-filter.mjs
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const API_DIR = join(ROOT, 'app', 'api')

/**
 * 白名單：檔案本身合法查詢 students 但不需要（或用了 applySystemFilter
 * 以外的方式做）體系隔離，附上理由供之後複查。新增例外時務必寫清楚原因，
 * 避免白名單淪為橡皮圖章。
 */
const ALLOWLIST = {
  'app/api/login/route.ts':
    '用 .eq(\'id\', studentId) 精確查單一學員做自助登入驗證，非列表查詢，無跨體系枚舉風險',
  'app/api/import/route.ts':
    '寫入路徑（解析上傳檔案），已用 systemOf(r.business_chain) 逐筆檢查匯入資料是否跨體系（見 P0 #2 修復），非讀取查詢',
  'app/api/import/apply/route.ts':
    '寫入路徑，已用 systemOf(r.business_chain) 逐筆檢查（見 P0 #2 修復），且用 .in(\'id\', ids) 精確查找既有學員做 diff，非列表查詢',
  'app/api/edit-logs/route.ts':
    '無 business_chain 可直接查詢，改用「依 student_id 反查 students.business_chain」的模式做體系過濾（見 P2 #22 修復），非 applySystemFilter',
  'app/api/history/[id]/route.ts':
    '同上，依 student_id 反查體系（見 P2 #22 修復）',
  'app/api/counselor-groups/[id]/route.ts':
    '透過 root_student_ids 反查 resolveGroupSystem()，非直接 applySystemFilter（見 P0 #3 修復）',
  'app/api/counselor-groups/route.ts':
    'POST 用 studentIdsAllInSystem() 驗證 root_student_ids 全屬同一體系（見 P0 #3 修復），GET 無跨體系疑慮（僅讀 counselor_groups 中介表本身，非直接列出 students）',
  'app/api/counselor-groups/backfill/route.ts':
    '用 systemOf(s.business_chain) 逐筆過濾 scopedAssignments（見 P0 #4 修復），非 applySystemFilter',
  'app/api/student-overrides/route.ts':
    'POST 用 studentIdsAllInSystem() 驗證（見 P0 #5 修復），GET 讀 student_overrides 中介表本身',
}

function listRouteFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...listRouteFiles(full))
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      results.push(full)
    }
  }
  return results
}

function checkFile(filePath) {
  const relPath = relative(ROOT, filePath).replace(/\\/g, '/')
  const content = readFileSync(filePath, 'utf-8')

  const queriesStudents = /from\(['"]students['"]\)/.test(content)
  if (!queriesStudents) return null

  const hasSystemFilter = content.includes('applySystemFilter')
  if (hasSystemFilter) return null

  if (relPath in ALLOWLIST) return null

  return {
    file: relPath,
    reason: '查詢 students 表，但未見 applySystemFilter() 呼叫，也不在白名單中——請確認是否需要體系隔離，若確認不需要請加入 ALLOWLIST 並註明原因',
  }
}

const routeFiles = listRouteFiles(API_DIR)
const suspects = routeFiles.map(checkFile).filter(Boolean)

// 順便檢查白名單裡是否有已經不存在的檔案（避免白名單隨時間腐化）
const existingRelPaths = new Set(routeFiles.map((f) => relative(ROOT, f).replace(/\\/g, '/')))
const staleAllowlistEntries = Object.keys(ALLOWLIST).filter((p) => !existingRelPaths.has(p))

if (suspects.length > 0) {
  console.error('❌ 發現可疑的 students 查詢（未見體系隔離，也未在白名單中）：\n')
  for (const s of suspects) {
    console.error(`  ${s.file}\n    → ${s.reason}\n`)
  }
}

if (staleAllowlistEntries.length > 0) {
  console.warn('⚠️  白名單中有已不存在的檔案路徑，請清理：')
  for (const p of staleAllowlistEntries) console.warn(`  ${p}`)
}

if (suspects.length > 0) {
  process.exit(1)
}

console.log(`✅ 體系隔離靜態檢查通過（掃描 ${routeFiles.length} 個 route 檔案，白名單 ${Object.keys(ALLOWLIST).length} 項）`)
