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
  let craftSel = 1;      // 合成目標卷軸 index（1..9）
  let craftPlaced = 0;   // 五芒星已放入的卷軸數（0..5）
  let craftBatch = 1;    // 批次合成：要產出的目標卷軸張數
  let forgeUid = null;       // 鍛造坊：選中的裝備 uid
  let forgeMode = "enhance"; // 鍛造坊模式：star / enhance / reforge
  let reforgeLocks = {};     // 洗鍊：鎖定（保留）的屬性 { stat: true }
  let handbookPage = 0;      // 說明書：目前頁碼（扁平頁面清單索引）

  const TABS = [
    { id: "heroes", label: "英雄", icon: "person" },
    { id: "bag", label: "背包", icon: "bag" },
    { id: "forge", label: "鍛造坊", icon: "hammer" },
    { id: "craft", label: "合成", icon: "scroll" },
    { id: "shop", label: "商店", icon: "cart" },
    { id: "pets", label: "寵物", icon: "paw" },
    { id: "training", label: "訓練", icon: "dumbbell" },
    { id: "talents", label: "天賦", icon: "star" },
    { id: "prestige", label: "轉生", icon: "soul" },
    { id: "quests", label: "任務", icon: "scroll" },
    { id: "handbook", label: "說明書", icon: "book" },
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

  const STAT_NAMES = { atk: "攻擊", maxHp: "生命", def: "防禦", critDmg: "暴傷", dodge: "閃避", hit: "命中" };
  function statVal(stat, v) { return stat === "critDmg" ? "+" + Math.round(v * 100) + "%" : "+" + Math.round(v); }
  function itemStatText(it) {
    const sl = D().SLOT_BY_ID[it.slot];
    const v = D().itemMainStat(it);
    let txt = STAT_NAMES[sl.stat] + " " + statVal(sl.stat, v);
    // 裝備自帶副詞條
    (it.subs || []).forEach((st) => {
      txt += "　" + STAT_NAMES[st] + " " + statVal(st, D().itemSubStat(it, st));
    });
    return txt;
  }
  // 詳情視窗：主/副屬性垂直列，每行附「水準」標籤
  function itemStatRowsHtml(it) {
    const d = D(), sl = d.SLOT_BY_ID[it.slot];
    const row = (stat, val) => {
      const q = d.attrQuality(it, stat);
      return `<div class="im-row"><span class="ir-name">${STAT_NAMES[stat]}</span>`
        + `<span class="ir-val">${statVal(stat, val)}</span>`
        + `<span class="ir-q" style="color:${q.color}">${q.name}</span></div>`;
    };
    let html = row(sl.stat, d.itemMainStat(it));
    (it.subs || []).forEach((st) => { html += row(st, d.itemSubStat(it, st)); });
    return html;
  }
  function itemName(it) {
    const sl = D().SLOT_BY_ID[it.slot];
    const sdef = it.setId && D().SET_BY_ID[it.setId];
    const base = sdef ? sdef.name + sl.name : rarName(it.rarity) + sl.name;
    return base + (it.stars ? " " + it.stars + "★" : "") + (it.enhance ? " +" + it.enhance : "");
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
    // 掉落物長按 → 顯示名稱泡泡
    initDropLongPress($("panel-content"));
    // modal 點背景關閉（鎖定的彈窗除外，需按確定／✕）
    $("modal-layer").addEventListener("click", (e) => {
      if (e.target.id === "modal-layer" && !modalLocked) closeModal();
    });
    $("offline-close") && $("offline-close").addEventListener("click", () => $("offline-modal").classList.add("hidden"));
    // 戰鬥模式切換（掛機 / 推進）
    $("mode-toggle") && $("mode-toggle").addEventListener("click", () => {
      St().battleMode = St().battleMode === "idle" ? "push" : "idle";
      Game.Engine && Game.Engine.onModeChange && Game.Engine.onModeChange();
      updateModeBtn();
    });
    // 暫用：跳關 +100（直接前進 100 關並重整戰鬥）
    $("skip-btn") && $("skip-btn").addEventListener("click", () => {
      St().stage = (St().stage || 1) + 100;
      Game.Engine && Game.Engine.resetBattle && Game.Engine.resetBattle();
      const b = Game.Engine && Game.Engine.battle;
      if (b && b.flow === "march") b.marchTimer = 0.3; // 跳關後快速進入戰鬥
      sync(1); // 立即刷新 HUD
      Game.UI && Game.UI.toast && Game.UI.toast("跳關 → 第 " + St().stage + " 關");
    });

    openTab("heroes");
  }

  function openTab(id) {
    current = id;
    if (id !== "heroes") heroDetail = null;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    renderPanel(false);
    if (id === "handbook") startHbLoop(); else stopHbLoop();
  }

  // ============ HUD 同步（節流到 ~10/秒，避免每幀 DOM churn）============
  function updateModeBtn() {
    const mb = $("mode-toggle");
    if (!mb) return;
    const push = (St().battleMode || "push") === "push";
    const lbl = $("mode-label");
    if (lbl) lbl.textContent = push ? "推進" : "掛機";
    mb.classList.toggle("on", push);
    // 掛機：綠色充電條（剩餘復活倒數）由左到右填滿；推進：不顯示
    const fill = $("mode-fill");
    if (fill) {
      let pct = 0;
      const b = Game.Engine && Game.Engine.battle;
      if (!push && b) {
        const iv = D().IDLE_REVIVE_INTERVAL || 1;
        pct = Math.max(0, Math.min(1, 1 - (b.reviveTimer || 0) / iv));
      }
      fill.style.width = (pct * 100).toFixed(1) + "%";
    }
  }
  let hudT = 0;
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
    updateModeBtn();
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
    else if (current === "forge") html = renderForge();
    else if (current === "craft") html = renderCraft();
    else if (current === "shop") html = renderShop();
    else if (current === "pets") html = renderPets();
    else if (current === "training") html = renderTraining();
    else if (current === "talents") html = renderTalents();
    else if (current === "prestige") html = renderPrestige();
    else if (current === "quests") html = renderQuests();
    else if (current === "handbook") html = renderHandbook();
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

  // 陣型：點格子選要站此格的出戰英雄
  function openFormModal(lane, col) {
    const occ = Sy().formationLayout().find((sl) => sl.lane === lane && sl.col === col);
    let html = `<div class="modal-title">陣型位置</div><div class="empty" style="padding:4px 10px">選擇要站此格的出戰單位</div>`;
    html += `<div class="row-btns" style="flex-wrap:wrap;justify-content:center">`;
    St().party.forEach((id) => {
      html += `<button class="act-btn" data-act="form-set" data-kind="hero" data-id="${id}" data-lane="${lane}" data-col="${col}">${heroPortrait(id, 22)} ${D().HERO_BY_ID[id].name}</button>`;
    });
    const ap = St().activePet;
    if (ap && St().pets[ap]) html += `<button class="act-btn" data-act="form-set" data-kind="pet" data-id="${ap}" data-lane="${lane}" data-col="${col}">${petPortrait(D().PET_BY_ID[ap], 22)} ${D().PET_BY_ID[ap].name}</button>`;
    html += `</div>`;
    if (occ) html += `<div class="row-btns" style="justify-content:center;margin-top:8px"><button class="mini-btn danger" data-act="form-clear" data-kind="${occ.kind}" data-id="${occ.id}">清空此格</button></div>`;
    html += `<div class="row-btns" style="justify-content:center"><button class="act-btn" data-act="modal-close">取消</button></div>`;
    openModal(html);
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
    // 陣型（3×3：前排靠右、上中下行；含出戰寵物）
    const layout = Sy().formationLayout();
    const occ = {};
    layout.forEach((sl) => { occ[sl.lane + "," + sl.col] = sl; });
    html += `<div class="sec-title">陣型　<span style="font-size:11px;color:#9a90b5">前排靠右（先擋傷）・上中下行</span></div><div class="form-grid">`;
    for (let lane = 0; lane < 3; lane++) {
      [2, 1, 0].forEach((col) => {
        const sl = occ[lane + "," + col];
        const portrait = sl ? (sl.kind === "pet" ? petPortrait(D().PET_BY_ID[sl.id], 30) : heroPortrait(sl.id, 30)) : "<span class='fc-plus'>＋</span>";
        html += `<div class="form-cell ${sl ? "" : "empty"} ${sl && sl.kind === "pet" ? "pet" : ""}" data-act="form-cell" data-lane="${lane}" data-col="${col}">${portrait}</div>`;
      });
    }
    html += `</div>`;
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
      ${statLine("攻擊距離", D().unitRangeForHero(def.cls) + " 格")}
      ${statLine("攻速", (st.atkInterval * D().ATK_INTERVAL_MUL).toFixed(2) + "s")}
      ${statLine("移動速度", (D().MOVE_BY_CLS[def.cls] || 1).toFixed(2) + "×")}
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

    // 套裝效果（只顯示已啟動的）
    const set = Sy().heroSetBonus(id);
    if (set) {
      const nm = { uncommon: "全優秀", rare: "全稀有", epic: "全史詩", legendary: "全傳說", mythic: "全神話" }[set.rarity] || "套裝";
      html += `<div class="sec-title">套裝效果</div>`;
      html += `<div class="set-row on" style="--rc:${rarColor(set.rarity)}">
        <span class="set-dot"></span>
        <span class="set-name">${nm}套裝</span>
        <span class="set-eff">攻擊·生命·防禦 ×${Math.round(set.mult * 100)}%</span>
        <span class="set-tag">啟動中</span>
      </div>`;
    }

    // 具名套裝（只顯示已啟用的層級）
    const namedSets = Sy().heroNamedSets(id);
    if (namedSets.length) {
      html += `<div class="sec-title">具名套裝</div>`;
      namedSets.forEach((ns) => {
        html += `<div style="font-size:12px;font-weight:bold;margin:6px 0 3px;color:${ns.color}">${ns.name} <span style="color:#8a8fa0">${ns.pieces}/6</span></div>`;
        ns.stages.forEach((b) => {
          html += `<div class="set-row on" style="--rc:${ns.color}">
            <span class="set-dot"></span>
            <span class="set-name">${b.pieces} 件</span>
            <span class="set-eff">${b.text}</span>
            <span class="set-tag">啟動</span>
          </div>`;
        });
      });
    }

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
          <div class="item-bonus">${colorFx(sk.effectText(max ? lv : lv + 1))}</div>
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
      || D().itemMainStat(b) - D().itemMainStat(a)
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
    html += `</div>`;
    return html;
  }

  // ---- 鍛造坊（升星 / 強化 / 洗鍊）----
  function forgeItemGrid() {
    const items = St().inventory.slice().sort((a, b) =>
      D().RARITIES.findIndex((r) => r.id === b.rarity) - D().RARITIES.findIndex((r) => r.id === a.rarity)
      || D().itemMainStat(b) - D().itemMainStat(a));
    if (!items.length) return `<div class="empty">背包沒有裝備</div>`;
    let html = `<div class="bag-cells">`;
    items.forEach((it) => {
      const eq = Sy().isEquipped(it.uid);
      html += `<div class="bag-cell ${it.uid === forgeUid ? "sel" : ""}" data-act="forge-pick" data-uid="${it.uid}" style="--rc:${rarColor(it.rarity)}">
        ${ico(it.slot, 26)}
        ${it.stars ? `<span class="bc-star">${it.stars}★</span>` : ""}
        ${it.enhance ? `<span class="bc-badge">+${it.enhance}</span>` : ""}
        ${eq ? `<span class="bc-eq"></span>` : ""}
      </div>`;
    });
    return html + `</div>`;
  }
  // 升星區塊（鍛造坊與其他處共用）
  function starSectionHtml(it, uid) {
    const d = D(), star = it.stars || 0;
    const cap = d.RARITY_STAR_CAP[it.rarity] || d.STAR_MAX, nr = d.nextRarity(it.rarity);
    let html = `<div class="sec-title">升星　<span style="font-size:11px;color:#9a90b5">${it.rarity === "mythic" ? "神話" : rarName(it.rarity)}上限 ${cap}★</span></div>`;
    if (star < cap) {
      const rule = d.STAR_RULES[star], own = St().scrolls[star] || 0, guard = St().guardians || 0;
      const risky = rule.d > 0, on = !!St().useGuardian && guard > 0;
      html += `<div class="star-info">
        <div>需要 <b>${d.scrollTierName(star)} 星卷</b>（持有 ${own}）　成功率 <b style="color:${rule.s >= 0.85 ? "#5ec46b" : rule.s >= 0.6 ? "#ffd23f" : "#e84141"}">${Math.round(rule.s * 100)}%</b></div>
        <div>失敗時損毀機率 <b style="color:${rule.d ? "#e84141" : "#5ec46b"}">${Math.round(rule.d * 100)}%</b></div>
      </div>`;
      html += `<div class="guard-toggle ${on ? "on" : ""} ${guard <= 0 ? "dim" : ""}" ${guard <= 0 ? "" : `onclick="Game.UI._toggleGuardian(${uid})"`}>
        <span class="gt-box">${on ? "✓" : ""}</span>
        <span class="gt-label">${ico("goddess", 13)} 女神的守護保護　持有 <b style="color:${guard ? "#ffd23f" : "#9a90b5"}">${guard}</b></span>
      </div>`;
      if (guard <= 0) html += `<div class="gt-hint dim">沒有女神的守護，無法開啟（可至商店購買）</div>`;
      else if (on && !risky) html += `<div class="gt-hint">本階無損毀風險，升星不會消耗守護</div>`;
      else if (on) html += `<div class="gt-hint">升星不論成敗將消耗 1 顆守護，失敗時保護不損毀</div>`;
      html += `<button class="primary-btn ${own < 1 ? "dim" : ""}" ${own < 1 ? "disabled" : ""} onclick="Game.UI._itemStar(${uid})">升星（用 ${d.scrollTierName(star)} 星卷）</button>`;
    } else if (nr) {
      html += `<div class="star-info"><div>已達 <b>${cap}★</b> 上限，可升級為 <b style="color:${rarColor(nr)}">${rarName(nr)}</b>（星歸零、數值累加）</div></div>
      <button class="primary-btn" style="background:linear-gradient(${rarColor(nr)},#7a141c);box-shadow:0 3px 0 #5a1018;color:#fff" onclick="Game.UI._itemUpgrade(${uid})">升級為${rarName(nr)}（星歸零）</button>`;
    } else {
      html += `<div class="star-info"><div><b style="color:${rarColor(it.rarity)}">已達頂級神話滿星</b></div></div>`;
    }
    return html;
  }
  function enhanceSectionHtml(it, uid) {
    const d = D(), sl = d.SLOT_BY_ID[it.slot], eCost = d.enhanceCost(it), dis = St().gold < eCost;
    return `<div class="sec-title">強化　<span style="font-size:11px;color:#9a90b5">目前 +${it.enhance}（每級提升數值）</span></div>
      <div class="star-info"><div>主屬性 ${STAT_NAMES[sl.stat]}　<b>${statVal(sl.stat, d.itemMainStat(it))}</b></div></div>
      <button class="primary-btn ${dis ? "dim" : ""}" ${dis ? "disabled" : ""} onclick="Game.UI._itemEnhance(${uid})">強化　${ico("coin", 13)}${fmt(eCost)}</button>`;
  }
  function reforgeSectionHtml(it) {
    const d = D(), mainStat = d.SLOT_BY_ID[it.slot].stat, stats = Sy().itemAttrStats(it);
    const rows = stats.map((st) => {
      const q = d.attrQuality(it, st);
      const v = st === mainStat ? d.itemMainStat(it) : d.itemSubStat(it, st);
      const locked = !!reforgeLocks[st];
      return `<div class="reforge-row ${locked ? "on" : ""}" data-act="forge-lock" data-st="${st}">
        <span class="rf-box">${locked ? ico("lock", 13) : ""}</span>
        <span class="ir-name">${STAT_NAMES[st]}</span>
        <span class="ir-val">${statVal(st, v)}</span>
        <span class="ir-q" style="color:${q.color}">${q.name}</span></div>`;
    }).join("");
    const lockCount = stats.filter((st) => reforgeLocks[st]).length;
    const cost = 100 * Math.pow(2, lockCount);
    const hasUnlocked = stats.some((st) => !reforgeLocks[st]);
    const dis = !hasUnlocked || St().gems < cost;
    return `<div class="sec-title">洗鍊　<span style="font-size:11px;color:#9a90b5">鎖定要保留的屬性，點洗鍊重抽其餘；每鎖定一個價格翻倍</span></div>
      ${rows}
      <button class="primary-btn ${dis ? "dim" : ""}" ${dis ? "disabled" : ""} data-act="forge-reforge">洗鍊　${curIco("gems")}${cost}</button>`;
  }
  function renderForge() {
    const d = D();
    let html = `<div class="sec-title">鍛造坊</div>`;
    const modes = [["enhance", "強化"], ["star", "升星"], ["reforge", "洗鍊"]];
    html += `<div class="forge-tabs">` + modes.map(([m, l]) => `<button class="forge-tab ${forgeMode === m ? "on" : ""}" data-act="forge-mode" data-m="${m}">${l}</button>`).join("") + `</div>`;
    const it = forgeUid != null ? Sy().itemByUid(forgeUid) : null;
    if (!it) {
      forgeUid = null;
      return html + `<div class="empty">選擇下方裝備開始鍛造</div>` + forgeItemGrid();
    }
    const sdef = it.setId && d.SET_BY_ID[it.setId];
    html += `<div class="item-modal">
      <div class="im-frame" style="--rc:${rarColor(it.rarity)}">${ico(it.slot, 40)}</div>
      <div class="im-info">
        <div>${rarName(it.rarity)}・${d.SLOT_BY_ID[it.slot].name}${sdef ? `　<b style="color:${sdef.color}">${sdef.name}</b>` : ""}　<span style="font-size:11px;color:#9a90b5">${it.stars ? it.stars + "★ " : ""}${it.enhance ? "+" + it.enhance : ""}</span></div>
        ${itemStatRowsHtml(it)}
      </div></div>`;
    if (forgeMode === "star") html += starSectionHtml(it, forgeUid);
    else if (forgeMode === "reforge") html += reforgeSectionHtml(it);
    else html += enhanceSectionHtml(it, forgeUid);
    html += `<div class="sec-title">更換裝備</div>` + forgeItemGrid();
    return html;
  }

  // ---- 卷軸合成（五芒星）----
  // 目標卷軸 index = craftSel（1..9）；五個支點各放 1 張「來源卷軸」(index craftSel-1)，5 張 → 1 張目標
  function renderCraft() {
    const d = D(), sc = St().scrolls || {};
    const need = d.CRAFT_RATIO;                 // 5
    if (craftSel < 1) craftSel = 1;
    if (craftSel > d.SCROLL_TIERS - 1) craftSel = d.SCROLL_TIERS - 1;
    const srcIdx = craftSel - 1;                // 來源卷軸 index
    const have = sc[srcIdx] || 0;
    if (craftPlaced > Math.min(need, have)) craftPlaced = Math.min(need, have);
    const targetName = d.scrollTierName(craftSel);
    const srcName = d.scrollTierName(srcIdx);
    const maxBatch = Math.floor(have / need);   // 最多可批次合成的目標張數

    // 側欄：合成目標（拉動區塊，只顯示持有數）
    let side = `<div class="craft-side"><div class="cs-title">合成目標</div><div class="craft-list">`;
    for (let t = 1; t < d.SCROLL_TIERS; t++) {
      const own = sc[t] || 0;
      side += `<div class="craft-target ${t === craftSel ? "on" : ""}" data-act="craft-select" data-t="${t}">
        <span class="ct-name">${d.scrollTierName(t)}</span>
        <span class="ct-sub">持有 ${own}</span>
      </div>`;
    }
    side += `</div></div>`;

    // 五芒星：5 個支點 + 中心合成鈕（裝飾星線用 SVG）
    const pts = [[50, 8], [85, 35], [71, 80], [29, 80], [15, 35]]; // 五頂點 %（上、右上、右下、左下、左上）
    const starPoly = "50,8 71,80 15,35 85,35 29,80"; // 連線成五芒星
    let points = "";
    for (let k = 0; k < 5; k++) {
      const filled = k < craftPlaced;
      points += `<div class="penta-point ${filled ? "filled" : ""}" style="left:${pts[k][0]}%;top:${pts[k][1]}%"
        data-act="${filled ? "craft-unplace" : "craft-place"}">
        ${filled ? ico("scroll", 20) : "<span class='pp-plus'>＋</span>"}
      </div>`;
    }
    const canCraft = craftPlaced >= need;
    const center = `<div class="penta-center ${canCraft ? "" : "dim"}" data-act="${canCraft ? "craft-do" : ""}">
      <span class="pc-label">合成</span></div>`;

    let html = `<div class="craft-wrap">${side}
      <div class="craft-main">
        <div class="craft-need">需要 <b>${need}</b> 個 <b style="color:#c79bff">${srcName}</b><div class="cn-target">合成 → <b style="color:#ffd23f">${targetName}</b></div></div>
        <div class="pentagram">
          <svg viewBox="0 0 100 100" class="penta-svg" preserveAspectRatio="none"><polygon points="${starPoly}"/></svg>
          ${points}${center}
        </div>
        <div class="craft-info">已放入 <b>${craftPlaced}</b>/${need}　持有 ${srcName}：<b style="color:${have ? "#ffd23f" : "#9a90b5"}">${have}</b></div>
        <div class="craft-btns">
          <button class="mini-btn" data-act="craft-fill" ${have >= 1 ? "" : "disabled"}>自動放入</button>
          <button class="mini-btn" data-act="craft-clear" ${craftPlaced ? "" : "disabled"}>清空</button>
          <button class="mini-btn" data-act="craft-batch-open" ${maxBatch >= 1 ? "" : "disabled"}>批次合成</button>
        </div>
      </div></div>`;
    return html;
  }

  // 批次合成彈窗：選要產出幾張，顯示消耗／產出
  function craftBatchMax() { return Math.max(1, Math.floor((St().scrolls[craftSel - 1] || 0) / D().CRAFT_RATIO)); }
  function openCraftBatchModal() { craftBatch = 1; renderCraftBatchModal(); }
  function renderCraftBatchModal() {
    const d = D(), need = d.CRAFT_RATIO, srcIdx = craftSel - 1;
    const have = St().scrolls[srcIdx] || 0;
    const can = have >= need;
    const bq = Math.min(Math.max(1, craftBatch), craftBatchMax());
    const srcName = d.scrollTierName(srcIdx), targetName = d.scrollTierName(craftSel);
    openModal(`<div class="modal-title">批次合成 — ${targetName}</div>
      <div class="empty" style="padding:6px 10px">持有 ${srcName}：${have}（每 ${need} 張合成 1 張 ${targetName}）</div>
      <div class="row-btns" style="justify-content:center;align-items:center">
        <button class="mini-btn" data-act="craft-batch-add" data-v="-1">－</button>
        <span style="min-width:70px;text-align:center;font-weight:bold;font-size:18px">${fmt(bq)}</span>
        <button class="mini-btn" data-act="craft-batch-add" data-v="1">＋</button>
        <button class="mini-btn" data-act="craft-batch-add" data-v="10">+10</button>
        <button class="mini-btn" data-act="craft-batch-add" data-v="100">+100</button>
      </div>
      <div style="text-align:center;margin:8px 0 12px">消耗 <b style="color:#c79bff">${need * bq}</b> × ${srcName}　→　產出 <b style="color:#ffd23f">${bq}</b> × ${targetName}</div>
      <div class="row-btns" style="justify-content:center">
        <button class="act-btn on" data-act="craft-batch-do" ${can ? "" : "disabled"}>合成</button>
        <button class="act-btn" data-act="modal-close">取消</button>
      </div>`);
  }

  function openItemModal(uid) {
    const it = Sy().itemByUid(uid);
    if (!it) return;
    const equipped = Sy().isEquipped(uid);
    const d = D();
    let html = `<div class="modal-title" style="color:${rarColor(it.rarity)}">${itemName(it)}</div>
      <div class="item-modal">
        <div class="im-frame" style="--rc:${rarColor(it.rarity)}">${ico(it.slot, 40)}</div>
        <div class="im-info">
          <div>${rarName(it.rarity)}・${D().SLOT_BY_ID[it.slot].name}${it.setId && d.SET_BY_ID[it.setId] ? `　<b style="color:${d.SET_BY_ID[it.setId].color}">${d.SET_BY_ID[it.setId].name}</b>` : ""}</div>
          ${itemStatRowsHtml(it)}
          ${equipped ? `<div class="badge">裝備中</div>` : ""}
        </div>
      </div>`;
    // 具名套裝效果一覽
    const sdef = it.setId && d.SET_BY_ID[it.setId];
    if (sdef) {
      html += `<div class="sec-title">套裝效果</div>`;
      sdef.bonuses.forEach((b) => {
        html += `<div class="set-row" style="--rc:${sdef.color}"><span class="set-dot"></span><span class="set-name">${b.pieces} 件</span><span class="set-eff">${b.text}</span></div>`;
      });
    }
    // 鍛造：升星 / 強化 / 洗鍊 都在鍛造坊，這裡導向過去
    html += `<div class="sec-title">鍛造</div>
      <div class="row-btns">
        <button class="act-btn" onclick="Game.UI._toForge(${uid},'enhance')">強化</button>
        <button class="act-btn" onclick="Game.UI._toForge(${uid},'star')">升星</button>
        <button class="act-btn" onclick="Game.UI._toForge(${uid},'reforge')">洗鍊</button>
      </div>
      <div class="row-btns" style="margin-top:8px">
        ${equipped ? "" : `<button class="mini-btn danger" onclick="Game.UI._itemSalvage(${uid})">分解 ${ico("coin", 12)}${fmt(D().salvageValue(it))}</button>`}
        <button class="act-btn" onclick="Game.UI._close()">關閉</button>
      </div>`;
    openModal(html);
  }

  // ---- 商店 ----
  function renderShop() {
    let html = `<div class="sec-title">商店</div>`;
    // 購買普通裝備（金幣，隨進度漲價）
    const gearCost = D().commonGearCost(St().stage);
    html += `<div class="shop-group">裝備</div>`;
    D().EQUIPMENT_SLOTS.forEach((sl) => {
      const dis = St().gold < gearCost ? "disabled" : "";
      html += `<div class="shop-item">
        <div class="si-icon">${ico(sl.id, 26)}</div>
        <div class="si-main"><div class="si-name">普通${sl.name}</div>
        <div class="si-sub">${STAT_NAMES[sl.stat]}　階級 ${D().itemTierForStage(St().stage)}</div></div>
        <button class="buy-btn" data-act="buy-gear" data-slot="${sl.id}" data-cur="gold" data-cost="${gearCost}" ${dis}>
          <span class="cost">${curIco("gold")}${fmt(gearCost)}</span></button>
      </div>`;
    });
    // 卷軸 / 道具 / 每日
    const groups = [
      { t: "卷軸", f: (s) => s.give.scroll !== undefined },
      { t: "道具", f: (s) => s.give.guardian },
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
        const shopIco = ico(s.icon, 26);
        const sub = s.give.scroll !== undefined ? (s.desc + "（持有 " + (St().scrolls[s.give.scroll] || 0) + "）")
          : s.give.guardian ? (s.desc + "（持有 " + (St().guardians || 0) + "）")
          : (stt.remain != null ? "今日剩 " + stt.remain : s.once ? (stt.soldOut ? "已擁有" : "限購 1") : "");
        const buyAct = (s.give.scroll !== undefined || s.give.guardian) ? "shop-buy-qty" : "shop-buy";
        html += `<div class="shop-item">
          <div class="si-icon">${shopIco}</div>
          <div class="si-main"><div class="si-name">${s.name}</div>
          <div class="si-sub">${sub}</div></div>
          <button class="buy-btn" data-act="${buyAct}" data-id="${s.id}" data-cur="${s.cur}" data-cost="${s.cost}" ${dis}>
            <span class="cost">${stt.soldOut ? "已售完" : label}</span></button>
        </div>`;
      });
    });
    return html;
  }

  // 商店：選購買數量的彈窗（一星卷軸 / 女神的守護）
  let shopQtyId = null, shopQty = 1;
  function shopMaxAfford(s) { return Math.max(1, Math.floor((St()[s.cur] || 0) / s.cost)); }
  function openShopQtyModal(id) { shopQtyId = id; shopQty = 1; renderShopQtyModal(); }
  function renderShopQtyModal() {
    const s = D().SHOP.find((x) => x.id === shopQtyId);
    if (!s) return;
    const bulk = s.give.scroll !== undefined ? [10, 100, 1000] : [10];
    const total = s.cost * shopQty;
    const can = (St()[s.cur] || 0) >= total;
    const bulkBtns = bulk.map((b) => `<button class="mini-btn" data-act="shop-qty-add" data-v="${b}">+${b}</button>`).join("");
    openModal(`<div class="modal-title">${s.name}</div>
      <div class="empty" style="padding:6px 10px">${s.desc || ""}</div>
      <div class="row-btns" style="justify-content:center;align-items:center">
        <button class="mini-btn" data-act="shop-qty-add" data-v="-1">－</button>
        <span style="min-width:70px;text-align:center;font-weight:bold;font-size:18px">${fmt(shopQty)}</span>
        <button class="mini-btn" data-act="shop-qty-add" data-v="1">＋</button>
        ${bulkBtns}
      </div>
      <div style="text-align:center;margin:8px 0 12px">總計 <b style="color:${can ? "var(--text)" : "var(--red)"}">${curIco(s.cur)}${fmt(total)}</b></div>
      <div class="row-btns" style="justify-content:center">
        <button class="act-btn on" data-act="shop-qty-buy" ${can ? "" : "disabled"}>購買</button>
        <button class="act-btn" data-act="modal-close">取消</button>
      </div>`);
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
      <div class="stat-box">
        ${statLine("最高關卡", s.bestStage)}
        ${statLine("總擊殺", fmt(s.stats.totalKills))}
        ${statLine("魔王擊殺", fmt(s.stats.bossKills))}
        ${statLine("寶箱開啟", fmt(s.stats.boxesOpened))}
        ${statLine("轉生次數", s.stats.prestiges)}
        ${statLine("每秒金幣", fmt(s.goldPerSec))}
      </div>
      <button class="danger-btn" data-act="reset-game">重置全部進度</button>`;
  }

  // ============ 事件處理 ============
  // ============ 說明書／圖鑑 ============
  const FXNAME = { stun: "暈眩", freeze: "冰凍", burn: "燃燒", paralyze: "麻痺", weak: "虛弱", berserk: "狂暴", seal: "封印" };
  function fxDescLines(key) {
    const f = D().FX[key], L = [];
    if (f.blockSkill) L.push("無法施放技能");
    if (f.blockMove) L.push("無法移動");
    if (f.blockAct) L.push("無法攻擊");
    if (f.noDodge) L.push("無法閃避");
    if (f.dotPct) {
      const iv = f.dotInterval || 1;
      const tt = f.dotTrue ? `（<b style="color:#fff">真實傷害</b>）` : "";
      L.push("每 " + iv + " 秒損失 " + Math.round(f.dotPct * 100) + "% 最大生命" + tt);
    }
    const pm = (v, name) => L.push(name + " " + (v > 1 ? "提升" : "降低") + " " + Math.round(Math.abs(v - 1) * 100) + "%");
    if (f.outMul != null) pm(f.outMul, "攻擊力");
    if (f.inMul != null) pm(f.inMul, "受到傷害");
    if (f.atkSpeedMul != null) pm(f.atkSpeedMul, "攻擊速度");
    if (f.moveMul != null) pm(f.moveMul, "移動速度");
    if (f.defMul != null) pm(f.defMul, "防禦力");
    if (key === "freeze") L.push("可重置效果秒數");
    if (f.onExpire) L.push("結束後進入" + (FXNAME[f.onExpire] || f.onExpire));
    return L;
  }
  function renderHbIntro(sub) {
    let b = "";
    if (sub === "玩法") {
      b = `<p>這是一款<b>放置自動戰鬥</b>遊戲：你的英雄會自動前進、迎戰怪物。你的任務是組隊、養成與配裝，讓他們打得更深。</p>
        <p>右上角可切換 <b>推進</b>（一關關往前打）與 <b>掛機</b>（原地刷怪、陣亡會自動復活）。</p>
        <p>每前進一段距離會進入新的 <b>區域</b>（草原、森林、沙漠⋯），怪物與掉落也隨之改變。</p>`;
    } else if (sub === "戰鬥") {
      b = `<p>戰場分三條橫線，隊伍採 <b>3×3 陣型</b>：靠前的英雄會先碰到敵人、先承受傷害，後排則受到保護。</p>
        <p>每個角色有自己的 <b>攻擊距離</b>：近戰要貼身、弓手/法師可遠距離攻擊。單位會自動走位去找最近的敵人。</p>
        <p>技能會在冷卻好時自動施放，部分技能會附加 <b>狀態效果</b>（見「狀態效果」分頁）。</p>`;
    } else if (sub === "養成") {
      b = `<p>強化隊伍的方式：<b>升級</b>英雄、穿戴<b>裝備</b>並到<b>鍛造坊</b>強化/升星/洗鍊、湊齊<b>套裝</b>觸發套效。</p>
        <p>還有 <b>寵物</b>、<b>訓練</b>、<b>天賦</b> 提供額外加成；卡關時可考慮 <b>轉生</b> 換取永久成長。</p>
        <p>金幣 ${ico("coin", 12)}、鑽石 ${ico("gem", 12)}、靈魂 ${ico("soul", 12)} 是主要資源，用於各種養成。</p>`;
    } else {
      b = `<p>這本說明書可以像書一樣 <b>一頁頁往後翻</b>：用下方的「← 上一頁 / 往後翻 →」，或點上方分類直接跳到該章。</p>
        <p>章節順序：遊戲說明 → 狀態效果 → 怪物圖鑑 → 裝備圖鑑 → 套裝圖鑑。</p>
        <p>「狀態效果」每頁會<b>實際動態示範</b>該效果套在角色身上的樣子。</p>`;
    }
    return `<div class="sec-title">遊戲說明 · ${sub}</div><div class="hb-prose">${b}</div>`;
  }
  function renderHbStatusPage(key) {
    const f = D().FX[key];
    const lines = fxDescLines(key).map((t) => `<div class="sl"><span>${t}</span></div>`).join("");
    return `<div class="sec-title">狀態效果</div>
      <div class="hb-fx-card">
        <canvas class="fx-preview" data-effect="${key}" data-sprite="knight" width="40" height="46"></canvas>
        <div class="hb-fx-info">
          <div class="hb-fx-name" style="color:${FXCOLOR[key] || "#fff"}">${FXNAME[key] || key}</div>
          <div class="hb-fx-dur">持續 ${f.dur} 秒</div>
          <div class="stat-box">${lines}</div>
        </div>
      </div>`;
  }
  // 狀態名稱上色（粗體）
  const FXCOLOR = { freeze: "#7ad7ff", burn: "#ff5a3a", berserk: "#ff4d4d", weak: "#c46bff", stun: "#ffe45a", paralyze: "#fff04a", seal: "#ff2a3a" };
  function fxColorName(k) { return `<b style="color:${FXCOLOR[k] || "#fff"}">${FXNAME[k] || k}</b>`; }
  const FXTEXT_KEY = { "冰凍": "freeze", "燃燒": "burn", "狂暴": "berserk", "虛弱": "weak", "暈眩": "stun", "麻痺": "paralyze", "封印": "seal" };
  // 把任意文字中的狀態名稱上色粗體＋真實傷害白色粗體（英雄/敵人技能說明共用）
  function colorFx(text) {
    if (!text) return text;
    return String(text)
      .replace(/真實傷害/g, '<b style="color:#ffffff">真實傷害</b>')
      .replace(/(冰凍|燃燒|狂暴|虛弱|暈眩|麻痺|封印)/g, (m) => `<b style="color:${FXCOLOR[FXTEXT_KEY[m]]}">${m}</b>`);
  }
  // 敵人技能說明（由 ENEMY_SKILLS 欄位推導；附加狀態以顏色標示）
  function enemySkillDesc(id) {
    const s = D().ENEMY_SKILLS[id]; if (!s) return "";
    if (id === "heal") return `回復自身 ${Math.round(s.pct * 100)}% 生命`;
    if (s.aoe) return `對全體地面英雄造成 攻擊×${s.mult} 傷害`;
    if (s.blink) return `瞬移到最後排英雄旁`;
    let t = (s.range >= 2 ? "遠程" : "近戰") + "重擊（攻擊×" + s.mult + "）";
    if (s.applies) t += "，使目標" + fxColorName(s.applies);
    return t;
  }
  function renderHbMonsterPage(def) {
    const d = D();
    const spr = Game.Sprites.byKey(def.sprite);
    const theme = d.THEMES[def.region] ? d.THEMES[def.region].name : "";
    const SN = { hp: "生命", def: "防禦", atk: "攻擊", hit: "命中", dodge: "閃避", critDmg: "爆傷" };
    const cell = (label, inner) => `<div class="hb-mc"><span>${label}</span>${inner}</div>`;
    const tier = (k) => { const t = d.monsterTierLabel(def.tiers[k]); return cell(SN[k], `<b style="color:${t.color}">${t.name}</b>`); };
    const stats = tier("hp") + tier("def") + tier("atk") + tier("hit") + tier("dodge") + tier("critDmg")
      + cell("爆擊率", `<b>${Math.round((def.crit || 0) * 100)}%</b>`)
      + cell("攻擊距離", `<b>${def.range} 格</b>`)
      + cell("攻擊速度", `<b>${(def.atkInterval * d.ATK_INTERVAL_MUL).toFixed(2)}s</b>`)
      + cell("移動速度", `<b>${def.moveMul.toFixed(2)}×</b>`);
    const mname = (id) => d.MONSTER_BY_ID[id] ? d.MONSTER_BY_ID[id].name : "小怪";
    const row = (name, type, cd, desc, once, strong) => {
      const tag = `<span class="hb-tag ${type === "主動" ? "act" : "pas"}">${type}</span>`;
      const note = cd != null ? `<span class="hb-cd">冷卻 ${cd}s</span>` : (once ? `<span class="hb-cd">僅觸發一次</span>` : "");
      return `<div class="hb-skill"><b class="${strong ? "hb-sk-strong" : ""}">${name}</b>${tag}${note}<div class="hb-skill-d">${desc}</div></div>`;
    };
    const AIMTXT = { lowHp: "生命最低", far: "最遠", back: "最後排" };
    const rows = [];
    (def.skills || []).forEach((id) => { const s = d.ENEMY_SKILLS[id]; if (s) rows.push(row(s.name, "主動", s.cd, enemySkillDesc(id))); });
    if (def.onHit) rows.push(row("附帶", "被動", null, `攻擊命中附帶${fxColorName(def.onHit)}`));
    if (def.lifesteal) rows.push(row("吸血", "被動", null, `造成傷害時回復其 ${Math.round(def.lifesteal * 100)}%`));
    // 特殊＝強力技能（名稱紅字、更高規格）
    if (def.special === "split") rows.push(row("分裂", "被動", null, `死亡時分裂成 ${def.splitCount} 隻${mname(def.splitInto)}`, true, true));
    else if (def.special === "summon") rows.push(row("召喚", "主動", 9, `召喚 ${def.summonCount} 隻${mname(def.summonId)}`, false, true));
    else if (def.special === "enrage") rows.push(row("狂暴", "被動", null, `低血時進入${fxColorName("berserk")}狀態`, true, true));
    else if (def.special === "shield") rows.push(row("護盾", "主動", 7, "張開護盾，短時大幅減傷", false, true));
    while (rows.length < 4) rows.push(`<div class="hb-skill hb-skill-empty">－</div>`); // 固定 4 格、不足補空
    const skills = rows.slice(0, 4).join("");
    // 標籤：戰鬥特性。召喚＝被召喚出來的單位(child)；王必有魔王；無任何特性→普通
    const tags = [];
    if (def.fly) tags.push(`<span class="hb-mtag" style="color:#7ad7ff">飛行</span>`);
    if (def.stealth) tags.push(`<span class="hb-mtag" style="color:#9fb0c8">隱身</span>`);
    if (def.taunt) tags.push(`<span class="hb-mtag" style="color:#ff8c42">吸引</span>`);
    if (def.burrow) tags.push(`<span class="hb-mtag" style="color:#c8a06a">潛入</span>`);
    if (def.revive) tags.push(`<span class="hb-mtag" style="color:#5ec46b">復活</span>`);
    if (def.child) tags.push(`<span class="hb-mtag" style="color:#c79bff">召喚</span>`);
    if (def.kind === "boss") tags.push(`<span class="hb-mtag" style="color:#e0457a">魔王</span>`); // 王皆有魔王特性
    else if (!tags.length) tags.push(`<span class="hb-mtag" style="color:#9aa3b2">普通</span>`); // 無特性→普通
    const tags2 = tags.slice(0, 2); // 特性最多 2 顆（王＝魔王＋1）
    // 攻擊偏好（每隻都顯示）
    const prefTxt = AIMTXT[def.aim] || "最近";
    // 掉落物（2×3 共 6 格）。內容為暫時佔位：1/2/3 星卷軸（不放裝備），之後再調整。
    const dropTiers = [0, 1, 2]; // 卷軸星階 index（0=1星…）；長按顯示名稱
    const dropCells = [];
    for (let i = 0; i < 6; i++) {
      if (i < dropTiers.length) {
        const ti = dropTiers[i], nm = d.scrollTierName(ti);
        dropCells.push(`<div class="hb-drop" data-name="${nm}" title="${nm}">${Game.Icons.html("scroll", 32)}<span class="hb-drop-star">${ti + 1}</span></div>`);
      } else {
        dropCells.push(`<div class="hb-drop empty"></div>`);
      }
    }
    return `<div class="hb-mon2">
        <div class="hb-mon-left">
          <div class="hb-mon-spr">${Game.Icons.spriteHtml(spr, 52)}</div>
          <div class="hb-mon-name">${def.name}</div>
          <div class="hb-mon-sub">${theme}・${def.kind === "boss" ? "首領" : "小怪"}</div>
          ${tags2.length ? `<div class="hb-mon-tags">${tags2.join("")}</div>` : ""}
          <div class="hb-mon-pref">攻擊：<b>${prefTxt}</b></div>
        </div>
        <div class="hb-mon-grid">${stats}</div>
      </div>
      <div class="hb-mon-bottom">
        <div class="hb-mon-skills"><div class="hb-mon-cap">技能</div>${skills}</div>
        <div class="hb-mon-drops"><div class="hb-mon-cap">掉落</div><div class="hb-drop-grid">${dropCells.join("")}</div></div>
      </div>`;
  }
  function renderHbEquipPage() {
    const cells = D().EQUIPMENT_SLOTS.map((sl) =>
      `<div class="hero-card"><div class="hc-portrait">${ico(sl.id, 24)}</div><div class="hc-name">${sl.name}</div><div class="hc-sub">${STAT_NAMES[sl.stat] || sl.stat}</div></div>`).join("");
    const leg = D().RARITIES.map((r) => `<span class="hb-rar" style="color:${r.color}">${r.name}</span>`).join("　");
    return `<div class="sec-title">裝備圖鑑</div>
      <div class="hb-sub">六大部位（各有主屬性）</div><div class="hero-grid">${cells}</div>
      <div class="hb-sub">稀有度（由低到高）</div>
      <div class="hb-prose"><p>${leg}</p><p>裝備除主屬性外可附帶<b>副屬性</b>；到<b>鍛造坊</b>可強化、升星、洗鍊來提升數值。湊齊同系列可觸發<b>套裝</b>效果。</p></div>`;
  }
  function renderHbSetPage(r, theme, ids) {
    const body = ids.map((id) => {
      const s = D().SET_BY_ID[id];
      const rows = (s.bonuses || []).map((b) => `<div class="set-row"><span class="set-name">${b.pieces} 件</span><span class="set-eff">${b.text}</span></div>`).join("");
      return `<div class="hb-set"><div class="hb-set-name" style="color:${s.color}">${s.name}</div>${s.main ? `<div class="hb-sub">${s.main}</div>` : ""}${rows}</div>`;
    }).join("");
    return `<div class="sec-title">${theme.name}　套裝</div>${body}`;
  }
  function handbookPages() {
    const d = D(), pages = [], add = (section, body) => pages.push({ section, body });
    ["玩法", "戰鬥", "養成", "圖鑑導覽"].forEach((s) => add("intro", renderHbIntro(s)));
    Object.keys(d.FX).forEach((k) => add("status", renderHbStatusPage(k)));
    d.MONSTERS.slice().sort((a, b) => a.region - b.region || (a.kind === "boss" ? 1 : 0) - (b.kind === "boss" ? 1 : 0))
      .forEach((m) => add("monster", renderHbMonsterPage(m)));
    add("equip", renderHbEquipPage());
    d.THEMES.forEach((th, r) => { const ids = d.SETS_BY_REGION[r]; if (ids && ids.length) add("set", renderHbSetPage(r, th, ids)); });
    return pages;
  }
  function hbSectionFirstPage(pages, section) { const i = pages.findIndex((p) => p.section === section); return i < 0 ? 0 : i; }
  function renderHandbook() {
    const pages = handbookPages();
    handbookPage = Math.max(0, Math.min(pages.length - 1, handbookPage));
    const pg = pages[handbookPage];
    const SECTIONS = [["intro", "遊戲說明"], ["status", "狀態效果"], ["monster", "怪物圖鑑"], ["equip", "裝備圖鑑"], ["set", "套裝圖鑑"]];
    const chips = `<div class="hb-chips">` + SECTIONS.map(([k, l]) => `<button class="hb-chip ${pg.section === k ? "on" : ""}" data-act="hb-section" data-section="${k}">${l}</button>`).join("") + `</div>`;
    const nav = `<div class="hb-nav">
      <button class="hb-arrow" data-act="hb-prev" ${handbookPage <= 0 ? "disabled" : ""}>← 上一頁</button>
      <span class="hb-count">${handbookPage + 1} / ${pages.length}</span>
      <button class="hb-arrow" data-act="hb-next" ${handbookPage >= pages.length - 1 ? "disabled" : ""}>往後翻 →</button>
    </div>`;
    return `<div class="hb-root">` + chips + `<div class="hb-page">${pg.body}</div>` + nav + `</div>`;
  }
  // 狀態效果預覽動畫（只在說明書分頁時跑，離開即自我終止）
  let hbRaf = 0, hbClk = 0, hbLast = 0;
  function hbRunning() { return current === "handbook" && (typeof document === "undefined" || document.visibilityState !== "hidden"); }
  function startHbLoop() {
    if (hbRaf || typeof requestAnimationFrame === "undefined") return;
    hbLast = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const step = (now) => {
      if (!hbRunning()) { hbRaf = 0; return; }
      hbClk += Math.max(0, (now - hbLast) / 1000); hbLast = now;
      document.querySelectorAll("#panel-content canvas.fx-preview").forEach((cv) => {
        const c = cv.getContext && cv.getContext("2d"); if (!c) return;
        c.clearRect(0, 0, cv.width, cv.height);
        const sprite = Game.Sprites.heroes[cv.dataset.sprite]; if (!sprite) return;
        Game.Render.drawSpriteFx(c, sprite, cv.dataset.effect, hbClk, { cx: cv.width / 2, bottomY: cv.height - 3 });
      });
      hbRaf = requestAnimationFrame(step);
    };
    hbRaf = requestAnimationFrame(step);
  }
  function stopHbLoop() { if (hbRaf) { cancelAnimationFrame(hbRaf); hbRaf = 0; } }

  // 掉落物長按：按住 ~420ms 顯示名稱泡泡（手機/桌面通用，移動或放開即取消）
  function initDropLongPress(root) {
    if (!root) return;
    let timer = null, tip = null;
    const hide = () => { if (tip) tip.classList.add("hidden"); };
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const show = (cell, px, py) => {
      const name = cell.getAttribute("data-name"); if (!name) return;
      if (!tip) { tip = document.createElement("div"); tip.id = "drop-tip"; document.body.appendChild(tip); }
      tip.textContent = name; tip.classList.remove("hidden");
      const r = cell.getBoundingClientRect();
      tip.style.left = (px || r.left + r.width / 2) + "px";
      tip.style.top = (r.top - 6) + "px";
    };
    const start = (e) => {
      const cell = e.target.closest(".hb-drop[data-name]"); if (!cell) return;
      const pt = e.touches ? e.touches[0] : e;
      clear(); timer = setTimeout(() => { show(cell, pt.clientX); }, 420);
    };
    root.addEventListener("touchstart", start, { passive: true });
    root.addEventListener("touchend", () => { clear(); setTimeout(hide, 1200); }, { passive: true });
    root.addEventListener("touchmove", () => { clear(); hide(); }, { passive: true });
    root.addEventListener("mousedown", start);
    document.addEventListener("mouseup", () => { clear(); setTimeout(hide, 1200); });
    root.addEventListener("scroll", () => { clear(); hide(); }, { passive: true });
  }

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
      case "hb-prev": if (handbookPage > 0) handbookPage--; break;
      case "hb-next": { const n = handbookPages().length; if (handbookPage < n - 1) handbookPage++; break; }
      case "hb-section": { const ps = handbookPages(); handbookPage = hbSectionFirstPage(ps, t.dataset.section); break; }
      case "hero-party": Sy().toggleParty(id); Game.Engine.onPartyChanged(); break;
      case "form-cell": openFormModal(+t.dataset.lane, +t.dataset.col); rerender = false; break;
      case "form-set": { if (t.dataset.kind === "pet") Sy().setPetPos(id, +t.dataset.lane, +t.dataset.col); else Sy().setHeroPos(id, +t.dataset.lane, +t.dataset.col); Game.Engine.onPartyChanged(); closeModal(); break; }
      case "form-clear": { if (t.dataset.kind === "pet") Sy().clearPetPos(id); else Sy().clearHeroPos(id); Game.Engine.onPartyChanged(); closeModal(); break; }
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
      case "shop-buy": { const r = Sy().shopBuy(id); toast(r.ok ? "購買成功！" : r.msg); break; }
      case "shop-buy-qty": openShopQtyModal(id); rerender = false; break;
      case "shop-qty-add": { const s = D().SHOP.find((x) => x.id === shopQtyId); if (s) { shopQty = Math.min(shopMaxAfford(s), Math.max(1, shopQty + (+t.dataset.v))); } renderShopQtyModal(); rerender = false; break; }
      case "shop-qty-buy": { const r = Sy().shopBuy(shopQtyId, shopQty); toast(r.ok ? "購買成功 ×" + r.qty : r.msg); closeModal(); break; }
      case "modal-close": closeModal(); rerender = false; break;
      case "buy-gear": { const it = Sy().buyCommonGear(t.dataset.slot); toast(it ? "購買 普通" + D().SLOT_BY_ID[t.dataset.slot].name : "金幣不足"); break; }
      case "forge-mode": forgeMode = t.dataset.m; reforgeLocks = {}; break;
      case "forge-pick": forgeUid = uid; reforgeLocks = {}; break;
      case "forge-lock": { const st = t.dataset.st; reforgeLocks[st] = !reforgeLocks[st]; break; }
      case "forge-reforge": {
        const it = Sy().itemByUid(forgeUid);
        if (!it) { rerender = false; break; }
        const all = Sy().itemAttrStats(it);
        const unlocked = all.filter((st) => !reforgeLocks[st]);
        if (!unlocked.length) { toast("至少要保留一個未鎖定的屬性才能洗鍊"); rerender = false; break; }
        const cost = 100 * Math.pow(2, all.length - unlocked.length);
        if (!Sy().spend("gems", cost)) { toast("鑽石不足"); rerender = false; break; }
        Sy().reforgeAttrs(forgeUid, unlocked); // 保留鎖定狀態，可連抽
        // 提醒：未鎖定卻洗出 完美 / 最完美 → 彈窗，需按確定
        const hot = unlocked.filter((st) => D().attrQuality(it, st).pct >= 0.9);
        if (hot.length) openReforgeAlert(hot.map((st) => STAT_NAMES[st] + " " + D().attrQuality(it, st).name));
        else toast("洗鍊完成！");
        break;
      }
      case "craft-select": { craftSel = +t.dataset.t; craftPlaced = 0; craftBatch = 1; break; }
      case "craft-place": { const have = St().scrolls[craftSel - 1] || 0; if (craftPlaced < Math.min(D().CRAFT_RATIO, have)) craftPlaced++; else toast("沒有更多 " + D().scrollTierName(craftSel - 1)); break; }
      case "craft-unplace": { if (craftPlaced > 0) craftPlaced--; break; }
      case "craft-fill": { craftPlaced = Math.min(D().CRAFT_RATIO, St().scrolls[craftSel - 1] || 0); break; }
      case "craft-clear": { craftPlaced = 0; break; }
      case "craft-batch-open": openCraftBatchModal(); rerender = false; break;
      case "craft-batch-add": { craftBatch = Math.min(craftBatchMax(), Math.max(1, (craftBatch || 1) + (+t.dataset.v))); renderCraftBatchModal(); rerender = false; break; }
      case "craft-batch-do": { const n = Sy().craftScroll(craftSel - 1, craftBatch || 1); toast(n ? "批次合成成功！獲得 " + n + " × " + D().scrollTierName(craftSel) : D().scrollTierName(craftSel - 1) + " 不足"); craftBatch = 1; closeModal(); break; }
      case "craft-do": {
        if (craftPlaced < D().CRAFT_RATIO) { toast("需放滿 " + D().CRAFT_RATIO + " 張"); break; }
        if (Sy().craftScroll(craftSel - 1)) { toast("合成成功！獲得 1 × " + D().scrollTierName(craftSel)); craftPlaced = 0; }
        else toast(D().scrollTierName(craftSel - 1) + " 不足");
        break;
      }
      case "pet-up": Sy().upgradePet(id); break;
      case "pet-active": Sy().setActivePet(id); Game.Engine.onPartyChanged(); break;
      case "train-buy": Sy().buyTraining(id); break;
      case "talent-buy": Sy().buyTalent(id); break;
      case "prestige-node": Sy().buyPrestigeNode(id); break;
      case "prestige-go": doPrestige(); break;
      case "daily-login": Sy().claimDailyLogin(); toast("獲得每日登入獎勵 鑽石 20"); break;
      case "daily-claim": Sy().claimDaily(id); break;
      case "ach-claim": Sy().claimAchievement(id); break;
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
  let modalLocked = false; // 鎖定的彈窗：點背景不關，需按確定／✕
  function openModal(html) {
    modalLocked = false;
    $("modal-content").innerHTML = html;
    $("modal-layer").classList.remove("hidden");
  }
  function closeModal() { modalLocked = false; $("modal-layer").classList.add("hidden"); }

  let equipPickHero = null;
  function openEquipPicker(heroId, slot) {
    equipPickHero = heroId;
    const items = St().inventory.filter((it) => it.slot === slot)
      .sort((a, b) => D().itemMainStat(b) - D().itemMainStat(a));
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

  // 執行升星並結算 toast / 重繪
  function performStar(uid, useGuardian) {
    const r = Sy().starUp(uid, useGuardian);
    if (!r.ok) { toast(r.msg); return; }
    const used = r.guardUsed ? "（消耗守護 1）" : "";
    if (r.destroyed) { toast("升星失敗…裝備損毀了！"); if (forgeUid === uid) forgeUid = null; }
    else if (r.protected) toast("升星失敗…女神的守護抵銷了損毀！（消耗 1）");
    else if (r.success) toast("升星成功！ ★" + r.star + used);
    else toast("升星失敗" + (r.guardUsed ? used : "（卷軸消耗）"));
    closeModal(); renderPanel(true); sync();
  }
  // 洗鍊出現未鎖定的 完美/最完美 → 彈窗提醒，需按確定
  function openReforgeAlert(names) {
    const list = names.map((n) => `<div style="font-size:15px;font-weight:bold;color:#ffd23f;margin:2px 0">${n}</div>`).join("");
    openModal(`<button class="modal-x" onclick="Game.UI._close()">✕</button>
      <div class="modal-title" style="color:#ffd23f">${ico("star", 18)} 洗出高品質詞條！</div>
      <div class="empty" style="padding:10px">${list}
        <div style="font-size:12px;color:#9a90b5;margin-top:8px">這些詞條<b>未鎖定</b>，下次洗鍊會被重抽掉。<br>記得先「鎖定」再洗其餘屬性！</div></div>
      <div class="row-btns"><button class="primary-btn" onclick="Game.UI._close()">確定</button></div>`);
    modalLocked = true; // 點背景不關，必須按確定／✕
  }
  // 有損毀風險但未開啟守護 → 確認框
  function openGuardConfirm(uid, dchance) {
    const pct = Math.round(dchance * 100);
    const guard = St().guardians || 0;
    openModal(`<div class="modal-title">升星損毀風險</div>
      <div class="empty">本次升星失敗有 <b style="color:#e84141">${pct}%</b> 機率裝備損毀。<br>是否開啟「女神的守護」防止損毀？<br>
      <span style="font-size:11px;color:#9a90b5">開啟後無論成功或失敗都會消耗 1 顆守護（持有 ${guard}）</span></div>
      <div class="row-btns">
        <button class="primary-btn" onclick="Game.UI._starConfirm(${uid},1)">開啟並升星</button>
        <button class="act-btn" onclick="Game.UI._starConfirm(${uid},0)">直接升星</button>
        <button class="act-btn" onclick="Game.UI._close()">取消</button>
      </div>`);
  }

  Game.UI = {
    init, sync, tickAfford, showOffline, openTab, refresh, toast,
    _close: closeModal,
    _reset: () => { Game.Save.reset(); location.reload(); },
    _itemEnhance: (uid) => { Sy().enhanceItem(uid); renderPanel(true); sync(); },
    _itemSalvage: (uid) => { Sy().salvageItem(uid); if (forgeUid === uid) forgeUid = null; closeModal(); renderPanel(true); sync(); },
    _toForge: (uid, mode) => { forgeUid = uid; forgeMode = mode; reforgeLocks = {}; closeModal(); openTab("forge"); },
    _itemStar: (uid) => {
      const it = Sy().itemByUid(uid);
      if (!it) return;
      const rule = D().STAR_RULES[it.stars || 0];
      const risky = rule && rule.d > 0;
      const guard = St().guardians || 0;
      const on = !!St().useGuardian && guard > 0;
      // 有風險、未開啟、且背包有守護 → 跳確認框
      if (risky && !on && guard > 0) { openGuardConfirm(uid, rule.d); return; }
      performStar(uid, on);
    },
    _toggleGuardian: () => {
      if ((St().guardians || 0) <= 0) { toast("沒有女神的守護"); return; }
      St().useGuardian = !St().useGuardian;
      renderPanel(true);
    },
    _starConfirm: (uid, enable) => {
      let use = false;
      if (enable && (St().guardians || 0) > 0) { St().useGuardian = true; use = true; }
      performStar(uid, use);
    },
    _itemUpgrade: (uid) => {
      const it = Sy().itemByUid(uid);
      const nr = it && D().nextRarity(it.rarity);
      if (Sy().upgradeRarity(uid)) { toast("升級為" + (nr ? rarName(nr) : "更高稀有度") + "！"); renderPanel(true); sync(); }
    },
  };
})();
