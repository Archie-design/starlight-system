## Why

心之使者（388 位、62 組）的資料散在學員表（`spirit_ambassador_join_date` / `spirit_ambassador_group` / `cumulative_seniority` / `love_giving_start_date`），目前沒有專屬彙總視圖。營運想一眼看到各組規模、年資結構、哪些組資深/資淺，並發現待修資料。

## What Changes

- 新增「心之使者專區」頁面（`/spirit`），與儀表板 / 資料維護 / 關懷長專區並列於導覽。
- 心之使者 = `spirit_ambassador_join_date` 非空（共 388 位）。
- 呈現：
  - **KPI 摘要卡**：心之使者總數、組別數、平均年資、無組別人數
  - **各組人數長條圖**（62 組）
  - **年資分佈長條圖**（依累積年資分桶 <1年 / 1-2 / 2-3 / 3-5 / 5年+）
  - **各組平均年資長條圖**
  - **資料品質提醒**：自動列出待處理項（有加入日無組別 / 無累積年資 / 單人小組）
- 累積年資為中文文字「X 年 Y 個月」，新增解析工具轉成月數供統計。
- 體系隔離：依登入者有效體系（admin 鎖定、superadmin 可切換）。

## Capabilities

### New Capabilities
- `spirit-ambassador-hub`: 心之使者專屬彙總專區 —— KPI、各組人數/平均年資、年資分佈長條圖、資料品質提醒，依登入體系隔離。

### Modified Capabilities
<!-- 無 -->

## Impact

- **新檔案**：`app/spirit/page.tsx`、`app/spirit/SpiritClient.tsx`、`lib/utils/seniority.ts`、（視需要）`components/SpiritLayout/`、`lib/hooks/useSpiritStats.ts`。
- **修改**：`app/students/StudentsClient.tsx`、`components/MaintenanceLayout/index.tsx`、`components/CounselorsLayout/index.tsx`、`app/dashboard/DashboardClient.tsx`（各加「心之使者」導覽連結）。
- **重用**：`lib/utils/system.ts`（applySystemFilter/systemOf）、`lib/auth.ts`（checkAuth/getEffectiveSystem）、`components/SystemSwitcher.tsx`、dashboard 的 Card/CardHeader + recharts BarChart 寫法、`app/dashboard/page.tsx` 的分頁全量撈取模式。
- 無 DB schema 變更（全用既有欄位）。
