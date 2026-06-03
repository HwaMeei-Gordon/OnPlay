/* ============================================================
 * icons.js — 自製像素圖示系統（不使用任何 emoji）
 * 把 12×12 點陣圖示繪成 dataURL，給 DOM <img> 用（pixelated 放大）。
 * 也能把遊戲 sprite（英雄/寵物）轉成圖示。
 * 全域命名空間：window.Game.Icons
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});

  // 圖示專用調色盤
  const P = {
    o: "#141019", w: "#f5f5fa", a: "#c9d2e3", s: "#8a93ab", k: "#525a73",
    y: "#ffe680", Y: "#ffc62e", g: "#c98a16",
    b: "#a6e9ff", B: "#3fb2e8", d: "#1f7fb8",
    p: "#e0b3ff", P: "#a05fd6", u: "#6b34a8",
    r: "#ff9a7a", R: "#e8483a", x: "#a8281c",
    e: "#a6f06a", E: "#54c23a", n: "#2f7d28",
    h: "#ffd9a8", H: "#f0a060", m: "#c89050", M: "#7a4e22",
    c: "#2a2233", t: "#6bf0d0",
  };

  const I = {
    coin: ["....oooo....","..ooYYYYoo..",".oYyyYYYYgo.",".oYyYYgYYgo.","oYYYYgYYYYgo","oYYYYgYYYYgo","oYYYYgYYYYgo",".oYYYgYYYgo.",".oYYYYYYYgo.","..ogYYYYgo..","....oooo....","............"],
    gem: ["...oooooo...","..obbBBBBo..",".obBBBBBBdo.","oBBBBBBBBddo","oBBBBBBBBddo",".oBBBBBBddo.","..oBBBBddo..","...oBBddo...","....oddo....",".....oo.....","............","............"],
    soul: [".....o......","....opo.....","...oppPo....","..oppPPuo...",".oppPPPuuo..",".opPPPPPuo..",".opPPPPPuo..",".oupPPPuuo..","..ouuPuuo...","...ouuuo....","....ooo.....","............"],
    sword: ["........ooo.",".......oaso.","......oasoo.",".....oaso...","....oaso....","...oaso.....","..oaso......","o.oao.......","ooyo........",".oMMo.......","..ooo.......","............"],
    shield: [".oooooooo...",".oaSSSSSSo..",".oaSwSSSSo..",".oaSSkkSSo..",".oaSSkkSSo..",".oaSSSSSSo..","..oaSSSSo...","...oaSSo....","....oao.....",".....o......","............","............"],
    helmet: [".....RR.....","....rRRx....","...oxRRxo...","..oowwwwoo..",".owwaaaawwo.","owaaaaaaaawo","oakkkkkkkkao","oaaakkkkaaao",".oaakkkkaao.",".oaaakkaaao.","..oaaaaaao..","...oooooo..."],
    chestplate: ["...oooooo...","..owwwwwwo..","..oaaaaaao..","ooaawwwwaaoo","oaaaaaaaaaao","..oaaaaaao..",".oMMMMMMMMo.",".oMMgYYgMMo.","..oaaaaaao..","..oaaaaaao..","..oaaaaaao..","...oooooo..."],
    legs: ["..oooooooo..",".owwwwwwwwo.",".oassssssao.",".oaaaaaaaao.",".owao..oawo.",".owao..oawo.",".owao..oawo.",".oaao..oaao.",".oaao..oaao.",".okko..okko.",".oooo..oooo.","............"],
    boots: ["............","............","..oaaooaao..","..oaaooaao..","..oaaooaao..","..oaaooaao..",".oaaaooaaao.",".okkkookkko.",".oooooooooo.","............","............","............"],
    ring: [".....oo.....","....obbo....","....oBdo....","...o..o.....","..oaao......",".oassao.....",".oassso.....",".oassao.....",".oaaao......","..ooo.......","............","............"],
    heart: ["..oo..oo....",".oRRooRRo...","oRwRRRrRRo..","oRRRRRRRRo..","oRRRRRRRRo..",".oRRRRRRo...","..oRRRRo....","...oRRo.....","....oo......","............","............","............"],
    target: ["....oooo....","..ooRRRRoo..",".oRRwwwwRRo.",".oRw....wRo.","oRRw.RR.wRRo","oRw..RR..wRo","oRRw.RR.wRRo",".oRw....wRo.",".oRRwwwwRRo.","..ooRRRRoo..","....oooo....","............"],
    burst: ["....o.o.....","..o.RRR.o...","...oRYRo....",".o.RYYYR.o..","o.RYYwYYR.o.","..RYYYYYR...",".o.RYYYR.o..","...oRYRo....","..o.RRR.o...","....o.o.....","............","............"],
    bolt: [".....ooo....","....oYYo.....","...oYYo.....","..oYYo......",".oYYYYoo....","..oYYYYo....","...ooYYo....",".....oYo....","....oYo.....","...oo.......","............","............"],
    drop: [".....o......","....oRo.....","....oRo.....","...oRRRo....","..oRwRRo....",".oRRwRRRo...",".oRRRRRRo...",".oRRRRRo....","..oRRRo.....","...ooo......","............","............"],
    book: ["............",".oooooooooo.",".obbbboeeeo.",".obwbboeeeo.",".obbbboewe o","oobbbboeeeeo",".obbbboeeeeo",".obbbboeeeeo",".oooooooooo.","............","............","............"],
    bag: ["...oo..oo...","..o.oo.o....",".oMMMMMMMMo.",".oMMMMMMMMo.",".oMMMooMMMo.",".oMMMooMMMo.",".oMMMMMMMMo.",".oMMMMMMMMo.","..oooooooo..","............","............","............"],
    box: ["..oooooooo..",".oYYYYYYYYo.",".oYggggggYo.","oMMMMMMMMMMo","oMMMoooMMMMo","oMMMoYoMMMMo","oMMMoooMMMMo","oMMMMMMMMMMo","oMMMMMMMMMMo",".oooooooooo.","............","............"],
    cart: [".o..........",".ooooooooo..",".oRRRRRRRo..",".oRRRRRRRo..",".oRwwwwwRo..",".ooooooooo..","...o....o...","..oso..oso..","..oso..oso..","...o....o...","............","............"],
    paw: ["..oo..oo....",".oHHooHHo.oo",".oHHooHHooHH",".oHHooHHo.oo","............","..oHHHHHHo..",".oHHHHHHHHo.",".oHHHHHHHHo.","..oHHHHHHo..","...oooooo...","............","............"],
    dumbbell: ["............",".oo......oo.","oSSo.oo.oSSo","oSwooSSoowSo","oSSooSSooSSo","oSwo.oo.owSo",".oo......oo.","............","............","............","............","............"],
    star: [".....oo.....",".....yy.....","....oyyo....","ooooyyyyoooo",".oyYYYYYYyo.","..oYYYYYYo..","..oYYYYYYo..",".oYYyooyYYo.",".oyo....oyo.",".oo......oo.","............","............"],
    scroll: ["..oooooooo..",".omMMMMMMmo.",".oMwwwwwwMo.",".oMwMMMMwMo.",".oMwwwwwwMo.",".oMwMMMMwMo.",".oMwwwwwwMo.",".oMwwwwwwMo.",".omMMMMMMmo.","..oooooooo..","............","............"],
    gear: ["...o..o.....",".o.oSSo.o...",".oSSSSSSo...","ooSSwwSSoo..",".oSwooaSo...",".oSaooSwo...","ooSSwwSSoo..",".oSSSSSSo...",".o.oSSo.o...","...o..o.....","............","............"],
    skull: ["..oooooooo..",".owwwwwwwwo.",".owwwwwwwwo.",".owkkwwkkwo.",".owkkwwkkwo.",".owwwwwwwwo.",".owwwkkwwwo.",".oowwwwwwoo.","..owkwkwkwo.","..owwwwwwwo.","...oooooo...","............"],
    flag: [".o..........",".oRRRRRo....",".oRRRRRRo...",".oRwRRRo....",".oRRRRo.....",".oRRRRRo....",".o..........",".o..........",".o..........",".oo.........","............","............"],
    hammer: ["...ooooo....","..oSSSSSo...","..oSkkkSo...","..oSSSSSo...","....oMo.....","....oMo.....","....oMo.....","....oMo.....","....oMo.....","....ooo.....","............","............"],
    arrow: ["........ooo.",".......oYYo.","......oYYo..",".....oYo....","oo..oYo.....","oYYoYo......","oYYYo.......","oYYoYo......","oo..oYo.....",".....oYo....","......oo....","............"],
    dagger: [".......oo...","......oaso..",".....oaso...","....oaso....","...oaso.....","..oaso......",".oyao.......","oMMo........",".oo.........","............","............","............"],
    snow: ["....o.o.....",".o..oBo..o..","..o.oBo.o...","...oBBBo....","oooBBBBBooo.","...oBBBo....","..o.oBo.o...",".o..oBo..o..","....o.o.....","............","............","............"],
    person: ["....oooo....","...oHHHHo...","...oHhhHo...","...oHHHHo...","....oHHo....","..ooHHHHoo..",".oBBBBBBBBo.",".oBBBwwBBBo.",".oBBBBBBBBo.",".oBBooooBBo.",".oBo....oBo.","............"],
    heal: ["....oooo....","...oEEEEo...","...oEwwEo...","oooEEwwEEooo","oEwwwwwwwwEo","oEwwwwwwwwEo","oooEEwwEEooo","...oEwwEo...","...oEEEEo...","....oooo....","............","............"],
    angry: ["..oo....oo..",".oRRo..oRRo.","oRRRRooRRRRo",".oRRRRRRRo..",".oRwRRRwRo..",".oRRRRRRRo..",".oRRoooRRo..",".oRwwwwwRo..","..oRRRRRo...","...ooooo....","............","............"],
    axe: ["...ooooo....","..oRRRRRoo..",".oRRwRRRRo..",".oRRRRRRo...","..oRRRRo.M..","...oMMooM...","....oMMMo...",".....oMo....",".....oMo....",".....oo.....","............","............"],
    staff: ["....obbo....","...obBBbo...","...obBpbo...","...obBBbo...","....oMo.....","....oMo.....","....oMo.....","....oMo.....","....oMo.....","....ooo.....","............","............"],
    bow: ["...oo.......","..oEEo......",".oEEo.......",".oEo.o......",".oEo..o.....",".oEo..o.....",".oEo.o......",".oEEo.......","..oEEo......","...oo.......","............","............"],
    plus: ["....oooo....","...oeeeeo...","oooeeeeeeooo","oeeeeeeeeeeo","oeeeeeeeeeeo","oooeeeeeeooo","...oeeeeo...","...oeeeeo...","....oooo....","............","............","............"],
    goddess: ["....oYYo....","....owwo....","....owwo....","..ooYYYYoo..",".oYwwwwwwYo.",".oYwwwwwwYo.","..ooYYYYoo..","....owwo....","....owwo....","....owwo....","....oYYo....","....oooo...."],
    lock: ["............","...oooo.....","..o.aa.o....","..o.aa.o....",".oooooooo...",".oYYYYYYo...",".oYYooYYo...",".oYYooYYo...",".oYYYYYYo...",".oooooooo...","............","............"],
    weapons: ["................","................",".......ww.HHM...","..bB...wa..gHM..","..BbH..wa..aHM..","....MH.Ba..aHHM.",".....MHwa..a.HM.","......Mwa..a.HM.","......Mwa..a.HM.",".....gYYYg.a.HM.",".......MHH.a.HM.",".......MHMHaHHM.",".......MH.gaHM..",".......YY..gHM..","..........HHM...","................"],
    // ===== 掉落素材形狀（可染色：o 外框 + M深/m中/w亮）=====
    slimeball: ["............","....oooo....","...ommmmo...","..ommwwmmo..","..ommwmmmo..",".ommmmmmmmo.",".ommmmmmmmo.",".oMmmmmmmMo.","..oMmmmmMo..","..oMMmmMMo..","...oMMMMo...","....oooo...."],
    crystal: ["............","....oo......","...owwo.....","..omwmmo....",".ommwmmmo...","ommmwmmmMo..",".oMmwmmMo...","..oMwmMo....","...oMmMo....","....oMo.....",".....o......","............"],
    droplet: [".....o......",".....o......","....omo.....","....omo.....","...ommwo....","...ommwo....","..ommwmo....","..ommmmo....","..oMmmmo....","...oMmMo....","....ooo.....","............"],
    leaf: ["............","........oo..",".......omMo.","......ommMo.",".....ommwo..","....ommwmo..","...ommwmmo..","..ommwmmo...",".ommwmmo....",".oMwmmo.....","..oMmo......","...oo......."],
    flower: ["............","....oo......","...oMMo.oo..","..oMmmMoMMo.","..oMmwmmmMo.",".oMmmwYwmmMo",".oMmmwmmmMo.","..oMmmmmMo..","...oMmmMo...","....oMMo....",".....oo.....","............"],
    seed: ["............",".....o......","....oEo.....","....oEo.....","...omMo.....","..ommwo.....","..ommwo.....","..oMmmo.....","..oMmmo.....","...oMo......","............","............"],
    mushcap: ["............","...oooo.....","..omwwmo....",".ommwmmmo...","ommmmmmmmo..","oMmmwmmmMo..",".oMMMMMMo...","...oaao.....","...oaao.....","...oaao.....","...oooo.....","............"],
    fang: ["............","...oo.......","..owwo......","..omwo......","..ommo......","..ommo......","..oMmo......","...oMmo.....","...oMmo.....","....oMo.....",".....oo.....","............"],
    horn: ["..........o.",".........oMo","........oMmo",".......oMmwo","......oMmwo.",".....oMmwo..","....oMmmo...","...oMmmo....","..oMmmo.....",".oMmmo......",".oMMo.......","..oo........"],
    claw: ["............",".o..o..o....",".oM.oM.oM...",".om.om.om...",".om.om.om...",".omoomoom...",".ommmmmmo...",".ommwmmmo...",".oMmmmmMo...","..oMmmMo....","...oMMo.....","....oo......"],
    bark: [".oooooooo...",".omwmmmmo...",".ommMmmmo...",".ommmMmmo...",".oMmmmmwo...",".ommMmmmo...",".ommmmMmo...",".oMwmmmmo...",".ommmMmmo...",".ommmmmwo...",".oooooooo...","............"],
    scale: ["............","...oooo.....","..ommmmo....",".ommwmmmo...",".ommmmmmo...","ommmmmmmmo..","oMmmmmmmMo..",".oMmmmmMo...","..oMooMo....","...o..o.....","............","............"],
    feather: [".........o..","........oMo.",".......oMwo.","......oMmwo.",".....oMmwo..","....oMmwo...","...oMmwmo...","..oMmwmo....",".oMmwmo.....",".omwmo......","..oMo.......","...o........"],
    fur: ["............","..o.o.o.o...",".oMoMoMoMo..",".ommmmmmmo..","ommwmmmmmmo.","ommmmmwmmmo.","oMmmmmmmmMo.",".oMmmmmmMo..","..oMmmmMo...","...oMoMo....","....o.o.....","............"],
    rock: ["............","....ooo.....","...ommmoo...","..ommwmmmo..",".ommwmmmmmo.",".ommmmmmmmo.","ommmmmmMmMo.","oMmmmMmmMmo.","oMMmMMMmMMo.",".oMMMMMMMo..","..ooooooo...","............"],
    shell: ["............",".....oo.....","....ommo....","...ommmmo...","..ommwmmmo..",".ommwmmmmmo.",".omwmMmMmmo.","ommmMmMmMmo.","oMmMmMmMmMo.",".oMMMMMMMo..","..ooooooo...","............"],
    orb: ["............","....oooo....","..oommmmoo..",".ommwwmmmmo.",".omwwmmmmmo.","ommwmmmmmmmo","ommmmmmmmmmo","oMmmmmmmmmMo",".oMmmmmmmMo.","..oMMmmMMo..","...oooooo...","............"],
    eye: ["............","....oooo....","..oommmmoo..",".ommmmmmmmo.",".ommcccmmmo.","ommmcwcmmmmo","ommmcccmmmmo","oMmmmmmmmmMo",".oMmmmmmmMo.","..oMMmmMMo..","...oooooo...","............"],
    tentacle: ["....oooo....","...ommmmo...","..ommwmmmo..","..ommmmmMo..","...oMmmMo...","....oMmo....","...ommMo....","..oMmwo.....","..omMo......","...omMo.....","....oMo.....",".....o......"],
    rune: ["............",".oooooooo...",".ommmmmmo...",".omwYYwmo...",".ommYmmmo...",".ommYYmmo...",".ommYmmmo...",".omwYYwmo...",".ommmmmmo...",".oMMMMMMo...",".oooooooo...","............"],
    crown: ["............","............",".o..o..o....","oMo.M.oMMo..","oMooMooMMo..","oMmoMomMmo..","ommYmmYmmo..","ommmmmmmmo..","oMmmmmmmMo..","oMMMMMMMMo..","oooooooooo..","............"],
    // ===== 固定色素材形狀 =====
    web: ["............",".....a......","....aaa.....","...a.a.a....","..a..a..a...",".aaaaaaaaa..","..a..a..a...","...a.a.a....","....aaa.....",".....a......","............","............"],
    bandage: ["............","..oooooo....",".oaaaaaao...",".oahaahao...",".oahaahao...",".oaaaaaao...",".oahaahao...",".oahaahao...",".oaaaaaao...","..oooooo....","............","............"],
    ember: ["............","............","....rr......","...rRRr.....","..rRYYRr....","..rRYYRr....","..rRRRRr....","...rRRr.....","....rr......","............","............","............"],
    ash: ["............","............","............",".....s......","....sks.....","...sksks....","..skssksk...",".skssksskk..",".sksskskss..",".kssksskks..","............","............"],
    cloud_wisp: ["............","............","....www.....","..wwwwwww...",".wwwawwwww..","wwwwwwwwwww.",".wwwwwwwww..","..wwwwww....","............","............","............","............"],
    sand: ["............","............","............",".....H......","....HhH.....","...HhHhH....","..hHhHhHh...",".HhHhHhHhH..",".hHhHhHhHh..",".HhgHhHghH..","............","............"],
  };

  // 卷軸分色變體：4-6 星藍色調、7-9 星紫色調、10 星紅色調（整體換調）
  (function () {
    const recolor = (map) => I.scroll.map((row) => row.replace(/[mMw]/g, (ch) => map[ch] || ch));
    I.scroll_b = recolor({ m: "B", M: "d", w: "b" }); // 藍
    I.scroll_p = recolor({ m: "P", M: "u", w: "p" }); // 紫
    I.scroll_r = recolor({ m: "R", M: "x", w: "r" }); // 紅
  })();

  // 別名（多個用途共用一個圖示）
  const ALIAS = {
    atk: "sword", weapon: "weapons", might: "sword", slash: "sword", p_atk: "sword", killAch: "sword",
    def: "shield", armor: "chestplate", guard: "shield",
    maxHp: "heart", hp: "heart", vigor: "heart", p_hp: "heart",
    crit: "target", focus: "target", precision: "target",
    critDmg: "burst", ferocity: "burst", fireball: "burst",
    spd: "bolt", bless: "bolt",
    ls: "drop", lifesteal: "drop",
    dodge: "boots",
    gold: "coin", fortune: "coin", p_gold: "coin", goldMul: "coin",
    xp: "book", wisdom: "book",
    p_drop: "box", gemMul: "gem",
    rally: "flag", multishot: "arrow", backstab: "dagger", frost: "snow",
    rage: "angry", trinket: "ring", heroes: "person",
    knight: "sword", mage: "staff", archer: "bow", priest: "plus", rogue: "dagger", berserker: "axe",
    boss: "skull", prestige: "soul", quests: "scroll", settings: "gear",
    pets: "paw", training: "dumbbell", talents: "star", bagtab: "bag", gacha: "box", shop: "cart",
  };

  const urlCache = {};
  const spriteCache = new Map();

  function render(rows, pal, outline) {
    try {
      if (typeof document === "undefined" || !document.createElement) return "";
      let w = 0; rows.forEach((r) => (w = Math.max(w, r.length)));
      const h = rows.length;
      const pad = outline ? 1 : 0;
      const cv = document.createElement("canvas");
      cv.width = w + pad * 2; cv.height = h + pad * 2;
      const ctx = cv.getContext("2d");
      if (!ctx) return "";
      const filled = [];
      for (let y = 0; y < h; y++) {
        filled[y] = [];
        const line = rows[y];
        for (let x = 0; x < w; x++) {
          const ch = x < line.length ? line[x] : ".";
          filled[y][x] = !(ch === "." || ch === " ");
        }
      }
      if (outline) {
        ctx.fillStyle = "#0d0a14";
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (filled[y][x]) continue;
            if ((y > 0 && filled[y - 1][x]) || (y < h - 1 && filled[y + 1][x]) ||
                (x > 0 && filled[y][x - 1]) || (x < w - 1 && filled[y][x + 1]))
              ctx.fillRect(x + pad, y + pad, 1, 1);
          }
      }
      for (let y = 0; y < h; y++) {
        const line = rows[y];
        for (let x = 0; x < w; x++) {
          if (!filled[y][x]) continue;
          const c = pal[line[x]];
          if (!c) continue;
          ctx.fillStyle = c; ctx.fillRect(x + pad, y + pad, 1, 1);
        }
      }
      return cv.toDataURL ? cv.toDataURL() : "";
    } catch (e) { return ""; }
  }

  // ── 素材染色：由單一 hex 推導 暗/中/亮 三階，覆蓋可染色形狀的 M/m/w ──
  const tintCache = {}; // key = shape + "@" + hex → dataURL
  function shade(hex, f) { // f<1 變暗、f>1 變亮
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f <= 1) { r *= f; g *= f; b *= f; }
    else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return "#" + ((cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).padStart(6, "0");
  }
  function tintedURL(shape, hex) {
    const key = shape + "@" + hex;
    if (tintCache[key] !== undefined) return tintCache[key];
    const def = I[ALIAS[shape] || shape];
    if (!def) return (tintCache[key] = "");
    const merged = Object.assign({}, P, { M: shade(hex, 0.5), m: hex, w: shade(hex, 1.5) });
    return (tintCache[key] = render(def, merged, true));
  }
  function tinted(shape, hex, px) {
    px = px || 16;
    return `<img class="ico" src="${tintedURL(shape, hex)}" width="${px}" height="${px}" alt="" draggable="false">`;
  }

  function url(name) {
    name = ALIAS[name] || name;
    if (urlCache[name] !== undefined) return urlCache[name];
    const def = I[name];
    return (urlCache[name] = def ? render(def, P) : "");
  }
  function html(name, px) {
    px = px || 16;
    const u = url(name);
    return `<img class="ico" src="${u}" width="${px}" height="${px}" alt="" draggable="false">`;
  }
  function spriteURL(arr) {
    if (!arr) return "";
    if (spriteCache.has(arr)) return spriteCache.get(arr);
    const u = render(arr, Game.Data.PALETTE, true);
    spriteCache.set(arr, u);
    return u;
  }
  function spriteHtml(arr, px) {
    px = px || 28;
    const u = spriteURL(arr);
    return `<img class="ico spr" src="${u}" height="${px}" alt="" draggable="false">`;
  }

  Game.Icons = { url, html, tinted, tintedURL, spriteURL, spriteHtml, _defs: I };
})();
