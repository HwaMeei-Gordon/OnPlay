/* ============================================================
 * data.js — 全部靜態設定（v2）
 * 世界常數 / 數值縮放 / 稀有度 / 裝備 / 開箱 / 英雄 / 技能 /
 * 訓練 / 才能 / 轉生 / 寵物 / 商店 / 成就 / 每日 / 主題與調色盤
 * 全域命名空間：window.Game.Data
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});

  // ---- 世界 / 渲染 ----
  const WORLD_H = 134;
  const GROUND_FROM_BOTTOM = 30;
  const PARTY_X = 40; // 隊伍最前排 X
  const CONTACT_RANGE = 30;
  const ENEMY_SPEED = 22;
  const APPROACH_SPEED = 120; // 敵人進場接近速度（快速逼近，減少等待）
  const WALK_SPEED = 26;

  // ---- 戰鬥 / 關卡 ----
  const PARTY_MAX = 4; // 出戰上限
  const KILLS_PER_STAGE = 5; // 一般層需擊殺數
  const BOSS_EVERY = 10; // 每 10 層出魔王
  const SEGMENT = 10; // 死亡回到本段起點（10 層一段）

  // 區域：每 100 關一個主題，沿用 THEMES
  function regionOf(stage) {
    return Math.max(0, Math.min(9, Math.floor((stage - 1) / 100)));
  }
  function isBossStage(stage) {
    return stage % BOSS_EVERY === 0;
  }
  function segmentStart(stage) {
    return Math.floor((stage - 1) / SEGMENT) * SEGMENT + 1;
  }
  // 同屏敵人數（後期變多）
  function concurrentEnemies(stage) {
    const r = regionOf(stage);
    return 1 + (r >= 2 ? 1 : 0) + (r >= 5 ? 1 : 0);
  }

  // ---- 難度核心曲線（數值平衡基準）----
  // 每關都有一個「難度倍率」difficultyMult(stage)，敵人所有戰鬥數值都 = 基準 × 此倍率。
  // 錨點（使用者指定，每 100 關一個量級；關卡之間以幾何內插逐級遞增，不是整段持平）：
  //   0→0.3, 100→1, 200→10, 300→50, 400→100, 500→250,
  //   600→750, 700→1000, 800→2500, 900→7500, 1000→20000
  // 設計意圖：0–100 關難度倍率僅 0.3→1，玩家「純靠時間/升級、不碰裝備」即可推進；
  //   之後倍率快速拉開，玩家需靠 裝備升星、傳說/神話裝、湊套裝、輪迴轉生、升級寵物 來補足差距。
  //   未來調整數值平衡，一律以此曲線為核心基準對照。
  const DIFFICULTY_ANCHORS = [
    [0, 0.3], [100, 1], [200, 10], [300, 50], [400, 100], [500, 250],
    [600, 750], [700, 1000], [800, 2500], [900, 7500], [1000, 20000],
  ];
  function difficultyMult(stage) {
    const A = DIFFICULTY_ANCHORS;
    if (stage <= A[0][0]) return A[0][1];
    for (let i = 1; i < A.length; i++) {
      if (stage <= A[i][0]) {
        const s0 = A[i - 1][0], m0 = A[i - 1][1], s1 = A[i][0], m1 = A[i][1];
        // 幾何（指數）內插：在 [s0,s1] 之間逐級遞增，端點對齊錨點
        return m0 * Math.pow(m1 / m0, (stage - s0) / (s1 - s0));
      }
    }
    // 1000 關之後：延續最後一段的每關成長率
    const a = A[A.length - 2], b = A[A.length - 1];
    const rate = Math.pow(b[1] / a[1], 1 / (b[0] - a[0]));
    return b[1] * Math.pow(rate, stage - b[0]);
  }

  // ---- 敵人數值縮放（全部由 difficultyMult 驅動）----
  function makeEnemyStats(stage, isBoss) {
    const dm = difficultyMult(stage);
    const base = {
      // 線性對應難度倍率
      maxHp: Math.max(20, Math.floor(120 * dm)),
      // 攻擊/金幣等用次線性指數，避免後期數字爆炸到難以閱讀
      atk: Math.max(3, Math.floor(11 * Math.pow(dm, 0.72))),
      def: Math.floor(1 * Math.pow(dm, 0.5)),
      gold: Math.max(5, Math.floor(18 * Math.pow(dm, 0.92))),
      xp: Math.max(5, Math.floor(12 * Math.pow(dm, 0.85))),
      gems: 0,
      atkInterval: 1.2,
      hit: Math.floor(15 * Math.pow(dm, 0.35)),
      dodge: Math.floor(5 * Math.pow(dm, 0.3)),
    };
    if (isBoss) {
      base.maxHp = Math.floor(base.maxHp * 4.5);
      base.atk = Math.floor(base.atk * 1.35);
      base.def = Math.floor(base.def * 1.5);
      base.hit = Math.floor(base.hit * 1.4);
      base.dodge = Math.floor(base.dodge * 1.4);
      base.gold = Math.floor(base.gold * 16);
      base.xp = Math.floor(base.xp * 10);
      base.gems = 6 + Math.floor(stage / 3); // 魔王掉鑽石
      base.atkInterval = 1.5;
    }
    return base;
  }

  // ---- 稀有度 ----
  const RARITIES = [
    { id: "common", name: "普通", color: "#9aa0b0", mult: 1.0, weightGold: 70, weightGem: 30 },
    { id: "uncommon", name: "優秀", color: "#5ec46b", mult: 1.5, weightGold: 22, weightGem: 32 },
    { id: "rare", name: "稀有", color: "#4a9fe0", mult: 2.3, weightGold: 6, weightGem: 24 },
    { id: "epic", name: "史詩", color: "#b06ae0", mult: 3.6, weightGold: 1.2, weightGem: 7 },
    { id: "legendary", name: "傳說", color: "#ffb43d", mult: 5.5, weightGold: 0.3, weightGem: 3 },
    { id: "mythic", name: "神話", color: "#ff3b46", mult: 9.0, weightGold: 0, weightGem: 0 },
  ];
  const RARITY_BY_ID = {};
  RARITIES.forEach((r) => (RARITY_BY_ID[r.id] = r));

  // 套裝：身上 4 件以上同稀有度 → 攻擊/生命/防禦 倍率
  const SET_RARITY_MULT = { uncommon: 1.5, rare: 2.0, epic: 3.0, legendary: 5.0, mythic: 10.0 };

  // ---- 升星 ----
  const STAR_MAX = 10;
  // 由「目前星數」升下一星：success 成功率、destroy 失敗後消失機率
  const STAR_RULES = [
    { s: 1.0, d: 0 }, { s: 1.0, d: 0 }, { s: 0.95, d: 0 }, { s: 0.9, d: 0 }, { s: 0.85, d: 0.1 },
    { s: 0.8, d: 0.15 }, { s: 0.75, d: 0.2 }, { s: 0.7, d: 0.33 }, { s: 0.6, d: 0.5 }, { s: 0.45, d: 1.0 },
  ];
  function scrollTierFor(star) { return Math.min(5, star + 1); } // 5 星以上都用 5 星卷
  function starMult(stars) { return 1 + 0.25 * (stars || 0); }   // 每星 +25% 基礎數值
  const SCROLL_COST = { 1: 1500, 2: 6000, 3: 24000, 4: 90000, 5: 320000 }; // 金幣

  // ---- 裝備欄位（每欄主屬性）----
  const EQUIPMENT_SLOTS = [
    { id: "weapon", name: "武器", icon: "sword", stat: "atk", base: 6 },
    { id: "helmet", name: "頭盔", icon: "helmet", stat: "hit", base: 1.5 },
    { id: "armor", name: "鎧甲", icon: "shield", stat: "def", base: 3 },
    { id: "legs", name: "護腿", icon: "legs", stat: "maxHp", base: 22 },
    { id: "boots", name: "靴子", icon: "boots", stat: "dodge", base: 1.2 },
    { id: "trinket", name: "飾品", icon: "ring", stat: "critDmg", base: 0.05 },
  ];
  const SLOT_BY_ID = {};
  EQUIPMENT_SLOTS.forEach((s) => (SLOT_BY_ID[s.id] = s));

  // 裝備數值：base0^(1+星/10) × (1 + 0.10×強化)，強化封頂 500
  function itemStatValue(slot, rarity, tier, enhance, stars) {
    const sl = SLOT_BY_ID[slot];
    const ra = RARITY_BY_ID[rarity];
    const base0 = sl.base * ra.mult * tier;
    const starred = Math.max(base0, Math.pow(base0, 1 + (stars || 0) / 10));
    return starred * (1 + 0.1 * Math.min(enhance || 0, 500));
  }
  const ENHANCE_MAX = 500;
  // 命中 vs 閃避 → 實際閃避機率（飽和曲線，上限 90%）
  const EVADE_K = 120;
  function evadeChance(hit, dodge) {
    const d = Math.max(0, (dodge || 0) - (hit || 0));
    return (0.9 * d) / (d + EVADE_K);
  }
  function itemTierForStage(stage) {
    return 1 + Math.floor(stage / 8);
  }
  function enhanceCost(item) {
    return Math.floor(25 * Math.pow(1.45, item.enhance) * (1 + RARITY_BY_ID[item.rarity].mult));
  }
  // 分解低階裝備回收金幣
  function salvageValue(item) {
    return Math.floor(15 * RARITY_BY_ID[item.rarity].mult * item.tier);
  }

  // ---- 開箱 ----
  const GACHA = {
    gold: { id: "gold", name: "金幣寶箱", cur: "gold", cost: 80, costMul: 1.0, weightKey: "weightGold", icon: "box" },
    gem: { id: "gem", name: "鑽石寶箱", cur: "gems", cost: 30, costMul: 1.0, weightKey: "weightGem", icon: "box" },
  };

  // ---- 英雄 ----
  // base 為 1 級屬性；growth 為每級成長；skills 為可用技能 id
  const HEROES = [
    {
      id: "knight", name: "騎士", cls: "戰士", sprite: "knight", rarity: "common",
      base: { atk: 14, maxHp: 185, def: 4, crit: 0.05, critDmg: 1.6, atkInterval: 0.95, lifesteal: 0, hit: 100, dodge: 12 },
      growth: { atk: 2.4, maxHp: 26, def: 0.7 },
      skills: ["slash", "guard", "rally"],
      starter: true,
    },
    {
      id: "mage", name: "法師", cls: "法師", sprite: "mage", rarity: "uncommon",
      base: { atk: 18, maxHp: 115, def: 2, crit: 0.07, critDmg: 1.8, atkInterval: 1.25, lifesteal: 0, hit: 95, dodge: 12 },
      growth: { atk: 3.6, maxHp: 16, def: 0.4 },
      skills: ["fireball", "frost", "rally"],
    },
    {
      id: "archer", name: "弓手", cls: "弓手", sprite: "archer", rarity: "uncommon",
      base: { atk: 13, maxHp: 125, def: 2, crit: 0.12, critDmg: 1.9, atkInterval: 0.8, lifesteal: 0, hit: 115, dodge: 28 },
      growth: { atk: 2.8, maxHp: 18, def: 0.5 },
      skills: ["multishot", "focus", "guard"],
    },
    {
      id: "priest", name: "牧師", cls: "牧師", sprite: "priest", rarity: "rare",
      base: { atk: 9, maxHp: 150, def: 3, crit: 0.05, critDmg: 1.6, atkInterval: 1.1, lifesteal: 0, hit: 95, dodge: 16 },
      growth: { atk: 1.8, maxHp: 22, def: 0.6 },
      skills: ["heal", "bless", "guard"],
    },
    {
      id: "rogue", name: "盜賊", cls: "盜賊", sprite: "rogue", rarity: "rare",
      base: { atk: 14, maxHp: 120, def: 2, crit: 0.15, critDmg: 2.1, atkInterval: 0.7, lifesteal: 0.06, hit: 110, dodge: 45 },
      growth: { atk: 3.0, maxHp: 17, def: 0.4 },
      skills: ["backstab", "focus", "rage"],
    },
    {
      id: "berserker", name: "狂戰士", cls: "狂戰", sprite: "berserker", rarity: "epic",
      base: { atk: 20, maxHp: 160, def: 2, crit: 0.1, critDmg: 2.0, atkInterval: 0.95, lifesteal: 0.05, hit: 100, dodge: 12 },
      growth: { atk: 4.0, maxHp: 24, def: 0.5 },
      skills: ["rage", "slash", "rally"],
    },
  ];
  const HERO_BY_ID = {};
  HEROES.forEach((h) => (HERO_BY_ID[h.id] = h));

  function xpForLevel(level) {
    return Math.floor(22 * Math.pow(1.38, level - 1));
  }
  function heroLevelCost(level) {
    return Math.floor(12 * Math.pow(1.20, level - 1));
  }

  // ---- 英雄技能（被動 passive / 主動 active）----
  const HERO_SKILLS = {
    slash: { name: "斬擊", icon: "dagger", type: "active", cooldown: 4, maxLevel: 20,
      desc: "對前方敵人造成額外傷害", cost: (l) => Math.floor(40 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.2 + 0.3 * l).toFixed(1)} 傷害` },
    fireball: { name: "火球術", icon: "burst", type: "active", cooldown: 5, maxLevel: 20,
      desc: "範圍火焰傷害", cost: (l) => Math.floor(45 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.5 + 0.4 * l).toFixed(1)} 傷害` },
    frost: { name: "冰霜新星", icon: "snow", type: "active", cooldown: 7, maxLevel: 20,
      desc: "凍結並重擊", cost: (l) => Math.floor(50 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.8 + 0.5 * l).toFixed(1)} 傷害` },
    multishot: { name: "多重射擊", icon: "bow", type: "active", cooldown: 5, maxLevel: 20,
      desc: "連射多箭", cost: (l) => Math.floor(45 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.0 + 0.25 * l).toFixed(2)} ×3` },
    backstab: { name: "背刺", icon: "dagger", type: "active", cooldown: 4, maxLevel: 20,
      desc: "高暴擊一擊", cost: (l) => Math.floor(48 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(2.0 + 0.5 * l).toFixed(1)} 必暴` },
    heal: { name: "治癒術", icon: "heal", type: "active", cooldown: 8, maxLevel: 20,
      desc: "回復全隊生命", cost: (l) => Math.floor(50 * Math.pow(1.5, l)),
      effectText: (l) => `全隊回復 ${Math.round((0.08 + 0.02 * l) * 100)}% 生命` },
    rage: { name: "狂暴", icon: "angry", type: "active", cooldown: 12, duration: 4, maxLevel: 20,
      desc: "短時間提升攻擊", cost: (l) => Math.floor(55 * Math.pow(1.5, l)),
      effectText: (l) => `4 秒 攻擊 +${50 + 10 * l}%` },
    // 被動
    guard: { name: "堅守", icon: "shield", type: "passive", maxLevel: 20,
      desc: "提升生命與防禦", cost: (l) => Math.floor(35 * Math.pow(1.5, l)),
      effectText: (l) => `生命 +${l * 4}%、防禦 +${l * 5}%` },
    focus: { name: "專注", icon: "target", type: "passive", maxLevel: 20,
      desc: "提升暴擊與暴傷", cost: (l) => Math.floor(38 * Math.pow(1.5, l)),
      effectText: (l) => `暴擊 +${l * 2}%、暴傷 +${l * 5}%` },
    rally: { name: "鼓舞", icon: "flag", type: "passive", maxLevel: 20,
      desc: "提升攻擊", cost: (l) => Math.floor(36 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊 +${l * 4}%` },
    bless: { name: "祝福", icon: "bolt", type: "passive", maxLevel: 20,
      desc: "提升攻速與閃避", cost: (l) => Math.floor(40 * Math.pow(1.5, l)),
      effectText: (l) => `攻速 +${l * 2}%、閃避 +${l * 2}` },
  };

  // ---- 屬性訓練（全域，用金幣）----
  const TRAININGS = [
    { id: "atk", name: "攻擊訓練", icon: "sword", mod: "atkMul", per: 0.025, base: 30, mul: 1.15, unit: "%" },
    { id: "hp", name: "生命訓練", icon: "heart", mod: "hpMul", per: 0.025, base: 30, mul: 1.15, unit: "%" },
    { id: "def", name: "防禦訓練", icon: "shield", mod: "defMul", per: 0.03, base: 30, mul: 1.15, unit: "%" },
    { id: "crit", name: "暴擊訓練", icon: "target", mod: "critAdd", per: 0.004, base: 80, mul: 1.2, unit: "%", scale: 100 },
    { id: "critDmg", name: "暴傷訓練", icon: "burst", mod: "critDmgAdd", per: 0.04, base: 80, mul: 1.2, unit: "%" },
    { id: "spd", name: "攻速訓練", icon: "bolt", mod: "atkSpeedMul", per: 0.012, base: 100, mul: 1.22, unit: "%", cap: 0.6 },
    { id: "ls", name: "吸血訓練", icon: "drop", mod: "lifestealAdd", per: 0.004, base: 120, mul: 1.22, unit: "%", scale: 100 },
    { id: "dodge", name: "閃避訓練", icon: "boots", mod: "dodgeAdd", per: 8, base: 120, mul: 1.22, unit: "", rating: true },
    { id: "hit", name: "命中訓練", icon: "target", mod: "hitAdd", per: 8, base: 100, mul: 1.2, unit: "", rating: true },
    { id: "gold", name: "尋金術", icon: "coin", mod: "goldMul", per: 0.03, base: 60, mul: 1.18, unit: "%" },
    { id: "xp", name: "財富加成", icon: "coin", mod: "goldMul", per: 0.03, base: 60, mul: 1.18, unit: "%" },
  ];

  // ---- 才能天賦（用才能點）----
  const TALENTS = [
    { id: "might", name: "力量", icon: "sword", mod: "atkMul", per: 0.03, max: 50, desc: "攻擊" },
    { id: "vigor", name: "活力", icon: "heart", mod: "hpMul", per: 0.03, max: 50, desc: "生命" },
    { id: "fortune", name: "幸運", icon: "coin", mod: "goldMul", per: 0.04, max: 50, desc: "金幣" },
    { id: "precision", name: "精準", icon: "target", mod: "critAdd", per: 0.005, max: 40, desc: "暴擊" },
    { id: "ferocity", name: "兇猛", icon: "burst", mod: "critDmgAdd", per: 0.05, max: 40, desc: "暴傷" },
    { id: "wisdom", name: "貪婪", icon: "coin", mod: "goldMul", per: 0.04, max: 50, desc: "金幣" },
  ];

  // ---- 轉生天賦（用靈魂，永久全域倍率）----
  const PRESTIGE = {
    soulFormula: (best) => Math.floor(Math.pow(Math.max(0, best - 5), 0.8)),
    minStage: 30, // 達此層才能轉生
    nodes: [
      { id: "p_atk", name: "靈魂之力", icon: "sword", mod: "atkMul", per: 0.1, max: 100, cost: (l) => l + 1 },
      { id: "p_hp", name: "靈魂之軀", icon: "heart", mod: "hpMul", per: 0.1, max: 100, cost: (l) => l + 1 },
      { id: "p_gold", name: "靈魂財富", icon: "coin", mod: "goldMul", per: 0.15, max: 100, cost: (l) => l + 1 },
      { id: "p_drop", name: "靈魂掉寶", icon: "box", mod: "gemMul", per: 0.1, max: 50, cost: (l) => 2 * (l + 1) },
    ],
  };

  // ---- 寵物 ----
  const PETS = [
    { id: "slime", name: "史萊姆", icon: "paw", sprite: "p_slime", rarity: "common", mod: "goldMul", per: 0.03 },
    { id: "wolf", name: "幼狼", icon: "paw", sprite: "p_wolf", rarity: "uncommon", mod: "atkMul", per: 0.03 },
    { id: "owl", name: "貓頭鷹", icon: "paw", sprite: "p_owl", rarity: "rare", mod: "goldMul", per: 0.04 },
    { id: "drake", name: "幼龍", icon: "paw", sprite: "p_drake", rarity: "epic", mod: "atkMul", per: 0.05 },
  ];
  const PET_BY_ID = {};
  PETS.forEach((p) => (PET_BY_ID[p.id] = p));
  function petUpgradeCost(level) {
    return Math.floor(200 * Math.pow(1.4, level));
  }

  // ---- 商店 ----
  const SHOP = [
    { id: "box_gold", name: "金幣寶箱", icon: "box", cur: "gold", cost: 150, give: { box: "gold" }, daily: false },
    { id: "box_gem", name: "鑽石寶箱", icon: "box", cur: "gems", cost: 30, give: { box: "gem" }, daily: false },
    { id: "buy_hero_mage", name: "招募：法師", icon: "staff", cur: "gems", cost: 50, give: { hero: "mage" }, once: true },
    { id: "buy_hero_archer", name: "招募：弓手", icon: "bow", cur: "gems", cost: 90, give: { hero: "archer" }, once: true },
    { id: "buy_hero_priest", name: "招募：牧師", icon: "plus", cur: "gems", cost: 180, give: { hero: "priest" }, once: true },
    { id: "buy_hero_rogue", name: "招募：盜賊", icon: "dagger", cur: "gems", cost: 260, give: { hero: "rogue" }, once: true },
    { id: "buy_hero_zerk", name: "招募：狂戰士", icon: "axe", cur: "gems", cost: 380, give: { hero: "berserker" }, once: true },
    { id: "buy_pet_wolf", name: "寵物：幼狼", icon: "paw", cur: "gems", cost: 300, give: { pet: "wolf" }, once: true },
    { id: "buy_pet_owl", name: "寵物：貓頭鷹", icon: "paw", cur: "gems", cost: 600, give: { pet: "owl" }, once: true },
    { id: "buy_pet_drake", name: "寵物：幼龍", icon: "paw", cur: "gems", cost: 1200, give: { pet: "drake" }, once: true },
    // 每日特惠
    { id: "daily_gold", name: "每日金幣包", icon: "coin", cur: "gems", cost: 10, give: { gold: 2000 }, daily: true, limit: 3 },
    { id: "daily_gem", name: "每日鑽石（看廣告免費）", icon: "gem", cur: "gold", cost: 0, give: { gems: 15 }, daily: true, limit: 2 },
  ];

  // ---- 成就 ----
  const ACHIEVEMENTS = [
    { id: "kill100", name: "初試身手", icon: "sword", stat: "totalKills", goal: 100, reward: { gems: 20 } },
    { id: "kill1000", name: "百戰之勇", icon: "sword", stat: "totalKills", goal: 1000, reward: { gems: 50 } },
    { id: "kill10000", name: "千軍辟易", icon: "sword", stat: "totalKills", goal: 10000, reward: { gems: 120 } },
    { id: "boss10", name: "屠魔者", icon: "skull", stat: "bossKills", goal: 10, reward: { gems: 40 } },
    { id: "boss50", name: "魔王剋星", icon: "skull", stat: "bossKills", goal: 50, reward: { gems: 100 } },
    { id: "box50", name: "開箱新手", icon: "box", stat: "boxesOpened", goal: 50, reward: { gems: 30 } },
    { id: "box500", name: "開箱狂人", icon: "box", stat: "boxesOpened", goal: 500, reward: { gems: 150 } },
    { id: "stage50", name: "深入險境", icon: "flag", stat: "bestStage", goal: 50, reward: { gems: 50 } },
    { id: "stage200", name: "勢如破竹", icon: "flag", stat: "bestStage", goal: 200, reward: { gems: 150 } },
    { id: "prestige1", name: "輪迴", icon: "soul", stat: "prestiges", goal: 1, reward: { gems: 100 } },
  ];

  // ---- 每日任務 ----
  const DAILY_QUESTS = [
    { id: "d_kill", name: "擊殺 200 敵人", stat: "killsToday", goal: 200, reward: { gold: 1500 } },
    { id: "d_box", name: "開箱 10 次", stat: "boxesToday", goal: 10, reward: { gems: 20 } },
    { id: "d_boss", name: "擊敗 3 隻魔王", stat: "bossToday", goal: 3, reward: { gems: 25 } },
  ];

  // ---- 調色盤（含 v1 與英雄/寵物擴充）----
  const PALETTE = {
    K: "#1a1228", W: "#f4f4f4", e: "#222034",
    s: "#ffcc99", H: "#e0a060", h: "#7a4b2b", b: "#3b6fb0", p: "#2a4d7a",
    g: "#c0c0c8", y: "#ffd23f",
    G: "#5ec46b", D: "#2f8f3f", o: "#8fbf4f", O: "#5f8f2f",
    v: "#6b4b8a", V: "#3f2b55", r: "#c0392b", R: "#7a1f15", f: "#ff7a3d",
    q: "#ff3b3b", 1: "#3a2748", 2: "#6e4f8a", m: "#5a3a22", t: "#3f7a3a",
    n: "#cda05a", N: "#9a6f33", u: "#d8c8a0", U: "#aa9870",
    i: "#e6f1fb", I: "#9fc4e6", Y: "#ffe45a", c: "#37a8b8", C: "#1c6e7e",
    j: "#ef82b0", J: "#b24a78", 5: "#9a9aae", 6: "#5e5e72",
    w: "#dfe4ee", l: "#ffaa3d", 7: "#241433", 8: "#4a2f5a", a: "#efe7d6", z: "#bfe24a",
    // 敵人陰影/高光擴充
    S: "#aef0a8", T: "#c7cede", Z: "#3b4250", 9: "#1f6e2c", 0: "#7a8aa0",
    // 英雄擴充
    P: "#9b59d0", // 法師紫袍
    Q: "#6b3fa0", // 法師深袍
    A: "#3aa856", // 弓手綠
    E: "#2a7d3e", // 弓手深綠
    F: "#f0f0f0", // 牧師白袍
    L: "#d8d8e8", // 牧師袍影
    x: "#c43a3a", // 狂戰紅
    X: "#8a2020", // 狂戰深紅
    k: "#2a2a33", // 盜賊暗
    d: "#4a4a55", // 盜賊灰
  };

  // ---- 關卡主題（4 層景深：sky / horizon / mid / ground+deco）----
  const THEMES = [
    { name: "草原", sky: ["#5a7fa8", "#6f93b6", "#8aabc8", "#a9c6dc"], horizon: "#4a6a6e",
      far: "hills", farColor: "#4f7350", farColor2: "#3f5f44",
      ground: "#6e4a2c", groundTop: "#835836", groundLine: "#7aa852", tile: "#4d3219",
      deco: "grass", decoColor: "#7aa852" },
    { name: "森林", sky: ["#1f2e44", "#2e4a52", "#3a6b54", "#4d8060"], horizon: "#163a30",
      far: "trees", farColor: "#1f4a32", farColor2: "#163a26",
      ground: "#3f3320", groundTop: "#4f4028", groundLine: "#6a9a3a", tile: "#2c2416",
      deco: "bush", decoColor: "#3f7a3a" },
    { name: "沙漠", sky: ["#e0a85a", "#eec06a", "#f5d488", "#f7e6ac"], horizon: "#caa056",
      far: "dunes", farColor: "#d6a85a", farColor2: "#c2934a",
      ground: "#e0c074", groundTop: "#ecd089", groundLine: "#f4e2a8", tile: "#c6a458",
      deco: "cactus", decoColor: "#5a8f4a" },
    { name: "雪地", sky: ["#7a90b0", "#94a8c4", "#b0c2d8", "#d2ddec"], horizon: "#8ea4be",
      far: "peaks", farColor: "#9fb2c8", farColor2: "#7e94b0",
      ground: "#dfe8f2", groundTop: "#eef4fb", groundLine: "#ffffff", tile: "#bccde0",
      deco: "snowtree", decoColor: "#2f5a52" },
    { name: "熔岩山", sky: ["#2a1014", "#4a161a", "#6e1f1a", "#9a3418"], horizon: "#5a1a12",
      far: "volcano", farColor: "#3a1410", farColor2: "#5a1a12",
      ground: "#2a1a18", groundTop: "#3a221c", groundLine: "#ff5a2a", tile: "#180c0a",
      deco: "lavarock", decoColor: "#ff7a3d" },
    { name: "深海", sky: ["#0a2a4a", "#0e3a5a", "#125a78", "#1c84a0"], horizon: "#0e4a60",
      far: "seaweed", farColor: "#1a6a5a", farColor2: "#125247",
      ground: "#155a6a", groundTop: "#1a7080", groundLine: "#3aa0b0", tile: "#0d4651",
      deco: "coral", decoColor: "#d06a8a" },
    { name: "天空之城", sky: ["#5aa0e0", "#7ab8ec", "#9fd0f4", "#cce8fc"], horizon: "#a9d4f0",
      far: "skycity", farColor: "#dcedfb", farColor2: "#b6d4ee",
      ground: "#cfe4f5", groundTop: "#ffffff", groundLine: "#ffffff", tile: "#aecdea",
      deco: "smallcloud", decoColor: "#ffffff" },
    { name: "遺跡", sky: ["#523a5a", "#7a4a52", "#a86a4a", "#d6a258"], horizon: "#6a4a44",
      far: "pillars", farColor: "#6a5a4a", farColor2: "#4a3e34",
      ground: "#7a6a52", groundTop: "#8a7a5e", groundLine: "#a89a72", tile: "#5c4e3e",
      deco: "rubble", decoColor: "#9a8a6a" },
    { name: "魔王城", sky: ["#160c26", "#26143a", "#361c46", "#46284e"], horizon: "#241638",
      far: "battlements", farColor: "#2a1a3a", farColor2: "#1a1028",
      ground: "#2e2438", groundTop: "#3a2e48", groundLine: "#6a3a8a", tile: "#1c1626",
      deco: "torch", decoColor: "#ff8a3d" },
    { name: "魔王城深層", sky: ["#0a0410", "#1a0810", "#2a0a12", "#400e14"], horizon: "#240a0c",
      far: "abyss", farColor: "#3a0e10", farColor2: "#240a0c",
      ground: "#180a12", groundTop: "#26101a", groundLine: "#ff2a3a", tile: "#0c060a",
      deco: "ember", decoColor: "#ff5a3a" },
  ];
  function getTheme(stage) {
    return THEMES[regionOf(stage)];
  }

  Game.Data = {
    WORLD_H, GROUND_FROM_BOTTOM, PARTY_X, CONTACT_RANGE, ENEMY_SPEED, APPROACH_SPEED, WALK_SPEED,
    PARTY_MAX, KILLS_PER_STAGE, BOSS_EVERY, SEGMENT,
    regionOf, isBossStage, segmentStart, concurrentEnemies, makeEnemyStats,
    DIFFICULTY_ANCHORS, difficultyMult,
    RARITIES, RARITY_BY_ID, SET_RARITY_MULT, STAR_MAX, STAR_RULES, scrollTierFor, starMult, SCROLL_COST,
    ENHANCE_MAX, EVADE_K, evadeChance,
    EQUIPMENT_SLOTS, SLOT_BY_ID, itemStatValue, itemTierForStage, enhanceCost, salvageValue,
    GACHA,
    HEROES, HERO_BY_ID, xpForLevel, heroLevelCost,
    HERO_SKILLS, TRAININGS, TALENTS, PRESTIGE,
    PETS, PET_BY_ID, petUpgradeCost,
    SHOP, ACHIEVEMENTS, DAILY_QUESTS,
    PALETTE, THEMES, getTheme,
    OFFLINE_CAP_SECONDS: 8 * 3600,
  };
})();
