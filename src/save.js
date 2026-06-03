/* ============================================================
 * save.js — localStorage 存讀檔 + v1→v2 遷移 + 離線收益
 * 全域命名空間：window.Game.Save
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});

  const SAVE_KEY = "brave-idle-save-v2";
  const OLD_KEY = "brave-idle-save-v1";

  function rawLoad(key) {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  // 把載入資料合併進預設狀態，確保所有欄位存在（向前相容）
  function mergeIntoDefault(loaded) {
    const base = Game.Systems.defaultState();
    if (!loaded) return base;
    const keys = [
      "version", "gold", "gems", "souls", "stage", "bestStage", "runBestStage", "battleMode",
      "heroes", "party", "inventory", "invSeq", "pets", "activePet",
      "trainings", "talents", "talentPoints", "prestige", "achievements",
      "daily", "stats", "shop", "scrolls", "materials", "guardians", "useGuardian", "goldPerSec", "gemPerSec",
    ];
    keys.forEach((k) => {
      if (loaded[k] !== undefined && loaded[k] !== null) base[k] = loaded[k];
    });
    // 卷軸：舊 {1..5}（依星卷）→ 新 {0..9}（區間卷，index=起始星）。舊 t 星卷 ≈ 新 (t-1)。
    {
      const def = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
      const sc = loaded.scrolls || {};
      const isOld = sc[0] === undefined && (sc[1] !== undefined || sc[2] !== undefined || sc[5] !== undefined);
      if (isOld) {
        for (let t = 1; t <= 5; t++) def[t - 1] = sc[t] || 0;
      } else {
        for (let i = 0; i < 10; i++) def[i] = sc[i] || 0;
      }
      base.scrolls = def;
    }
    if (!base.materials || typeof base.materials !== "object") base.materials = {};
    if (typeof base.guardians !== "number") base.guardians = 0;
    if (typeof base.useGuardian !== "boolean") base.useGuardian = false;
    // 安全檢查
    if (!base.heroes || !base.heroes.knight) {
      base.heroes = base.heroes || {};
      base.heroes.knight = { owned: true, level: 1, stars: 1, equip: {}, skills: {} };
    }
    Game.Data.EQUIPMENT_SLOTS.forEach((sl) => {
      Object.keys(base.heroes).forEach((hid) => {
        base.heroes[hid].equip = base.heroes[hid].equip || {};
        if (base.heroes[hid].equip[sl.id] === undefined) base.heroes[hid].equip[sl.id] = null;
        base.heroes[hid].skills = base.heroes[hid].skills || {};
      });
    });
    if (!Array.isArray(base.party) || base.party.length === 0) base.party = ["knight"];
    base.stats = Object.assign({ totalKills: 0, bossKills: 0, boxesOpened: 0, prestiges: 0 }, base.stats || {});
    base.daily = base.daily || Game.Systems.defaultState().daily;
    base.shop = base.shop || { date: Game.Systems.todayStr(), bought: {} };
    base.prestige = base.prestige || { count: 0, nodes: {} };
    base._goldSec = 0; base._gemSec = 0; base._secT = 1;
    return base;
  }

  // v1 → v2：保留金幣與最高關卡，其餘重新開始
  function migrateV1(v1) {
    const base = Game.Systems.defaultState();
    base.gold = Math.max(0, v1.gold || 0);
    base.bestStage = Math.max(1, v1.bestStage || v1.stage || 1);
    base.gems = 30; // 遷移補償
    base.stage = 1;
    return base;
  }

  // 回傳合併好的 state 物件（main 會 setState）
  // 確保所有裝備都有「每屬性 aBands」（舊存檔缺漏 → 重建＝全部重抽）
  function migrateItemBands(state) {
    if (state && Array.isArray(state.inventory)) {
      state.inventory.forEach((it) => Game.Systems.ensureItemAttrBands(it));
    }
    return state;
  }
  function loadState() {
    const v2 = rawLoad(SAVE_KEY);
    if (v2) return { state: migrateItemBands(mergeIntoDefault(v2)), loaded: v2 };
    const v1 = rawLoad(OLD_KEY);
    if (v1) return { state: migrateItemBands(migrateV1(v1)), loaded: null, migrated: true };
    return { state: Game.Systems.defaultState(), loaded: null };
  }

  function save() {
    try {
      const s = Game.State;
      const obj = Object.assign({}, s);
      delete obj._goldSec; delete obj._gemSec; delete obj._secT;
      obj.lastSaveTime = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
      return true;
    } catch (e) {
      console.warn("存檔失敗", e);
      return false;
    }
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  function computeOffline(loaded) {
    if (!loaded || !loaded.lastSaveTime) return null;
    const elapsed = Math.floor((Date.now() - loaded.lastSaveTime) / 1000);
    if (elapsed < 60) return null;
    const cap = Game.Data.OFFLINE_CAP_SECONDS;
    const sec = Math.min(elapsed, cap);
    const gold = Math.floor((loaded.goldPerSec || 0) * sec);
    const gems = Math.floor((loaded.gemPerSec || 0) * sec * 0.5);
    if (gold <= 0 && gems <= 0) return null;
    return { seconds: sec, realSeconds: elapsed, gold, gems };
  }

  Game.Save = { SAVE_KEY, loadState, save, reset, computeOffline };
})();
