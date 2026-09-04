## Context

See proposal.md - Why。這是既有 `spirit-ambassador-hub` capability 的延伸，Server Component（`app/spirit/page.tsx`）已用 `applySystemFilter` 做體系隔離，Client Component（`app/spirit/SpiritClient.tsx`）已有 KPI 卡片、長條圖、Modal 等既有 UI 模式可沿用。

實測資料庫確認：星光體系實際有 29 個「星光N」格式分組（星光1~29）+ 1 個非數字命名分組（「小兔組」，14人）+ 14 人完全未分組。使用者提供的手動總表截圖只有27欄，且逐一比對後發現截圖是**過時快照**——部分綠底標記「尚未完成補課」的人，資料庫裡其實已經有 `join_date` 並完成分組（已轉正為正式心之使者），與截圖矛盾。已與使用者確認：以資料庫現有狀態為準，這些人不動；只補真正查無資料的人。

## Goals / Non-Goals

**Goals:**
- 分組總表依資料庫實際內容動態產生，不寫死欄數/組別清單，未來新增/移除分組不需要改程式碼。
- 新增的「補課狀態」欄位與既有「是否為心之使者」（`join_date`）判定完全獨立，不互相覆蓋或推斷。
- 一次性資料修復只處理本次確認過、資料庫查無分組資料的真實案例，不覆蓋任何已存在的 `join_date`/`group` 資料。

**Non-Goals:**
- 不把 `spirit_ambassador_makeup_completed` 加入 `lib/import/transform.ts` 的匯入欄位映射——來源 xlsx 目前沒有這個欄位，且這次刻意選擇「先用一次性腳本補資料、不動匯入流程」（見下方 Decision 4 的風險說明），加入匯入映射需要來源表單同步新增對應欄位，這次不在範圍內。
- 不修正「小兔組」這類非數字命名分組的命名規則，也不強制所有分組改用「星光N」格式——分組命名維持自由文字，總表只是依現狀排序呈現。
- 不處理 `林佩馨`（已有 `join_date` 但缺 `group`）這類既有「資料品質提醒」已經涵蓋的情況——那屬於既有的「有加入日但無組別」alert，不是這次新欄位要處理的「已分組未補課」情境，兩者是獨立問題。

## Decisions

**1. 新欄位命名為 `spirit_ambassador_makeup_completed`（boolean, nullable, 預設 null），沿用既有 `spirit_ambassador_` 前綴。**
`true` = 已完成補課；`false` 或 `null` = 尚未完成補課（總表顯示綠底）。用布林值而非字串狀態機——這個欄位只需要表達一個是/否的過渡狀態，沒有更多中間態需求，布林值最簡單且方便未來查詢統計（`WHERE spirit_ambassador_makeup_completed IS NOT TRUE`）。
- 考慮過的替代方案：字串 enum（例如 `'pending' | 'completed'`）。否決——目前只有二元語意，enum 徒增複雜度且未來若要擴充可以再加值域，不需要現在過度設計。

**2. 分組總表的欄位排序演算法：解析 `spirit_ambassador_group` 是否符合 `^(星光|太陽)\d+$`，符合者依數字部分由小到大排序在前；不符合者依姓氏筆畫/字串原始順序接續排在後面。**
```ts
function sortGroups(names: string[]): string[] {
  const numbered: { name: string; n: number }[] = []
  const others: string[] = []
  for (const name of names) {
    const m = name.match(/^(?:星光|太陽)(\d+)$/)
    if (m) numbered.push({ name, n: Number(m[1]) })
    else others.push(name)
  }
  numbered.sort((a, b) => a.n - b.n)
  others.sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  return [...numbered.map((x) => x.name), ...others]
}
```
- 考慮過的替代方案：依組員人數排序、或依組別建立時間排序。否決——使用者提供的截圖本身就是依數字順序排列（星光1、星光2、…），最貼近既有的心智模型（「星光N」這個命名本身就暗示了順序），且與「小兔組」這類例外命名分開處理，不強迫所有分組套用同一套排序邏輯。

