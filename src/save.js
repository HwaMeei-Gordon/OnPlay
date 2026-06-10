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
      "roster", "heroSeq", "recruit", "party", "inventory", "invSeq", "pets", "activePet",
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
    // 舊制英雄（v2 heroes）→ 新制名冊：丟棄舊英雄（裝備本體仍在 inventory、自動全卸下），送 1 名初始冒險者
    if (loaded.heroes && !loaded.roster) {
      const starter = Game.Systems.makeStarter();
      base.roster = [starter];
      base.heroSeq = 2;
      base.party = [starter.uid];
      base.recruit = { date: Game.Systems.todayStr(), candidates: [], refreshes: 0 };
      base.gems = (base.gems || 0) + 30; // 改版補償
    }
    // 名冊正規化
    if (!Array.isArray(base.roster) || base.roster.length === 0) {
      const starter = Game.Systems.makeStarter();
      base.roster = [starter];
      base.heroSeq = Math.max(2, base.heroSeq || 2);
      base.party = [starter.uid];
    }
    base.roster.forEach((r) => {
      r.equip = r.equip || {};
      Game.Data.EQUIPMENT_SLOTS.forEach((sl) => { if (r.equip[sl.id] === undefined) r.equip[sl.id] = null; });
      r.skills = r.skills || {};
      r.baseRolls = r.baseRolls || {};
      if (typeof r.exp !== "number") r.exp = 0;
      if (typeof r.level !== "number" || r.level < 1) r.level = 1;
      if (r.level > Game.Data.LEVEL_CAP) r.level = Game.Data.LEVEL_CAP;
      if (!Game.Data.JOB_BY_ID[r.job]) r.job = "adventurer";
      if (r.pos === undefined) r.pos = null;
    });
    if (typeof base.heroSeq !== "number") base.heroSeq = base.roster.length + 1;
    base.recruit = base.recruit || { date: Game.Systems.todayStr(), candidates: [], refreshes: 0 };
    // 隊伍：過濾不存在的 uid
    if (!Array.isArray(base.party)) base.party = [];
    base.party = base.party.filter((uid) => base.roster.some((r) => r.uid === uid));
    if (base.party.length === 0) base.party = [base.roster[0].uid];
    base.version = 3;
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
