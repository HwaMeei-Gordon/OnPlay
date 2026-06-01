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
    weapons: ["................","................",".......ww.HHM...","..bB...wa..gHM..","..BbH..wa..aHM..","....MH.Ba..aHHM.",".....MHwa..a.HM.","......Mwa..a.HM.","......Mwa..a.HM.",".....gYYYg.a.HM.",".......MHH.a.HM.",".......MHMHaHHM.",".......MH.gaHM..",".......YY..gHM..","..........HHM...","................"],
  };

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

  Game.Icons = { url, html, spriteURL, spriteHtml, _defs: I };
})();
