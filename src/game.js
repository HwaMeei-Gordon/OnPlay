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
    };
  }

  // ---- 建立出戰隊伍 runtime ----
  function buildField() {
    const st = Game.State, d = D();
    const mods = S().globalMods();
    const layout = S().formationLayout();
    battle.field = layout.map((slot, i) => {
      const heroId = slot.heroId;
      const stats = S().heroStats(heroId, mods);
      const def = d.HERO_BY_ID[heroId];
      const actives = def.skills.filter(
        (sid) => d.HERO_SKILLS[sid].type === "active" && (st.heroes[heroId].skills[sid] || 0) > 0
      );
      const timers = {};
      actives.forEach((sid) => (timers[sid] = d.HERO_SKILLS[sid].cooldown));
      return {
        heroId, sprite: Game.Sprites.heroes[def.sprite],
        stats, maxHp: stats.maxHp, hp: stats.maxHp,
        atkTimer: stats.atkInterval * (0.4 + i * 0.15),
        lane: slot.lane, col: slot.col,
        x: d.PARTY_X - slot.col * d.FORM_COL_GAP, lift: 0,
        hitFlash: 0, shake: 0, lunge: 0, dead: false, rageLeft: 0, rageMul: 1,
        actives, skillTimers: timers,
      };
    });
  }

  // 每幀刷新英雄屬性（反映養成升級），維持目前 hp 比例
  function refreshFieldStats() {
    const mods = S().globalMods();
    battle.field.forEach((h) => {
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

  function spawnEnemy(lane) {
    const st = Game.State;
    const stage = st.stage;
    const boss = D().isBossStage(stage);
    if (boss) lane = 1; // 魔王固定中行
    if (lane == null) lane = Math.floor(Math.random() * D().LANES);
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
    battle.enemies.push({
      maxHp: maxHp, hp: maxHp, atk: atk, def: stx.def,
      gold: gold, xp: stx.xp, gems: stx.gems, atkInterval: stx.atkInterval,
      hit: stx.hit, dodge: stx.dodge,
      atkTimer: stx.atkInterval * 0.7, isBoss: boss, isChest: chest, isElite: elite, sprite,
      x: Game.view.w + 8 + Math.random() * 10, targetX: 0, lane: lane, air: D().ENEMY_DROP_H, vy: 0,
      hitFlash: 0, shake: 0, lunge: 0,
    });
  }

  // ---- 浮動文字 / 投射物 ----
  function addFloat(x, y, text, color, big) {
    battle.floats.push({ x: x + (Math.random() - 0.5) * 6, y, text, color, life: 0.7, vy: -14, big: !!big });
  }
  function addProjectile(x, y, tx, ty, color) {
    battle.projectiles.push({ x, y, tx, ty, color, life: 0.3, t: 0 });
  }
  function addParticle(type, x, y, vx, vy, life, color) {
    battle.particles.push({ type, x, y, vx, vy, life, life0: life, color });
  }
  function addSlash(x, y) {
    battle.particles.push({ type: "slash", x, y, vx: 0, vy: 0, life: 0.18, life0: 0.18, color: "#ffffff" });
  }
  function spark(x, y, n, color) {
    for (let k = 0; k < n; k++)
      addParticle("spark", x, y, (Math.random() - 0.5) * 64, -22 - Math.random() * 40,
        0.18 + Math.random() * 0.22, k % 2 ? "#ffffff" : color);
  }

  // 全場最前敵（x 最小）；行內最前敵
  function nearestEnemy() {
    let f = null;
    for (const e of battle.enemies) if (e.air <= 0 && (!f || e.x < f.x)) f = e;
    return f;
  }
  function frontEnemyInLane(lane) {
    let f = null;
    for (const e of battle.enemies) if (e.lane === lane && e.air <= 0 && (!f || e.x < f.x)) f = e;
    return f;
  }
  // 英雄目標：先打同行最前敵，該行沒敵人才打全場最近
  function heroTarget(h) { return frontEnemyInLane(h.lane) || nearestEnemy(); }
  // 行內最前排英雄（col 最小＝最靠敵）；全場最前英雄（fallback）
  function frontHeroInLane(lane) {
    let f = null;
    for (const h of battle.field) if (!h.dead && h.lane === lane && (!f || h.col < f.col)) f = h;
    return f;
  }
  function frontHeroAny() {
    let f = null;
    for (const h of battle.field) if (!h.dead && (!f || h.col < f.col)) f = h;
    return f;
  }
  function enemyTarget(e) { return frontHeroInLane(e.lane) || frontHeroAny(); }
  // 該敵是否為其行最前敵（排隊時只有最前者能接觸/攻擊）
  function isLaneFront(e) { return frontEnemyInLane(e.lane) === e; }

  function rollDamage(atk, crit, critDmg, def) {
    const isCrit = Math.random() < crit;
    const raw = atk * (isCrit ? critDmg : 1);
    return { dmg: Math.max(1, Math.round(raw - def)), isCrit };
  }

  function damageEnemy(target, dmg, opts) {
    if (!target) return;
    opts = opts || {};
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
    if (h.rageLeft > 0) {
      h.rageLeft -= dt;
      if (h.rageLeft <= 0) h.rageMul = 1;
    }
    const gy = Game.view.ground, hy = D().laneY(gy, h.lane);
    const fe = heroTarget(h);
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
        addFloat(h.x, hy - 26, "治癒", "#5ec46b");
        h.skillTimers[sid] = def.cooldown;
      } else if (sid === "rage") {
        if (!fe) { h.skillTimers[sid] = 0; return; }
        h.rageMul = 1 + (0.5 + 0.1 * lv);
        h.rageLeft = def.duration;
        addFloat(h.x, hy - 28, "狂暴!", "#ff4d4d");
        h.skillTimers[sid] = def.cooldown;
      } else {
        // 傷害型技能
        if (!fe) { h.skillTimers[sid] = 0; return; }
        let mult = 1.5, hits = 1, forceCrit = false, color = "#ffce54";
        if (sid === "slash") mult = 1.2 + 0.3 * lv;
        else if (sid === "fireball") { mult = 1.5 + 0.4 * lv; color = "#ff7a3d"; }
        else if (sid === "frost") { mult = 1.8 + 0.5 * lv; color = "#7ad7ff"; }
        else if (sid === "multishot") { mult = 1.0 + 0.25 * lv; hits = 3; color = "#bfe24a"; }
        else if (sid === "backstab") { mult = 2.0 + 0.5 * lv; forceCrit = true; color = "#ff4d4d"; }
        addProjectile(h.x, hy - 16, fe.x, D().laneY(gy, fe.lane) - 8, color);
        for (let k = 0; k < hits; k++) {
          const isCrit = forceCrit || Math.random() < h.stats.crit;
          const raw = h.stats.atk * h.rageMul * mult * (isCrit ? h.stats.critDmg : 1);
          const dmg = Math.max(1, Math.round(raw - (fe.def || 0)));
          damageEnemy(fe, dmg, { crit: isCrit, color: color, src: h, lifesteal: h.stats.lifesteal });
          if (!battle.enemies.length) break;
        }
        h.skillTimers[sid] = def.cooldown;
      }
    });
  }

  // ---- 單步模擬 ----
  function step(dt) {
    const d = D();
    const v = Game.view;
    const contactX = d.PARTY_X + d.CONTACT_RANGE;

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
    battle.field.forEach((h) => { if (h.hitFlash > 0) h.hitFlash -= dt; if (h.shake > 0) h.shake -= dt; if (h.lunge > 0) h.lunge = Math.max(0, h.lunge - dt * 36); });
    battle.enemies.forEach((e) => { if (e.hitFlash > 0) e.hitFlash -= dt; if (e.shake > 0) e.shake -= dt; if (e.lunge > 0) e.lunge = Math.max(0, e.lunge - dt * 36); });

    const idle = Game.State.battleMode === "idle";

    // 全隊陣亡 → 退 20 關並對齊段起點（XX1、非魔王）、無條件進入掛機
    const anyAlive = battle.field.some((h) => !h.dead);
    if (!anyAlive) {
      battle.allDeadTimer -= dt;
      battle.worldScroll += d.WALK_SPEED * 0.2 * dt;
      if (battle.allDeadTimer <= 0) {
        const back = d.segmentStart(Math.max(1, Game.State.stage - d.DEATH_RETREAT));
        Game.State.stage = back;
        Game.State.battleMode = "idle";
        buildField();
        setupStage(back);
        battle.reviveTimer = d.IDLE_REVIVE_INTERVAL;
      }
      return;
    }

    // 掛機：每隔一段時間自動復活全隊並回滿血
    if (idle) {
      battle.reviveTimer -= dt;
      if (battle.reviveTimer <= 0) {
        let revived = false;
        battle.field.forEach((h) => { if (h.dead) { h.dead = false; revived = true; } h.hp = h.maxHp; });
        battle.reviveTimer = d.IDLE_REVIVE_INTERVAL;
        if (revived) addFloat(d.PARTY_X, Game.view.ground - 44, "復活", "#ffd23f");
      }
    }

    // 生成敵人（天降：從右上掉到隨機行；掛機持續、推進依 toSpawn；同屏上限）
    const cap = d.isBossStage(Game.State.stage) ? 1 : d.MAX_CONCURRENT;
    if ((idle || battle.toSpawn > 0) && battle.enemies.length < cap) {
      battle.spawnCD -= dt;
      if (battle.spawnCD <= 0) { spawnEnemy(); if (!idle) battle.toSpawn--; battle.spawnCD = d.SPAWN_INTERVAL; }
    }

    // 關卡清除 → 下一層（掛機不前進）
    if (!idle && battle.toSpawn === 0 && battle.enemies.length === 0 && battle.killedThisStage >= battle.killsNeeded) {
      // 過關掉寶箱（只給貨幣）
      const box = S().onStageClear(Game.State.stage);
      if (box && Game.UI && Game.UI.toast) {
        if (box.box === "gold") Game.UI.toast("金幣寶箱！+" + box.gold + " 金幣");
        else Game.UI.toast("鑽石寶箱！+" + box.gems + " 鑽");
      }
      setupStage(Game.State.stage + 1);
      battle.worldScroll += d.WALK_SPEED * dt;
      battle.walkPhase += dt * 6;
      return;
    }

    // 天降下落（air>0 在空中、落地噴塵）
    battle.enemies.forEach((e) => {
      if (e.air > 0) {
        e.vy = (e.vy || 0) + d.DROP_GRAVITY * dt;
        e.air = e.air - e.vy * dt;
        if (e.air <= 0) {
          e.air = 0; e.vy = 0;
          const ly = d.laneY(v.ground, e.lane);
          addParticle("dust", e.x, ly, -12 - Math.random() * 8, -3 - Math.random() * 6, 0.35, "#9a866a");
          addParticle("dust", e.x, ly, 12 + Math.random() * 8, -3 - Math.random() * 6, 0.35, "#9a866a");
        }
      }
    });

    // 逐行排隊指派陣位（只算已落地者）
    for (let L = 0; L < d.LANES; L++) {
      const lane = battle.enemies.filter((e) => e.lane === L && e.air <= 0).sort((a, b) => a.x - b.x);
      lane.forEach((e, idx) => (e.targetX = contactX + idx * d.ENEMY_GAP));
    }

    // 相位：任一落地敵人接觸最前線 → 戰鬥；否則前進（推進捲動）
    const anyEngaged = battle.enemies.some((e) => e.air <= 0 && e.x <= contactX + 2);
    battle.phase = anyEngaged ? "fighting" : "walking";
    if (!anyEngaged && !idle) { battle.worldScroll += d.WALK_SPEED * dt; battle.walkPhase += dt * 6; }
    const espd = anyEngaged ? d.ENEMY_SPEED : d.APPROACH_SPEED;
    battle.enemies.forEach((e) => {
      if (e.air <= 0 && e.x > e.targetX) e.x = Math.max(e.targetX, e.x - espd * dt);
    });

    // 走路塵土（前進時腳後揚塵；掛機不揚塵）
    if (battle.phase === "walking" && !idle) {
      battle.dustT = (battle.dustT || 0) - dt;
      if (battle.dustT <= 0) {
        const fh = frontHeroAny();
        if (fh) addParticle("dust", fh.x - 7, d.laneY(v.ground, fh.lane) - 1, -16 - Math.random() * 10, -4 - Math.random() * 7, 0.4 + Math.random() * 0.25, "#9a866a");
        battle.dustT = 0.15;
      }
    }

    if (battle.phase !== "fighting") return;

    // 英雄攻擊 + 技能
    battle.field.forEach((h) => {
      if (h.dead) return;
      // 套裝：每秒回復生命
      if (h.stats.regen) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * h.stats.regen * dt);
      updateHeroSkills(h, dt);
      h.atkTimer -= dt;
      if (h.atkTimer <= 0) {
        const target = heroTarget(h);
        if (target) {
          const hy = d.laneY(v.ground, h.lane), ty = d.laneY(v.ground, target.lane);
          const cls = D().HERO_BY_ID[h.heroId].cls;
          const ranged = cls === "法師" || cls === "弓手" || cls === "牧師";
          h.lunge = ranged ? 2 : 6;
          if (ranged) {
            addProjectile(h.x, hy - 16, target.x, ty - 8, cls === "法師" ? "#b06ae0" : cls === "牧師" ? "#7adf8a" : "#ffe45a");
          }
          if (Math.random() < D().evadeChance(h.stats.hit, target.dodge)) {
            addFloat(target.x, ty - 14, "MISS", "#cfd6e4");
          } else {
            const r = rollDamage(h.stats.atk * h.rageMul, h.stats.crit, h.stats.critDmg, target.def);
            damageEnemy(target, r.dmg, { crit: r.isCrit, src: h, lifesteal: h.stats.lifesteal, melee: !ranged });
            // 套裝：連擊（再打一次同目標，二擊不再觸發連擊）
            if (h.stats.multi && Math.random() < h.stats.multi) {
              const t2 = heroTarget(h);
              if (t2) {
                addFloat(t2.x, d.laneY(v.ground, t2.lane) - 28, "連擊", "#ffe45a");
                const r2 = rollDamage(h.stats.atk * h.rageMul, h.stats.crit, h.stats.critDmg, t2.def);
                damageEnemy(t2, r2.dmg, { crit: r2.isCrit, src: h, lifesteal: h.stats.lifesteal, melee: !ranged });
              }
            }
          }
        }
        h.atkTimer = h.stats.atkInterval;
      }
    });

    // 敵人攻擊（只有各行最前敵、已落地就位者；優先打同行前排英雄）
    battle.enemies.forEach((e) => {
      if (e.air > 0 || !isLaneFront(e) || e.x > e.targetX + 1) return; // 空中/非行首/未就位
      e.atkTimer -= dt;
      if (e.atkTimer <= 0) {
        const target = enemyTarget(e);
        if (target) {
          e.lunge = 6;
          const ty = d.laneY(v.ground, target.lane);
          if (Math.random() < D().evadeChance(e.hit, target.stats.dodge)) {
            addFloat(target.x, ty - 24, "閃避", "#9fd0f4");
          } else {
            const dmg = Math.max(1, Math.round(e.atk - target.stats.def));
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
              addFloat(target.x, ty - 26, "倒下", "#ff4d4d");
              if (!battle.field.some((hh) => !hh.dead)) battle.allDeadTimer = 1.4;
            }
          }
        }
        e.atkTimer = e.atkInterval;
      }
    });
  }

  // ---- 對外 ----
  function init() {
    battle = newBattle();
    buildField();
    setupStage(Game.State.stage);
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
    if (battle) buildField();
  }
  function resetBattle() {
    init();
  }
  // 切換戰鬥模式：進入掛機時無條件對齊到段起點（XX1、非魔王）並重整關卡
  function onModeChange() {
    if (!battle) return;
    if (Game.State.battleMode === "idle") {
      Game.State.stage = D().segmentStart(Game.State.stage);
      buildField();
      setupStage(Game.State.stage);
      battle.reviveTimer = D().IDLE_REVIVE_INTERVAL;
    }
  }

  Game.Engine = {
    init, update, onPartyChanged, resetBattle, onModeChange,
    get battle() { return battle; },
  };
})();
