/* ============================================================
 * sprites.js — 英雄 / 敵人 / 魔王 / 寵物 點陣圖（馬賽克）
 * 英雄面向右；小怪面向右（render 翻轉成面向左）；魔王畫正面。
 * drawSprite 容忍不等寬列（缺字視為透明）。
 * 全域命名空間：window.Game.Sprites
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});

  // ===== 英雄 =====
  const HEROES = {
    knight: [
      "......hhhh......", ".....hhhhhh.....", "....hhhhhhhh....", "....hssssssh....",
      "....sHesseHs....", "....ssssssss....", ".....sHHHHs.....", "....bbbbbbbb....",
      "...bbbbbbbbbb...", "...bsbbbbbbsb...", "...bbbbbbbbbb...", "...bpbbbbbbpb...",
      "....bbbbbbbb....", "....pp..pp......", "....pp..pp......", "....kk..kk......",
    ],
    mage: [
      ".......PP.......", "......PPPP......", ".....PPPPPP.....", "....PPPPPPPP....",
      "....ssssssss....", "....sHesseHs....", ".....ssssss.....", "....PPPPPPPP....",
      "...PPPPPPPPPP...", "...PsPPPPPPsP...", "...PPPPPPPPPP...", "...PQPPPPPPQP...",
      "...PPPPPPPPPP...", "..PPPPPPPPPPPP..", "..QQQQQQQQQQQQ..", "................",
    ],
    archer: [
      "......hhhh......", ".....hhhhhh.....", "....hhhhhhhh....", "....hssssssh....",
      "....sHesseHs....", "....ssssssss....", ".....sHHHHs.....", "....AAAAAAAA....",
      "...AAAAAAAAAA...", "...AsAAAAAAsA...", "...AAAAAAAAAA...", "...AEAAAAAAEA...",
      "....AAAAAAAA....", "....EE..EE......", "....EE..EE......", "....kk..kk......",
    ],
    priest: [
      "......FFFF......", ".....FFFFFF.....", "....FFFFFFFF....", "....FssssssF....",
      "....sHesseHs....", "....ssssssss....", ".....sHHHHs.....", "....FFFFFFFF....",
      "...FFFFFFFFFF...", "...FsFFFFFFsF...", "...FFFFFFFFFF...", "...FLFFFFFFLF...",
      "...FFFFFFFFFF...", "..FFFFFFFFFFFF..", "..LLLLLLLLLLLL..", "................",
    ],
    rogue: [
      "......kkkk......", ".....kkkkkk.....", "....kkkkkkkk....", "....kkkkkkkk....",
      "....kqkkkkqk....", "....kssssssk....", ".....ssssss.....", "....dddddddd....",
      "...dddddddddd...", "...dsddddddsd...", "...dddddddddd...", "...dkddddddkd...",
      "....dddddddd....", "....kk..kk......", "....kk..kk......", "....kk..kk......",
    ],
    berserker: [
      "....h.hhhh.h....", "....hhhhhhhh....", "...hhhhhhhhhh...", "....hssssssh....",
      "....sHesseHs....", "....ssssssss....", ".....sHHHHs.....", "....xxxxxxxx....",
      "...xxxxxxxxxx...", "...xsxxxxxxsx...", "...xxxxxxxxxx...", "...xXxxxxxxXx...",
      "....xxxxxxxx....", "....XX..XX......", "....XX..XX......", "....kk..kk......",
    ],
  };

  // ===== 寵物 =====
  const PETS = {
    p_slime: [
      "..........", "...GGGG...", "..GGGGGG..", ".GWGGGWG..",
      ".GGGGGGG..", "GGGGGGGGG.", ".DDDDDDD..",
    ],
    p_wolf: [
      "..........", ".5......5.", ".55....55.", ".5555555..",
      "55W5555W5.", ".5555555..", ".5.5.5.5..",
    ],
    p_owl: [
      "..........", "..hhhh....", ".hWhhWh...", ".hhllhh...",
      ".hhhhhh...", ".hhhhhh...", "..h..h....",
    ],
    p_drake: [
      "..........", "....ttt...", "...tttttt.", "..tWtttt..",
      ".AtttttA..", "..ttttt...", "..t...t...",
    ],
  };

  // ===== 小怪（themed 10 + 通用 4）=====
  const SLIME = ["....SGGS....","..SGGGGGGS..",".SGGGGGGGGG.",".GGGGGGGGGG.","GGGGGGGGGGGG","GGWWGGGGWWGG","GGWKGGGGWKGG","GGGGGGGGGGGG","GGGGGGGGGGGG","DGGGGGGGGGGD",".DD999999DD."];
  const SPIDER = ["1.1......1.1",".11......11.","..PP2222PP..",".2222222222.",".2q2222q22..",".2211112222.","..22222222..",".11......11.","1.1......1.1"];
  const SCORPION = [".........NN.",".u......NNn.","un.unnnnnN..",".unnnnnnnN..","unnnnnnnnn..",".unnnnnn....","nn.nnnn.nn..",".n......n..."];
  const SNOWMAN = ["....ii......","...iWWi.....","..iieeii....","..iillii....","..iiiiii....","...iIIi.....","..iiiiii....",".iiiieiii...",".iIiiiiiI...",".iiiieiii...","..iIiiii...."];
  const FIRE = ["....r..r....","...rf..fr...","..rfYffYfr..","..rfYqqYfr..","..rfYYYYfr..","..rffYYffr..","...rfYYfr...","...rffffr...","..rr.rr.rr.."];
  const JELLY = ["...jjjjjj...","..jjjjjjjj..",".jjjjjjjjjj.",".jJjjjjjjJj.",".jjjjjjjjjj.","..jjjjjjjj..","..c.c.c.c.c.",".c.c.c.c.c..","..c.c.c.c.c."];
  const BIRD = [".......l....","......lWw...","...wWwwww...","..wwwwwwww..",".ww.wwww.ww.","w....ww....w",".....ww.....","....5..5...."];
  const SKELETON = ["...aaaa.....","..aaaaaa....","..aeaaea....","..aaaaaa....","...aWWa.....","..a.aa.a....",".aa.aa.aa...","..a.aa.a....","..a.aa.a...."];
  const IMP = ["..K....K....","..KrrrrK....","..frrrrf....","..rqrrqr....","..rrrrrr....","...rRRr.....","..rRrrRr....",".rr.rr.rr...","..r....r...."];
  const SHADOW = ["...8888.....","..888888....",".88q88q88...",".88888888...",".87777778...",".77777777...",".v777777v...","..7.77.7....",".7..77..7.."];
  const BAT = ["................",".VV........VV...","VvvV..2222..VvvV","Vvvvv222222vvvvV",".vvv2WvvvvW2vvv.","..vvveVVeevvv...","...vvvvvvvv.....","....v.v..v.v...."];
  const GHOST = ["...wwww.....","..wTwwww....",".wTwwwwww...",".wwwwwwww...",".weewweew...",".wwwwwwww...",".wwwwwwww...",".w.ww.ww.w.."];
  const RAT = ["............","..55........",".5005...6...","550555..66..",".55555.6....",".5.5.5.5....","............"];
  const WISP = ["...yy.....","..ySSy....",".yvSSvy...",".yvSSvy...",".yvvvvy...","..yvvy....","...yy....."];

  const THEMED_SMALL = [SLIME, SPIDER, SCORPION, SNOWMAN, FIRE, JELLY, BIRD, SKELETON, IMP, SHADOW];
  const GENERIC_SMALL = [BAT, GHOST, RAT, WISP];

  // ===== 魔王（themed 10 + 通用 3）=====
  const B_SLIME = [".....yy.yy.yy.....","....yYYyYYyYY.....","...SSGGGGGGSS.....","..SGGGGGGGGGGS....",".SGGGGGGGGGGGGS...",".GGGGGGGGGGGGGG...","GGGGGGGGGGGGGGGG..","GGWWGGGGGGGGWWGG..","GGWKGGGGGGGGWKGG..","GGGGGGGGGGGGGGGG..","GGGGGGGGGGGGGGGG..","GGGGGGGGGGGGGGGG..","DGGGGGGGGGGGGGGD..",".DD99999999999D...","..DDDDDDDDDDDD...."];
  const B_SPIDER = ["1...1......1...1....",".1..1......1..1.....","..PP2222222PP.......",".222222222222.......","22q2222222q22.......",".2221111112222......","..222222222222......","...2222222222.......","1...1......1...1....",".1..1......1..1....."];
  const B_SCORPION = ["..............NN....","N...........uNNN....","NN..unnnnnu..NN.....",".unnnnnnnnnnnN......","unnnnnnnnnnnnn......",".unnnnnnnnnnn.......",".nnnnnnnnnnn........","nn..nnnnn..nn.......",".n...n.n...n........"];
  const B_ICE = ["....IIIIII........","...IIIIIIII.......","..IIiiiiiiII......","..Iieiiieiii......","..Iiiiiiiii.......","...Iiiiiii........","..IIIIIIIIII......",".IIiiiiiiiiII.....",".Iiiiiiiiiiii.....",".Iiiiiiiiiiii.....",".IIiiiiiiiiII.....","..III....III......",".III......III....."];
  const B_FLAME = ["...r......r......","..rr.r..r.rr.....","..rfrffffrfr.....",".rfYffffffYfr....",".rfYqffffqYfr....",".rfYYffffYYfr....",".rffYYYYYYffr....","..rffYYYYffr.....","..rrffYYffrr.....","...rrffffrr......","..rr.rffr.rr.....",".rr...rr...rr...."];
  const B_KRAKEN = ["...cccccc.......","..cccccccc......",".ccqcccccqcc....",".cccccccccc.....",".cCcccccccC.....","..cccccccc......",".c.c.c.c.c.c....","c.c.c.c.c.c.c...",".c.c.c.c.c.c....","c..c..c..c..c..."];
  const B_HARPY = ["........l.......",".......lWw......","w....WWwwWW....w","ww..wWwwwwWw..ww",".wWwwwwwwwwwwWw.",".ww5wwwwwwww5ww.","..wwwwwwwwwwww..","...5wwwwwwww5...","....ww....ww....","....l......l...."];
  const B_COLOSSUS = ["..555555555.....",".55555555555....",".5q5555555q5....",".55555555555....","556666666655....",".55555555555....",".5555555555.....","5555555555555...","55.555555.55....","55.5555.5.55....","5..55..55..5...."];
  const B_DEMON = [".K..............K..",".KK....rrrr....KK..","..rrrrrrrrrrrrrr...","..rqRrrrrrrrRqr...","..rrrrrffrrrrrr...","..rrrrffffrrrrr...","..RrrrrrrrrrrrrR..","..RRrraaaaaarrRR..","...RrrrrrrrrrR....","..rrrr.rr.rrrr....",".RRR..RRRR..RRR..."];
  const B_LORD = ["..8..........8....",".888...ff...888...","..7rrffffrr7......","..7rqffffqr7......","..7rffffffr7......","..77rffffr77......",".87rrffffrr78.....",".877rrffrr778.....","..77rr..rr77......",".77..7..7..77....."];
  const THEMED_BOSS = [B_SLIME, B_SPIDER, B_SCORPION, B_ICE, B_FLAME, B_KRAKEN, B_HARPY, B_COLOSSUS, B_DEMON, B_LORD];

  const B_OGRE = ["....oooooo....","...oooooooo...","..ooWooooWoo..","..ooeooooeoo..","..oooooooooo..","...oOOOOOOo...","..oooooooooo..",".oOoooooooOo..",".oOoooooooOo..","..oooooooo....","..oo....oo....","..OO....OO...."];
  const B_GOLEM = ["..5555555...",".55555555...",".5q5555q5...",".55555555...","5566666655..",".55555555...",".555555.....","55555555....","55.5555.....","5..55..5...."];
  const B_WRAITH = ["...77777....","..7777777...",".77q777q7...",".7777777....",".7777777....",".87777778...",".7777777....","..7.7.7.....",".7.....7...."];
  const GENERIC_BOSS = [B_OGRE, B_GOLEM, B_WRAITH];

  // ===== 各區在地化小怪（名冊用，逐區獨特、避免重複）=====
  const M_BEE = ["..w.....w...",".www...www..","..wW...Ww...","..yyKyKyy...",".yKyyyyyKy..",".yyKyyyKyy..","..yyKyKyy...","...yyyyy....","....KK......"]; // 草原 野蜂
  const M_RABBIT = [".h......h...",".hh....hh...",".hjh..hjh...",".hHh..hHh...","..hHHHHh....","..HHHHHH....",".HHWKHWKH...",".HHHHHHHH...","..HHjHHH....","..hHHHHh....","..hh..hh...."]; // 草原 野兔
  const M_MUSHROOM = ["...rrrr.....","..rqqqqr....",".rqWqqWqr...",".rqqqqqqr...","rqqWqqqWqr..","rqqqqqqqqr..",".rrrrrrrr...","..aaaaaa....","..aKaaKa....","..aaaaaa....","...a..a....."]; // 草原 蘑菇怪
  const M_FLOWERSP = ["...j.j.....","..jJjJj....",".jJYWYJj...",".jJWYWJj...",".jJYYYJj...","..jJjJj....","...GDG.....","..GGDGG....","..oGDGo....","...GDG.....","..D...D...."]; // 草原 花精靈
  const M_GRASSWOLF = ["6..........6","66........66","6D6......6D6",".6DDDDDDDD6.",".DDDDDDDDDD.","DDWKDDDDKWDD","DDDDDDDDDDDD",".DDDhhhhDDD.",".DDhWWWWhDD.","..9hhhhhh9..","...K....K..."]; // 草原 草狼
  const M_MANEATER = ["..rrrr..", ".rqqqqr.", ".rqWWqr.", ".rqqqqr.", "..rGGr..", "...GG...", "..GGGG.."]; // 森林 食人花
  const M_SANDWORM = ["...nn...", "..nuun..", "..nKKn..", "..nuun..", ".nnuunn.", "nnuuuunn", "n.nuun.n"]; // 沙漠 沙蟲
  const M_ICEWISP = ["...i....", "..iIi...", ".iIWIi..", ".iIIIi..", ".iIWIi..", "..iIi...", "...i...."];   // 雪地 冰靈
  const M_MAGMA = ["..ffff..", ".fqRqf..", ".fRYRf..", "ffRRRff.", "fqRYRqf.", ".fRRRf..", "..fqf..."];     // 熔岩 熔岩獸
  const M_OCTO = ["..cccc..", ".cCWWCc.", ".cCccCc.", ".cccccc.", ".c.c.c.c", "c.c.c.c.", ".c...c.."];     // 深海 章魚
  const M_CLOUDLET = ["..wwww..", ".wwwwww.", "wwTwwTww", "wwwwwwww", ".wwwwww.", "..w..w..", ".w....w."];  // 天空 雲精
  const M_GARGOYLE = ["5.5..5.5", "55q55q55", ".555555.", "5.5555.5", "55.55.55", ".5.55.5.", "..5..5.."]; // 遺跡 石像鬼
  const M_DARKBAT = ["v......v", "vv.vv.vv", "vV2qq2Vv", "vv2222vv", ".v2222v.", "..vVVv..", "...vv..."];   // 魔王城 暗影蝠
  const M_WRAITHLING = ["..788...", ".78887..", ".7qWq7..", ".788887.", ".788887.", "..7887..", ".7.7.7.."]; // 深層 怨靈
  const MONSTER_SPRITES = {
    bee: M_BEE, maneater: M_MANEATER, sandworm: M_SANDWORM, icewisp: M_ICEWISP, magma: M_MAGMA,
    octo: M_OCTO, cloudlet: M_CLOUDLET, gargoyle: M_GARGOYLE, darkbat: M_DARKBAT, wraithling: M_WRAITHLING,
    rabbit: M_RABBIT, mushroom: M_MUSHROOM, flowersp: M_FLOWERSP, grasswolf: M_GRASSWOLF,
  };
  const SPRITE_GROUPS = { themedSmall: THEMED_SMALL, genericSmall: GENERIC_SMALL, themedBoss: THEMED_BOSS, genericBoss: GENERIC_BOSS };
  // 以字串 key 取精靈陣列："group:index"（既有圖）或命名鍵（新圖）
  function byKey(key) {
    if (!key) return null;
    if (key.indexOf(":") >= 0) { const p = key.split(":"); const arr = SPRITE_GROUPS[p[0]]; return arr ? arr[+p[1]] : null; }
    return MONSTER_SPRITES[key] || null;
  }

  function smallForRegion(r) {
    return [THEMED_SMALL[r], GENERIC_SMALL[r % GENERIC_SMALL.length], GENERIC_SMALL[(r + 2) % GENERIC_SMALL.length]];
  }
  function bossForRegion(r) {
    return [THEMED_BOSS[r], GENERIC_BOSS[r % GENERIC_BOSS.length], GENERIC_BOSS[(r + 1) % GENERIC_BOSS.length]];
  }

  Game.Sprites = {
    heroes: HEROES,
    pets: PETS,
    smallForRegion,
    bossForRegion,
    byKey,
    THEMED_SMALL, THEMED_BOSS, GENERIC_SMALL, GENERIC_BOSS, MONSTER_SPRITES,
  };
})();
