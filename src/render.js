/* ============================================================
 * render.js — Canvas 像素渲染（含關卡主題背景 / 視差分層）
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

  // 依顯示比例計算內部像素 buffer 尺寸，維持固定世界高度 → 像素放大效果
  function resize() {
    const d = D();
    const rect = canvas.getBoundingClientRect();
    const dispW = Math.max(1, rect.width);
    const dispH = Math.max(1, rect.height);
    const worldH = d.WORLD_H;
    let worldW = Math.round((worldH * dispW) / dispH);
    worldW = Math.max(160, Math.min(480, worldW));
    canvas.width = worldW;
    canvas.height = worldH;
    ctx.imageSmoothingEnabled = false;
    Game.view.w = worldW;
    Game.view.h = worldH;
    Game.view.ground = worldH - d.GROUND_FROM_BOTTOM;
  }

  function drawSprite(sprite, cx, bottomY, flip, tint) {
    const pal = D().PALETTE;
    const h = sprite.length;
    const w = sprite[0].length;
    const startX = Math.round(cx - w / 2);
    const startY = Math.round(bottomY - h);
    for (let row = 0; row < h; row++) {
      const line = sprite[row];
      for (let col = 0; col < w; col++) {
        const ch = line[col];
        if (ch === "." || ch === " ") continue;
        const color = tint || pal[ch];
        if (!color) continue;
        const px = flip ? startX + (w - 1 - col) : startX + col;
        ctx.fillStyle = color;
        ctx.fillRect(px, startY + row, 1, 1);
      }
    }
  }

  function drawBar(x, y, w, h, ratio, color, bg) {
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = bg || "#1a1228";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * ratio), h);
  }

  // ---- 遠景剪影（幾乎不動：極小視差）----
  function drawFar(theme, scroll) {
    const v = Game.view;
    const g = v.ground;
    const off = (scroll * 0.06) % 80; // 幾乎不動
    const c1 = theme.farColor;
    const c2 = theme.farColor2;
    for (let bx = -80; bx < v.w + 80; bx += 80) {
      const x = Math.round(bx - off);
      drawFarUnit(theme.far, x, g, c1, c2);
    }
  }

  function rect(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  function drawFarUnit(type, x, g, c1, c2) {
    switch (type) {
      case "hills":
        for (let k = 0; k < 22; k++) rect(x + k, g - 4 - (22 - k), 80 - 2 * k, 1, k % 2 ? c2 : c1);
        break;
      case "trees":
        for (let i = 0; i < 3; i++) {
          const tx = x + 8 + i * 24;
          rect(tx + 5, g - 16, 3, 16, "#3a2a1a");
          for (let k = 0; k < 14; k++) rect(tx - k + 6, g - 30 + k, 2 * k + 1, 1, k % 3 ? c1 : c2);
        }
        break;
      case "dunes":
        for (let k = 0; k < 16; k++) rect(x + k * 2, g - 2 - (16 - k), 80 - 3 * k, 1, k % 2 ? c2 : c1);
        break;
      case "peaks":
        for (let k = 0; k < 28; k++) {
          rect(x + 20 - k, g - 4 - (28 - k), 2 * k + 1, 1, c1);
        }
        for (let k = 0; k < 8; k++) rect(x + 20 - k, g - 4 - 28 + k, 2 * k + 1, 1, "#ffffff");
        break;
      case "volcano":
        for (let k = 0; k < 26; k++) rect(x + 24 - k, g - 4 - (26 - k), 2 * k + 1, 1, c1);
        rect(x + 18, g - 30, 12, 3, "#ff5a2a");
        rect(x + 21, g - 33, 6, 4, "#ffaa3d");
        break;
      case "seaweed":
        for (let i = 0; i < 4; i++) {
          const sx = x + 6 + i * 20;
          for (let k = 0; k < 18; k++) rect(sx + (k % 4 < 2 ? 0 : 1), g - 2 - k, 2, 1, k % 2 ? c1 : c2);
        }
        rect(x + 14, g - 40, 2, 2, "rgba(255,255,255,0.5)");
        rect(x + 50, g - 30, 2, 2, "rgba(255,255,255,0.4)");
        break;
      case "skycity":
        rect(x + 10, g - 14, 60, 14, c1);
        for (let k = 0; k < 8; k++) rect(x + 18 + k * 2, g - 16, 70 - 4 * k - k, 1, k % 2 ? c2 : c1);
        rect(x + 26, g - 26, 8, 12, "#cdd9e8");
        rect(x + 44, g - 30, 8, 16, "#cdd9e8");
        break;
      case "pillars":
        for (let i = 0; i < 3; i++) {
          const px = x + 10 + i * 24;
          const ph = 18 + ((i * 7) % 10);
          rect(px, g - ph, 6, ph, c1);
          rect(px, g - ph, 6, 2, c2);
        }
        break;
      case "battlements":
        rect(x, g - 22, 80, 22, c1);
        for (let k = 0; k < 80; k += 10) rect(x + k, g - 28, 6, 6, c1);
        for (let k = 4; k < 80; k += 16) rect(x + k, g - 14, 3, 6, c2);
        break;
      case "abyss":
        rect(x, g - 20, 80, 20, c1);
        rect(x + 18, g - 18, 2, 18, "#ff2a3a");
        rect(x + 50, g - 14, 2, 14, "#ff3a2a");
        rect(x + 34, g - 8, 2, 8, "#ff5a2a");
        break;
      default:
        for (let k = 0; k < 20; k++) rect(x + k, g - 4 - (20 - k), 80 - 2 * k, 1, c1);
    }
  }

  // ---- 近景裝飾（隨地面捲動：完整視差）----
  function drawDeco(theme, scroll) {
    const v = Game.view;
    const g = v.ground;
    const gap = 56;
    const off = scroll % gap;
    const c = theme.decoColor;
    for (let bx = -gap; bx < v.w + gap; bx += gap) {
      const x = Math.round(bx - off);
      drawDecoUnit(theme.deco, x, g, c);
    }
  }

  function drawDecoUnit(type, x, g, c) {
    switch (type) {
      case "grass":
        rect(x, g - 3, 1, 3, c); rect(x + 2, g - 4, 1, 4, c); rect(x + 4, g - 2, 1, 2, c);
        break;
      case "bush":
        rect(x, g - 4, 8, 4, c); rect(x + 2, g - 6, 4, 2, c);
        break;
      case "cactus":
        rect(x + 2, g - 9, 2, 9, c); rect(x, g - 6, 2, 2, c); rect(x + 4, g - 7, 2, 2, c);
        break;
      case "snowtree":
        rect(x + 3, g - 3, 2, 3, "#5a4a3a");
        for (let k = 0; k < 7; k++) rect(x + 4 - k, g - 4 - k, 2 * k + 1, 1, c);
        rect(x + 1, g - 11, 5, 1, "#ffffff");
        break;
      case "lavarock":
        rect(x, g - 3, 6, 3, "#2a1a18"); rect(x + 1, g - 4, 3, 1, c);
        break;
      case "coral":
        rect(x + 2, g - 6, 2, 6, c); rect(x, g - 4, 2, 2, c); rect(x + 4, g - 5, 2, 2, c);
        break;
      case "smallcloud":
        rect(x, g - 4, 10, 3, "rgba(255,255,255,0.7)"); rect(x + 3, g - 6, 5, 2, "rgba(255,255,255,0.7)");
        break;
      case "rubble":
        rect(x, g - 2, 4, 2, c); rect(x + 5, g - 3, 3, 3, c);
        break;
      case "torch":
        rect(x + 2, g - 8, 2, 8, "#3a2a1a"); rect(x + 1, g - 11, 4, 3, "#ffcc3d"); rect(x + 2, g - 13, 2, 2, c);
        break;
      case "ember":
        rect(x + 2, g - 2, 2, 2, c); rect(x + 6, g - 3, 1, 1, "#ffaa3d");
        break;
    }
  }

  function drawBackground(scroll, theme) {
    const v = Game.view;
    const ground = v.ground;
    // 天空 / 背景色帶（依主題）—— 固定不動
    const sky = theme.sky;
    const bandH = Math.ceil(ground / sky.length);
    for (let i = 0; i < sky.length; i++) {
      rect(0, i * bandH, v.w, bandH, sky[i]);
    }
    // 遠景剪影（幾乎不動）
    drawFar(theme, scroll);
    // 地面
    rect(0, ground, v.w, v.h - ground, theme.ground);
    rect(0, ground, v.w, 3, theme.groundTop);
    rect(0, ground, v.w, 1, theme.groundLine);
    // 捲動地磚紋理（隨前進向左移）
    const tile = 16;
    const toff = Math.floor(scroll % tile);
    ctx.fillStyle = theme.tile;
    for (let x = -toff; x < v.w; x += tile) {
      ctx.fillRect(x, ground + 6, 1, v.h - ground - 6);
    }
    // 近景裝飾（隨前進向左移）
    drawDeco(theme, scroll);
  }

  function draw(state) {
    if (!ctx) return;
    const v = Game.view;
    const d = D();
    const theme = d.getTheme(state.stage);
    drawBackground(state.worldScroll, theme);

    // 敵人
    if (state.enemy) {
      const e = state.enemy;
      const tint = e.hitFlash > 0 ? "#ffffff" : null;
      if (e.isBoss) {
        drawSprite(d.SPRITE_BOSS, e.x, v.ground + 1, false, tint);
        drawBar(e.x - 16, v.ground - d.SPRITE_BOSS.length - 6, 32, 3, e.hp / e.maxHp, "#e84141");
      } else {
        const sp = d.ENEMY_SPRITES[e.spriteIndex] || d.ENEMY_SPRITES[0];
        drawSprite(sp, e.x, v.ground + 1, true, tint);
        drawBar(e.x - 8, v.ground - sp.length - 5, 16, 2, e.hp / e.maxHp, "#e84141");
      }
    }

    // 勇者
    const h = Game.Engine.effectiveHero();
    const walking = state.phase === "walking";
    const frame =
      walking && Math.floor(state.hero.walkPhase) % 2 === 1
        ? d.SPRITE_HERO2
        : d.SPRITE_HERO;
    const dead = state.phase === "dead";
    const heroTint = dead
      ? "#6a4a4a"
      : state.hero.hitFlash > 0
      ? "#ffffff"
      : state.rageLeft > 0
      ? "#ffcaca"
      : null;
    drawSprite(frame, d.HERO_X, v.ground + 1, false, heroTint);
    if (!dead) {
      drawBar(d.HERO_X - 9, v.ground - d.SPRITE_HERO.length - 5, 18, 2, state.hero.hp / h.maxHp, "#4ad94a");
    }

    // 浮動文字
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "7px monospace";
    for (const f of state.floats) {
      const alpha = Math.max(0, Math.min(1, f.life / 0.9));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#000";
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  Game.Render = { init, resize, draw };
})();