**3. 組長判定：沿用 `groupMembers` 內既有的排序邏輯（依累積年資高到低），但總表需要「組長置頂」——沿用截圖的視覺慣例，以該組內累積年資最長者視覺上放在第一列。**
不新增「組長」欄位或標記——`page.tsx` 既有的 `groupMembers[name]` 陣列已經依年資高到低排序，總表直接複用這個排序結果，第一項自然就是視覺上的「組長」位置，不需要額外判定邏輯或資料庫欄位。
- 風險：這只是「年資最長=組長」的近似對應，不是真正的組長任命紀錄；若未來需要精確的組長身分（例如組長異動但年資不是最長），需要另外的欄位機制，這次不處理（截圖本身也只是視覺呈現慣例，沒有額外的組長判定資訊可以參照）。
- **【已被 Decision 9 取代】**：這裡預告的風險後來成真——使用者明確指出小隊長是任命制、與年資無關，見 Decision 9 新增的 `spirit_ambassador_is_leader` 獨立欄位。此 Decision 3 保留作為歷史記錄，不代表目前的實際行為。

**4. 一次性資料修復用獨立腳本直接寫入資料庫，不透過 `lib/import/transform.ts` 匯入管線。**
逐一比對確認後的最終清單（11人，見下表）：

| 姓名 | id | 寫入 group |
|---|---|---|
| 鄭林 | 31067 | 星光10 |
| 羅唯懿 | 21176 | 星光10 |
| 劉芳澤 | 12531 | 星光10 |
| 蔡庭妍 | 30536 | 星光13 |
| 王婉如 | 20992 | 星光21 |
| 梁歆甯 | 14311 | 星光21 |
| 林婉瑜 | 25402 | 星光21 |
| 周宗霖 | 13840 | 星光24 |
| 黃韻苹 | 14731 | 星光25 |
| 蔡佳婷 | 27998 | 星光26 |
| 黃琳貽 | 12565 | 星光27 |

全部11人皆 `spirit_ambassador_join_date IS NULL` 且 `spirit_ambassador_group IS NULL`（已與使用者逐一確認，排除了黃詩庭/林君豪/吳嘉倩三位資料庫已顯示完課轉正的案例，避免覆蓋既有正確資料）。腳本只對這11個明確 id 寫入 `spirit_ambassador_group`（依上表）與 `spirit_ambassador_makeup_completed = false`，不觸碰 `join_date`。
- **風險（實作階段發現並修正）**：原先設想「不把 `makeup_completed` 加入匯入映射」就足以避免被覆蓋，但 `app/api/import/apply/route.ts` 的 upsert 是**整列覆蓋**語意——`transformSourceRow()` 因來源 xlsx 沒有這個欄位而固定填 `null`，若不特別處理，下次任何一次真正的匯入都會把這批人（以及未來手動標記完課的人）的 `makeup_completed` 洗回 `null`，抹除關懷長的維護紀錄。**修正**：比照 `group_leader` 既有的保留模式，在 `apply/route.ts` 組裝 upsert batch 時，`spirit_ambassador_makeup_completed` 改用 `dbMap.get(row.id)?.spirit_ambassador_makeup_completed ?? null` 保留資料庫既有值，不採用 `transformSourceRow()` 填的 `null`。修正後行為：`spirit_ambassador_group` 若來源表單填入新值，仍會正常依匯入更新（這是預期行為，分組本來就該隨匯入同步）；`spirit_ambassador_makeup_completed` 則完全不受匯入影響，只能透過本次腳本或未來的手動維護管道變更，直到真正完課、由關懷長手動標記 `true` 為止。

**5. `spirit-ambassador-hub` spec 的體系隔離措辭順手修正（`business_chain` → `guidance_chain`）。**
這不是這次變更的核心動機，但這個 capability 剛好因為本次新增「分組總表」需求而被開啟修改，複查時發現 `guidance-chain-system-basis` 變更完成時遺漏了這份 spec 文字（只更新了程式碼，因為 `applySystemFilter` 底層自動生效；但 spec 文字本身是靜態內容，不會自動同步）。既然這次本來就要碰這個 capability，一併修正文字避免文件與實際行為長期不一致，不需要為此另開一個 change。

