import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperProblemIdentity,
} from "./problem";

/**
 * 難易度分類を人が遊んで確かめるための問題群。
 * - `representative`: 各難易度の典型。
 * - `boundary`: 隣り合う難易度や提供範囲の境目にある問題。
 * - `anomaly`: 分類の特徴量だけでは見えにくい偏りを持つ問題。
 */
export type MinesweeperDifficultyReviewGroup =
  | "representative"
  | "boundary"
  | "anomaly";

export type MinesweeperDifficultyReviewProblem = {
  group: MinesweeperDifficultyReviewGroup;
  description: string;
  identity: MinesweeperProblemIdentity;
};

function reviewProblem(
  group: MinesweeperDifficultyReviewGroup,
  seed: string,
  conditions: MinesweeperProblemIdentity["conditions"],
  description: string,
): MinesweeperDifficultyReviewProblem {
  return {
    group,
    description,
    identity: {
      generatorVersion: MINESWEEPER_GENERATOR_VERSION,
      seed,
      conditions,
      generationAttempt: 1,
    },
  };
}

export const minesweeperDifficultyReviewProblems: readonly MinesweeperDifficultyReviewProblem[] =
  [
    reviewProblem(
      "representative",
      "ms-10x10-15-125",
      { rows: 10, columns: 10, mineCount: 15, startCellPlacement: "random" },
      "数字1つを読むだけで最後まで進める",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-18-115",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "数字1つを読むだけで最後まで進める",
    ),
    reviewProblem(
      "representative",
      "ms-12x12-22-122",
      { rows: 12, columns: 12, mineCount: 22, startCellPlacement: "random" },
      "数字1つを読むだけで最後まで進める。どこからでも進めやすい",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-15-144",
      { rows: 10, columns: 10, mineCount: 15, startCellPlacement: "random" },
      "2つの数字の包含（壁際の1-1・1-2など）が2回",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-18-229",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "盤端の1-1・1-2による包含が1回",
    ),
    reviewProblem(
      "representative",
      "ms-12x12-22-102",
      { rows: 12, columns: 12, mineCount: 22, startCellPlacement: "random" },
      "開いた領域の縁での包含が1回",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-15-846",
      { rows: 10, columns: 10, mineCount: 15, startCellPlacement: "random" },
      "終盤、隅の2×2に残る地雷1個を総地雷数で決める",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-18-138",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "終盤、1つの数字が残り地雷を全部持つと総地雷数で気づく",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-18-790",
      { rows: 10, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "包含を4回、重なり以上の推論なし",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-18-429",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "包含を4回、重なり以上の推論なし",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-18-151",
      { rows: 10, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "開けた場所の部分的な重なり（1-2）がちょうど1回",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-18-153",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "開けた場所の部分的な重なりがちょうど1回",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-15-819",
      { rows: 10, columns: 10, mineCount: 15, startCellPlacement: "random" },
      "終盤、離れた2つの数字の残り地雷の和が総残り地雷数と一致",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-21-311",
      { rows: 10, columns: 10, mineCount: 21, startCellPlacement: "random" },
      "開幕の隅で「2の中に1が2つ」",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-28-524",
      { rows: 12, columns: 10, mineCount: 28, startCellPlacement: "random" },
      "「2の中に1が2つ」が1回",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-18-377",
      { rows: 10, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "開幕から部分的な重なりを3回繰り返す",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-22-606",
      { rows: 12, columns: 10, mineCount: 22, startCellPlacement: "random" },
      "部分的な重なりを3回",
    ),
    reviewProblem(
      "representative",
      "ms-10x10-18-342",
      { rows: 10, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "終盤、離れた3つの数字を数え合わせて総残り地雷数と突き合わせる",
    ),
    reviewProblem(
      "representative",
      "ms-12x10-25-290",
      { rows: 12, columns: 10, mineCount: 25, startCellPlacement: "random" },
      "開幕で3つの数字を連鎖させて考える",
    ),
    reviewProblem(
      "representative",
      "ms-12x12-22-960",
      { rows: 12, columns: 12, mineCount: 22, startCellPlacement: "random" },
      "左端の列で3つの数字を同時に見る連鎖",
    ),
    reviewProblem(
      "representative",
      "ms-14x10-21-740",
      { rows: 14, columns: 10, mineCount: 21, startCellPlacement: "random" },
      "3つの数字の連鎖が1回",
    ),
    reviewProblem(
      "representative",
      "ms-14x10-25-224",
      { rows: 14, columns: 10, mineCount: 25, startCellPlacement: "random" },
      "4つの数字の連鎖が1回",
    ),
    reviewProblem(
      "boundary",
      "ms-10x10-15-777",
      { rows: 10, columns: 10, mineCount: 15, startCellPlacement: "random" },
      "1と2の境界: 包含がちょうど1回・1か所だけ",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-18-320",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "1と2の境界: 包含がちょうど1回・1か所だけ",
    ),
    reviewProblem(
      "boundary",
      "ms-10x10-15-156",
      { rows: 10, columns: 10, mineCount: 15, startCellPlacement: "random" },
      "1と2の境界: 包含なし、終盤に総地雷数で1つの数字が残り地雷を全部持つだけ",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-18-618",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "1と2の境界: 包含なし、終盤に総地雷数で1つの数字が残り地雷を全部持つだけ",
    ),
    reviewProblem(
      "boundary",
      "ms-10x10-18-151",
      { rows: 10, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "2と3の境界: 部分的な重なりは1回だが同時に2か所以上",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-18-595",
      { rows: 12, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "2と3の境界: 部分的な重なりは1回だが同時に2か所以上",
    ),
    reviewProblem(
      "boundary",
      "ms-10x10-21-466",
      { rows: 10, columns: 10, mineCount: 21, startCellPlacement: "random" },
      "3と4の境界: 重なり1回と、終盤の離れた2つの数字の数え合わせ",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-22-344",
      { rows: 12, columns: 10, mineCount: 22, startCellPlacement: "random" },
      "3と4の境界: 重なり1回と、終盤の離れた2つの数字の数え合わせ",
    ),
    reviewProblem(
      "boundary",
      "ms-10x10-18-488",
      { rows: 10, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "4と5の境界: 3つの数字の連鎖が1回だけで、他は数字1つ",
    ),
    reviewProblem(
      "boundary",
      "ms-12x12-22-633",
      { rows: 12, columns: 12, mineCount: 22, startCellPlacement: "random" },
      "4と5の境界: 3つの数字の連鎖が1回だけで、他は数字1つ",
    ),
    reviewProblem(
      "boundary",
      "ms-10x10-23-351",
      { rows: 10, columns: 10, mineCount: 23, startCellPlacement: "random" },
      "4と5の境界: 終盤に数字のまとまりの組合せを総地雷数と突き合わせるだけ",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-22-115",
      { rows: 12, columns: 10, mineCount: 22, startCellPlacement: "random" },
      "4と5の境界: 終盤に数字のまとまりの組合せを総地雷数と突き合わせるだけ",
    ),
    reviewProblem(
      "boundary",
      "ms-10x10-10-118",
      { rows: 10, columns: 10, mineCount: 10, startCellPlacement: "random" },
      "提供下限の内側: 数字1つだけで6ラウンド、初期開示53%",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-12-111",
      { rows: 12, columns: 10, mineCount: 12, startCellPlacement: "random" },
      "提供下限の内側: 数字1つだけで6ラウンド、初期開示58%",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-12-103",
      { rows: 12, columns: 10, mineCount: 12, startCellPlacement: "random" },
      "提供下限の外側: 初期開示84%で残りを開くだけ",
    ),
    reviewProblem(
      "boundary",
      "ms-12x10-12-112",
      { rows: 12, columns: 10, mineCount: 12, startCellPlacement: "random" },
      "提供下限の外側: 初期開示87%で残りを開くだけ",
    ),
    reviewProblem(
      "anomaly",
      "ms-16x12-35-718",
      { rows: 16, columns: 12, mineCount: 35, startCellPlacement: "random" },
      "数字1つだけで解けるが43ラウンドと長い",
    ),
    reviewProblem(
      "anomaly",
      "ms-12x12-33-257",
      { rows: 12, columns: 12, mineCount: 33, startCellPlacement: "random" },
      "数字1つだけで解けるが36ラウンドと長い",
    ),
    reviewProblem(
      "anomaly",
      "ms-14x10-25-476",
      { rows: 14, columns: 10, mineCount: 25, startCellPlacement: "random" },
      "数字1つだけだが、進められる場所が1か所しかない局面が多い",
    ),
    reviewProblem(
      "anomaly",
      "ms-10x10-18-511",
      { rows: 10, columns: 10, mineCount: 18, startCellPlacement: "random" },
      "数字1つだけだが、進められる場所が1か所しかない局面が多い",
    ),
    reviewProblem(
      "anomaly",
      "ms-14x10-29-115",
      { rows: 14, columns: 10, mineCount: 29, startCellPlacement: "random" },
      "包含だけで11回、35ラウンドと長い",
    ),
    reviewProblem(
      "anomaly",
      "ms-16x12-35-74",
      { rows: 16, columns: 12, mineCount: 35, startCellPlacement: "random" },
      "包含だけで10回、41ラウンドと長い",
    ),
    reviewProblem(
      "anomaly",
      "ms-9x9-17-779",
      { rows: 9, columns: 9, mineCount: 17, startCellPlacement: "random" },
      "部分的な重なり4回に加えて3つの数字の連鎖",
    ),
    reviewProblem(
      "anomaly",
      "ms-12x10-28-696",
      { rows: 12, columns: 10, mineCount: 28, startCellPlacement: "random" },
      "部分的な重なりを4回",
    ),
    reviewProblem(
      "anomaly",
      "ms-7x7-10-250",
      { rows: 7, columns: 7, mineCount: 10, startCellPlacement: "random" },
      "7×7でも3つの数字の連鎖が出る",
    ),
    reviewProblem(
      "anomaly",
      "ms-7x7-10-267",
      { rows: 7, columns: 7, mineCount: 10, startCellPlacement: "random" },
      "7×7で4つの数字の連鎖が出る",
    ),
    reviewProblem(
      "anomaly",
      "ms-10x10-10-682",
      { rows: 10, columns: 10, mineCount: 10, startCellPlacement: "random" },
      "開幕の1回だけ連鎖（2 2 2 / 1 . 1）、その後は数字1つで短く終わる",
    ),
    reviewProblem(
      "anomaly",
      "ms-14x10-14-475",
      { rows: 14, columns: 10, mineCount: 14, startCellPlacement: "random" },
      "開幕の1回だけ「2の中に1が2つ」、6ラウンドで終わる",
    ),
    reviewProblem(
      "anomaly",
      "ms-12x10-12-110",
      { rows: 12, columns: 10, mineCount: 12, startCellPlacement: "random" },
      "初期開示92%なのに終盤の数え合わせで難易度が上がる",
    ),
    reviewProblem(
      "anomaly",
      "ms-10x10-12-312",
      { rows: 10, columns: 10, mineCount: 12, startCellPlacement: "random" },
      "初期開示91%で、終盤に3つの数字の数え合わせ",
    ),
    reviewProblem(
      "anomaly",
      "ms-12x10-25-198",
      { rows: 12, columns: 10, mineCount: 25, startCellPlacement: "random" },
      "離れた2つの数字の数え合わせだが、未確定23マスの盤面全体を見る",
    ),
  ];
