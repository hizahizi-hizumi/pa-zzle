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
 * 盤面はそのレベルの組み合わせ（`bridgesLevelCombinations`）に当たる一意解の盤面で、問題集の問題ではない（生成器で作り、
 * 問題集と同型でないものを選んだ）。一辺はそのレベルの盤面の一辺の上限で、図には盤面の横幅いっぱいを `PREVIEW_ROWS` 行だけ描く。
 * 描く行は、上のレベルほど島が減らない所を選んだ。
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
  },
} as const satisfies Record<
  BridgesDifficulty,
  { board: readonly string[]; top: number }
>;

/**
 * 島の丸の半径と縁の太さ（マス幅を 1 とした値）。色は盤面の島と同じにし、大きさと縁の太さは見本の大きさに合わせて盤面と違える。
 * 盤面の縁の太さ（0.06）は1マス 10px では1px 未満で消えるので太くし、半径は隣の島の丸と離れて見えるよう盤面（0.4）より小さくする。
 */
const ISLAND_RADIUS = 0.3;
const ISLAND_OUTLINE_WIDTH = 0.12;
/** 地の四方の余白（マス幅を 1 とした値）。端の行・列の島の丸が地の縁に接して見えないようにする。 */
const GROUND_PADDING = 0.2;

type PreviewBoard = {
  board: BridgesBoard;
  /** 図に描く行の範囲（`top` 以上 `top + PREVIEW_ROWS` 未満）。 */
  top: number;
  /** 描く行にある島の番号。 */
  shownIslands: number[];
};

function createPreviewBoard(difficulty: BridgesDifficulty): PreviewBoard {
  const { board: rows, top } = previewBoards[difficulty];
  const board = parseBridgesBoard(rows);
  const shownIslands = board.islands.flatMap(({ row }, index) =>
    row >= top && row < top + PREVIEW_ROWS ? [index] : [],
  );
  return { board, top, shownIslands };
}

type BridgesDifficultyPreviewProps = {
  difficulty: BridgesDifficulty;
};

/**
 * 難易度プレビューは、そのレベルの盤面の横幅いっぱいを数行だけ、解き始めの姿（島だけ。数字と橋は描かない）で描く模式図である。
 * - 横幅（盤面の一辺）と描く行の島の数で、上のレベルほど盤面が広く島が多いことを示す。マスの大きさと行の数はどのレベルでもそろえる。
 * - 数字は見本の大きさでは読めないので描かない。島の丸は盤面の足りない島と同じ色の白い丸にする（大きさと縁の太さは見本に合わせる）。
 * - 島に印を付けない。見本の大きさでは何の印か読み取れない。
 */
export function BridgesDifficultyPreview({
  difficulty,
}: BridgesDifficultyPreviewProps) {
  const { board, top, shownIslands } = createPreviewBoard(difficulty);
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
          return (
            <circle
              key={`${row}:${column}`}
              cx={column + 0.5}
              cy={row - top + 0.5}
              r={ISLAND_RADIUS}
              strokeWidth={ISLAND_OUTLINE_WIDTH}
              className={tone.disc}
            />
          );
        })}
      </svg>
    </span>
  );
}

export const _private = {
  PREVIEW_ROWS,
  createPreviewBoard,
};
