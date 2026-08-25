/**
 * 密碼強度規則（單一事實來源）。
 *
 * 原本只有 `account/password`（使用者自行改密碼）有長度檢查，`users` POST
 * （管理者建帳號）、`users/[id]` PATCH（管理者重設密碼）完全沒有檢查，
 * 三處各自決定密碼強弱不一致（P2 #24）。統一抽出這裡，三處都套用同一規則。
 *
 * 規則刻意保持寬鬆（僅長度）：這個系統的自助登入本來就是「學員 ID + 手機
 * 末四碼」這種低熵密碼（見 P1 #13 的速率限制修復），要求強密碼複雜度對
 * 這個使用情境效益有限，但長度下限至少能擋掉太短的密碼被暴力破解。
 */
const MIN_LENGTH = 8

/** 回傳 null 代表通過；否則回傳給使用者看的錯誤訊息 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `密碼至少 ${MIN_LENGTH} 個字元`
  }
  return null
}

/**
 * bcrypt cost factor（P3 #32）。原本四個 `hash(password, 10)` 呼叫點各自寫死，
 * 統一抽到這裡方便日後一次調整。實測 cost=10 單次 hash/compare 約 50ms、
 * cost=12 約 200ms；目前使用者人數少、非高流量系統，維持 10（bcrypt 慣例
 * 預設值），未提升——如未來需要更高抗暴力破解強度可再評估。
 */
export const PASSWORD_HASH_COST = 10
