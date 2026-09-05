## Context

見 proposal.md - Why。本設計的技術背景：

- `app/api/import/apply/route.ts` 目前對 `spirit_ambassador_group` 沒有保留邏輯——這是 `computeDiff()`（`lib/import/diff.ts`）的 `COMPARABLE_FIELDS` 白名單成員，upsert batch 組裝時 `...row` 展開直接帶入 xlsx 值，與 `group_leader`/`spirit_ambassador_makeup_completed`/`spirit_ambassador_is_leader` 已有的 `dbMap.get(row.id)?.欄位 ?? null` 保留寫法不同。
- `spirit-roster-drag-edit`（進行中，待完成封存）新增了 `spirit_ambassador_groups` 資料表（記錄組別本身，含空組別）與拖曳搬移端點 `PATCH /api/students/[id]/spirit-group`——本次變更依賴這張表判斷「xlsx 分組值是否為系統已知組別」。
- `import_logs` 表是既有的匯入稽核紀錄（欄位級 diff），但只記錄「匯入把值從 A 改成 B」，沒有「這個改動與當前系統值衝突、被擋下」這種語意，不能直接複用；需要新的資料結構承載「衝突」這個中間狀態。

## Goals / Non-Goals

**Goals:**
- 修正 `spirit_ambassador_group` 缺乏匯入保留邏輯的根本缺陷，確保拖曳異動不會被匯入無聲覆蓋。
- 偵測到衝突時，兩個候選值都可追溯，由管理者事後在 UI 上明確擇一。
- 衝突處理的操作模式（權限、確認、回饋）與既有 `spirit-makeup`/`spirit-leader` 一致，不引入新的互動典範。

**Non-Goals:**
- 不處理 `spirit_ambassador_group` 以外欄位的匯入衝突（例如手機、地址等其他欄位若同時被匯入與手動編輯修改，維持現狀的「匯入即覆蓋」行為，不在本次範圍）——分組是目前唯一存在「本系統可獨立編輯、且該編輯不希望被匯入覆蓋」語意的欄位。
- 不自動判斷或建議管理者該保留哪一個候選值；系統只呈現兩個值，決策權完全在人。
- 不做「衝突發生時即時通知管理者」（例如 email、站內通知）——衝突清單是被動呈現，管理者需自行進入心之使者專區查看，主動通知機制留待未來需求出現再評估。
- 不處理「同一次匯入批次內，xlsx 本身就有兩筆資料指向同一位學員但分組值不同」這種 xlsx 檔案自相矛盾的異常情況——視為既有匯入流程「同 id 多列以最後一列為準」的既定行為，不特別處理。

## Decisions

### Decision 1：新增獨立的 `spirit_group_conflicts` 資料表

**決定**：新 migration 建立 `spirit_group_conflicts` 表：
- `id`（PK）
- `student_id`（FK 概念上指向 `students.id`，不建實際外鍵約束——比照本專案既有慣例，`students` 表本身在其他關聯表如 `parent_aliases`/`student_overrides` 也未強制外鍵，見既有 schema 風格）
- `student_name`（快照，避免學員改名後衝突清單顯示對不上）
- `system_value`（本系統現有的 `spirit_ambassador_group` 值，衝突發生當下的快照）
- `import_value`（xlsx 候選值）
- `status`（`'pending'` | `'resolved'`）
- `resolution`（nullable，`'kept_system'` | `'kept_import'`，僅 resolved 時有值）
- `resolved_by`（nullable，處理者 username）
- `resolved_at`（nullable）
- `created_at` / `updated_at`

**理由**：獨立表不碰 `students.spirit_ambassador_group` 本身，衝突偵測與待解決狀態完全與既有欄位語意脫鉤，符合使用者確認的方向。`status` 用字串列舉而非直接刪除已解決記錄，滿足「標記已解決、保留歷史」的要求，比照 `import_sessions.applied`（布林標記＋保留記錄）的既有稽核精神。

**同一學員最多一筆待處理衝突**：`student_id` + `status='pending'` 應保持唯一（用部分索引 `UNIQUE (student_id) WHERE status = 'pending'` 或應用層在寫入前先查詢既有 pending 記錄再決定 insert/update）。使用者已確認：若學員已有待處理衝突、又匯入新一批不同的 xlsx 值，直接更新既有記錄的 `import_value`（`updated_at` 一併更新），不新增第二筆。

### Decision 2：衝突偵測時機——`import/apply` 套用階段，而非 `import` 預覽階段

**決定**：衝突偵測邏輯放在 `app/api/import/apply/route.ts`（實際套用時），不放在 `POST /api/import`（上傳預覽階段）。

**理由**：預覽階段（`computeDiff`）算出的 diff 只是給人看的參考數值，不代表最終會被套用；且分組欄位的「衝突」定義是「與套用當下的資料庫現有值不同」，如果在預覽階段就記錄衝突，使用者可能上傳預覽後遲遲不按套用，這段期間資料庫的現有值可能又被別的拖曳操作改變，預覽階段記下的衝突會過期失真。套用階段是資料庫寫入的唯一時間點，衝突偵測放在這裡才能保證比較基準是當下最新值。

