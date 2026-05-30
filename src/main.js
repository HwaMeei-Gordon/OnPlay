/* ============================================================
 * main.js — 入口：載入存檔、離線結算、主迴圈、自動存檔
 * ============================================================ */
(function () {
  "use strict";
  const Game = window.Game;

  function boot() {
    const canvas = document.getElementById("game-canvas");
    const loaded = Game.Save.load();

    Game.Engine.init(loaded);
    Game.Render.init(canvas);
    Game.UI.init();

    // 離線收益（依存檔中的 goldPerSec 與 lastSaveTime）
    const offline = Game.Save.computeOffline(loaded);
    if (offline) {
      Game.Engine.applyOfflineGold(offline.gold);
      Game.UI.showOffline(offline);
    }

    // 立即存一次，更新 lastSaveTime（避免重整重複領離線收益）
    save();

    // ---- 主迴圈 ----
    let last = performance.now();
    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // 分頁切回時避免一次模擬過久
      Game.Engine.update(dt);
      Game.Render.draw(Game.Engine.state);
      Game.UI.sync();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ---- 自動存檔 ----
    setInterval(save, 5000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") save();
    });
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
  }

  function save() {
    Game.Save.save(Game.Engine.toSaveData());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
