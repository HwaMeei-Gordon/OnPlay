# CLAUDE.md

## 對話語言
- **一律使用繁體中文與使用者對話**（回覆、說明、提交訊息描述、PR 說明等面向使用者的內容都用中文）。
- 程式碼註解沿用專案既有風格與語言。

## 專案概述
這是一個中文化的放置型自動戰鬥（idle auto-battler）網頁遊戲，純前端、無建置流程。

### 技術架構
- Vanilla JS，IIFE 模組，掛載於全域 `window.Game.*`。
- 透過 `index.html` 以 `<script src="src/X.js?v=NN">` 載入；改動後需把 `?v=` 版本號 +1 以避免快取。
- 主要檔案：
  - `src/data.js`：資料定義（FX 狀態表、ENEMY_SKILLS、MONSTERS 名冊、裝備/套裝、各種常數與 export）。
  - `src/game.js`：戰鬥引擎（格子戰鬥、移動、技能、狀態系統）。
  - `src/render.js`：畫面繪製（drawFx 狀態特效、粒子）。
  - `src/ui.js`：UI 與圖鑑（說明書、怪物圖鑑、狀態頁）。
  - `assets/style.css`：樣式。

### 開發慣例
- 改完跑語法檢查：`node --check src/data.js src/game.js src/render.js src/ui.js`。
- 無頭測試 harness 位於 `/tmp/grid.js`（非版控），用 `node /tmp/grid.js` 跑；應全綠。
- 部署一次修改：更新 `index.html` 的 `?v=` 版本號 → commit → push。

### Git / 流程
- 開發分支：`claude/idle-game-hero-uMzfS`。
- push 用 `git push -u origin <branch>`。
- push 後若無 PR 則建立 draft PR。
