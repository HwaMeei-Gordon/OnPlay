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

    let last = performance.now();
    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      Game.Engine.update(dt);
      Game.Render.draw();
      Game.UI.sync();
      Game.UI.tickAfford(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    setInterval(save, 5000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
  }

  function save() { Game.Save.save(); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
