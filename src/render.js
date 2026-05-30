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
    const filled = [];
    for (let r = 0; r < h; r++) {
      filled[r] = [];
      const line = sprite[r];
      for (let c = 0; c < w; c++) {
        const ch = c < line.length ? line[c] : ".";
        filled[r][c] = !(ch === "." || ch === " ");
      }
    }
    const px = (c) => (flip ? sx + (w - 1 - c) : sx + c);
    // 自動描邊（在輪廓外緣的空白格畫深色）→ 一線像素遊戲的清晰外框
    ctx.fillStyle = "#0d0a14";
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        if (filled[r][c]) continue;
        if ((r > 0 && filled[r - 1][c]) || (r < h - 1 && filled[r + 1][c]) ||
            (c > 0 && filled[r][c - 1]) || (c < w - 1 && filled[r][c + 1])) {
          ctx.fillRect(px(c), sy + r, 1, 1);
        }
      }
    // 填色
    for (let r = 0; r < h; r++) {
      const line = sprite[r];
      for (let c = 0; c < w; c++) {
        if (!filled[r][c]) continue;
        const color = tint || pal[line[c]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(px(c), sy + r, 1, 1);
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

  function lighten(hex, a) {
    const m = hex.replace("#", "");
    if (m.length < 6) return hex;
    let r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    r = Math.min(255, r + a); g = Math.min(255, g + a); b = Math.min(255, b + a);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function lerpColor(a, b, t) {
    a = a.replace("#", ""); b = b.replace("#", "");
    const ar = parseInt(a.slice(0, 2), 16), ag = parseInt(a.slice(2, 4), 16), ab = parseInt(a.slice(4, 6), 16);
    const br = parseInt(b.slice(0, 2), 16), bg = parseInt(b.slice(2, 4), 16), bb = parseInt(b.slice(4, 6), 16);
    return "rgb(" + Math.round(ar + (br - ar) * t) + "," + Math.round(ag + (bg - ag) * t) + "," + Math.round(ab + (bb - ab) * t) + ")";
  }

  // 平滑起伏的丘陵層（兩條正弦疊加，頂緣打亮）→ 取代生硬三角形
  function drawHills(body, topcol, amp, base, freq, scroll) {
    const v = Game.view, g = v.ground;
    for (let x = 0; x < v.w; x++) {
      const t = (x + scroll) * freq;
      const ty = Math.round(base - amp * (0.55 + 0.45 * Math.sin(t)) - amp * 0.3 * Math.sin(t * 2.7 + 1.3));
      ctx.fillStyle = body; ctx.fillRect(x, ty, 1, g - ty + 2);
      ctx.fillStyle = topcol; ctx.fillRect(x, ty, 1, 2);
    }
  }

  function drawBackground(scroll, theme) {
    const v = Game.view, g = v.ground;
    // 天空：平滑漸層（逐列內插，消除分層感）
    const sky = theme.sky, n = sky.length;
    for (let y = 0; y < g; y++) {
      const f = (y / (g - 1)) * (n - 1);
      const i = Math.min(n - 2, Math.floor(f));
      ctx.fillStyle = lerpColor(sky[i], sky[i + 1], f - i);
      ctx.fillRect(0, y, v.w, 1);
    }
    // 雲（極慢視差、淡）
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    const cl = (scroll * 0.05) % 130;
    for (let bx = -130; bx < v.w + 130; bx += 130) {
      const x = Math.round(bx - cl), cy = 12 + ((((bx / 130) % 2) + 2) % 2) * 11;
      ctx.fillRect(x, cy, 22, 4); ctx.fillRect(x + 6, cy - 3, 12, 4); ctx.fillRect(x + 3, cy + 4, 17, 3);
    }
    // 遠景丘陵（極慢、淺）→ 遠感
    drawHills(theme.horizon, lighten(theme.horizon, 24), 7, g - 13, 0.045, scroll * 0.08);
    // 中景丘陵（themed 色、較大較深）
    drawHills(theme.farColor, lighten(theme.farColor, 28), 13, g - 1, 0.07, scroll * 0.3);
    // 地面
    rect(0, g, v.w, v.h - g, theme.ground);
    rect(0, g, v.w, 1, theme.groundLine);
    for (let px = 0; px < v.w; px++) if (px % 2 === 0) rect(px, g + 1, 1, 1, theme.groundTop);
    for (let px = 0; px < v.w; px++) if (px % 2 === 1) rect(px, g + 2, 1, 1, theme.groundTop);
    // 散落地面細節（隨前進捲動，取代柵欄狀直線）
    const sp = 11, off = Math.floor(scroll) % sp;
    ctx.fillStyle = theme.tile;
    for (let x = -sp; x < v.w + sp; x += sp) {
      const rx = x - off, yy = g + 7 + ((((x / sp) % 3) + 3) % 3) * 5;
      ctx.fillRect(rx, yy, 2, 1); ctx.fillRect(rx + 5, yy + 3, 1, 1);
    }
    // 近景裝飾
    const dgap = 64, doff = scroll % dgap;
    for (let bx = -dgap; bx < v.w + dgap; bx += dgap) drawDecoUnit(theme.deco, Math.round(bx - doff), g, theme.decoColor);
  }

  function shadow(x, w) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(Math.round(x - w / 2), Game.view.ground, w, 1);
    ctx.fillRect(Math.round(x - w / 3), Game.view.ground + 1, Math.round((w * 2) / 3), 1);
  }
  function jitter(amp) { return amp > 0 ? Math.round((Math.random() * 2 - 1) * 1.6) : 0; }

  function draw() {
    if (!ctx) return;
    const v = Game.view, d = D();
    const b = Game.Engine.battle;
    const stage = Game.State ? Game.State.stage : 1;
    const theme = d.getTheme(stage);
    drawBackground(b ? b.worldScroll : 0, theme);
    if (!b) return;

    // 腳下陰影（地面層）
    if (Game.State.activePet && Game.State.pets[Game.State.activePet]) shadow(d.PARTY_X - 26, 8);
    b.field.forEach((h) => { if (!h.dead) shadow(h.x, spriteWidth(h.sprite) - 2); });
    b.enemies.forEach((e) => shadow(e.x, spriteWidth(e.sprite) - 2));

    // 敵人（後排先畫）
    const es = b.enemies.slice().sort((a, c) => c.x - a.x);
    es.forEach((e) => {
      const sp = e.sprite;
      const tint = e.hitFlash > 0 ? "#ffffff" : null;
      const ex = e.x - e.lunge + jitter(e.shake), ey = jitter(e.shake);
      drawSprite(sp, ex, v.ground + 1 + ey, !e.isBoss, tint);
      const bw = Math.max(10, spriteWidth(sp) - 2);
      drawBar(ex - bw / 2, v.ground - sp.length - (e.isBoss ? 4 : 2) + ey, bw, e.isBoss ? 3 : 2, e.hp / e.maxHp, "#e84141");
    });

    // 寵物
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
      const hx = h.x + h.lunge + jitter(h.shake), hy = jitter(h.shake);
      drawSprite(h.sprite, hx, v.ground + 1 - h.lift + hy, false, tint, bob);
      if (!h.dead && h.hp < h.maxHp) drawBar(hx - 7, v.ground - h.sprite.length - 2 - h.lift + hy, 14, 2, h.hp / h.maxHp, "#4ad94a");
    });

    // 投射物（帶尾光）
    b.projectiles.forEach((p) => {
      const x = p.x + (p.tx - p.x) * p.t, y = p.y + (p.ty - p.y) * p.t;
      ctx.globalAlpha = 0.4; ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x - (p.tx - p.x) * 0.04) - 1, Math.round(y) - 1, 3, 2);
      ctx.globalAlpha = 1; ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      ctx.fillStyle = "#fff"; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    });

    // 粒子（火花 / 金幣 / 揮砍）
    b.particles.forEach((p) => {
      const a = Math.max(0, Math.min(1, p.life / p.life0));
      ctx.globalAlpha = a;
      if (p.type === "coin") {
        ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
        ctx.fillStyle = "#fff7c8"; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 1, 1);
      } else if (p.type === "slash") {
        ctx.strokeStyle = "rgba(255,255,255," + a + ")"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x - 6, p.y + 5); ctx.lineTo(p.x + 6, p.y - 5); ctx.stroke();
      } else {
        ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    });
    ctx.globalAlpha = 1;

    // 浮動文字（暴擊放大）
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    b.floats.forEach((f) => {
      ctx.font = (f.big ? 11 : 7) + "px monospace";
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.5));
      ctx.fillStyle = "#000"; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    // 邊緣暗角
    if (ctx.createRadialGradient) {
      const vg = ctx.createRadialGradient(v.w / 2, v.ground * 0.6, v.ground * 0.3, v.w / 2, v.ground * 0.6, v.w * 0.7);
      if (vg && vg.addColorStop) {
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.28)");
        ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
      }
    }
  }

  Game.Render = { init, resize, draw };
})();
