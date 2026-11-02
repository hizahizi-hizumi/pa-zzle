import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import {
  type BridgesBoard,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  bridgesIslandTones,
  bridgesToneClassNames,
} from "@/games/bridges/ui/bridges-tone";

/** 図に描く行の数。どのレベルでも同じにし、1マスを読める大きさに保つ。 */
const PREVIEW_ROWS = 5;

/**
 * レベルごとの盤面と、図に描く行。`board` は盤面全体の記法（`formatBridgesBoard`）、`top` は描き始める行。
 * `marks` は描く行と同じ形で、`o` が輪を付ける島。
 * 盤面はそのレベルの組み合わせ（`bridgesLevelCombinations`）に当たる一意解の盤面で、問題集の問題ではない（生成器で作り、
 * 問題集と同型でないものを選んだ）。一辺はそのレベルの盤面の一辺の上限で、図には盤面の横幅いっぱいを `PREVIEW_ROWS` 行だけ描く。
 * 描く行は、上のレベルほど島が減らず、輪（数字の読みを尽くしても橋が決まらず、つながりを読んで決める島）がはっきり増える所を選んだ。
 */
const previewBoards = {
  "1": {
    board: [
      ".1....3",
      "3.3..3.",
      ".......",
      "...1..3",
      ".......",
      "2..3.4.",
      "..2...2",
    ],
    top: 0,
    marks: [".......", ".......", ".......", ".......", "......."],
  },
  "2": {
    board: [
      ".1..3..1",
      "........",
      "2..2....",
      ".1..4..4",
      "2.......",
      ".3.3.2.2",
      "1.......",
      ".2..2.1.",
    ],
    top: 0,
    marks: ["........", "........", "........", "........", "........"],
  },
  "3": {
    board: [
      "...1.3.1.",
      "2.3.1.3.2",
      "...2.2...",
      "..1.....1",
      "4..2.1...",
      ".........",
      "4.2..2..2",
      ".........",
      "2.2.2.3.2",
    ],
    top: 1,
    marks: ["......o.o", ".........", "........o", ".........", "........."],
  },
  "4": {
    board: [
      "..2....2.2",
      "....2.5.1.",
      ".......2.3",
      "1.3.......",
      "....4.5...",
      "..2....1.2",
      "....3.....",
      "1.3...2..4",
      "....2..1..",
      "..1......2",
    ],
    top: 4,
    marks: [
      "..........",
      "..o....o.o",
      "..........",
      "o.o......o",
      "..........",
    ],
  },
  "5": {
    board: [
      "3.4.5.3.1.",
      ".........2",
      "4...5.2.1.",
      "..4..1.3.3",
      "....3.1...",
      "4.5..2....",
      "....1..4.2",
      "3..1.2....",
      "..........",
      "1.2..3.2.1",
    ],
    top: 1,
    marks: [
      "..........",
      "....o.o.o.",
      ".....o.o.o",
      "....o.o...",
      "o.o..o....",
    ],
  },
} as const satisfies Record<
  BridgesDifficulty,
  { board: readonly string[]; top: number; marks: readonly string[] }
>;

const MARK_NOTATION = "o";

/**
 * 島の丸の半径と縁の太さ（マス幅を 1 とした値）。色は盤面の島と同じにし、大きさと縁の太さは見本の大きさに合わせて盤面と違える。
 * 盤面の縁の太さ（0.06）は1マス 10px では1px 未満で消えるので太くし、盤面の半径（0.4）では外側の輪と重なるので小さくする。
 */
const ISLAND_RADIUS = 0.3;
const ISLAND_OUTLINE_WIDTH = 0.12;
/** 輪の半径と太さ。島の丸から離して描き、島の丸の色や大きさの違いに見えないようにする。 */
const MARK_RADIUS = 0.45;
const MARK_WIDTH = 0.08;
/** 地の四方の余白（マス幅を 1 とした値）。端の行・列の輪が地の縁に接して見えないようにする。 */
const GROUND_PADDING = 0.2;

type PreviewBoard = {
  board: BridgesBoard;
  /** 図に描く行の範囲（`top` 以上 `top + PREVIEW_ROWS` 未満）。 */
  top: number;
  /** 描く行にある島の番号。 */
  shownIslands: number[];
  /** 輪を付ける島の番号。 */
  markedIslands: number[];
};

function createPreviewBoard(difficulty: BridgesDifficulty): PreviewBoard {
  const { board: rows, top, marks } = previewBoards[difficulty];
  const board = parseBridgesBoard(rows);
  const markRows: readonly string[] = marks;
  const shownIslands = board.islands.flatMap(({ row }, index) =>
    row >= top && row < top + PREVIEW_ROWS ? [index] : [],
  );
  const markedIslands = shownIslands.filter((index) => {
    const { row, column } = board.islands[index]!;
    return markRows[row - top]?.[column] === MARK_NOTATION;
  });
  return { board, top, shownIslands, markedIslands };
}

type BridgesDifficultyPreviewProps = {
  difficulty: BridgesDifficulty;
};

/**
 * 難易度プレビューは、そのレベルの盤面の横幅いっぱいを数行だけ、解き始めの姿（島だけ。数字と橋は描かない）で描く模式図である。
 * - 横幅（盤面の一辺）と描く行の島の数で、上のレベルほど盤面が広く島が多いことを示す。マスの大きさと行の数はどのレベルでもそろえる。
 * - 数字の読みだけでは橋が決まらない島に輪を付ける。上のレベルほど多く、つながりを読んで決める所が広いことを示す。
 * - 数字は見本の大きさでは読めないので描かない。島の丸は盤面の足りない島と同じ色の白い丸にし（大きさと縁の太さは見本に合わせる）、輪は丸から離して線だけで描く。
 */
export function BridgesDifficultyPreview({
  difficulty,
}: BridgesDifficultyPreviewProps) {
  const { board, top, shownIslands, markedIslands } =
    createPreviewBoard(difficulty);
  const { width } = board;
  const groundWidth = width + GROUND_PADDING * 2;
  const groundHeight = PREVIEW_ROWS + GROUND_PADDING * 2;
  const tone = bridgesIslandTones.short;

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-center [--preview-unit:10px] lg:h-28 lg:justify-center lg:[--preview-unit:14px]"
    >
      <svg
        viewBox={`${-GROUND_PADDING} ${-GROUND_PADDING} ${groundWidth} ${groundHeight}`}
        className="shrink-0"
        style={{
          width: `calc(var(--preview-unit) * ${groundWidth})`,
          height: `calc(var(--preview-unit) * ${groundHeight})`,
        }}
      >
        <rect
          x={-GROUND_PADDING}
          y={-GROUND_PADDING}
          width={groundWidth}
          height={groundHeight}
          className={bridgesToneClassNames.ground}
        />
        {shownIslands.map((island) => {
          const { row, column } = board.islands[island]!;
          const cx = column + 0.5;
          const cy = row - top + 0.5;
          return (
            <g key={`${row}:${column}`}>
              {markedIslands.includes(island) && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={MARK_RADIUS}
                  fill="none"
                  strokeWidth={MARK_WIDTH}
                  className={bridgesToneClassNames.previewMark}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={ISLAND_RADIUS}
                strokeWidth={ISLAND_OUTLINE_WIDTH}
                className={tone.disc}
              />
            </g>
          );
        })}
      </svg>
    </span>
  );
}

export const _private = {
  PREVIEW_ROWS,
  previewBoards,
  createPreviewBoard,
};