**6.（實作完成、使用者實際看到畫面後的回饋調整）版面從「橫向捲動的固定寬欄」改為「窄欄＋自動換行」，並移除未分組名單區塊。**
初版實作依原始 Decision 3 的視覺構想，用 `overflow-x-auto` 橫向捲動呈現30欄（每欄 `w-28`），並在總表下方另列一份818人的「未分組名單」（依 spec 原文「未分組者不出現在網格中，改於總表旁/下方另列」）。使用者實際看到畫面後回饋：(1) 未分組名單資訊量過大、不是這次的核心訴求，不需要呈現；(2) 30欄橫向捲動不符合「一目了然」的期待，希望改成不需要橫向捲動的版面。
- **未分組名單移除**：不只是隱藏 UI，`app/spirit/page.tsx` 收集未分組者的迴圈邏輯與 `unassigned` 資料結構一併移除（原本會把818筆資料從 Server Component 傳到 Client 卻不再顯示，是無謂的資料傳輸），`SpiritClient.tsx` 的 `Props`/函式參數同步移除 `unassigned`。既有的「有加入日但無組別」資料品質提醒（母體限定正式心之使者）不受影響，仍保留——這次移除的是分組總表區塊新增的、母體為全體學員的那份名單。
- **版面改為窄欄＋`flex-wrap` 自動換行**：欄寬從 `w-28` 縮到 `w-20`、文字從 `text-xs` 縮到 `text-[11px]`，容器從 `overflow-x-auto` + `flex` + `minWidth: max-content`（強制單行、橫向捲動）改為單純的 `flex flex-wrap`（依可視寬度自動換行，不寫死行數）。已與使用者確認：實際行數會隨畫面寬度變化，不強制精確兩行，這是可接受的（比起固定兩行但小螢幕仍需捲動，自動換行更穩健）。
- delta spec 已同步更新：「分組總表」Requirement 新增「MUST NOT 要求橫向捲動」「MUST NOT 另外呈現未分組名單」的措辭與對應 scenario，移除舊有的「未分組者另列名單」scenario。

**7.（部署後使用者提出新需求）新增補課狀態編輯功能：分組總表綠底格子上的勾選按鈕，讓管理層級可直接標記完成補課。**
初版實作（Decision 1）只做了唯讀顯示——`spirit_ambassador_makeup_completed` 只能透過一次性腳本手動改資料庫，沒有任何操作介面。使用者實際使用後提出：11人完課後要怎麼標記，目前完全沒有途徑。

- **互動設計**：不是讓整個綠底格子可點擊（那會跟既有「點格子連到 `/students?search=...`」的行為衝突），改成在格子內疊加一個獨立的勾選（✓）小按鈕，各自有獨立的點擊熱區，姓名連結行為維持不變。點擊勾選按鈕會先 `confirm()` 二次確認（比照系統既有的刪除類操作慣例，例如 `handleDeleteGroup`），避免手滑誤觸。
- **API 端點設計**：新建專用端點 `PATCH /api/students/[id]/spirit-makeup`（而非開放式的「更新任意學員欄位」端點）——範圍明確限縮在這一個欄位，避免變成可以改任何學員資料的後門。
- **權限**：與使用者確認比照既有寫入操作慣例，限 `superadmin`/`system_admin`（`requireManager`），一般 `admin` 不可操作；`system_admin` 用既有的 `studentIdsAllInSystem()` 驗證目標學員屬於其有效體系，越權嘗試回 401——完全比照 `student-overrides/[id]`/`parent-aliases/[id]` 既有的越權防護模式，不是新規則。
- **更新後的重新整理策略**：沿用這個頁面既有的 `switchSystem()` 模式——API 成功後呼叫 `router.refresh()` 讓 Server Component 重新查詢，而非手動維護本地 state 做樂觀更新。這個頁面資料量不大（單次查詢全體系學員），重新整理的成本可接受，且避免了本地 state 與伺服器資料不同步的風險。
- **錯誤/成功回饋**：使用先前已建立的全站 Toast 系統（`lib/toast.ts`）呈現成功/失敗訊息，與系統其餘寫入操作的錯誤處理風格一致。

**8.（Decision 7 部署後發現的 bug 並修正）補課狀態編輯改為雙向切換，修正「點錯了無法恢復」的問題。**
Decision 7 的初版實作是單向的：勾選按鈕只在 `pendingMakeup=true`（綠底）時渲染，點擊後該學員的 `pendingMakeup` 變 `false`，按鈕連同格子的綠底一起消失——完全沒有「改回未完成」的途徑。使用者實際使用時誤觸了蔡庭妍（id=30536），回報「點錯了似乎無法恢復成未補課狀態」，逐一排查11人現況後確認正是蔡庭妍被誤觸卡在 `makeup_completed=true`。

