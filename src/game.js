/* ============================================================
 * game.js — 戰鬥引擎（出戰隊伍 vs 多敵人波次）
 * 讀取 Systems.heroStats / 結算 Systems.onKill；持有 runtime battle。
 * 全域命名空間：window.Game.Engine
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});
  const D = () => Game.Data;
  const S = () => Game.Systems;

  Game.view = { w: 256, h: 144, ground: 114 };

  let battle = null;

  function newBattle() {
    return {
      field: [], enemies: [], floats: [], projectiles: [], particles: [],
      phase: "walking", worldScroll: 0, walkPhase: 0,
      killsNeeded: 0, killedThisStage: 0, toSpawn: 0, spawnCD: 0.5,
      allDeadTimer: 0, reviveTimer: D().IDLE_REVIVE_INTERVAL,
      flow: "march", marchTimer: D().MARCH_TIME, bannerTimer: 0, banner: null, holdTimer: 0,
    };
  }
  function setBanner(text, color) { battle.banner = { text: text, color: color }; }
  function approach(cur, target, stepAmt) {
    if (cur < target) return Math.min(target, cur + stepAmt);
    if (cur > target) return Math.max(target, cur - stepAmt);
    return cur;
  }
  // ---- 格子座標（縱線每 ENEMY_GAP 一條、單位置中於格內 16k+8）----
  function snapCell(x) { const g = D().ENEMY_GAP, h = g / 2; return Math.round((x - h) / g) * g + h; }
  function cellX(gcol) { const g = D().ENEMY_GAP; return gcol * g + g / 2; }
  function colOfX(x) { const g = D().ENEMY_GAP; return Math.round((x - g / 2) / g); }
  function ncols() { return Math.max(1, Math.floor(Game.view.w / D().ENEMY_GAP)); }
  function clampCol(c) { return Math.max(0, Math.min(ncols() - 1, c)); }
  // 一個行距＝一格：近戰(1)只能打正交相鄰格，弓3/法2/補2/王5 可斜向打到半徑內
  function gridDist(aL, aC, bL, bC) { return Math.hypot(aC - bC, aL - bL); }
  function nearestOpp(u, list) {
    let best = null, bestD = Infinity;
    for (const o of list) { const dd = gridDist(u.glane, u.gcol, o.glane, o.gcol); if (dd < bestD) { bestD = dd; best = o; } }
    return { target: best, dist: bestD };
  }
  function nearestDistFrom(l, c, list) {
    let m = Infinity;
    for (const o of list) { const dd = gridDist(l, c, o.glane, o.gcol); if (dd < m) m = dd; }
    return m;
  }
  function aliveEnemies() { return battle.enemies.filter((e) => e.air <= 0); }
  function aliveHeroes() { return battle.field.filter((h) => !h.dead && !h.isPet); }
  function unitSettled(u) {
    const d = D();
    return Math.abs(u.x - cellX(u.gcol)) <= d.CELL_ALIGN_EPS && Math.abs(u.laneF - u.glane) <= d.LANE_ALIGN_EPS;
  }
  function animateUnit(u, dt, mul) {
    const d = D();
    u.x = approach(u.x, u.moveTX, (u.moveSpeed || d.GRID_STEP_SPEED) * (mul || 1) * fxMoveMul(u) * dt);
    u.laneF += (u.glane - u.laneF) * Math.min(1, d.LANE_EASE * dt);
    if (Math.abs(u.laneF - u.glane) <= d.LANE_ALIGN_EPS) u.laneF = u.glane;
    u.lane = u.glane;
  }
  // 英雄/寵物回 home 格（行軍、勝利、切模式用）
  function animateHome(h, dt) { h.glane = h.homeLane; h.gcol = h.homeCol; h.moveTX = cellX(h.homeCol); animateUnit(h, dt); }
  function resetHeroesHome() {
    battle.field.forEach((h) => {
      h.glane = h.homeLane; h.gcol = h.homeCol; h.lane = h.homeLane; h.laneF = h.homeLane;
      h.x = cellX(h.homeCol); h.moveTX = h.x;
      h.fx = {}; h.burnTick = 0; h.rageMul = 1; // 清除狀態效果
    });
  }

  // ---- 建立出戰隊伍 runtime ----
  function buildField() {
    const st = Game.State, d = D();
    const mods = S().globalMods();
    const layout = S().formationLayout();
    battle.field = layout.map((slot, i) => {
      const bx = d.PARTY_X - slot.col * d.FORM_COL_GAP;
      const gcol = clampCol(colOfX(snapCell(bx))); // home 格子欄
      const grid = { gcol, glane: slot.lane, laneF: slot.lane, homeCol: gcol, homeLane: slot.lane, moveTX: cellX(gcol) };
      if (slot.kind === "pet") {
        const pdef = d.PET_BY_ID[slot.id];
        const stats = S().petStats(slot.id) || { maxHp: 1, def: 0, dodge: 0, hit: 0, atk: 0, atkInterval: 99, crit: 0, critDmg: 1 };
        return Object.assign({
          isPet: true, petId: slot.id, heroId: null, sprite: Game.Sprites.pets[pdef.sprite],
          stats, maxHp: stats.maxHp, hp: stats.maxHp, range: 1, moveSpeed: d.GRID_STEP_SPEED,
          atkTimer: 1e9, lane: slot.lane, col: slot.col,
          baseX: bx, x: cellX(gcol), lift: 0,
          hitFlash: 0, shake: 0, lunge: 0, dead: false, rageLeft: 0, rageMul: 1, fx: {}, burnTick: 0,
          actives: [], skillTimers: {},
        }, grid);
      }
      const heroId = slot.id;
      const stats = S().heroStats(heroId, mods);
      const def = d.HERO_BY_ID[heroId];
      const actives = def.skills.filter(
        (sid) => d.HERO_SKILLS[sid].type === "active" && (st.heroes[heroId].skills[sid] || 0) > 0
      );
      const timers = {};
      actives.forEach((sid) => (timers[sid] = d.HERO_SKILLS[sid].cooldown));
      return Object.assign({
        heroId, sprite: Game.Sprites.heroes[def.sprite],
        stats, maxHp: stats.maxHp, hp: stats.maxHp,
        range: d.unitRangeForHero(def.cls), moveSpeed: d.heroMoveSpeed(def.cls),
        atkTimer: stats.atkInterval * (0.4 + i * 0.15),
        lane: slot.lane, col: slot.col,
        baseX: bx, x: cellX(gcol), lift: 0,
        hitFlash: 0, shake: 0, lunge: 0, dead: false, rageLeft: 0, rageMul: 1, fx: {}, burnTick: 0,
        actives, skillTimers: timers,
      }, grid);
    });
  }

  // 每幀刷新英雄屬性（反映養成升級），維持目前 hp 比例
  function refreshFieldStats() {
    const mods = S().globalMods();
    battle.field.forEach((h) => {
      if (h.isPet) return; // 寵物數值不靠 heroStats 重算
      const ns = S().heroStats(h.heroId, mods);
      if (!ns) return;
      h.stats = ns;
      if (ns.maxHp !== h.maxHp) {
        const diff = ns.maxHp - h.maxHp;
        h.maxHp = ns.maxHp;
        if (diff > 0 && !h.dead) h.hp = Math.min(h.maxHp, h.hp + diff);
        else h.hp = Math.min(h.hp, h.maxHp);
      }
    });
  }

  // ---- 設定關卡 ----
  function setupStage(stage) {
    S().noteStage(stage);
    const boss = D().isBossStage(stage);
    battle.killsNeeded = boss ? 1 : D().KILLS_PER_STAGE;
    battle.killedThisStage = 0;
    battle.toSpawn = battle.killsNeeded;
    battle.enemies = [];
    battle.spawnCD = 0.3;
    battle.phase = "walking";
  }

  // 從右側走進場（不再天降）；startSlot 用於整波同時出場時錯開起始 x，形成縱隊
  function spawnEnemy(lane, startSlot) {
    const st = Game.State;
    const stage = st.stage;
    const boss = D().isBossStage(stage);
    if (boss) lane = 1; // 魔王固定中行
    if (lane == null) lane = Math.floor(Math.random() * D().LANES);
    const slot = startSlot || 0;
    const r = D().regionOf(stage);
    const stx = D().makeEnemyStats(stage, boss);
    let sprite;
    if (boss) {
      const pool = Game.Sprites.bossForRegion(r);
      sprite = pool[Math.floor(stage / D().BOSS_EVERY) % pool.length];
    } else {
      const pool = Game.Sprites.smallForRegion(r);
      sprite = pool[Math.floor(Math.random() * pool.length)];
    }
    // 寶箱怪：region>=1、非魔王關，低機率出現；脆但肉、掉裝率高
    const chest = !boss && r >= D().DROP.minRegion && Math.random() < D().DROP.chestSpawnChance;
    // 精英怪：非魔王、非寶箱，出現比率隨關卡指數成長（900 關封頂 33%）；較肉、金幣較多
    const elite = !boss && !chest && Math.random() < D().eliteRatio(stage);
    let maxHp = stx.maxHp, atk = stx.atk, gold = stx.gold;
    if (chest) { maxHp = Math.floor(maxHp * 2.5); atk = Math.floor(atk * 0.6); gold = Math.floor(gold * 4); }
    else if (elite) { const E = D().ELITE; maxHp = Math.floor(maxHp * E.hpMul); atk = Math.floor(atk * E.atkMul); gold = Math.floor(gold * E.goldMul); }
    const range = boss ? D().BOSS_RANGE : D().enemyRangeRoll(stage); // 少數遠程(2~5)、多數近戰(1)
    const eskill = D().enemySkillFor(boss, elite); // 精英/魔王才有技能
    battle.enemies.push({
      maxHp: maxHp, hp: maxHp, atk: atk, def: stx.def,
      gold: gold, xp: stx.xp, gems: stx.gems, atkInterval: stx.atkInterval,
      hit: stx.hit, dodge: stx.dodge,
      atkTimer: stx.atkInterval * 0.7, isBoss: boss, isChest: chest, isElite: elite, sprite,
      range: range, moveSpeed: D().enemyMoveSpeed(range, boss),
      eskill: eskill, eskillCD: eskill ? D().ENEMY_SKILLS[eskill].cd * (0.5 + Math.random() * 0.6) : 0,
      fx: {}, burnTick: 0,
      x: Game.view.w + 6 + slot * D().ENEMY_GAP + Math.random() * 4, targetX: 0, lane: lane, air: 0, vy: 0,
      gcol: clampCol(colOfX(Game.view.w + 6 + slot * D().ENEMY_GAP)), glane: lane, laneF: lane,
      moveTX: Game.view.w + 6 + slot * D().ENEMY_GAP,
      hitFlash: 0, shake: 0, lunge: 0,
    });
  }

  // 隨機挑一個還有空位（< ENEMY_COLS）的行
  function laneWithRoom() {
    const d = D(), cnt = [0, 0, 0];
    battle.enemies.forEach((e) => { cnt[e.lane] = (cnt[e.lane] || 0) + 1; });
    const avail = [];
    for (let L = 0; L < d.LANES; L++) if ((cnt[L] || 0) < d.ENEMY_COLS) avail.push(L);
    return avail.length ? avail[Math.floor(Math.random() * avail.length)] : null;
  }
  function spawnEnemyRoom() {
    const L = laneWithRoom();
    if (L == null) return;
    spawnEnemy(L);
    // 指派該行最右側的空格當進場格（避免與任何單位＝敵/英/寵共格）
    const e = battle.enemies[battle.enemies.length - 1];
    const occ = {};
    battle.enemies.forEach((o) => { if (o !== e && o.glane === L) occ[o.gcol] = 1; });
    battle.field.forEach((o) => { if (!o.dead && o.glane === L) occ[o.gcol] = 1; });
    let gc = -1;
    for (let c = ncols() - 1; c >= 0; c--) { if (!occ[c]) { gc = c; break; } }
    if (gc < 0) { battle.enemies.pop(); return; } // 該行已滿（罕見）→ 取消本次生成
    e.gcol = gc; e.glane = L; e.laneF = L; e.moveTX = cellX(gc);
  }
  // 整波一次出場：依該關敵人數量隨機分布到 3 行×ENEMY_COLS 的格子，全部從右側走進來
  function spawnWave() {
    const d = D();
    battle.enemies = [];
    if (d.isBossStage(Game.State.stage)) { spawnEnemy(1, 0); battle.toSpawn = 0; return; }
    const cnt = [0, 0, 0];
    const n = Math.min(battle.toSpawn, d.LANES * d.ENEMY_COLS);
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const avail = [];
      for (let L = 0; L < d.LANES; L++) if (cnt[L] < d.ENEMY_COLS) avail.push(L);
      if (!avail.length) break;
      const L = avail[Math.floor(Math.random() * avail.length)];
      spawnEnemy(L, cnt[L]);
      cnt[L]++; placed++;
    }
    battle.toSpawn -= placed;
  }
  function startEncounter() {
    battle.flow = "encounter";
    if (battle.pendingParty) { buildField(); battle.pendingParty = false; } // 套用本輪結束前累積的出戰/位置調整
    resetHeroesHome(); // 英雄在 home 格等待
    spawnWave();        // 敵人從右側外出場、走進集結格
    setBanner("遭遇敵人", "#ffd23f");
    battle.bannerTimer = 1;
  }

  // ---- 浮動文字 / 投射物 ----
  function addFloat(x, y, text, color, big) {
    battle.floats.push({ x: x + (Math.random() - 0.5) * 6, y, text, color, life: D().FLOAT_LIFE, vy: -14, big: !!big });
  }
  function addProjectile(x, y, tx, ty, color, kind) {
    battle.projectiles.push({ x, y, tx, ty, color, kind: kind || "orb", life: D().PROJECTILE_LIFE, t: 0 });
  }
  function addParticle(type, x, y, vx, vy, life, color) {
    life *= D().PARTICLE_LIFE_MUL; // 動畫變持久
    battle.particles.push({ type, x, y, vx, vy, life, life0: life, color });
  }
  function addSlash(x, y) {
    const l = 0.18 * D().PARTICLE_LIFE_MUL;
    battle.particles.push({ type: "slash", x, y, vx: 0, vy: 0, life: l, life0: l, color: "#ffffff" });
  }
  function spark(x, y, n, color) {
    for (let k = 0; k < n; k++)
      addParticle("spark", x, y, (Math.random() - 0.5) * 64, -22 - Math.random() * 40,
        0.18 + Math.random() * 0.22, k % 2 ? "#ffffff" : color);
  }

  // ---- 狀態效果（暈眩/冰凍/燃燒/麻痺/虛弱/狂暴）----
  function fxAdd(u, k, dur) {
    if (!u.fx) u.fx = {};
    // 同一時間只能附帶一個狀態：已有其他狀態 → 不再被附加（同狀態可刷新時間）
    for (const e in u.fx) { if (u.fx[e] > 0 && e !== k) return false; }
    u.fx[k] = Math.max(u.fx[k] || 0, dur);
    if (k === "burn") u.burnTick = 1; // 燃燒每秒結算（首次 1 秒後）
    return true;
  }
  function fxHas(u, k) { return !!(u.fx && u.fx[k] > 0); }
  function fxFlag(u, flag) { const F = D().FX; if (u.fx) for (const k in u.fx) if (u.fx[k] > 0 && F[k] && F[k][flag]) return true; return false; }
  function fxBlockMove(u) { return fxFlag(u, "blockMove"); }
  function fxBlockAct(u) { return fxFlag(u, "blockAct"); }
  function fxMul(u, field) { const F = D().FX; let m = 1; if (u.fx) for (const k in u.fx) if (u.fx[k] > 0 && F[k] && F[k][field] != null) m *= F[k][field]; return m; }
  function fxOutMul(u) { return fxMul(u, "outMul"); }
  function fxInMul(u) { return fxMul(u, "inMul"); }
  function fxMoveMul(u) { return fxMul(u, "moveMul"); }
  function fxDefMul(u) { return fxMul(u, "defMul"); }
  function effDefEnemy(t) { return (t.def || 0) * fxDefMul(t); }
  function effDefHero(t) { return (t.stats.def || 0) * fxDefMul(t); }
  // 狀態計時 + 燃燒 DoT（只在戰鬥迴圈內呼叫）
  function fxTick(u, dt, isHero) {
    if (!u.fx) return;
    for (const k in u.fx) { u.fx[k] -= dt; if (u.fx[k] <= 0) { delete u.fx[k]; if (k === "berserk") u.rageMul = 1; } }
    if (fxHas(u, "burn")) {
      u.burnTick = (u.burnTick || 0) - dt;
      while (u.burnTick <= 0 && !u.dead && u.hp > 0) {
        u.burnTick += 1;
        const base = Math.max(1, Math.round(u.maxHp * D().FX.burn.dotPct));
        if (isHero) {
          const dmg = Math.max(1, Math.round(base * fxInMul(u)));
          u.hp -= dmg; u.hitFlash = 0.1;
          addFloat(u.x, D().laneY(Game.view.ground, u.lane) - 20, "" + dmg, "#ff7a3d");
          if (u.hp <= 0) { u.hp = 0; u.dead = true; if (!battle.field.some((hh) => !hh.dead && !hh.isPet)) battle.allDeadTimer = 1.4; }
        } else {
          damageEnemy(u, base, { noProc: true, color: "#ff7a3d" }); // damageEnemy 內含 inMul
        }
      }
    }
  }

  // 英雄目標：以自己為中心向外找最近的敵人（格子距離）；技能/連擊沿用
  function heroTarget(h) { return nearestOpp(h, aliveEnemies()).target; }
  // 任一存活英雄（行軍揚塵用）
  function frontHeroAny() {
    let f = null;
    for (const h of battle.field) if (!h.dead && !h.isPet && (!f || h.gcol < f.gcol)) f = h;
    return f;
  }

  function rollDamage(atk, crit, critDmg, def) {
    const isCrit = Math.random() < crit;
    const raw = atk * (isCrit ? critDmg : 1);
    return { dmg: Math.max(1, Math.round(raw - def)), isCrit };
  }

  function damageEnemy(target, dmg, opts) {
    if (!target) return;
    opts = opts || {};
    dmg = Math.max(1, Math.round(dmg * fxInMul(target))); // 受傷倍率（狂暴/虛弱/麻痺）
    target.hp -= dmg;
    target.hitFlash = 0.12;
    target.shake = 0.14;
    const col = opts.color || (opts.crit ? "#ffd23f" : "#ffffff");
    addFloat(target.x, Game.view.ground - 32, "" + dmg, col, opts.crit);
    addParticle("flash", target.x, Game.view.ground - 14, 0, 0, opts.crit ? 0.3 : 0.22, "#ffffff");
    spark(target.x, Game.view.ground - 14, opts.crit ? 9 : 5, col);
    if (opts.melee) addSlash(target.x - 4, Game.view.ground - 18);
    if (opts.lifesteal && opts.src && !opts.src.dead) {
      opts.src.hp = Math.min(opts.src.maxHp, opts.src.hp + Math.max(1, Math.round(dmg * opts.lifesteal)));
    }
    // 套裝特殊機制（僅主要命中觸發，noProc 防遞迴）
    const st = opts.src && opts.src.stats;
    if (st && !opts.noProc) {
      // 斬殺：低血直接擊殺（魔王免疫）
      if (st.execute && !target.isBoss && target.hp > 0 && target.hp <= target.maxHp * st.execute) {
        target.hp = 0;
        addFloat(target.x, Game.view.ground - 42, "斬殺", "#ff4d4d", true);
      }
      // 爆炸濺射：對場上其他敵人造成本次傷害 × 比例
      if (st.explode) {
        const splash = Math.max(1, Math.round(dmg * st.explode));
        battle.enemies.slice().forEach((e) => {
          if (e !== target && e.hp > 0) damageEnemy(e, splash, { src: opts.src, noProc: true, color: "#ff9a3d" });
        });
      }
    }
    if (target.hp <= 0) killEnemy(target);
  }

  function killEnemy(target) {
    const i = battle.enemies.indexOf(target);
    if (i < 0) return;
    const drop = S().onKill(target);
    if (drop) {
      if (drop.scroll) {
        const sName = D().scrollTierName(drop.tier || 0);
        addFloat(target.x, Game.view.ground - 46, "卷軸", "#c79bff", true);
        if (Game.UI && Game.UI.toast) Game.UI.toast("獲得 " + sName);
      } else {
        const set = D().SET_BY_ID[drop.setId];
        const ra = D().RARITY_BY_ID[drop.rarity];
        const slotName = D().SLOT_BY_ID[drop.slot].name;
        addFloat(target.x, Game.view.ground - 46, "★裝備", set ? set.color : "#ffd23f", true);
        if (Game.UI && Game.UI.toast)
          Game.UI.toast(set ? `獲得【${set.name}·${slotName}】(${ra.name})` : `獲得 ${ra.name}${slotName}`);
      }
    }
    // 掉落金幣飛出特效（打怪不掉鑽石）
    const n = target.isBoss ? 9 : 3;
    for (let k = 0; k < n; k++)
      addParticle("coin", target.x, Game.view.ground - 14,
        (Math.random() - 0.5) * 36, -45 - Math.random() * 35, 0.7 + Math.random() * 0.3,
        "#ffd23f");
    battle.enemies.splice(i, 1);
    battle.killedThisStage++;
  }

  // ---- 主動技能 ----
  function updateHeroSkills(h, dt) {
    if (fxBlockAct(h)) return false; // 暈眩/冰凍：不能放技
    const gy = Game.view.ground, hy = D().laneY(gy, h.lane);
    const tgt = nearestOpp(h, aliveEnemies());
    const fe = tgt.target;
    const feInRange = !!fe && tgt.dist <= h.range; // 傷害型技能需在攻擊距離內
    let fired = false;
    h.actives.forEach((sid) => {
      h.skillTimers[sid] -= dt;
      if (h.skillTimers[sid] > 0) return;
      const def = D().HERO_SKILLS[sid];
      const lv = Game.State.heroes[h.heroId].skills[sid] || 0;
      if (sid === "heal") {
        // 找最缺血隊友
        let need = false;
        battle.field.forEach((t) => { if (!t.dead && t.hp < t.maxHp) need = true; });
        if (!need) { h.skillTimers[sid] = 0; return; }
        const pct = 0.08 + 0.02 * lv;
        battle.field.forEach((t) => {
          if (t.dead) return;
          const amt = Math.round(t.maxHp * pct);
          t.hp = Math.min(t.maxHp, t.hp + amt);
        });
        addFloat(h.x, hy - 28, def.name, "#5ec46b", true); // 技能名稱（治癒術）
        battle.field.forEach((t) => {
          if (t.dead) return;
          for (let k = 0; k < 3; k++) addParticle("heal", t.x + (Math.random() - 0.5) * 8, D().laneY(gy, t.lane) - 6, (Math.random() - 0.5) * 8, -16 - Math.random() * 10, 0.5 + Math.random() * 0.2, "#7df09a");
        });
        h.skillTimers[sid] = def.cooldown; fired = true;
      } else if (sid === "rage") {
        if (!fe) { h.skillTimers[sid] = 0; return; }
        fxAdd(h, def.applies || "berserk", def.duration); // 進入狂暴狀態（攻擊由 fxOutMul 承擔）
        h.rageMul = 1;
        addFloat(h.x, hy - 28, def.name, "#ff4d4d", true); // 技能名稱（狂暴）
        spark(h.x, hy - 8, 9, "#ff7a7a"); // 紅色狂暴氣焰
        h.skillTimers[sid] = def.cooldown; fired = true;
      } else {
        // 傷害型技能（需在攻擊距離內）
        if (!feInRange) { h.skillTimers[sid] = 0; return; }
        let mult = 1.5, hits = 1, forceCrit = false, color = "#ffce54", kind = null, melee = false;
        if (sid === "slash") { mult = 1.2 + 0.3 * lv; color = "#ffd76a"; melee = true; }
        else if (sid === "fireball") { mult = 1.5 + 0.4 * lv; color = "#ff7a3d"; kind = "fireball"; }
        else if (sid === "frost") { mult = 1.8 + 0.5 * lv; color = "#7ad7ff"; kind = "frost"; }
        else if (sid === "multishot") { mult = 1.0 + 0.25 * lv; hits = 3; color = "#bfe24a"; kind = "arrow"; }
        else if (sid === "backstab") { mult = 2.0 + 0.5 * lv; forceCrit = true; color = "#ff4d4d"; melee = true; }
        const ty = D().laneY(gy, fe.lane);
        addFloat(h.x, hy - 30, def.name, color, true); // 技能名稱
        h.lunge = melee ? 7 : 3;
        for (let k = 0; k < hits; k++) {
          if (fe.hp <= 0 || battle.enemies.indexOf(fe) < 0) break; // 連射：目標中途死亡 → 取消剩餘
          if (kind) addProjectile(h.x, hy - 16, fe.x, ty - 8, color, kind);
          if (melee) addSlash(fe.x - 4, gy - 18);
          const isCrit = forceCrit || Math.random() < h.stats.crit;
          const raw = h.stats.atk * fxOutMul(h) * mult * (isCrit ? h.stats.critDmg : 1);
          const dmg = Math.max(1, Math.round(raw - effDefEnemy(fe)));
          damageEnemy(fe, dmg, { crit: isCrit, color: color, src: h, lifesteal: h.stats.lifesteal, melee: melee });
          if (k === 0 && def.applies && fe.hp > 0) fxAdd(fe, def.applies, D().FX[def.applies].dur); // 命中附加效果（首發）
          if (!battle.enemies.length) break;
        }
        // 命中特效
        if (kind === "fireball") { spark(fe.x, gy - 14, 11, "#ff9a3d"); addParticle("flash", fe.x, gy - 14, 0, 0, 0.32, "#ffce54"); }
        else if (kind === "frost") { spark(fe.x, gy - 14, 9, "#9fe8ff"); }
        h.skillTimers[sid] = def.cooldown; fired = true;
      }
    });
    return fired;
  }

  // ---- 敵人技能（精英/魔王）：治療自身 或 遠程重擊；名稱顯示在戰鬥畫面 ----
  function updateEnemySkills(e, dt) {
    if (!e.eskill || fxBlockAct(e)) return false; // 暈眩/冰凍：不能放技
    const sk = D().ENEMY_SKILLS[e.eskill];
    e.eskillCD -= dt;
    if (e.eskillCD > 0 || e.pauseT > 0 || !unitSettled(e)) return false;
    const gy = Game.view.ground, ey = D().laneY(gy, e.lane);
    if (e.eskill === "heal") {
      if (e.hp >= e.maxHp) { e.eskillCD = 1; return false; }
      e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * sk.pct));
      addFloat(e.x, ey - 26, sk.name, sk.color, true);
      for (let k = 0; k < 4; k++) addParticle("heal", e.x + (Math.random() - 0.5) * 8, ey - 6, (Math.random() - 0.5) * 8, -16 - Math.random() * 10, 0.5, "#7df09a");
      e.eskillCD = sk.cd;
      return true;
    }
    // bolt / flame / 效果彈：遠程重擊（可附加狀態）
    const aim = nearestOpp(e, aliveHeroes());
    if (!aim.target || aim.dist > (sk.range || 6)) { e.eskillCD = 0.3; return false; } // 沒有夠近目標 → 稍後再試
    const target = aim.target, ty = D().laneY(gy, target.lane);
    addFloat(e.x, ey - 26, sk.name, sk.color, true);
    addProjectile(e.x, ey - 14, target.x, ty - 8, sk.color, sk.kind);
    e.lunge = 5;
    if (Math.random() < D().evadeChance(e.hit, target.stats.dodge)) {
      addFloat(target.x, ty - 24, "閃避", "#9fd0f4");
    } else {
      let dmg = Math.max(1, Math.round(e.atk * sk.mult * fxOutMul(e) - effDefHero(target)));
      dmg = Math.max(1, Math.round(dmg * fxInMul(target)));
      target.hp -= dmg; target.hitFlash = 0.12; target.shake = 0.18;
      addFloat(target.x + 4, ty - 22, "" + dmg, sk.color);
      spark(target.x, gy - 14, 8, sk.color);
      if (sk.applies) fxAdd(target, sk.applies, D().FX[sk.applies].dur); // 命中附加狀態效果
      if (target.stats.reflect && e.hp > 0) damageEnemy(e, Math.max(1, Math.round(dmg * target.stats.reflect)), { noProc: true, color: "#ff8a8a" });
      if (target.hp <= 0) {
        target.hp = 0; target.dead = true; e.pauseT = D().KILL_PAUSE;
        addFloat(target.x, ty - 26, "倒下", "#ff4d4d");
        if (!battle.field.some((hh) => !hh.dead && !hh.isPet)) battle.allDeadTimer = 1.4;
      }
    }
    e.eskillCD = sk.cd;
    return true;
  }

  // ---- 格子戰術移動：朝「黏著的最近目標」逐格走、被擋才繞行（減少上下亂跑）----
  function commitStep(u, cd, reserved, key) {
    reserved[key(cd.l, cd.c)] = true; // 佔住新格，避免兩隻搶同格
    u.glane = cd.l; u.gcol = cd.c; u.moveTX = cellX(cd.c);
  }
  function decideStep(u, opp, dir, NCOLS, reserved, key) {
    if (u.pauseT > 0 || fxBlockMove(u) || !unitSettled(u) || !opp.length) return; // 擊殺定格/暈眩/冰凍/麻痺中不移動
    // 黏著目標：除非出現「明顯更近」的目標，否則不換（避免在兩個等距目標間上下擺動）
    let t = u._tgt;
    if (!t || t.dead || (t.hp != null && t.hp <= 0) || opp.indexOf(t) < 0) t = null;
    const near = nearestOpp(u, opp);
    if (!t) t = near.target;
    else if (near.target && near.dist < gridDist(u.glane, u.gcol, t.glane, t.gcol) - 0.75) t = near.target;
    u._tgt = t;
    if (!t) return;
    const curD = gridDist(u.glane, u.gcol, t.glane, t.gcol);
    if (curD <= u.range) return; // 進入攻擊距離 → 停
    const dCol = t.gcol - u.gcol, dLane = t.glane - u.glane;
    const sCol = dCol > 0 ? 1 : dCol < 0 ? -1 : 0;
    const sLane = dLane > 0 ? 1 : dLane < 0 ? -1 : 0;
    // 主候選：朝目標（較大軸優先；平手先走欄＝前進感，減少上下抖動）
    const colFirst = Math.abs(dCol) >= Math.abs(dLane);
    const main = [];
    if (sCol && colFirst) main.push({ l: u.glane, c: u.gcol + sCol });
    if (sLane) main.push({ l: u.glane + sLane, c: u.gcol });
    if (sCol && !colFirst) main.push({ l: u.glane, c: u.gcol + sCol });
    const inb = (cd) => cd.l >= 0 && cd.l < D().LANES && cd.c >= 0 && cd.c < NCOLS;
    for (const cd of main) { if (inb(cd) && !reserved[key(cd.l, cd.c)]) { commitStep(u, cd, reserved, key); return; } }
    // 備援繞行：主方向都被擋 → 找空鄰行（容許暫時不更近一格），形成「換行繞過去」
    const around = [{ l: u.glane + 1, c: u.gcol }, { l: u.glane - 1, c: u.gcol }];
    for (const cd of around) {
      if (!inb(cd) || reserved[key(cd.l, cd.c)]) continue;
      if (gridDist(cd.l, cd.c, t.glane, t.gcol) <= curD + 1 + 1e-6) { commitStep(u, cd, reserved, key); return; }
    }
  }
  function gridCombatStep(dt, NCOLS) {
    const heroes = aliveHeroes();
    const enemies = aliveEnemies();
    const key = (l, c) => l * 1000 + c;
    const reserved = {};
    enemies.forEach((u) => (reserved[key(u.glane, u.gcol)] = true));
    battle.field.forEach((u) => { if (!u.dead) reserved[key(u.glane, u.gcol)] = true; });
    // 決策（穩定順序：敵先、英後）；寵物也一起往最近敵人移動（但不攻擊、不被選為目標）
    const pets = battle.field.filter((h) => h.isPet && !h.dead);
    enemies.forEach((u) => decideStep(u, heroes, -1, NCOLS, reserved, key));
    heroes.forEach((u) => decideStep(u, enemies, +1, NCOLS, reserved, key));
    pets.forEach((u) => decideStep(u, enemies, +1, NCOLS, reserved, key));
    // 動畫（含寵物，往各自 moveTX/glane）；戰鬥時移動速度再 ×COMBAT_MOVE_MUL
    const mul = D().COMBAT_MOVE_MUL;
    enemies.forEach((u) => animateUnit(u, dt, mul));
    battle.field.forEach((u) => { if (!u.dead) animateUnit(u, dt, mul); });
  }

  // ---- 單步模擬 ----
  function step(dt) {
    const d = D();
    const v = Game.view;
    const idle = Game.State.battleMode === "idle";
    battle.fxClock = (battle.fxClock || 0) + dt; // 狀態效果動畫時鐘（render 用）

    // 浮動 / 投射 / flash
    for (let i = battle.floats.length - 1; i >= 0; i--) {
      const f = battle.floats[i];
      f.life -= dt; f.y += f.vy * dt; f.vy += 16 * dt;
      if (f.life <= 0) battle.floats.splice(i, 1);
    }
    for (let i = battle.projectiles.length - 1; i >= 0; i--) {
      const p = battle.projectiles[i];
      p.t += dt / p.life;
      if (p.t >= 1) battle.projectiles.splice(i, 1);
    }
    for (let i = battle.particles.length - 1; i >= 0; i--) {
      const p = battle.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type !== "slash") p.vy += 90 * dt;
      p.life -= dt;
      if (p.life <= 0) battle.particles.splice(i, 1);
    }
    battle.field.forEach((h) => { if (h.hitFlash > 0) h.hitFlash -= dt; if (h.shake > 0) h.shake -= dt; if (h.lunge > 0) h.lunge = Math.max(0, h.lunge - dt * 36); if (h.pauseT > 0) h.pauseT -= dt; });
    battle.enemies.forEach((e) => { if (e.hitFlash > 0) e.hitFlash -= dt; if (e.shake > 0) e.shake -= dt; if (e.lunge > 0) e.lunge = Math.max(0, e.lunge - dt * 36); if (e.pauseT > 0) e.pauseT -= dt; });
    if (battle.bannerTimer > 0) battle.bannerTimer -= dt;

    // 全隊陣亡 → 失敗字樣 → 退 20 關並對齊段起點（XX1、非魔王）、無條件進入掛機
    const anyAlive = battle.field.some((h) => !h.dead && !h.isPet);
    if (!anyAlive) {
      if (battle.flow !== "defeat") {
        battle.flow = "defeat";
        setBanner("失敗", "#ff4d4d");
        battle.bannerTimer = Math.max(battle.allDeadTimer, d.DEFEAT_TIME);
      }
      battle.allDeadTimer -= dt;
      battle.field.forEach((h) => { if (!h.dead) animateHome(h, dt); });
      battle.phase = "walking";
      if (battle.allDeadTimer <= 0) {
        const back = d.segmentStart(Math.max(1, Game.State.stage - d.DEATH_RETREAT));
        Game.State.stage = back;
        Game.State.battleMode = "idle";
        buildField();
        setupStage(back);
        battle.flow = "combat"; battle.spawnCD = 0.3;
        battle.banner = null; battle.bannerTimer = 0;
        battle.reviveTimer = d.IDLE_REVIVE_INTERVAL;
      }
      return;
    }

    // 掛機：每隔一段時間自動復活全隊並回滿血；掛機恆為 combat 流程
    if (idle) {
      battle.flow = "combat";
      battle.reviveTimer -= dt;
      if (battle.reviveTimer <= 0) {
        if (battle.pendingParty) { buildField(); battle.pendingParty = false; } // 掛機：每輪復活時套用出戰/位置調整
        let revived = false;
        battle.field.forEach((h) => { if (h.dead) { h.dead = false; revived = true; } h.hp = h.maxHp; });
        battle.reviveTimer = d.IDLE_REVIVE_INTERVAL;
        if (revived) addFloat(d.PARTY_X, Game.view.ground - 44, "復活", "#ffd23f");
      }
    }

    // ===== 行軍：關卡之間走路（背景捲動、無敵人、英雄滑回最左）=====
    if (!idle && battle.flow === "march") {
      battle.marchTimer -= dt;
      battle.worldScroll += d.WALK_SPEED * dt;
      battle.walkPhase += dt * 6;
      battle.field.forEach((h) => { if (!h.dead) animateHome(h, dt); });
      battle.phase = "walking";
      // 走路揚塵
      battle.dustT = (battle.dustT || 0) - dt;
      if (battle.dustT <= 0) {
        const fh = frontHeroAny();
        if (fh) addParticle("dust", fh.x - 7, d.laneY(v.ground, fh.lane) - 1, -16 - Math.random() * 10, -4 - Math.random() * 7, 0.4 + Math.random() * 0.25, "#9a866a");
        battle.dustT = 0.15;
      }
      if (battle.marchTimer <= 0) startEncounter();
      return;
    }

    // ===== 勝利：跳字樣、英雄滑回最左，倒數結束後行軍進下一關 =====
    if (!idle && battle.flow === "victory") {
      battle.walkPhase += dt * 6;
      battle.field.forEach((h) => { if (!h.dead) animateHome(h, dt); });
      battle.phase = "walking";
      if (battle.bannerTimer <= 0) {
        resetHeroesHome(); // 硬吸附回 home 格
        setupStage(Game.State.stage + 1);
        battle.flow = "march"; battle.marchTimer = d.MARCH_TIME;
        battle.banner = null;
      }
      return;
    }

    // ===== 遭遇 / 開戰 / 戰鬥（flow encounter|combat 或掛機）=====
    const NCOLS = ncols();
    const encountering = battle.flow === "encounter";

    // 生成敵人：推進整波已在 startEncounter 出場；此處負責掛機持續補位、推進補滿
    const cap = d.isBossStage(Game.State.stage) ? 1 : d.LANES * d.ENEMY_COLS;
    if ((idle || battle.toSpawn > 0) && battle.enemies.length < cap) {
      battle.spawnCD -= dt;
      if (battle.spawnCD <= 0) { spawnEnemyRoom(); if (!idle) battle.toSpawn--; battle.spawnCD = d.SPAWN_INTERVAL; }
    }

    // 遭遇：敵人各行從右側外走進集結格（靠右緣成軍）；英雄在 home 等待
    if (encountering) {
      for (let L = 0; L < d.LANES; L++) {
        // 近戰(range 小)排前排(靠左、靠英雄)、遠程排後排(靠右)：以攻擊距離成軍
        const lane = battle.enemies.filter((e) => e.lane === L).sort((a, b) => a.range - b.range || a.x - b.x);
        const m = lane.length;
        lane.forEach((e, idx) => { e.gcol = clampCol(NCOLS - m + idx); e.glane = L; e.moveTX = cellX(e.gcol); });
      }
      battle.enemies.forEach((e) => { e.x = approach(e.x, e.moveTX, d.APPROACH_SPEED * dt); e.laneF = e.glane; });
      battle.field.forEach((h) => { if (!h.dead) animateHome(h, dt); });
      battle.phase = "encounter";
      battle.bannerTimer = 1; // 維持「遭遇敵人」字樣
      const allIn = battle.enemies.length > 0 && battle.enemies.every((e) => Math.abs(e.x - e.moveTX) <= d.CELL_ALIGN_EPS);
      if (allIn) {
        battle.enemies.forEach((e) => { e.gcol = clampCol(colOfX(e.x)); e.x = cellX(e.gcol); e.glane = e.lane; e.laneF = e.lane; });
        battle.flow = "combat";
        battle.holdTimer = d.CLASH_TIME;
        setBanner("開戰！", "#ff5a5a");
        battle.bannerTimer = d.CLASH_TIME;
      }
      return;
    }

    // 開戰停頓：雙方就位後短暫定格再開打
    if (battle.holdTimer > 0) {
      battle.holdTimer -= dt;
      battle.phase = "encounter";
      return;
    }

    // 關卡清除 → 勝利（掛機不前進、不勝利）
    if (!idle && battle.toSpawn === 0 && battle.enemies.length === 0 && battle.killedThisStage >= battle.killsNeeded) {
      // 過關掉寶箱（只給貨幣）
      const box = S().onStageClear(Game.State.stage);
      if (box && Game.UI && Game.UI.toast) {
        if (box.box === "gold") Game.UI.toast("金幣寶箱！+" + box.gold + " 金幣");
        else Game.UI.toast("鑽石寶箱！+" + box.gems + " 鑽");
      }
      battle.flow = "victory";
      setBanner("勝利", "#ffd23f");
      battle.bannerTimer = d.VICTORY_TIME;
      battle.phase = "walking";
      return;
    }

    // 逐單位格子 AI：各自往最近敵人走、被擋繞行、進入攻擊距離才停
    battle.phase = "fighting";
    gridCombatStep(dt, NCOLS);

    // 英雄攻擊 + 技能
    battle.field.forEach((h) => {
      if (h.dead || h.isPet) return; // 寵物不攻擊
      // 套裝：每秒回復生命
      if (h.stats.regen) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * h.stats.regen * dt);
      fxTick(h, dt, true); // 狀態計時 + 燃燒
      if (h.dead) return;  // 燃燒致死
      if (h.pauseT > 0) return; // 擊敗對手後定格 0.5 秒
      const fired = updateHeroSkills(h, dt); // 有技能就優先放（內部已擋暈眩/冰凍）
      h.atkTimer -= dt;
      if (h.atkTimer <= 0 && !fired && !fxBlockAct(h)) { // 本幀沒放技、未被暈眩/冰凍才普攻
        const aim = nearestOpp(h, aliveEnemies());
        const target = aim.target;
        if (target && aim.dist <= h.range && unitSettled(h)) { // 在攻擊距離內、已就位於格才出手
          const hy = d.laneY(v.ground, h.lane), ty = d.laneY(v.ground, target.lane);
          const cls = D().HERO_BY_ID[h.heroId].cls;
          const ranged = cls === "法師" || cls === "弓手" || cls === "牧師";
          h.lunge = ranged ? 2 : 6;
          if (ranged) {
            // 投射物外觀：法師＝火球、弓手＝箭(帶尾跡)、牧師＝聖光
            const pk = cls === "法師" ? "fireball" : cls === "弓手" ? "arrow" : "holy";
            const pc = cls === "法師" ? "#ff7a2a" : cls === "弓手" ? "#ffe45a" : "#7adf8a";
            addProjectile(h.x, hy - 16, target.x, ty - 8, pc, pk);
          }
          if (Math.random() < D().evadeChance(h.stats.hit, target.dodge)) {
            addFloat(target.x, ty - 14, "MISS", "#cfd6e4");
          } else {
            const r = rollDamage(h.stats.atk * fxOutMul(h), h.stats.crit, h.stats.critDmg, effDefEnemy(target));
            damageEnemy(target, r.dmg, { crit: r.isCrit, src: h, lifesteal: h.stats.lifesteal, melee: !ranged });
            if (target.hp <= 0) h.pauseT = d.KILL_PAUSE; // 擊敗對手 → 原地定格 0.5 秒
            // 套裝：連擊（再打一次同目標，二擊不再觸發連擊）
            if (h.stats.multi && Math.random() < h.stats.multi && target.hp > 0) {
              const t2 = heroTarget(h);
              if (t2) {
                addFloat(t2.x, d.laneY(v.ground, t2.lane) - 28, "連擊", "#ffe45a");
                const r2 = rollDamage(h.stats.atk * fxOutMul(h), h.stats.crit, h.stats.critDmg, effDefEnemy(t2));
                damageEnemy(t2, r2.dmg, { crit: r2.isCrit, src: h, lifesteal: h.stats.lifesteal, melee: !ranged });
              }
            }
          }
        }
        h.atkTimer = h.stats.atkInterval * d.ATK_INTERVAL_MUL; // 攻速放慢一倍
      }
    });

    // 敵人攻擊：以自己為中心找最近英雄，進入攻擊距離且已就位於格才出手
    battle.enemies.slice().forEach((e) => {
      if (e.air > 0) return;
      fxTick(e, dt, false); // 狀態計時 + 燃燒（可能致死並 splice）
      if (e.hp <= 0 || battle.enemies.indexOf(e) < 0) return;
      const fired = updateEnemySkills(e, dt); // 有技能就優先放（內部已擋暈眩/冰凍）
      if (fired || e.pauseT > 0 || fxBlockAct(e)) return; // 已放技/定格/暈眩冰凍 → 不普攻
      const aim = nearestOpp(e, aliveHeroes());
      const target = aim.target;
      if (!target || aim.dist > e.range || !unitSettled(e)) return;
      e.atkTimer -= dt;
      if (e.atkTimer <= 0) {
        {
          e.lunge = 6;
          const ty = d.laneY(v.ground, target.lane);
          if (Math.random() < D().evadeChance(e.hit, target.stats.dodge)) {
            addFloat(target.x, ty - 24, "閃避", "#9fd0f4");
          } else {
            let dmg = Math.max(1, Math.round(e.atk * fxOutMul(e) - effDefHero(target)));
            dmg = Math.max(1, Math.round(dmg * fxInMul(target)));
            target.hp -= dmg;
            target.hitFlash = 0.12;
            target.shake = 0.16;
            addFloat(target.x + 4, ty - 22, "" + dmg, "#ff6b6b");
            // 套裝：反傷（對攻擊者造成承受傷害 × 比例）
            if (target.stats.reflect && e.hp > 0) {
              damageEnemy(e, Math.max(1, Math.round(dmg * target.stats.reflect)), { noProc: true, color: "#ff8a8a" });
            }
            if (target.hp <= 0) {
              target.hp = 0; target.dead = true;
              e.pauseT = d.KILL_PAUSE; // 擊敗對手 → 原地定格 0.5 秒
              addFloat(target.x, ty - 26, "倒下", "#ff4d4d");
              if (!battle.field.some((hh) => !hh.dead && !hh.isPet)) battle.allDeadTimer = 1.4;
            }
          }
        }
        e.atkTimer = e.atkInterval * d.ATK_INTERVAL_MUL; // 攻速放慢一倍
      }
    });
  }

  // ---- 對外 ----
  function init() {
    battle = newBattle();
    buildField();
    setupStage(Game.State.stage);
    if (Game.State.battleMode === "idle") { battle.flow = "combat"; battle.spawnCD = 0.3; }
    else { battle.flow = "march"; battle.marchTimer = D().MARCH_TIME; }
  }
  function update(dt) {
    if (dt > 0.1) dt = 0.1;
    // 每秒結算貨幣速率
    Game.State._secT -= dt;
    if (Game.State._secT <= 0) { S().tickSecond(); Game.State._secT = 1; }
    refreshFieldStats();
    step(dt);
  }
  function onPartyChanged() {
    if (!battle) return;
    // 戰鬥中（flow=combat）調整出戰/位置 → 延後到本輪結束才生效，不影響進行中的戰鬥
    if (battle.flow === "combat") { battle.pendingParty = true; return; }
    buildField();
  }
  function resetBattle() {
    init();
  }
  // 切換戰鬥模式：進入掛機時無條件對齊到段起點（XX1、非魔王）並重整關卡
  function onModeChange() {
    if (!battle) return;
    battle.banner = null; battle.bannerTimer = 0;
    battle.pendingParty = false; // 切模式即重整隊伍，清掉延後旗標
    if (Game.State.battleMode === "idle") {
      // 掛機：對齊段起點（XX1、非魔王）、重整關卡，英雄維持前進迎戰
      Game.State.stage = D().segmentStart(Game.State.stage);
      buildField();
      setupStage(Game.State.stage);
      battle.flow = "combat"; battle.spawnCD = 0.3;
      battle.reviveTimer = D().IDLE_REVIVE_INTERVAL;
    } else {
      // 推進：由行軍起（英雄回 home 格、走 10 秒進當前關）
      battle.flow = "march"; battle.marchTimer = D().MARCH_TIME;
      buildField();
      setupStage(Game.State.stage);
      resetHeroesHome();
    }
  }

  Game.Engine = {
    init, update, onPartyChanged, resetBattle, onModeChange,
    get battle() { return battle; },
  };
})();
