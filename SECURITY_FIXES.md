# 第一階段安全修復 - 實施記錄

## 修復日期
2026-06-12

## 修復內容

### 1. RLS 策略升級
**文件**: `/supabase/migrations/009_rls_allow_anon.sql`

**變更**:
- ❌ 移除所有 `allow_all` 政策（允許anon角色無限制訪問）
- ✅ 新增分層RLS策略：
  - **anon 角色**: SELECT 唯讀（需通過 API 驗證層）
  - **service_role**: 完全存取（INSERT/UPDATE/DELETE）
  
**影響範圍**: 8 個資料表
- students
- import_sessions
- import_logs
- counselor_groups
- edit_logs
- parent_aliases
- student_overrides

**驗收標準**:
- [ ] RLS 政策已在 Supabase 控制台應用
- [ ] 測試 anon 角色無法直接寫入資料
- [ ] 測試 service_role 可完全存取

---

### 2. 認證機制改進
**文件**: `/lib/auth.ts`

**變更**:
- ✅ 添加會話過期機制（30 分鐘）
- ✅ 實現 CSRF 令牌驗證
- ✅ 用戶身份識別（email 追蹤）
- ✅ 重新設計 `checkAuth()` 函數簽名

**新功能**:

```typescript
// 舊簽名（已廢棄）
checkAuth(): Promise<boolean>

// 新簽名（向後相容）
checkAuth(request?: NextRequest): Promise<{ valid: boolean; email?: string | null }>
```

**會話過期**:
- 初始設置時間戳
- 每次請求驗證是否超過 30 分鐘
- 超期自動清除 cookie

**CSRF 保護**:
- 檢查 referer 或 X-CSRF-Token 頭
- 本地請求自動通過
- 同源請求自動通過

**驗收標準**:
- [ ] 登入後設置會話 cookie 及時間戳
- [ ] 30 分鐘後 cookie 失效
- [ ] CSRF 令牌在 POST 請求中驗證成功
- [ ] 跨域請求被拒絕

---

### 3. 登入端點升級
**文件**: `/app/api/login/route.ts`

**變更**:
- ✅ 設置會話時間戳 cookie（用於過期檢查）
- ✅ 生成並設置 CSRF 令牌
- ✅ 支持 email 作為用戶識別
- ✅ 縮短 maxAge 從 30 天 → 30 分鐘

**Cookie 設置**:
1. `sl_session` - 會話令牌（httpOnly）
2. `sl_session_ts` - 會話時間戳（httpOnly）
3. `sl_session_email` - 用戶 email（httpOnly）
4. `csrf_token` - CSRF 令牌（非 httpOnly，供 JS 讀取）

**驗收標準**:
- [ ] 登入成功設置所有 4 個 cookie
- [ ] 所有 httpOnly cookie 不可被 JavaScript 訪問
- [ ] CSRF 令牌 cookie 可被客戶端 JavaScript 讀取

---

### 4. 導入應用端點強化
**文件**: `/app/api/import/apply/route.ts`

**變更**:
- ✅ 使用新的 `checkAuth(request)` 簽名進行 CSRF 驗證
- ✅ 實現幂等性檢查（防止重複應用）
- ✅ 添加事務失敗恢復邏輯
- ✅ 只有全部成功才標記為已應用

**幂等性保證**:
```
如果 session.applied == true:
  返回 200 成功（不拒絕）
  允許客戶端安全重試
```

**失敗恢復**:
```
如果任何批次失敗:
  1. 收集錯誤計數
  2. 不標記為 applied
  3. 允許後續重試
  4. 返回 500 + 錯誤詳情
```

**驗收標準**:
- [ ] 首次應用成功時標記 applied = true
- [ ] 重複應用返回 200（不重新應用）
- [ ] 失敗時保持 applied = false，允許重試
- [ ] 返回值包含 applied/errors/success 欄位

---

## 安全改進摘要

| 漏洞 | 嚴重程度 | 修復方式 | 狀態 |
|------|--------|--------|------|
| RLS 完全禁用 | **P0** | 分層 RLS 策略 | ✅ |
| 單密碼認證 | **P0** | 會話過期 + CSRF | ✅ |
| 並發無控制 | **P1** | 幂等性 + 失敗恢復 | ✅ |
| 缺乏用戶識別 | **P2** | email 追蹤 | ✅ |

---

## 後續步驟

### 立即需要（開發環境）
1. 在 Supabase 控制台應用新的 RLS 政策
2. 測試 anon 角色的 SELECT 訪問
3. 測試 service_role 的寫入訪問

### 測試清單
- [ ] 登入流程測試
- [ ] 會話過期測試（等待 30+ 分鐘）
- [ ] CSRF 令牌驗證測試
- [ ] 導入應用幂等性測試
- [ ] 錯誤恢復測試

### 第二階段準備
- 在提交第二階段（架構重構）之前，確認這些安全修復已驗證

---

## 相關文件
- RLS 政策文檔: https://supabase.com/docs/guides/auth/row-level-security
- CSRF 保護: https://owasp.org/www-community/attacks/csrf
- 會話管理: https://owasp.org/www-community/controls/Session_Management

---

## 提交信息
```
feat: 第一階段安全修復 - RLS、認證、事務控制

- 將 RLS 從 allow_all 升級為分層策略（anon 唯讀，service_role 完全）
- 實現會話過期機制（30 分鐘）
- 添加 CSRF 令牌驗證
- 實現用戶身份識別（email 追蹤）
- 強化導入應用的幂等性和失敗恢復

安全改進:
- P0: RLS 禁用 → 分層策略
- P0: 單密碼認證 → 會話 + CSRF
- P1: 並發無控制 → 幂等性保證
- P2: 缺乏審計 → email 追蹤

Co-Authored-By: 安全審查 <security@starlight.local>
```
