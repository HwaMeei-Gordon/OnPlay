# OnPlay UI 設計規範（v3「青銅厚框」設計系統）

> 2026-06-11 制定。本文件是 `assets/style.css` 的設計依據；改 UI 前先讀這裡。
> 參考語言：勇士團團轉（Heroll）的「厚實感」＋ Idle Horizons 的清爽排版 —— **只取設計語言，不取圖檔**。

---

## 0. 設計哲學（為什麼這樣設計）

| 原則 | 說明 |
|---|---|
| **實體感（Chunky）** | 手遊 UI 的「好看」大半來自「厚」：粗框、浮雕、凹陷、投影。薄線框＝網頁感；厚框＝遊戲感。 |
| **拇指優先** | 主導航放**螢幕底部**（拇指自然落點）；高頻操作（招募、合成、購買）按鈕 ≥44px。 |
| **兩層導航** | 5 個底部大分頁（群組）＋群組內子分頁。任何功能 ≤2 步可達，底部列永不捲動。 |
| **紫夜識別 × 青銅框** | 底色維持本作的深紫夜（識別不變），框體用青銅金（參考遊戲的厚框語言）→ 融合而非照抄。 |
| **一套格子語言** | 所有「物品格」（背包/素材/隊伍/掉落/五芒星）共用同一視覺：凹陷底＋稀有度粗框＋角徽章。 |

## 1. 設計 Tokens（CSS 變數）

```css
--bg:#14101f  --bg2:#0f0c18  --panel:#1f1830  --panel2:#2a2140  --card:#241c38
--line:#3a2f55  --text:#e8e4f0  --muted:#9a90b5
--gold:#ffd23f  --gem:#67d6ff  --soul:#b06ae0  --green:#4ad94a  --red:#e84141  --blue:#7ad7ff
/* v3 新增：青銅框體系 */
--frame:#7a5a2e      /* 青銅主框 */
--frame-hi:#d9b06a   /* 框高光（上緣/角點） */
--frame-dk:#41301a   /* 框暗緣（下緣） */
--cell:#151024       /* 格子凹陷底 */
--ink:#0a0712        /* 最深描邊／投影 */
```

## 2. 元件語言

### 2.1 厚框面板 `.pframe`
大型容器（出戰列、彈窗、統計箱、招募卡）統一：
- `border: 3px solid var(--frame)` ＋ 內圈 `inset 0 0 0 2px var(--ink)`（框內再一圈深線 → 雙層框）
- 上緣內亮 `inset 0 3px 0 rgba(255,255,255,.05)`、下方外投影 `0 3px 0 var(--ink)`
- **四角金點**：`background-image` 四組 6×6 漸層方塊定位四角（不佔 DOM）。

### 2.2 浮雕按鈕（三層立體）
所有按鈕共用：`border:2px solid var(--ink)`＋`inset 0 2px 0 亮`＋`inset 0 -3px 0 暗`＋`0 3px 0 var(--ink)`；
`:active` → `translateY(2px)`＋去外影（物理按下）。
- **金（primary）**：購買/合成/領取主行動。
- **綠（buy）**：花費金幣類。
- **石板（mini/act）**：次要操作。`.on` 狀態轉金。

### 2.3 物品格（統一所有 cell）
`.bag-cell / .mat-cell / .pb-slot / .form-cell / .hb-drop / .penta-point / .hc-frame / .im-frame / .dh-frame`：
- 凹陷底：`background:var(--cell)`＋`inset 0 2px 6px rgba(0,0,0,.55)`
- 稀有度粗框：`border:2~3px solid var(--rc)`（rarity color 由 inline `--rc` 提供，沿用既有機制）
- **LV 徽章**（`.bc-badge`）：左下黑帶金字（仿 LV.6）
- **配備籤**（`.bc-eq::after:"配備"`）：左上綠底黑字小籤（取代原本綠點）
- 升星 `.bc-star`：右上金字。

### 2.4 橫幅標題 `.sec-title`
從「左金線文件式」改為**置中橫幅**：深色帶＋上下青銅線＋兩側漸層翼線＋金字。

### 2.5 進度條
`.xp-bar / .mode-fill 容器`：高 12px、`border:2px solid var(--ink)`、軌道凹陷、填充亮綠漸層＋頂部 1px 高光。

## 3. 資訊架構（12 分頁 → 5 群組）

**底部主分頁列**（固定 5 鈕、不捲動、active 金亮）＋**子分頁列**（panel 頂部、群組內 >1 才顯示）：

| 群組 | 子分頁 |
|---|---|
| 英雄 | （單頁：隊伍/招募/名冊） |
| 裝備 | 背包・鍛造坊・合成 |
| 商店 | （單頁） |
| 養成 | 寵物・訓練・天賦・轉生 |
| 冒險 | 任務・說明書・設定 |

實作：`ui.js` 新增 `GROUPS`；`TABS` 與所有 render 函數、`data-act` 處理器**完全不動**（風險最小化）。`openTab(id)` 同步主列＋子列 active。
版面順序（index.html）：`#panel-area = [#sub-bar][#panel-content][#tab-bar]` → 主分頁天然落底。

## 4. 各頁面落地對應

| 頁面 | 改動 |
|---|---|
| HUD | 資源籤厚框化（2px ink 框＋實底）；模式鈕同浮雕語言。 |
| 英雄 | 出戰列＋陣型格 pframe；英雄卡=統一格子＋LV 徽章；招募卡 pframe＋rolls 染色不變。 |
| 詳情 | 頭像框統一格子；XP 條 chunky；轉職卡 pframe。 |
| 背包 | 格子統一語言＋配備籤＋LV 徽章；素材格同。 |
| 鍛造/合成 | forge-tab/seg 浮雕；五芒星點=統一格子；合成鈕金浮雕。 |
| 商店/開箱 | gacha-card pframe；buy-btn 浮雕。 |
| 說明書 | 掉落格統一；fx 卡 pframe-lite。 |
| 彈窗 | pframe＋四角金點＋金標題；toast 同語言。 |

## 5. 禁則
- 不引入外部字體/圖檔（離線單機）；一切框體用純 CSS。
- 不改 `data-act`／render 函數簽名；CSS class 名稱**只增不刪**。
- 觸控目標 ≥40px；底部列加 `env(safe-area-inset-bottom)`。