**偵測邏輯**（插入現有 `apply/route.ts` 迴圈中，緊鄰既有 `group_leader`/`spirit_ambassador_makeup_completed` 保留邏輯旁）：
```
對每個 importRow：
  existingGroup = dbMap.get(row.id)?.spirit_ambassador_group ?? null
  importGroup = row.spirit_ambassador_group ?? null
  若 importGroup 為空 或 importGroup === existingGroup：
    無衝突，upsert 時 spirit_ambassador_group 維持 existingGroup（不變）
  否則（importGroup 有值且 !== existingGroup）：
    有衝突：
      upsert 時 spirit_ambassador_group 維持 existingGroup（不被覆蓋，這是本次修正的核心）
      查詢是否已有該學員的 pending 衝突記錄：
        有 → 更新 import_value 為 importGroup、updated_at 更新
        無 → 新增一筆 pending 衝突記錄，system_value=existingGroup、import_value=importGroup
```
此邏輯與既有的 `group_leader`/`makeup_completed`/`is_leader` 保留邏輯並列在同一段 batch 組裝程式碼中，維持既有程式碼的物理鄰近性（同一類「匯入不覆蓋既有值」的關注點集中在一起，方便未來維護者一眼看懂哪些欄位有這種保護）。

**批次效能**：衝突偵測需要對每個有分組差異的 importRow 查一次「是否已有 pending 記錄」——比照既有 `dbMap`（`existingStudents` 的 500-ID chunk 查詢）模式，在迴圈開始前一次性查出這批 `importIds` 中所有既有 pending 衝突記錄（用 `IN` 查詢），組成 `Map<student_id, conflict_row>`，避免在迴圈內逐筆查詢造成 N+1。

### Decision 3：xlsx 新組名（`spirit_ambassador_groups` 中不存在）視為衝突，不自動建立

**決定**：衝突偵測時，`importGroup` 若不存在於當前 `spirit_ambassador_groups`（該學員所屬體系），仍走一般衝突流程（`system_value` vs `import_value`），只是這裡的 `import_value` 恰好是一個系統未知的組名。管理者若最終選擇「保留 import 值」，解決衝突的操作本身**不**自動新增這個組別到 `spirit_ambassador_groups`——若該組別在 `spirit_ambassador_groups` 不存在，寫回 `students.spirit_ambassador_group` 後，這位學員會在分組總表「查無所屬欄位」（比照 Risk 一節的處理）。

**理由**：使用者已確認不自動建立。避免匯入的手民誤植或已停用的舊組名，被動地污染 `spirit_ambassador_groups`。

### Decision 4：待處理衝突清單 UI 與分組總表警示標示

**決定**：`/spirit` 頁面新增一個獨立卡片區塊「待處理分組衝突」，置於分組總表下方（不與分組總表混排——分組總表是「目前分組現況」的呈現，衝突清單是「需要人工決策的佇列」，性質不同，混在同一個視覺容器會讓總表的既有簡潔佈局變複雜）。清單每列顯示：學員姓名（連結至 `/students?search=`）、本系統現有值、xlsx 候選值、衝突發生/更新時間、兩顆操作按鈕「保留本系統值」「改採 xlsx 值」。

分組總表中，有 pending 衝突的學員格子在姓名旁加一個警示圖示（例如 ⚠），`title` 顯示「此人有待處理的分組衝突」；點擊不做頁面跳轉（避免又要處理錨點捲動邏輯），只在視覺上提示——管理者若要處理，捲動到下方衝突清單即可，見 Risk 一節說明為何不做自動捲動連結。

**理由**：使用者已確認「顯示本系統現有值＋警示圖示」的方向。獨立清單區塊比照既有「資料品質提醒」卡片的呈現慣例（`AlertBlock` 元件），不是全新的視覺語言。

### Decision 5：解決衝突的 API 端點與權限

**決定**：新增 `PATCH /api/spirit-group-conflicts/[id]`，body 為 `{ resolution: 'kept_system' | 'kept_import' }`。權限比照既有：`requireManager`（`superadmin`/`system_admin`），`system_admin` 限其有效體系（透過衝突記錄關聯的 `student_id` 查 `guidance_chain` 校驗，比照 `studentIdsAllInSystem`）。

處理邏輯：
- `resolution: 'kept_system'`：`students.spirit_ambassador_group` 不變（本來就沒被覆蓋），僅將衝突記錄標記 `status='resolved'`、`resolution='kept_system'`、`resolved_by`、`resolved_at`。
- `resolution: 'kept_import'`：`students.spirit_ambassador_group` 更新為衝突記錄的 `import_value`，同步標記衝突記錄為已解決。此路徑等同於一次「補做」的分組搬移，語意上與拖曳搬移相同，但不透過 `PATCH /api/students/[id]/spirit-group`（那個端點會額外校驗目標組別必須存在於 `spirit_ambassador_groups`，會擋下 Decision 3 提到的「xlsx 新組名」情境）——衝突解決端點直接 `update`，不做組別存在性校驗，因為這正是「允許寫入一個系統尚未登記的組名」的唯一合法路徑。

