## Context

受保護專區的標準骨架：`app/<area>/page.tsx`（server：checkAuth → getEffectiveSystem → 傳 role/system）+ `*Client.tsx`（設 store）+ Layout。儀表板（`app/dashboard/page.tsx`）示範了「server 端分頁撈本體系全量學員（applySystemFilter）→ reduce 統計 → 傳 client → recharts BarChart」的完整模式，可直接借鏡。

心之使者資料探索確認：388 位（星光 293/太陽 95）、62 組、`cumulative_seniority` 100% 為「X 年 Y 個月」可解析。`spirit_ambassador_group` 組名與 business_chain 無強制對應（純命名），但體系隔離靠 `business_chain`（applySystemFilter）仍正確。

## Goals / Non-Goals

**Goals:**
- 一個彙總專區：KPI + 各組人數 + 年資分佈 + 各組平均年資 + 資料品質提醒
- 累積年資解析集中、可重用
- 體系隔離；superadmin 可切換
- 最大化重用既有骨架與圖表寫法

**Non-Goals:**
- 不做心之使者個別資料的可編輯表格（編輯仍在 /students）
- 不做經營決策建議（本次只做「資料品質提醒」）
- 不改 DB schema

## Decisions

### D1. server 端算統計（比照 dashboard）
`app/spirit/page.tsx` 用 `createServiceClient` + `applySystemFilter` 分頁撈本體系全量學員（select 心之使者欄位 + business_chain），過濾出 `spirit_ambassador_join_date` 非空者，server 端 reduce 出所有統計後傳給 client。
- 為什麼 server 算：資料量小、避免把全量送 client 再算；與 dashboard 一致。
- 修正 boolean 慣例：`const { valid, user } = await checkAuth()`。

### D2. 年資解析工具 `lib/utils/seniority.ts`
```
parseSeniorityMonths(text): number | null   // 「X 年 Y 個月」→ Y+12X；不符回 null
seniorityBucket(months): '<1年'|'1-2年'|'2-3年'|'3-5年'|'5年+'
```
集中、純函式、可測。年資相關統計一律經此解析。

### D3. 統計結構（傳給 client 的 props）
```
kpi: { total, groupCount, avgMonths, noGroupCount }
groupCounts: { name, count }[]            // 各組人數，降序
seniorityDist: { bucket, count }[]        // 5 桶固定順序
groupAvgSeniority: { name, avgMonths }[]  // 各組平均年資（僅計有年資者）
alerts: { noGroup: Student[], noSeniority: Student[], singletonGroups: {name,member}[] }
```
client 只負責渲染。

### D4. UI 重用 dashboard 元件
- Card / CardHeader：抽出或複製 dashboard 既有寫法（dashboard 內是區域函式，考慮抽到共用元件 `components/ui/Card.tsx` 供兩處用；若不抽則在本專區複製簡版）。
- recharts：各組人數/平均年資用橫向 BarChart（layout="vertical"，組多→容器可捲動或限高），年資分佈用縱向 BarChart。
- 資料品質提醒：卡片列各類項目；可連 `/students?search=<name>` 方便跳去處理。
- 頂部導覽 + SystemSwitcher（superadmin）比照其他專區。

### D5. 路由命名
採 `/spirit`（簡短）。導覽標籤「心之使者」。

## Risks / Trade-offs

- [62 組橫條圖過長] → 容器限高 + 捲動，或預設只顯示前 N 組 + 「其餘」彙總。實作時依視覺手感調。
- [Card/CardHeader 目前是 dashboard 內的區域函式] → 抽成共用元件較乾淨但動到 dashboard；折衷：本次先在專區內複製精簡版，避免擴大改動面（未來可重構）。
- [組名與體系無對應] → 體系隔離只靠 business_chain（applySystemFilter），組名前綴「星光/太陽」純顯示，不參與判定。

## Open Questions

- 「單人小組」是否一定是資料問題？可能該組真的只有 1 人。→ 列為「提醒」而非「錯誤」，由人判斷。
- 各組平均年資要不要同時顯示人數（避免 1 人組的平均誤導）？實作時在 tooltip 附人數。
