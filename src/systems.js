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

  function defaultState() {
    const d = D();
    return {
      version: 2,
      gold: 0, gems: 0, souls: 0,
      stage: 1, bestStage: 1, runBestStage: 1,
      heroes: {
        knight: { owned: true, level: 1, stars: 1, equip: emptyEquip(), skills: {} },
      },
      party: ["knight"],
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
      guardians: 0,
      useGuardian: false,
      speed: 1,
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
    const hs = State.heroes[heroId];
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
    const hs = State.heroes[heroId];
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
    const def = d.HERO_BY_ID[heroId];
    const hs = State.heroes[heroId];
    if (!def || !hs) return null;
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
      // 具名裝固定副屬性（由 套裝+欄位 決定）
      const set = it.setId && d.SET_BY_ID[it.setId];
      const subs = set && set.sub && set.sub[sl.id];
      if (subs) subs.forEach((st) => addStat(st, d.itemSubStat(it, st)));
    });

    // 技能（被動）
    const sk = hs.skills;
    const lv = (id) => sk[id] || 0;
    if (lv("rally")) atk *= 1 + 0.04 * lv("rally");
    if (lv("guard")) { maxHp *= 1 + 0.04 * lv("guard"); def_ *= 1 + 0.05 * lv("guard"); }
    if (lv("focus")) { crit += 0.02 * lv("focus"); critDmg += 0.05 * lv("focus"); }
    if (lv("bless")) { atkInterval *= 1 - 0.02 * lv("bless"); dodge += 2 * lv("bless"); }

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
    // 裝備/卷軸只從怪物掉落（101 關後）；一次 1 件，傳說/神話不掉
    const d = D();
    const stage = State.stage;
    if (d.regionOf(stage) < d.DROP.minRegion) return null;
    if (enemy.isChest) {
      // 寶箱怪：100% 掉落，全裝備
      return grantDrop(d.DROP.chestTable, stage, true);
    }
    const rate = enemy.isBoss ? d.DROP.bossRate : enemy.isElite ? d.DROP.eliteRate : d.DROP.normalRate;
    if (Math.random() < rate) {
      return grantDrop(d.DROP.dropTable, stage, false);
    }
    return null;
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
    return D().HEROES.filter((h) => State.heroes[h.id] && State.heroes[h.id].owned).map((h) => h.id);
  }
  function ownHero(id) {
    if (!State.heroes[id]) State.heroes[id] = { owned: true, level: 1, stars: 1, equip: emptyEquip(), skills: {} };
    State.heroes[id].owned = true;
  }
  function levelUpHero(id, times) {
    times = times || 1;
    let done = 0;
    for (let i = 0; i < times; i++) {
      const hs = State.heroes[id];
      if (!hs) break;
      const cost = D().heroLevelCost(hs.level);
      if (State.gold < cost) break;
      State.gold -= cost;
      hs.level++;
      done++;
    }
    return done;
  }
  function upgradeSkill(heroId, skillId) {
    const d = D();
    const def = d.HERO_SKILLS[skillId];
    const hs = State.heroes[heroId];
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
    State.party = arr.filter((id) => State.heroes[id] && State.heroes[id].owned).slice(0, D().PARTY_MAX);
    if (State.party.length === 0) State.party = [ownedHeroes()[0]];
  }
  function toggleParty(id) {
    const i = State.party.indexOf(id);
    if (i >= 0) {
      if (State.party.length > 1) State.party.splice(i, 1);
    } else if (State.party.length < D().PARTY_MAX) {
      State.party.push(id);
    }
  }

  // ---- 裝備 / 浮動數值帶 ----
  function rollRarityWeighted(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let x = Math.random() * total;
    for (const k in weights) { x -= weights[k]; if (x <= 0) return k; }
    return Object.keys(weights)[0];
  }
  // 擲一段稀有度帶
  function rollBand(rarity) {
    const b = D().RARITY_BANDS[rarity];
    if (!b) return 0;
    return b[0] + Math.random() * (b[1] - b[0]);
  }
  // 擲 common..rarity 各一段，回傳 bands 陣列
  function rollBands(rarity) {
    const d = D();
    const idx = d.RARITY_ORDER.indexOf(rarity);
    const arr = [];
    for (let i = 0; i <= idx; i++) arr.push(rollBand(d.RARITY_ORDER[i]));
    return arr;
  }
  // 建立裝備物件（含鎖定 bands）
  function makeItem(slot, rarity, tier, setId) {
    return { uid: State.invSeq++, slot, rarity, tier, enhance: 0, stars: 0, setId: setId || null, bands: rollBands(rarity) };
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
    return Object.keys(State.heroes).some((hid) => {
      const eq = State.heroes[hid].equip;
      return Object.keys(eq).some((s) => eq[s] === uid);
    });
  }
  function unequipUidEverywhere(uid) {
    Object.keys(State.heroes).forEach((hid) => {
      const eq = State.heroes[hid].equip;
      Object.keys(eq).forEach((s) => { if (eq[s] === uid) eq[s] = null; });
    });
  }
  function equipItem(heroId, uid) {
    const it = itemByUid(uid);
    const hs = State.heroes[heroId];
    if (!it || !hs) return false;
    unequipUidEverywhere(uid);
    hs.equip[it.slot] = uid;
    return true;
  }
  function unequipSlot(heroId, slot) {
    const hs = State.heroes[heroId];
    if (hs) hs.equip[slot] = null;
  }
  function bestItemForSlot(heroId, slot) {
    const d = D();
    let best = null, bestVal = -1;
    State.inventory.forEach((it) => {
      if (it.slot !== slot) return;
      if (isEquipped(it.uid) && State.heroes[heroId].equip[slot] !== it.uid) return;
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
  function craftScroll(i) {
    const d = D();
    i = +i;
    if (isNaN(i) || i < 0 || i >= d.SCROLL_TIERS - 1) return false; // 9-10 為頂不可再合
    if ((State.scrolls[i] || 0) < d.CRAFT_RATIO) return false;
    State.scrolls[i] -= d.CRAFT_RATIO;
    State.scrolls[i + 1] = (State.scrolls[i + 1] || 0) + 1;
    return true;
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
    it.rarity = nr;
    it.stars = 0;
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
    Object.keys(State.heroes).forEach((hid) => {
      const eq = State.heroes[hid].equip;
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
    // 重置：關卡、金幣、訓練、英雄等級（保留 owned/裝備/技能/寵物/才能/鑽石/轉生）
    State.stage = 1;
    State.runBestStage = 1;
    State.gold = 0;
    State.trainings = {};
    Object.keys(State.heroes).forEach((id) => { State.heroes[id].level = 1; });
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
  function shopBuy(id) {
    refreshShopDate();
    const s = D().SHOP.find((x) => x.id === id);
    if (!s) return { ok: false, msg: "找不到商品" };
    const bought = State.shop.bought[id] || 0;
    if (s.once && bought >= 1) return { ok: false, msg: "已購買" };
    if (s.limit && bought >= s.limit) return { ok: false, msg: "今日已達上限" };
    if ((State[s.cur] || 0) < s.cost) return { ok: false, msg: "貨幣不足" };
    State[s.cur] -= s.cost;
    State.shop.bought[id] = bought + 1;
    const g = s.give;
    let result = {};
    if (g.guardian) State.guardians = (State.guardians || 0) + g.guardian;
    if (g.scroll !== undefined) State.scrolls[g.scroll] = (State.scrolls[g.scroll] || 0) + 1;
    if (g.hero) ownHero(g.hero);
    if (g.pet) ownPet(g.pet);
    if (g.gold) addGold(g.gold, true);
    if (g.gems) addGems(g.gems, true);
    return { ok: true, give: g, result };
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
    ownedHeroes, ownHero, levelUpHero, upgradeSkill, setParty, toggleParty,
    rollBands, rollBand, makeItem, rollGear, buyCommonGear,
    isEquipped, equipItem, unequipSlot, autoEquipBest, bestItemForSlot,
    enhanceItem, craftScroll, starUp, upgradeRarity, salvageItem, salvageAllBelow, salvageWeak,
    trainingCost, buyTraining, buyTalent, prestigeNodeCost, buyPrestigeNode,
    canPrestige, prestigeGain, doPrestige,
    ownPet, upgradePet, setActivePet,
    refreshShopDate, shopBuy, shopState,
    refreshDaily, claimDailyLogin, dailyProgress, claimDaily,
    achProgress, claimAchievement,
  };
})();