**理由**：與既有兩個 PATCH 端點（`spirit-makeup`、`spirit-leader`）的權限模式完全一致，使用者已確認採此方向；把「解決衝突」與「一般拖曳搬移」分成兩個端點，是因為兩者的校驗規則刻意不同（見上）。

## Risks / Trade-offs

- **[風險] 解決衝突選擇「保留 xlsx 值」，但該值是系統未知組名**——寫回後這位學員在分組總表會變成孤兒（不屬於任何 `spirit_ambassador_groups` 記錄的欄位，`page.tsx` 的 `rosterGroupMap` 只依 `spirit_ambassador_groups` 產生欄位，這位學員的分組值若不在其中，該學員會遺失在總表視覺呈現之外，只存在於 `students` 表原始資料）。
  → 緩解：`page.tsx` 的既有「資料品質提醒」區塊（`noGroup` 等）延伸涵蓋「有分組值但該值不在 `spirit_ambassador_groups` 中」這個新的資料品質類別，讓管理者至少能發現異常、手動新增對應組別或改用其他分組。
  → **實作時發現並修正的落差**：`page.tsx` 原本（`spirit-roster-drag-edit` 階段）有一段容錯邏輯，會把任何不存在於 `spirit_ambassador_groups` 的分組值自動當成一個新欄位塞進總表顯示——這與本節「孤兒學員會從總表消失」的假設矛盾，會讓系統未登記的孤兒分組偽裝成看似合法的正常組別，管理者無從察覺異常。已在本次實作移除該容錯，孤兒學員改為嚴格依 `spirit_ambassador_groups` 判斷，不存在則完全不進入 `rosterGroupMap`，只在資料品質提醒出現。
- **[風險] 衝突清單與拖曳搬移的時間差**——管理者正在處理衝突清單、選擇「保留本系統值」的同時，另一位管理者（或自己在另一個分頁）剛好把同一位學員拖到別的分組，本系統值已經變了但衝突記錄的 `system_value` 快照是舊的。
  → 緩解：`kept_system` 分支本來就不寫入 `spirit_ambassador_group`（維持當下值不變，不是寫回快照裡的舊 `system_value`），所以這個時間差不會造成資料錯誤，只是衝突清單上顯示的「本系統現有值」文字可能是稍早的快照、與畫面其他地方顯示的最新值不同步——可接受，因為 `router.refresh()` 後会重新查詢，且分組總表本身就會顯示當下真正的值。
- **[風險] 大量衝突同時產生**（例如匯入一整批舊資料，數百人分組值都不一致）——待處理清單可能瞬間暴增至上百筆，目前設計是純清單呈現，沒有分頁。
  → 緩解：初版先不做分頁/批次處理 UI（YAGNI），若實測發現量體確實龐大，可在後續迭代加分頁或「批次全部保留本系統值」的操作，不阻塞本次上線；tasks.md 會註記這個已知限制供未來參考。
- **[取捨] 衝突偵測只在 `import/apply` 觸發，不在預覽階段就告知使用者**——管理者要按下「套用」才會知道有沒有衝突產生，無法在預覽階段先看到警示。
  → 使用者已透過先前確認的方向（比較基準用套用當下的值）隱含接受這個時間點，屬於 Decision 2 已論證的必然結果。

## Migration Plan

1. 新 migration：建立 `spirit_group_conflicts` 表 + RLS 政策（比照既有 anon 唯讀 / service_role 全權模式）+ 部分唯一索引確保同一學員最多一筆 `pending` 記錄。
2. 型別：`lib/supabase/types.ts` 新增 `SpiritGroupConflict` 介面。
3. 修正 `app/api/import/apply/route.ts`：新增 `spirit_ambassador_group` 保留邏輯 + 衝突偵測與寫入/更新（Decision 2）。
4. 新增 API 端點：`PATCH /api/spirit-group-conflicts/[id]`（Decision 5）。
5. 前端：`app/spirit/page.tsx` 新增待處理衝突查詢；`app/spirit/SpiritClient.tsx` 新增衝突清單卡片、分組總表警示圖示。
6. 資料品質提醒延伸：涵蓋「分組值不在 `spirit_ambassador_groups` 中」的孤兒學員（Risk 一節）。
7. 手動驗證：模擬一次「拖曳搬移 → 匯入含舊分組值的 xlsx → 確認產生衝突記錄且 `students` 表值未被覆蓋 → 在衝突清單分別測試兩種解決方式 → 確認分組總表與衝突清單狀態皆正確更新」的完整流程。

無需 rollback 特殊處理——新表為新增、新增保留邏輯是既有模式的延伸、新 API 端點為新路由；若需回退，`DROP TABLE IF EXISTS spirit_group_conflicts` 並還原 `import/apply` 的保留邏輯即可（還原後即回到本次修正前「匯入直接覆蓋」的已知風險狀態，不建議在生產環境長時間停留在回退狀態）。
