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
      "....hhhh......", "...hhhhhh.....", "..hsssssh.....", "..hsesesh.....",
      "..hssssshg....", "...sssss.gg...", "..bbbbbb..g...", ".bpbbbbpb.g...",
      ".bpbbbbpb.g...", ".bbbbbbbb.....", "..bb..bb......", "..ss..ss......",
      "..ss..ss......", "..KK..KK......", ".KKK..KKK.....",
    ],
    mage: [
      "....P.........", "...PPP........", "..PPPPP.......", "...sss....y...",
      "..ssess..yYy..", "..sssss...y...", "..PPPPP...g...", ".PPPPPPP..g...",
      ".PPPPPPP..g...", ".PPQPPQP..g...", ".PPPPPPP......", ".PPPPPPP......",
      ".QPPPPPQ......", "..PP..PP......", "..KK..KK......",
    ],
    archer: [
      "....hhhh......", "...hhhhhh.....", "..hsssssh.....", "..hsesesh..A..",
      "..hsssssh.A.A.", "...sss...A...A", "..AAAAA..A...A", ".AEAAAEA.A...A",
      ".AEAAAEA..A.A.", ".AAAAAA...A...", "..AA.AA.......", "..ss.ss.......",
      "..ss.ss.......", "..KK.KK.......", ".KKK.KKK......",
    ],
    priest: [
      "...yyyy.......", "..y....y......", "...ssss.......", "..ssesess.....",
      "..ssssss......", "...ssss....g..", "..FFFFFF...g..", ".FLFFFFLF..g..",
      ".FFFFFFFF..g..", ".FFFFFFFF.....", ".FLFFFFLF.....", ".FFFFFFFF.....",
      ".LFFFFFFL.....", "..FF..FF......", "..KK..KK......",
    ],
    rogue: [
      "...kkkk.......", "..kkkkkk......", "..kqkkqk......", "..kkkkkk......",
      "...kkkk....g..", "..dddddd..gg..", ".dkddddkd.g...", ".dkddddkd.....",
      ".dddddddd.....", "..dd..dd......", "..kk..kk......", "..kk..kk......",
      "..KK..KK......", ".KKK..KKK.....",
    ],
    berserker: [
      "...hhhh.......", "..hhhhhhh.....", "..hsssssh..X..", "..hsesesh.XXX.",
      "..hsssssh..X..", "...sss.....X..", "..xxxxxx...X..", ".xXxxxxXx..X..",
      ".xXxxxxXx.....", ".xxxxxxxx.....", "..xx..xx......", "..ss..ss......",
      "..ss..ss......", "..KK..KK......", ".KKK..KKK.....",
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
  const SLIME = ["............","....GGGG....","..GGGGGGGG..",".GGGGGGGGGG.",".GWGGGGGGWG.",".GeGGGGGGeG.","GGGGGGGGGGGG","GGGGGGGGGGGG",".DDDDDDDDDD."];
  const SPIDER = ["1.1......1.1",".11......11.","..11....11..","...222222...","..2q2222q2..","..22222222..","...222222...","..11....11..",".1........1."];
  const SCORPION = ["..........N.",".n.......NN.","nn.nnnn..N..",".nnnnnnnnN..","nnnnnnnnnn..",".nnnnnnnn...","nn.nnnn.nn..",".n......n..."];
  const SNOWMAN = ["............","....iiii....","...iiiiii...","..iieiieii..","..iiilliii..","...iiiiii...","..iiiiiiii..",".iiiiiiiiii.",".iIiiiiiiII.",".iiiiiiiiii.","..iiiiiiii.."];
  const FIRE = ["....r..r....","...rf..fr...","..rfYffYfr..","..rfYqqYfr..","..rfYYYYfr..","..rffYYffr..","...rfYYfr...","...rffffr...","..rr.rr.rr.."];
  const JELLY = ["...jjjjjj...","..jjjjjjjj..",".jjjjjjjjjj.",".jJjjjjjjJj.",".jjjjjjjjjj.","..jjjjjjjj..","..c.c.c.c.c.",".c.c.c.c.c..","..c.c.c.c.c."];
  const BIRD = [".......l....","......lww...","...wwwwwww..","..wwwwwwwww.",".ww.wwwww.ww","w....www...w",".....w.w...."];
  const SKELETON = ["...aaaa.....","..aaaaaa....","..aeaaea....","..aaaaaa....","...aWWa.....","..a.aa.a....",".aa.aa.aa...","..a.aa.a....","..a.aa.a...."];
  const IMP = ["..K....K....","..rKrrKr....","..rrqqrr....","..rrrrrr....","...rrrr.....","..rRrrRr....",".rr.rr.rr...","..r....r...."];
  const SHADOW = ["...7777.....","..777777....",".77q77q77...",".77777777...",".77777777...",".87777778...",".77777777...","..7.77.7....",".7..77..7..."];
  const BAT = ["................",".VV..........VV.","VVVV..vvvv..VVVV","VVVVvvvvvvvvVVVV",".VVvvWvvvvWvvVV.","..vvveVVeevvv...","...vvvvvvvvv....","....vv..vv......"];
  const GHOST = ["..wwww....",".wwwwww...","wwewwew...","wwwwwwww..","wwwwwwww..","wwwwwwww..","w.w.w.w..."];
  const RAT = ["..........","..55......",".5555..6..","55W555.66.",".55555.6..",".5.5.5...."];
  const WISP = ["...yy.....","..yvvy....",".yvVVvy...",".yvVVvy...","..yvvy....","...yy....."];

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
