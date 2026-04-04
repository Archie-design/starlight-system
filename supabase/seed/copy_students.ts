/**
 * 學員資料遷移腳本
 * 從舊 Supabase 專案複製 students 資料到新 Supabase 專案
 *
 * 使用方式:
 *   OLD_URL=https://xxx.supabase.co OLD_KEY=service_role_key_old \
 *   NEW_URL=https://yyy.supabase.co NEW_KEY=service_role_key_new \
 *   npx tsx supabase/seed/copy_students.ts
 */

import { createClient } from '@supabase/supabase-js'

const OLD_URL = process.env.OLD_URL!
const OLD_KEY = process.env.OLD_KEY!
const NEW_URL = process.env.NEW_URL!
const NEW_KEY = process.env.NEW_KEY!

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error('缺少環境變數: OLD_URL, OLD_KEY, NEW_URL, NEW_KEY')
  process.exit(1)
}

const oldClient = createClient(OLD_URL, OLD_KEY)
const newClient = createClient(NEW_URL, NEW_KEY)

const BATCH_SIZE = 100

async function main() {
  // 取得總筆數
  const { count, error: countError } = await oldClient
    .from('students')
    .select('*', { count: 'exact', head: true })

  if (countError) throw countError
  console.log(`共 ${count} 筆學員資料，開始遷移...`)

  let offset = 0
  let total = 0

  while (offset < (count ?? 0)) {
    const { data, error } = await oldClient
      .from('students')
      .select('id, name, gender, role, sheet_system, phone, line_id, introducer, relation, business_chain, counselor, little_angel, dream_interpreter, senior_counselor, region, guidance_chain, membership_expiry, course_1, payment_1, parent_1, course_2, payment_2, course_3, payment_3, course_4, payment_4, course_5, payment_5, course_wuyun, payment_wuyun, wuyun_a, wuyun_b, wuyun_c, wuyun_d, wuyun_f, life_numbers, life_numbers_advanced, life_transform, debt_release, created_at, updated_at, last_synced_at, system_id, group_leader, spirit_ambassador_join_date, love_giving_start_date, spirit_ambassador_group, cumulative_seniority, birthday')
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    const { error: insertError } = await newClient
      .from('students')
      .upsert(data, { onConflict: 'id' })

    if (insertError) throw insertError

    total += data.length
    offset += BATCH_SIZE
    console.log(`已遷移 ${total} / ${count} 筆`)
  }

  console.log(`✅ 完成！共遷移 ${total} 筆學員資料`)
}

main().catch((err) => {
  console.error('❌ 遷移失敗:', err)
  process.exit(1)
})
