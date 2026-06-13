## ADDED Requirements

### Requirement: 課程進度篩選

學員表格 SHALL 提供「課程進度」篩選，依學員最高完成階別（未上課 / 一階 / 二階 / 三階 / 四階 / 五階）過濾。最高階別 = 有值的最大 `course_N`。此篩選取代原本的單一「有五階」勾選。

#### Scenario: 篩出上到三階的學員
- **WHEN** 使用者選擇課程進度 = 三階
- **THEN** 列表僅顯示 `course_3` 有值且 `course_4`、`course_5` 皆空的學員

#### Scenario: 篩出未上課
- **WHEN** 使用者選擇課程進度 = 未上課
- **THEN** 列表僅顯示 `course_1`~`course_5` 皆空的學員

### Requirement: 會籍狀態篩選

學員表格 SHALL 提供「會籍狀態」篩選：已過期 / 30 天內到期 / 90 天內到期 / 有效 / 無資料，依 `membership_expiry` 與當日比較判定。

#### Scenario: 篩出會籍已過期
- **WHEN** 使用者選擇會籍狀態 = 已過期
- **THEN** 列表僅顯示 `membership_expiry` 早於今日的學員

#### Scenario: 篩出 30 天內到期
- **WHEN** 使用者選擇會籍狀態 = 30 天內到期
- **THEN** 列表僅顯示 `membership_expiry` 在今日起 30 天內（含）的學員

### Requirement: 身份與時段篩選

學員表格 SHALL 提供「心之使者」篩選（`spirit_ambassador_join_date` 有值）與「本月新生」篩選（`created_at` 在近 30 天內）。

#### Scenario: 篩出心之使者
- **WHEN** 使用者啟用「心之使者」篩選
- **THEN** 列表僅顯示 `spirit_ambassador_join_date` 有值的學員

### Requirement: 情境快捷視圖

學員表格 SHALL 提供一鍵套用的情境快捷視圖，每個視圖封裝一組跨欄位條件。點選即套用、再點即取消。至少包含：

- **續報潛力**：存在某階 N（1~4）使 `course_N` 有值且 `course_{N+1}` 空
- **待催欠款**：存在某階使 `payment` 欄為純數字（代表還欠金額）且該階 `course` 為具體梯次（非「待確認梯次」、非空）
- **會籍快到期**：`membership_expiry` 已過期或 30 天內到期
- **本月新生**：`created_at` 在近 30 天內

#### Scenario: 套用「續報潛力」
- **WHEN** 使用者點選「續報潛力」快捷視圖
- **THEN** 列表僅顯示「上完某階但未上下一階」的學員

#### Scenario: 套用「待催欠款」
- **WHEN** 使用者點選「待催欠款」快捷視圖
- **THEN** 列表僅顯示「已排具體梯次但該階付款欄為金額（欠款）」的學員

#### Scenario: 取消快捷視圖
- **WHEN** 使用者再次點選已啟用的快捷視圖
- **THEN** 該視圖條件被移除，列表回到未套用該視圖的狀態

### Requirement: 篩選在有效體系內運作

所有篩選與快捷視圖 SHALL 在登入者的有效體系內運作（admin 為其體系、superadmin 為其當前選擇），MUST NOT 跨體系顯示資料。

#### Scenario: 太陽 admin 套用快捷視圖
- **WHEN** 太陽 admin 套用「待催欠款」
- **THEN** 結果僅含 `business_chain='太陽'` 且符合欠款條件的學員

### Requirement: 匯出當前篩選結果

學員表格 SHALL 允許匯出「當前篩選/快捷視圖套用後」的學員名單為 xlsx，匯出範圍須與畫面所見一致，並維持體系隔離。

#### Scenario: 匯出續報潛力名單
- **WHEN** 使用者套用「續報潛力」後點選匯出
- **THEN** 下載的 xlsx 僅含當前體系、符合續報條件的學員
