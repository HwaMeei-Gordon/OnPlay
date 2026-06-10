/* ============================================================
 * systems.js — 養成邏輯與存檔狀態（純資料運算，無 DOM）
 * 持有 canonical 狀態 Game.State；提供屬性彙整與所有變更操作。
 * 全域命名空間：window.Game.Systems / window.Game.State
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});
  const D = () => Game.Data;

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function emptyEquip() {
    const e = {};
    D().EQUIPMENT_SLOTS.forEach((s) => (e[s.id] = null));
    return e;
  }

  // ---- 名冊（動態角色）----
  // 條目：{ uid, name, job, level, exp, baseRolls(招募時鎖定 ±15%), skills, equip, pos }
  const ROLL_STATS = ["atk", "maxHp", "def", "crit", "critDmg", "dodge"];
  function rollBaseRolls(variance) {
    const v = variance == null ? D().RECRUIT.rollVar : variance;
    const r = {};
    ROLL_STATS.forEach((k) => (r[k] = 1 + (Math.random() * 2 - 1) * v));
    return r;
  }
  function randomName() {
    const pool = D().NAME_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function makeRosterEntry(name, job, level, baseRolls) {
    const uid = "h" + (State ? State.heroSeq++ : 1);
    return { uid, name, job, level: level || 1, exp: 0, baseRolls: baseRolls || rollBaseRolls(), skills: {}, equip: emptyEquip(), pos: null };
  }
  // 初始冒險者（中庸 rolls，避免開局運氣差）
  function makeStarter() {
    const rolls = rollBaseRolls(0.05);
    return { uid: "h1", name: "亞倫", job: "adventurer", level: 1, exp: 0, baseRolls: rolls, skills: {}, equip: emptyEquip(), pos: null };
  }
  function rosterByUid(uid) {
    return (State.roster || []).find((r) => r.uid === uid) || null;
  }
  // 統一取角色定義：合併 JOB 鏈（statMul 連乘、adds 平加）× 個體 baseRolls
  function heroDef(uid) {
    const d = D();
    const r = rosterByUid(uid);
    if (!r) return null;
    const job = d.JOB_BY_ID[r.job];
    if (!job) return null;
    const t0 = d.JOB_BY_ID.adventurer;
    const path = d.jobPath(r.job); // 自身→…（不含 tier0）
    let mAtk = 1, mHp = 1, mDef = 1;
    const add = { crit: 0, critDmg: 0, dodge: 0, hit: 0, lifesteal: 0 };
    path.forEach((j) => {
      const m = j.statMul || {};
      mAtk *= m.atk || 1; mHp *= m.maxHp || 1; mDef *= m.def || 1;
      const a = j.adds || {};
      Object.keys(add).forEach((k) => { if (a[k]) add[k] += a[k]; });
    });
    const rl = r.baseRolls || {};
    const rv = (k) => rl[k] || 1;
    const base = {
      atk: t0.base.atk * mAtk * rv("atk"),
      maxHp: t0.base.maxHp * mHp * rv("maxHp"),
      def: t0.base.def * mDef * rv("def"),
      crit: (t0.base.crit + add.crit) * rv("crit"),
      critDmg: (t0.base.critDmg + add.critDmg) * rv("critDmg"),
      atkInterval: t0.base.atkInterval,
      lifesteal: t0.base.lifesteal + add.lifesteal,
      hit: t0.base.hit + add.hit,
      dodge: (t0.base.dodge + add.dodge) * rv("dodge"),
    };
    const growth = {
      atk: t0.growth.atk * mAtk * rv("atk"),
      maxHp: t0.growth.maxHp * mHp * rv("maxHp"),
      def: t0.growth.def * mDef * rv("def"),
    };
    return { entry: r, job, base, growth, range: job.range, moveMul: job.moveMul, sprite: job.sprite, hd: !!job.hd, skills: job.skills, atkKind: job.atkKind, airPriority: !!job.airPriority };
  }

  function defaultState() {
    const d = D();
    const starter = makeStarter();
    return {
      version: 3,
      gold: 0, gems: 0, souls: 0,
      stage: 1, bestStage: 1, runBestStage: 1,
      battleMode: "push",
      roster: [starter],
      heroSeq: 2,
      recruit: { date: todayStr(), candidates: [], refreshes: 0 },
      party: [starter.uid],
      inventory: [], invSeq: 1,
      pets: {}, activePet: null,
      trainings: {}, talents: {}, talentPoints: 0,
      prestige: { count: 0, nodes: {} },
      achievements: {},
      daily: { date: todayStr(), claimed: {}, login: false,
        counters: { killsToday: 0, boxesToday: 0, bossToday: 0 } },
      stats: { totalKills: 0, bossKills: 0, boxesOpened: 0, prestiges: 0 },
      shop: { date: todayStr(), bought: {} },
      scrolls: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      materials: {},
      guardians: 0,
      useGuardian: false,
      goldPerSec: 0, gemPerSec: 0,
      _goldSec: 0, _gemSec: 0, _secT: 1,
    };
  }

  let State = (Game.State = defaultState());

  function setState(s) {
    State = Game.State = s;
  }

  // ---- 全域加成（訓練 + 才能 + 轉生 + 寵物）----
  function globalMods() {
    const d = D();
    const m = {
      atkMul: 0, hpMul: 0, defMul: 0, critAdd: 0, critDmgAdd: 0,
      atkSpeedMul: 0, lifestealAdd: 0, dodgeAdd: 0, hitAdd: 0, goldMul: 0, xpMul: 0, gemMul: 0,
    };
    d.TRAININGS.forEach((t) => {
      const lv = State.trainings[t.id] || 0;
      let v = t.per * lv;
      if (t.cap) v = Math.min(t.cap, v);
      m[t.mod] = (m[t.mod] || 0) + v;
    });
    d.TALENTS.forEach((t) => {
      const lv = State.talents[t.id] || 0;
      m[t.mod] = (m[t.mod] || 0) + t.per * lv;
    });
    d.PRESTIGE.nodes.forEach((n) => {
      const lv = State.prestige.nodes[n.id] || 0;
      m[n.mod] = (m[n.mod] || 0) + n.per * lv;
    });
    if (State.activePet && State.pets[State.activePet]) {
      const def = d.PET_BY_ID[State.activePet];
      const lv = State.pets[State.activePet].level || 1;
      m[def.mod] = (m[def.mod] || 0) + def.per * lv;
    }
    return m;
  }

  function itemByUid(uid) {
    if (uid == null) return null;
    return State.inventory.find((it) => it.uid === uid) || null;
  }

  // ---- 套裝：身上 ≥4 件且全部同稀有度 → 倍率（普通無效果）----
  function heroSetBonus(heroId) {
    const hs = rosterByUid(heroId);
    if (!hs) return null;
    const d = D();
    let rar = null, count = 0, ok = true;
    d.EQUIPMENT_SLOTS.forEach((sl) => {
      const it = itemByUid(hs.equip[sl.id]);
      if (!it) return;
      count++;
      if (rar === null) rar = it.rarity;
      else if (it.rarity !== rar) ok = false;
    });
    if (!ok || count < 4 || !rar) return null;
    const mult = d.SET_RARITY_MULT[rar];
    if (!mult) return null;
    return { rarity: rar, mult, count };
  }

  // ---- 具名套裝：依 setId 分組，每 2 件啟動一階（2/4/6）；與稀有度套裝並存 ----
  function heroNamedSets(heroId) {
    const hs = rosterByUid(heroId);
    if (!hs) return [];
    const d = D();
    const counts = {};
    d.EQUIPMENT_SLOTS.forEach((sl) => {
      const it = itemByUid(hs.equip[sl.id]);
      if (it && it.setId) counts[it.setId] = (counts[it.setId] || 0) + 1;
    });
    const out = [];
    Object.keys(counts).forEach((sid) => {
      const set = d.SET_BY_ID[sid];
      if (!set) return;
      const pieces = counts[sid];
      const stages = set.bonuses.filter((b) => pieces >= b.pieces);
      if (stages.length) out.push({ setId: sid, name: set.name, color: set.color, pieces, stages });
    });
    return out;
  }

  // ---- 英雄有效屬性 ----
  function heroStats(heroId, mods) {
    const d = D();
    const def = heroDef(heroId);
    if (!def) return null;
    const hs = def.entry;
    mods = mods || globalMods();
    const lvl = hs.level;
    const b = def.base, g = def.growth;

    let atk = b.atk + g.atk * (lvl - 1);
    let maxHp = b.maxHp + g.maxHp * (lvl - 1);
    let def_ = b.def + g.def * (lvl - 1);
    let crit = b.crit, critDmg = b.critDmg, atkInterval = b.atkInterval;
    let lifesteal = b.lifesteal;
    let hit = (b.hit || 0) + 8 * (lvl - 1);   // 命中（隨等級成長）
    let dodge = b.dodge || 0;                 // 閃避（rating）

    // 裝備（主屬 + 具名裝固定副屬）
    const addStat = (stat, v) => {
      if (stat === "atk") atk += v;
      else if (stat === "maxHp") maxHp += v;
      else if (stat === "def") def_ += v;
      else if (stat === "critDmg") critDmg += v;
      else if (stat === "dodge") dodge += v;
      else if (stat === "hit") hit += v;
    };
    d.EQUIPMENT_SLOTS.forEach((sl) => {
      const it = itemByUid(hs.equip[sl.id]);
      if (!it) return;
      addStat(sl.stat, d.itemMainStat(it));
      // 裝備自帶副詞條
      (it.subs || []).forEach((st) => addStat(st, d.itemSubStat(it, st)));
    });

    // 技能（被動，資料驅動：HERO_SKILLS[id].passiveMods(l)）
    const sk = hs.skills;
    (def.skills || []).forEach((sid) => {
      const sdef = d.HERO_SKILLS[sid];
      const l = sk[sid] || 0;
      if (!sdef || sdef.type !== "passive" || !l || !sdef.passiveMods) return;
      const pm = sdef.passiveMods(l);
      if (pm.atkMul) atk *= 1 + pm.atkMul;
      if (pm.hpMul) maxHp *= 1 + pm.hpMul;
      if (pm.defMul) def_ *= 1 + pm.defMul;
      if (pm.critAdd) crit += pm.critAdd;
      if (pm.critDmgAdd) critDmg += pm.critDmgAdd;
      if (pm.atkSpeedMul) atkInterval *= 1 - pm.atkSpeedMul;
      if (pm.dodgeAdd) dodge += pm.dodgeAdd;
    });

    // 套裝：同稀有度（≥4 件且全部同稀有度）→ 攻擊/生命/防禦 ×倍率
    const set = heroSetBonus(heroId);
    if (set) { atk *= set.mult; maxHp *= set.mult; def_ *= set.mult; }

    // 具名套裝（2/4/6 階段）：mods 加總後套用，special 機制累加
    const mech = { multi: 0, explode: 0, execute: 0, reflect: 0, regen: 0 };
    const nm = { atkMul: 0, hpMul: 0, defMul: 0, critAdd: 0, critDmgAdd: 0, atkSpeedMul: 0, lifestealAdd: 0, dodgeAdd: 0, hitAdd: 0 };
    heroNamedSets(heroId).forEach((ns) => {
      ns.stages.forEach((b) => {
        const m = b.mods || {};
        Object.keys(nm).forEach((k) => { if (m[k]) nm[k] += m[k]; });
        (b.special || []).forEach((sp) => { if (mech[sp.k] != null) mech[sp.k] += sp.v; });
      });
    });
    atk *= 1 + nm.atkMul; maxHp *= 1 + nm.hpMul; def_ *= 1 + nm.defMul;
    crit += nm.critAdd; critDmg += nm.critDmgAdd;
    atkInterval *= 1 - Math.min(0.7, nm.atkSpeedMul);
    lifesteal += nm.lifestealAdd; dodge += nm.dodgeAdd; hit += nm.hitAdd;

    // 全域倍率
    atk *= 1 + mods.atkMul;
    maxHp *= 1 + mods.hpMul;
    def_ *= 1 + mods.defMul;
    crit += mods.critAdd;
    critDmg += mods.critDmgAdd;
    atkInterval *= 1 - Math.min(0.7, mods.atkSpeedMul);
    lifesteal += mods.lifestealAdd;
    dodge += mods.dodgeAdd || 0;
    hit += mods.hitAdd || 0;

    crit = Math.min(0.75, crit);   // 暴擊率封頂 75%
    atkInterval = Math.max(0.25, atkInterval);

    const out = {
      atk: Math.round(atk), maxHp: Math.round(maxHp), def: Math.round(def_),
      crit, critDmg, atkInterval, lifesteal, hit: Math.round(hit), dodge: Math.round(dodge),
      multi: mech.multi, explode: mech.explode, execute: mech.execute, reflect: mech.reflect, regen: mech.regen,
    };
    out.power = Math.round((out.atk / out.atkInterval) * 12 + out.maxHp / 4 + out.def * 3 + out.crit * 200);
    return out;
  }

  function heroPower(heroId) {
    const s = heroStats(heroId);
    return s ? s.power : 0;
  }
  function teamPower() {
    return State.party.reduce((a, id) => a + heroPower(id), 0);
  }

  // ---- 貨幣 ----
  function addGold(amount, raw) {
    const mods = globalMods();
    const v = Math.floor(amount * (raw ? 1 : 1 + mods.goldMul));
    State.gold += v;
    State._goldSec += v;
    return v;
  }
  function addGems(amount, raw) {
    const mods = globalMods();
    const v = Math.floor(amount * (raw ? 1 : 1 + mods.gemMul));
    State.gems += v;
    State._gemSec += v;
    return v;
  }
  function spend(cur, cost) {
    if ((State[cur] || 0) < cost) return false;
    State[cur] -= cost;
    return true;
  }

  function tickSecond() {
    State.goldPerSec = State.goldPerSec * 0.8 + State._goldSec * 0.2;
    State.gemPerSec = State.gemPerSec * 0.8 + State._gemSec * 0.2;
    State._goldSec = 0;
    State._gemSec = 0;
  }

  // ---- 擊殺結算 ----
  function onKill(enemy) {
    addGold(enemy.gold);
    // 打怪不掉鑽石（鑽石只來自鑽石寶箱與任務）
    State.stats.totalKills++;
    State.daily.counters.killsToday++;
    if (enemy.isBoss) {
      State.stats.bossKills++;
      State.daily.counters.bossToday++;
    }
    // 角色經驗：全隊出戰者各全拿 enemy.xp（微量；XP_MUL 可調）
    const lvUps = grantXp(Math.max(1, Math.round((enemy.xp || 1) * XP_MUL)));
    // 怪物只掉「素材」（依各怪 MONSTER_DROPS、隱藏掉率）；裝備改由套裝合成/商店取得
    const drops = grantMaterialDrops(enemy);
    if (lvUps.length) return Object.assign({ levelUps: lvUps }, drops || {});
    return drops;
  }

  // ---- 經驗與升級（純經驗制，上限 LEVEL_CAP）----
  const XP_MUL = 0.3; // 微量經驗倍率（隱藏可調）
  function grantXp(amount) {
    const d = D();
    const ups = [];
    State.party.forEach((uid) => {
      const r = rosterByUid(uid);
      if (!r || r.level >= d.LEVEL_CAP) return;
      r.exp = (r.exp || 0) + amount;
      let leveled = false;
      while (r.level < d.LEVEL_CAP && r.exp >= d.xpForLevel(r.level)) {
        r.exp -= d.xpForLevel(r.level);
        r.level++;
        leveled = true;
      }
      if (r.level >= d.LEVEL_CAP) r.exp = 0;
      if (leveled) ups.push({ uid: r.uid, name: r.name, level: r.level });
    });
    return ups;
  }
  // 轉職（不可逆）：需父職符合且等級達標
  function jobChange(uid, toId) {
    const d = D();
    const r = rosterByUid(uid);
    if (!r) return { ok: false, msg: "找不到角色" };
    const to = d.JOB_BY_ID[toId];
    if (!to) return { ok: false, msg: "未知職業" };
    if (to.from !== r.job) return { ok: false, msg: "轉職路線不符" };
    if (r.level < to.reqLevel) return { ok: false, msg: "需要 Lv" + to.reqLevel };
    r.job = toId;
    if (State.party.indexOf(uid) >= 0 && Game.Engine && Game.Engine.onPartyChanged) Game.Engine.onPartyChanged();
    return { ok: true, job: to };
  }

  // ---- 招募 ----
  function rollCandidate() {
    const d = D();
    const t1 = Math.random() < d.RECRUIT.t1Chance;
    const tier1 = d.JOBS.filter((j) => j.tier === 1);
    const job = t1 ? tier1[Math.floor(Math.random() * tier1.length)].id : "adventurer";
    const rolls = rollBaseRolls();
    // 品質 q = rolls 平均（0.85~1.15）→ 價格隨品質強烈遞增
    let q = 0; ROLL_STATS.forEach((k) => (q += rolls[k])); q /= ROLL_STATS.length;
    const base = t1 ? d.RECRUIT.t1Cost : d.RECRUIT.baseCost;
    const cost = Math.floor(base * (0.4 + Math.pow(q, 8)));
    return { name: randomName(), job, level: t1 ? 15 : 1, baseRolls: rolls, cost };
  }
  function ensureRecruits() {
    State.recruit = State.recruit || { date: todayStr(), candidates: [], refreshes: 0 };
    const rc = State.recruit;
    if (rc.date !== todayStr()) { rc.date = todayStr(); rc.candidates = []; rc.refreshes = 0; }
    while (rc.candidates.length < D().RECRUIT.slots) rc.candidates.push(rollCandidate());
    return rc.candidates;
  }
  function refreshRecruits() {
    const rc = State.recruit;
    const cost = D().RECRUIT.refreshGold(rc.refreshes || 0);
    if (State.gold < cost) return { ok: false, msg: "金幣不足" };
    State.gold -= cost;
    rc.refreshes = (rc.refreshes || 0) + 1;
    rc.candidates = [];
    ensureRecruits();
    return { ok: true };
  }
  function recruitHero(idx) {
    const rc = State.recruit;
    const cand = rc.candidates[idx];
    if (!cand) return { ok: false, msg: "沒有這名候選" };
    if (State.gold < cand.cost) return { ok: false, msg: "金幣不足" };
    State.gold -= cand.cost;
    const entry = makeRosterEntry(cand.name, cand.job, cand.level, cand.baseRolls);
    State.roster.push(entry);
    rc.candidates.splice(idx, 1);
    ensureRecruits();
    if (State.party.length < D().PARTY_MAX) { State.party.push(entry.uid); if (Game.Engine && Game.Engine.onPartyChanged) Game.Engine.onPartyChanged(); }
    return { ok: true, entry };
  }

  // 加素材（堆疊上限 999）
  function addMaterial(id, n) {
    State.materials = State.materials || {};
    State.materials[id] = Math.min(999, (State.materials[id] || 0) + (n || 1));
  }
  // 依該怪 MONSTER_DROPS 掉素材：每素材依稀有度獨立擲隱藏掉率；bossOnly 只在王掉；另低機率掉卷軸
  function grantMaterialDrops(enemy) {
    const d = D();
    const ids = d.MONSTER_DROPS[enemy.monsterId];
    const got = [];
    if (ids && ids.length) {
      const rates = d.DROP.materialRate;
      const mul = (enemy.isBoss || enemy.isElite) ? d.DROP.bossMatBonus : 1;
      const rolls = enemy.isChest ? d.DROP.chestMatRolls : 1;
      for (let k = 0; k < rolls; k++) {
        for (let i = 0; i < ids.length; i++) {
          const mat = d.MATERIAL_BY_ID[ids[i]]; if (!mat) continue;
          if (mat.bossOnly && !enemy.isBoss) continue;
          const rate = mat.bossOnly ? 0.6 : Math.min(1, (rates[mat.rarity] || 0.3) * mul);
          if (Math.random() < rate) { addMaterial(ids[i], 1); got.push(ids[i]); }
        }
      }
    }
    if (Math.random() < d.DROP.scrollDropChance) {
      const t = Math.random() < 0.7 ? 0 : Math.random() < 0.66 ? 1 : 2;
      State.scrolls[t] = (State.scrolls[t] || 0) + 1;
      got.push("scroll" + t);
    }
    return got.length ? { materials: got } : null;
  }

  // 依掉落權重表給予：卷軸（scrollN）→scrolls[N]++（回傳 {scroll:true,tier:N}）；裝備→push 並回傳物件
  function grantDrop(table, stage, isChest) {
    const outcome = rollRarityWeighted(table);
    if (outcome.indexOf("scroll") === 0) {
      const idx = +outcome.slice(6);
      State.scrolls[idx] = (State.scrolls[idx] || 0) + 1;
      return { scroll: true, tier: idx };
    }
    const item = rollGear(outcome, stage, isChest);
    State.inventory.push(item);
    return item;
  }

  // ---- 過關掉寶箱（只給貨幣）----
  function onStageClear(stage) {
    const d = D();
    if (Math.random() >= d.STAGE_BOX.chance) return null;
    State.stats.boxesOpened++;
    State.daily.counters.boxesToday++;
    if (Math.random() < d.STAGE_BOX.goldShare) {
      const g = d.stageBoxGold(stage);
      addGold(g, true);
      return { box: "gold", gold: g };
    }
    const span = d.STAGE_BOX.gemMax - d.STAGE_BOX.gemMin + 1;
    const n = d.STAGE_BOX.gemMin + Math.floor(Math.random() * span);
    addGems(n, true);
    return { box: "gem", gems: n };
  }

  // ---- 關卡 ----
  function noteStage(stage) {
    State.stage = stage;
    if (stage > State.runBestStage) State.runBestStage = stage;
    if (stage > State.bestStage) {
      const crossed = Math.floor(stage / 5) > Math.floor(State.bestStage / 5);
      State.bestStage = stage;
      if (crossed) { State.talentPoints += 1; } // 里程碑給才能點（鑽石只來自鑽石寶箱與任務）
    }
  }

  // ---- 英雄 ----
  function ownedHeroes() {
    return (State.roster || []).map((r) => r.uid);
  }
  function upgradeSkill(heroId, skillId) {
    const d = D();
    const def = d.HERO_SKILLS[skillId];
    const hs = rosterByUid(heroId);
    if (!def || !hs) return false;
    const lv = hs.skills[skillId] || 0;
    if (lv >= def.maxLevel) return false;
    const cost = def.cost(lv);
    if (State.gold < cost) return false;
    State.gold -= cost;
    hs.skills[skillId] = lv + 1;
    return true;
  }
  function setParty(arr) {
    State.party = arr.filter((uid) => rosterByUid(uid)).slice(0, D().PARTY_MAX);
    if (State.party.length === 0 && State.roster.length) State.party = [State.roster[0].uid];
  }
  function toggleParty(id) {
    const i = State.party.indexOf(id);
    if (i >= 0) {
      if (State.party.length > 1) State.party.splice(i, 1);
    } else if (State.party.length < D().PARTY_MAX) {
      State.party.push(id);
    }
  }
  // 寵物上場數值（坦：高生命，依等級＋稀有度，參考隊伍最強英雄生命；不攻擊）
  function petStats(id) {
    const d = D(), p = State.pets[id];
    if (!p) return null;
    const def = d.PET_BY_ID[id], lv = p.level || 1;
    const mods = globalMods();
    let ref = 1;
    State.party.forEach((h) => { const hs = heroStats(h, mods); if (hs && hs.maxHp > ref) ref = hs.maxHp; });
    const rmult = { common: 1.0, uncommon: 1.3, rare: 1.7, epic: 2.2, legendary: 3.0, mythic: 4.0 }[def.rarity] || 1;
    const maxHp = Math.floor(ref * (0.7 + 0.25 * (lv - 1)) * rmult);
    return { maxHp: maxHp, def: 0, dodge: 0, hit: 0, atk: 0, atkInterval: 99, crit: 0, critDmg: 1, regen: 0, lifesteal: 0 };
  }
  // ---- 3×3 陣型（lane 0..2 上中下、col 0..2 前中後；col0=前排靠敵）----
  function clearCell(lane, col, exceptId) {
    State.party.forEach((hid) => {
      if (hid === exceptId) return;
      const r = rosterByUid(hid);
      const p = r && r.pos;
      if (p && p.lane === lane && p.col === col) r.pos = null;
    });
    if (State.activePet && State.activePet !== exceptId) {
      const pp = State.pets[State.activePet] && State.pets[State.activePet].pos;
      if (pp && pp.lane === lane && pp.col === col) State.pets[State.activePet].pos = null;
    }
  }
  function setHeroPos(id, lane, col) { const r = rosterByUid(id); if (!r) return; clearCell(lane, col, id); r.pos = { lane: lane, col: col }; }
  function clearHeroPos(id) { const r = rosterByUid(id); if (r) r.pos = null; }
  function setPetPos(id, lane, col) { if (!State.pets[id]) return; clearCell(lane, col, id); State.pets[id].pos = { lane: lane, col: col }; }
  function clearPetPos(id) { if (State.pets[id]) State.pets[id].pos = null; }
  // 出戰名單（隊伍英雄＋出戰中寵物）的實際站位：先放有 pos 的（衝突先到為準），其餘自動補位
  function formationLayout() {
    const d = D();
    const units = [];
    State.party.slice(0, d.PARTY_MAX).forEach((id) => { const r = rosterByUid(id); units.push({ id: id, kind: "hero", pos: r && r.pos }); });
    if (State.activePet && State.pets[State.activePet]) units.push({ id: State.activePet, kind: "pet", pos: State.pets[State.activePet].pos });
    const used = {}, out = [], key = (l, c) => l + "," + c;
    units.forEach((u) => {
      const p = u.pos;
      if (p && p.lane >= 0 && p.lane < d.LANES && p.col >= 0 && p.col < 3 && !used[key(p.lane, p.col)]) {
        used[key(p.lane, p.col)] = true;
        out.push({ id: u.id, kind: u.kind, lane: p.lane, col: p.col });
      } else {
        out.push({ id: u.id, kind: u.kind, lane: null, col: null });
      }
    });
    const lanesByPref = [1, 0, 2];
    function findCell(prefCols) {
      for (const c of prefCols) for (const l of lanesByPref) if (!used[key(l, c)]) return { lane: l, col: c };
      return null;
    }
    out.forEach((e) => {
      if (e.lane != null) return;
      let prefer;
      if (e.kind === "pet") prefer = [0, 1, 2]; // 寵物優先前排當坦
      else { const hd = heroDef(e.id); prefer = hd && hd.range <= 1 ? [0, 1, 2] : [2, 1, 0]; } // 近戰前排、遠程後排
      const cell = findCell(prefer) || findCell([0, 1, 2]);
      if (cell) { used[key(cell.lane, cell.col)] = true; e.lane = cell.lane; e.col = cell.col; }
      else { e.lane = 1; e.col = 1; }
    });
    return out;
  }

  // ---- 裝備 / 浮動數值帶 ----
  function rollRarityWeighted(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let x = Math.random() * total;
    for (const k in weights) { x -= weights[k]; if (x <= 0) return k; }
    return Object.keys(weights)[0];
  }
  // 擲一段稀有度帶（量化為整數百分位，讓「100% = 最完美」抽得到）
  function rollBand(rarity) {
    const b = D().RARITY_BANDS[rarity];
    if (!b) return 0;
    return b[0] + (b[1] - b[0]) * (Math.floor(Math.random() * 101) / 100);
  }
  // 擲 common..rarity 各一段，回傳 bands 陣列
  function rollBands(rarity) {
    const d = D();
    const idx = d.RARITY_ORDER.indexOf(rarity);
    const arr = [];
    for (let i = 0; i <= idx; i++) arr.push(rollBand(d.RARITY_ORDER[i]));
    return arr;
  }
  // 此裝備擁有的屬性清單（主屬性 + 自帶副詞條 it.subs）
  function itemAttrStats(it) {
    const stats = [D().SLOT_BY_ID[it.slot].stat];
    (it.subs || []).forEach((st) => { if (stats.indexOf(st) < 0) stats.push(st); });
    return stats;
  }
  // 隨機抽副詞條（六核心去掉主詞條，數量依 tier）
  function rollSubs(slot, tier) {
    const d = D();
    const primary = d.SLOT_BY_ID[slot].stat;
    const n = d.subCountForTier(tier);
    const pool = d.SUB_STAT_POOL.filter((s) => s !== primary);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    return pool.slice(0, n);
  }
  // 每屬性各自一組 bands（分開浮動）
  function rollAttrBands(rarity, stats) {
    const ab = {};
    stats.forEach((st) => { ab[st] = rollBands(rarity); });
    return ab;
  }
  // 確保 item 有 subs 與 aBands（兼舊存檔遷移：缺 subs 依 tier 補抽、缺的 aBands 才補）
  function ensureItemAttrBands(it) {
    if (!it) return it;
    if (!Array.isArray(it.subs)) it.subs = rollSubs(it.slot, it.tier);
    if (!it.aBands || typeof it.aBands !== "object") it.aBands = {};
    itemAttrStats(it).forEach((st) => { if (!Array.isArray(it.aBands[st])) it.aBands[st] = rollBands(it.rarity); });
    return it;
  }
  // 建立裝備物件（含鎖定 bands、自帶副詞條、每屬性 aBands）
  function makeItem(slot, rarity, tier, setId) {
    const it = { uid: State.invSeq++, slot, rarity, tier, enhance: 0, stars: 0, setId: setId || null, bands: rollBands(rarity) };
    it.subs = rollSubs(slot, tier);
    it.aBands = rollAttrBands(rarity, itemAttrStats(it));
    return it;
  }
  // 怪物掉落具名裝（區域套裝、固定副屬、可參與具名+稀有度套裝）
  function rollGear(rarity, stage, isChest) {
    const d = D();
    const setIds = d.SETS_BY_REGION[d.regionOf(stage)];
    const setId = setIds && setIds.length ? setIds[Math.floor(Math.random() * setIds.length)] : null;
    const slot = d.EQUIPMENT_SLOTS[Math.floor(Math.random() * d.EQUIPMENT_SLOTS.length)].id;
    const tier = d.itemTierForStage(stage) + (isChest ? d.DROP.chestTierBonus : 0);
    return makeItem(slot, rarity, tier, setId);
  }
  // 套裝合成：生成指定 套裝×部位×稀有度 的具名裝
  function rollGearForSet(setId, slot, rarity) {
    const d = D();
    if (!d.SET_BY_ID[setId] || !d.SLOT_BY_ID[slot]) return null;
    return makeItem(slot, rarity, d.itemTierForStage(State.stage), setId);
  }
  // 套裝合成：消耗素材 → 產出 1 件（稀有度隨機 普通~稀有）
  function craftSetPiece(setId, slot) {
    const d = D();
    const recipe = d.setRecipe(setId, slot);
    if (!recipe || !recipe.materials) return { ok: false, msg: "無此配方" };
    State.materials = State.materials || {};
    for (const mid in recipe.materials) {
      if ((State.materials[mid] || 0) < recipe.materials[mid]) return { ok: false, msg: "素材不足" };
    }
    for (const mid in recipe.materials) State.materials[mid] -= recipe.materials[mid];
    const rarity = ["common", "uncommon", "rare"][Math.floor(Math.random() * 3)];
    const item = rollGearForSet(setId, slot, rarity);
    if (!item) return { ok: false, msg: "生成失敗" };
    State.inventory.push(item);
    return { ok: true, item, rarity };
  }
  // 商店：購買普通（不具名）裝備
  function buyCommonGear(slot) {
    const d = D();
    if (!d.SLOT_BY_ID[slot]) return null;
    const cost = d.commonGearCost(State.stage);
    if (State.gold < cost) return null;
    State.gold -= cost;
    const it = makeItem(slot, "common", d.itemTierForStage(State.stage), null);
    State.inventory.push(it);
    return it;
  }
  function isEquipped(uid) {
    return (State.roster || []).some((r) => {
      const eq = r.equip;
      return Object.keys(eq).some((s) => eq[s] === uid);
    });
  }
  function unequipUidEverywhere(uid) {
    (State.roster || []).forEach((r) => {
      const eq = r.equip;
      Object.keys(eq).forEach((s) => { if (eq[s] === uid) eq[s] = null; });
    });
  }
  function equipItem(heroId, uid) {
    const it = itemByUid(uid);
    const hs = rosterByUid(heroId);
    if (!it || !hs) return false;
    unequipUidEverywhere(uid);
    hs.equip[it.slot] = uid;
    return true;
  }
  function unequipSlot(heroId, slot) {
    const hs = rosterByUid(heroId);
    if (hs) hs.equip[slot] = null;
  }
  function bestItemForSlot(heroId, slot) {
    const d = D();
    const hs = rosterByUid(heroId);
    let best = null, bestVal = -1;
    State.inventory.forEach((it) => {
      if (it.slot !== slot) return;
      if (isEquipped(it.uid) && (!hs || hs.equip[slot] !== it.uid)) return;
      const v = d.itemMainStat(it);
      if (v > bestVal) { bestVal = v; best = it; }
    });
    return best;
  }
  function autoEquipBest(heroId) {
    D().EQUIPMENT_SLOTS.forEach((sl) => {
      const it = bestItemForSlot(heroId, sl.id);
      if (it) equipItem(heroId, it.uid);
    });
  }
  function enhanceItem(uid) {
    const it = itemByUid(uid);
    if (!it) return false;
    if ((it.enhance || 0) >= D().ENHANCE_MAX) return false;
    const cost = D().enhanceCost(it);
    if (State.gold < cost) return false;
    State.gold -= cost;
    it.enhance++;
    return true;
  }
  // ---- 升星卷軸合成（5 張合成上一階 1 張）----
  function craftScroll(i, qty) {
    const d = D();
    i = +i;
    if (isNaN(i) || i < 0 || i >= d.SCROLL_TIERS - 1) return 0; // 9-10 為頂不可再合
    qty = Math.max(1, Math.floor(qty || 1));
    const max = Math.floor((State.scrolls[i] || 0) / d.CRAFT_RATIO);
    if (max < 1) return 0;
    qty = Math.min(qty, max);
    State.scrolls[i] -= d.CRAFT_RATIO * qty;
    State.scrolls[i + 1] = (State.scrolls[i + 1] || 0) + qty;
    return qty; // 回傳實際產出張數（>0 為成功）
  }
  // 嘗試升星：回傳 {ok, success, destroyed, protected, guardUsed, msg}
  // 星 X→X+1 需用「X-(X+1)」卷（scrolls[X]）；星上限依稀有度
  // useGuardian（全域勾選）：當次有損毀風險（d>0）且持有守護時，不論成敗都消耗 1 顆、失敗不損毀
  function starUp(uid, useGuardian) {
    const d = D();
    const it = itemByUid(uid);
    if (!it) return { ok: false, msg: "找不到裝備" };
    const star = it.stars || 0;
    const cap = d.RARITY_STAR_CAP[it.rarity] || d.STAR_MAX;
    if (star >= cap) return { ok: false, msg: "已達此稀有度星上限" };
    if ((State.scrolls[star] || 0) < 1) return { ok: false, msg: d.scrollTierName(star) + " 星卷不足" };
    const rule = d.STAR_RULES[star];
    const risky = rule.d > 0;
    const guardActive = !!useGuardian && risky && (State.guardians || 0) > 0;
    State.scrolls[star]--;
    if (guardActive) State.guardians--; // 有風險且開啟 → 不論成敗都消耗
    if (Math.random() < rule.s) {
      it.stars = star + 1;
      return { ok: true, success: true, star: it.stars, guardUsed: guardActive };
    }
    // 失敗：再用 destroy 機率判定是否損毀
    if (risky && Math.random() < rule.d) {
      if (guardActive) return { ok: true, success: false, destroyed: false, protected: true, guardUsed: true };
      unequipUidEverywhere(uid);
      State.inventory = State.inventory.filter((x) => x.uid !== uid);
      return { ok: true, success: false, destroyed: true };
    }
    return { ok: true, success: false, destroyed: false, guardUsed: guardActive };
  }
  // 滿星 → 升級至下一稀有度（星歸零、累加新階浮動帶）
  function upgradeRarity(uid) {
    const d = D();
    const it = itemByUid(uid);
    if (!it) return false;
    const cap = d.RARITY_STAR_CAP[it.rarity] || d.STAR_MAX;
    const nr = d.nextRarity(it.rarity);
    if ((it.stars || 0) < cap || !nr) return false;
    const nrIdx = d.RARITY_ORDER.indexOf(nr);
    if (!Array.isArray(it.bands)) it.bands = [];
    // 補齊舊存檔缺漏的低階帶（以各階中點），確保長度 = 原稀有度階數
    while (it.bands.length < nrIdx) it.bands.push(d.bandMid(d.RARITY_ORDER[it.bands.length]));
    it.bands = it.bands.slice(0, nrIdx);
    it.bands.push(rollBand(nr));
    // 每屬性各自再給一筆新稀有度浮動（與打怪掉落同規則）
    ensureItemAttrBands(it);
    itemAttrStats(it).forEach((st) => {
      if (!Array.isArray(it.aBands[st])) it.aBands[st] = [];
      while (it.aBands[st].length < nrIdx) it.aBands[st].push(d.bandMid(d.RARITY_ORDER[it.aBands[st].length]));
      it.aBands[st] = it.aBands[st].slice(0, nrIdx);
      it.aBands[st].push(rollBand(nr));
    });
    it.rarity = nr;
    it.stars = 0;
    return true;
  }

  // 洗鍊：重抽指定屬性的浮動（aBands），直接取代（可能變好或變差）
  function reforgeAttrs(uid, stats) {
    const it = itemByUid(uid);
    if (!it || !Array.isArray(stats) || !stats.length) return false;
    ensureItemAttrBands(it);
    const own = itemAttrStats(it);
    stats.forEach((st) => { if (own.indexOf(st) >= 0) it.aBands[st] = rollBands(it.rarity); });
    return true;
  }
  function salvageItem(uid) {
    const it = itemByUid(uid);
    if (!it || isEquipped(uid)) return false;
    State.gold += D().salvageValue(it);
    State.inventory = State.inventory.filter((x) => x.uid !== uid);
    return true;
  }
  function salvageAllBelow(rarityId) {
    const d = D();
    const order = d.RARITIES.map((r) => r.id);
    const maxIdx = order.indexOf(rarityId);
    let total = 0, n = 0;
    State.inventory = State.inventory.filter((it) => {
      if (isEquipped(it.uid)) return true;
      if (order.indexOf(it.rarity) < maxIdx) {
        total += d.salvageValue(it); n++;
        return false;
      }
      return true;
    });
    State.gold += total;
    return { gold: total, count: n };
  }
  // 智慧清理：分解所有「未裝備且不優於目前已穿戴同部位」的裝備
  function salvageWeak() {
    const d = D();
    const bestEq = {};
    (State.roster || []).forEach((r) => {
      const eq = r.equip;
      d.EQUIPMENT_SLOTS.forEach((sl) => {
        const it = itemByUid(eq[sl.id]);
        if (it) {
          const v = d.itemMainStat(it);
          if (v > (bestEq[sl.id] || 0)) bestEq[sl.id] = v;
        }
      });
    });
    let total = 0, n = 0;
    State.inventory = State.inventory.filter((it) => {
      if (isEquipped(it.uid)) return true;
      const v = d.itemMainStat(it);
      if ((bestEq[it.slot] || 0) >= v) { total += d.salvageValue(it); n++; return false; }
      return true;
    });
    State.gold += total;
    return { gold: total, count: n };
  }

  // ---- 訓練 / 才能 / 轉生 ----
  function trainingCost(t) {
    const lv = State.trainings[t.id] || 0;
    return Math.floor(t.base * Math.pow(t.mul, lv));
  }
  function buyTraining(id) {
    const t = D().TRAININGS.find((x) => x.id === id);
    if (!t) return false;
    const cost = trainingCost(t);
    if (State.gold < cost) return false;
    State.gold -= cost;
    State.trainings[id] = (State.trainings[id] || 0) + 1;
    return true;
  }
  function buyTalent(id) {
    const t = D().TALENTS.find((x) => x.id === id);
    if (!t) return false;
    const lv = State.talents[id] || 0;
    if (lv >= t.max || State.talentPoints <= 0) return false;
    State.talentPoints--;
    State.talents[id] = lv + 1;
    return true;
  }
  function prestigeNodeCost(n) {
    const lv = State.prestige.nodes[n.id] || 0;
    return n.cost(lv);
  }
  function buyPrestigeNode(id) {
    const n = D().PRESTIGE.nodes.find((x) => x.id === id);
    if (!n) return false;
    const lv = State.prestige.nodes[id] || 0;
    if (lv >= n.max) return false;
    const cost = prestigeNodeCost(n);
    if (State.souls < cost) return false;
    State.souls -= cost;
    State.prestige.nodes[id] = lv + 1;
    return true;
  }
  function canPrestige() {
    return State.runBestStage >= D().PRESTIGE.minStage;
  }
  function prestigeGain() {
    return D().PRESTIGE.soulFormula(State.runBestStage);
  }
  function doPrestige() {
    if (!canPrestige()) return 0;
    const gain = prestigeGain();
    State.souls += gain;
    State.prestige.count++;
    State.stats.prestiges++;
    State.talentPoints += 3;
    // 重置：關卡、金幣、訓練、角色等級/經驗（保留 名冊/職業/裝備/技能/寵物/才能/鑽石/轉生）
    State.stage = 1;
    State.runBestStage = 1;
    State.gold = 0;
    State.trainings = {};
    (State.roster || []).forEach((r) => { r.level = 1; r.exp = 0; });
    return gain;
  }

  // ---- 寵物 ----
  function ownPet(id) {
    if (!State.pets[id]) State.pets[id] = { level: 1 };
    if (!State.activePet) State.activePet = id;
  }
  function upgradePet(id) {
    if (!State.pets[id]) return false;
    const cost = D().petUpgradeCost(State.pets[id].level);
    if (State.gold < cost) return false;
    State.gold -= cost;
    State.pets[id].level++;
    return true;
  }
  function setActivePet(id) {
    if (State.pets[id]) State.activePet = id;
  }

  // ---- 商店 ----
  function refreshShopDate() {
    const t = todayStr();
    if (State.shop.date !== t) {
      State.shop.date = t;
      // 清除每日限購計數
      D().SHOP.forEach((s) => { if (s.daily) delete State.shop.bought[s.id]; });
    }
  }
  function shopBuy(id, qty) {
    refreshShopDate();
    const s = D().SHOP.find((x) => x.id === id);
    if (!s) return { ok: false, msg: "找不到商品" };
    qty = Math.max(1, Math.floor(qty || 1));
    const bought = State.shop.bought[id] || 0;
    if (s.once && bought >= 1) return { ok: false, msg: "已購買" };
    if (s.limit) { const room = s.limit - bought; if (room <= 0) return { ok: false, msg: "今日已達上限" }; qty = Math.min(qty, room); }
    const total = s.cost * qty;
    if ((State[s.cur] || 0) < total) return { ok: false, msg: "貨幣不足" };
    State[s.cur] -= total;
    State.shop.bought[id] = bought + qty;
    const g = s.give;
    let result = {};
    if (g.guardian) State.guardians = (State.guardians || 0) + g.guardian * qty;
    if (g.scroll !== undefined) State.scrolls[g.scroll] = (State.scrolls[g.scroll] || 0) + qty;
    if (g.pet) ownPet(g.pet);
    if (g.gold) addGold(g.gold * qty, true);
    if (g.gems) addGems(g.gems * qty, true);
    return { ok: true, qty, give: g, result };
  }
  function shopState(id) {
    refreshShopDate();
    const s = D().SHOP.find((x) => x.id === id);
    const bought = State.shop.bought[id] || 0;
    const soldOut = (s.once && bought >= 1) || (s.limit && bought >= s.limit);
    return { bought, soldOut, remain: s.limit ? s.limit - bought : null };
  }

  // ---- 每日 / 成就 ----
  function refreshDaily() {
    const t = todayStr();
    if (State.daily.date !== t) {
      State.daily = { date: t, claimed: {}, login: false,
        counters: { killsToday: 0, boxesToday: 0, bossToday: 0 } };
    }
  }
  function claimDailyLogin() {
    refreshDaily();
    if (State.daily.login) return false;
    State.daily.login = true;
    addGems(20, true);
    return true;
  }
  function dailyProgress(q) {
    return State.daily.counters[q.stat] || 0;
  }
  function claimDaily(id) {
    refreshDaily();
    const q = D().DAILY_QUESTS.find((x) => x.id === id);
    if (!q || State.daily.claimed[id]) return false;
    if (dailyProgress(q) < q.goal) return false;
    State.daily.claimed[id] = true;
    if (q.reward.gold) addGold(q.reward.gold, true);
    if (q.reward.gems) addGems(q.reward.gems, true);
    return true;
  }
  function statValue(stat) {
    if (stat === "bestStage") return State.bestStage;
    return State.stats[stat] || 0;
  }
  function achProgress(a) {
    return statValue(a.stat);
  }
  function claimAchievement(id) {
    const a = D().ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || State.achievements[id]) return false;
    if (achProgress(a) < a.goal) return false;
    State.achievements[id] = true;
    if (a.reward.gold) addGold(a.reward.gold, true);
    if (a.reward.gems) addGems(a.reward.gems, true);
    return true;
  }

  Game.Systems = {
    defaultState, setState, todayStr,
    globalMods, heroStats, heroPower, teamPower, itemByUid, heroSetBonus, heroNamedSets,
    addGold, addGems, spend, tickSecond, onKill, onStageClear, noteStage,
    ownedHeroes, rosterByUid, heroDef, makeStarter, makeRosterEntry, grantXp, jobChange, rollCandidate, ensureRecruits, refreshRecruits, recruitHero,
    upgradeSkill, setParty, toggleParty, setHeroPos, clearHeroPos, setPetPos, clearPetPos, formationLayout, petStats,
    rollBands, rollBand, makeItem, rollGear, buyCommonGear, ensureItemAttrBands, itemAttrStats,
    addMaterial, grantMaterialDrops, rollGearForSet, craftSetPiece,
    isEquipped, equipItem, unequipSlot, autoEquipBest, bestItemForSlot,
    enhanceItem, craftScroll, starUp, upgradeRarity, reforgeAttrs, salvageItem, salvageAllBelow, salvageWeak,
    trainingCost, buyTraining, buyTalent, prestigeNodeCost, buyPrestigeNode,
    canPrestige, prestigeGain, doPrestige,
    ownPet, upgradePet, setActivePet,
    refreshShopDate, shopBuy, shopState,
    refreshDaily, claimDailyLogin, dailyProgress, claimDaily,
    achProgress, claimAchievement,
  };
})();
