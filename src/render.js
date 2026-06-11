/* ============================================================
 * render.js — Canvas 像素渲染（4 層景深視差 + 隊伍/多敵人/寵物/特效）
 * 全域命名空間：window.Game.Render
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});
  let canvas, ctx, mainCtx;
  let bgCanvas, bgCtx, bgKey = "", lutCache = {};
  const D = () => Game.Data;

  function init(cv) {
    canvas = cv;
    mainCtx = ctx = canvas.getContext("2d");
    bgCanvas = document.createElement("canvas");
    bgCtx = bgCanvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }
  // HD：主畫布內部解析度 ×4（DPR），繪碼維持 world 座標（setTransform 放大）；
  // 背景離屏維持 1× 用 drawImage 放大（效能不變）；HD 精靈以 1/HD 步長畫＝1 裝置像素。
  // 角色 64²、怪物小 48²/王 64² 皆以 step=1/4 繪製 → 螢幕佔位不變、高解析＋抗鋸齒。
  const HD = 4;
  const HD_STEP = 1 / HD;
  function resize() {
    const d = D();
    const rect = canvas.getBoundingClientRect();
    let worldW = Math.round((d.WORLD_H * Math.max(1, rect.width)) / Math.max(1, rect.height));
    worldW = Math.max(120, Math.min(460, worldW)); // 允許貼合顯示比例 → 正方形像素，不再被拉伸
    canvas.width = worldW * HD;
    canvas.height = d.WORLD_H * HD;
    mainCtx.setTransform(HD, 0, 0, HD, 0, 0); // 設寬高會清掉 transform，必須在其後重設
    mainCtx.imageSmoothingEnabled = false;
    Game.view.w = worldW;
    Game.view.h = d.WORLD_H;
    Game.view.ground = d.WORLD_H - d.GROUND_FROM_BOTTOM;
    // 背景離屏快取尺寸 + 失效（維持 1× world 解析度）
    bgCanvas.width = worldW;
    bgCanvas.height = d.WORLD_H;
    if (bgCtx) bgCtx.imageSmoothingEnabled = false;
    bgKey = "";
    lutCache = {};
  }

  function spriteWidth(sp) {
    let w = 0;
    for (let i = 0; i < sp.length; i++) if (sp[i].length > w) w = sp[i].length;
    return w;
  }
  // step：每個精靈像素佔幾個 world 單位（1=傳統圖、1/HD=HD 圖，在 HD× 畫布上恰為 1 裝置像素）
  function spriteWorldW(sp, step) { return spriteWidth(sp) * (step || 1); }
  function spriteWorldH(sp, step) { return sp.length * (step || 1); }
  // ---- 程序化動畫：依單位狀態回傳「繞腳底」的位移/旋轉/縮放（套在 drawSprite 外的 ctx 變換）----
  // facing：+1 面右(英雄)、-1 面左(敵人)。moving：是否在走路。flying：飛行漂浮。idx：去同步相位。
  function bodyAnim(u, facing, moving, flying, idx, clk) {
    let rot = 0, sx = 1, sy = 1, oy = 0;
    const fx = u.fx || {};
    const frozen = fx.freeze > 0;
    if (!frozen) { const br = Math.sin(clk * 2.4 + idx * 0.7); sy += br * 0.025; sx -= br * 0.016; } // 待機呼吸
    if (flying) { oy -= 1.5 + Math.sin(clk * 3 + idx) * 1.8; rot += Math.sin(clk * 2.2 + idx) * 0.04; } // 飛行漂浮
    else if (moving && !frozen) { const wf = clk * 9 + idx * 1.3; oy -= Math.abs(Math.sin(wf)) * 2.4; rot += Math.sin(wf) * 0.05 * facing; sy -= Math.abs(Math.cos(wf)) * 0.05; } // 走路：跳步＋搖擺＋觸地壓縮
    if (u.lunge > 0.2) { const p = Math.min(1, u.lunge / 7); rot += p * 0.20 * facing; sx += p * 0.05; sy += p * 0.06; oy -= p * 1.5; } // 攻擊前傾
    if (u.hitFlash > 0) { const p = Math.min(1, u.hitFlash / 0.12); sy -= p * 0.16; sx += p * 0.10; } // 受傷壓扁
    if (fx.stun > 0 || fx.paralyze > 0) rot += Math.sin(clk * 22 + idx) * 0.09; // 暈/麻搖晃
    if (fx.burn > 0) oy -= Math.abs(Math.sin(clk * 26 + idx)) * 0.8; // 燃燒抖動
    sx = Math.max(0.7, Math.min(1.4, sx)); sy = Math.max(0.7, Math.min(1.4, sy));
    return { rot, sx, sy, oy };
  }
  // ---- 精靈快取：每張圖（依 flip/tint/outlineOnly）只柵格化一次到離屏 canvas，之後 drawImage（HD 高解析效能關鍵）----
  const _canCache = (typeof document !== "undefined" && document.createElement);
  const _spriteCache = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
  function rasterize(sprite, flip, tint, outlineOnly) {
    const pal = D().PALETTE;
    const h = sprite.length, w = spriteWidth(sprite);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cc = cv.getContext("2d"); cc.imageSmoothingEnabled = false;
    const filled = [];
    for (let r = 0; r < h; r++) { filled[r] = []; const line = sprite[r]; for (let c = 0; c < w; c++) { const ch = c < line.length ? line[c] : "."; filled[r][c] = !(ch === "." || ch === " "); } }
    const xp = (c) => (flip ? w - 1 - c : c);
    if (outlineOnly) {
      cc.globalAlpha = 0.55; cc.fillStyle = "#aab4cc";
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { if (!filled[r][c]) continue;
        if (r === 0 || r === h - 1 || c === 0 || c === w - 1 || !filled[r - 1][c] || !filled[r + 1][c] || !filled[r][c - 1] || !filled[r][c + 1]) cc.fillRect(xp(c), r, 1, 1); }
      return cv;
    }
    cc.fillStyle = "#0d0a14";
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { if (filled[r][c]) continue;
      if ((r > 0 && filled[r - 1][c]) || (r < h - 1 && filled[r + 1][c]) || (c > 0 && filled[r][c - 1]) || (c < w - 1 && filled[r][c + 1])) cc.fillRect(xp(c), r, 1, 1); }
    for (let r = 0; r < h; r++) { const line = sprite[r]; for (let c = 0; c < w; c++) { if (!filled[r][c]) continue; const color = tint || pal[line[c]]; if (!color) continue; cc.fillStyle = color; cc.fillRect(xp(c), r, 1, 1); } }
    return cv;
  }
  function cachedSprite(sprite, flip, tint, outlineOnly) {
    let m = _spriteCache.get(sprite); if (!m) { m = {}; _spriteCache.set(sprite, m); }
    const key = (flip ? "1" : "0") + "|" + (tint || "") + "|" + (outlineOnly ? "1" : "0");
    let cv = m[key]; if (!cv) { cv = rasterize(sprite, flip, tint, outlineOnly); m[key] = cv; }
    return cv;
  }
  function drawSprite(sprite, cx, bottomY, flip, tint, yoff, outlineOnly, step) {
    const pal = D().PALETTE;
    const st = step || 1;
    const h = sprite.length, w = spriteWidth(sprite);
    // 1/HD 對齊（在 HD 畫布上即整數裝置像素）
    const sx = Math.round((cx - (w * st) / 2) * HD) / HD, sy = Math.round((bottomY - h * st + (yoff || 0)) * HD) / HD;
    // 快取快路徑：drawImage 一次（vs 每像素 fillRect）
    if (_canCache && _spriteCache) {
      ctx.drawImage(cachedSprite(sprite, flip, tint, outlineOnly), sx, sy, w * st, h * st);
      return;
    }
    const filled = [];
    for (let r = 0; r < h; r++) {
      filled[r] = [];
      const line = sprite[r];
      for (let c = 0; c < w; c++) {
        const ch = c < line.length ? line[c] : ".";
        filled[r][c] = !(ch === "." || ch === " ");
      }
    }
    const px = (c) => (flip ? sx + (w - 1 - c) * st : sx + c * st);
    // 隱身：只畫邊緣 filled 像素（半透明淺色空心輪廓），中間透明
    if (outlineOnly) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = "#aab4cc";
      for (let r = 0; r < h; r++)
        for (let c = 0; c < w; c++) {
          if (!filled[r][c]) continue;
          if (r === 0 || r === h - 1 || c === 0 || c === w - 1 ||
              !filled[r - 1][c] || !filled[r + 1][c] || !filled[r][c - 1] || !filled[r][c + 1]) {
            ctx.fillRect(px(c), sy + r * st, st, st);
          }
        }
      ctx.globalAlpha = 1;
      return;
    }
    // 自動描邊（在輪廓外緣的空白格畫深色）→ 一線像素遊戲的清晰外框
    ctx.fillStyle = "#0d0a14";
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        if (filled[r][c]) continue;
        if ((r > 0 && filled[r - 1][c]) || (r < h - 1 && filled[r + 1][c]) ||
            (c > 0 && filled[r][c - 1]) || (c < w - 1 && filled[r][c + 1])) {
          ctx.fillRect(px(c), sy + r * st, st, st);
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
        ctx.fillRect(px(c), sy + r * st, st, st);
      }
    }
  }
  // ---- 狀態效果視覺（模組層，戰鬥與說明書共用）----
  function uhas(o, k) { return o.fx && o.fx[k] > 0; }
  // 改用半透明遮罩呈現，保留角色細節，不再整體死板染色
  function fxTint(o) { return null; }
  function drawFx(o, cx, topY, yoff, w, h, clk) {
    const fx = o.fx; if (!fx) return; const t = clk || 0;
    const left = Math.round(cx - w / 2), top = Math.round(topY + yoff);
    const midY = top + h / 2, rad = Math.max(w, h) / 2 + 1;
    // 冰凍：半透明淺藍「冰塊」(八角形、非方形)把整個身體封住＋白色高光與冰柱
    if (fx.freeze > 0) {
      const L = left - 1, R = left + w + 1, T = top - 1, B = top + h + 1, cut = Math.max(2, Math.floor(Math.min(w, h) / 3));
      ctx.globalAlpha = 0.4; ctx.fillStyle = "#8fd6ff";
      if (ctx.fill) { ctx.beginPath(); ctx.moveTo(L + cut, T); ctx.lineTo(R - cut, T); ctx.lineTo(R, T + cut); ctx.lineTo(R, B - cut); ctx.lineTo(R - cut, B); ctx.lineTo(L + cut, B); ctx.lineTo(L, B - cut); ctx.lineTo(L, T + cut); ctx.closePath(); ctx.fill(); }
      else { ctx.fillRect(L, T, R - L, B - T); }
      ctx.globalAlpha = 0.9; ctx.fillStyle = "#eaffff";
      ctx.fillRect(L + cut, T, R - L - 2 * cut, 1); ctx.fillRect(cx - 2, T + cut + 1, 1, 2); ctx.fillRect(cx + 2, T + cut + 3, 1, 2);
      ctx.fillStyle = "#bfeaff"; ctx.fillRect(L + 2, B - 1, 1, 2); ctx.fillRect(R - 3, B - 1, 1, 2);
      ctx.globalAlpha = 1;
    }
    // 燃燒：腳下一把火持續竄動的火焰本體(中間高、像🔥)＋上飄火星
    if (fx.burn > 0) {
      const baseY = top + h + 1, fw = w + 2;
      for (let c = 0; c < fw; c++) {
        const taper = 1 - Math.abs(c - (fw - 1) / 2) / (fw / 2) * 0.65;
        const fh = Math.max(1, Math.round((7 + 4 * Math.sin(t * 12 + c * 0.9)) * taper));
        const x = left - 1 + c;
        for (let yy = 0; yy < fh; yy++) {
          const r = yy / fh;
          ctx.fillStyle = r < 0.35 ? "#ff3a0e" : r < 0.65 ? "#ff7a1e" : r < 0.85 ? "#ffb52a" : "#ffe66a";
          ctx.fillRect(x, baseY - yy, 1, 1);
        }
      }
      for (let k = 0; k < 4; k++) { const ey = baseY - 7 - ((t * 26 + k * 6) % 12); ctx.fillStyle = "#ffd23f"; ctx.fillRect(Math.round(cx - 4 + k * 3), Math.round(ey), 1, 1); }
    }
    // 虛弱：紫色旋繞圓圈(像英雄聯盟虛弱，上下浮動)＋淡紫壓制
    if (fx.weak > 0) {
      ctx.globalAlpha = 0.24; ctx.fillStyle = "#9b59d6"; ctx.fillRect(left, top, Math.round(w), Math.round(h)); ctx.globalAlpha = 1;
      if (ctx.arc) {
        // 紫色螺旋 🌀：三段同心弧、半徑漸增、起始角隨時間旋轉
        ctx.strokeStyle = "#c46bff"; ctx.lineWidth = 1;
        const a0 = t * 5;
        for (let s = 0; s < 3; s++) {
          const r = rad * (0.45 + s * 0.28), a = a0 + s * 2.1;
          ctx.globalAlpha = 0.9 - s * 0.22;
          ctx.beginPath(); ctx.arc(cx, midY, r, a, a + 4.2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    // 麻痺：全身竄黃色電弧＋環繞火花(像神奇寶貝麻痺)，快速閃爍
    if (fx.paralyze > 0 && Math.floor(t * 18) % 2) {
      ctx.strokeStyle = "#fff04a"; ctx.lineWidth = 1;
      for (let b = 0; b < 4; b++) {
        const bx = left + Math.round((b * 0.27 + 0.12) * w), s = b % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(bx, top + 1); ctx.lineTo(bx + 2 * s, top + h * 0.35); ctx.lineTo(bx - s, top + h * 0.55); ctx.lineTo(bx + 2 * s, top + h * 0.85);
        ctx.stroke();
      }
      for (let k = 0; k < 5; k++) { const a = t * 32 + k * 1.7; ctx.fillStyle = "#ffffaa"; ctx.fillRect(Math.round(cx + Math.cos(a) * (w / 2 + 1)), Math.round(top + (k / 5) * h), 1, 1); }
    }
    // 狂暴：圓形半透明紅(非方形)＋外圍紅色脈動光環(透紅)
    if (fx.berserk > 0 && ctx.arc) {
      ctx.globalAlpha = 0.28; ctx.fillStyle = "#ff2a2a"; ctx.beginPath(); ctx.arc(cx, midY, rad, 0, 6.283); if (ctx.fill) ctx.fill(); ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.3 + 0.25 * Math.sin(t * 8); ctx.strokeStyle = "#ff3030"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, midY, rad + 1, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // 暈眩：頭上 3 顆黃色星星繞圈 ⭐
    if (fx.stun > 0) { for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.094, sx = Math.round(cx + Math.cos(a) * 5), sy = Math.round(topY - 4 + Math.sin(a) * 2 + yoff); ctx.fillStyle = "#ffe45a"; ctx.fillRect(sx, sy, 1, 1); ctx.fillRect(sx - 1, sy, 1, 1); ctx.fillRect(sx + 1, sy, 1, 1); ctx.fillRect(sx, sy - 1, 1, 1); ctx.fillRect(sx, sy + 1, 1, 1); } }
    // 封印：身上紅色 ❌ 叉叉
    if (fx.seal > 0) {
      const cy = midY, r = Math.max(w, h) / 2;
      ctx.strokeStyle = "#ff2a3a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
  // 說明書預覽：把效果套在範例精靈上畫到指定 ctx（用後還原模組 ctx，戰鬥不受影響）
  function drawSpriteFx(targetCtx, sprite, fxKey, clk, opts) {
    if (!targetCtx || !sprite) return;
    opts = opts || {};
    const prev = ctx;
    ctx = targetCtx;
    if (ctx.imageSmoothingEnabled !== undefined) ctx.imageSmoothingEnabled = false;
    const w = spriteWidth(sprite), h = sprite.length;
    const cx = opts.cx != null ? opts.cx : w / 2;
    const bottomY = opts.bottomY != null ? opts.bottomY : h + 1;
    const fake = { fx: fxKey ? { [fxKey]: 1 } : null };
    drawSprite(sprite, cx, bottomY, false, fxTint(fake), 0);
    drawFx(fake, Math.round(cx), bottomY - h, 0, w, h, clk);
    ctx = prev;
  }
  function drawBar(x, y, w, h, ratio, color) {
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = "#1a1228"; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.round(w * ratio), h);
  }
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // ---- 遠景剪影單元（保留繪製工具，目前中景以 LUT 直接上色）----
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

  // 解析 "#rgb" / "#rrggbb" / "rgb(r,g,b)" → [r,g,b]；輸出一律回傳 hex，避免鏈式呼叫解析失敗
  function parseRGB(s) {
    if (s[0] === "#") { let m = s.slice(1); if (m.length < 6) m = m.split("").map((c) => c + c).join(""); return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]; }
    const mm = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/); return mm ? [+mm[1], +mm[2], +mm[3]] : [0, 0, 0];
  }
  function toHex(r, g, b) { const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); return "#" + h(r) + h(g) + h(b); }
  function lighten(hex, a) { const c = parseRGB(hex); return toHex(c[0] + a, c[1] + a, c[2] + a); }
  function lerpColor(a, b, t) { const A = parseRGB(a), B = parseRGB(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }

  // 預先建立「與捲動無關」的顏色查表（每主題/尺寸只算一次）→ 繪製時不再逐像素配置字串
  function buildLUT(theme) {
    const v = Game.view, g = v.ground;
    const key = theme.name + "|" + g + "|" + v.h;
    if (lutCache[key]) return lutCache[key];
    const sky = theme.sky, n = sky.length, skyBot = sky[n - 1];
    const skyRow = new Array(g);
    for (let y = 0; y < g; y++) {
      const f = (y / Math.max(1, g - 1)) * (n - 1);
      const i = Math.min(n - 2, Math.floor(f));
      skyRow[y] = lerpColor(sky[i], sky[i + 1], f - i);
    }
    const gTop = theme.ground, gBot = lerpColor(theme.ground, "#000000", 0.55), gh = Math.max(1, v.h - g);
    const groundRow = new Array(v.h - g);
    for (let y = g; y < v.h; y++) groundRow[y - g] = lerpColor(gTop, gBot, (y - g) / gh);
    const RN = 20, farRamp = new Array(RN), midRamp = new Array(RN);
    const farTop = lerpColor(theme.horizon, skyBot, 0.62), farBot = theme.horizon;
    const midTop = lerpColor(theme.farColor, skyBot, 0.34), midBot = lerpColor(theme.farColor, "#0a0610", 0.22);
    for (let i = 0; i < RN; i++) { farRamp[i] = lerpColor(farTop, farBot, i / (RN - 1)); midRamp[i] = lerpColor(midTop, midBot, i / (RN - 1)); }
    return (lutCache[key] = {
      skyRow, groundRow, farRamp, midRamp, RN,
      farRim: lighten(theme.horizon, 16), midRim: lighten(theme.farColor, 22),
      dlite: lighten(theme.ground, 16), ddark: lerpColor(theme.ground, "#000000", 0.4),
      grassTip: lighten(theme.decoColor, 26), grassBase: lerpColor(theme.decoColor, "#0c1206", 0.5),
    });
  }

  // 丘陵層：用預建色階查表（不再逐像素 lerpColor）
  function drawHills(ramp, RN, rim, amp, base, freq, scroll) {
    const v = Game.view, g = v.ground;
    for (let x = 0; x < v.w; x++) {
      const t = (x + scroll) * freq;
      const ty = Math.round(base - amp * (0.55 + 0.45 * Math.sin(t)) - amp * 0.3 * Math.sin(t * 2.7 + 1.3));
      const hh = Math.max(1, g + 3 - ty);
      for (let y = ty; y < g + 3; y++) {
        let idx = (((y - ty) / hh) * RN) | 0; if (idx >= RN) idx = RN - 1;
        ctx.fillStyle = ramp[idx]; ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = rim; ctx.fillRect(x, ty, 1, 1);
    }
  }

  // ===== 各區專屬遠景輪廓 / 中景 / 氛圍粒子（道路網格不在此，於 draw() 另畫）=====
  function triWave(period, x) { const m = ((x % period) + period) % period; return 1 - Math.abs(m / period - 0.5) * 2; }
  // 填滿單列剪影（ty→bottom）＋頂緣亮邊
  function fillCol(x, ty, bottom, ramp, RN, rim) {
    if (x < 0 || x >= Game.view.w) return;
    ty = Math.round(ty); if (ty >= bottom) return; const hh = bottom - ty;
    for (let y = ty; y < bottom; y++) { let i = (((y - ty) / hh) * RN) | 0; if (i >= RN) i = RN - 1; ctx.fillStyle = ramp[i]; ctx.fillRect(x, y, 1, 1); }
    ctx.fillStyle = rim; ctx.fillRect(x, ty, 1, 1);
  }
  // 遠景：依 theme.far 畫出該區獨特剪影
  function drawFar(type, ramp, RN, rim, base, scroll, accent) {
    const v = Game.view, bottom = base + 12;
    if (type === "pillars") { // 遺跡：斷裂石柱（縫隙露天）
      const cw = 6, period = 11, off = Math.round(scroll) % period;
      for (let bx = -period; bx < v.w + period; bx += period) {
        const seed = (((bx * 37) % 11) + 11) % 11, x0 = bx - off, top = base - 2 - (seed % 5) * 3;
        for (let x = x0; x < x0 + cw; x++) { const edge = (x === x0 || x === x0 + cw - 1) ? 2 : 0; fillCol(x, top + edge + (seed % 2), bottom, ramp, RN, rim); }
      }
      return;
    }
    if (type === "battlements") { // 魔王城：城牆雉堞＋塔樓
      for (let x = 0; x < v.w; x++) fillCol(x, base - 4 + (((Math.floor((x + scroll) / 4) % 2) + 2) % 2 ? 0 : 3), bottom, ramp, RN, rim);
      const tp = 72, toff = Math.round(scroll * 0.5) % tp;
      for (let tx = -tp; tx < v.w + tp; tx += tp) for (let x = tx - toff; x < tx - toff + 10; x++) fillCol(x, base - 15 + (((Math.floor(x / 3) % 2) + 2) % 2 ? 0 : 3), bottom, ramp, RN, rim);
      return;
    }
    if (type === "skycity") { // 天空之城：浮空島＋塔（下方露天）
      const ip = 80, off = Math.round(scroll * 0.4) % ip;
      for (let ix = -ip; ix < v.w + ip; ix += ip) {
        const cx = ix - off, seed = (((ix * 29) % 7) + 7) % 7, top = base - 17 - seed, iw = 24 + seed * 2;
        for (let x = cx; x < cx + iw; x++) { const e = Math.abs(x - (cx + iw / 2)) / (iw / 2); fillCol(x, top + Math.round(e * e * 6), base - 1 - Math.round((1 - e) * 8), ramp, RN, rim); }
        for (let x = Math.round(cx + iw / 2) - 2; x < cx + iw / 2 + 2; x++) fillCol(x, top - 7, top + 2, ramp, RN, rim);
      }
      return;
    }
    for (let x = 0; x < v.w; x++) { // 全幅地形型
      const t = x + scroll; let ty;
      switch (type) {
        case "trees": ty = base - 2 - 4 * (0.5 + 0.5 * Math.sin(t * 0.05)) - 7 * triWave(10, t); break;
        case "dunes": ty = base - 3 - 6 * (0.5 + 0.5 * Math.sin(t * 0.03)) - 2 * Math.sin(t * 0.013 + 2); break;
        case "peaks": ty = base - 2 - 16 * triWave(Math.max(40, Math.round(v.w / 2.3)), t); break;
        case "volcano": { const d0 = Math.abs(((t + v.w * 0.5) % (v.w * 1.5)) - v.w * 0.75); ty = base - Math.max(0, 20 - d0 * 0.5); if (d0 < 2) ty += 3; break; }
        case "seaweed": ty = base - 3 - 4 * (0.5 + 0.5 * Math.sin(t * 0.06)); break;
        case "abyss": ty = base - 2 - 13 * Math.abs(Math.sin(t * 0.13 + Math.sin(t * 0.05))); break;
        case "hills": default: ty = base - 7 * (0.55 + 0.45 * Math.sin(t * 0.045)) - 2 * Math.sin(t * 0.12 + 1.3); break;
      }
      fillCol(x, ty, bottom, ramp, RN, rim);
      if (type === "peaks" && ty < base - 9) { ctx.fillStyle = "#ffffff"; ctx.fillRect(x, Math.round(ty), 1, 2); }
      if (type === "volcano" && accent && ty <= base - 17) { ctx.fillStyle = accent; ctx.fillRect(x, Math.round(ty), 1, 3); }
    }
  }
  // 中景：海草/浮島留空，其餘畫近景丘陵脊
  function drawMid(theme, ramp, RN, rim, base, scroll) {
    const v = Game.view, type = theme.far;
    if (type === "seaweed") {
      const sp = 9, off = Math.round(scroll) % sp;
      for (let bx = -sp; bx < v.w + sp; bx += sp) { const cx = bx - off, seed = (((bx * 23) % 7) + 7) % 7, h = 8 + seed * 2; for (let k = 0; k < h; k++) { const sway = Math.round(Math.sin(k * 0.6 + bx) * 1.5), col = ramp[Math.min(RN - 1, ((k / h) * RN) | 0)]; ctx.fillStyle = col; ctx.fillRect(cx + sway, base + 1 - k, 1, 1); ctx.fillRect(cx + sway + 1, base + 1 - k, 1, 1); } }
      return;
    }
    if (type === "skycity") return;
    drawHills(ramp, RN, rim, 13, base, 0.07, scroll);
  }
  // 氛圍粒子（飄雪/餘燼/氣泡/光塵/落葉/沙塵）
  function drawAmbience(theme, scroll) {
    const v = Game.view, g = v.ground, type = theme.far; let col, n = 0, rising = false, lowOnly = false;
    switch (type) {
      case "peaks": col = "rgba(255,255,255,0.7)"; n = 46; break;
      case "volcano": col = "rgba(255,120,40,0.85)"; n = 30; rising = true; break;
      case "abyss": col = "rgba(255,70,80,0.7)"; n = 30; rising = true; break;
      case "seaweed": col = "rgba(180,230,255,0.5)"; n = 34; rising = true; break;
      case "skycity": col = "rgba(255,255,255,0.6)"; n = 28; break;
      case "trees": col = "rgba(150,200,90,0.5)"; n = 22; break;
      case "dunes": col = "rgba(220,200,150,0.4)"; n = 18; lowOnly = true; break;
      default: return;
    }
    for (let i = 0; i < n; i++) {
      const sx = (i * 67) % v.w, sy0 = (i * 91) % g, drift = ((sx - Math.round(scroll * 0.05 + i * 13)) % v.w + v.w) % v.w;
      let y = lowOnly ? g - 4 - ((i * 91) % 36) : sy0;
      if (rising) y = g - ((sy0 + Math.round(scroll * 0.6)) % g);
      ctx.fillStyle = col; ctx.fillRect(Math.round(drift), Math.round(y), 1, 1);
    }
  }

  // 繪製整個背景到目前的 ctx（呼叫前 ctx 已指向離屏快取）
  function drawBackground(scroll, theme) {
    const v = Game.view, g = v.ground, L = buildLUT(theme);
    // 天空（查表）
    for (let y = 0; y < g; y++) { ctx.fillStyle = L.skyRow[y]; ctx.fillRect(0, y, v.w, 1); }
    // 雲（僅天空型地區；火山/深海/魔王城/深層改用氛圍粒子）
    const noClouds = (theme.far === "volcano" || theme.far === "seaweed" || theme.far === "battlements" || theme.far === "abyss");
    if (!noClouds) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      const cl = (scroll * 0.04) % 150;
      const puffs = [[10, 14], [62, 24], [118, 10], [176, 28], [232, 18], [288, 12]];
      puffs.forEach((p) => {
        let x = Math.round(p[0] - cl); while (x < -30) x += 300; const y = p[1];
        ctx.fillRect(x, y, 16, 3); ctx.fillRect(x + 4, y - 2, 9, 3); ctx.fillRect(x + 2, y + 3, 12, 2);
      });
    }
    // 遠景專屬輪廓 + 中景
    drawFar(theme.far, L.farRamp, L.RN, L.farRim, g - 11, scroll * 0.08, theme.groundLine);
    drawMid(theme, L.midRamp, L.RN, L.midRim, g - 1, scroll * 0.3);
    // 地面（查表）
    for (let y = g; y < v.h; y++) { ctx.fillStyle = L.groundRow[y - g]; ctx.fillRect(0, y, v.w, 1); }
    // 泥土碎石
    const gh = Math.max(1, v.h - g), dof = Math.floor(scroll) % 12;
    for (let x = -12; x < v.w + 12; x += 6) {
      const rx = x - dof, seed = (((x * 41) % 13) + 13) % 13;
      ctx.fillStyle = seed < 6 ? L.ddark : L.dlite;
      const yy = g + 4 + ((((x * 17) % (gh - 6)) + (gh - 6)) % (gh - 6));
      ctx.fillRect(rx, yy, 2, 1);
      if (seed % 4 === 0) ctx.fillRect(rx + 3, yy + 4, 1, 1);
    }
    // 表層草皮（僅有植被的地區：草原/森林；沙漠/雪地/熔岩/海/空/遺跡/城/深淵不長草）
    if (theme.deco === "grass" || theme.deco === "bush") {
      const tof = Math.floor(scroll) % 5;
      for (let x = -5; x < v.w + 5; x += 5) {
        const hgt = 3 + ((((x * 7) % 4) + 4) % 4), rx = x - tof;
        ctx.fillStyle = L.grassBase; ctx.fillRect(rx, g - hgt, 1, hgt + 1);
        ctx.fillStyle = theme.decoColor; ctx.fillRect(rx, g - hgt, 1, 2);
        ctx.fillStyle = L.grassTip; ctx.fillRect(rx, g - hgt, 1, 1);
      }
    }
    // 地面上緣亮邊（各區專屬 groundLine 色，讓地平線更分明）
    if (theme.groundLine) { ctx.globalAlpha = 0.55; ctx.fillStyle = theme.groundLine; ctx.fillRect(0, g, v.w, 1); ctx.globalAlpha = 1; }
    // 近景裝飾
    const dgap = 64, doff = scroll % dgap;
    for (let bx = -dgap; bx < v.w + dgap; bx += dgap) drawDecoUnit(theme.deco, Math.round(bx - doff), g, theme.decoColor);
    // 氛圍粒子（飄雪/餘燼/氣泡/光塵…）
    drawAmbience(theme, scroll);
  }

  function shadow(x, w, gy) {
    gy = gy == null ? Game.view.ground : gy;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(Math.round(x - w / 2), gy, w, 1);
    ctx.fillRect(Math.round(x - w / 3), gy + 1, Math.round((w * 2) / 3), 1);
  }
  function jitter(amp) { return amp > 0 ? Math.round((Math.random() * 2 - 1) * 1.6) : 0; }

  function draw() {
    if (!ctx) return;
    const v = Game.view, d = D();
    const b = Game.Engine.battle;
    const stage = Game.State ? Game.State.stage : 1;
    const theme = d.getTheme(stage);
    // 背景：只在「整數捲動 / 主題 / 尺寸」改變時重畫到離屏快取，否則直接貼上 → 戰鬥時背景零重算
    const scrollInt = Math.floor(b ? b.worldScroll : 0);
    const key = theme.name + "|" + v.w + "|" + v.h + "|" + scrollInt;
    if (key !== bgKey) {
      ctx = bgCtx;
      drawBackground(scrollInt, theme);
      ctx = mainCtx;
      bgKey = key;
    }
    if (bgCanvas.width) mainCtx.drawImage(bgCanvas, 0, 0);
    if (!b) return;

    // 道路三行網格（淺灰色、固定不隨畫面捲動；人物站在格子中央）
    {
      const half = Math.round((d.laneY(v.ground, 1) - d.laneY(v.ground, 0)) / 2) || 5;
      const top = d.laneY(v.ground, 0) - half, bot = d.laneY(v.ground, d.LANES - 1) + half;
      ctx.fillStyle = "rgba(210,216,228,0.06)";
      for (let x = 0; x <= v.w; x += 16) ctx.fillRect(x, top, 1, bot - top); // 縱線固定，每 16px（單位置中）
      ctx.fillStyle = "rgba(210,216,228,0.15)";
      for (let L = 0; L < d.LANES; L++) ctx.fillRect(0, d.laneY(v.ground, L) - half, v.w, 1);
      ctx.fillRect(0, bot, v.w, 1);
    }

    const LYF = (u) => d.laneYF(v.ground, u.laneF != null ? u.laneF : u.lane);
    const walking = b.phase === "walking";

    // 腳下陰影（皆畫在地面層；空中單位也在地面留影，呈現高度）
    b.field.forEach((h) => { if (!h.dead) shadow(h.x, spriteWorldW(h.sprite, h.sprStep || 1) - 2, LYF(h)); });
    b.enemies.forEach((e) => { if (e.air <= 0) shadow(e.x, spriteWorldW(e.sprite, e.sprStep || 1) - 2, LYF(e)); });

    // 狀態效果動態時鐘（fxTint/drawFx 已提升到模組層，供戰鬥與說明書共用）
    const clk = b.fxClock || 0;

    // 英雄＋寵物＋敵人合併、依行（上行較後）景深排序後繪製（小數行位→換行更平滑）
    const drawList = [];
    b.enemies.forEach((e) => drawList.push({ y: LYF(e) + ((e.zF > 0) ? 0.4 : 0), kind: "e", o: e }));
    b.field.forEach((h, i) => { if (!h.dead) drawList.push({ y: LYF(h), kind: "h", o: h, i: i }); }); // 死亡→消失，復活才再出現
    drawList.sort((a, c) => a.y - c.y || (a.kind === "e" ? a.o.x : -a.o.x) - (c.kind === "e" ? c.o.x : -c.o.x));
    drawList.forEach((dr) => {
      if (dr.kind === "e") {
        const e = dr.o, sp = e.sprite, gy = dr.y;
        if (e.burrowState === "under") return; // 潛入地下：本體不繪製
        const est = e.sprStep || 1, esw = spriteWorldW(sp, est), esh = spriteWorldH(sp, est);
        const tint = e.hitFlash > 0 ? "#ffffff" : fxTint(e);
        const ex = e.x - e.lunge + jitter(e.shake), ey = jitter(e.shake) - (e.air || 0) - (e.zF || 0) * d.AIR_LIFT;
        const baseTint = e.isChest ? "#ffcf3d" : e.isElite ? "#ff6a8a" : null;
        if (e.invis) { drawSprite(sp, ex, gy + 1 + ey, !e.isBoss, null, 0, true, est); return; } // 隱身：只剩外輪廓、不畫血條/特效
        // 程序化動畫（走/攻/傷/狀態），繞腳底變換
        const eMoving = (e.x - (e.moveTX != null ? e.moveTX : e.x)) > 1.5;
        const eFly = (e.air || 0) > 0 || e.gz;
        const ea = bodyAnim(e, -1, eMoving, eFly, e.lane || 0, clk);
        const efx = ex, efy = gy + 1 + ey;
        ctx.save(); ctx.translate(efx, efy); ctx.rotate(ea.rot); ctx.scale(ea.sx, ea.sy); ctx.translate(-efx, -efy);
        drawSprite(sp, ex, efy + ea.oy, !e.isBoss, !tint && baseTint ? baseTint : tint, 0, false, est);
        ctx.restore();
        const bw = Math.max(10, esw - 2);
        drawBar(ex - bw / 2, gy - esh - (e.isBoss ? 4 : 2) + ey, bw, e.isBoss ? 3 : 2, e.hp / e.maxHp, "#e84141");
        drawFx(e, Math.round(ex), gy - esh, ey, esw, esh, clk);
        if (e.isChest) {
          const my = gy - esh - 9 + ey, mx = Math.round(ex);
          rect(mx - 4, my + 2, 8, 5, "#7a4a16"); rect(mx - 4, my, 8, 2, "#ffcf3d");
          rect(mx - 1, my + 1, 2, 5, "#ffe27a");
        } else if (e.isElite) {
          const my = gy - esh - 8 + ey, mx = Math.round(ex);
          rect(mx - 5, my + 4, 10, 2, "#ff3b46");
          rect(mx - 4, my + 1, 2, 4, "#ff6a8a"); rect(mx - 1, my, 2, 5, "#ffd23f"); rect(mx + 2, my + 1, 2, 4, "#ff6a8a");
        }
      } else {
        const h = dr.o, gy = dr.y;
        const tint = h.dead ? "#5a4a4a" : h.hitFlash > 0 ? "#ffffff" : fxTint(h);
        const hx = h.x + h.lunge + jitter(h.shake), hy = jitter(h.shake);
        const st = h.sprStep || 1, sh = spriteWorldH(h.sprite, st), sw = spriteWorldW(h.sprite, st);
        // 程序化動畫（面右；march 期間走路；飛行漂浮），繞腳底變換
        const ha = bodyAnim(h, +1, walking, (h.air || 0) > 0, dr.i, clk);
        const hfx = hx, hfy = gy + 1 + hy;
        ctx.save(); ctx.translate(hfx, hfy); ctx.rotate(ha.rot); ctx.scale(ha.sx, ha.sy); ctx.translate(-hfx, -hfy);
        drawSprite(h.sprite, hx, hfy + ha.oy, false, tint, 0, false, st);
        ctx.restore();
        if (!h.dead && h.hp < h.maxHp) drawBar(hx - 7, gy - sh - 2 + hy, 14, 2, h.hp / h.maxHp, "#4ad94a");
        if (!h.dead) drawFx(h, Math.round(hx), gy - sh, hy, sw, sh, clk);
      }
    });

    // 投射物：依種類繪製（箭帶尾跡 / 火球 / 冰晶 / 暗球 / 聖光 / 預設小球）
    b.projectiles.forEach((p) => {
      const x = p.x + (p.tx - p.x) * p.t, y = p.y + (p.ty - p.y) * p.t;
      const dx = p.tx - p.x, dy = p.ty - p.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, rx = Math.round(x), ry = Math.round(y);
      if (p.kind === "arrow") {
        ctx.globalAlpha = 0.35; ctx.strokeStyle = p.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(rx - ux * 9, ry - uy * 9); ctx.lineTo(rx - ux * 3, ry - uy * 3); ctx.stroke(); // 尾跡
        ctx.globalAlpha = 1; ctx.strokeStyle = "#caa14a";
        ctx.beginPath(); ctx.moveTo(rx - ux * 4, ry - uy * 4); ctx.lineTo(rx + ux * 2, ry + uy * 2); ctx.stroke(); // 箭身
        ctx.fillStyle = "#fff"; ctx.fillRect(rx + Math.round(ux * 2), ry + Math.round(uy * 2), 1, 1); // 箭頭
      } else if (p.kind === "fireball") {
        ctx.globalAlpha = 0.4; ctx.fillStyle = "#ff5a1e";
        for (let s = 1; s <= 3; s++) ctx.fillRect(rx - Math.round(ux * s * 2) - 1, ry - Math.round(uy * s * 2) - 1, 2, 2); // 尾焰
        ctx.globalAlpha = 1; ctx.fillStyle = "#ff7a2a"; ctx.fillRect(rx - 2, ry - 2, 4, 4);
        ctx.fillStyle = "#ffd23f"; ctx.fillRect(rx - 1, ry - 1, 2, 2);
        ctx.fillStyle = "#fff"; ctx.fillRect(rx, ry, 1, 1);
      } else if (p.kind === "frost") {
        ctx.globalAlpha = 0.4; ctx.fillStyle = p.color; ctx.fillRect(rx - Math.round(ux * 4) - 1, ry - Math.round(uy * 4) - 1, 2, 2);
        ctx.globalAlpha = 1; ctx.fillStyle = "#7ad7ff"; ctx.fillRect(rx - 1, ry - 2, 2, 5); ctx.fillRect(rx - 2, ry - 1, 5, 2); // 冰晶十字
        ctx.fillStyle = "#fff"; ctx.fillRect(rx, ry, 1, 1);
      } else if (p.kind === "dark") {
        ctx.globalAlpha = 0.4; ctx.fillStyle = "#a35bff"; ctx.fillRect(rx - 2, ry - 2, 4, 4); // 紫暈
        ctx.globalAlpha = 1; ctx.fillStyle = "#160a26"; ctx.fillRect(rx - 1, ry - 1, 3, 3); // 黑核
        ctx.fillStyle = "#c89bff"; ctx.fillRect(rx, ry, 1, 1);
      } else if (p.kind === "holy") {
        ctx.globalAlpha = 0.35; ctx.fillStyle = p.color; ctx.fillRect(rx - 2, ry - 2, 4, 4);
        ctx.globalAlpha = 1; ctx.fillStyle = p.color; ctx.fillRect(rx - 1, ry - 1, 3, 3);
        ctx.fillStyle = "#eaffe9"; ctx.fillRect(rx, ry, 1, 1);
      } else {
        ctx.globalAlpha = 0.4; ctx.fillStyle = p.color;
        ctx.fillRect(rx - Math.round(ux * 2) - 1, ry - 1, 3, 2);
        ctx.globalAlpha = 1; ctx.fillStyle = p.color; ctx.fillRect(rx - 1, ry - 1, 3, 3);
        ctx.fillStyle = "#fff"; ctx.fillRect(rx, ry, 1, 1);
      }
      ctx.globalAlpha = 1;
    });

    // 粒子（火花 / 金幣 / 揮砍）
    b.particles.forEach((p) => {
      const a = Math.max(0, Math.min(1, p.life / p.life0));
      ctx.globalAlpha = a;
      if (p.type === "coin") {
        // 旋轉（垂直/水平交替）+ 末段縮小，亮邊高光
        const px = Math.round(p.x), py = Math.round(p.y);
        const spin = Math.floor(p.life * 28) % 2;
        if (a < 0.4) { ctx.fillStyle = p.color; ctx.fillRect(px, py, 1, 1); }
        else if (spin) { ctx.fillStyle = p.color; ctx.fillRect(px, py - 1, 1, 3); ctx.fillStyle = "#fff7c8"; ctx.fillRect(px, py - 1, 1, 1); }
        else { ctx.fillStyle = p.color; ctx.fillRect(px - 1, py, 3, 1); ctx.fillStyle = "#fff7c8"; ctx.fillRect(px - 1, py, 1, 1); }
      } else if (p.type === "dust") {
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = p.color;
        const s = p.life > p.life0 * 0.5 ? 1 : 2; // 漸散變大
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      } else if (p.type === "slash") {
        ctx.strokeStyle = "rgba(255,255,255," + a + ")"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 6); ctx.lineTo(p.x + 7, p.y - 6); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + (a * 0.5) + ")";
        ctx.beginPath(); ctx.moveTo(p.x - 6, p.y + 4); ctx.lineTo(p.x + 7, p.y - 4); ctx.stroke();
      } else if (p.type === "flash") {
        if (ctx.arc) {
          const r = (1 - p.life / p.life0) * 6 + 1;
          ctx.strokeStyle = "rgba(255,255,255," + a + ")"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
        }
      } else if (p.type === "heal") {
        // 綠色十字治療粒子（上升）
        const hx = Math.round(p.x), hy = Math.round(p.y);
        ctx.fillStyle = p.color; ctx.fillRect(hx, hy - 1, 1, 3); ctx.fillRect(hx - 1, hy, 3, 1);
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

    // 前景「走路」層：高對比草叢快速掠過（亮色尖端 + 深色基部，與背景明顯區隔）
    const fgD = "#0c1206";                       // 深色基部/外框
    const fgM = lighten(theme.decoColor, 36);    // 亮草身
    const fgL = lighten(theme.decoColor, 90);    // 高光尖端
    // 前景底部加一條暗帶把近景與背景分開
    ctx.fillStyle = "rgba(8,10,6,0.55)";
    ctx.fillRect(0, v.h - 6, v.w, 6);
    const fgap = 16, foff = (b.worldScroll * 1.9) % fgap;
    for (let x = -fgap; x < v.w + fgap; x += fgap) {
      const rx = Math.round(x - foff);
      ctx.fillStyle = fgD;
      ctx.fillRect(rx, v.h - 13, 2, 13); ctx.fillRect(rx + 4, v.h - 9, 2, 9); ctx.fillRect(rx + 8, v.h - 6, 2, 6);
      ctx.fillStyle = fgM;
      ctx.fillRect(rx + 1, v.h - 15, 1, 15); ctx.fillRect(rx + 5, v.h - 10, 1, 10); ctx.fillRect(rx + 9, v.h - 7, 1, 7);
      ctx.fillStyle = fgL;
      ctx.fillRect(rx + 1, v.h - 15, 1, 3); ctx.fillRect(rx + 5, v.h - 10, 1, 3);
    }

    // 中央橫幅（勝利／失敗）：大字置中、末段淡出
    if (b.banner && b.bannerTimer > 0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.bannerTimer / 0.4));
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 20px monospace";
      const cx = v.w / 2, cy = Math.round(v.ground * 0.5);
      ctx.fillStyle = "#000"; ctx.fillText(b.banner.text, cx + 1, cy + 1);
      ctx.fillStyle = b.banner.color; ctx.fillText(b.banner.text, cx, cy);
      ctx.globalAlpha = 1;
    }

    // 邊緣暗角
    if (ctx.createRadialGradient) {
      const vg = ctx.createRadialGradient(v.w / 2, v.ground * 0.6, v.ground * 0.3, v.w / 2, v.ground * 0.6, v.w * 0.7);
      if (vg && vg.addColorStop) {
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.18)");
        ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
      }
    }
  }

  Game.Render = { init, resize, draw, drawSpriteFx, drawBackground, HD_STEP };
})();
