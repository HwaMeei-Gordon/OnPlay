/* ============================================================
 * data.js — 遊戲常數、數值縮放、裝備/技能定義、像素點陣圖
 * 全域命名空間：window.Game.Data
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});

  // ---- 世界 / 渲染常數 ----
  const WORLD_H = 144; // 內部世界高度（像素），寬度依螢幕比例動態計算
  const GROUND_FROM_BOTTOM = 30; // 地面距底部高度
  const HERO_X = 40; // 勇者固定世界 X 座標
  const CONTACT_RANGE = 26; // 進入攻擊的距離
  const ENEMY_SPEED = 22; // 敵人接近速度（世界像素/秒）
  const HERO_WALK_SPEED = 26; // 沒有敵人時勇者前進的視覺速度（背景捲動）

  // ---- 關卡設定 ----
  const ENEMIES_PER_STAGE = 8; // 每關小怪數量，之後出現魔王

  // ---- 勇者基礎屬性（1 級）----
  const HERO_BASE = {
    maxHp: 100,
    atk: 10,
    def: 2,
    atkInterval: 1.0, // 秒
    crit: 0.05, // 暴擊率
    critMult: 2.0, // 暴擊倍率
  };
  // 每升一級的成長
  const HERO_GROWTH = { maxHp: 22, atk: 2.2, def: 0.6 };

  // 升到下一級所需經驗
  function xpForLevel(level) {
    return Math.floor(20 * Math.pow(1.4, level - 1));
  }

  // ---- 敵人數值縮放（依關卡 stage）----
  function makeEnemyStats(stage, isBoss) {
    const s = stage;
    const base = {
      maxHp: Math.floor(30 * Math.pow(1.26, s - 1)),
      atk: Math.floor(6 * Math.pow(1.21, s - 1)),
      def: Math.floor(1 * Math.pow(1.12, s - 1)),
      gold: Math.floor(5 * Math.pow(1.18, s - 1)),
      xp: Math.floor(8 * Math.pow(1.16, s - 1)),
      atkInterval: 1.2,
    };
    if (isBoss) {
      base.maxHp = Math.floor(base.maxHp * 6.5);
      base.atk = Math.floor(base.atk * 1.7);
      base.def = Math.floor(base.def * 1.4);
      base.gold = Math.floor(base.gold * 12);
      base.xp = Math.floor(base.xp * 9);
      base.atkInterval = 1.5;
    }
    return base;
  }

  // ---- 裝備定義（升級等級模型）----
  // 回傳「等級 lvl 時的加成」與「從 lvl 升到 lvl+1 的費用」
  const EQUIPMENT = {
    weapon: {
      name: "武器",
      icon: "⚔️",
      desc: "提升攻擊力",
      bonus: (lvl) => ({ atk: lvl * 3 }),
      cost: (lvl) => Math.floor(12 * Math.pow(1.55, lvl)),
      bonusText: (lvl) => `攻擊 +${lvl * 3}`,
    },
    armor: {
      name: "防具",
      icon: "🛡️",
      desc: "提升生命與防禦",
      bonus: (lvl) => ({ maxHp: lvl * 12, def: lvl * 1 }),
      cost: (lvl) => Math.floor(14 * Math.pow(1.55, lvl)),
      bonusText: (lvl) => `生命 +${lvl * 12}、防禦 +${lvl}`,
    },
    accessory: {
      name: "飾品",
      icon: "💍",
      desc: "提升暴擊與攻速",
      bonus: (lvl) => ({
        crit: lvl * 0.01,
        atkInterval: -Math.min(0.4, lvl * 0.02),
      }),
      cost: (lvl) => Math.floor(20 * Math.pow(1.6, lvl)),
      bonusText: (lvl) =>
        `暴擊 +${lvl}%、攻速 +${Math.round(Math.min(0.4, lvl * 0.02) * 100)}%`,
    },
  };
  const EQUIPMENT_ORDER = ["weapon", "armor", "accessory"];

  // ---- 技能定義 ----
  // 被動：恆常加成；主動：冷卻到自動施放
  const SKILLS = {
    vit: {
      name: "強健體魄",
      icon: "❤️",
      type: "passive",
      desc: "提升最大生命",
      maxLevel: 20,
      cost: (lvl) => Math.floor(30 * Math.pow(1.5, lvl)),
      effectText: (lvl) => `最大生命 +${lvl * 5}%`,
    },
    critUp: {
      name: "精準打擊",
      icon: "🎯",
      type: "passive",
      desc: "提升暴擊率",
      maxLevel: 20,
      cost: (lvl) => Math.floor(35 * Math.pow(1.5, lvl)),
      effectText: (lvl) => `暴擊率 +${lvl * 2}%`,
    },
    fireball: {
      name: "火球術",
      icon: "🔥",
      type: "active",
      desc: "冷卻時自動釋放，造成額外傷害",
      maxLevel: 20,
      cooldown: 5,
      cost: (lvl) => Math.floor(40 * Math.pow(1.5, lvl)),
      effectText: (lvl) =>
        `每 5 秒造成 攻擊×${(1 + 0.5 * lvl).toFixed(1)} 傷害`,
    },
    heal: {
      name: "治癒術",
      icon: "✨",
      type: "active",
      desc: "冷卻時自動回復生命",
      maxLevel: 20,
      cooldown: 8,
      cost: (lvl) => Math.floor(45 * Math.pow(1.5, lvl)),
      effectText: (lvl) =>
        `每 8 秒回復 最大生命 ${Math.round((0.08 + 0.025 * lvl) * 100)}%`,
    },
    rage: {
      name: "狂暴",
      icon: "💢",
      type: "active",
      desc: "冷卻時自動進入狂暴，短時間提升攻擊",
      maxLevel: 20,
      cooldown: 12,
      duration: 4,
      cost: (lvl) => Math.floor(50 * Math.pow(1.5, lvl)),
      effectText: (lvl) => `4 秒內 攻擊 +${50 + 10 * lvl}%`,
    },
  };
  const SKILL_ORDER = ["vit", "critUp", "fireball", "heal", "rage"];

  // ---- 像素點陣圖 ----
  // 每個字元代表調色盤中的顏色，'.' 為透明。draw 時 1 格 = 1 世界像素。
  const PALETTE = {
    // 共用
    K: "#1a1228", // 深色輪廓
    W: "#f4f4f4", // 白
    e: "#222034", // 眼睛/深
    // 勇者
    s: "#ffcc99", // 膚色
    h: "#7a4b2b", // 頭髮
    b: "#3b6fb0", // 衣服藍
    p: "#2a4d7a", // 衣服深藍
    g: "#c0c0c8", // 劍/金屬
    y: "#ffd23f", // 金/裝飾
    // 史萊姆
    G: "#5ec46b",
    D: "#2f8f3f",
    // 哥布林
    o: "#8fbf4f",
    O: "#5f8f2f",
    // 蝙蝠
    v: "#6b4b8a",
    V: "#3f2b55",
    // 魔王
    r: "#c0392b",
    R: "#7a1f15",
    f: "#ff7a3d",
    // ---- 地區敵人擴充色 ----
    q: "#ff3b3b", // 紅眼
    1: "#3a2748", // 蜘蛛暗
    2: "#6e4f8a", // 蜘蛛紫
    m: "#5a3a22", // 樹幹棕
    t: "#3f7a3a", // 樹葉綠
    n: "#cda05a", // 沙
    N: "#9a6f33", // 深沙
    u: "#d8c8a0", // 繃帶
    U: "#aa9870", // 繃帶影
    i: "#e6f1fb", // 冰白
    I: "#9fc4e6", // 冰藍
    Y: "#ffe45a", // 亮黃
    c: "#37a8b8", // 青
    C: "#1c6e7e", // 深青
    j: "#ef82b0", // 粉
    J: "#b24a78", // 深粉
    5: "#9a9aae", // 灰
    6: "#5e5e72", // 深灰
    w: "#dfe4ee", // 羽白
    l: "#ffaa3d", // 喙橙
    7: "#241433", // 暗影
    8: "#4a2f5a", // 暗影亮
    a: "#efe7d6", // 骨/角
    z: "#bfe24a", // 毒綠
  };

  // 勇者（面向右），14x16
  const SPRITE_HERO = [
    "....hhhh......",
    "...hhhhhh.....",
    "..hsssssh.....",
    "..hsesesh.....",
    "..hssssshg....",
    "...sssss.gg...",
    "..bbbbbb..g...",
    ".bpbbbbpb.g...",
    ".bpbbbbpb.g...",
    ".bbbbbbbb.....",
    "..bb..bb......",
    "..ss..ss......",
    "..ss..ss......",
    "..KK..KK......",
    ".KKK..KKK.....",
    "..............",
  ];
  // 勇者走路第二影格（腳交換）
  const SPRITE_HERO2 = [
    "....hhhh......",
    "...hhhhhh.....",
    "..hsssssh.....",
    "..hsesesh.....",
    "..hssssshg....",
    "...sssss.gg...",
    "..bbbbbb..g...",
    ".bpbbbbpb.g...",
    ".bpbbbbpb.g...",
    ".bbbbbbbb.....",
    "...bb.bb......",
    "...ss.ss......",
    "..ss...ss.....",
    "..KK...KK.....",
    ".KKK...KKK....",
    "..............",
  ];

  // 史萊姆 12x10
  const SPRITE_SLIME = [
    "............",
    "...GGGGGG...",
    "..GGGGGGGG..",
    ".GGGGGGGGGG.",
    ".GGWGGGGWGG.",
    ".GGeGGGGeGG.",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "DDDDDDDDDDDD",
    "............",
  ];
  // 哥布林 12x14
  const SPRITE_GOBLIN = [
    "....oooo....",
    "...oooooo...",
    "..ooWooWoo..",
    "..ooeooeoo..",
    "..oooooooo..",
    "...oOOOo....",
    "..ooooooo...",
    ".oOoooooOo..",
    ".oOoooooOo..",
    "..ooooooo...",
    "..oo..oo....",
    "..OO..OO....",
    ".OOO..OOO...",
    "............",
  ];
  // 蝙蝠 16x10
  const SPRITE_BAT = [
    "................",
    ".VV..........VV.",
    "VVVV..vvvv..VVVV",
    "VVVVvvvvvvvvVVVV",
    ".VVvvWvvvvWvvVV.",
    "..vvveVVeevvv...",
    "...vvvvvvvvv....",
    "....vv..vv......",
    "................",
    "................",
  ];
  // 魔王 22x22（較大）
  const SPRITE_BOSS = [
    "..R................R..",
    "..RR..............RR..",
    "..RRR....rrrr....RRR..",
    "...RRR..rrrrrr..RRR...",
    "....rrrrrrrrrrrrrr....",
    "...rrrWrrrrrrWrrrrr...",
    "...rrreRrrrrReRrrrr...",
    "...rrrrrrffrrrrrrrr...",
    "...rrrrrffffrrrrrrr...",
    "...RrrrrffffrrrrrrR...",
    "...RrrrrrrrrrrrrrrR...",
    "...RRrrrWWWWWWrrrRR...",
    "....RRrrrrrrrrrrRR....",
    "....rrrrrrrrrrrrrr....",
    "...rrrrrrrrrrrrrrrr...",
    "..rrrrrrrrrrrrrrrrrr..",
    "..rrrr..rrrr..rrrr....",
    "..RRRR..RRRR..RRRR....",
    ".RRRR...RRRR...RRRR...",
    ".....................",
    ".....................",
    ".....................",
  ];

  // 小怪依關卡循環選擇
  const ENEMY_SPRITES = [SPRITE_SLIME, SPRITE_GOBLIN, SPRITE_BAT];

  // ---- 關卡主題（每 100 關一個，共 10 個 / 1000 關）----
  // far：遠景剪影類型；deco：近景小裝飾類型（隨地面捲動）
  const THEMES = [
    {
      name: "草原",
      sky: ["#3a6db5", "#4f86c6", "#6fa3d6", "#9cc4e4"],
      far: "hills", farColor: "#3f7a4a", farColor2: "#356b40",
      ground: "#5a8a3a", groundTop: "#6fa84a", groundLine: "#8fd05a", tile: "#46702e",
      deco: "grass", decoColor: "#7ec24a",
    },
    {
      name: "森林",
      sky: ["#1f2e44", "#2e4a52", "#3a6b54", "#4d8060"],
      far: "trees", farColor: "#1f4a32", farColor2: "#163a26",
      ground: "#3a5a2a", groundTop: "#4a6a32", groundLine: "#6a9a3a", tile: "#2c4420",
      deco: "bush", decoColor: "#3f7a3a",
    },
    {
      name: "沙漠",
      sky: ["#e0a85a", "#eec06a", "#f5d488", "#f7e6ac"],
      far: "dunes", farColor: "#d6a85a", farColor2: "#c2934a",
      ground: "#e0c074", groundTop: "#ecd089", groundLine: "#f4e2a8", tile: "#c6a458",
      deco: "cactus", decoColor: "#5a8f4a",
    },
    {
      name: "雪地",
      sky: ["#7a90b0", "#94a8c4", "#b0c2d8", "#d2ddec"],
      far: "peaks", farColor: "#9fb2c8", farColor2: "#7e94b0",
      ground: "#dfe8f2", groundTop: "#eef4fb", groundLine: "#ffffff", tile: "#bccde0",
      deco: "snowtree", decoColor: "#2f5a52",
    },
    {
      name: "熔岩山",
      sky: ["#2a1014", "#4a161a", "#6e1f1a", "#9a3418"],
      far: "volcano", farColor: "#3a1410", farColor2: "#5a1a12",
      ground: "#2a1a18", groundTop: "#3a221c", groundLine: "#ff5a2a", tile: "#180c0a",
      deco: "lavarock", decoColor: "#ff7a3d",
    },
    {
      name: "深海",
      sky: ["#0a2a4a", "#0e3a5a", "#125a78", "#1c84a0"],
      far: "seaweed", farColor: "#1a6a5a", farColor2: "#125247",
      ground: "#155a6a", groundTop: "#1a7080", groundLine: "#3aa0b0", tile: "#0d4651",
      deco: "coral", decoColor: "#d06a8a",
    },
    {
      name: "天空之城",
      sky: ["#5aa0e0", "#7ab8ec", "#9fd0f4", "#cce8fc"],
      far: "skycity", farColor: "#dcedfb", farColor2: "#b6d4ee",
      ground: "#cfe4f5", groundTop: "#ffffff", groundLine: "#ffffff", tile: "#aecdea",
      deco: "smallcloud", decoColor: "#ffffff",
    },
    {
      name: "遺跡",
      sky: ["#523a5a", "#7a4a52", "#a86a4a", "#d6a258"],
      far: "pillars", farColor: "#6a5a4a", farColor2: "#4a3e34",
      ground: "#7a6a52", groundTop: "#8a7a5e", groundLine: "#a89a72", tile: "#5c4e3e",
      deco: "rubble", decoColor: "#9a8a6a",
    },
    {
      name: "魔王城",
      sky: ["#160c26", "#26143a", "#361c46", "#46284e"],
      far: "battlements", farColor: "#2a1a3a", farColor2: "#1a1028",
      ground: "#2e2438", groundTop: "#3a2e48", groundLine: "#6a3a8a", tile: "#1c1626",
      deco: "torch", decoColor: "#ff8a3d",
    },
    {
      name: "魔王城深層",
      sky: ["#0a0410", "#1a0810", "#2a0a12", "#400e14"],
      far: "abyss", farColor: "#3a0e10", farColor2: "#240a0c",
      ground: "#180a12", groundTop: "#26101a", groundLine: "#ff2a3a", tile: "#0c060a",
      deco: "ember", decoColor: "#ff5a3a",
    },
  ];

  // 依關卡取得主題（1-100→0, 101-200→1 …，超過 1000 沿用最後一個）
  function getTheme(stage) {
    const idx = Math.max(0, Math.min(THEMES.length - 1, Math.floor((stage - 1) / 100)));
    return THEMES[idx];
  }

  Game.Data = {
    WORLD_H,
    GROUND_FROM_BOTTOM,
    HERO_X,
    CONTACT_RANGE,
    ENEMY_SPEED,
    HERO_WALK_SPEED,
    ENEMIES_PER_STAGE,
    HERO_BASE,
    HERO_GROWTH,
    xpForLevel,
    makeEnemyStats,
    EQUIPMENT,
    EQUIPMENT_ORDER,
    SKILLS,
    SKILL_ORDER,
    PALETTE,
    SPRITE_HERO,
    SPRITE_HERO2,
    SPRITE_BOSS,
    ENEMY_SPRITES,
    THEMES,
    getTheme,
    OFFLINE_CAP_SECONDS: 8 * 3600, // 離線收益上限 8 小時
  };
})();
