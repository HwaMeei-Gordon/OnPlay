/* ============================================================
 * main.js — 入口：載入/遷移存檔、離線結算、主迴圈、自動存檔
 * ============================================================ */
(function () {
  "use strict";
  const Game = window.Game;

  function boot() {
    const canvas = document.getElementById("game-canvas");
    const { state, loaded } = Game.Save.loadState();
    Game.Systems.setState(state);
    Game.Systems.refreshDaily();
    Game.Systems.refreshShopDate();

    Game.Render.init(canvas);
    Game.Engine.init();
    Game.UI.init();

    const off = Game.Save.computeOffline(loaded);
    if (off) {
      if (off.gold) Game.Systems.addGold(off.gold, true);
      if (off.gems) Game.Systems.addGems(off.gems, true);
      Game.UI.showOffline(off);
    }
    save();

    // 主迴圈：限制 ~30 FPS（用累加器），大幅降低 CPU/發熱；高刷新率手機也只更新 30 次/秒
    const STEP = 1 / 30;
    let last = performance.now(), acc = 0, rafId = 0, running = true;
    function frame(now) {
      rafId = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      acc += dt;
      if (acc < STEP) return; // 還沒到下一幀，直接略過（省電）
      const step = acc;
      acc = 0;
      Game.Engine.update(step);
      Game.Render.draw();
      Game.UI.sync(step);
      Game.UI.tickAfford(step);
    }
    rafId = requestAnimationFrame(frame);

    setInterval(save, 5000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        save();
        if (running) { cancelAnimationFrame(rafId); running = false; }
      } else if (!running) {
        running = true; last = performance.now(); acc = 0;
        rafId = requestAnimationFrame(frame);
      }
    });
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
  }

  function save() { Game.Save.save(); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
