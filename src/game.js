/* ============================================================
 * game.js — 遊戲狀態 + 戰鬥模擬 + 關卡進程 + 升級 + 離線結算
 * 全域命名空間：window.Game.Engine
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});
  const D = () => Game.Data;

  // 共用視窗資訊（由 render 設定）。world 寬高與地面位置。
  Game.view = { w: 256, h: 144, ground: 114 };

  function defaultState() {
    return {
      // ---- 持久 ----
      stage: 1,
      killsThisStage: 0,
      gold: 0,
      heroLevel: 1,
      xp: 0,
      equipment: { weapon: 0, armor: 0, accessory: 0 },
      skills: { vit: 0, critUp: 0, fireball: 0, heal: 0, rage: 0 },
      goldPerSec: 0,
      totalKills: 0,
      bestStage: 1,
      // ---- runtime（不存檔）----
      hero: { hp: 0, atkTimer: 0, walkPhase: 0, hitFlash: 0 },
      enemy: null,
      phase: "walking", // walking | fighting | dead
      worldScroll: 0,
      spawnTimer: 0.6,
      deathTimer: 0,
      floats: [],
      skillTimers: { fireball: 5, heal: 8, rage: 12 },
      rageLeft: 0,
      _goldThisSecond: 0,
      _secondTimer: 1,
    };
  }

  let state = defaultState();

  // ---- 有效屬性計算 ----
  function effectiveHero() {
    const d = D();
    const base = d.HERO_BASE,
      g = d.HERO_GROWTH;
    const lvl = state.heroLevel;
    const eq = state.equipment;
    const wb = d.EQUIPMENT.weapon.bonus(eq.weapon);
    const ab = d.EQUIPMENT.armor.bonus(eq.armor);
    const cb = d.EQUIPMENT.accessory.bonus(eq.accessory);

    const vitLv = state.skills.vit;
    const critLv = state.skills.critUp;

    let maxHp = base.maxHp + g.maxHp * (lvl - 1) + (ab.maxHp || 0);
    maxHp = maxHp * (1 + vitLv * 0.05);

    let atk = base.atk + g.atk * (lvl - 1) + (wb.atk || 0);
    if (state.rageLeft > 0) {
      const rageLv = state.skills.rage;
      atk = atk * (1 + (0.5 + 0.1 * rageLv));
    }

    let def = base.def + g.def * (lvl - 1) + (ab.def || 0);
    let crit = base.crit + (cb.crit || 0) + critLv * 0.02;
    crit = Math.min(0.95, crit);
    let atkInterval = base.atkInterval + (cb.atkInterval || 0);
    atkInterval = Math.max(0.25, atkInterval);

    return {
      maxHp: Math.round(maxHp),
      atk: Math.round(atk),
      def: Math.round(def),
      crit,
      critMult: base.critMult,
      atkInterval,
    };
  }

  // 戰力（給玩家一個直觀數字）
  function heroPower() {
    const h = effectiveHero();
    return Math.round(
      (h.atk / h.atkInterval) * 12 + h.maxHp / 4 + h.def * 3
    );
  }

  function xpNeeded() {
    return D().xpForLevel(state.heroLevel);
  }

  // ---- 初始化 / 載入 ----
  function init(loaded) {
    state = defaultState();
    if (loaded) {
      state.stage = loaded.stage || 1;
      state.killsThisStage = loaded.killsThisStage || 0;
      state.gold = Math.max(0, loaded.gold || 0);
      state.heroLevel = loaded.heroLevel || 1;
      state.xp = loaded.xp || 0;
      if (loaded.equipment)
        for (const k of D().EQUIPMENT_ORDER)
          state.equipment[k] = loaded.equipment[k] || 0;
      if (loaded.skills)
        for (const k of D().SKILL_ORDER)
          state.skills[k] = loaded.skills[k] || 0;
      state.goldPerSec = loaded.goldPerSec || 0;
      state.totalKills = loaded.totalKills || 0;
      state.bestStage = loaded.bestStage || state.stage;
    }
    // 重置該關進度，從關卡開頭重來（符合「死亡從該關重來」）
    state.killsThisStage = state.killsThisStage; // 保留已進度（重整視為繼續）
    const h = effectiveHero();
    state.hero.hp = h.maxHp;
    state.enemy = null;
    state.phase = "walking";
    state.spawnTimer = 0.6;
  }

  function applyOfflineGold(amount) {
    state.gold += amount;
  }

  // ---- 敵人生成 ----
  function spawnEnemy() {
    const d = D();
    const isBoss = state.killsThisStage >= d.ENEMIES_PER_STAGE;
    const st = d.makeEnemyStats(state.stage, isBoss);
    const spriteIndex = isBoss
      ? -1
      : (state.stage + state.killsThisStage) % d.ENEMY_SPRITES.length;
    state.enemy = {
      maxHp: st.maxHp,
      hp: st.maxHp,
      atk: st.atk,
      def: st.def,
      gold: st.gold,
      xp: st.xp,
      atkInterval: st.atkInterval,
      atkTimer: st.atkInterval * 0.6,
      gold_: st.gold,
      isBoss,
      spriteIndex,
      x: Game.view.w + 12,
      walkPhase: 0,
      hitFlash: 0,
    };
  }

  // ---- 浮動文字 ----
  function addFloat(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 0.9, vy: -18 });
  }

  // ---- 金幣 / 經驗 ----
  function addGold(amount) {
    state.gold += amount;
    state._goldThisSecond += amount;
  }

  function gainXp(amount) {
    state.xp += amount;
    let leveled = false;
    while (state.xp >= xpNeeded()) {
      state.xp -= xpNeeded();
      const oldMax = effectiveHero().maxHp;
      state.heroLevel++;
      const newMax = effectiveHero().maxHp;
      state.hero.hp += newMax - oldMax; // 升級補滿增加的血量
      leveled = true;
    }
    if (leveled) {
      addFloat(D().HERO_X, Game.view.ground - 40, "升級！", "#ffd23f");
    }
  }

  // ---- 傷害計算 ----
  function computeDamage(atk, def, crit, critMult) {
    const isCrit = Math.random() < crit;
    const raw = atk * (isCrit ? critMult : 1);
    const dmg = Math.max(1, Math.round(raw - def));
    return { dmg, isCrit };
  }

  // ---- 主動技能 ----
  function updateSkills(dt) {
    const d = D();
    const t = state.skillTimers;
    // 火球
    if (state.skills.fireball > 0) {
      t.fireball -= dt;
      if (t.fireball <= 0 && state.enemy && state.phase === "fighting") {
        const h = effectiveHero();
        const lv = state.skills.fireball;
        const dmg = Math.max(1, Math.round(h.atk * (1 + 0.5 * lv)));
        damageEnemy(dmg, true, "#ff7a3d");
        t.fireball = d.SKILLS.fireball.cooldown;
      } else if (t.fireball <= 0 && (!state.enemy || state.phase !== "fighting")) {
        t.fireball = 0; // 就緒，等有敵人
      }
    }
    // 治癒
    if (state.skills.heal > 0) {
      t.heal -= dt;
      if (t.heal <= 0) {
        const h = effectiveHero();
        if (state.hero.hp < h.maxHp) {
          const lv = state.skills.heal;
          const amount = Math.round(h.maxHp * (0.08 + 0.025 * lv));
          state.hero.hp = Math.min(h.maxHp, state.hero.hp + amount);
          addFloat(d.HERO_X, Game.view.ground - 38, "+" + amount, "#5ec46b");
          t.heal = d.SKILLS.heal.cooldown;
        } else {
          t.heal = 0; // 滿血就緒
        }
      }
    }
    // 狂暴
    if (state.skills.rage > 0) {
      t.rage -= dt;
      if (t.rage <= 0 && state.phase === "fighting") {
        state.rageLeft = d.SKILLS.rage.duration;
        addFloat(d.HERO_X, Game.view.ground - 42, "狂暴！", "#ff4d4d");
        t.rage = d.SKILLS.rage.cooldown;
      } else if (t.rage <= 0) {
        t.rage = 0;
      }
    }
    if (state.rageLeft > 0) state.rageLeft = Math.max(0, state.rageLeft - dt);
  }

  function damageEnemy(dmg, isCrit, color) {
    const e = state.enemy;
    if (!e) return;
    e.hp -= dmg;
    e.hitFlash = 0.12;
    addFloat(e.x, Game.view.ground - 30, "" + dmg, color || (isCrit ? "#ffd23f" : "#ffffff"));
    if (e.hp <= 0) killEnemy();
  }

  function killEnemy() {
    const d = D();
    const e = state.enemy;
    if (!e) return;
    addGold(e.gold);
    gainXp(e.xp);
    state.totalKills++;
    if (e.isBoss) {
      state.stage++;
      state.killsThisStage = 0;
      if (state.stage > state.bestStage) state.bestStage = state.stage;
      addFloat(Game.view.w / 2, Game.view.ground - 50, "第 " + state.stage + " 關！", "#7ad7ff");
    } else {
      state.killsThisStage++;
    }
    state.enemy = null;
    state.phase = "walking";
    state.spawnTimer = 0.5;
  }

  // ---- 勇者死亡：從該關重來 ----
  function heroDie() {
    state.phase = "dead";
    state.deathTimer = 1.2;
    state.enemy = null;
    state.killsThisStage = 0; // 從該關開頭重來
    addFloat(D().HERO_X, Game.view.ground - 40, "倒下了…", "#ff4d4d");
  }

  function respawnHero() {
    const h = effectiveHero();
    state.hero.hp = h.maxHp;
    state.phase = "walking";
    state.spawnTimer = 0.8;
    // 重置主動技能冷卻
    state.skillTimers.fireball = 1;
    state.skillTimers.heal = 1;
    state.skillTimers.rage = 1;
    state.rageLeft = 0;
  }

  // ---- 主更新迴圈 ----
  function update(dt) {
    // 限制 dt 避免分頁切換造成大跳躍
    if (dt > 0.1) dt = 0.1;

    // goldPerSec 估計（每秒一次）
    state._secondTimer -= dt;
    if (state._secondTimer <= 0) {
      const rate = state._goldThisSecond;
      state.goldPerSec = state.goldPerSec * 0.8 + rate * 0.2;
      state._goldThisSecond = 0;
      state._secondTimer = 1;
    }

    // 更新浮動文字
    for (let i = state.floats.length - 1; i >= 0; i--) {
      const f = state.floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 14 * dt;
      if (f.life <= 0) state.floats.splice(i, 1);
    }
    if (state.hero.hitFlash > 0) state.hero.hitFlash -= dt;
    if (state.enemy && state.enemy.hitFlash > 0) state.enemy.hitFlash -= dt;

    if (state.phase === "dead") {
      state.deathTimer -= dt;
      state.worldScroll += D().HERO_WALK_SPEED * 0.3 * dt;
      if (state.deathTimer <= 0) respawnHero();
      return;
    }

    updateSkills(dt);

    const d = D();
    const h = effectiveHero();

    if (!state.enemy) {
      // 走路中，等待生成敵人
      state.phase = "walking";
      state.worldScroll += d.HERO_WALK_SPEED * dt;
      state.hero.walkPhase += dt * 6;
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) spawnEnemy();
      return;
    }

    const e = state.enemy;
    const contactX = d.HERO_X + d.CONTACT_RANGE;

    if (e.x > contactX) {
      // 接近中：背景捲動 + 敵人向左走
      state.phase = "walking";
      state.worldScroll += d.HERO_WALK_SPEED * dt;
      state.hero.walkPhase += dt * 6;
      e.x -= (d.ENEMY_SPEED + d.HERO_WALK_SPEED) * dt;
      e.walkPhase += dt * 6;
      if (e.x < contactX) e.x = contactX;
      return;
    }

    // 戰鬥中
    state.phase = "fighting";

    // 勇者攻擊
    state.hero.atkTimer -= dt;
    if (state.hero.atkTimer <= 0) {
      const r = computeDamage(h.atk, e.def, h.crit, h.critMult);
      damageEnemy(r.dmg, r.isCrit);
      state.hero.atkTimer = h.atkInterval;
      if (!state.enemy) return; // 敵人已死
    }

    // 敵人攻擊
    if (state.enemy) {
      e.atkTimer -= dt;
      if (e.atkTimer <= 0) {
        const r = computeDamage(e.atk, h.def, 0.05, 1.5);
        state.hero.hp -= r.dmg;
        state.hero.hitFlash = 0.12;
        addFloat(d.HERO_X + 6, Game.view.ground - 36, "" + r.dmg, "#ff6b6b");
        e.atkTimer = e.atkInterval;
        if (state.hero.hp <= 0) {
          state.hero.hp = 0;
          heroDie();
        }
      }
    }
  }

  // ---- 升級：裝備 ----
  function upgradeEquipment(slot) {
    const d = D();
    const def = d.EQUIPMENT[slot];
    if (!def) return false;
    const lvl = state.equipment[slot];
    const cost = def.cost(lvl);
    if (state.gold < cost) return false;
    const oldMax = effectiveHero().maxHp;
    state.gold -= cost;
    state.equipment[slot] = lvl + 1;
    const newMax = effectiveHero().maxHp;
    if (newMax > oldMax) state.hero.hp += newMax - oldMax;
    return true;
  }

  // ---- 升級：技能 ----
  function upgradeSkill(id) {
    const d = D();
    const def = d.SKILLS[id];
    if (!def) return false;
    const lvl = state.skills[id];
    if (lvl >= def.maxLevel) return false;
    const cost = def.cost(lvl);
    if (state.gold < cost) return false;
    const oldMax = effectiveHero().maxHp;
    state.gold -= cost;
    state.skills[id] = lvl + 1;
    const newMax = effectiveHero().maxHp;
    if (newMax > oldMax) state.hero.hp += newMax - oldMax;
    return true;
  }

  // ---- 存檔資料 ----
  function toSaveData() {
    return {
      stage: state.stage,
      killsThisStage: state.killsThisStage,
      gold: state.gold,
      heroLevel: state.heroLevel,
      xp: state.xp,
      equipment: { ...state.equipment },
      skills: { ...state.skills },
      goldPerSec: state.goldPerSec,
      totalKills: state.totalKills,
      bestStage: state.bestStage,
      lastSaveTime: Date.now(),
    };
  }

  Game.Engine = {
    init,
    update,
    applyOfflineGold,
    upgradeEquipment,
    upgradeSkill,
    toSaveData,
    effectiveHero,
    heroPower,
    xpNeeded,
    get state() {
      return state;
    },
  };
})();
