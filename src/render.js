/* ============================================================
 * render.js — Canvas 像素渲染（4 層景深視差 + 隊伍/多敵人/寵物/特效）
 * 全域命名空間：window.Game.Render
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});
  let canvas, ctx;
  const D = () => Game.Data;

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }
  function resize() {
    const d = D();
    const rect = canvas.getBoundingClientRect();
    let worldW = Math.round((d.WORLD_H * Math.max(1, rect.width)) / Math.max(1, rect.height));
    worldW = Math.max(180, Math.min(520, worldW));
    canvas.width = worldW;
    canvas.height = d.WORLD_H;
    ctx.imageSmoothingEnabled = false;
    Game.view.w = worldW;
    Game.view.h = d.WORLD_H;
    Game.view.ground = d.WORLD_H - d.GROUND_FROM_BOTTOM;
  }

  function spriteWidth(sp) {
    let w = 0;
    for (let i = 0; i < sp.length; i++) if (sp[i].length > w) w = sp[i].length;
    return w;
  }
  function drawSprite(sprite, cx, bottomY, flip, tint, yoff) {
    const pal = D().PALETTE;
    const h = sprite.length, w = spriteWidth(sprite);
    const sx = Math.round(cx - w / 2), sy = Math.round(bottomY - h + (yoff || 0));
    for (let row = 0; row < h; row++) {
      const line = sprite[row];
      for (let col = 0; col < w; col++) {
        const ch = col < line.length ? line[col] : ".";
        if (ch === "." || ch === " ") continue;
        const color = tint || pal[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(flip ? sx + (w - 1 - col) : sx + col, sy + row, 1, 1);
      }
    }
  }
  function drawBar(x, y, w, h, ratio, color) {
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = "#1a1228"; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.round(w * ratio), h);
  }
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // ---- 遠景剪影單元（中景用）----
  function drawFarUnit(type, x, g, c1, c2) {
    switch (type) {
      case "hills": for (let k = 0; k < 22; k++) rect(x + k, g - 4 - (22 - k), 80 - 2 * k, 1, k % 2 ? c2 : c1); break;
      case "trees": for (let i = 0; i < 3; i++) { const tx = x + 8 + i * 24; rect(tx + 5, g - 16, 3, 16, "#3a2a1a"); for (let k = 0; k < 14; k++) rect(tx - k + 6, g - 30 + k, 2 * k + 1, 1, k % 3 ? c1 : c2); } break;
      case "dunes": for (let k = 0; k < 16; k++) rect(x + k * 2, g - 2 - (16 - k), 80 - 3 * k, 1, k % 2 ? c2 : c1); break;
      case "peaks": for (let k = 0; k < 28; k++) rect(x + 20 - k, g - 4 - (28 - k), 2 * k + 1, 1, c1); for (let k = 0; k < 8; k++) rect(x + 20 - k, g - 4 - 28 + k, 2 * k + 1, 1, "#ffffff"); break;
      case "volcano": for (let k = 0; k < 26; k++) rect(x + 24 - k, g - 4 - (26 - k), 2 * k + 1, 1, c1); rect(x + 18, g - 30, 12, 3, "#ff5a2a"); rect(x + 21, g - 33, 6, 4, "#ffaa3d"); break;
      case "seaweed": for (let i = 0; i < 4; i++) { const sx = x + 6 + i * 20; for (let k = 0; k < 18; k++) rect(sx + (k % 4 < 2 ? 0 : 1), g - 2 - k, 2, 1, k % 2 ? c1 : c2); } break;
      case "skycity": rect(x + 10, g - 14, 60, 14, c1); for (let k = 0; k < 8; k++) rect(x + 18 + k * 2, g - 16, 70 - 5 * k, 1, k % 2 ? c2 : c1); rect(x + 26, g - 26, 8, 12, "#cdd9e8"); rect(x + 44, g - 30, 8, 16, "#cdd9e8"); break;
      case "pillars": for (let i = 0; i < 3; i++) { const px = x + 10 + i * 24, ph = 18 + ((i * 7) % 10); rect(px, g - ph, 6, ph, c1); rect(px, g - ph, 6, 2, c2); } break;
      case "battlements": rect(x, g - 22, 80, 22, c1); for (let k = 0; k < 80; k += 10) rect(x + k, g - 28, 6, 6, c1); for (let k = 4; k < 80; k += 16) rect(x + k, g - 14, 3, 6, c2); break;
      case "abyss": rect(x, g - 20, 80, 20, c1); rect(x + 18, g - 18, 2, 18, "#ff2a3a"); rect(x + 50, g - 14, 2, 14, "#ff3a2a"); rect(x + 34, g - 8, 2, 8, "#ff5a2a"); break;
      default: for (let k = 0; k < 20; k++) rect(x + k, g - 4 - (20 - k), 80 - 2 * k, 1, c1);
    }
  }
  function drawDecoUnit(type, x, g, c) {
    switch (type) {
      case "grass": rect(x, g - 3, 1, 3, c); rect(x + 2, g - 4, 1, 4, c); rect(x + 4, g - 2, 1, 2, c); break;
      case "bush": rect(x, g - 4, 8, 4, c); rect(x + 2, g - 6, 4, 2, c); break;
      case "cactus": rect(x + 2, g - 9, 2, 9, c); rect(x, g - 6, 2, 2, c); rect(x + 4, g - 7, 2, 2, c); break;
      case "snowtree": rect(x + 3, g - 3, 2, 3, "#5a4a3a"); for (let k = 0; k < 7; k++) rect(x + 4 - k, g - 4 - k, 2 * k + 1, 1, c); rect(x + 1, g - 11, 5, 1, "#ffffff"); break;
      case "lavarock": rect(x, g - 3, 6, 3, "#2a1a18"); rect(x + 1, g - 4, 3, 1, c); break;
      case "coral": rect(x + 2, g - 6, 2, 6, c); rect(x, g - 4, 2, 2, c); rect(x + 4, g - 5, 2, 2, c); break;
      case "smallcloud": rect(x, g - 4, 10, 3, "rgba(255,255,255,0.7)"); rect(x + 3, g - 6, 5, 2, "rgba(255,255,255,0.7)"); break;
      case "rubble": rect(x, g - 2, 4, 2, c); rect(x + 5, g - 3, 3, 3, c); break;
      case "torch": rect(x + 2, g - 8, 2, 8, "#3a2a1a"); rect(x + 1, g - 11, 4, 3, "#ffcc3d"); rect(x + 2, g - 13, 2, 2, c); break;
      case "ember": rect(x + 2, g - 2, 2, 2, c); rect(x + 6, g - 3, 1, 1, "#ffaa3d"); break;
    }
  }

  function drawBackground(scroll, theme) {
    const v = Game.view, g = v.ground;
    // 1 天空（靜止）
    const bandH = Math.ceil(g / theme.sky.length);
    for (let i = 0; i < theme.sky.length; i++) rect(0, i * bandH, v.w, bandH, theme.sky[i]);
    // 2 遠景地平線剪影（極慢視差 → 遠感）
    const hoff = (scroll * 0.08) % 64;
    ctx.fillStyle = theme.horizon;
    for (let bx = -64; bx < v.w + 64; bx += 64) {
      const x = Math.round(bx - hoff);
      for (let k = 0; k < 12; k++) ctx.fillRect(x + k, g - 18 - (12 - k), 64 - 2 * k, 1);
    }
    // 3 中景剪影（中速視差）
    const moff = (scroll * 0.3) % 80;
    for (let bx = -80; bx < v.w + 80; bx += 80) drawFarUnit(theme.far, Math.round(bx - moff), g, theme.farColor, theme.farColor2);
    // 4 地面（全速）
    rect(0, g, v.w, v.h - g, theme.ground);
    rect(0, g, v.w, 3, theme.groundTop);
    rect(0, g, v.w, 1, theme.groundLine);
    const tile = 16, toff = Math.floor(scroll % tile);
    ctx.fillStyle = theme.tile;
    for (let x = -toff; x < v.w; x += tile) ctx.fillRect(x, g + 6, 1, v.h - g - 6);
    // 5 近景裝飾（全速）
    const dgap = 56, doff = scroll % dgap;
    for (let bx = -dgap; bx < v.w + dgap; bx += dgap) drawDecoUnit(theme.deco, Math.round(bx - doff), g, theme.decoColor);
    // 6 前景快速掠過（加強景深）
    const fgap = 40, foff = (scroll * 1.6) % fgap;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let bx = -fgap; bx < v.w + fgap; bx += fgap) { const x = Math.round(bx - foff); ctx.fillRect(x, v.h - 4, 6, 4); ctx.fillRect(x + 10, v.h - 3, 3, 3); }
  }

  function draw() {
    if (!ctx) return;
    const v = Game.view, d = D();
    const b = Game.Engine.battle;
    const stage = Game.State ? Game.State.stage : 1;
    const theme = d.getTheme(stage);
    drawBackground(b ? b.worldScroll : 0, theme);
    if (!b) return;

    // 敵人（後排先畫）
    const es = b.enemies.slice().sort((a, c) => c.x - a.x);
    es.forEach((e) => {
      const sp = e.sprite;
      const tint = e.hitFlash > 0 ? "#ffffff" : null;
      drawSprite(sp, e.x, v.ground + 1, !e.isBoss, tint);
      const bw = Math.max(14, spriteWidth(sp));
      drawBar(e.x - bw / 2, v.ground - sp.length - (e.isBoss ? 6 : 5), bw, e.isBoss ? 3 : 2, e.hp / e.maxHp, "#e84141");
    });

    // 寵物（跟在隊伍後）
    if (Game.State.activePet && Game.State.pets[Game.State.activePet]) {
      const pdef = d.PET_BY_ID[Game.State.activePet];
      const psp = Game.Sprites.pets[pdef.sprite];
      if (psp) drawSprite(psp, d.PARTY_X - 26, v.ground + 1, false, null);
    }

    // 隊伍英雄（後排先畫）
    const walking = b.phase === "walking";
    const heroesSorted = b.field.slice().sort((a, c) => a.x - c.x);
    heroesSorted.forEach((h, idx) => {
      const bob = walking ? (Math.floor(b.walkPhase + idx) % 2 === 0 ? 0 : -1) : 0;
      const tint = h.dead ? "#5a4a4a" : h.hitFlash > 0 ? "#ffffff" : h.rageLeft > 0 ? "#ffcaca" : null;
      drawSprite(h.sprite, h.x, v.ground + 1 - h.lift, false, tint, bob);
      if (!h.dead) drawBar(h.x - 8, v.ground - h.sprite.length - 4 - h.lift, 16, 2, h.hp / h.maxHp, "#4ad94a");
    });

    // 投射物
    b.projectiles.forEach((p) => {
      const x = p.x + (p.tx - p.x) * p.t, y = p.y + (p.ty - p.y) * p.t;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    });

    // 浮動文字
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "7px monospace";
    b.floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.85));
      ctx.fillStyle = "#000"; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  }

  Game.Render = { init, resize, draw };
})();
