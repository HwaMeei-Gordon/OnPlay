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
  const SLIME = ["....SGGS....","..SGGGGGGS..",".GGGGGGGGGG.",".GGGGGGGGGG.",".GWWGGGGWWG.",".GWeGGGGWeG.","GGGGGGGGGGGG","9GGGGGGGGGG9","9GGGGGGGGGG9",".99DDDDDD99."];
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
  const B_SLIME = ["....................",".....yy.yy.yy.......",".....yyyyyyyy.......","....GGGGGGGGGG......","...GGGGGGGGGGGG.....","..GGGGGGGGGGGGGG....",".GGGGGGGGGGGGGGGG...",".GGWWGGGGGGGGWWGG...",".GGWWGGGGGGGGWWGG...",".GGeeGGGGGGGGeeGG...","GGGGGGGGGGGGGGGGGG..","GGGGGGGGGGGGGGGGGG..","GGGGGGGGGGGGGGGGGG..",".DDDDDDDDDDDDDDDD...","..DDDDDDDDDDDDDD...."];
  const B_SPIDER = ["1...1......1...1....",".1..1......1..1.....","..2222222222........",".22222222222........","222q22222q222.......",".22222222222........","..2222222222........","...22222222.........","1...1......1...1....",".1..1......1..1....."];
  const B_SCORPION = ["..............NN....","N............NNNN...","NN..nnnnnnn..NN.....",".nnnnnnnnnnnnN......","nnnnnnnnnnnnnn......","nnnnnnnnnnnnn.......",".nnnnnnnnnnn........","nn..nnnnn..nn.......",".n...n.n...n........"];
  const B_ICE = ["....IIIIII........","...IIIIIIII.......","..IIiiiiiiII......","..Iieiiieiii......","..Iiiiiiiii.......","...Iiiiiii........","..IIIIIIIIII......",".IIiiiiiiiiII.....",".Iiiiiiiiiiii.....",".Iiiiiiiiiiii.....",".IIiiiiiiiiII.....","..III....III......",".III......III....."];
  const B_FLAME = ["...r......r......","..rr.r..r.rr.....","..rfrffffrfr.....",".rfYffffffYfr....",".rfYqffffqYfr....",".rfYYffffYYfr....",".rffYYYYYYffr....","..rffYYYYffr.....","..rrffYYffrr.....","...rrffffrr......","..rr.rffr.rr.....",".rr...rr...rr...."];
  const B_KRAKEN = ["...cccccc.......","..cccccccc......",".ccqcccccqcc....",".cccccccccc.....",".cCcccccccC.....","..cccccccc......",".c.c.c.c.c.c....","c.c.c.c.c.c.c...",".c.c.c.c.c.c....","c..c..c..c..c..."];
  const B_HARPY = ["........l.......",".......lww......","w....wwwwww....w","ww..wwwwwwww..ww",".wwwwwwwwwwwwww.",".wwwwwwwwwwwwww.","..wwwwwwwwwwww..","...wwwwwwwwww...","....ww....ww....","....l......l...."];
  const B_COLOSSUS = ["..555555555.....",".55555555555....",".5q5555555q5....",".55555555555....","556666666655....",".55555555555....",".5555555555.....","5555555555555...","55.555555.55....","55.5555.5.55....","5..55..55..5...."];
  const B_DEMON = [".K..............K..",".KK....rrrr....KK..","..rrrrrrrrrrrrrr...","..rqRrrrrrrrRqr...","..rrrrrffrrrrrr...","..rrrrffffrrrrr...","..RrrrrrrrrrrrrR..","..RRrraaaaaarrRR..","...RrrrrrrrrrR....","..rrrr.rr.rrrr....",".RRR..RRRR..RRR..."];
  const B_LORD = ["..8..........8....",".888...ff...888...","..7rrffffrr7......","..7rqffffqr7......","..7rffffffr7......","..77rffffr77......",".87rrffffrr78.....",".877rrffrr778.....","..77rr..rr77......",".77..7..7..77....."];
  const THEMED_BOSS = [B_SLIME, B_SPIDER, B_SCORPION, B_ICE, B_FLAME, B_KRAKEN, B_HARPY, B_COLOSSUS, B_DEMON, B_LORD];

  const B_OGRE = ["....oooooo....","...oooooooo...","..ooWooooWoo..","..ooeooooeoo..","..oooooooooo..","...oOOOOOOo...","..oooooooooo..",".oOoooooooOo..",".oOoooooooOo..","..oooooooo....","..oo....oo....","..OO....OO...."];
  const B_GOLEM = ["..5555555...",".55555555...",".5q5555q5...",".55555555...","5566666655..",".55555555...",".555555.....","55555555....","55.5555.....","5..55..5...."];
  const B_WRAITH = ["...77777....","..7777777...",".77q777q7...",".7777777....",".7777777....",".87777778...",".7777777....","..7.7.7.....",".7.....7...."];
  const GENERIC_BOSS = [B_OGRE, B_GOLEM, B_WRAITH];

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
    THEMED_SMALL, THEMED_BOSS, GENERIC_SMALL, GENERIC_BOSS,
  };
})();