- **根因**：把「是否顯示綠底」（`pendingMakeup`）跟「是否顯示編輯入口」誤用同一個布林值判斷，兩者其實是不同的問題——前者是視覺呈現，後者是操作可用性，操作入口不應該因為狀態改變就跟著消失。
- **修正**：`app/spirit/page.tsx` 為每位組員新增獨立的 `canToggleMakeup` 欄位（`= !spirit_ambassador_join_date`，即「尚未是正式心之使者」），與 `pendingMakeup` 分開判斷；`SpiritClient.tsx` 的編輯入口改用 `canToggleMakeup` 決定是否顯示，按鈕本身依 `pendingMakeup` 決定圖示（✓ 標記完成／↺ 改回未完成）與呼叫 API 時傳入的目標值。已轉正（`join_date` 有值）的學員不論 `makeup_completed` 為何，`canToggleMakeup` 恆為 `false`，不顯示任何編輯入口——避免對數百位正常心之使者顯示一個沒有意義的操作。
- **資料復原**：修正程式碼後，立即手動把蔡庭妍（id=30536）的 `spirit_ambassador_makeup_completed` 復原回 `false`，執行前後皆有查詢確認，其餘10人的資料在排查過程中確認皆未受影響（維持原本一次性腳本寫入的 `false`）。
- delta spec 的「補課狀態編輯」Requirement 已同步更新：措辭改為「雙向切換」，新增「已轉正者不提供編輯入口」的規則與對應 scenario。

**9.（使用者提出新需求）新增獨立的 `spirit_ambassador_is_leader` 欄位取代 Decision 3 的年資近似推斷，並比照 Decision 7/8 的教訓一開始就做成雙向編輯。**
使用者看到分組總表後明確指出：截圖第一列的粉紅底是「小隊長」，且小隊長是任命制、與年資無關（可能異動、可能新人被指派但年資不是最長）——這正好印證了 Decision 3 當時記錄的風險。

- **欄位設計**：`spirit_ambassador_is_leader`（boolean, nullable），語意單純（true=小隊長），不做成 enum——沿用 Decision 1 對 `makeup_completed` 的同樣考量，目前只有二元語意，不需要過度設計。
- **排序規則**：與使用者確認「小隊長優先置頂，其餘依年資排序；若某組未標記則 fallback 回現行年資排序」——`Array.prototype.sort` 的比較函式天然支援這個 fallback，不需要特別分支：`isLeader` 不同則依 `isLeader` 排序，相同（含兩者皆為 `false`）則落入既有的年資比較。
- **同組互斥**：與使用者確認「標記新小隊長時，自動將同組舊小隊長降級，保證每組最多一位」——這個約束在 API 層（`/api/students/[id]/spirit-leader`）用「先查詢目標學員所屬組別 → 該組其餘 `is_leader=true` 者一併改為 `false` → 再把目標學員設為指定值」三步驟完成，不在資料庫層用 unique constraint 強制（Postgres 的 partial unique index 可以做到，但這裡的資料量與使用頻率不需要資料庫層級的強制約束，應用層邏輯已足夠可靠且更容易維護）。
- **一開始就做雙向編輯**：直接吸取 Decision 7/8 的教訓（先做單向、後來才發現需要雙向、還導致資料卡住無法復原的 bug）——這次 UI 從一開始就是「灰色★=可標記、紅色★=已是小隊長點擊可取消」的雙向按鈕，不會重蹈覆轍。
- **視覺優先權**：小隊長樣式（紅底+粗體+★）優先於補課狀態的綠底——兩個狀態邏輯上互不衝突（一個人理論上可以同時是小隊長且尚未完成補課，雖然實務上少見），但視覺上兩種底色不能疊加顯示，選擇讓小隊長樣式優先，因為小隊長是「誰是誰」的身分標記，補課狀態是「進度」，身分辨識優先權更高。
- **一次性資料比對**：逐一比對截圖 27 位小隊長姓名，發現 7 位有問題——3 位查無此人（第8、14、21組），4 位查得到但實際所屬組別編號與截圖不同（例如截圖「23組」組長「胡惠雅」實際在資料庫「星光26」組），顯示截圖的組別編號可能已經跟系統現況脫節（這與先前 Decision 4 處理「已分組未完課」11人時遇到的資料過時問題性質相同）。與使用者確認：先只寫入 20 位確認無誤的，其餘 7 位留待後續確認正確對應關係。
- **匯入管線保留邏輯**：比照 Decision 4/8 對 `makeup_completed` 的處理，`spirit_ambassador_is_leader` 同樣在 `app/api/import/apply/route.ts` 的 upsert batch 組裝時保留資料庫既有值，不被匯入覆蓋。

