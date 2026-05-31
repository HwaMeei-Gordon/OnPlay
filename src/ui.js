/* ============================================================
 * ui.js — DOM 介面：HUD / 分頁 / 英雄養成 / 背包 / 開箱 / 商店 /
 *          寵物 / 訓練 / 天賦 / 轉生 / 任務 / 設定 / modal / toast
 * 全域命名空間：window.Game.UI
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});
  const D = () => Game.Data;
  const Sy = () => Game.Systems;
  const St = () => Game.State;
  const $ = (id) => document.getElementById(id);

  let current = "heroes";
  let heroDetail = null; // 選中的英雄 id
  let bagFilter = "all"; // 背包部位篩選

  const TABS = [
    { id: "heroes", label: "英雄", icon: "person" },
    { id: "bag", label: "背包", icon: "bag" },
    { id: "gacha", label: "開箱", icon: "box" },
    { id: "shop", label: "商店", icon: "cart" },
    { id: "pets", label: "寵物", icon: "paw" },
    { id: "training", label: "訓練", icon: "dumbbell" },
    { id: "talents", label: "天賦", icon: "star" },
    { id: "prestige", label: "轉生", icon: "soul" },
    { id: "quests", label: "任務", icon: "scroll" },
    { id: "settings", label: "設定", icon: "gear" },
  ];

  // 圖示輔助（全部自製像素圖示，不用 emoji）
  function ico(name, px) { return Game.Icons.html(name, px || 16); }
  function curIco(cur) { return ico(cur === "gold" ? "coin" : cur === "gems" ? "gem" : "soul", 14); }
  function heroPortrait(id, px) {
    const def = D().HERO_BY_ID[id];
    return Game.Icons.spriteHtml(Game.Sprites.heroes[def.sprite], px || 30);
  }
  function petPortrait(p, px) { return Game.Icons.spriteHtml(Game.Sprites.pets[p.sprite], px || 30); }
  function stars(rarity) {
    const n = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[rarity] || 1;
    let h = "";
    for (let i = 0; i < n; i++) h += Game.Icons.html("star", 8);
    return h;
  }

  function fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return "" + n;
    if (n < 1e6) return (n / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
    if (n < 1e9) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (n < 1e12) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (n < 1e15) return (n / 1e12).toFixed(2).replace(/\.?0+$/, "") + "T";
    return n.toExponential(2).replace("e+", "e");
  }
  function rarColor(id) { return D().RARITY_BY_ID[id].color; }
  function rarName(id) { return D().RARITY_BY_ID[id].name; }

  function itemStatText(it) {
    const sl = D().SLOT_BY_ID[it.slot];
    const v = D().itemStatValue(it.slot, it.rarity, it.tier, it.enhance, it.stars);
    const statName = { atk: "攻擊", maxHp: "生命", def: "防禦", critDmg: "暴傷", dodge: "閃避" }[sl.stat];
    const val = sl.stat === "critDmg" ? "+" + Math.round(v * 100) + "%" : "+" + Math.round(v);
    return statName + " " + val;
  }
  function itemName(it) {
    const sl = D().SLOT_BY_ID[it.slot];
    return rarName(it.rarity) + sl.name + (it.stars ? " " + it.stars + "★" : "") + (it.enhance ? " +" + it.enhance : "");
  }

  // ============ 初始化 ============
  function init() {
    // 分頁列
    const tabBar = $("tab-bar");
    tabBar.innerHTML = TABS.map(
      (t) => `<button class="tab-btn" data-tab="${t.id}"><span class="ti">${ico(t.icon, 20)}</span><span class="tl">${t.label}</span></button>`
    ).join("");
    // HUD 貨幣圖示
    const setIco = (id, name) => { const el = $(id); if (el) el.innerHTML = ico(name, 14); };
    setIco("ic-gold", "coin"); setIco("ic-gem", "gem"); setIco("ic-soul", "soul"); setIco("ic-power", "sword");
    tabBar.addEventListener("click", (e) => {
      const b = e.target.closest(".tab-btn");
      if (!b) return;
      openTab(b.dataset.tab);
    });

    // 面板事件委派
    $("panel-content").addEventListener("click", onPanelClick);
    // modal 內按鈕也用同一套委派（裝備選擇/卸下等）
    $("modal-content").addEventListener("click", onPanelClick);
    // modal 點背景關閉
    $("modal-layer").addEventListener("click", (e) => {
      if (e.target.id === "modal-layer") closeModal();
    });
    // HUD 加速鈕
    $("speed-btn").addEventListener("click", () => {
      const s = St().speed || 1;
      St().speed = s === 1 ? 2 : s === 2 ? 4 : 1;
    });
    $("offline-close") && $("offline-close").addEventListener("click", () => $("offline-modal").classList.add("hidden"));

    openTab("heroes");
  }

  function openTab(id) {
    current = id;
    if (id !== "heroes") heroDetail = null;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    renderPanel(false);
  }

  // ============ HUD 同步（節流到 ~10/秒，避免每幀 DOM churn）============
  let hudT = 0, lastSpeed = -1;
  function sync(dt) {
    hudT -= dt || 0.033;
    if (hudT > 0) return;
    hudT = 0.1;
    const s = St();
    $("stage-val").textContent = s.stage;
    $("region-val").textContent = D().getTheme(s.stage).name;
    $("gold-val").textContent = fmt(s.gold);
    $("gem-val").textContent = fmt(s.gems);
    $("soul-val").textContent = fmt(s.souls);
    $("power-val").textContent = fmt(Sy().teamPower());
    if (s.speed !== lastSpeed) {
      $("speed-btn").innerHTML = ico("bolt", 12) + " " + (s.speed || 1) + "×";
      lastSpeed = s.speed;
    }
  }

  // 每秒刷新「可負擔」狀態（不重建 DOM，避免捲動跳動）
  let affT = 0;
  function tickAfford(dt) {
    affT -= dt;
    if (affT > 0) return;
    affT = 0.4;
    document.querySelectorAll("#panel-content [data-cost]").forEach((el) => {
      const cur = el.getAttribute("data-cur");
      const cost = parseFloat(el.getAttribute("data-cost"));
      const have = St()[cur] || 0;
      el.disabled = have < cost;
    });
  }

  // ============ 面板渲染 ============
  // keep=true：保留目前捲動位置（操作後留在原地）；false：回到頂端（切分頁/換頁面）
  function renderPanel(keep) {
    const el = $("panel-content");
    const prev = el.scrollTop;
    let html = "";
    if (current === "heroes") html = heroDetail ? renderHeroDetail(heroDetail) : renderHeroList();
    else if (current === "bag") html = renderBag();
    else if (current === "gacha") html = renderGacha();
    else if (current === "shop") html = renderShop();
    else if (current === "pets") html = renderPets();
    else if (current === "training") html = renderTraining();
    else if (current === "talents") html = renderTalents();
    else if (current === "prestige") html = renderPrestige();
    else if (current === "quests") html = renderQuests();
    else if (current === "settings") html = renderSettings();
    el.innerHTML = html;
    el.scrollTop = keep ? prev : 0;
  }
  function refresh() { renderPanel(true); }

  function buyBtn(act, data, cur, cost, label) {
    const dis = (St()[cur] || 0) < cost ? "disabled" : "";
    const dataAttr = Object.keys(data).map((k) => `data-${k}="${data[k]}"`).join(" ");
    return `<button class="buy-btn" data-act="${act}" ${dataAttr} data-cur="${cur}" data-cost="${cost}" ${dis}>
      <span class="cost">${curIco(cur)}${fmt(cost)}</span><span class="lbl">${label}</span></button>`;
  }

  // ---- 英雄列表 ----
  function renderHeroList() {
    const s = St();
    // 出戰隊伍展示列
    let pb = "";
    s.party.forEach((id) => {
      pb += `<div class="pb-slot" style="--rc:${rarColor(D().HERO_BY_ID[id].rarity)}">${heroPortrait(id, 30)}<span class="pb-lv">Lv.${s.heroes[id].level}</span></div>`;
    });
    for (let i = s.party.length; i < D().PARTY_MAX; i++) pb += `<div class="pb-slot empty">+</div>`;
    let html = `<div class="party-bar">${pb}</div>`;
    html += `<div class="sec-title">英雄圖鑑</div><div class="hero-grid">`;
    D().HEROES.forEach((h) => {
      const o = s.heroes[h.id] && s.heroes[h.id].owned;
      const inParty = s.party.indexOf(h.id) >= 0;
      const lvl = o ? s.heroes[h.id].level : 0;
      const pw = o ? Sy().heroPower(h.id) : 0;
      html += `<div class="hero-card ${o ? "" : "locked"} ${inParty ? "inparty" : ""}" data-act="${o ? "hero-open" : ""}" data-id="${h.id}">
        <div class="hc-frame" style="--rc:${rarColor(h.rarity)}">
          <div class="hc-portrait">${heroPortrait(h.id, 44)}</div>
          <div class="hc-stars">${stars(h.rarity)}</div>
        </div>
        <div class="hc-name" style="color:${rarColor(h.rarity)}">${h.name}</div>
        <div class="hc-sub">${o ? "Lv." + lvl : h.cls}</div>
        <div class="hc-pow">${o ? ico("sword", 11) + fmt(pw) : "未擁有"}</div>
      </div>`;
    });
    html += `</div>`;
    return html;
  }

  // ---- 英雄詳情（升級 / 裝備 / 技能 / 出戰）----
  function renderHeroDetail(id) {
    const s = St();
    const def = D().HERO_BY_ID[id];
    const hs = s.heroes[id];
    const st = Sy().heroStats(id);
    const inParty = s.party.indexOf(id) >= 0;
    const lvlCost = D().heroLevelCost(hs.level);
    let html = `<div class="detail-head">
      <button class="back-btn" data-act="hero-back">←</button>
      <div class="dh-frame" style="--rc:${rarColor(def.rarity)}">${heroPortrait(id, 46)}</div>
      <div class="dh-meta">
        <div class="dh-name" style="color:${rarColor(def.rarity)}">${def.name}</div>
        <div class="dh-sub">${def.cls}・${rarName(def.rarity)} <span class="dh-stars">${stars(def.rarity)}</span></div>
        <div class="dh-sub">Lv.${hs.level}　${ico("sword", 11)}${fmt(st.power)}</div>
      </div>
    </div>`;

    // 屬性
    html += `<div class="stat-box">
      ${statLine("等級", "Lv." + hs.level)}
      ${statLine("戰力", ico("sword",11) + fmt(st.power))}
      ${statLine("攻擊", fmt(st.atk))}
      ${statLine("生命", fmt(st.maxHp))}
      ${statLine("防禦", fmt(st.def))}
      ${statLine("暴擊", Math.round(st.crit * 100) + "%")}
      ${statLine("暴傷", Math.round(st.critDmg * 100) + "%")}
      ${statLine("攻速", st.atkInterval.toFixed(2) + "s")}
      ${statLine("吸血", Math.round(st.lifesteal * 100) + "%")}
      ${statLine("命中", st.hit)}
      ${statLine("閃避", st.dodge)}
    </div>`;

    // 操作列
    html += `<div class="row-btns">
      <button class="act-btn ${inParty ? "on" : ""}" data-act="hero-party" data-id="${id}">${inParty ? "✓ 出戰中" : "＋ 出戰"}</button>
      ${buyBtn("hero-level", { id, n: 1 }, "gold", lvlCost, "升級")}
      <button class="act-btn" data-act="hero-level10" data-id="${id}">升級×10</button>
      <button class="act-btn" data-act="hero-auto" data-id="${id}">自動裝備</button>
    </div>`;

    // 裝備欄
    html += `<div class="sec-title">裝備</div><div class="equip-grid">`;
    D().EQUIPMENT_SLOTS.forEach((sl) => {
      const uid = hs.equip[sl.id];
      const it = Sy().itemByUid(uid);
      html += `<div class="equip-slot" data-act="hero-slot" data-id="${id}" data-slot="${sl.id}" style="border-color:${it ? rarColor(it.rarity) : "#3a2f55"}">
        <div class="es-icon">${ico(it ? it.slot : sl.id, 22)}</div>
        <div class="es-info">
          <div class="es-name" style="color:${it ? rarColor(it.rarity) : "#9a90b5"}">${it ? itemName(it) : sl.name + "（空）"}</div>
          <div class="es-stat">${it ? itemStatText(it) : "點擊裝備"}</div>
        </div>
      </div>`;
    });
    html += `</div>`;

    // 套裝效果（同稀有度）
    const set = Sy().heroSetBonus(id);
    html += `<div class="sec-title">套裝效果</div>`;
    [["uncommon", "全優秀"], ["rare", "全稀有"], ["epic", "全史詩"], ["legendary", "全傳說"]].forEach(([rar, nm]) => {
      const mult = D().SET_RARITY_MULT[rar];
      const active = set && set.rarity === rar;
      html += `<div class="set-row ${active ? "on" : ""}" style="--rc:${rarColor(rar)}">
        <span class="set-dot"></span>
        <span class="set-name">${nm}套裝</span>
        <span class="set-eff">攻擊·生命·防禦 ×${Math.round(mult * 100)}%</span>
        <span class="set-tag">${active ? "啟動中" : "未啟動"}</span>
      </div>`;
    });

    // 技能
    html += `<div class="sec-title">技能</div>`;
    def.skills.forEach((sid) => {
      const sk = D().HERO_SKILLS[sid];
      const lv = hs.skills[sid] || 0;
      const max = lv >= sk.maxLevel;
      const cost = sk.cost(lv);
      html += `<div class="item">
        <div class="item-icon">${ico(sk.icon, 24)}</div>
        <div class="item-main">
          <div class="item-name">${sk.name} <span class="tag">${sk.type === "passive" ? "被動" : "主動"}</span> <span class="lvl">${lv ? "Lv." + lv : "未習得"}</span></div>
          <div class="item-bonus">${sk.effectText(max ? lv : lv + 1)}</div>
        </div>
        ${max ? `<button class="buy-btn" disabled><span class="lbl">已滿級</span></button>`
          : buyBtn("hero-skill", { id, skill: sid }, "gold", cost, lv ? "升級" : "習得")}
      </div>`;
    });
    return html;
  }
  function statLine(k, v) { return `<div class="sl"><span>${k}</span><b>${v}</b></div>`; }

  // ---- 背包（格子收納）----
  function renderBag() {
    const s = St();
    let html = `<div class="sec-title">背包　${s.inventory.length} 件</div>`;
    // 整理工具
    html += `<div class="row-btns">
      <button class="act-btn" data-act="auto-equip-party">全隊裝最強</button>
      <button class="act-btn" data-act="salvage-weak">智慧清理（分解比身上差的）</button>
    </div>`;
    html += `<div class="row-btns">
      <button class="mini-btn" data-act="salvage-below" data-rarity="uncommon">分解普通</button>
      <button class="mini-btn" data-act="salvage-below" data-rarity="rare">分解稀有以下</button>
      <button class="mini-btn" data-act="salvage-below" data-rarity="epic">分解史詩以下</button>
    </div>`;
    // 部位篩選
    html += `<div class="filter-chips"><button class="chip ${bagFilter === "all" ? "on" : ""}" data-act="bag-filter" data-f="all">全部</button>`;
    D().EQUIPMENT_SLOTS.forEach((sl) => {
      html += `<button class="chip ${bagFilter === sl.id ? "on" : ""}" data-act="bag-filter" data-f="${sl.id}">${ico(sl.id, 14)}</button>`;
    });
    html += `</div>`;
    if (!s.inventory.length) return html + `<div class="empty">背包是空的，去「開箱」或「商店」取得裝備吧！</div>`;
    let items = s.inventory.slice();
    if (bagFilter !== "all") items = items.filter((it) => it.slot === bagFilter);
    items.sort((a, b) =>
      D().RARITIES.findIndex((r) => r.id === b.rarity) - D().RARITIES.findIndex((r) => r.id === a.rarity)
      || D().itemStatValue(b.slot, b.rarity, b.tier, b.enhance, b.stars) - D().itemStatValue(a.slot, a.rarity, a.tier, a.enhance, a.stars)
    );
    html += `<div class="bag-cells">`;
    items.forEach((it) => {
      const equipped = Sy().isEquipped(it.uid);
      html += `<div class="bag-cell" data-act="bag-open" data-uid="${it.uid}" style="--rc:${rarColor(it.rarity)}">
        ${ico(it.slot, 26)}
        ${it.stars ? `<span class="bc-star">${it.stars}★</span>` : ""}
        ${it.enhance ? `<span class="bc-badge">+${it.enhance}</span>` : ""}
        ${equipped ? `<span class="bc-eq"></span>` : ""}
      </div>`;
    });
    return html + `</div>`;
  }

  function openItemModal(uid) {
    const it = Sy().itemByUid(uid);
    if (!it) return;
    const equipped = Sy().isEquipped(uid);
    const eCost = D().enhanceCost(it);
    const star = it.stars || 0, d = D();
    let html = `<div class="modal-title" style="color:${rarColor(it.rarity)}">${itemName(it)}</div>
      <div class="item-modal">
        <div class="im-frame" style="--rc:${rarColor(it.rarity)}">${ico(it.slot, 40)}</div>
        <div class="im-info">
          <div>${rarName(it.rarity)}・${D().SLOT_BY_ID[it.slot].name}</div>
          <div class="im-stat">${itemStatText(it)}</div>
          <div class="im-sub">階級 ${it.tier}　強化 +${it.enhance}　星 ${star}★/${d.STAR_MAX}</div>
          ${equipped ? `<div class="badge">裝備中</div>` : ""}
        </div>
      </div>`;
    // 升星
    html += `<div class="sec-title">升星</div>`;
    if (star >= d.STAR_MAX) {
      html += "";
    } else {
      const tier = d.scrollTierFor(star), rule = d.STAR_RULES[star], own = St().scrolls[tier] || 0;
      html += `<div class="star-info">
        <div>需要 <b>${tier}星卷</b>（持有 ${own}）　成功率 <b style="color:${rule.s >= 0.85 ? "#5ec46b" : rule.s >= 0.6 ? "#ffd23f" : "#e84141"}">${Math.round(rule.s * 100)}%</b></div>
        <div>失敗時消失機率 <b style="color:${rule.d ? "#e84141" : "#5ec46b"}">${Math.round(rule.d * 100)}%</b></div>
      </div>
      <button class="primary-btn ${own < 1 ? "dim" : ""}" ${own < 1 ? "disabled" : ""} onclick="Game.UI._itemStar(${uid})">升星（用 ${tier}星卷）</button>`;
    }
    if (it.rarity === "legendary" && star >= d.STAR_MAX) {
      html += `<button class="primary-btn" style="background:linear-gradient(#ff5a64,#c01f2c);box-shadow:0 3px 0 #7a141c;color:#fff" onclick="Game.UI._itemMythic(${uid})">升級為神話（星歸零）</button>`;
    }
    html += `<div class="scroll-bag">卷軸：${[1, 2, 3, 4, 5].map((t) => `${t}★×${St().scrolls[t] || 0}`).join("　")}</div>`;
    // 強化 / 分解 / 關閉
    html += `<div class="row-btns" style="margin-top:8px">
        <button class="buy-btn" ${St().gold < eCost ? "disabled" : ""} onclick="Game.UI._itemEnhance(${uid})"><span class="cost">${ico("coin", 13)}${fmt(eCost)}</span><span class="lbl">強化</span></button>
        ${equipped ? "" : `<button class="mini-btn danger" onclick="Game.UI._itemSalvage(${uid})">分解 ${ico("coin", 12)}${fmt(D().salvageValue(it))}</button>`}
        <button class="act-btn" onclick="Game.UI._close()">關閉</button>
      </div>`;
    openModal(html);
  }

  // ---- 開箱 ----
  function renderGacha() {
    let html = `<div class="sec-title">開箱抽裝備</div>`;
    ["gold", "gem"].forEach((bt) => {
      const box = D().GACHA[bt];
      html += `<div class="gacha-card">
        <div class="gc-icon">${ico(box.icon, 32)}</div>
        <div class="gc-info"><div class="gc-name">${box.name}</div>
        </div>
        <div class="gc-btns">
          ${buyBtn("gacha-open", { box: bt, count: 1 }, box.cur, box.cost, "開 1 次")}
          ${buyBtn("gacha-open", { box: bt, count: 10 }, box.cur, box.cost * 10, "開 10 次")}
          ${bt === "gold" ? buyBtn("gacha-open", { box: bt, count: 100 }, box.cur, box.cost * 100, "開 100 次") : ""}
        </div>
      </div>`;
    });
    return html;
  }

  // ---- 商店 ----
  function renderShop() {
    let html = `<div class="sec-title">商店</div>`;
    const groups = [
      { t: "寶箱", f: (s) => s.give.box },
      { t: "招募英雄", f: (s) => s.give.hero },
      { t: "寵物", f: (s) => s.give.pet },
      { t: "每日特惠", f: (s) => s.daily },
    ];
    groups.forEach((grp) => {
      const list = D().SHOP.filter(grp.f);
      if (!list.length) return;
      html += `<div class="shop-group">${grp.t}</div>`;
      list.forEach((s) => {
        const stt = Sy().shopState(s.id);
        const label = s.cost === 0 ? "免費" : curIco(s.cur) + fmt(s.cost);
        const dis = stt.soldOut ? "disabled" : (St()[s.cur] < s.cost ? "disabled" : "");
        const shopIco = s.give.hero ? heroPortrait(s.give.hero, 26) : s.give.pet ? petPortrait(D().PET_BY_ID[s.give.pet], 26) : ico(s.icon, 26);
        html += `<div class="shop-item">
          <div class="si-icon">${shopIco}</div>
          <div class="si-main"><div class="si-name">${s.name}</div>
          <div class="si-sub">${stt.remain != null ? "今日剩 " + stt.remain : s.once ? (stt.soldOut ? "已擁有" : "限購 1") : ""}</div></div>
          <button class="buy-btn" data-act="shop-buy" data-id="${s.id}" data-cur="${s.cur}" data-cost="${s.cost}" ${dis}>
            <span class="cost">${stt.soldOut ? "已售完" : label}</span></button>
        </div>`;
      });
    });
    // 升星卷軸
    html += `<div class="shop-group">升星卷軸</div>`;
    [1, 2, 3, 4, 5].forEach((t) => {
      const cost = D().SCROLL_COST[t], own = St().scrolls[t] || 0;
      html += `<div class="shop-item">
        <div class="si-icon">${ico("scroll", 24)}</div>
        <div class="si-main"><div class="si-name">${t} 星卷軸</div><div class="si-sub">持有 ${own}</div></div>
        <button class="buy-btn" data-act="buy-scroll" data-tier="${t}" data-cur="gold" data-cost="${cost}" ${St().gold < cost ? "disabled" : ""}>
          <span class="cost">${curIco("gold")}${fmt(cost)}</span></button>
      </div>`;
    });
    return html;
  }

  // ---- 寵物 ----
  function renderPets() {
    const s = St();
    let html = `<div class="sec-title">寵物</div><div class="pet-grid">`;
    D().PETS.forEach((p) => {
      const owned = !!s.pets[p.id];
      const lv = owned ? s.pets[p.id].level : 0;
      const active = s.activePet === p.id;
      const eff = Math.round(p.per * (lv || 1) * 100);
      const cost = D().petUpgradeCost(lv);
      const modName = { goldMul: "金幣", atkMul: "攻擊", xpMul: "經驗", hpMul: "生命" }[p.mod];
      html += `<div class="pet-card ${owned ? "" : "locked"} ${active ? "active" : ""}" style="border-color:${rarColor(p.rarity)}">
        <div class="pc-icon">${petPortrait(p, 34)}</div>
        <div class="pc-name" style="color:${rarColor(p.rarity)}">${p.name}</div>
        <div class="pc-eff">${owned ? modName + " +" + eff + "%" : "未擁有"}</div>
        ${owned ? `<div class="pc-btns">
          <button class="mini-btn ${active ? "on" : ""}" data-act="pet-active" data-id="${p.id}">${active ? "出戰中" : "出戰"}</button>
          ${buyBtn("pet-up", { id: p.id }, "gold", cost, "升級")}
        </div>` : `<div class="pc-eff small">商店取得</div>`}
      </div>`;
    });
    return html + `</div>`;
  }

  // ---- 訓練 ----
  function renderTraining() {
    let html = `<div class="sec-title">屬性訓練</div>`;
    const pct = (v) => { const n = v * 100; return n < 10 && n > 0 ? n.toFixed(1) : Math.round(n); };
    D().TRAININGS.forEach((t) => {
      const lv = St().trainings[t.id] || 0;
      const cost = Sy().trainingCost(t);
      const cur = t.rating ? Math.round(t.per * lv) : pct(t.per * lv);
      const nxt = t.rating ? Math.round(t.per * (lv + 1)) : pct(t.per * (lv + 1));
      html += `<div class="item">
        <div class="item-icon">${ico(t.icon, 24)}</div>
        <div class="item-main"><div class="item-name">${t.name} <span class="lvl">Lv.${lv}</span></div>
        <div class="item-bonus">+${cur}${t.unit} → +${nxt}${t.unit}</div></div>
        ${buyBtn("train-buy", { id: t.id }, "gold", cost, "訓練")}
      </div>`;
    });
    return html;
  }

  // ---- 天賦 ----
  function renderTalents() {
    let html = `<div class="sec-title">才能天賦　可用點數：<b style="color:#ffd23f">${St().talentPoints}</b></div>
      <div class="talent-grid">`;
    D().TALENTS.forEach((t) => {
      const lv = St().talents[t.id] || 0;
      const max = lv >= t.max;
      const scale = t.mod === "critAdd" || t.mod === "critDmgAdd" ? 100 : 100;
      const cur = Math.round(t.per * lv * (t.mod.endsWith("Add") ? 100 : 100));
      const dis = max || St().talentPoints <= 0 ? "disabled" : "";
      html += `<div class="talent-card">
        <div class="tc-icon">${ico(t.icon, 26)}</div>
        <div class="tc-name">${t.name}</div>
        <div class="tc-eff">${t.desc} +${cur}%</div>
        <div class="tc-lvl">Lv.${lv}/${t.max}</div>
        <button class="mini-btn" data-act="talent-buy" data-id="${t.id}" ${dis}>${max ? "滿級" : "點 1 點"}</button>
      </div>`;
    });
    return html + `</div>`;
  }

  // ---- 轉生 ----
  function renderPrestige() {
    const s = St();
    const can = Sy().canPrestige();
    const gain = Sy().prestigeGain();
    let html = `<div class="sec-title">轉生 / 突破</div>
      <div class="prestige-top">
        <div>本輪最高層：<b>${s.runBestStage}</b>　（需達 ${D().PRESTIGE.minStage} 層）</div>
        <div>轉生可得靈魂 ${ico("soul", 13)} <b style="color:#b06ae0">${gain}</b>　已轉生 ${s.prestige.count} 次</div>
        <button class="primary-btn ${can ? "" : "dim"}" data-act="prestige-go" ${can ? "" : "disabled"}>${can ? "轉生（+" + gain + "）" : "尚未達標"}</button>
      </div>
      <div class="sec-title">轉生天賦（用靈魂）　持有 ${ico("soul", 13)} ${fmt(s.souls)}</div>`;
    D().PRESTIGE.nodes.forEach((n) => {
      const lv = s.prestige.nodes[n.id] || 0;
      const max = lv >= n.max;
      const cost = Sy().prestigeNodeCost(n);
      const cur = Math.round(n.per * lv * 100);
      const dis = max || s.souls < cost ? "disabled" : "";
      html += `<div class="item">
        <div class="item-icon">${ico(n.icon, 24)}</div>
        <div class="item-main"><div class="item-name">${n.name} <span class="lvl">Lv.${lv}/${n.max}</span></div>
        <div class="item-bonus">+${cur}%（每級 +${Math.round(n.per * 100)}%）</div></div>
        <button class="buy-btn" data-act="prestige-node" data-id="${n.id}" ${dis}><span class="cost">${ico("soul", 12)}${cost}</span><span class="lbl">${max ? "滿級" : "強化"}</span></button>
      </div>`;
    });
    return html;
  }

  // ---- 任務 / 成就 ----
  function renderQuests() {
    const s = St();
    Sy().refreshDaily();
    let html = `<div class="sec-title">每日</div>`;
    html += `<div class="item"><div class="item-icon">${ico("box", 24)}</div>
      <div class="item-main"><div class="item-name">每日登入獎勵</div><div class="item-bonus">${ico("gem", 13)} 20</div></div>
      <button class="mini-btn" data-act="daily-login" ${s.daily.login ? "disabled" : ""}>${s.daily.login ? "已領取" : "領取"}</button></div>`;
    D().DAILY_QUESTS.forEach((q) => {
      const prog = Sy().dailyProgress(q);
      const done = prog >= q.goal;
      const claimed = s.daily.claimed[q.id];
      const rw = q.reward.gold ? ico("coin", 13) + fmt(q.reward.gold) : ico("gem", 13) + q.reward.gems;
      html += `<div class="item"><div class="item-icon">${ico("flag", 24)}</div>
        <div class="item-main"><div class="item-name">${q.name}</div>
        <div class="item-bonus">${Math.min(prog, q.goal)}/${q.goal}　獎勵 ${rw}</div></div>
        <button class="mini-btn" data-act="daily-claim" data-id="${q.id}" ${done && !claimed ? "" : "disabled"}>${claimed ? "已領" : done ? "領取" : "進行中"}</button></div>`;
    });
    html += `<div class="sec-title">成就</div>`;
    D().ACHIEVEMENTS.forEach((a) => {
      const prog = Sy().achProgress(a);
      const done = prog >= a.goal;
      const claimed = s.achievements[a.id];
      html += `<div class="item"><div class="item-icon">${ico(a.icon, 24)}</div>
        <div class="item-main"><div class="item-name">${a.name} ${claimed ? '<span class="badge">✓</span>' : ""}</div>
        <div class="item-bonus">${fmt(Math.min(prog, a.goal))}/${fmt(a.goal)}　獎勵 ${ico("gem", 13)}${a.reward.gems}</div></div>
        <button class="mini-btn" data-act="ach-claim" data-id="${a.id}" ${done && !claimed ? "" : "disabled"}>${claimed ? "已領" : done ? "領取" : "進行中"}</button></div>`;
    });
    return html;
  }

  // ---- 設定 ----
  function renderSettings() {
    const s = St();
    return `<div class="sec-title">設定</div>
      <div class="item"><div class="item-main"><div class="item-name">戰鬥速度</div><div class="item-bonus">目前 ${s.speed}×</div></div>
        <div class="row-btns mini">
          <button class="mini-btn ${s.speed === 1 ? "on" : ""}" data-act="set-speed" data-v="1">1×</button>
          <button class="mini-btn ${s.speed === 2 ? "on" : ""}" data-act="set-speed" data-v="2">2×</button>
          <button class="mini-btn ${s.speed === 4 ? "on" : ""}" data-act="set-speed" data-v="4">4×</button>
        </div></div>
      <div class="stat-box">
        ${statLine("最高關卡", s.bestStage)}
        ${statLine("總擊殺", fmt(s.stats.totalKills))}
        ${statLine("魔王擊殺", fmt(s.stats.bossKills))}
        ${statLine("開箱次數", fmt(s.stats.boxesOpened))}
        ${statLine("轉生次數", s.stats.prestiges)}
        ${statLine("每秒金幣", fmt(s.goldPerSec))}
      </div>
      <button class="danger-btn" data-act="reset-game">重置全部進度</button>`;
  }

  // ============ 事件處理 ============
  function onPanelClick(e) {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    if (!act) return;
    const id = t.dataset.id, slot = t.dataset.slot, uid = t.dataset.uid != null ? +t.dataset.uid : null;
    let rerender = true;

    switch (act) {
      case "hero-open": heroDetail = id; break;
      case "hero-back": heroDetail = null; break;
      case "hero-party": Sy().toggleParty(id); Game.Engine.onPartyChanged(); break;
      case "hero-level": Sy().levelUpHero(id, 1); break;
      case "hero-level10": Sy().levelUpHero(id, 10); break;
      case "hero-auto": Sy().autoEquipBest(id); break;
      case "hero-skill": Sy().upgradeSkill(id, t.dataset.skill); break;
      case "hero-slot": openEquipPicker(id, slot); rerender = false; break;
      case "equip-pick": Sy().equipItem(equipPickHero, uid); closeModal(); break;
      case "slot-unequip": Sy().unequipSlot(equipPickHero, t.dataset.slot); closeModal(); break;
      case "bag-open": openItemModal(uid); rerender = false; break;
      case "bag-enhance": Sy().enhanceItem(uid); break;
      case "bag-salvage": Sy().salvageItem(uid); break;
      case "bag-filter": bagFilter = t.dataset.f; break;
      case "salvage-below": { const r = Sy().salvageAllBelow(t.dataset.rarity); toast(`分解 ${r.count} 件，獲得金幣 ${fmt(r.gold)}`); break; }
      case "salvage-weak": { const r = Sy().salvageWeak(); toast(r.count ? `分解 ${r.count} 件多餘裝備，獲得金幣 ${fmt(r.gold)}` : "沒有可清理的多餘裝備"); break; }
      case "auto-equip-party": { St().party.forEach((h) => Sy().autoEquipBest(h)); toast("全隊已換上最強裝備"); break; }
      case "gacha-open": { const items = Sy().doGacha(t.dataset.box, +t.dataset.count); if (items) showGachaResult(items); else toast("貨幣不足"); break; }
      case "shop-buy": { const r = Sy().shopBuy(id); toast(r.ok ? "購買成功！" : r.msg); if (r.ok && r.result && r.result.items) showGachaResult(r.result.items); break; }
      case "buy-scroll": { if (Sy().buyScroll(+t.dataset.tier)) toast("購買 " + t.dataset.tier + " 星卷軸"); break; }
      case "pet-up": Sy().upgradePet(id); break;
      case "pet-active": Sy().setActivePet(id); break;
      case "train-buy": Sy().buyTraining(id); break;
      case "talent-buy": Sy().buyTalent(id); break;
      case "prestige-node": Sy().buyPrestigeNode(id); break;
      case "prestige-go": doPrestige(); break;
      case "daily-login": Sy().claimDailyLogin(); toast("獲得每日登入獎勵 鑽石 20"); break;
      case "daily-claim": Sy().claimDaily(id); break;
      case "ach-claim": Sy().claimAchievement(id); break;
      case "set-speed": St().speed = +t.dataset.v; break;
      case "reset-game": confirmReset(); rerender = false; break;
    }
    if (rerender) renderPanel(act !== "hero-open" && act !== "hero-back");
    sync();
  }

  function doPrestige() {
    if (!Sy().canPrestige()) return;
    const gain = Sy().doPrestige();
    Game.Engine.resetBattle();
    toast(`轉生成功！獲得 ${gain} 靈魂`);
    renderPanel();
  }

  // ============ Modal ============
  function openModal(html) {
    $("modal-content").innerHTML = html;
    $("modal-layer").classList.remove("hidden");
  }
  function closeModal() { $("modal-layer").classList.add("hidden"); }

  let equipPickHero = null;
  function openEquipPicker(heroId, slot) {
    equipPickHero = heroId;
    const items = St().inventory.filter((it) => it.slot === slot)
      .sort((a, b) => D().itemStatValue(b.slot, b.rarity, b.tier, b.enhance, b.stars) - D().itemStatValue(a.slot, a.rarity, a.tier, a.enhance, a.stars));
    const cur = St().heroes[heroId].equip[slot];
    let html = `<div class="modal-title">選擇 ${D().SLOT_BY_ID[slot].name}</div>`;
    html += `<button class="act-btn" data-act="slot-unequip" data-slot="${slot}">卸下</button>`;
    if (!items.length) html += `<div class="empty">沒有此部位的裝備</div>`;
    html += `<div class="pick-list">`;
    items.forEach((it) => {
      const eqBy = Sy().isEquipped(it.uid) && cur !== it.uid;
      html += `<div class="pick-item ${cur === it.uid ? "sel" : ""}" data-act="equip-pick" data-uid="${it.uid}" style="border-color:${rarColor(it.rarity)}">
        <span class="bi-name" style="color:${rarColor(it.rarity)}">${itemName(it)}</span>
        <span class="bi-stat">${itemStatText(it)}${eqBy ? " ·他人裝備中" : ""}</span></div>`;
    });
    html += `</div>`;
    openModal(html);
  }

  function showGachaResult(items) {
    let html = `<div class="modal-title">開箱結果 ×${items.length}</div>`;
    if (items.length > 15) {
      // 大量開箱：顯示稀有度統計（避免一次塞上百張卡）
      const by = {};
      items.forEach((it) => (by[it.rarity] = (by[it.rarity] || 0) + 1));
      let best = items[0];
      items.forEach((it) => { if (D().RARITIES.findIndex((r) => r.id === it.rarity) > D().RARITIES.findIndex((r) => r.id === best.rarity)) best = it; });
      html += `<div class="gacha-summary">`;
      D().RARITIES.slice().reverse().forEach((r) => {
        if (by[r.id]) html += `<div class="gs-row"><span style="color:${r.color}">${r.name}</span><b>×${by[r.id]}</b></div>`;
      });
      html += `</div><div class="gs-best">最佳：<span style="color:${rarColor(best.rarity)}">${itemName(best)}（${itemStatText(best)}）</span></div>`;
    } else {
      html += `<div class="gacha-result">`;
      items.forEach((it, i) => {
        html += `<div class="gr-card" style="border-color:${rarColor(it.rarity)};animation-delay:${i * 40}ms">
          <div class="gr-icon">${ico(it.slot, 22)}</div>
          <div class="gr-rar" style="color:${rarColor(it.rarity)}">${rarName(it.rarity)}</div>
          <div class="gr-name">${D().SLOT_BY_ID[it.slot].name}</div>
          <div class="gr-stat">${itemStatText(it)}</div>
        </div>`;
      });
      html += `</div>`;
    }
    html += `<button class="primary-btn" onclick="Game.UI._close()">確定</button>`;
    openModal(html);
    if (current === "bag") renderPanel(true);
  }

  function confirmReset() {
    openModal(`<div class="modal-title">重置全部進度？</div><div class="empty">此動作無法復原。</div>
      <div class="row-btns"><button class="danger-btn" onclick="Game.UI._reset()">確定重置</button>
      <button class="act-btn" onclick="Game.UI._close()">取消</button></div>`);
  }

  // Toast
  let toastT = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function showOffline(info) {
    const mins = Math.floor(info.seconds / 60), h = Math.floor(mins / 60), m = mins % 60;
    const ts = h > 0 ? h + " 小時 " + m + " 分" : m + " 分鐘";
    let gain = ico("coin", 16) + " " + fmt(info.gold);
    if (info.gems > 0) gain += "　" + ico("gem", 16) + " " + fmt(info.gems);
    $("offline-text").innerHTML = `你離開了約 <b>${ts}</b><br>隊伍持續奮戰，獲得了<br><span class='offline-gold'>${gain}</span>`;
    $("offline-modal").classList.remove("hidden");
  }

  Game.UI = {
    init, sync, tickAfford, showOffline, openTab, refresh,
    _close: closeModal,
    _reset: () => { Game.Save.reset(); location.reload(); },
    _itemEnhance: (uid) => { Sy().enhanceItem(uid); openItemModal(uid); renderPanel(true); sync(); },
    _itemSalvage: (uid) => { Sy().salvageItem(uid); closeModal(); renderPanel(true); sync(); },
    _itemStar: (uid) => {
      const r = Sy().starUp(uid);
      if (!r.ok) { toast(r.msg); return; }
      if (r.destroyed) { toast("升星失敗…裝備消失了！"); closeModal(); }
      else if (r.success) { toast("升星成功！ ★" + r.star); openItemModal(uid); }
      else { toast("升星失敗（卷軸消耗）"); openItemModal(uid); }
      renderPanel(true); sync();
    },
    _itemMythic: (uid) => { if (Sy().upgradeToMythic(uid)) { toast("升級為神話裝備！"); openItemModal(uid); renderPanel(true); sync(); } },
  };
})();
