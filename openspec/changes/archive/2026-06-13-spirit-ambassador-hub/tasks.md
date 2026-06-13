## 1. 年資解析工具

- [x] 1.1 新增 `lib/utils/seniority.ts`：`parseSeniorityMonths(text)`（正則「X 年 Y 個月」→ 月數，不符回 null）
- [x] 1.2 `seniorityBucket(months)`：分桶 <1年/1-2年/2-3年/3-5年/5年+

## 2. Server 頁面與統計

- [x] 2.1 `app/spirit/page.tsx`：`const { valid, user } = await checkAuth()`；未登入→/login；must_change_password→改密碼頁；`getEffectiveSystem`
- [x] 2.2 分頁撈本體系全量學員（applySystemFilter，比照 dashboard），select 心之使者欄位 + business_chain
- [x] 2.3 過濾心之使者（join_date 非空）；reduce 出 kpi / groupCounts / seniorityDist / groupAvgSeniority / alerts
- [x] 2.4 傳 role + system + 統計給 `SpiritClient`

## 3. Client 與 UI

- [x] 3.1 `app/spirit/SpiritClient.tsx`：接 props，渲染版面（含頂部導覽 + SystemSwitcher for superadmin）
- [x] 3.2 KPI 摘要卡（總數/組別數/平均年資/無組別人數）
- [x] 3.3 各組人數橫向 BarChart（降序；組多時限高捲動或前 N + 其餘）
- [x] 3.4 年資分佈縱向 BarChart（5 桶）
- [x] 3.5 各組平均年資橫向 BarChart（tooltip 附人數）
- [x] 3.6 資料品質提醒卡：無組別 / 無年資 / 單人小組（可連 /students?search=）
- [x] 3.7 Card/CardHeader：本專區複製精簡版（避免動 dashboard）

## 4. 導覽互連

- [x] 4.1 `app/students/StudentsClient.tsx` 頂部導覽加「心之使者 →」
- [x] 4.2 `components/MaintenanceLayout/index.tsx` 加連結
- [x] 4.3 `components/CounselorsLayout/index.tsx` 加連結
- [x] 4.4 `app/dashboard/DashboardClient.tsx` 加連結
- [x] 4.5 心之使者專區反向連回其他專區

## 5. 驗證

- [x] 5.1 `npx tsc --noEmit` + `npm run build` 通過
- [x] 5.2 各專區導覽出現「心之使者 →」，可進入 /spirit
- [x] 5.3 KPI：星光登入心之使者數≈293、太陽≈95；組別數、平均年資合理
- [x] 5.4 各組人數圖：容容組 16 等與抽樣一致
- [x] 5.5 年資分佈（合計）：<1年159/1-2年114/2-3年68/3-5年45/5年+2（依體系會變）
- [x] 5.6 資料品質提醒列出無組別/無年資/單人小組
- [x] 5.7 superadmin 切體系數字隨之變；太陽 admin 只見太陽心之使者
- [x] 5.8 `parseSeniorityMonths('1 年 6 個月')` === 18