## Risks / Trade-offs

- [Risk] 手動比對姓名的一次性腳本存在同名風險（若資料庫中有同名學員，`.eq('name', ...)` 可能匹配到錯誤的人）→ Mitigation：已用明確的學員 `id`（而非姓名字串）作為腳本的寫入依據，姓名比對只在盤點階段用於人工確認，實際寫入操作以 id 為準，避免同名學員被誤寫。
- [Risk] 截圖本身可能還有其他過時或矛盾之處未被發現（只針對綠底人員逐一核對，粉紅底組長與白底一般組員未逐一核對）→ **已驗證成真**：Decision 9 逐一核對27位小隊長姓名時，發現7組（第8、14、21、22、23、26、27組）確實對不上（3位查無此人、4位實際所屬組別編號與截圖不同）——證實截圖確實存在過時/矛盾之處，且不只是理論風險。Mitigation 維持原判斷：分組總表的欄位/成員本身依資料庫現況動態產生，不依賴截圖，只有「誰是小隊長」這個標記需要截圖佐證，已用「先寫入確認無誤的、其餘留待後續確認」的方式處理，不影響總表其餘部分的正確性。
- [Risk] `spirit_ambassador_makeup_completed`、`spirit_ambassador_is_leader` 皆不在匯入映射範圍內，長期而言需要人工維護（見 Decision 4、9）→ Mitigation：這是刻意的範圍界定，避免這次變更牽動既有匯入管線；若未來確認來源表單會固定提供這些欄位，可以再開一個後續 change 補上匯入映射，屆時可直接複用這次新增的欄位，不需要重新設計。
- [Risk] 「每組最多一位小隊長」的約束只在應用層（API route）強制，資料庫層沒有 constraint 保證——若有繞過 API 的直接資料庫寫入（例如未來的另一支腳本、或手動 SQL），可能造成同組多位小隊長，屆時分組總表排序邏輯只會取第一個符合的人置頂，其餘小隊長仍會顯示小隊長樣式但不在第一位，不是明顯的錯誤但可能造成視覺混淆 → Mitigation：目前寫入路徑只有這次的一次性腳本（已用逐筆驗證，不會造成同組多位）與 API route（已有自動降級邏輯），風險發生機率低；若未來需要更強的保證，可以加 Postgres partial unique index（`CREATE UNIQUE INDEX ... WHERE spirit_ambassador_is_leader = true` 搭配 `(spirit_ambassador_group)` 唯一性），這次評估不需要，留待未來視實際需求再處理。
- [Open Item] 7組小隊長（第8、14、21、22、23、26、27組）尚未確認正確對應關係，需要與使用者後續確認後再補寫入（見 Decision 9）。

## Migration Plan

1. 新 migration 新增 `spirit_ambassador_makeup_completed BOOLEAN` 欄位（nullable，無 default 或 default NULL），純加欄位，不影響既有資料/查詢。
2. migration 套用後執行一次性資料修復腳本（11人，見 Decision 4 表格），只寫入這批人的 `spirit_ambassador_group` 與 `spirit_ambassador_makeup_completed`。
3. 程式碼部署（頁面新增總表 UI + 查詢邏輯）可與 migration 前後順序無關——新欄位查詢時若 migration 尚未套用會直接因欄位不存在而報錯，故仍建議 migration 先於或同時於程式碼部署，維持與先前幾次變更一致的順序原則。
4. 回滾：若需回滾，程式碼版本回滾後，新欄位與這11人的資料修復可以留在資料庫（不影響舊版程式碼運作，舊版查詢不會 select 這個欄位）；如需徹底復原可下 `ALTER TABLE students DROP COLUMN spirit_ambassador_makeup_completed`，資料修復寫入的 `spirit_ambassador_group` 建議保留（那是真實有效的分組歸屬資訊，不屬於這次變更引入的暫時性資料）。
5.（Decision 9 追加）新 migration `021_spirit_ambassador_leader.sql` 新增 `spirit_ambassador_is_leader BOOLEAN` 欄位，套用後執行一次性資料寫入（20人，見 Decision 9），只寫入 `spirit_ambassador_is_leader = true`，不觸碰其他欄位。已對 20 人逐筆驗證執行前的姓名/組別皆與截圖吻合，執行後皆正確寫入。回滾方式與步驟4相同：可保留欄位與資料（不影響舊版程式碼），或 `DROP COLUMN spirit_ambassador_is_leader` 徹底復原。
