/* ============================================================
 * ui.js — DOM 介面：HUD、裝備/技能/統計分頁、離線 modal
 * 全域命名空間：window.Game.UI
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});
  const D = () => Game.Data;
  const E = () => Game.Engine;

  let els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function formatNum(n) {
    n = Math.floor(n);
    if (n < 1000) return "" + n;
    if (n < 1e6) return (n / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
    if (n < 1e9) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (n < 1e12) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    return (n / 1e12).toFixed(2).replace(/\.?0+$/, "") + "T";
  }

  function init() {
    els.stage = $("stage-val");
    els.gold = $("gold-val");
    els.power = $("power-val");
    els.level = $("level-val");
    els.hpFill = $("hp-fill");
    els.hpText = $("hp-text");
    els.xpFill = $("xp-fill");
    els.xpText = $("xp-text");
    els.panelEquip = $("panel-equip");
    els.panelSkill = $("panel-skill");
    els.panelStats = $("panel-stats");

    buildEquipment();
    buildSkills();

    // 分頁切換
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => openTab(btn.dataset.tab));
    });

    // 升級事件委派
    els.panelEquip.addEventListener("click", (e) => {
      const btn = e.target.closest(".up-btn");
      if (!btn) return;
      E().upgradeEquipment(btn.dataset.slot);
    });
    els.panelSkill.addEventListener("click", (e) => {
      const btn = e.target.closest(".up-btn");
      if (!btn) return;
      E().upgradeSkill(btn.dataset.skill);
    });

    // 重置存檔
    $("reset-btn").addEventListener("click", () => {
      if (confirm("確定要重置所有進度嗎？此動作無法復原。")) {
        Game.Save.reset();
        location.reload();
      }
    });

    // 離線 modal 關閉
    $("offline-close").addEventListener("click", () => {
      $("offline-modal").classList.add("hidden");
    });

    openTab("equip");
  }

  function buildEquipment() {
    const d = D();
    let html = "";
    for (const slot of d.EQUIPMENT_ORDER) {
      const def = d.EQUIPMENT[slot];
      html +=
        '<div class="item" data-slot="' +
        slot +
        '">' +
        '<div class="item-icon">' +
        def.icon +
        "</div>" +
        '<div class="item-main">' +
        '<div class="item-name">' +
        def.name +
        ' <span class="lvl"></span></div>' +
        '<div class="item-bonus"></div>' +
        "</div>" +
        '<button class="up-btn" data-slot="' +
        slot +
        '"><span class="cost"></span><span class="up-label">強化</span></button>' +
        "</div>";
    }
    els.panelEquip.innerHTML = html;
  }

  function buildSkills() {
    const d = D();
    let html = "";
    for (const id of d.SKILL_ORDER) {
      const def = d.SKILLS[id];
      const typeLabel = def.type === "passive" ? "被動" : "主動";
      html +=
        '<div class="item" data-skill="' +
        id +
        '">' +
        '<div class="item-icon">' +
        def.icon +
        "</div>" +
        '<div class="item-main">' +
        '<div class="item-name">' +
        def.name +
        ' <span class="tag">' +
        typeLabel +
        '</span> <span class="lvl"></span></div>' +
        '<div class="item-bonus"></div>' +
        "</div>" +
        '<button class="up-btn" data-skill="' +
        id +
        '"><span class="cost"></span><span class="up-label"></span></button>' +
        "</div>";
    }
    els.panelSkill.innerHTML = html;
  }

  function openTab(name) {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
  }

  // 每幀更新（輕量）
  function sync() {
    const s = E().state;
    const d = D();
    const h = E().effectiveHero();

    els.stage.textContent = s.stage;
    els.gold.textContent = formatNum(s.gold);
    els.power.textContent = formatNum(E().heroPower());
    els.level.textContent = s.heroLevel;

    const hpRatio = h.maxHp > 0 ? s.hero.hp / h.maxHp : 0;
    els.hpFill.style.width = Math.max(0, Math.min(100, hpRatio * 100)) + "%";
    els.hpText.textContent =
      Math.max(0, Math.ceil(s.hero.hp)) + " / " + h.maxHp;

    const need = E().xpNeeded();
    els.xpFill.style.width =
      Math.max(0, Math.min(100, (s.xp / need) * 100)) + "%";
    els.xpText.textContent = "Lv." + s.heroLevel;

    // 裝備列表
    els.panelEquip.querySelectorAll(".item").forEach((row) => {
      const slot = row.dataset.slot;
      const def = d.EQUIPMENT[slot];
      const lvl = s.equipment[slot];
      const cost = def.cost(lvl);
      row.querySelector(".lvl").textContent = "Lv." + lvl;
      row.querySelector(".item-bonus").textContent =
        (lvl > 0 ? def.bonusText(lvl) + " → " : "") + def.bonusText(lvl + 1);
      const btn = row.querySelector(".up-btn");
      btn.querySelector(".cost").textContent = "💰" + formatNum(cost);
      btn.disabled = s.gold < cost;
    });

    // 技能列表
    els.panelSkill.querySelectorAll(".item").forEach((row) => {
      const id = row.dataset.skill;
      const def = d.SKILLS[id];
      const lvl = s.skills[id];
      row.querySelector(".lvl").textContent = lvl > 0 ? "Lv." + lvl : "未習得";
      const btn = row.querySelector(".up-btn");
      const label = btn.querySelector(".up-label");
      const costEl = btn.querySelector(".cost");
      if (lvl >= def.maxLevel) {
        row.querySelector(".item-bonus").textContent = def.effectText(lvl);
        costEl.textContent = "";
        label.textContent = "已滿級";
        btn.disabled = true;
      } else {
        row.querySelector(".item-bonus").textContent = def.effectText(lvl + 1);
        const cost = def.cost(lvl);
        costEl.textContent = "💰" + formatNum(cost);
        label.textContent = lvl > 0 ? "升級" : "習得";
        btn.disabled = s.gold < cost;
      }
    });

    // 統計
    if (els.panelStats.classList.contains("active")) {
      els.panelStats.innerHTML =
        statRow("最高關卡", s.bestStage) +
        statRow("總擊殺數", formatNum(s.totalKills)) +
        statRow("勇者等級", s.heroLevel) +
        statRow("戰力", formatNum(E().heroPower())) +
        statRow("攻擊力", h.atk) +
        statRow("防禦力", h.def) +
        statRow("最大生命", h.maxHp) +
        statRow("暴擊率", Math.round(h.crit * 100) + "%") +
        statRow("攻擊間隔", h.atkInterval.toFixed(2) + " 秒") +
        statRow("預估每秒金幣", formatNum(s.goldPerSec));
    }
  }

  function statRow(label, val) {
    return (
      '<div class="stat-row"><span>' +
      label +
      "</span><span>" +
      val +
      "</span></div>"
    );
  }

  function showOffline(info) {
    const mins = Math.floor(info.seconds / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    let timeStr = h > 0 ? h + " 小時 " + m + " 分" : m + " 分鐘";
    $("offline-text").innerHTML =
      "你離開了約 <b>" +
      timeStr +
      "</b><br>勇者持續奮戰，獲得了<br><span class='offline-gold'>💰 " +
      formatNum(info.gold) +
      "</span>";
    $("offline-modal").classList.remove("hidden");
  }

  Game.UI = { init, sync, showOffline, openTab };
})();
