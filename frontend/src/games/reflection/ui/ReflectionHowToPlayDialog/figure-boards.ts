import {
  parseReflectionBoard,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import type { ReflectionEntry } from "@/games/reflection/puzzle/laser";
import type { ReflectionCueTarget } from "@/games/reflection/ui/board/cue";

/**
 * 遊び方の触れる例1つ。外周の数字と手持ちのピースは、本番の問題と同じく `solution` から求める。
 * - `board`: 例の始まりの盤面。ストックに残るのは、`solution` のピースから `board` に置いた分を引いたもの。
 * - `visibleEntries`: 描く外周の数字。例が言う数字に絞る。渡さなければ、本番と同じくすべて描く。
 * - `focusEntry`: 例の下の判定や起きることを言う外周の数字。
 * - `showsStock`: 盤面の下にストックを描くか。
 * - `hand`: 例が見せる手の、押す所の順。手がかりはこの順に付ける。
 * - `completes`: 揃ったら本番と同じく完成させる例か。完成を教える例だけを真にする。
 */
export type ReflectionHowToPlayExample = {
  solution: ReflectionBoard;
  board: ReflectionBoard;
  visibleEntries?: readonly ReflectionEntry[];
  focusEntry?: ReflectionEntry;
  showsStock: boolean;
  hand: readonly ReflectionCueTarget[];
  completes?: boolean;
};

export type ReflectionHowToPlayExamplePair = readonly [
  ReflectionHowToPlayExample,
  ReflectionHowToPlayExample,
];

const left1: ReflectionEntry = { side: "left", index: 0 };
const left2: ReflectionEntry = { side: "left", index: 1 };
const top2: ReflectionEntry = { side: "top", index: 1 };
const top3: ReflectionEntry = { side: "top", index: 2 };
const right2: ReflectionEntry = { side: "right", index: 1 };

/**
 * 外周の数字の光が合うかや、どう進むかを見せる例。数字を押して、今の盤面での光路を出す手を見せる。
 * 盤面を変える手はピースを選んでから押す2回の手になるので、ルールの例では、合うかを確かめる手（光路を出す）を見せる。
 */
function createLightExample(
  solutionRows: readonly string[],
  boardRows: readonly string[],
  focusEntry: ReflectionEntry,
  visibleEntries: readonly ReflectionEntry[],
): ReflectionHowToPlayExample {
  return {
    solution: parseReflectionBoard(solutionRows),
    board: parseReflectionBoard(boardRows),
    visibleEntries,
    focusEntry,
    showsStock: false,
    hand: [{ type: "clue", entry: focusEntry }],
  };
}

/** ピース1つの働きの例。盤面は解き終えた盤面そのもので、描く数字はどれも合っている。 */
function createPieceExample(
  rows: readonly string[],
  focusEntry: ReflectionEntry,
  visibleEntries: readonly ReflectionEntry[],
): ReflectionHowToPlayExample {
  return createLightExample(rows, rows, focusEntry, visibleEntries);
}

/**
 * 光が通るマスの数と行き先の例。どちらも左1行の数字は「2↗」で、光は右上がりの鏡で上へ曲がる。
 * 合う例は鏡が1行2列にあり、2マスで上2列から出る。合わない例は鏡が1行3列にあり、3マス通って上3列から出る。
 */
export const countRuleExamples = [
  createLightExample(["./.", "...", "..."], ["./.", "...", "..."], left1, [
    left1,
    top2,
  ]),
  createLightExample(["./.", "...", "..."], ["../", "...", "..."], left1, [
    left1,
    top2,
  ]),
] as const satisfies ReflectionHowToPlayExamplePair;

/**
 * 出た先の数字も合わせる例。どちらも左2行の光は中央の右上がりの鏡で上2列へ3マスで出て、左2行の数字「3↗」と数も印も同じになる。
 * 合う例は上2列の数字も「3↗」。合わない例は、解き終えた盤面の鏡が1行2列にあるので上2列の数字が「2↗」になり、左2行も合わない。
 */
export const exitRuleExamples = [
  createLightExample(["...", "./.", "..."], ["...", "./.", "..."], left2, [
    left2,
    top2,
  ]),
  createLightExample(["./.", "...", "..."], ["...", "./.", "..."], left2, [
    left2,
    top2,
  ]),
] as const satisfies ReflectionHowToPlayExamplePair;

/**
 * 斜め鏡の例。上2列から入れた光が、中央の右上がりの鏡では左へ、右下がりの鏡では右へ曲がって、3マスで出る。
 * 2つの例の帯の辺をそろえ、横に並べたときに盤面の高さと位置が同じになるよう、どちらも上から入れる。
 */
export const mirrorRuleExamples = [
  createPieceExample(["...", "./.", "..."], top2, [top2, left2]),
  createPieceExample(["...", ".\\.", "..."], top2, [top2, right2]),
] as const satisfies ReflectionHowToPlayExamplePair;

/**
 * 反射鏡の例。左2行から入れた光が、中央では3マスで、2行3列では5マスで戻る。戻る分のマスも数えることを、数の違いで見せる。
 * どの向きの光もはね返すことは、反射鏡の上の数字も描き、押して確かめられるようにする。
 */
export const reflectorRuleExamples = [
  createPieceExample(["...", ".o.", "..."], left2, [left2, top2]),
  createPieceExample(["...", "..o", "..."], left2, [left2, top3]),
] as const satisfies ReflectionHowToPlayExamplePair;

/** 両面鏡の例。左2行から入れた光が、縦の両面鏡では3マスで戻り、横の両面鏡では鏡に沿って右2行から出る。 */
export const doubleMirrorRuleExamples = [
  createPieceExample(["...", ".|.", "..."], left2, [left2]),
  createPieceExample(["...", ".=.", "..."], left2, [left2, right2]),
] as const satisfies ReflectionHowToPlayExamplePair;

/** ブラックホールの例。左2行から入れた光が、中央では2マス目で、2行3列では3マス目で吸い込まれる。 */
export const blackHoleRuleExamples = [
  createPieceExample(["...", ".@.", "..."], left2, [left2, top2]),
  createPieceExample(["...", "..@", "..."], left2, [left2, top3]),
] as const satisfies ReflectionHowToPlayExamplePair;

/**
 * 完成の例。右上がりの鏡を置いた盤面で、ストックに残ったブラックホールを3行2列に置くと、すべての数字が合って完成する。
 * 本番と同じく、すべての数字を描き、ストックも描く。
 */
export const completionRuleExample: ReflectionHowToPlayExample = {
  solution: parseReflectionBoard(["./.", "...", ".@."]),
  board: parseReflectionBoard(["./.", "...", "..."]),
  showsStock: true,
  hand: [
    { type: "stock", piece: "black-hole" },
    { type: "cell", cellIndex: 7 },
  ],
  completes: true,
};

/** 置き方の例。ストックで右上がりの鏡を選び、1行1列と3行3列に続けて置く。 */
export const placeOperationExample: ReflectionHowToPlayExample = {
  solution: parseReflectionBoard(["/..", "...", "../"]),
  board: parseReflectionBoard(["...", "...", "..."]),
  visibleEntries: [],
  showsStock: true,
  hand: [
    { type: "stock", piece: "slash" },
    { type: "cell", cellIndex: 0 },
    { type: "cell", cellIndex: 8 },
  ],
};

/** 移し方の例。1行1列の右上がりの鏡を選び、1行3列へ移す。3行3列の反射鏡を押せば入れ替わる。 */
export const moveOperationExample: ReflectionHowToPlayExample = {
  solution: parseReflectionBoard(["/..", "...", "..o"]),
  board: parseReflectionBoard(["/..", "...", "..o"]),
  visibleEntries: [],
  showsStock: false,
  hand: [
    { type: "cell", cellIndex: 0 },
    { type: "cell", cellIndex: 2 },
  ],
};

/**
 * 置き換えと戻し方の例。中央の右上がりの鏡を選んでストックの右下がりの鏡を押すと置き換わり、
 * 置き換えた右下がりの鏡を選んでストックの同じ種類を押すとストックに戻る。
 */
export const swapOperationExample: ReflectionHowToPlayExample = {
  solution: parseReflectionBoard(["...", "./\\", "..."]),
  board: parseReflectionBoard(["...", "./.", "..."]),
  visibleEntries: [],
  showsStock: true,
  hand: [
    { type: "cell", cellIndex: 4 },
    { type: "stock", piece: "backslash" },
    { type: "cell", cellIndex: 4 },
    { type: "stock", piece: "backslash" },
  ],
};

/**
 * 光路の例。本番と同じくすべての数字を描き、合っていない左1行の数字を押して、今の光路と今の光の通るマスの数を出す手を見せる。
 */
export const laserOperationExample: ReflectionHowToPlayExample = {
  solution: parseReflectionBoard(["./.", "...", "..."]),
  board: parseReflectionBoard(["../", "...", "..."]),
  focusEntry: left1,
  showsStock: false,
  hand: [{ type: "clue", entry: left1 }],
};

/**
 * 入口のゴールの盤面。空の盤面から `order` のマスの順に1つずつ置いて、すべての数字を合わせる。
 * 6種類のうち5種類を使い、合った数字が置くたびに増えていくようにする。
 */
export const goalFigure = {
  solution: parseReflectionBoard([
    ".....",
    ".\\..o",
    ".....",
    "..@./",
    "=....",
  ]),
  order: [17, 6, 19, 9, 20],
} as const;
