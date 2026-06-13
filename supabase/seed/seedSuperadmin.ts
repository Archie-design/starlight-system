/**
 * 建立 / 重設初始系統管理者（superadmin）帳號。
 *
 * 複製此系統給新組織時，用這支腳本建立第一個 superadmin —— 帳號與初始密碼
 * 由環境變數提供，不寫死在 migration 裡。
 *
 * 使用方式：
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *   SUPERADMIN_USERNAME=admin@example.com SUPERADMIN_PASSWORD='初始密碼' \
 *   npx tsx supabase/seed/seedSuperadmin.ts
 *
 * 行為：
 *   - 帳號不存在 → 建立（must_change_password=true，首次登入強制改密碼）
 *   - 帳號已存在 → 重設其密碼並設 must_change_password=true
 */
import { createClient } from '@supabase/supabase-js'
import { hash } from 'bcryptjs'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const USERNAME = process.env.SUPERADMIN_USERNAME || ''
const PASSWORD = process.env.SUPERADMIN_PASSWORD || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('請設定環境變數 SUPABASE_URL 和 SUPABASE_SERVICE_KEY')
  process.exit(1)
}
if (!USERNAME || !PASSWORD) {
  console.error('請設定環境變數 SUPERADMIN_USERNAME 和 SUPERADMIN_PASSWORD')
  process.exit(1)
}
if (PASSWORD.length < 8) {
  console.error('SUPERADMIN_PASSWORD 至少需 8 個字元')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  const password_hash = await hash(PASSWORD, 10)

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', USERNAME)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('users')
      .update({ password_hash, must_change_password: true, active: true, updated_at: new Date().toISOString() })
      .eq('username', USERNAME)
    if (error) { console.error('重設失敗:', error.message); process.exit(1) }
    console.log(`✓ 已重設既有 superadmin「${USERNAME}」的密碼（首次登入須改密碼）`)
  } else {
    const { error } = await supabase
      .from('users')
      .insert({ username: USERNAME, password_hash, role: 'superadmin', system: null, active: true, must_change_password: true })
    if (error) { console.error('建立失敗:', error.message); process.exit(1) }
    console.log(`✓ 已建立 superadmin「${USERNAME}」（首次登入須改密碼）`)
  }
}

main()
