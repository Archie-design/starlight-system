# 09 — 儀表板功能建議

> 路由規劃：`/dashboard`，Server Component 跑 parallel queries，結果傳給 Client Component 渲染。  
> 圖表推薦：**Recharts**（輕量、React 友好）。  
> 資料來源：Supabase 現成資料，全部可用 aggregate query 直接取，不需額外建表。

---

## 🔴 高價值（資料現成，直接做）

### 1. 課程進度漏斗

```
一階 → 二階 → 三階 → 四階 → 五階
XXX人  XX人   XX人   XX人   XX人
```

- 每階的學員人數 + 相鄰層級的轉換率
- 一眼看出在哪個階段流失最多
- 資料來源：`course_1 ~ course_5` 欄位（非 null 即算有上）

### 2. 付款狀態分佈

- 各階「已付款 / 未付款 / 有餘額」的比例圓餅圖（或 stacked bar）
- 加總欠款餘額（revenue overview）
- 資料來源：`payment_1 ~ payment_5`、`payment_wuyun`

### 3. 會籍到期預警

- 按月列出 `membership_expiry` 快到期的學員清單
- 分群：0–30 天、31–90 天、已過期
- 資料來源：`membership_expiry`（ISO date string）

### 4. 各組群學員統計

- 8 個輔導長組 → 學員數量 bar chart
- 可搭配「各組課程進度平均」比較組間差異
- 資料來源：`group_leader` 欄位

---

## 🟡 中價值（需稍微計算）

### 5. 心之使者成長趨勢

- 用 `spirit_ambassador_join_date` 畫出每月新加入人數折線圖
- `cumulative_seniority` 分佈直方圖（資深程度分析）
- 資料來源：`spirit_ambassador_join_date`、`cumulative_seniority`

### 6. 匯入歷史摘要

- 每次 import 的 `rows_updated / rows_inserted / rows_unchanged` 趨勢圖
- 可觀察資料更新頻率與規律
- 資料來源：`import_sessions` 表

### 7. 區域分佈統計

- 用 `region` 欄位做群組統計
- 哪個區域學員最多、各區課程進度怎樣
- 資料來源：`region` 欄位

### 8. 最近編輯紀錄

- 今天誰的資料被改了哪些欄位（audit log）
- 適合管理員做資料異動追蹤
- 資料來源：`edit_logs` 表

---

## 🟢 錦上添花

### 9. 五運班出席率

- `wuyun_a ~ wuyun_f` 各班次的出席人數統計
- 可找出哪個梯次出勤率偏低
- 資料來源：`wuyun_a`、`wuyun_b`、`wuyun_c`、`wuyun_d`、`wuyun_f`

### 10. 新學員趨勢

- 用 `created_at` 畫每月新增學員數折線圖
- 搭配介紹人分析（誰帶來最多新人）
- 資料來源：`created_at`、`introducer`

---

## MVP 建議

最快可以交付的三個功能，資料最直接、對管理最有幫助：

1. **課程進度漏斗** — 最直觀的核心 KPI
2. **各組人數統計** — 管理者最常問的問題
3. **會籍到期預警** — 有明確的行動意義（提醒續會）

---

## 實作備忘

- Server Component 用 `Promise.all()` 平行跑多個 Supabase query
- 所有 query 用 `SUPABASE_SERVICE_ROLE_KEY`（service role，繞過 RLS）
- Recharts：`npm install recharts`
- 可複用 `/students` 的 auth 保護模式（`page.tsx` 查 session → redirect）
