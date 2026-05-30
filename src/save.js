/* ============================================================
 * save.js — localStorage 存讀檔 + 離線收益計算
 * 全域命名空間：window.Game.Save
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});

  const SAVE_KEY = "brave-idle-save-v1";

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (e) {
      console.warn("讀檔失敗：", e);
      return null;
    }
  }

  function save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("存檔失敗：", e);
      return false;
    }
  }

  function reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      console.warn("重置存檔失敗：", e);
    }
  }

  // 依存檔中的 lastSaveTime 與 goldPerSec 計算離線期間獲得的金幣。
  // 回傳 { seconds, gold } 或 null（無有效離線時間時）。
  function computeOffline(data) {
    if (!data || !data.lastSaveTime || !data.goldPerSec) return null;
    const now = Date.now();
    let elapsedSec = Math.floor((now - data.lastSaveTime) / 1000);
    if (elapsedSec < 60) return null; // 少於 1 分鐘不結算
    const cap = Game.Data.OFFLINE_CAP_SECONDS;
    const cappedSec = Math.min(elapsedSec, cap);
    const gold = Math.floor(data.goldPerSec * cappedSec);
    if (gold <= 0) return null;
    return { seconds: cappedSec, realSeconds: elapsedSec, gold };
  }

  Game.Save = { SAVE_KEY, load, save, reset, computeOffline };
})();
