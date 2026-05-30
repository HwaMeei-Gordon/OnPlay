/* ============================================================
 * render.js — Canvas 像素渲染
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

  function drawBackground(scroll) {
    const v = Game.view;
    const ground = v.ground;
    // 天空（由上而下幾段色帶）
    const sky = ["#1a2a4a", "#244066", "#2f5680", "#4a7aa6"];
    const bandH = Math.ceil(ground / sky.length);
    for (let i = 0; i < sky.length; i++) {
      ctx.fillStyle = sky[i];
      ctx.fillRect(0, i * bandH, v.w, bandH);
    }
    // 遠景雲（視差）
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    const cloudGap = 90;
    const cloudOff = (scroll * 0.15) % cloudGap;
    for (let x = -cloudGap; x < v.w + cloudGap; x += cloudGap) {
      const cx = x - cloudOff;
      const cy = 18 + ((x / cloudGap) % 3) * 8;
      ctx.fillRect(cx, cy, 20, 5);
      ctx.fillRect(cx + 4, cy - 4, 12, 5);
    }
    // 遠景山（視差）
    ctx.fillStyle = "#1f3a52";
    const hillGap = 70;
    const hillOff = (scroll * 0.3) % hillGap;
    for (let x = -hillGap; x < v.w + hillGap; x += hillGap) {
      const hx = Math.round(x - hillOff);
      for (let k = 0; k < 18; k++) {
        ctx.fillRect(hx - k, ground - 18 + k, 2 * (18 - k) + hillGap * 0, 1);
      }
    }
    // 地面
    ctx.fillStyle = "#3a2f1a";
    ctx.fillRect(0, ground, v.w, v.h - ground);
    ctx.fillStyle = "#4d3f22";
    ctx.fillRect(0, ground, v.w, 3);
    // 地面草色頂線
    ctx.fillStyle = "#5a7a3a";
    ctx.fillRect(0, ground, v.w, 1);
    // 捲動地磚紋理
    ctx.fillStyle = "#2e2614";
    const tile = 16;
    const toff = Math.floor(scroll % tile);
    for (let x = -toff; x < v.w; x += tile) {
      ctx.fillRect(x, ground + 6, 1, v.h - ground - 6);
    }
  }

  function draw(state) {
    if (!ctx) return;
    const v = Game.view;
    const d = D();
    drawBackground(state.worldScroll);

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
