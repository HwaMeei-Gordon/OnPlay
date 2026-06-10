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
  // 攻擊距離改由職業 JOBS 決定（見下方 JOBS 定義）；預設 1
  const BOSS_RANGE = 5, ENEMY_RANGE = 1;
  function unitRangeForHero(jobId) { const j = JOB_BY_ID[jobId]; return (j && j.range) || 1; }
  function unitRangeForEnemy(isBoss) { return isBoss ? BOSS_RANGE : ENEMY_RANGE; }
  const ATK_INTERVAL_MUL = 2;   // 攻速放慢一倍（攻擊間隔 ×2；雙方）
  const KILL_PAUSE = 0.5;       // 擊敗對手後原地停 0.5 秒才能下一個動作（雙方）
  const COMBAT_MOVE_MUL = 0.5;  // 戰鬥時移動速度再慢一倍（×0.5；雙方）
  // ---- 狀態效果（個人 buff/debuff；資料驅動：blockMove/blockAct/各倍率/DoT）----
  const FX = {
    stun:     { dur: 5,  blockMove: true,  blockAct: true, noDodge: true },                          // 暈眩：不可動不可攻、無法閃避
    freeze:   { dur: 10, blockMove: true,  blockAct: true, defMul: 1.25 },                            // 冰凍：10秒、不可動不可攻、防禦+25%
    burn:     { dur: 5,  dotPct: 0.03, dotInterval: 0.5, dotTrue: true, moveMul: 0.75 },              // 燃燒：每0.5秒 3% 真實傷害、移速-25%
    paralyze: { dur: 5,  blockMove: true,  blockAct: false, inMul: 1.25, atkSpeedMul: 0.25 },         // 麻痺：不可動、受傷+25%、攻速-75%
    weak:     { dur: 5,  outMul: 0.5, inMul: 1.25, moveMul: 0.5, atkSpeedMul: 0.75 },                 // 虛弱：攻擊-50%、受傷+25%、移速-50%、攻速-25%
    berserk:  { dur: 10, outMul: 1.5, inMul: 1.5, moveMul: 1.5, atkSpeedMul: 1.5 },                   // 狂暴：攻擊+50%、受傷+50%、移速+50%、攻速+50%
    seal:     { dur: 20, blockSkill: true, onExpire: "berserk" },                                     // 封印：20秒不可施放技能、結束後進入狂暴
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
  // 移動速度差異化（× GRID_STEP_SPEED）：改由職業 JOBS.moveMul 決定
  function heroMoveSpeed(jobId) { const j = JOB_BY_ID[jobId]; return GRID_STEP_SPEED * ((j && j.moveMul) || 1); }
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
    aoe:       { name: "旋風", cd: 8.0, mult: 1.4, range: 99, color: "#bfe24a", kind: "whirl", aoe: true },   // 範圍攻擊：打全部地面英雄
    blink:     { name: "瞬移", cd: 7.0, range: 99, color: "#b06ae0", blink: true },                          // 瞬移到後排英雄旁
    seal:      { name: "封印", cd: 9.0, mult: 1.0, range: 6, color: "#a020c0", kind: "dark", applies: "seal" }, // 封印目標技能
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
    { id: "slime", name: "史萊姆", region: 0, sprite: "themedSmall:0", kind: "small", tiers: { hp: 2, def: 1, atk: 1, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.2, moveMul: 0.95, lifesteal: 0.1, skills: [], special: "split", splitInto: "slime_small", splitCount: 2 },
    { id: "slime_small", name: "小史萊姆", region: 0, sprite: "themedSmall:0", kind: "small", child: true, tiers: { hp: 0, def: 0, atk: 0, hit: 1, dodge: 1, critDmg: 0 }, crit: 0.02, range: 1, atkInterval: 1.0, moveMul: 1.1, skills: [], special: null },
    { id: "bee", name: "野蜂", region: 0, sprite: "bee", kind: "small", fly: true, tiers: { hp: 0, def: 0, atk: 2, hit: 3, dodge: 3, critDmg: 2 }, crit: 0.08, range: 1, atkInterval: 0.8, moveMul: 1.3, aim: "lowHp", skills: [], special: null },
    { id: "rabbit", name: "野兔", region: 0, sprite: "rabbit", kind: "small", tiers: { hp: 0, def: 0, atk: 1, hit: 2, dodge: 3, critDmg: 1 }, crit: 0.04, range: 1, atkInterval: 0.9, moveMul: 1.4, skills: [], special: null },
    { id: "mushroom", name: "蘑菇怪", region: 0, sprite: "mushroom", kind: "small", tiers: { hp: 3, def: 2, atk: 1, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.4, moveMul: 0.55, taunt: true, onHit: "weak", skills: [], special: null },
    { id: "flowersp", name: "花精靈", region: 0, sprite: "flowersp", kind: "small", tiers: { hp: 1, def: 0, atk: 1, hit: 2, dodge: 2, critDmg: 1 }, crit: 0.03, range: 3, atkInterval: 1.2, moveMul: 0.9, skills: ["heal"], special: null },
    { id: "grasswolf", name: "草狼", region: 0, sprite: "grasswolf", kind: "small", tiers: { hp: 1, def: 1, atk: 3, hit: 2, dodge: 2, critDmg: 2 }, crit: 0.08, range: 1, atkInterval: 0.9, moveMul: 1.3, aim: "lowHp", lifesteal: 0.1, skills: [], special: null },
    { id: "b_slime", name: "史萊姆王", region: 0, sprite: "themedBoss:0", kind: "boss", tiers: { hp: 5, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.05, range: 1, atkInterval: 1.5, moveMul: 0.6, taunt: true, skills: ["aoe", "stunbolt", "flame"], special: "split", splitInto: "slime_small", splitCount: 3 },
    // 區1 森林
    { id: "spider", name: "狼蛛", region: 1, sprite: "themedSmall:1", kind: "small", tiers: { hp: 1, def: 1, atk: 2, hit: 2, dodge: 2, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 1.0, moveMul: 1.1, skills: ["shock"], special: null },
    { id: "maneater", name: "食人花", region: 1, sprite: "maneater", kind: "small", tiers: { hp: 3, def: 2, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.03, range: 1, atkInterval: 1.4, moveMul: 0.5, lifesteal: 0.15, taunt: true, skills: ["curse"], special: null },
    { id: "deer", name: "角鹿", region: 1, sprite: "deer", kind: "small", tiers: { hp: 1, def: 1, atk: 2, hit: 2, dodge: 3, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 0.95, moveMul: 1.35, aim: "back", skills: [], special: null },
    { id: "treant", name: "樹妖", region: 1, sprite: "treant", kind: "small", tiers: { hp: 4, def: 3, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.4, moveMul: 0.5, taunt: true, skills: ["heal"], special: "shield" },
    { id: "toadstool", name: "毒蕈", region: 1, sprite: "toadstool", kind: "small", tiers: { hp: 2, def: 1, atk: 2, hit: 2, dodge: 1, critDmg: 1 }, crit: 0.03, range: 3, atkInterval: 1.2, moveMul: 0.85, onHit: "weak", skills: ["curse"], special: null },
    { id: "forestmoth", name: "林蛾", region: 1, sprite: "forestmoth", kind: "small", fly: true, tiers: { hp: 1, def: 0, atk: 2, hit: 3, dodge: 3, critDmg: 2 }, crit: 0.06, range: 2, atkInterval: 0.9, moveMul: 1.25, aim: "lowHp", skills: [], special: null },
    { id: "b_spider", name: "巨蛛女王", region: 1, sprite: "themedBoss:1", kind: "boss", tiers: { hp: 5, def: 2, atk: 3, hit: 3, dodge: 2, critDmg: 2 }, crit: 0.06, range: 2, atkInterval: 1.4, moveMul: 0.8, revive: true, skills: ["stunbolt", "shock", "aoe"], special: "summon", summonId: "spider", summonCount: 2 },
    // 區2 沙漠
    { id: "scorpion", name: "沙蠍", region: 2, sprite: "themedSmall:2", kind: "small", tiers: { hp: 1, def: 3, atk: 2, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.1, range: 1, atkInterval: 1.0, moveMul: 1.0, aim: "lowHp", burrow: true, skills: [], special: null },
    { id: "sandworm", name: "沙蟲", region: 2, sprite: "sandworm", kind: "small", tiers: { hp: 4, def: 1, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.3, moveMul: 0.6, burrow: true, skills: [], special: null },
    { id: "jackal", name: "胡狼", region: 2, sprite: "jackal", kind: "small", tiers: { hp: 1, def: 1, atk: 3, hit: 2, dodge: 2, critDmg: 2 }, crit: 0.08, range: 1, atkInterval: 0.9, moveMul: 1.35, aim: "lowHp", lifesteal: 0.1, skills: [], special: null },
    { id: "mummy", name: "木乃伊", region: 2, sprite: "mummy", kind: "small", tiers: { hp: 3, def: 3, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.4, moveMul: 0.55, taunt: true, onHit: "weak", skills: ["curse"], special: "shield" },
    { id: "sandhawk", name: "沙鷹", region: 2, sprite: "sandhawk", kind: "small", fly: true, tiers: { hp: 1, def: 1, atk: 2, hit: 3, dodge: 4, critDmg: 2 }, crit: 0.08, range: 2, atkInterval: 0.95, moveMul: 1.4, aim: "back", skills: [], special: null },
    { id: "cobra", name: "沙蛇", region: 2, sprite: "cobra", kind: "small", tiers: { hp: 1, def: 2, atk: 3, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.1, range: 2, atkInterval: 1.0, moveMul: 1.0, burrow: true, aim: "lowHp", onHit: "weak", skills: [], special: null },
    { id: "b_scorpion", name: "蠍王", region: 2, sprite: "themedBoss:2", kind: "boss", tiers: { hp: 5, def: 4, atk: 3, hit: 2, dodge: 1, critDmg: 4 }, crit: 0.12, range: 1, atkInterval: 1.4, moveMul: 0.7, burrow: true, skills: ["emberbolt", "curse", "aoe"], special: "enrage" },
    // 區3 雪地
    { id: "snowman", name: "雪人", region: 3, sprite: "themedSmall:3", kind: "small", tiers: { hp: 3, def: 2, atk: 1, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.3, moveMul: 0.7, skills: ["icebolt"], special: "shield" },
    { id: "icewisp", name: "冰靈", region: 3, sprite: "icewisp", kind: "small", fly: true, tiers: { hp: 0, def: 0, atk: 2, hit: 3, dodge: 4, critDmg: 2 }, crit: 0.06, range: 3, atkInterval: 1.1, moveMul: 1.0, aim: "far", skills: ["icebolt"], special: null },
    { id: "frostwolf", name: "雪狼", region: 3, sprite: "frostwolf", kind: "small", tiers: { hp: 2, def: 1, atk: 3, hit: 2, dodge: 2, critDmg: 2 }, crit: 0.08, range: 1, atkInterval: 0.9, moveMul: 1.3, aim: "lowHp", lifesteal: 0.1, skills: [], special: null },
    { id: "yeti", name: "雪怪", region: 3, sprite: "yeti", kind: "small", tiers: { hp: 4, def: 2, atk: 3, hit: 1, dodge: 0, critDmg: 2 }, crit: 0.04, range: 1, atkInterval: 1.4, moveMul: 0.55, taunt: true, skills: ["stunbolt"], special: "enrage" },
    { id: "yukionna", name: "雪女", region: 3, sprite: "yukionna", kind: "small", tiers: { hp: 1, def: 1, atk: 2, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.06, range: 4, atkInterval: 1.2, moveMul: 0.9, aim: "far", onHit: "weak", skills: ["icebolt"], special: null },
    { id: "snowowl", name: "雪鴞", region: 3, sprite: "snowowl", kind: "small", fly: true, tiers: { hp: 1, def: 0, atk: 2, hit: 3, dodge: 4, critDmg: 2 }, crit: 0.06, range: 2, atkInterval: 0.95, moveMul: 1.3, aim: "back", skills: [], special: null },
    { id: "b_ice", name: "冰霜領主", region: 3, sprite: "themedBoss:3", kind: "boss", tiers: { hp: 5, def: 3, atk: 3, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.06, range: 4, atkInterval: 1.5, moveMul: 0.7, taunt: true, skills: ["icebolt", "stunbolt", "aoe"], special: "shield" },
    // 區4 熔岩山
    { id: "fire", name: "火靈", region: 4, sprite: "themedSmall:4", kind: "small", tiers: { hp: 1, def: 0, atk: 3, hit: 2, dodge: 2, critDmg: 3 }, crit: 0.08, range: 2, atkInterval: 0.9, moveMul: 1.2, onHit: "burn", skills: ["emberbolt"], special: null },
    { id: "magma", name: "熔岩獸", region: 4, sprite: "magma", kind: "small", tiers: { hp: 4, def: 3, atk: 3, hit: 1, dodge: 0, critDmg: 2 }, crit: 0.04, range: 1, atkInterval: 1.3, moveMul: 0.6, taunt: true, skills: ["flame"], special: "enrage" },
    { id: "emberhound", name: "炎犬", region: 4, sprite: "emberhound", kind: "small", tiers: { hp: 2, def: 1, atk: 3, hit: 2, dodge: 2, critDmg: 3 }, crit: 0.1, range: 1, atkInterval: 0.85, moveMul: 1.35, aim: "lowHp", onHit: "burn", skills: [], special: null },
    { id: "cindergolem", name: "炭岩魔", region: 4, sprite: "cindergolem", kind: "small", tiers: { hp: 4, def: 4, atk: 3, hit: 1, dodge: 0, critDmg: 2 }, crit: 0.04, range: 1, atkInterval: 1.45, moveMul: 0.5, taunt: true, skills: ["flame"], special: "shield" },
    { id: "flamewing", name: "炎蝠", region: 4, sprite: "flamewing", kind: "small", fly: true, tiers: { hp: 1, def: 0, atk: 3, hit: 3, dodge: 3, critDmg: 3 }, crit: 0.1, range: 2, atkInterval: 0.9, moveMul: 1.3, aim: "back", onHit: "burn", skills: [], special: null },
    { id: "lavaserpent", name: "熔岩蛇", region: 4, sprite: "lavaserpent", kind: "small", tiers: { hp: 3, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.08, range: 3, atkInterval: 1.1, moveMul: 0.7, burrow: true, skills: ["emberbolt"], special: null },
    { id: "b_flame", name: "烈焰魔", region: 4, sprite: "themedBoss:4", kind: "boss", tiers: { hp: 5, def: 3, atk: 4, hit: 2, dodge: 1, critDmg: 4 }, crit: 0.08, range: 5, atkInterval: 1.5, moveMul: 0.65, burrow: true, skills: ["flame", "emberbolt", "aoe"], special: "enrage" },
    // 區5 深海
    { id: "jelly", name: "水母", region: 5, sprite: "themedSmall:5", kind: "small", tiers: { hp: 2, def: 1, atk: 1, hit: 2, dodge: 3, critDmg: 2 }, crit: 0.05, range: 2, atkInterval: 1.1, moveMul: 0.9, burrow: true, skills: ["shock"], special: null },
    { id: "octo", name: "深海章魚", region: 5, sprite: "octo", kind: "small", tiers: { hp: 3, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 1.2, moveMul: 0.8, taunt: true, skills: ["curse", "bolt"], special: "summon", summonId: "jelly", summonCount: 2 },
    { id: "seaturtle", name: "海龜", region: 5, sprite: "seaturtle", kind: "small", tiers: { hp: 4, def: 4, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.02, range: 1, atkInterval: 1.5, moveMul: 0.5, taunt: true, skills: [], special: "shield" },
    { id: "eel", name: "電鰻", region: 5, sprite: "eel", kind: "small", tiers: { hp: 2, def: 1, atk: 3, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.1, range: 2, atkInterval: 1.0, moveMul: 1.0, burrow: true, aim: "lowHp", skills: ["shock"], special: null },
    { id: "anglerfish", name: "鮟鱇", region: 5, sprite: "anglerfish", kind: "small", tiers: { hp: 3, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 1.2, moveMul: 0.7, taunt: true, aim: "lowHp", lifesteal: 0.15, skills: ["curse"], special: null },
    { id: "reefshark", name: "幼鯊", region: 5, sprite: "reefshark", kind: "small", tiers: { hp: 2, def: 1, atk: 4, hit: 2, dodge: 2, critDmg: 3 }, crit: 0.1, range: 1, atkInterval: 0.85, moveMul: 1.4, aim: "lowHp", lifesteal: 0.1, skills: [], special: null },
    { id: "b_kraken", name: "海妖", region: 5, sprite: "themedBoss:5", kind: "boss", tiers: { hp: 5, def: 3, atk: 4, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.07, range: 6, atkInterval: 1.5, moveMul: 0.7, burrow: true, skills: ["bolt", "icebolt", "aoe"], special: "summon", summonId: "jelly", summonCount: 3 },
    // 區6 天空之城
    { id: "bird", name: "飛鳥", region: 6, sprite: "themedSmall:6", kind: "small", fly: true, tiers: { hp: 1, def: 1, atk: 2, hit: 4, dodge: 4, critDmg: 2 }, crit: 0.08, range: 2, atkInterval: 0.9, moveMul: 1.4, aim: "back", skills: [], special: null },
    { id: "cloudlet", name: "雲精", region: 6, sprite: "cloudlet", kind: "small", fly: true, tiers: { hp: 2, def: 0, atk: 2, hit: 3, dodge: 3, critDmg: 2 }, crit: 0.05, range: 3, atkInterval: 1.1, moveMul: 1.1, taunt: true, skills: ["stunbolt"], special: null },
    { id: "hawk", name: "蒼鷹", region: 6, sprite: "hawk", kind: "small", fly: true, tiers: { hp: 1, def: 1, atk: 3, hit: 4, dodge: 4, critDmg: 3 }, crit: 0.1, range: 1, atkInterval: 0.85, moveMul: 1.45, aim: "lowHp", skills: [], special: null },
    { id: "thunderbird", name: "雷鳥", region: 6, sprite: "thunderbird", kind: "small", fly: true, tiers: { hp: 2, def: 1, atk: 3, hit: 3, dodge: 3, critDmg: 2 }, crit: 0.08, range: 3, atkInterval: 1.1, moveMul: 1.2, aim: "far", skills: ["shock"], special: null },
    { id: "skyguard", name: "天空守衛", region: 6, sprite: "skyguard", kind: "small", tiers: { hp: 4, def: 4, atk: 3, hit: 2, dodge: 1, critDmg: 2 }, crit: 0.04, range: 1, atkInterval: 1.4, moveMul: 0.6, taunt: true, skills: [], special: "shield" },
    { id: "windwisp", name: "風靈", region: 6, sprite: "windwisp", kind: "small", fly: true, tiers: { hp: 2, def: 0, atk: 1, hit: 3, dodge: 4, critDmg: 1 }, crit: 0.04, range: 3, atkInterval: 1.2, moveMul: 1.1, aim: "far", skills: ["heal"], special: null },
    { id: "b_harpy", name: "鷹身女妖", region: 6, sprite: "themedBoss:6", kind: "boss", fly: true, tiers: { hp: 5, def: 2, atk: 4, hit: 4, dodge: 3, critDmg: 3 }, crit: 0.1, range: 3, atkInterval: 1.3, moveMul: 0.9, skills: ["stunbolt", "bolt", "blink"], special: "enrage" },
    // 區7 遺跡
    { id: "skeleton", name: "骷髏兵", region: 7, sprite: "themedSmall:7", kind: "small", tiers: { hp: 2, def: 2, atk: 3, hit: 2, dodge: 1, critDmg: 2 }, crit: 0.06, range: 1, atkInterval: 1.0, moveMul: 1.0, burrow: true, skills: ["bolt"], special: null },
    { id: "gargoyle", name: "石像鬼", region: 7, sprite: "gargoyle", kind: "small", tiers: { hp: 4, def: 4, atk: 2, hit: 1, dodge: 0, critDmg: 1 }, crit: 0.03, range: 1, atkInterval: 1.3, moveMul: 0.6, taunt: true, skills: [], special: "shield" },
    { id: "ruinblade", name: "亡靈劍士", region: 7, sprite: "ruinblade", kind: "small", tiers: { hp: 2, def: 2, atk: 4, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.08, range: 1, atkInterval: 0.9, moveMul: 1.1, aim: "lowHp", skills: [], special: null },
    { id: "sentinel", name: "守衛雕像", region: 7, sprite: "sentinel", kind: "small", tiers: { hp: 5, def: 4, atk: 3, hit: 1, dodge: 0, critDmg: 2 }, crit: 0.03, range: 1, atkInterval: 1.5, moveMul: 0.5, taunt: true, skills: ["stunbolt"], special: "shield" },
    { id: "cursestone", name: "符石", region: 7, sprite: "cursestone", kind: "small", tiers: { hp: 2, def: 2, atk: 2, hit: 2, dodge: 1, critDmg: 2 }, crit: 0.05, range: 4, atkInterval: 1.3, moveMul: 0.8, onHit: "weak", skills: ["seal"], special: null },
    { id: "wraithguard", name: "遺跡幽魂", region: 7, sprite: "wraithguard", kind: "small", fly: true, tiers: { hp: 2, def: 1, atk: 3, hit: 3, dodge: 4, critDmg: 3 }, crit: 0.1, range: 2, atkInterval: 1.0, moveMul: 1.2, stealth: true, aim: "back", lifesteal: 0.15, skills: [], special: null },
    { id: "b_colossus", name: "遺跡巨像", region: 7, sprite: "themedBoss:7", kind: "boss", tiers: { hp: 5, def: 5, atk: 4, hit: 2, dodge: 0, critDmg: 3 }, crit: 0.05, range: 1, atkInterval: 1.6, moveMul: 0.55, taunt: true, skills: ["stunbolt", "aoe", "seal"], special: "shield" },
    // 區8 魔王城
    { id: "imp", name: "小惡魔", region: 8, sprite: "themedSmall:8", kind: "small", tiers: { hp: 1, def: 1, atk: 3, hit: 3, dodge: 3, critDmg: 3 }, crit: 0.1, range: 2, atkInterval: 0.9, moveMul: 1.2, aim: "lowHp", skills: ["emberbolt"], special: null },
    { id: "darkbat", name: "暗影蝠", region: 8, sprite: "darkbat", kind: "small", fly: true, tiers: { hp: 1, def: 0, atk: 2, hit: 4, dodge: 5, critDmg: 3 }, crit: 0.12, range: 1, atkInterval: 1.55, moveMul: 1.4, aim: "lowHp", lifesteal: 0.2, stealth: true, skills: ["bolt"], special: null },
    { id: "hellhound", name: "地獄犬", region: 8, sprite: "hellhound", kind: "small", tiers: { hp: 3, def: 2, atk: 4, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.1, range: 1, atkInterval: 0.85, moveMul: 1.35, aim: "lowHp", onHit: "burn", lifesteal: 0.1, skills: [], special: null },
    { id: "gatekeeper", name: "守門魔將", region: 8, sprite: "gatekeeper", kind: "small", tiers: { hp: 5, def: 4, atk: 4, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.05, range: 1, atkInterval: 1.45, moveMul: 0.55, taunt: true, skills: ["seal"], special: "shield" },
    { id: "warlock", name: "邪術師", region: 8, sprite: "warlock", kind: "small", tiers: { hp: 2, def: 2, atk: 3, hit: 3, dodge: 2, critDmg: 3 }, crit: 0.08, range: 5, atkInterval: 1.2, moveMul: 0.85, aim: "far", skills: ["curse", "bolt"], special: null },
    { id: "succubus", name: "魅魔", region: 8, sprite: "succubus", kind: "small", fly: true, tiers: { hp: 2, def: 1, atk: 3, hit: 4, dodge: 4, critDmg: 3 }, crit: 0.12, range: 2, atkInterval: 1.0, moveMul: 1.25, stealth: true, aim: "back", lifesteal: 0.2, skills: ["curse"], special: null },
    { id: "b_demon", name: "魔王", region: 8, sprite: "themedBoss:8", kind: "boss", tiers: { hp: 6, def: 4, atk: 5, hit: 3, dodge: 2, critDmg: 5 }, crit: 0.1, range: 3, atkInterval: 1.4, moveMul: 0.8, revive: true, skills: ["seal", "stunbolt", "aoe"], special: "summon", summonId: "imp", summonCount: 2 },
    // 區9 深層
    { id: "shadow", name: "暗影", region: 9, sprite: "themedSmall:9", kind: "small", tiers: { hp: 2, def: 2, atk: 4, hit: 3, dodge: 3, critDmg: 4 }, crit: 0.12, range: 1, atkInterval: 1.6, moveMul: 1.1, aim: "lowHp", stealth: true, skills: ["curse"], special: null },
    { id: "wraithling", name: "怨靈", region: 9, sprite: "wraithling", kind: "small", fly: true, tiers: { hp: 2, def: 1, atk: 4, hit: 3, dodge: 4, critDmg: 4 }, crit: 0.12, range: 3, atkInterval: 1.0, moveMul: 1.1, aim: "far", skills: ["bolt", "curse"], special: null },
    { id: "voidreaver", name: "虛空狂徒", region: 9, sprite: "voidreaver", kind: "small", tiers: { hp: 3, def: 2, atk: 5, hit: 3, dodge: 3, critDmg: 4 }, crit: 0.12, range: 1, atkInterval: 0.9, moveMul: 1.2, aim: "lowHp", lifesteal: 0.15, skills: ["curse"], special: null },
    { id: "abyssguard", name: "深淵守衛", region: 9, sprite: "abyssguard", kind: "small", tiers: { hp: 5, def: 5, atk: 4, hit: 2, dodge: 1, critDmg: 3 }, crit: 0.05, range: 1, atkInterval: 1.5, moveMul: 0.55, taunt: true, skills: ["seal", "aoe"], special: "shield" },
    { id: "soulflayer", name: "噬魂者", region: 9, sprite: "soulflayer", kind: "small", fly: true, tiers: { hp: 3, def: 2, atk: 4, hit: 4, dodge: 4, critDmg: 4 }, crit: 0.12, range: 2, atkInterval: 1.0, moveMul: 1.2, stealth: true, aim: "back", lifesteal: 0.2, skills: ["curse"], special: null },
    { id: "dreadcaster", name: "厄禍術士", region: 9, sprite: "dreadcaster", kind: "small", tiers: { hp: 3, def: 2, atk: 4, hit: 3, dodge: 2, critDmg: 4 }, crit: 0.1, range: 6, atkInterval: 1.2, moveMul: 0.8, aim: "far", skills: ["seal", "bolt", "icebolt"], special: null },
    { id: "b_lord", name: "深淵領主", region: 9, sprite: "themedBoss:9", kind: "boss", tiers: { hp: 6, def: 5, atk: 6, hit: 4, dodge: 3, critDmg: 6 }, crit: 0.12, range: 5, atkInterval: 1.4, moveMul: 0.8, revive: true, skills: ["seal", "icebolt", "aoe"], special: "summon", summonId: "wraithling", summonCount: 3 },
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

  // ---- 掉落素材（圖鑑顯示用；未來可合成套裝）----
  // icon = icons.js 形狀鍵；tint 省略=固定色、有值=runtime 染色(hex)；bossOnly 每區恰一個、只在該區王 drops
  const MATERIALS = [
    // 區0 草原
    { id: "m_slime_gel", name: "史萊姆凝膠", region: 0, icon: "slimeball", tint: "#54c23a", rarity: "common" },
    { id: "m_slime_core", name: "史萊姆核", region: 0, icon: "crystal", tint: "#6bd24a", rarity: "rare" },
    { id: "m_grass_blade", name: "嫩草葉", region: 0, icon: "leaf", tint: "#7aa852", rarity: "common" },
    { id: "m_grass_seed", name: "草原種子", region: 0, icon: "seed", tint: "#c9b25a", rarity: "common" },
    { id: "m_wildflower", name: "野花瓣", region: 0, icon: "flower", tint: "#e07ab0", rarity: "uncommon" },
    { id: "m_petal_dew", name: "花露", region: 0, icon: "droplet", tint: "#a6e9ff", rarity: "uncommon" },
    { id: "m_bee_sting", name: "蜂螫針", region: 0, icon: "fang", tint: "#ffc62e", rarity: "common" },
    { id: "m_honey", name: "野蜂蜜", region: 0, icon: "droplet", tint: "#ffc62e", rarity: "uncommon" },
    { id: "m_rabbit_fur", name: "兔毛", region: 0, icon: "fur", tint: "#e8dcc0", rarity: "common" },
    { id: "m_rabbit_foot", name: "幸運兔足", region: 0, icon: "paw", rarity: "rare" },
    { id: "m_mush_cap", name: "蘑菇傘", region: 0, icon: "mushcap", tint: "#d6705a", rarity: "common" },
    { id: "m_mush_spore", name: "蘑菇孢子", region: 0, icon: "droplet", tint: "#c89050", rarity: "uncommon" },
    { id: "m_fairy_dust", name: "花精靈塵", region: 0, icon: "star", rarity: "rare" },
    { id: "m_heal_pollen", name: "治癒花粉", region: 0, icon: "flower", tint: "#a6f06a", rarity: "uncommon" },
    { id: "m_wolf_fang", name: "草狼獠牙", region: 0, icon: "fang", tint: "#d8d0c0", rarity: "uncommon" },
    { id: "m_wolf_pelt", name: "草狼皮", region: 0, icon: "bag", rarity: "rare" },
    { id: "m_slime_crown", name: "史萊姆王冠", region: 0, icon: "crown", tint: "#54c23a", rarity: "epic", bossOnly: true },
    // 區1 森林
    { id: "m_spider_silk", name: "蜘蛛絲", region: 1, icon: "web", rarity: "common" },
    { id: "m_spider_venom", name: "蛛毒", region: 1, icon: "droplet", tint: "#6e4f8a", rarity: "uncommon" },
    { id: "m_spider_eye", name: "巨蛛複眼", region: 1, icon: "eye", tint: "#6e4f8a", rarity: "rare" },
    { id: "m_thick_vine", name: "粗藤蔓", region: 1, icon: "leaf", tint: "#2f7d28", rarity: "common" },
    { id: "m_maneater_tooth", name: "食人花尖牙", region: 1, icon: "fang", tint: "#bfe24a", rarity: "uncommon" },
    { id: "m_forest_bark", name: "森林樹皮", region: 1, icon: "bark", tint: "#5a3a22", rarity: "common" },
    { id: "m_treant_core", name: "樹妖核心", region: 1, icon: "crystal", tint: "#3f7a3a", rarity: "rare" },
    { id: "m_deer_horn", name: "鹿角", region: 1, icon: "horn", tint: "#b0884a", rarity: "uncommon" },
    { id: "m_deer_hide", name: "鹿皮", region: 1, icon: "fur", tint: "#b08a5a", rarity: "common" },
    { id: "m_toadstool_cap", name: "毒蕈傘", region: 1, icon: "mushcap", tint: "#8a5fd6", rarity: "uncommon" },
    { id: "m_toad_spore", name: "毒孢子", region: 1, icon: "droplet", tint: "#bfe24a", rarity: "common" },
    { id: "m_moth_wing", name: "林蛾鱗粉", region: 1, icon: "feather", tint: "#bfe24a", rarity: "uncommon" },
    { id: "m_forest_moss", name: "森林苔蘚", region: 1, icon: "leaf", tint: "#5f8f2f", rarity: "common" },
    { id: "m_forest_sap", name: "琥珀樹液", region: 1, icon: "droplet", tint: "#c9b25a", rarity: "common" },
    { id: "m_wild_herb", name: "野生藥草", region: 1, icon: "leaf", tint: "#a6f06a", rarity: "uncommon" },
    { id: "m_queen_fang", name: "蛛后毒牙", region: 1, icon: "fang", tint: "#8a2fd6", rarity: "rare" },
    { id: "m_spider_crown", name: "巨蛛后冠", region: 1, icon: "crown", tint: "#6e4f8a", rarity: "epic", bossOnly: true },
    // 區2 沙漠
    { id: "m_sand_grain", name: "細沙礫", region: 2, icon: "sand", rarity: "common" },
    { id: "m_sand_crystal", name: "沙晶", region: 2, icon: "crystal", tint: "#ffe066", rarity: "uncommon" },
    { id: "m_scorpion_claw", name: "蠍鉗", region: 2, icon: "claw", tint: "#c0392b", rarity: "uncommon" },
    { id: "m_scorpion_sting", name: "蠍尾針", region: 2, icon: "fang", tint: "#c0392b", rarity: "rare" },
    { id: "m_worm_scale", name: "沙蟲鱗", region: 2, icon: "scale", tint: "#cda05a", rarity: "common" },
    { id: "m_worm_tooth", name: "沙蟲齒", region: 2, icon: "fang", tint: "#d8c8a0", rarity: "uncommon" },
    { id: "m_jackal_fang", name: "胡狼牙", region: 2, icon: "fang", tint: "#cda05a", rarity: "common" },
    { id: "m_jackal_pelt", name: "胡狼皮", region: 2, icon: "fur", tint: "#cda05a", rarity: "common" },
    { id: "m_mummy_wrap", name: "木乃伊繃帶", region: 2, icon: "bandage", rarity: "uncommon" },
    { id: "m_cursed_dust", name: "詛咒之塵", region: 2, icon: "ash", rarity: "rare" },
    { id: "m_hawk_feather2", name: "沙鷹羽", region: 2, icon: "feather", tint: "#cda05a", rarity: "common" },
    { id: "m_cobra_scale", name: "沙蛇鱗", region: 2, icon: "scale", tint: "#5f8f2f", rarity: "uncommon" },
    { id: "m_cobra_venom", name: "蛇毒", region: 2, icon: "droplet", tint: "#5f8f2f", rarity: "uncommon" },
    { id: "m_ancient_coin", name: "古代金幣", region: 2, icon: "coin", rarity: "rare" },
    { id: "m_desert_gem", name: "沙漠寶石", region: 2, icon: "crystal", tint: "#ff7a3d", rarity: "uncommon" },
    { id: "m_sun_relic", name: "烈陽遺物", region: 2, icon: "star", rarity: "rare" },
    { id: "m_scorpion_crown", name: "蠍王甲殼", region: 2, icon: "crown", tint: "#c0392b", rarity: "epic", bossOnly: true },
    // 區3 雪地
    { id: "m_snowflake", name: "雪花結晶", region: 3, icon: "snow", rarity: "common" },
    { id: "m_ice_shard", name: "冰晶碎片", region: 3, icon: "crystal", tint: "#9fc4e6", rarity: "common" },
    { id: "m_frost_dust", name: "霜塵", region: 3, icon: "droplet", tint: "#cfe4f5", rarity: "common" },
    { id: "m_snowman_coal", name: "雪人煤眼", region: 3, icon: "orb", tint: "#2a2a33", rarity: "uncommon" },
    { id: "m_frostwolf_fang", name: "雪狼獠牙", region: 3, icon: "fang", tint: "#dfe4ee", rarity: "uncommon" },
    { id: "m_frostwolf_pelt", name: "雪狼皮", region: 3, icon: "fur", tint: "#dfe4ee", rarity: "common" },
    { id: "m_yeti_fur", name: "雪怪厚毛", region: 3, icon: "fur", tint: "#c7cede", rarity: "common" },
    { id: "m_yeti_claw", name: "雪怪利爪", region: 3, icon: "claw", tint: "#c7cede", rarity: "uncommon" },
    { id: "m_yuki_silk", name: "雪女之絲", region: 3, icon: "web", rarity: "uncommon" },
    { id: "m_yuki_tear", name: "雪女之淚", region: 3, icon: "droplet", tint: "#9fc4e6", rarity: "rare" },
    { id: "m_snowowl_feather", name: "雪鴞羽", region: 3, icon: "feather", tint: "#dfe4ee", rarity: "common" },
    { id: "m_frost_heart", name: "寒冰之心", region: 3, icon: "crystal", tint: "#6bd2ff", rarity: "rare" },
    { id: "m_glacier_chunk", name: "冰河碎塊", region: 3, icon: "rock", tint: "#9fc4e6", rarity: "uncommon" },
    { id: "m_winter_herb", name: "寒地藥草", region: 3, icon: "leaf", tint: "#aef0a8", rarity: "uncommon" },
    { id: "m_icicle", name: "冰錐", region: 3, icon: "crystal", tint: "#e6f1fb", rarity: "common" },
    { id: "m_blizzard_core", name: "暴雪之核", region: 3, icon: "orb", tint: "#9fc4e6", rarity: "rare" },
    { id: "m_ice_crown", name: "冰霜王冠", region: 3, icon: "crown", tint: "#9fc4e6", rarity: "epic", bossOnly: true },
    // 區4 熔岩山
    { id: "m_ember", name: "餘燼", region: 4, icon: "ember", rarity: "common" },
    { id: "m_ash_pile", name: "火山灰", region: 4, icon: "ash", rarity: "common" },
    { id: "m_fire_essence", name: "火靈精華", region: 4, icon: "droplet", tint: "#ff7a3d", rarity: "uncommon" },
    { id: "m_magma_rock", name: "熔岩石", region: 4, icon: "rock", tint: "#c0392b", rarity: "common" },
    { id: "m_magma_core", name: "熔岩核心", region: 4, icon: "orb", tint: "#ff5a2a", rarity: "rare" },
    { id: "m_emberhound_fang", name: "炎犬獠牙", region: 4, icon: "fang", tint: "#ff7a3d", rarity: "uncommon" },
    { id: "m_emberhound_fur", name: "炎犬焦毛", region: 4, icon: "fur", tint: "#a8281c", rarity: "common" },
    { id: "m_cinder_shard", name: "炭岩碎片", region: 4, icon: "rock", tint: "#2a2a33", rarity: "common" },
    { id: "m_cinder_core", name: "炭岩核", region: 4, icon: "crystal", tint: "#ff7a3d", rarity: "uncommon" },
    { id: "m_flamewing_membrane", name: "炎蝠翼膜", region: 4, icon: "feather", tint: "#c0392b", rarity: "uncommon" },
    { id: "m_flamewing_fang", name: "炎蝠尖牙", region: 4, icon: "fang", tint: "#c0392b", rarity: "common" },
    { id: "m_lava_scale", name: "熔岩蛇鱗", region: 4, icon: "scale", tint: "#c0392b", rarity: "uncommon" },
    { id: "m_lava_venom", name: "熾熱毒液", region: 4, icon: "droplet", tint: "#ff5a2a", rarity: "rare" },
    { id: "m_obsidian", name: "黑曜石", region: 4, icon: "crystal", tint: "#2a2a33", rarity: "rare" },
    { id: "m_sulfur", name: "硫磺", region: 4, icon: "rock", tint: "#d6b020", rarity: "common" },
    { id: "m_flame_heart", name: "烈焰之心", region: 4, icon: "heart", rarity: "rare" },
    { id: "m_flame_crown", name: "烈焰魔冠", region: 4, icon: "crown", tint: "#ff5a2a", rarity: "epic", bossOnly: true },
    // 區5 深海
    { id: "m_pearl", name: "珍珠", region: 5, icon: "orb", tint: "#f5f5fa", rarity: "common" },
    { id: "m_coral", name: "珊瑚枝", region: 5, icon: "horn", tint: "#ef82b0", rarity: "common" },
    { id: "m_seashell", name: "貝殼", region: 5, icon: "shell", tint: "#b3e0ff", rarity: "common" },
    { id: "m_jelly_gel", name: "水母膠質", region: 5, icon: "slimeball", tint: "#a05fd6", rarity: "common" },
    { id: "m_jelly_sting", name: "水母觸鬚", region: 5, icon: "tentacle", tint: "#a05fd6", rarity: "uncommon" },
    { id: "m_octo_ink", name: "章魚墨囊", region: 5, icon: "droplet", tint: "#3a3550", rarity: "uncommon" },
    { id: "m_octo_tentacle", name: "章魚觸手", region: 5, icon: "tentacle", tint: "#1c6e7e", rarity: "uncommon" },
    { id: "m_turtle_shell", name: "海龜殼片", region: 5, icon: "shell", tint: "#2f8f3f", rarity: "common" },
    { id: "m_eel_skin", name: "電鰻皮", region: 5, icon: "scale", tint: "#37a8b8", rarity: "common" },
    { id: "m_eel_spark", name: "電鰻電核", region: 5, icon: "bolt", rarity: "uncommon" },
    { id: "m_angler_lure", name: "鮟鱇燈球", region: 5, icon: "orb", tint: "#ffe066", rarity: "rare" },
    { id: "m_angler_fang", name: "鮟鱇尖牙", region: 5, icon: "fang", tint: "#1c6e7e", rarity: "uncommon" },
    { id: "m_shark_tooth", name: "鯊魚齒", region: 5, icon: "fang", tint: "#dfe4ee", rarity: "common" },
    { id: "m_shark_fin", name: "鯊魚鰭", region: 5, icon: "scale", tint: "#0f4150", rarity: "uncommon" },
    { id: "m_deep_scale", name: "深海鱗", region: 5, icon: "scale", tint: "#3b6fb0", rarity: "common" },
    { id: "m_abyssal_pearl", name: "深淵黑珍珠", region: 5, icon: "orb", tint: "#3a3550", rarity: "rare" },
    { id: "m_sea_crystal", name: "海洋結晶", region: 5, icon: "crystal", tint: "#37a8b8", rarity: "uncommon" },
    { id: "m_kraken_crown", name: "海妖之冠", region: 5, icon: "crown", tint: "#1c6e7e", rarity: "epic", bossOnly: true },
    // 區6 天空之城
    { id: "m_cloud_wisp", name: "雲絮", region: 6, icon: "cloud_wisp", rarity: "common" },
    { id: "m_sky_feather", name: "天空之羽", region: 6, icon: "feather", tint: "#dfe4ee", rarity: "common" },
    { id: "m_bird_feather", name: "飛鳥羽毛", region: 6, icon: "feather", tint: "#9fc4e6", rarity: "common" },
    { id: "m_hawk_talon", name: "蒼鷹利爪", region: 6, icon: "claw", tint: "#aa9870", rarity: "uncommon" },
    { id: "m_hawk_feather", name: "蒼鷹翎羽", region: 6, icon: "feather", tint: "#cda05a", rarity: "common" },
    { id: "m_thunder_feather", name: "雷鳥電羽", region: 6, icon: "feather", tint: "#ffe066", rarity: "uncommon" },
    { id: "m_thunder_spark", name: "雷鳥電核", region: 6, icon: "bolt", rarity: "rare" },
    { id: "m_skyguard_plate", name: "守衛石甲", region: 6, icon: "rock", tint: "#dfe4ee", rarity: "uncommon" },
    { id: "m_wind_core", name: "風之核", region: 6, icon: "orb", tint: "#6bf0d0", rarity: "uncommon" },
    { id: "m_wind_essence", name: "風精華", region: 6, icon: "droplet", tint: "#b3e0ff", rarity: "common" },
    { id: "m_sky_crystal", name: "天空水晶", region: 6, icon: "crystal", tint: "#9fc4e6", rarity: "uncommon" },
    { id: "m_star_dust", name: "星塵", region: 6, icon: "star", rarity: "rare" },
    { id: "m_holy_feather", name: "聖光之羽", region: 6, icon: "feather", tint: "#ffe066", rarity: "rare" },
    { id: "m_cloud_silk", name: "雲絲", region: 6, icon: "web", rarity: "common" },
    { id: "m_aether_gem", name: "以太寶石", region: 6, icon: "crystal", tint: "#cce8fc", rarity: "rare" },
    { id: "m_sky_down", name: "天羽絨", region: 6, icon: "fur", tint: "#dfe4ee", rarity: "common" },
    { id: "m_harpy_crown", name: "鷹妖之冠", region: 6, icon: "crown", tint: "#9fd0f4", rarity: "epic", bossOnly: true },
    // 區7 遺跡
    { id: "m_bone_frag", name: "骨碎片", region: 7, icon: "skull", rarity: "common" },
    { id: "m_bone_shard", name: "骸骨碎片", region: 7, icon: "fang", tint: "#d8c8a0", rarity: "common" },
    { id: "m_gargoyle_stone", name: "石像鬼碎石", region: 7, icon: "rock", tint: "#aa9870", rarity: "common" },
    { id: "m_stone_core", name: "石核", region: 7, icon: "crystal", tint: "#aa9870", rarity: "uncommon" },
    { id: "m_ruin_blade_frag", name: "斷劍碎片", region: 7, icon: "dagger", rarity: "uncommon" },
    { id: "m_sentinel_plate", name: "守衛石板", region: 7, icon: "rune", tint: "#9a6f33", rarity: "uncommon" },
    { id: "m_cursed_rune", name: "詛咒符文", region: 7, icon: "rune", tint: "#a05fd6", rarity: "rare" },
    { id: "m_rune_dust", name: "符文之塵", region: 7, icon: "ash", rarity: "common" },
    { id: "m_wraith_essence", name: "幽魂精華", region: 7, icon: "droplet", tint: "#a05fd6", rarity: "uncommon" },
    { id: "m_ancient_ring", name: "古代戒環", region: 7, icon: "ring", rarity: "rare" },
    { id: "m_ruin_gear", name: "遺跡齒輪", region: 7, icon: "gear", rarity: "common" },
    { id: "m_dusty_coin", name: "蒙塵古幣", region: 7, icon: "coin", rarity: "common" },
    { id: "m_relic_shard", name: "遺物碎片", region: 7, icon: "crystal", tint: "#9a8a6a", rarity: "common" },
    { id: "m_stone_tablet", name: "石碑殘片", region: 7, icon: "rune", tint: "#aa9870", rarity: "common" },
    { id: "m_grave_dust", name: "墓園之塵", region: 7, icon: "ash", rarity: "uncommon" },
    { id: "m_soul_fragment", name: "魂之碎片", region: 7, icon: "soul", rarity: "rare" },
    { id: "m_colossus_crown", name: "巨像之核", region: 7, icon: "crown", tint: "#aa9870", rarity: "epic", bossOnly: true },
    // 區8 魔王城
    { id: "m_imp_horn", name: "小惡魔之角", region: 8, icon: "horn", tint: "#c0392b", rarity: "common" },
    { id: "m_imp_tail", name: "小惡魔尾", region: 8, icon: "tentacle", tint: "#c0392b", rarity: "common" },
    { id: "m_bat_wing", name: "暗影蝠翼", region: 8, icon: "feather", tint: "#6b4b8a", rarity: "common" },
    { id: "m_bat_fang", name: "暗影蝠牙", region: 8, icon: "fang", tint: "#6b4b8a", rarity: "common" },
    { id: "m_hell_fang", name: "地獄犬獠牙", region: 8, icon: "fang", tint: "#c0392b", rarity: "uncommon" },
    { id: "m_hell_fur", name: "地獄犬焦毛", region: 8, icon: "fur", tint: "#4a2f5a", rarity: "common" },
    { id: "m_demon_plate", name: "魔將甲片", region: 8, icon: "rock", tint: "#6b4b8a", rarity: "uncommon" },
    { id: "m_demon_horn", name: "魔將之角", region: 8, icon: "horn", tint: "#a05fd6", rarity: "uncommon" },
    { id: "m_warlock_page", name: "邪術書頁", region: 8, icon: "book", rarity: "rare" },
    { id: "m_dark_crystal", name: "暗影結晶", region: 8, icon: "crystal", tint: "#6b34a8", rarity: "uncommon" },
    { id: "m_succubus_wing", name: "魅魔之翼", region: 8, icon: "feather", tint: "#ef82b0", rarity: "uncommon" },
    { id: "m_succubus_hair", name: "魅魔之髮", region: 8, icon: "fur", tint: "#ef82b0", rarity: "uncommon" },
    { id: "m_demon_blood", name: "惡魔之血", region: 8, icon: "droplet", tint: "#c0392b", rarity: "common" },
    { id: "m_soul_shard", name: "魂魄碎片", region: 8, icon: "soul", rarity: "rare" },
    { id: "m_hellfire_ember", name: "地獄火餘燼", region: 8, icon: "ember", rarity: "common" },
    { id: "m_dark_gem", name: "暗紫寶石", region: 8, icon: "crystal", tint: "#a05fd6", rarity: "rare" },
    { id: "m_demon_crown", name: "魔王之冠", region: 8, icon: "crown", tint: "#a05fd6", rarity: "epic", bossOnly: true },
    // 區9 深層
    { id: "m_void_dust", name: "虛空之塵", region: 9, icon: "ash", rarity: "common" },
    { id: "m_shadow_essence", name: "暗影精華", region: 9, icon: "droplet", tint: "#6b34a8", rarity: "common" },
    { id: "m_shadow_silk", name: "暗影之絲", region: 9, icon: "web", rarity: "common" },
    { id: "m_wraith_soul", name: "怨靈魂質", region: 9, icon: "soul", rarity: "common" },
    { id: "m_void_fang", name: "虛空獠牙", region: 9, icon: "fang", tint: "#6b34a8", rarity: "uncommon" },
    { id: "m_void_claw", name: "虛空利爪", region: 9, icon: "claw", tint: "#a8281c", rarity: "uncommon" },
    { id: "m_abyss_scale", name: "深淵鱗甲", region: 9, icon: "scale", tint: "#a8281c", rarity: "uncommon" },
    { id: "m_abyss_stone", name: "深淵石", region: 9, icon: "rock", tint: "#3a1a3a", rarity: "common" },
    { id: "m_soul_flame", name: "噬魂之焰", region: 9, icon: "ember", rarity: "uncommon" },
    { id: "m_dread_rune", name: "厄禍符文", region: 9, icon: "rune", tint: "#a8281c", rarity: "rare" },
    { id: "m_void_eye", name: "虛空之眼", region: 9, icon: "eye", tint: "#a05fd6", rarity: "rare" },
    { id: "m_void_crystal", name: "虛空結晶", region: 9, icon: "crystal", tint: "#6b34a8", rarity: "uncommon" },
    { id: "m_blood_pearl", name: "血色珍珠", region: 9, icon: "orb", tint: "#a8281c", rarity: "rare" },
    { id: "m_dark_heart", name: "漆黑之心", region: 9, icon: "heart", rarity: "rare" },
    { id: "m_abyss_horn", name: "深淵之角", region: 9, icon: "horn", tint: "#a8281c", rarity: "uncommon" },
    { id: "m_chaos_shard", name: "混沌碎片", region: 9, icon: "crystal", tint: "#ff2a3a", rarity: "rare" },
    { id: "m_lord_crown", name: "深淵領主之冠", region: 9, icon: "crown", tint: "#a8281c", rarity: "legendary", bossOnly: true },
  ];
  const MATERIAL_BY_ID = {}; MATERIALS.forEach((m) => (MATERIAL_BY_ID[m.id] = m));
  const MATERIALS_BY_REGION = {}; MATERIALS.forEach((m) => (MATERIALS_BY_REGION[m.region] = MATERIALS_BY_REGION[m.region] || []).push(m));

  // 每怪掉落素材（怪id → [材料id...]）。卷軸固定第一格不列入；長度 ≤5（+卷軸 ≤6）。bossOnly 只在該區王。
  const MONSTER_DROPS = {
    // 區0
    slime: ["m_slime_gel", "m_grass_blade"],
    bee: ["m_bee_sting", "m_honey", "m_grass_blade"],
    rabbit: ["m_rabbit_fur", "m_rabbit_foot", "m_grass_seed"],
    mushroom: ["m_mush_cap", "m_mush_spore", "m_grass_blade", "m_heal_pollen"],
    flowersp: ["m_wildflower", "m_petal_dew", "m_fairy_dust", "m_heal_pollen", "m_slime_gel"],
    grasswolf: ["m_wolf_fang", "m_wolf_pelt", "m_grass_blade"],
    b_slime: ["m_slime_gel", "m_slime_core", "m_grass_seed", "m_slime_crown"],
    // 區1
    spider: ["m_spider_silk", "m_spider_venom", "m_spider_eye"],
    maneater: ["m_maneater_tooth", "m_toad_spore", "m_thick_vine", "m_wild_herb"],
    deer: ["m_deer_horn", "m_deer_hide", "m_thick_vine"],
    treant: ["m_forest_bark", "m_treant_core", "m_forest_moss", "m_forest_sap"],
    toadstool: ["m_toadstool_cap", "m_toad_spore", "m_wild_herb"],
    forestmoth: ["m_moth_wing", "m_forest_moss"],
    b_spider: ["m_spider_silk", "m_queen_fang", "m_spider_eye", "m_spider_crown"],
    // 區2
    scorpion: ["m_scorpion_claw", "m_scorpion_sting", "m_sand_grain"],
    sandworm: ["m_worm_scale", "m_worm_tooth", "m_sand_grain"],
    jackal: ["m_jackal_fang", "m_jackal_pelt", "m_sand_grain"],
    mummy: ["m_mummy_wrap", "m_cursed_dust", "m_ancient_coin", "m_sand_grain"],
    sandhawk: ["m_hawk_feather2", "m_sand_crystal"],
    cobra: ["m_cobra_scale", "m_cobra_venom", "m_desert_gem"],
    b_scorpion: ["m_scorpion_claw", "m_scorpion_sting", "m_sun_relic", "m_scorpion_crown"],
    // 區3
    snowman: ["m_snowman_coal", "m_snowflake", "m_ice_shard"],
    icewisp: ["m_ice_shard", "m_frost_dust", "m_icicle"],
    frostwolf: ["m_frostwolf_fang", "m_frostwolf_pelt", "m_snowflake"],
    yeti: ["m_yeti_fur", "m_yeti_claw", "m_glacier_chunk", "m_frost_heart"],
    yukionna: ["m_yuki_silk", "m_yuki_tear", "m_winter_herb", "m_frost_dust"],
    snowowl: ["m_snowowl_feather", "m_snowflake"],
    b_ice: ["m_ice_shard", "m_blizzard_core", "m_frost_heart", "m_ice_crown"],
    // 區4
    fire: ["m_fire_essence", "m_ember", "m_ash_pile"],
    magma: ["m_magma_rock", "m_magma_core", "m_obsidian"],
    emberhound: ["m_emberhound_fang", "m_emberhound_fur", "m_ember"],
    cindergolem: ["m_cinder_shard", "m_cinder_core", "m_obsidian", "m_sulfur"],
    flamewing: ["m_flamewing_membrane", "m_flamewing_fang", "m_ash_pile"],
    lavaserpent: ["m_lava_scale", "m_lava_venom", "m_magma_rock"],
    b_flame: ["m_magma_core", "m_flame_heart", "m_obsidian", "m_flame_crown"],
    // 區5
    jelly: ["m_jelly_gel", "m_jelly_sting", "m_pearl"],
    octo: ["m_octo_ink", "m_octo_tentacle", "m_sea_crystal", "m_pearl"],
    seaturtle: ["m_turtle_shell", "m_seashell", "m_deep_scale"],
    eel: ["m_eel_skin", "m_eel_spark", "m_deep_scale"],
    anglerfish: ["m_angler_lure", "m_angler_fang", "m_abyssal_pearl"],
    reefshark: ["m_shark_tooth", "m_shark_fin", "m_deep_scale"],
    b_kraken: ["m_octo_tentacle", "m_sea_crystal", "m_abyssal_pearl", "m_kraken_crown"],
    // 區6
    bird: ["m_bird_feather", "m_cloud_wisp"],
    cloudlet: ["m_cloud_wisp", "m_cloud_silk", "m_wind_essence"],
    hawk: ["m_hawk_talon", "m_hawk_feather", "m_sky_feather"],
    thunderbird: ["m_thunder_feather", "m_thunder_spark", "m_sky_crystal"],
    skyguard: ["m_skyguard_plate", "m_sky_crystal", "m_aether_gem"],
    windwisp: ["m_wind_core", "m_wind_essence", "m_holy_feather", "m_star_dust"],
    b_harpy: ["m_sky_feather", "m_holy_feather", "m_aether_gem", "m_harpy_crown"],
    // 區7
    skeleton: ["m_bone_shard", "m_bone_frag", "m_grave_dust"],
    gargoyle: ["m_gargoyle_stone", "m_stone_core", "m_relic_shard"],
    ruinblade: ["m_ruin_blade_frag", "m_bone_shard", "m_dusty_coin"],
    sentinel: ["m_sentinel_plate", "m_stone_core", "m_relic_shard", "m_stone_tablet"],
    cursestone: ["m_cursed_rune", "m_rune_dust", "m_soul_fragment"],
    wraithguard: ["m_wraith_essence", "m_soul_fragment", "m_grave_dust"],
    b_colossus: ["m_stone_core", "m_ancient_ring", "m_cursed_rune", "m_colossus_crown"],
    // 區8
    imp: ["m_imp_horn", "m_imp_tail", "m_hellfire_ember"],
    darkbat: ["m_bat_wing", "m_bat_fang", "m_demon_blood"],
    hellhound: ["m_hell_fang", "m_hell_fur", "m_hellfire_ember"],
    gatekeeper: ["m_demon_plate", "m_demon_horn", "m_dark_crystal", "m_soul_shard"],
    warlock: ["m_warlock_page", "m_dark_crystal", "m_demon_blood"],
    succubus: ["m_succubus_wing", "m_succubus_hair", "m_dark_gem"],
    b_demon: ["m_demon_horn", "m_soul_shard", "m_dark_gem", "m_demon_crown"],
    // 區9
    shadow: ["m_shadow_essence", "m_shadow_silk", "m_void_dust"],
    wraithling: ["m_wraith_soul", "m_void_dust", "m_shadow_essence"],
    voidreaver: ["m_void_fang", "m_void_claw", "m_abyss_horn"],
    abyssguard: ["m_abyss_scale", "m_abyss_stone", "m_void_crystal", "m_dark_heart"],
    soulflayer: ["m_soul_flame", "m_void_eye", "m_wraith_soul", "m_blood_pearl"],
    dreadcaster: ["m_dread_rune", "m_void_crystal", "m_chaos_shard"],
    b_lord: ["m_void_crystal", "m_chaos_shard", "m_blood_pearl", "m_lord_crown"],
  };

  // 可被掉落取得的素材（用於套裝配方只挑「拿得到」的素材）
  const DROPPABLE_MATERIALS = new Set();
  Object.keys(MONSTER_DROPS).forEach((mid) => MONSTER_DROPS[mid].forEach((id) => DROPPABLE_MATERIALS.add(id)));

  // ---- 套裝合成配方（程序化生成；可被 SET_RECIPE_OVERRIDE 手動覆寫）----
  // 依該套裝所屬區的「可掉落素材池」，為每部件決定性配出不同材料，且一定含該區王專屬素材。
  const SET_RECIPE_OVERRIDE = {}; // SET_RECIPE_OVERRIDE[setId][slot] = { materials: { id: qty } }
  function _hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function setRecipe(setId, slot) {
    if (SET_RECIPE_OVERRIDE[setId] && SET_RECIPE_OVERRIDE[setId][slot]) return SET_RECIPE_OVERRIDE[setId][slot];
    const set = SET_BY_ID[setId]; if (!set) return null;
    const pool = (MATERIALS_BY_REGION[set.region] || []).filter((m) => DROPPABLE_MATERIALS.has(m.id));
    const boss = pool.find((m) => m.bossOnly);
    const byR = (rar) => pool.filter((m) => !m.bossOnly && m.rarity === rar);
    const commons = byR("common"), uncommons = byR("uncommon"), rares = byR("rare");
    const h = _hashStr(setId + "|" + slot);
    const pick = (arr, shift) => (arr.length ? arr[(h >>> shift) % arr.length] : null);
    const mats = {};
    const c = pick(commons, 0); if (c) mats[c.id] = 8 + (h % 7);             // common 8..14（量多）
    const u = pick(uncommons, 7); if (u) mats[u.id] = 4 + ((h >>> 4) % 5);    // uncommon 4..8
    if (rares.length && ((h >>> 11) % 2 === 0)) { const ra = pick(rares, 13); if (ra) mats[ra.id] = 2 + ((h >>> 9) % 3); } // 部分部位需 rare 2..4
    if (boss) mats[boss.id] = 1 + ((h >>> 17) % 3);                            // 該區王專屬 1..3（必需）
    return { materials: mats };
  }

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
    // ── 素材掉落（隱藏、不公開）：依素材稀有度的每隻獨立掉率，越稀越難 ──
    materialRate: { common: 0.5, uncommon: 0.25, rare: 0.1, epic: 0.03, legendary: 0.012, mythic: 0.004 },
    bossMatBonus: 1.6,       // 王/精英的素材掉率加成倍率
    chestMatRolls: 4,        // 寶箱怪多擲幾輪素材
    scrollDropChance: 0.08,  // 每殺一隻掉 1 張卷軸(tier0-2)的機率
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
  // ---- 職業樹（36 職）----
  // tier0 冒險者帶絕對 base/growth；一轉/二轉/三轉用 statMul（沿 from 鏈連乘）+ adds（平加）。
  // 轉職不可逆：冒險者 →(Lv15) 一轉7職 →(Lv40) 二轉(每職二選一) →(Lv80) 三轉(1:1)。
  // sprite 指向 Sprites.jobs 的鍵；hd=true 表示 32×32 高密度圖（畫面佔位仍 16×16）。
  // 二轉/三轉本階段：sprite 沿用父職、skills 繼承父職（專屬圖與技能下輪補）。
  const JOBS = [
    { id: "adventurer", name: "冒險者", tier: 0, reqLevel: 1, from: null, to: ["warrior", "guard", "mage", "monk", "archer", "assassin", "bard"],
      range: 1, moveMul: 1.0, atkKind: "melee", color: "#c9d1e0", sprite: "adventurer", hd: true,
      base: { atk: 14, maxHp: 170, def: 3, crit: 0.06, critDmg: 1.6, atkInterval: 0.95, lifesteal: 0, hit: 100, dodge: 15 },
      growth: { atk: 2.6, maxHp: 24, def: 0.6 },
      skills: ["braveslash", "stone", "basictrain"] },
    // 一轉（Lv15）
    { id: "warrior", name: "戰士", tier: 1, reqLevel: 15, from: "adventurer", to: ["greatsword", "lancer"],
      range: 1, moveMul: 1.05, atkKind: "melee", color: "#e0905a", sprite: "warrior", hd: true,
      statMul: { atk: 1.25, maxHp: 1.2, def: 1.15 }, skills: ["crossslash", "warcry", "weaponmaster"] },
    { id: "guard", name: "盾兵", tier: 1, reqLevel: 15, from: "adventurer", to: ["armorlord", "hammerlord"],
      range: 1, moveMul: 0.9, atkKind: "melee", color: "#8fa8c8", sprite: "guard", hd: true,
      statMul: { atk: 0.95, maxHp: 1.5, def: 1.55 }, adds: { dodge: -5 }, skills: ["shieldbash", "bulwark", "ironwall"] },
    { id: "mage", name: "法師", tier: 1, reqLevel: 15, from: "adventurer", to: ["wizard", "icethunder"],
      range: 3, moveMul: 0.85, atkKind: "fireball", color: "#9b59d0", sprite: "mage", hd: true,
      statMul: { atk: 1.45, maxHp: 0.85, def: 0.8 }, adds: { critDmg: 0.2 }, skills: ["fireball", "frostnova", "fastcast"] },
    { id: "monk", name: "僧侶", tier: 1, reqLevel: 15, from: "adventurer", to: ["lightmonk", "darkmonk"],
      range: 3, moveMul: 0.9, atkKind: "holy", color: "#ffe9a8", sprite: "monk", hd: true,
      statMul: { atk: 0.85, maxHp: 1.15, def: 1.1 }, skills: ["healparty", "holybolt", "blessing"] },
    { id: "archer", name: "射手", tier: 1, reqLevel: 15, from: "adventurer", to: ["windranger", "inventor"],
      range: 5, moveMul: 0.95, atkKind: "arrow", color: "#3aa856", sprite: "archer", hd: true, airPriority: true,
      statMul: { atk: 1.15, maxHp: 0.9, def: 0.85 }, adds: { crit: 0.06, hit: 15, dodge: 10 }, skills: ["multishot", "aimshot", "sharpeye"] },
    { id: "assassin", name: "刺客", tier: 1, reqLevel: 15, from: "adventurer", to: ["ninja", "slayer"],
      range: 1, moveMul: 1.45, atkKind: "melee", color: "#5e5e72", sprite: "assassin", hd: true,
      statMul: { atk: 1.2, maxHp: 0.85, def: 0.8 }, adds: { crit: 0.09, critDmg: 0.4, dodge: 25, lifesteal: 0.05 }, skills: ["backstab", "venomblade", "shadowstep"] },
    { id: "bard", name: "樂手", tier: 1, reqLevel: 15, from: "adventurer", to: ["rocker", "symphony"],
      range: 3, moveMul: 0.95, atkKind: "orb", color: "#ef82b0", sprite: "bard", hd: true,
      statMul: { atk: 1.05, maxHp: 1.0, def: 0.95 }, skills: ["soundwave", "warsong", "rhythm"] },
    // 二轉（Lv40；圖/技能暫沿用父職，下輪補專屬）
    { id: "greatsword", name: "大劍士", tier: 2, reqLevel: 40, from: "warrior", to: ["swordmagia"],
      range: 1, moveMul: 1.0, atkKind: "melee", color: "#e07a3a", sprite: "greatsword", hd: true,
      statMul: { atk: 1.35, maxHp: 1.15, def: 1.1 }, skills: ["crossslash", "warcry", "weaponmaster", "heavysmash"] },
    { id: "lancer", name: "長槍士", tier: 2, reqLevel: 40, from: "warrior", to: ["dragoon"],
      range: 2, moveMul: 1.1, atkKind: "melee", color: "#e0a05a", sprite: "lancer", hd: true,
      statMul: { atk: 1.3, maxHp: 1.1, def: 1.15 }, skills: ["crossslash", "warcry", "weaponmaster", "pierce"] },
    { id: "armorlord", name: "鎧武將", tier: 2, reqLevel: 40, from: "guard", to: ["irongeneral"],
      range: 1, moveMul: 0.85, atkKind: "melee", color: "#7a92b8", sprite: "armorlord", hd: true,
      statMul: { atk: 1.05, maxHp: 1.45, def: 1.5 }, skills: ["shieldbash", "bulwark", "ironwall", "ramcharge"] },
    { id: "hammerlord", name: "盾錘將", tier: 2, reqLevel: 40, from: "guard", to: ["omnigeneral"],
      range: 1, moveMul: 0.9, atkKind: "melee", color: "#98b0d0", sprite: "hammerlord", hd: true,
      statMul: { atk: 1.25, maxHp: 1.3, def: 1.3 }, skills: ["shieldbash", "bulwark", "ironwall", "hammerspin"] },
    { id: "wizard", name: "魔術師", tier: 2, reqLevel: 40, from: "mage", to: ["archmage"],
      range: 4, moveMul: 0.85, atkKind: "fireball", color: "#b06ae0", sprite: "wizard", hd: true,
      statMul: { atk: 1.4, maxHp: 0.95, def: 0.9 }, skills: ["fireball", "frostnova", "fastcast", "arcanemissile"] },
    { id: "icethunder", name: "冰雷法師", tier: 2, reqLevel: 40, from: "mage", to: ["wuxing"],
      range: 4, moveMul: 0.85, atkKind: "frost", color: "#6ab0e0", sprite: "icethunder", hd: true,
      statMul: { atk: 1.35, maxHp: 1.0, def: 0.95 }, skills: ["fireball", "frostnova", "fastcast", "thunderice"] },
    { id: "lightmonk", name: "光之僧", tier: 2, reqLevel: 40, from: "monk", to: ["bishop"],
      range: 3, moveMul: 0.9, atkKind: "holy", color: "#ffe45a", sprite: "lightmonk", hd: true,
      statMul: { atk: 1.1, maxHp: 1.25, def: 1.15 }, skills: ["healparty", "holybolt", "blessing", "sanctuary"] },
    { id: "darkmonk", name: "闇之僧", tier: 2, reqLevel: 40, from: "monk", to: ["nightwitch"],
      range: 3, moveMul: 0.9, atkKind: "dark", color: "#8a5fd6", sprite: "darkmonk", hd: true,
      statMul: { atk: 1.3, maxHp: 1.05, def: 1.0 }, skills: ["healparty", "holybolt", "blessing", "darkerode"] },
    { id: "windranger", name: "風行射手", tier: 2, reqLevel: 40, from: "archer", to: ["stormlord"],
      range: 5, moveMul: 1.1, atkKind: "arrow", color: "#5ec4a0", sprite: "windranger", hd: true, airPriority: true,
      statMul: { atk: 1.3, maxHp: 0.95, def: 0.9 }, skills: ["multishot", "aimshot", "sharpeye", "windblades"] },
    { id: "inventor", name: "發明家", tier: 2, reqLevel: 40, from: "archer", to: ["scientist"],
      range: 4, moveMul: 0.9, atkKind: "orb", color: "#c8a04a", sprite: "inventor", hd: true,
      statMul: { atk: 1.35, maxHp: 1.05, def: 1.0 }, skills: ["multishot", "aimshot", "sharpeye", "turretshot"] },
    { id: "ninja", name: "忍者", tier: 2, reqLevel: 40, from: "assassin", to: ["shadownin"],
      range: 1, moveMul: 1.5, atkKind: "melee", color: "#4a4a66", sprite: "ninja", hd: true,
      statMul: { atk: 1.25, maxHp: 0.95, def: 0.9 }, adds: { dodge: 15 }, skills: ["backstab", "venomblade", "shadowstep", "shuriken"] },
    { id: "slayer", name: "殺手", tier: 2, reqLevel: 40, from: "assassin", to: ["bloodfrenzy"],
      range: 1, moveMul: 1.4, atkKind: "melee", color: "#a83a4a", sprite: "slayer", hd: true,
      statMul: { atk: 1.4, maxHp: 0.9, def: 0.85 }, adds: { critDmg: 0.3, lifesteal: 0.05 }, skills: ["backstab", "venomblade", "shadowstep", "deathmark"] },
    { id: "rocker", name: "搖滾歌手", tier: 2, reqLevel: 40, from: "bard", to: ["heavymetal"],
      range: 3, moveMul: 1.0, atkKind: "orb", color: "#e0457a", sprite: "rocker", hd: true,
      statMul: { atk: 1.3, maxHp: 1.0, def: 0.95 }, skills: ["soundwave", "warsong", "rhythm", "powerchord"] },
    { id: "symphony", name: "交響隊員", tier: 2, reqLevel: 40, from: "bard", to: ["conductor"],
      range: 3, moveMul: 0.95, atkKind: "orb", color: "#c89be0", sprite: "symphony", hd: true,
      statMul: { atk: 1.15, maxHp: 1.15, def: 1.1 }, skills: ["soundwave", "warsong", "rhythm", "encore"] },
    // 三轉（Lv80；圖/技能暫沿用，下輪補專屬）
    { id: "swordmagia", name: "劍魔", tier: 3, reqLevel: 80, from: "greatsword", to: [],
      range: 1, moveMul: 1.05, atkKind: "melee", color: "#ff5a2a", sprite: "swordmagia", hd: true,
      statMul: { atk: 1.4, maxHp: 1.2, def: 1.15 }, skills: ["crossslash", "warcry", "weaponmaster", "heavysmash", "magicblade"] },
    { id: "dragoon", name: "龍騎士", tier: 3, reqLevel: 80, from: "lancer", to: [],
      range: 2, moveMul: 1.15, atkKind: "melee", color: "#ffd23f", sprite: "dragoon", hd: true,
      statMul: { atk: 1.35, maxHp: 1.25, def: 1.2 }, skills: ["crossslash", "warcry", "weaponmaster", "pierce", "dragonblood"] },
    { id: "irongeneral", name: "鋼鐵將軍", tier: 3, reqLevel: 80, from: "armorlord", to: [],
      range: 1, moveMul: 0.85, atkKind: "melee", color: "#b8c8e0", sprite: "irongeneral", hd: true,
      statMul: { atk: 1.1, maxHp: 1.45, def: 1.5 }, skills: ["shieldbash", "bulwark", "ironwall", "ramcharge", "ironwill"] },
    { id: "omnigeneral", name: "全武將軍", tier: 3, reqLevel: 80, from: "hammerlord", to: [],
      range: 1, moveMul: 0.95, atkKind: "melee", color: "#d0b860", sprite: "omnigeneral", hd: true,
      statMul: { atk: 1.3, maxHp: 1.3, def: 1.3 }, skills: ["shieldbash", "bulwark", "ironwall", "hammerspin", "omnimastery"] },
    { id: "archmage", name: "大魔術師", tier: 3, reqLevel: 80, from: "wizard", to: [],
      range: 5, moveMul: 0.85, atkKind: "fireball", color: "#d04ae0", sprite: "archmage", hd: true,
      statMul: { atk: 1.45, maxHp: 1.0, def: 0.95 }, skills: ["fireball", "frostnova", "fastcast", "arcanemissile", "arcanemastery"] },
    { id: "wuxing", name: "五行法師", tier: 3, reqLevel: 80, from: "icethunder", to: [],
      range: 5, moveMul: 0.85, atkKind: "frost", color: "#4ae0c8", sprite: "wuxing", hd: true,
      statMul: { atk: 1.4, maxHp: 1.05, def: 1.0 }, skills: ["fireball", "frostnova", "fastcast", "thunderice", "wuxingcycle"] },
    { id: "bishop", name: "光明主教", tier: 3, reqLevel: 80, from: "lightmonk", to: [],
      range: 4, moveMul: 0.9, atkKind: "holy", color: "#fff0c0", sprite: "bishop", hd: true,
      statMul: { atk: 1.15, maxHp: 1.3, def: 1.2 }, skills: ["healparty", "holybolt", "blessing", "sanctuary", "holycrown"] },
    { id: "nightwitch", name: "闇夜巫師", tier: 3, reqLevel: 80, from: "darkmonk", to: [],
      range: 4, moveMul: 0.9, atkKind: "dark", color: "#6a3a9a", sprite: "nightwitch", hd: true,
      statMul: { atk: 1.4, maxHp: 1.1, def: 1.05 }, skills: ["healparty", "holybolt", "blessing", "darkerode", "nightrule"] },
    { id: "stormlord", name: "風暴君", tier: 3, reqLevel: 80, from: "windranger", to: [],
      range: 6, moveMul: 1.15, atkKind: "arrow", color: "#5ad0e0", sprite: "stormlord", hd: true, airPriority: true,
      statMul: { atk: 1.35, maxHp: 1.0, def: 0.95 }, skills: ["multishot", "aimshot", "sharpeye", "windblades", "stormeye"] },
    { id: "scientist", name: "科學偉人", tier: 3, reqLevel: 80, from: "inventor", to: [],
      range: 5, moveMul: 0.9, atkKind: "orb", color: "#e0c84a", sprite: "scientist", hd: true,
      statMul: { atk: 1.4, maxHp: 1.1, def: 1.05 }, skills: ["multishot", "aimshot", "sharpeye", "turretshot", "revolution"] },
    { id: "shadownin", name: "影忍", tier: 3, reqLevel: 80, from: "ninja", to: [],
      range: 1, moveMul: 1.55, atkKind: "melee", color: "#2a2a44", sprite: "shadownin", hd: true,
      statMul: { atk: 1.35, maxHp: 1.0, def: 0.95 }, adds: { dodge: 20 }, skills: ["backstab", "venomblade", "shadowstep", "shuriken", "noshadow"] },
    { id: "bloodfrenzy", name: "嗜血狂人", tier: 3, reqLevel: 80, from: "slayer", to: [],
      range: 1, moveMul: 1.45, atkKind: "melee", color: "#d02a3a", sprite: "bloodfrenzy", hd: true,
      statMul: { atk: 1.5, maxHp: 0.95, def: 0.9 }, adds: { lifesteal: 0.1 }, skills: ["backstab", "venomblade", "shadowstep", "deathmark", "bloodlust"] },
    { id: "heavymetal", name: "重金屬", tier: 3, reqLevel: 80, from: "rocker", to: [],
      range: 3, moveMul: 1.0, atkKind: "orb", color: "#ff3a6a", sprite: "heavymetal", hd: true,
      statMul: { atk: 1.4, maxHp: 1.05, def: 1.0 }, skills: ["soundwave", "warsong", "rhythm", "powerchord", "metalsoul"] },
    { id: "conductor", name: "指揮家", tier: 3, reqLevel: 80, from: "symphony", to: [],
      range: 4, moveMul: 0.95, atkKind: "orb", color: "#e0d0ff", sprite: "conductor", hd: true,
      statMul: { atk: 1.25, maxHp: 1.2, def: 1.15 }, skills: ["soundwave", "warsong", "rhythm", "encore", "maestro"] },
  ];
  const JOB_BY_ID = {};
  JOBS.forEach((j) => (JOB_BY_ID[j.id] = j));
  // 沿 from 鏈回溯到 tier0（含自身、不含 tier0），由近到遠
  function jobPath(jobId) {
    const path = [];
    let j = JOB_BY_ID[jobId];
    while (j && j.from) { path.push(j); j = JOB_BY_ID[j.from]; }
    return path;
  }
  const JOB_TIER_NAMES = ["基礎", "一轉", "二轉", "三轉"];

  // 升級所需經驗：溫和指數×線性 → Lv15 早期可達、Lv40 中期、Lv80 後期、Lv100 終局（可達成）
  function xpForLevel(level) {
    return Math.floor(25 * Math.pow(1.18, level - 1) * level);
  }
  const LEVEL_CAP = 100;

  // ---- 招募 ----
  const NAME_POOL = [
    "亞倫", "莉婭", "凱特", "布魯", "賽恩", "朵拉", "尤里", "米娜", "雷恩", "薇拉",
    "卡爾", "諾雅", "迪克", "艾莉", "歐文", "琪琪", "傑德", "露露", "范恩", "希爾",
    "魯卡", "梅伊", "桑尼", "塔拉", "齊格", "妮可", "巴德", "芙蘿", "柯爾", "黛西",
    "洛基", "安緹", "賈斯", "蜜雪", "東尼", "伊芙", "費歐", "可可", "葛瑞", "小蘭",
  ];
  const RECRUIT = {
    slots: 3,            // 同時 3 名候選
    rollVar: 0.15,       // 初始數值 ±15%
    t1Chance: 0.4,       // 候選為「一轉 Lv15」的機率（其餘為冒險者 Lv1）
    baseCost: 400,       // 冒險者基準價
    t1Cost: 2500,        // 一轉基準價
    refreshGold: (n) => Math.floor(200 * Math.pow(2, n)), // 當日第 n 次手動刷新
  };

  // ---- 職業技能（資料驅動：主動帶 mult/hits/kind/applies/forceCrit/healPct/selfHealPct/partyFx；被動帶 passiveMods）----
  // 戰鬥引擎(game.js updateHeroSkills)與面板(systems.js heroStats)依欄位通用處理，新增技能只需加資料。
  const SK_COST = (b) => (l) => Math.floor(b * Math.pow(1.5, l));
  const HERO_SKILLS = {
    // 冒險者
    braveslash: { name: "勇氣斬", icon: "dagger", type: "active", cooldown: 7, maxLevel: 20,
      desc: "鼓起勇氣的一斬", cost: SK_COST(40), mult: (l) => 1.2 + 0.3 * l, melee: true,
      effectText: (l) => `攻擊×${(1.2 + 0.3 * l).toFixed(1)} 傷害` },
    stone: { name: "投石", icon: "rock", type: "active", cooldown: 9, maxLevel: 20,
      desc: "扔出石塊遠程攻擊", cost: SK_COST(38), mult: (l) => 1.0 + 0.25 * l, kind: "orb",
      effectText: (l) => `攻擊×${(1.0 + 0.25 * l).toFixed(2)} 遠程` },
    basictrain: { name: "基礎鍛鍊", icon: "dumbbell", type: "passive", maxLevel: 20,
      desc: "全面的基礎訓練", cost: SK_COST(35), passiveMods: (l) => ({ atkMul: 0.02 * l, hpMul: 0.02 * l }),
      effectText: (l) => `攻擊 +${l * 2}%、生命 +${l * 2}%` },
    // 戰士
    crossslash: { name: "十字斬", icon: "sword", type: "active", cooldown: 7, maxLevel: 20,
      desc: "交叉的兩道斬擊", cost: SK_COST(42), mult: (l) => 1.4 + 0.35 * l, melee: true,
      effectText: (l) => `攻擊×${(1.4 + 0.35 * l).toFixed(2)} 傷害` },
    warcry: { name: "戰吼", icon: "angry", type: "active", cooldown: 12, maxLevel: 20, selfFx: "berserk", fxDur: 8,
      desc: "怒吼進入狂暴", cost: SK_COST(55),
      effectText: () => `自身狂暴 8 秒（攻擊+50% 移速+50% 受傷+25%）` },
    weaponmaster: { name: "武藝精通", icon: "sword", type: "passive", maxLevel: 20,
      desc: "精進武藝", cost: SK_COST(40), passiveMods: (l) => ({ atkMul: 0.04 * l }),
      effectText: (l) => `攻擊 +${l * 4}%` },
    // 盾兵
    shieldbash: { name: "盾擊", icon: "shield", type: "active", cooldown: 9, maxLevel: 20, applies: "stun",
      desc: "用盾猛擊使敵暈眩", cost: SK_COST(45), mult: (l) => 1.1 + 0.25 * l, melee: true,
      effectText: (l) => `攻擊×${(1.1 + 0.25 * l).toFixed(2)} 並暈眩` },
    bulwark: { name: "壁壘", icon: "shield", type: "active", cooldown: 11, maxLevel: 20,
      desc: "穩住陣腳回復自身", cost: SK_COST(48), selfHealPct: (l) => 0.10 + 0.02 * l,
      effectText: (l) => `回復自身 ${Math.round((0.10 + 0.02 * l) * 100)}% 生命` },
    ironwall: { name: "堅守", icon: "shield", type: "passive", maxLevel: 20,
      desc: "提升生命與防禦", cost: SK_COST(35), passiveMods: (l) => ({ hpMul: 0.05 * l, defMul: 0.06 * l }),
      effectText: (l) => `生命 +${l * 5}%、防禦 +${l * 6}%` },
    // 法師
    fireball: { name: "火球術", icon: "burst", type: "active", cooldown: 9, maxLevel: 20, applies: "burn",
      desc: "火焰傷害並使敵人燃燒", cost: SK_COST(45), mult: (l) => 1.5 + 0.4 * l, kind: "fireball",
      effectText: (l) => `攻擊×${(1.5 + 0.4 * l).toFixed(1)} 並燃燒` },
    frostnova: { name: "冰霜新星", icon: "snow", type: "active", cooldown: 12, maxLevel: 20, applies: "freeze",
      desc: "重擊並冰凍敵人", cost: SK_COST(50), mult: (l) => 1.8 + 0.5 * l, kind: "frost",
      effectText: (l) => `攻擊×${(1.8 + 0.5 * l).toFixed(1)} 並冰凍` },
    fastcast: { name: "詠唱加速", icon: "bolt", type: "passive", maxLevel: 20,
      desc: "施法更快更強", cost: SK_COST(42), passiveMods: (l) => ({ atkSpeedMul: 0.02 * l, atkMul: 0.02 * l }),
      effectText: (l) => `攻速 +${l * 2}%、攻擊 +${l * 2}%` },
    // 僧侶
    healparty: { name: "治癒術", icon: "heal", type: "active", cooldown: 7, maxLevel: 20,
      desc: "回復全隊生命", cost: SK_COST(50), healPct: (l) => 0.08 + 0.02 * l,
      effectText: (l) => `全隊回復 ${Math.round((0.08 + 0.02 * l) * 100)}% 生命` },
    holybolt: { name: "聖光彈", icon: "plus", type: "active", cooldown: 10, maxLevel: 20, applies: "weak",
      desc: "聖光打擊並使敵虛弱", cost: SK_COST(44), mult: (l) => 1.4 + 0.35 * l, kind: "orb",
      effectText: (l) => `攻擊×${(1.4 + 0.35 * l).toFixed(2)} 並虛弱` },
    blessing: { name: "祝福", icon: "bolt", type: "passive", maxLevel: 20,
      desc: "提升攻速與閃避", cost: SK_COST(40), passiveMods: (l) => ({ atkSpeedMul: 0.02 * l, dodgeAdd: 2 * l }),
      effectText: (l) => `攻速 +${l * 2}%、閃避 +${l * 2}` },
    // 射手
    multishot: { name: "多重射擊", icon: "bow", type: "active", cooldown: 9, maxLevel: 20,
      desc: "連射多箭", cost: SK_COST(45), mult: (l) => 1.0 + 0.25 * l, hits: 3, kind: "arrow",
      effectText: (l) => `攻擊×${(1.0 + 0.25 * l).toFixed(2)} ×3` },
    aimshot: { name: "瞄準射擊", icon: "target", type: "active", cooldown: 12, maxLevel: 20, forceCrit: true,
      desc: "精準的必暴一箭", cost: SK_COST(48), mult: (l) => 2.0 + 0.5 * l, kind: "arrow",
      effectText: (l) => `攻擊×${(2.0 + 0.5 * l).toFixed(1)} 必定暴擊` },
    sharpeye: { name: "專注", icon: "target", type: "passive", maxLevel: 20,
      desc: "提升暴擊與暴傷", cost: SK_COST(38), passiveMods: (l) => ({ critAdd: 0.02 * l, critDmgAdd: 0.05 * l }),
      effectText: (l) => `暴擊 +${l * 2}%、暴傷 +${l * 5}%` },
    // 刺客
    backstab: { name: "背刺", icon: "dagger", type: "active", cooldown: 12, maxLevel: 20, forceCrit: true,
      desc: "高暴擊一擊", cost: SK_COST(48), mult: (l) => 2.0 + 0.5 * l, melee: true,
      effectText: (l) => `攻擊×${(2.0 + 0.5 * l).toFixed(1)} 必定暴擊` },
    venomblade: { name: "毒刃", icon: "dagger", type: "active", cooldown: 9, maxLevel: 20, applies: "weak",
      desc: "淬毒之刃使敵虛弱", cost: SK_COST(44), mult: (l) => 1.2 + 0.3 * l, melee: true,
      effectText: (l) => `攻擊×${(1.2 + 0.3 * l).toFixed(1)} 並虛弱` },
    shadowstep: { name: "影步", icon: "boots", type: "passive", maxLevel: 20,
      desc: "身形飄忽難以捉摸", cost: SK_COST(42), passiveMods: (l) => ({ dodgeAdd: 3 * l, critAdd: 0.01 * l }),
      effectText: (l) => `閃避 +${l * 3}、暴擊 +${l}%` },
    // 樂手
    soundwave: { name: "音波衝擊", icon: "bolt", type: "active", cooldown: 9, maxLevel: 20, applies: "paralyze",
      desc: "音波震擊並麻痺", cost: SK_COST(46), mult: (l) => 1.3 + 0.3 * l, kind: "orb",
      effectText: (l) => `攻擊×${(1.3 + 0.3 * l).toFixed(1)} 並麻痺` },
    warsong: { name: "鼓舞戰歌", icon: "flag", type: "active", cooldown: 16, maxLevel: 20, partyFx: "berserk", fxDur: 5,
      desc: "戰歌使全隊狂暴", cost: SK_COST(60),
      effectText: () => `全隊狂暴 5 秒（攻擊+50% 移速+50% 受傷+25%）` },
    rhythm: { name: "韻律", icon: "star", type: "passive", maxLevel: 20,
      desc: "節奏帶動身體", cost: SK_COST(40), passiveMods: (l) => ({ atkMul: 0.03 * l, atkSpeedMul: 0.01 * l }),
      effectText: (l) => `攻擊 +${l * 3}%、攻速 +${l}%` },
    // ── 二轉招牌主動（14）──
    heavysmash: { name: "巨刃崩擊", icon: "sword", type: "active", cooldown: 11, maxLevel: 20, applies: "stun",
      desc: "舉巨刃轟然砸下", cost: SK_COST(70), mult: (l) => 2.2 + 0.5 * l, melee: true,
      effectText: (l) => `攻擊×${(2.2 + 0.5 * l).toFixed(1)} 並暈眩` },
    pierce: { name: "貫穿突刺", icon: "sword", type: "active", cooldown: 8, maxLevel: 20,
      desc: "長槍連刺兩段", cost: SK_COST(66), mult: (l) => 1.5 + 0.38 * l, hits: 2, melee: true,
      effectText: (l) => `攻擊×${(1.5 + 0.38 * l).toFixed(2)} ×2` },
    ramcharge: { name: "鐵壁衝撞", icon: "shield", type: "active", cooldown: 10, maxLevel: 20, applies: "stun",
      desc: "舉盾衝撞敵人", cost: SK_COST(68), mult: (l) => 1.3 + 0.32 * l, melee: true,
      effectText: (l) => `攻擊×${(1.3 + 0.32 * l).toFixed(2)} 並暈眩` },
    hammerspin: { name: "戰錘迴旋", icon: "hammer", type: "active", cooldown: 9, maxLevel: 20,
      desc: "掄起巨錘橫掃", cost: SK_COST(68), mult: (l) => 1.9 + 0.45 * l, melee: true,
      effectText: (l) => `攻擊×${(1.9 + 0.45 * l).toFixed(2)}` },
    arcanemissile: { name: "奧術飛彈", icon: "burst", type: "active", cooldown: 8, maxLevel: 20,
      desc: "連發三枚奧術飛彈", cost: SK_COST(70), mult: (l) => 1.0 + 0.28 * l, hits: 3, kind: "orb",
      effectText: (l) => `攻擊×${(1.0 + 0.28 * l).toFixed(2)} ×3` },
    thunderice: { name: "雷霆冰擊", icon: "snow", type: "active", cooldown: 11, maxLevel: 20, applies: "paralyze",
      desc: "冰與雷的合擊", cost: SK_COST(72), mult: (l) => 1.7 + 0.45 * l, kind: "frost",
      effectText: (l) => `攻擊×${(1.7 + 0.45 * l).toFixed(2)} 並麻痺` },
    sanctuary: { name: "聖域之光", icon: "heal", type: "active", cooldown: 9, maxLevel: 20,
      desc: "強力的全隊治癒", cost: SK_COST(74), healPct: (l) => 0.12 + 0.025 * l,
      effectText: (l) => `全隊回復 ${Math.round((0.12 + 0.025 * l) * 100)}% 生命` },
    darkerode: { name: "暗影侵蝕", icon: "soul", type: "active", cooldown: 10, maxLevel: 20, applies: "weak",
      desc: "黑暗之力侵蝕敵人", cost: SK_COST(70), mult: (l) => 1.7 + 0.45 * l, kind: "dark",
      effectText: (l) => `攻擊×${(1.7 + 0.45 * l).toFixed(2)} 並虛弱` },
    windblades: { name: "風刃亂舞", icon: "bow", type: "active", cooldown: 9, maxLevel: 20,
      desc: "颶風般的四連射", cost: SK_COST(72), mult: (l) => 0.9 + 0.22 * l, hits: 4, kind: "arrow",
      effectText: (l) => `攻擊×${(0.9 + 0.22 * l).toFixed(2)} ×4` },
    turretshot: { name: "機關火銃", icon: "gear", type: "active", cooldown: 10, maxLevel: 20, applies: "burn",
      desc: "火銃轟擊並點燃", cost: SK_COST(70), mult: (l) => 1.5 + 0.4 * l, kind: "fireball",
      effectText: (l) => `攻擊×${(1.5 + 0.4 * l).toFixed(1)} 並燃燒` },
    shuriken: { name: "手裡劍", icon: "star", type: "active", cooldown: 8, maxLevel: 20,
      desc: "擲出兩枚手裡劍", cost: SK_COST(66), mult: (l) => 1.2 + 0.3 * l, hits: 2, kind: "arrow",
      effectText: (l) => `攻擊×${(1.2 + 0.3 * l).toFixed(1)} ×2 遠擲` },
    deathmark: { name: "致命狙殺", icon: "dagger", type: "active", cooldown: 13, maxLevel: 20, forceCrit: true,
      desc: "鎖定要害的一擊", cost: SK_COST(76), mult: (l) => 2.6 + 0.6 * l, melee: true,
      effectText: (l) => `攻擊×${(2.6 + 0.6 * l).toFixed(1)} 必定暴擊` },
    powerchord: { name: "爆音和弦", icon: "bolt", type: "active", cooldown: 10, maxLevel: 20, applies: "stun",
      desc: "震耳欲聾的強力和弦", cost: SK_COST(72), mult: (l) => 1.8 + 0.45 * l, kind: "orb",
      effectText: (l) => `攻擊×${(1.8 + 0.45 * l).toFixed(2)} 並暈眩` },
    encore: { name: "安可樂章", icon: "heal", type: "active", cooldown: 10, maxLevel: 20,
      desc: "療癒人心的樂章", cost: SK_COST(70), healPct: (l) => 0.10 + 0.022 * l,
      effectText: (l) => `全隊回復 ${Math.round((0.10 + 0.022 * l) * 100)}% 生命` },
    // ── 三轉精通被動（14）──
    magicblade: { name: "魔劍共鳴", icon: "sword", type: "passive", maxLevel: 20,
      desc: "與魔劍合而為一", cost: SK_COST(110), passiveMods: (l) => ({ atkMul: 0.05 * l, critDmgAdd: 0.04 * l }),
      effectText: (l) => `攻擊 +${l * 5}%、暴傷 +${l * 4}%` },
    dragonblood: { name: "龍之血脈", icon: "heart", type: "passive", maxLevel: 20,
      desc: "覺醒龍族血統", cost: SK_COST(110), passiveMods: (l) => ({ atkMul: 0.04 * l, hpMul: 0.04 * l }),
      effectText: (l) => `攻擊 +${l * 4}%、生命 +${l * 4}%` },
    ironwill: { name: "鋼鐵意志", icon: "shield", type: "passive", maxLevel: 20,
      desc: "不屈的鋼鐵之軀", cost: SK_COST(105), passiveMods: (l) => ({ hpMul: 0.06 * l, defMul: 0.07 * l }),
      effectText: (l) => `生命 +${l * 6}%、防禦 +${l * 7}%` },
    omnimastery: { name: "全武精通", icon: "sword", type: "passive", maxLevel: 20,
      desc: "十八般武藝樣樣精通", cost: SK_COST(112), passiveMods: (l) => ({ atkMul: 0.035 * l, hpMul: 0.035 * l, defMul: 0.035 * l }),
      effectText: (l) => `攻擊·生命·防禦 +${(l * 3.5).toFixed(1)}%` },
    arcanemastery: { name: "奧術精通", icon: "book", type: "passive", maxLevel: 20,
      desc: "奧術的極致造詣", cost: SK_COST(112), passiveMods: (l) => ({ atkMul: 0.05 * l, atkSpeedMul: 0.015 * l }),
      effectText: (l) => `攻擊 +${l * 5}%、攻速 +${(l * 1.5).toFixed(1)}%` },
    wuxingcycle: { name: "五行循環", icon: "orb", type: "passive", maxLevel: 20,
      desc: "金木水火土生生不息", cost: SK_COST(112), passiveMods: (l) => ({ atkMul: 0.04 * l, critAdd: 0.012 * l }),
      effectText: (l) => `攻擊 +${l * 4}%、暴擊 +${(l * 1.2).toFixed(1)}%` },
    holycrown: { name: "聖光加冕", icon: "plus", type: "passive", maxLevel: 20,
      desc: "受聖光眷顧", cost: SK_COST(108), passiveMods: (l) => ({ hpMul: 0.05 * l, atkSpeedMul: 0.02 * l }),
      effectText: (l) => `生命 +${l * 5}%、攻速 +${l * 2}%` },
    nightrule: { name: "暗夜支配", icon: "soul", type: "passive", maxLevel: 20,
      desc: "黑夜屬於巫師", cost: SK_COST(112), passiveMods: (l) => ({ atkMul: 0.055 * l, dodgeAdd: 2 * l }),
      effectText: (l) => `攻擊 +${(l * 5.5).toFixed(1)}%、閃避 +${l * 2}` },
    stormeye: { name: "風暴之眼", icon: "target", type: "passive", maxLevel: 20,
      desc: "在風暴中心洞悉一切", cost: SK_COST(110), passiveMods: (l) => ({ critAdd: 0.02 * l, atkSpeedMul: 0.02 * l }),
      effectText: (l) => `暴擊 +${l * 2}%、攻速 +${l * 2}%` },
    revolution: { name: "科學革命", icon: "gear", type: "passive", maxLevel: 20,
      desc: "知識就是力量", cost: SK_COST(110), passiveMods: (l) => ({ atkMul: 0.04 * l, critDmgAdd: 0.06 * l }),
      effectText: (l) => `攻擊 +${l * 4}%、暴傷 +${l * 6}%` },
    noshadow: { name: "無影殺", icon: "boots", type: "passive", maxLevel: 20,
      desc: "快到連影子都跟不上", cost: SK_COST(110), passiveMods: (l) => ({ dodgeAdd: 3 * l, critAdd: 0.015 * l }),
      effectText: (l) => `閃避 +${l * 3}、暴擊 +${(l * 1.5).toFixed(1)}%` },
    bloodlust: { name: "嗜血本能", icon: "drop", type: "passive", maxLevel: 20,
      desc: "以血養血", cost: SK_COST(112), passiveMods: (l) => ({ lifestealAdd: 0.01 * l, atkMul: 0.03 * l }),
      effectText: (l) => `吸血 +${l}%、攻擊 +${l * 3}%` },
    metalsoul: { name: "重金屬之魂", icon: "angry", type: "passive", maxLevel: 20,
      desc: "轟鳴不止的靈魂", cost: SK_COST(110), passiveMods: (l) => ({ atkMul: 0.045 * l, critDmgAdd: 0.05 * l }),
      effectText: (l) => `攻擊 +${(l * 4.5).toFixed(1)}%、暴傷 +${l * 5}%` },
    maestro: { name: "大師指揮", icon: "flag", type: "passive", maxLevel: 20,
      desc: "樂團因你而完整", cost: SK_COST(112), passiveMods: (l) => ({ atkMul: 0.03 * l, hpMul: 0.03 * l, atkSpeedMul: 0.015 * l }),
      effectText: (l) => `攻擊·生命 +${l * 3}%、攻速 +${(l * 1.5).toFixed(1)}%` },
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
    // 鑽石包（測試用，售價 NT$0／免費）
    { id: "buy_gems_1k", name: "鑽石包 1K", icon: "gem", cur: "gems", cost: 0, give: { gems: 1000 }, desc: "測試用免費鑽石包（NT$0）" },
    { id: "buy_gems_10k", name: "鑽石包 10K", icon: "gem", cur: "gems", cost: 0, give: { gems: 10000 }, desc: "測試用免費鑽石包（NT$0）" },
    { id: "buy_gems_100k", name: "鑽石包 100K", icon: "gem", cur: "gems", cost: 0, give: { gems: 100000 }, desc: "測試用免費鑽石包（NT$0）" },
    { id: "buy_gems_1m", name: "鑽石包 1M", icon: "gem", cur: "gems", cost: 0, give: { gems: 1000000 }, desc: "測試用免費鑽石包（NT$0）" },
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
    BOSS_RANGE, ENEMY_RANGE, unitRangeForHero, unitRangeForEnemy,
    GRID_STEP_SPEED, LANE_EASE, AIR_LIFT, Z_EASE, CELL_ALIGN_EPS, LANE_ALIGN_EPS,
    ATK_INTERVAL_MUL, KILL_PAUSE, COMBAT_MOVE_MUL,
    FX, PROJECTILE_LIFE, FLOAT_LIFE, PARTICLE_LIFE_MUL,
    heroMoveSpeed, enemyMoveSpeed, enemyRangeRoll,
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
    MATERIALS, MATERIAL_BY_ID, MATERIALS_BY_REGION, MONSTER_DROPS, DROPPABLE_MATERIALS, setRecipe, SET_RECIPE_OVERRIDE,
    STAGE_BOX, stageBoxGold, commonGearCost, COMMON_GEAR_COST, GODDESS_GUARD_COST,
    JOBS, JOB_BY_ID, jobPath, JOB_TIER_NAMES, xpForLevel, LEVEL_CAP, NAME_POOL, RECRUIT,
    HERO_SKILLS, TRAININGS, TALENTS, PRESTIGE,
    PETS, PET_BY_ID, petUpgradeCost,
    SHOP, ACHIEVEMENTS, DAILY_QUESTS,
    PALETTE, THEMES, getTheme,
    OFFLINE_CAP_SECONDS: 8 * 3600,
  };
})();
