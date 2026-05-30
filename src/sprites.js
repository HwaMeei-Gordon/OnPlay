/* ============================================================
 * sprites.js — 各地區專屬敵人 / 魔王點陣圖（馬賽克風格）
 * 索引對應 data.js 的 THEMES：0 草原 … 9 魔王城深層
 * 小怪面向右（render 會翻轉成面向左）；魔王畫正面。
 * 全域命名空間：window.Game.Sprites
 * （drawSprite 容忍不等寬列，缺字視為透明）
 * ============================================================ */
(function () {
  "use strict";
  const Game = (window.Game = window.Game || {});

  // ---- 小怪（每地區一種）----
  const SLIME = [
    "............",
    "....GGGG....",
    "..GGGGGGGG..",
    ".GGGGGGGGGG.",
    ".GWGGGGGGWG.",
    ".GeGGGGGGeG.",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    ".DDDDDDDDDD.",
  ];
  const SPIDER = [
    "1.1......1.1",
    ".11......11.",
    "..11....11..",
    "...222222...",
    "..2q2222q2..",
    "..22222222..",
    "...222222...",
    "..11....11..",
    ".1........1.",
  ];
  const SCORPION = [
    "..........N.",
    ".n.......NN.",
    "nn.nnnn..N..",
    ".nnnnnnnnN..",
    "nnnnnnnnnn..",
    ".nnnnnnnn...",
    "nn.nnnn.nn..",
    ".n......n...",
  ];
  const SNOWMAN = [
    "............",
    "....iiii....",
    "...iiiiii...",
    "..iieiieii..",
    "..iiilliii..",
    "...iiiiii...",
    "..iiiiiiii..",
    ".iiiiiiiiii.",
    ".iIiiiiiiII.",
    ".iiiiiiiiii.",
    "..iiiiiiii..",
  ];
  const FIRE = [
    "....r..r....",
    "...rf..fr...",
    "..rfYffYfr..",
    "..rfYqqYfr..",
    "..rfYYYYfr..",
    "..rffYYffr..",
    "...rfYYfr...",
    "...rffffr...",
    "..rr.rr.rr..",
  ];
  const JELLY = [
    "...jjjjjj...",
    "..jjjjjjjj..",
    ".jjjjjjjjjj.",
    ".jJjjjjjjJj.",
    ".jjjjjjjjjj.",
    "..jjjjjjjj..",
    "..c.c.c.c.c.",
    ".c.c.c.c.c..",
    "..c.c.c.c.c.",
  ];
  const BIRD = [
    ".......l....",
    "......lww...",
    "...wwwwwww..",
    "..wwwwwwwww.",
    ".ww.wwwww.ww",
    "w....www...w",
    ".....w.w....",
  ];
  const SKELETON = [
    "...aaaa.....",
    "..aaaaaa....",
    "..aeaaea....",
    "..aaaaaa....",
    "...aWWa.....",
    "..a.aa.a....",
    ".aa.aa.aa...",
    "..a.aa.a....",
    "..a.aa.a....",
  ];
  const IMP = [
    "..K....K....",
    "..rKrrKr....",
    "..rrqqrr....",
    "..rrrrrr....",
    "...rrrr.....",
    "..rRrrRr....",
    ".rr.rr.rr...",
    "..r....r....",
  ];
  const SHADOW = [
    "...7777.....",
    "..777777....",
    ".77q77q77...",
    ".77777777...",
    ".77777777...",
    ".87777778...",
    ".77777777...",
    "..7.77.7....",
    ".7..77..7...",
  ];

  // ---- 魔王（每地區一種，較大）----
  const B_SLIME = [
    "....................",
    ".....yy.yy.yy.......",
    ".....yyyyyyyy.......",
    "....GGGGGGGGGG......",
    "...GGGGGGGGGGGG.....",
    "..GGGGGGGGGGGGGG....",
    ".GGGGGGGGGGGGGGGG...",
    ".GGWWGGGGGGGGWWGG...",
    ".GGWWGGGGGGGGWWGG...",
    ".GGeeGGGGGGGGeeGG...",
    "GGGGGGGGGGGGGGGGGG..",
    "GGGGGGGGGGGGGGGGGG..",
    "GGGGGGGGGGGGGGGGGG..",
    ".DDDDDDDDDDDDDDDD...",
    "..DDDDDDDDDDDDDD....",
  ];
  const B_SPIDER = [
    "1...1......1...1....",
    ".1..1......1..1.....",
    "..2222222222........",
    ".22222222222........",
    "222q22222q222.......",
    ".22222222222........",
    "..2222222222........",
    "...22222222.........",
    "1...1......1...1....",
    ".1..1......1..1.....",
  ];
  const B_SCORPION = [
    "..............NN....",
    "N............NNNN...",
    "NN..nnnnnnn..NN.....",
    ".nnnnnnnnnnnnN......",
    "nnnnnnnnnnnnnn......",
    "nnnnnnnnnnnnn.......",
    ".nnnnnnnnnnn........",
    "nn..nnnnn..nn.......",
    ".n...n.n...n........",
  ];
  const B_ICE = [
    "....IIIIII........",
    "...IIIIIIII.......",
    "..IIiiiiiiII......",
    "..Iieiiieiii......",
    "..Iiiiiiiii.......",
    "...Iiiiiii........",
    "..IIIIIIIIII......",
    ".IIiiiiiiiiII.....",
    ".Iiiiiiiiiiii.....",
    ".Iiiiiiiiiiii.....",
    ".IIiiiiiiiiII.....",
    "..III....III......",
    ".III......III.....",
  ];
  const B_FLAME = [
    "...r......r......",
    "..rr.r..r.rr.....",
    "..rfrffffrfr.....",
    ".rfYffffffYfr....",
    ".rfYqffffqYfr....",
    ".rfYYffffYYfr....",
    ".rffYYYYYYffr....",
    "..rffYYYYffr.....",
    "..rrffYYffrr.....",
    "...rrffffrr......",
    "..rr.rffr.rr.....",
    ".rr...rr...rr....",
  ];
  const B_KRAKEN = [
    "...cccccc.......",
    "..cccccccc......",
    ".ccqcccccqcc....",
    ".cccccccccc.....",
    ".cCcccccccC.....",
    "..cccccccc......",
    ".c.c.c.c.c.c....",
    "c.c.c.c.c.c.c...",
    ".c.c.c.c.c.c....",
    "c..c..c..c..c...",
  ];
  const B_HARPY = [
    "........l.......",
    ".......lww......",
    "w....wwwwww....w",
    "ww..wwwwwwww..ww",
    ".wwwwwwwwwwwwww.",
    ".wwwwwwwwwwwwww.",
    "..wwwwwwwwwwww..",
    "...wwwwwwwwww...",
    "....ww....ww....",
    "....l......l....",
  ];
  const B_COLOSSUS = [
    "..555555555.....",
    ".55555555555....",
    ".5q5555555q5....",
    ".55555555555....",
    "556666666655....",
    ".55555555555....",
    ".5555555555.....",
    "5555555555555...",
    "55.555555.55....",
    "55.5555.5.55....",
    "5..55..55..5....",
  ];
  const B_DEMON = [
    ".K..............K..",
    ".KK....rrrr....KK..",
    "..rrrrrrrrrrrrrr...",
    "..rqRrrrrrrrRqr...",
    "..rrrrrffrrrrrr...",
    "..rrrrffffrrrrr...",
    "..RrrrrrrrrrrrrR..",
    "..RRrraaaaaarrRR..",
    "...RrrrrrrrrrR....",
    "..rrrr.rr.rrrr....",
    ".RRR..RRRR..RRR...",
  ];
  const B_LORD = [
    "..8..........8....",
    ".888...ff...888...",
    "..7rrffffrr7......",
    "..7rqffffqr7......",
    "..7rffffffr7......",
    "..77rffffr77......",
    ".87rrffffrr78.....",
    ".877rrffrr778.....",
    "..77rr..rr77......",
    ".77..7..7..77.....",
  ];

  Game.Sprites = {
    small: [
      SLIME, SPIDER, SCORPION, SNOWMAN, FIRE,
      JELLY, BIRD, SKELETON, IMP, SHADOW,
    ],
    boss: [
      B_SLIME, B_SPIDER, B_SCORPION, B_ICE, B_FLAME,
      B_KRAKEN, B_HARPY, B_COLOSSUS, B_DEMON, B_LORD,
    ],
  };
})();
