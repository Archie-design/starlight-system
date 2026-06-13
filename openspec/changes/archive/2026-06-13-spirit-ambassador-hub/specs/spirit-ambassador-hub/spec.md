## ADDED Requirements

### Requirement: 心之使者專區頁面

系統 SHALL 提供「心之使者專區」頁面（`/spirit`），與儀表板 / 資料維護 / 關懷長專區並列於各頁頂部導覽，且為受保護頁（未登入導向 /login、`must_change_password` 導向改密碼頁）。

#### Scenario: 進入心之使者專區
- **WHEN** 已登入使用者點選導覽「心之使者」
- **THEN** 開啟 `/spirit`，顯示心之使者的彙總統計

#### Scenario: 導覽互連
- **WHEN** 在 students / dashboard / maintenance / counselors 任一頁
- **THEN** 頂部導覽含可前往「心之使者」專區的連結

### Requirement: 心之使者判定與 KPI

心之使者定義為 `spirit_ambassador_join_date` 非空者。專區 SHALL 顯示 KPI 摘要：心之使者總數、組別數、平均累積年資、無組別人數。

#### Scenario: KPI 數字
- **WHEN** 開啟心之使者專區
- **THEN** 顯示該體系心之使者總數、不重複組別數、平均年資（由累積年資換算）、有加入日但無組別的人數

### Requirement: 累積年資解析

系統 SHALL 將累積年資文字「X 年 Y 個月」解析為總月數以供統計。無法解析者不計入年資相關統計。

#### Scenario: 解析年資
- **WHEN** 累積年資為「1 年 6 個月」
- **THEN** 解析為 18 個月

#### Scenario: 無年資資料
- **WHEN** 累積年資為空或格式不符
- **THEN** 不計入平均年資與年資分佈，並可被資料品質提醒列出

### Requirement: 統計長條圖

專區 SHALL 以長條圖呈現：各組人數、年資分佈（分桶 <1年 / 1-2年 / 2-3年 / 3-5年 / 5年+）、各組平均年資。

#### Scenario: 各組人數圖
- **WHEN** 開啟專區
- **THEN** 顯示各心之使者組別的人數長條（依人數排序）

#### Scenario: 年資分佈圖
- **WHEN** 開啟專區
- **THEN** 顯示各年資桶的人數長條

#### Scenario: 各組平均年資圖
- **WHEN** 開啟專區
- **THEN** 顯示各組的平均年資長條

### Requirement: 資料品質提醒

專區 SHALL 自動列出心之使者資料的待處理項，至少包含：有加入日但無組別、無累積年資、單人小組（組內僅 1 人）。

#### Scenario: 列出待修項
- **WHEN** 有心之使者缺組別或缺年資、或某組僅 1 人
- **THEN** 專區的資料品質區塊列出各類項目與其數量/對象

### Requirement: 體系隔離

專區的心之使者與所有統計 SHALL 僅限登入者有效體系（admin 為其體系、superadmin 為其當前選擇），MUST NOT 跨體系計入。

#### Scenario: 太陽 admin 的專區
- **WHEN** 太陽 admin 開啟心之使者專區
- **THEN** 僅統計 `business_chain='太陽'` 的心之使者

#### Scenario: superadmin 切換體系
- **WHEN** superadmin 切換星光/太陽
- **THEN** KPI 與所有圖表隨該體系重新計算
