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
  const CONTACT_RANGE = 32; // 對齊 16px 網格（contactX=72）
  const ENEMY_SPEED = 22;
  const APPROACH_SPEED = 120; // 敵人進場接近速度（快速逼近，減少等待）
  const WALK_SPEED = 26;
  // ---- 三線戰場（上/中/下行）＋ 英雄 3×3 陣型 ----
  const LANES = 3;
  const LANE_DY = [2, 12, 22];      // 各行相對 ground 的 y 偏移（全部落在草地道路上）
  const FORM_COL_GAP = 16;          // 英雄每排 x 間距（=ENEMY_GAP，對齊網格；col0=前排最靠敵）
  const ENEMY_GAP = 16;             // 同行敵人排隊間距
  const SPAWN_INTERVAL = 0.65;      // 每隻天降間隔
  const MAX_CONCURRENT = 9;         // 同屏最多敵人
  const ENEMY_DROP_H = 34;          // 天降高度
  const DROP_GRAVITY = 240;         // 天降下落加速度
  function laneY(ground, lane) { return ground + (LANE_DY[lane] || 0); }
  // ---- 戰鬥流程（行軍→戰鬥→勝利/失敗）----
  const MARCH_TIME = 10;        // 關卡間行軍秒數（背景捲動、無敵人）
  const VICTORY_TIME = 1.4;     // 勝利字樣＋英雄回左
  const DEFEAT_TIME = 1.2;      // 失敗字樣
  const MEET_FRAC = 0.42;       // 雙方交會點 ≈ view.w × 此值
  const ATTACK_RANGE = 32;      // 英雄線與敵人前排線的間距（本階段單一全域值）
  const HERO_ADVANCE_SPEED = 80; // 英雄往中間/回左的滑動速度
  const ENEMY_COLS = 5;         // 敵人陣型縱深（每行最多 5 隻；3 行×5＝15 格）
  const ASSEMBLY_FRAC = 0.78;   // 遭遇時敵人前排集結點 ≈ view.w × 此值（靠畫面右側）
  const CONVERGE_MUL = 0.5;     // 開戰後雙方往中間靠近的速度倍率（0.5 倍速）
  const CLASH_TIME = 0.9;       // 「開戰！」停頓秒數（雙方就位後短暫定格）

  // ---- 格子戰術 AI（逐單位攻擊距離／最近目標／自由移動）----
  const RANGE_BY_CLS = { "戰士": 1, "狂戰": 1, "盜賊": 1, "法師": 3, "牧師": 3, "弓手": 5 }; // 攻擊距離（格）；預設 1
  const BOSS_RANGE = 5, ENEMY_RANGE = 1;
  function unitRangeForHero(cls) { return RANGE_BY_CLS[cls] || 1; }
  function unitRangeForEnemy(isBoss) { return isBoss ? BOSS_RANGE : ENEMY_RANGE; }
  const ATK_INTERVAL_MUL = 2;   // 攻速放慢一倍（攻擊間隔 ×2；雙方）
  const KILL_PAUSE = 0.5;       // 擊敗對手後原地停 0.5 秒才能下一個動作（雙方）
  const COMBAT_MOVE_MUL = 0.5;  // 戰鬥時移動速度再慢一倍（×0.5；雙方）
  // ---- 狀態效果（個人 buff/debuff；資料驅動：blockMove/blockAct/各倍率/DoT）----
  const FX = {
    stun:     { dur: 5,  blockMove: true,  blockAct: true },                       // 暈眩：不可動不可攻
    freeze:   { dur: 5,  blockMove: true,  blockAct: true, defMul: 1.5 },          // 冰凍：不可動不可攻、防禦+50%
    burn:     { dur: 5,  dotPct: 0.03 },                                           // 燃燒：每秒 3% 最大生命
    paralyze: { dur: 5,  blockMove: true,  blockAct: false, inMul: 1.25 },         // 麻痺：不可動可攻、受傷+25%
    weak:     { dur: 5,  outMul: 0.5, inMul: 1.25, moveMul: 0.5 },                 // 虛弱：攻擊-50%、受傷+25%、移速-50%
    berserk:  { dur: 10, outMul: 1.5, inMul: 1.25, moveMul: 1.5 },                 // 狂暴：攻擊+50%、受傷+25%、移速+50%
  };
  // 動畫節奏（變慢、變持久）
  const PROJECTILE_LIFE = 0.45; // 投射物飛行時間（越大飛越慢、停留越久）
  const FLOAT_LIFE = 0.95;      // 飄字停留時間
  const PARTICLE_LIFE_MUL = 1.3; // 全特效粒子壽命倍率
  const GRID_STEP_SPEED = 80;   // 逐格移動的 x 動畫速度（px/s）
  const LANE_EASE = 8;          // 換行時行位緩動（每秒）
  const AIR_LIFT = 14;          // 空中層單位上移像素（第二層）
  const Z_EASE = 10;            // 升降（地面↔空中）緩動（每秒）
  const CELL_ALIGN_EPS = 0.75;  // 視為「已就位於格」的 x 容差
  const LANE_ALIGN_EPS = 0.06;  // 行位對齊容差
  // 小數行位 → y（對 LANE_DY 線性內插，供換行動畫平滑繪製）
  function laneYF(ground, laneF) {
    const last = LANES - 1, fl = Math.floor(laneF);
    const a = Math.max(0, Math.min(last, fl)), b = Math.max(0, Math.min(last, fl + 1));
    return ground + LANE_DY[a] + (LANE_DY[b] - LANE_DY[a]) * (laneF - fl);
  }
  // 移動速度差異化（× GRID_STEP_SPEED）：盜賊/狂戰快、戰士中、遠程職業偏慢（本就靠後）
  const MOVE_BY_CLS = { "盜賊": 1.45, "狂戰": 1.2, "戰士": 1.0, "牧師": 0.9, "法師": 0.85, "弓手": 0.92 };
  function heroMoveSpeed(cls) { return GRID_STEP_SPEED * (MOVE_BY_CLS[cls] || 1); }
  // 敵人攻擊距離：多數近戰(1)，少數遠程(2~5，偏向 2~3)；遠程比例隨區域(深層)提高
  function enemyRangeRoll(stage) {
    const p = Math.min(0.5, 0.12 + regionOf(stage) * 0.06);
    if (Math.random() < p) return [2, 2, 3, 3, 4, 5][Math.floor(Math.random() * 6)];
    return 1;
  }
  // 敵人移動速度：近戰較快、遠程較慢、王最慢；加 ±10% 個體差異
  function enemyMoveSpeed(range, isBoss) {
    let mul = isBoss ? 0.55 : range >= 4 ? 0.66 : range >= 2 ? 0.8 : 0.96;
    return GRID_STEP_SPEED * mul * (0.9 + Math.random() * 0.2);
  }
  // 敵人技能（精英/魔王才有）：簡單的治療或遠程重擊；名稱會顯示在戰鬥畫面
  const ENEMY_SKILLS = {
    heal:  { name: "治療", cd: 6.5, pct: 0.22, color: "#5ec46b" },                     // 回復自身 22% 生命
    bolt:  { name: "暗箭", cd: 5.0, mult: 1.8, range: 6, color: "#a35bff", kind: "dark" },     // 遠程重擊（暗）
    flame: { name: "黑炎", cd: 4.5, mult: 2.4, range: 7, color: "#ff6a2a", kind: "fireball" }, // 魔王：火球重擊
    icebolt:   { name: "冰封", cd: 6.0, mult: 1.4, range: 6, color: "#7ad7ff", kind: "frost",    applies: "freeze" },
    stunbolt:  { name: "震擊", cd: 5.5, mult: 1.3, range: 5, color: "#ffe45a", kind: "orb",       applies: "stun" },
    emberbolt: { name: "灼燒", cd: 5.0, mult: 1.5, range: 6, color: "#ff7a3d", kind: "fireball",  applies: "burn" },
    shock:     { name: "麻痺", cd: 6.5, mult: 1.2, range: 4, color: "#fff04a", kind: "orb",       applies: "paralyze" },
    curse:     { name: "虛弱", cd: 6.5, mult: 1.1, range: 6, color: "#b07ad0", kind: "dark",      applies: "weak" },
  };
  function enemySkillFor(isBoss, isElite) {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (isBoss) return pick(["flame", "emberbolt", "icebolt"]);
    if (isElite) return pick(["heal", "bolt", "icebolt", "stunbolt", "emberbolt", "shock", "curse"]);
    return null;
  }

  // ===== 怪物名冊（每隻獨立設定；數值用 6 級標籤，明確值給 crit/距離/攻速/移速）=====
  const MONSTER_TIERS = [
    { name: "很低", color: "#9aa0b0", mul: 0.5 },
    { name: "低", color: "#c9d1e0", mul: 0.75 },
    { name: "普通", color: "#5ec46b", mul: 1.0 },
    { name: "高", color: "#4a9fe0", mul: 1.4 },
    { name: "很高", color: "#b06ae0", mul: 1.9 },
    { name: "超高", color: "#ffb43d", mul: 2.6 },
    { name: "破格", color: "#ff3b46", mul: 3.6 },
  ];
  function monsterTierLabel(idx) { const t = MONSTER_TIERS[Math.max(0, Math.min(6, idx | 0))]; return { name: t.name, color: t.color, mul: t.mul }; }
  // tiers:[hp,def,atk,hit,dodge,critDmg] 各 0..5；crit/range/atkInterval/moveMul 為明確值；skills 0..3；special 特殊行為
  const MONSTERS = [
    // 區0 草原
    { id: "slime", name: "史萊姆", region: 0, sprite: "themedSmall:0", kind: "small", tiers: { hp: 2, def: 1, atk: 1, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.2, moveMul: 0.95, skills: [], special: "split", splitInto: "slime_small", splitCount: 2 },
    { id: "slime_small", name: "小史萊姆", region: 0, sprite: "themedSmall:0", kind: "small", child: true, tiers: { hp: 0, def: 0, atk: 0, hit: 1, dodge: 1, critDmg: 0 }, crit: 0.02, range: 1, atkInterval: 1.0, moveMul: 1.1, skills: [], special: null },
    { id: "bee", name: "野蜂", region: 0, sprite: "bee", kind: "small", fly: true, tiers: { hp: 0, def: 0, atk: 2, hit: 3, dodge: 3, critDmg: 2 }, crit: 0.08, range: 1, atkInterval: 0.8, moveMul: 1.3, skills: [], special: null },
    { id: "b_slime", name: "史萊姆王", region: 0, sprite: "themedBoss:0", kind: "boss", tiers: { hp: 5, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.05, range: 1, atkInterval: 1.5, moveMul: 0.6, skills: ["flame", "stunbolt", "icebolt"], special: "split", splitInto: "slime_small", splitCount: 3 },
    // 區1 森林
    { id: "spider", name: "狼蛛", region: 1, sprite: "themedSmall:1", kind: "small", tiers: { hp: 1, def: 1, atk: 2, hit: 2, dodge: 2, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 1.0, moveMul: 1.1, skills: ["shock"], special: null },
    { id: "maneater", name: "食人花", region: 1, sprite: "maneater", kind: "small", tiers: { hp: 3, def: 2, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.03, range: 1, atkInterval: 1.4, moveMul: 0.5, skills: ["curse"], special: null },
    { id: "b_spider", name: "巨蛛女王", region: 1, sprite: "themedBoss:1", kind: "boss", tiers: { hp: 5, def: 2, atk: 3, hit: 3, dodge: 2, critDmg: 2 }, crit: 0.06, range: 2, atkInterval: 1.4, moveMul: 0.8, skills: ["stunbolt", "shock", "curse"], special: "summon", summonId: "spider", summonCount: 2 },
    // 區2 沙漠
    { id: "scorpion", name: "沙蠍", region: 2, sprite: "themedSmall:2", kind: "small", tiers: { hp: 1, def: 3, atk: 2, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.1, range: 1, atkInterval: 1.0, moveMul: 1.0, skills: ["curse"], special: null },
    { id: "sandworm", name: "沙蟲", region: 2, sprite: "sandworm", kind: "small", tiers: { hp: 4, def: 1, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.3, moveMul: 0.6, skills: [], special: null },
    { id: "b_scorpion", name: "蠍王", region: 2, sprite: "themedBoss:2", kind: "boss", tiers: { hp: 5, def: 4, atk: 3, hit: 2, dodge: 1, critDmg: 4 }, crit: 0.12, range: 1, atkInterval: 1.4, moveMul: 0.7, skills: ["emberbolt", "curse", "bolt"], special: "enrage" },
    // 區3 雪地
    { id: "snowman", name: "雪人", region: 3, sprite: "themedSmall:3", kind: "small", tiers: { hp: 3, def: 2, atk: 1, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.3, moveMul: 0.7, skills: ["icebolt"], special: "shield" },
    { id: "icewisp", name: "冰靈", region: 3, sprite: "icewisp", kind: "small", fly: true, tiers: { hp: 0, def: 0, atk: 2, hit: 3, dodge: 4, critDmg: 2 }, crit: 0.06, range: 3, atkInterval: 1.1, moveMul: 1.0, skills: ["icebolt"], special: null },
    { id: "b_ice", name: "冰霜領主", region: 3, sprite: "themedBoss:3", kind: "boss", tiers: { hp: 5, def: 3, atk: 3, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.06, range: 4, atkInterval: 1.5, moveMul: 0.7, skills: ["icebolt", "stunbolt", "shock"], special: "shield" },
    // 區4 熔岩山
    { id: "fire", name: "火靈", region: 4, sprite: "themedSmall:4", kind: "small", tiers: { hp: 1, def: 0, atk: 3, hit: 2, dodge: 2, critDmg: 3 }, crit: 0.08, range: 2, atkInterval: 0.9, moveMul: 1.2, skills: ["emberbolt"], special: null },
    { id: "magma", name: "熔岩獸", region: 4, sprite: "magma", kind: "small", tiers: { hp: 4, def: 3, atk: 3, hit: 1, dodge: 0, critDmg: 2 }, crit: 0.04, range: 1, atkInterval: 1.3, moveMul: 0.6, skills: ["flame"], special: "enrage" },
    { id: "b_flame", name: "烈焰魔", region: 4, sprite: "themedBoss:4", kind: "boss", tiers: { hp: 5, def: 3, atk: 4, hit: 2, dodge: 1, critDmg: 4 }, crit: 0.08, range: 5, atkInterval: 1.5, moveMul: 0.65, skills: ["flame", "emberbolt", "bolt"], special: "enrage" },
    // 區5 深海
    { id: "jelly", name: "水母", region: 5, sprite: "themedSmall:5", kind: "small", tiers: { hp: 2, def: 1, atk: 1, hit: 2, dodge: 3, critDmg: 2 }, crit: 0.05, range: 2, atkInterval: 1.1, moveMul: 0.9, skills: ["shock"], special: null },
    { id: "octo", name: "深海章魚", region: 5, sprite: "octo", kind: "small", tiers: { hp: 3, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 1.2, moveMul: 0.8, skills: ["curse", "bolt"], special: "summon", summonId: "jelly", summonCount: 2 },
    { id: "b_kraken", name: "海妖", region: 5, sprite: "themedBoss:5", kind: "boss", tiers: { hp: 5, def: 3, atk: 4, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.07, range: 6, atkInterval: 1.5, moveMul: 0.7, skills: ["bolt", "icebolt", "shock"], special: "summon", summonId: "jelly", summonCount: 3 },
    // 區6 天空之城
    { id: "bird", name: "飛鳥", region: 6, sprite: "themedSmall:6", kind: "small", fly: true, tiers: { hp: 1, def: 1, atk: 2, hit: 4, dodge: 4, critDmg: 2 }, crit: 0.08, range: 2, atkInterval: 0.9, moveMul: 1.4, skills: ["stunbolt", "bolt", "shock"], special: null },
    { id: "cloudlet", name: "雲精", region: 6, sprite: "cloudlet", kind: "small", fly: true, tiers: { hp: 2, def: 0, atk: 2, hit: 3, dodge: 3, critDmg: 2 }, crit: 0.05, range: 3, atkInterval: 1.1, moveMul: 1.1, skills: ["stunbolt", "icebolt", "bolt"], special: null },
    { id: "b_harpy", name: "鷹身女妖", region: 6, sprite: "themedBoss:6", kind: "boss", fly: true, tiers: { hp: 5, def: 2, atk: 4, hit: 4, dodge: 3, critDmg: 3 }, crit: 0.1, range: 3, atkInterval: 1.3, moveMul: 0.9, skills: ["stunbolt", "bolt", "shock"], special: "enrage" },
    // 區7 遺跡
    { id: "skeleton", name: "骷髏兵", region: 7, sprite: "themedSmall:7", kind: "small", tiers: { hp: 2, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 1.0, moveMul: 1.0, skills: ["bolt", "curse", "stunbolt"], special: null },
    { id: "gargoyle", name: "石像鬼", region: 7, sprite: "gargoyle", kind: "small", tiers: { hp: 4, def: 4, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.03, range: 1, atkInterval: 1.3, moveMul: 0.6, skills: ["stunbolt", "curse", "emberbolt"], special: "shield" },
    { id: "b_colossus", name: "遺跡巨像", region: 7, sprite: "themedBoss:7", kind: "boss", tiers: { hp: 5, def: 5, atk: 4, hit: 2, dodge: 0, critDmg: 3 }, crit: 0.05, range: 1, atkInterval: 1.6, moveMul: 0.55, skills: ["stunbolt", "curse", "emberbolt"], special: "shield" },
    // 區8 魔王城
    { id: "imp", name: "小惡魔", region: 8, sprite: "themedSmall:8", kind: "small", tiers: { hp: 1, def: 1, atk: 3, hit: 3, dodge: 3, critDmg: 3 }, crit: 0.1, range: 2, atkInterval: 0.9, moveMul: 1.2, skills: ["emberbolt", "flame", "curse"], special: null },
    { id: "darkbat", name: "暗影蝠", region: 8, sprite: "darkbat", kind: "small", fly: true, tiers: { hp: 1, def: 0, atk: 2, hit: 4, dodge: 5, critDmg: 3 }, crit: 0.12, range: 1, atkInterval: 0.7, moveMul: 1.4, skills: ["bolt", "curse", "shock"], special: null },
    { id: "b_demon", name: "魔王", region: 8, sprite: "themedBoss:8", kind: "boss", tiers: { hp: 6, def: 4, atk: 5, hit: 3, dodge: 2, critDmg: 5 }, crit: 0.1, range: 3, atkInterval: 1.4, moveMul: 0.8, skills: ["flame", "stunbolt", "curse"], special: "summon", summonId: "imp", summonCount: 2 },
    // 區9 深層
    { id: "shadow", name: "暗影", region: 9, sprite: "themedSmall:9", kind: "small", tiers: { hp: 2, def: 2, atk: 4, hit: 3, dodge: 3, critDmg: 4 }, crit: 0.12, range: 1, atkInterval: 0.9, moveMul: 1.1, skills: ["curse", "bolt", "stunbolt"], special: null },
    { id: "wraithling", name: "怨靈", region: 9, sprite: "wraithling", kind: "small", fly: true, tiers: { hp: 2, def: 1, atk: 4, hit: 3, dodge: 4, critDmg: 4 }, crit: 0.12, range: 3, atkInterval: 1.0, moveMul: 1.1, skills: ["bolt", "curse", "icebolt"], special: null },
    { id: "b_lord", name: "深淵領主", region: 9, sprite: "themedBoss:9", kind: "boss", tiers: { hp: 6, def: 5, atk: 6, hit: 4, dodge: 3, critDmg: 6 }, crit: 0.12, range: 5, atkInterval: 1.4, moveMul: 0.8, skills: ["flame", "icebolt", "stunbolt"], special: "summon", summonId: "wraithling", summonCount: 3 },
  ];
  const MONSTER_BY_ID = {}; MONSTERS.forEach((m) => (MONSTER_BY_ID[m.id] = m));
  const SMALLS_BY_REGION = {}, BOSSES_BY_REGION = {};
  MONSTERS.forEach((m) => {
    if (m.kind === "boss") (BOSSES_BY_REGION[m.region] = BOSSES_BY_REGION[m.region] || []).push(m);
    else if (!m.child) (SMALLS_BY_REGION[m.region] = SMALLS_BY_REGION[m.region] || []).push(m);
  });
  function monstersForRegion(r) { return SMALLS_BY_REGION[r] || SMALLS_BY_REGION[0]; }
  function bossForRegionDef(r, stage) { const a = BOSSES_BY_REGION[r] || BOSSES_BY_REGION[0]; return a[Math.floor((stage || 0) / 10) % a.length]; }

  // ---- 戰鬥 / 關卡 ----
  const PARTY_MAX = 4; // 出戰上限
  const KILLS_PER_STAGE = 12; // 一般層需擊殺數（一次全部出場、填滿 3 行陣型）
  const BOSS_EVERY = 10; // 每 10 層出魔王
  const SEGMENT = 10; // 死亡回到本段起點（10 層一段）
  const IDLE_REVIVE_INTERVAL = 300; // 掛機：每 5 分鐘自動復活全隊並回滿血
  const DEATH_RETREAT = 20;       // 全滅退關數（再對齊到該段起點 XX1）

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
      base.gems = 0; // 打怪不掉鑽石（鑽石只來自鑽石寶箱與任務）
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
  const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
  function nextRarity(r) {
    const i = RARITY_ORDER.indexOf(r);
    return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null;
  }
  // 浮動數值「累加帶」[min,max]：取得/升稀有度時各擲一次並鎖定，factor = 各階帶擲值總和。
  // 均值總和對齊現行 mult（1.0/1.5/2.3/3.6/5.5/9.0）→ 平衡不破，僅加入浮動與運氣空間。
  const RARITY_BANDS = {
    common: [0.85, 1.15],   // 均值 1.00
    uncommon: [0.35, 0.65], // +0.50 → 累計均值 1.50
    rare: [0.55, 1.05],     // +0.80 → 2.30
    epic: [0.90, 1.70],     // +1.30 → 3.60
    legendary: [1.30, 2.50],// +1.90 → 5.50
    mythic: [2.40, 4.60],   // +3.50 → 9.00（範圍 6.35–11.65，明顯 > 傳說）
  };
  function bandMid(r) { const b = RARITY_BANDS[r]; return b ? (b[0] + b[1]) / 2 : 0; }
  // 物件浮動係數：bands 之和；無 bands（舊存檔）以各階帶「中點和」回退（= 現行 mult，數值不變）
  function itemValueFactor(it) {
    if (it && Array.isArray(it.bands) && it.bands.length) {
      let s = 0; for (let i = 0; i < it.bands.length; i++) s += it.bands[i];
      return s;
    }
    const r = it ? it.rarity : "common";
    const idx = RARITY_ORDER.indexOf(r);
    let s = 0;
    for (let i = 0; i <= idx; i++) s += bandMid(RARITY_ORDER[i]);
    return s || 1;
  }

  // 套裝：身上 4 件以上同稀有度 → 攻擊/生命/防禦 倍率
  const SET_RARITY_MULT = { uncommon: 1.5, rare: 2.0, epic: 3.0, legendary: 5.0, mythic: 10.0 };

  // ---- 升星 ----
  const STAR_MAX = 10;
  // 由「目前星數」升下一星：success 成功率、destroy 失敗後損毀機率
  const STAR_RULES = [
    { s: 1.0, d: 0 }, { s: 1.0, d: 0 }, { s: 0.95, d: 0 }, { s: 0.9, d: 0 }, { s: 0.85, d: 0.1 },
    { s: 0.8, d: 0.15 }, { s: 0.75, d: 0.2 }, { s: 0.7, d: 0.33 }, { s: 0.6, d: 0.5 }, { s: 0.45, d: 1.0 },
  ];
  function starMult(stars) { return 1 + 0.25 * (stars || 0); }   // 每星 +25% 基礎數值
  // 每稀有度星上限：滿星後可「升稀有度」（星歸零、在新階重爬）
  const RARITY_STAR_CAP = { common: 5, uncommon: 5, rare: 7, epic: 7, legendary: 10, mythic: 10 };
  // 升星卷軸：區間制 0-1 … 9-10 共 10 階（index = 起始星）；只能合成、無金幣購買
  const SCROLL_TIERS = 10;
  const CRAFT_RATIO = 5;          // 5 張合成上一階 1 張；index 9(9-10) 為頂不可再合
  function scrollTierName(i) { return (i + 1) + "星卷軸"; }

  // ---- 裝備欄位（每欄主屬性）----
  const EQUIPMENT_SLOTS = [
    { id: "weapon", name: "武器", icon: "weapons", stat: "atk", base: 6 },
    { id: "helmet", name: "頭盔", icon: "helmet", stat: "hit", base: 1.5 },
    { id: "armor", name: "鎧甲", icon: "chestplate", stat: "def", base: 3 },
    { id: "legs", name: "下身", icon: "legs", stat: "maxHp", base: 22 },
    { id: "boots", name: "靴子", icon: "boots", stat: "dodge", base: 1.2 },
    { id: "trinket", name: "飾品", icon: "ring", stat: "critDmg", base: 0.05 },
  ];
  const SLOT_BY_ID = {};
  EQUIPMENT_SLOTS.forEach((s) => (SLOT_BY_ID[s.id] = s));

  // 裝備數值：base0^(1+星/10) × (1 + 0.10×強化)，強化封頂 500
  // factor 為物件浮動係數（itemValueFactor），取代舊的 rarity.mult
  function itemStatValue(slot, factor, tier, enhance, stars) {
    const sl = SLOT_BY_ID[slot];
    const base0 = sl.base * factor * tier;
    const starred = Math.max(base0, Math.pow(base0, 1 + (stars || 0) / 10));
    return starred * (1 + 0.1 * Math.min(enhance || 0, 500));
  }
  // 每屬性係數：aBands[stat] 存在 → 該屬性各階浮動和；否則 fallback 舊單一係數
  function attrFactor(it, stat) {
    const ab = it && it.aBands && it.aBands[stat];
    if (Array.isArray(ab) && ab.length) {
      let s = 0; for (let i = 0; i < ab.length; i++) s += ab[i];
      return s;
    }
    return itemValueFactor(it);
  }
  // 屬性「水準」：依該屬性浮動落點（占 [Σmin, Σmax] 的百分位）分 5 級
  const QUALITY = [
    { name: "不良", color: "#9aa0b0" },
    { name: "普通", color: "#c9d1e0" },
    { name: "優良", color: "#5ec46b" },
    { name: "完美", color: "#b06ae0" },
    { name: "最完美", color: "#ffb43d" },
  ];
  function attrQuality(it, stat) {
    const ab = it && it.aBands && it.aBands[stat];
    if (!Array.isArray(ab) || !ab.length) return { pct: 0.5, name: QUALITY[1].name, color: QUALITY[1].color };
    let sum = 0, lo = 0, hi = 0;
    for (let i = 0; i < ab.length; i++) {
      const b = RARITY_BANDS[RARITY_ORDER[i]];
      if (!b) continue;
      sum += ab[i]; lo += b[0]; hi += b[1];
    }
    const pct = hi > lo ? Math.max(0, Math.min(1, (sum - lo) / (hi - lo))) : 0.5;
    // 不良 0–29% / 普通 30–59% / 優良 60–89% / 完美 90–99% / 最完美 100%（+epsilon 避免量化邊界浮點誤差）
    const e = pct + 1e-9;
    const idx = pct >= 1 ? 4 : e >= 0.9 ? 3 : e >= 0.6 ? 2 : e >= 0.3 ? 1 : 0;
    return { pct, name: QUALITY[idx].name, color: QUALITY[idx].color };
  }
  // 副詞條池（六核心屬性）＋ 詞條數量隨關卡進度（tier=1+floor(stage/8)）
  const SUB_STAT_POOL = ["atk", "maxHp", "def", "critDmg", "dodge", "hit"];
  function subCountForTier(tier) {
    tier = tier || 1;
    if (tier >= 101) return 2; // stage ≥ 800 → 3 詞條
    if (tier >= 38) return 1;  // stage ≥ 300 → 2 詞條
    return 0;                  // 前期 → 1 詞條
  }
  // 便利包裝：直接吃 item 物件（呼叫端統一改用這兩個）
  function itemMainStat(it) {
    return itemStatValue(it.slot, attrFactor(it, SLOT_BY_ID[it.slot].stat), it.tier, it.enhance, it.stars);
  }
  function itemSubStat(it, stat) {
    const base0 = (SUB_BASE[stat] || 0) * 0.5 * attrFactor(it, stat) * it.tier;
    const starred = Math.max(base0, Math.pow(base0, 1 + (it.stars || 0) / 10));
    return starred * (1 + 0.1 * Math.min(it.enhance || 0, 500));
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

  // ---- 具名套裝（區域掉落，101 關後）----
  // 副屬性基礎值（= 各欄位主屬 base）。副屬只能是這 6 個欄位屬性，比率類（吸血/暴擊…）只走套裝 mod。
  const SUB_BASE = { atk: 6, hit: 1.5, def: 3, maxHp: 22, dodge: 1.2, critDmg: 0.05 };
  // （副屬數值改用 itemSubStat(it, stat)，定義於上方；base0 為主屬的一半）

  // 18 套具名套裝；mods 沿用 globalMods 詞彙；special 為 [{k,v}] 特殊機制
  const SETS = {
    forest_hunter: { id: "forest_hunter", name: "翠林獵手", region: 1, color: "#5ec46b", main: "攻擊·命中",
      sub: { weapon: ["hit"], helmet: ["dodge"], boots: ["hit"] },
      bonuses: [
        { pieces: 2, mods: { hitAdd: 60, dodgeAdd: 30 }, text: "命中 +60、閃避 +30" },
        { pieces: 4, mods: { atkMul: 0.20 }, text: "攻擊 +20%" },
        { pieces: 6, mods: { critAdd: 0.12 }, special: [{ k: "multi", v: 0.18 }], text: "暴擊率 +12%、18% 機率連擊" },
      ] },
    sun_walker: { id: "sun_walker", name: "烈陽行者", region: 2, color: "#eec06a", main: "攻擊·爆傷",
      sub: { weapon: ["critDmg"], trinket: ["hit"], helmet: ["critDmg"] },
      bonuses: [
        { pieces: 2, mods: { critDmgAdd: 0.40 }, text: "爆擊傷害 +40%" },
        { pieces: 4, mods: { atkMul: 0.25 }, text: "攻擊 +25%" },
        { pieces: 6, mods: { critAdd: 0.15 }, special: [{ k: "explode", v: 0.35 }], text: "暴擊率 +15%、暴擊爆炸濺射 35%" },
      ] },
    frost_guard: { id: "frost_guard", name: "霜鎧守衛", region: 3, color: "#b0c2d8", main: "防禦·生命",
      sub: { armor: ["maxHp"], legs: ["def"], helmet: ["def"] },
      bonuses: [
        { pieces: 2, mods: { hpMul: 0.25 }, text: "生命 +25%" },
        { pieces: 4, mods: { defMul: 0.40 }, text: "防禦 +40%" },
        { pieces: 6, mods: { hpMul: 0.20 }, special: [{ k: "reflect", v: 0.25 }], text: "生命 +20%、反傷 25%" },
      ] },
    magma_berserker: { id: "magma_berserker", name: "熔心狂戰", region: 4, color: "#ff5a2a", main: "攻擊·吸血",
      sub: { weapon: ["critDmg"], armor: ["atk"], helmet: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { atkMul: 0.20 }, text: "攻擊 +20%" },
        { pieces: 4, mods: { lifestealAdd: 0.08, critDmgAdd: 0.50 }, text: "吸血 +8%、爆傷 +50%" },
        { pieces: 6, mods: { atkMul: 0.25 }, special: [{ k: "execute", v: 0.12 }], text: "攻擊 +25%、斬殺 12%（魔王免疫）" },
      ] },
    bulwark: { id: "bulwark", name: "磐岩壁壘", region: 4, color: "#8a7a5e", main: "防禦·生命",
      sub: { armor: ["maxHp"], legs: ["def"], boots: ["maxHp"] },
      bonuses: [
        { pieces: 2, mods: { defMul: 0.30 }, text: "防禦 +30%" },
        { pieces: 4, mods: { hpMul: 0.35 }, text: "生命 +35%" },
        { pieces: 6, mods: { defMul: 0.30 }, special: [{ k: "reflect", v: 0.35 }], text: "防禦 +30%、反傷 35%" },
      ] },
    abyssal_tide: { id: "abyssal_tide", name: "深淵潮汐", region: 5, color: "#1c84a0", main: "生命·閃避",
      sub: { legs: ["dodge"], boots: ["maxHp"], armor: ["dodge"] },
      bonuses: [
        { pieces: 2, mods: { hpMul: 0.30 }, text: "生命 +30%" },
        { pieces: 4, mods: { dodgeAdd: 120 }, text: "閃避 +120" },
        { pieces: 6, mods: { hpMul: 0.25 }, special: [{ k: "regen", v: 0.02 }], text: "生命 +25%、每秒回復 2% 生命" },
      ] },
    riptide_blade: { id: "riptide_blade", name: "利刃暗流", region: 5, color: "#3aa0b0", main: "攻擊·閃避",
      sub: { weapon: ["dodge"], boots: ["atk"], helmet: ["dodge"] },
      bonuses: [
        { pieces: 2, mods: { dodgeAdd: 100 }, text: "閃避 +100" },
        { pieces: 4, mods: { atkMul: 0.30 }, text: "攻擊 +30%" },
        { pieces: 6, mods: { atkSpeedMul: 0.20 }, special: [{ k: "multi", v: 0.22 }], text: "攻速 +20%、22% 機率連擊" },
      ] },
    storm_wing: { id: "storm_wing", name: "風暴之翼", region: 6, color: "#9fd0f4", main: "攻擊·攻速",
      sub: { weapon: ["hit"], boots: ["atk"], helmet: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { atkSpeedMul: 0.15 }, text: "攻速 +15%" },
        { pieces: 4, mods: { atkMul: 0.35 }, text: "攻擊 +35%" },
        { pieces: 6, mods: { atkSpeedMul: 0.15 }, special: [{ k: "explode", v: 0.40 }], text: "攻速 +15%、爆炸濺射 40%" },
      ] },
    holy_aegis: { id: "holy_aegis", name: "聖光庇佑", region: 6, color: "#ffe9a8", main: "生命·防禦",
      sub: { armor: ["maxHp"], legs: ["def"], trinket: ["maxHp"] },
      bonuses: [
        { pieces: 2, mods: { hpMul: 0.35 }, text: "生命 +35%" },
        { pieces: 4, mods: { defMul: 0.45 }, text: "防禦 +45%" },
        { pieces: 6, mods: { hpMul: 0.30 }, special: [{ k: "regen", v: 0.03 }], text: "生命 +30%、每秒回復 3% 生命" },
      ] },
    ruin_render: { id: "ruin_render", name: "遺跡狂攻", region: 7, color: "#d6a258", main: "攻擊·爆傷",
      sub: { weapon: ["critDmg"], helmet: ["atk"], trinket: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { critDmgAdd: 0.60 }, text: "爆傷 +60%" },
        { pieces: 4, mods: { atkMul: 0.40 }, text: "攻擊 +40%" },
        { pieces: 6, mods: { critAdd: 0.15 }, special: [{ k: "explode", v: 0.45 }], text: "暴擊率 +15%、暴擊爆炸 45%" },
      ] },
    ruin_warden: { id: "ruin_warden", name: "遺跡壁壘", region: 7, color: "#9a8a6a", main: "防禦·生命",
      sub: { armor: ["maxHp"], legs: ["def"], helmet: ["def"] },
      bonuses: [
        { pieces: 2, mods: { defMul: 0.40 }, text: "防禦 +40%" },
        { pieces: 4, mods: { hpMul: 0.40 }, text: "生命 +40%" },
        { pieces: 6, mods: { defMul: 0.35 }, special: [{ k: "reflect", v: 0.45 }], text: "防禦 +35%、反傷 45%" },
      ] },
    ruin_stalker: { id: "ruin_stalker", name: "遺跡獵殺", region: 7, color: "#a86a4a", main: "攻擊·吸血",
      sub: { weapon: ["critDmg"], armor: ["atk"], helmet: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { atkMul: 0.30 }, text: "攻擊 +30%" },
        { pieces: 4, mods: { lifestealAdd: 0.10, critDmgAdd: 0.60 }, text: "吸血 +10%、爆傷 +60%" },
        { pieces: 6, mods: { atkMul: 0.30 }, special: [{ k: "execute", v: 0.15 }], text: "攻擊 +30%、斬殺 15%（魔王免疫）" },
      ] },
    demon_might: { id: "demon_might", name: "魔王之力", region: 8, color: "#b06ae0", main: "攻擊",
      sub: { weapon: ["critDmg"], helmet: ["atk"], trinket: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { atkMul: 0.30, critDmgAdd: 0.50 }, text: "攻擊 +30%、爆傷 +50%" },
        { pieces: 4, mods: { atkMul: 0.50 }, text: "攻擊 +50%" },
        { pieces: 6, mods: { critAdd: 0.18 }, special: [{ k: "multi", v: 0.25 }], text: "暴擊率 +18%、25% 機率連擊" },
      ] },
    demon_bulwark: { id: "demon_bulwark", name: "魔王壁壘", region: 8, color: "#6a3a8a", main: "防禦·生命",
      sub: { armor: ["maxHp"], legs: ["def"], boots: ["maxHp"] },
      bonuses: [
        { pieces: 2, mods: { hpMul: 0.40 }, text: "生命 +40%" },
        { pieces: 4, mods: { defMul: 0.60 }, text: "防禦 +60%" },
        { pieces: 6, mods: { hpMul: 0.35 }, special: [{ k: "reflect", v: 0.55 }], text: "生命 +35%、反傷 55%" },
      ] },
    demon_devour: { id: "demon_devour", name: "魔王噬血", region: 8, color: "#ff3b46", main: "攻擊·吸血",
      sub: { weapon: ["critDmg"], armor: ["atk"], helmet: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { atkMul: 0.35 }, text: "攻擊 +35%" },
        { pieces: 4, mods: { lifestealAdd: 0.12 }, text: "吸血 +12%" },
        { pieces: 6, mods: { atkMul: 0.35 }, special: [{ k: "execute", v: 0.18 }], text: "攻擊 +35%、斬殺 18%（魔王免疫）" },
      ] },
    abyss_ender: { id: "abyss_ender", name: "深淵滅世", region: 9, color: "#ff2a3a", main: "攻擊·爆傷",
      sub: { weapon: ["critDmg"], helmet: ["atk"], trinket: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { atkMul: 0.40, critDmgAdd: 0.70 }, text: "攻擊 +40%、爆傷 +70%" },
        { pieces: 4, mods: { atkMul: 0.60 }, text: "攻擊 +60%" },
        { pieces: 6, mods: { critAdd: 0.20 }, special: [{ k: "explode", v: 0.55 }], text: "暴擊率 +20%、暴擊爆炸 55%" },
      ] },
    abyss_eternal: { id: "abyss_eternal", name: "深淵不滅", region: 9, color: "#ff5a3a", main: "防禦·生命",
      sub: { armor: ["maxHp"], legs: ["def"], boots: ["maxHp"] },
      bonuses: [
        { pieces: 2, mods: { hpMul: 0.50 }, text: "生命 +50%" },
        { pieces: 4, mods: { defMul: 0.70 }, text: "防禦 +70%" },
        { pieces: 6, mods: { hpMul: 0.40 }, special: [{ k: "reflect", v: 0.60 }, { k: "regen", v: 0.04 }], text: "生命 +40%、反傷 60%、每秒回復 4% 生命" },
      ] },
    abyss_reaper: { id: "abyss_reaper", name: "深淵噬魂", region: 9, color: "#d040d0", main: "攻擊·攻速·吸血",
      sub: { weapon: ["critDmg"], boots: ["atk"], helmet: ["atk"] },
      bonuses: [
        { pieces: 2, mods: { atkMul: 0.40, atkSpeedMul: 0.15 }, text: "攻擊 +40%、攻速 +15%" },
        { pieces: 4, mods: { lifestealAdd: 0.15 }, text: "吸血 +15%" },
        { pieces: 6, mods: {}, special: [{ k: "multi", v: 0.30 }, { k: "execute", v: 0.20 }], text: "30% 機率連擊、斬殺 20%（魔王免疫）" },
      ] },
  };
  const SET_BY_ID = SETS;
  const SETS_BY_REGION = {};
  Object.keys(SETS).forEach((id) => {
    const r = SETS[id].region;
    (SETS_BY_REGION[r] = SETS_BY_REGION[r] || []).push(id);
  });

  // ---- 掉寶率參數（全可調）----
  // 裝備/卷軸只從怪物掉落、一次 1 張。傳說/神話永不掉落（只能升稀有度取得）。
  const DROP = {
    minRegion: 1,            // 僅 101 關後（region>=1）才掉裝/卷
    normalRate: 0.01,        // 普通怪掉寶率
    eliteRate: 0.04,         // 精英怪掉寶率
    bossRate: 0.15,          // 關卡王（魔王）掉寶率
    chestSpawnChance: 0.00015, // 一般怪 → 寶箱怪 出現率（約 5000-10000 隻出 1 隻）；出現即 100% 掉
    chestTierBonus: 2,       // 寶箱怪掉裝 tier +2
    // 打怪掉落內容（普通/精英/關卡王共用）：普通裝/優秀/稀有 + 1/2/3 星卷軸
    dropTable: { common: 40, uncommon: 10, rare: 5, scroll0: 30, scroll1: 10, scroll2: 5 },
    // 寶箱怪：100% 掉裝、不掉卷（無傳說/神話）
    chestTable: { common: 50, uncommon: 35, rare: 10, epic: 5 },
  };

  // ---- 精英怪：出現比率由 0 關起指數成長，900 關封頂固定 33% ----
  const ELITE = { capRatio: 0.33, capStage: 900, exp: 2.2, hpMul: 2.2, atkMul: 1.15, goldMul: 2.5 };
  function eliteRatio(stage) {
    const t = Math.min(1, Math.max(0, stage) / ELITE.capStage);
    return Math.min(ELITE.capRatio, ELITE.capRatio * Math.pow(t, ELITE.exp));
  }

  // ---- 過關掉寶箱（只給貨幣）----
  // 每次關卡通過後低機率掉一個寶箱：90% 金幣寶箱（大量金幣）/ 10% 鑽石寶箱（1-5 鑽）
  const STAGE_BOX = { chance: 0.04, goldShare: 0.9, gemMin: 1, gemMax: 5, goldMult: 60 };
  // 金幣寶箱金幣量 = 當前關卡每隻怪金幣 × goldMult
  function stageBoxGold(stage) {
    return Math.max(50, Math.floor(makeEnemyStats(stage, false).gold * STAGE_BOX.goldMult));
  }
  // 商店購買普通裝的金幣價：固定最便宜（不隨關卡漲）
  const COMMON_GEAR_COST = 100;
  function commonGearCost() {
    return COMMON_GEAR_COST;
  }
  const GODDESS_GUARD_COST = 1000; // 女神的守護：1000 鑽/個

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
    slash: { name: "斬擊", icon: "dagger", type: "active", cooldown: 7, maxLevel: 20,
      desc: "對前方敵人造成額外傷害", cost: (l) => Math.floor(40 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.2 + 0.3 * l).toFixed(1)} 傷害` },
    fireball: { name: "火球術", icon: "burst", type: "active", cooldown: 9, maxLevel: 20, applies: "burn",
      desc: "火焰傷害並使敵人燃燒", cost: (l) => Math.floor(45 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.5 + 0.4 * l).toFixed(1)} 並燃燒` },
    frost: { name: "冰霜新星", icon: "snow", type: "active", cooldown: 12, maxLevel: 20, applies: "freeze",
      desc: "重擊並冰凍敵人", cost: (l) => Math.floor(50 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.8 + 0.5 * l).toFixed(1)} 並冰凍` },
    multishot: { name: "多重射擊", icon: "bow", type: "active", cooldown: 9, maxLevel: 20,
      desc: "連射多箭", cost: (l) => Math.floor(45 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(1.0 + 0.25 * l).toFixed(2)} ×3` },
    backstab: { name: "背刺", icon: "dagger", type: "active", cooldown: 12, maxLevel: 20,
      desc: "高暴擊一擊", cost: (l) => Math.floor(48 * Math.pow(1.5, l)),
      effectText: (l) => `攻擊×${(2.0 + 0.5 * l).toFixed(1)} 必暴` },
    heal: { name: "治癒術", icon: "heal", type: "active", cooldown: 7, maxLevel: 20,
      desc: "回復全隊生命", cost: (l) => Math.floor(50 * Math.pow(1.5, l)),
      effectText: (l) => `全隊回復 ${Math.round((0.08 + 0.02 * l) * 100)}% 生命` },
    rage: { name: "狂暴", icon: "angry", type: "active", cooldown: 11, duration: 10, maxLevel: 20, applies: "berserk",
      desc: "進入狂暴狀態", cost: (l) => Math.floor(55 * Math.pow(1.5, l)),
      effectText: (l) => `10 秒 攻擊+50% 移速+50% 受傷+25%` },
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
    { id: "buy_scroll1", name: "1星卷軸", icon: "scroll", cur: "gems", cost: 1, give: { scroll: 0 }, desc: "升星基礎卷軸，可放入五芒星合成更高階" },
    { id: "buy_guardian", name: "女神的守護", icon: "goddess", cur: "gems", cost: GODDESS_GUARD_COST, give: { guardian: 1 }, desc: "升星失敗導致裝備損毀時，消耗 1 個抵銷，保護裝備不損毀。" },
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
    { id: "box50", name: "尋寶新手", icon: "box", stat: "boxesOpened", goal: 50, reward: { gems: 30 } },
    { id: "box500", name: "尋寶大師", icon: "box", stat: "boxesOpened", goal: 500, reward: { gems: 150 } },
    { id: "stage50", name: "深入險境", icon: "flag", stat: "bestStage", goal: 50, reward: { gems: 50 } },
    { id: "stage200", name: "勢如破竹", icon: "flag", stat: "bestStage", goal: 200, reward: { gems: 150 } },
    { id: "prestige1", name: "輪迴", icon: "soul", stat: "prestiges", goal: 1, reward: { gems: 100 } },
  ];

  // ---- 每日任務 ----
  const DAILY_QUESTS = [
    { id: "d_kill", name: "擊殺 200 敵人", stat: "killsToday", goal: 200, reward: { gold: 1500 } },
    { id: "d_box", name: "獲得寶箱 5 次", stat: "boxesToday", goal: 5, reward: { gems: 20 } },
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
    LANES, LANE_DY, FORM_COL_GAP, ENEMY_GAP, SPAWN_INTERVAL, MAX_CONCURRENT, ENEMY_DROP_H, DROP_GRAVITY, laneY, laneYF,
    MARCH_TIME, VICTORY_TIME, DEFEAT_TIME, MEET_FRAC, ATTACK_RANGE, HERO_ADVANCE_SPEED,
    ENEMY_COLS, ASSEMBLY_FRAC, CONVERGE_MUL, CLASH_TIME,
    RANGE_BY_CLS, BOSS_RANGE, ENEMY_RANGE, unitRangeForHero, unitRangeForEnemy,
    GRID_STEP_SPEED, LANE_EASE, AIR_LIFT, Z_EASE, CELL_ALIGN_EPS, LANE_ALIGN_EPS,
    ATK_INTERVAL_MUL, KILL_PAUSE, COMBAT_MOVE_MUL,
    FX, PROJECTILE_LIFE, FLOAT_LIFE, PARTICLE_LIFE_MUL,
    MOVE_BY_CLS, heroMoveSpeed, enemyMoveSpeed, enemyRangeRoll,
    ENEMY_SKILLS, enemySkillFor,
    MONSTER_TIERS, monsterTierLabel, MONSTERS, MONSTER_BY_ID, monstersForRegion, bossForRegionDef,
    PARTY_MAX, KILLS_PER_STAGE, BOSS_EVERY, SEGMENT, IDLE_REVIVE_INTERVAL, DEATH_RETREAT,
    regionOf, isBossStage, segmentStart, concurrentEnemies, makeEnemyStats,
    DIFFICULTY_ANCHORS, difficultyMult,
    RARITIES, RARITY_BY_ID, RARITY_ORDER, nextRarity, RARITY_BANDS, bandMid, itemValueFactor,
    attrFactor, QUALITY, attrQuality, SUB_STAT_POOL, subCountForTier,
    SET_RARITY_MULT, STAR_MAX, STAR_RULES, starMult,
    RARITY_STAR_CAP, SCROLL_TIERS, CRAFT_RATIO, scrollTierName,
    ENHANCE_MAX, EVADE_K, evadeChance,
    EQUIPMENT_SLOTS, SLOT_BY_ID, itemStatValue, itemMainStat, itemSubStat, itemTierForStage, enhanceCost, salvageValue,
    SUB_BASE, SETS, SET_BY_ID, SETS_BY_REGION, DROP, ELITE, eliteRatio,
    STAGE_BOX, stageBoxGold, commonGearCost, COMMON_GEAR_COST, GODDESS_GUARD_COST,
    HEROES, HERO_BY_ID, xpForLevel, heroLevelCost,
    HERO_SKILLS, TRAININGS, TALENTS, PRESTIGE,
    PETS, PET_BY_ID, petUpgradeCost,
    SHOP, ACHIEVEMENTS, DAILY_QUESTS,
    PALETTE, THEMES, getTheme,
    OFFLINE_CAP_SECONDS: 8 * 3600,
  };
})();
