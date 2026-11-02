import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import {
  type BridgesBoard,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  bridgesIslandTones,
  bridgesToneClassNames,
} from "@/games/bridges/ui/bridges-tone";

/**
 * レベルごとの盤面の縮図。`board` は盤面の記法（`formatBridgesBoard`）、`marks` は同じ形の行で、`o` が輪を付ける島。
 * 盤面はそのレベルの組み合わせ（`bridgesLevelCombinations`）に当たる一意解の盤面で、問題集の問題ではない（生成器で作り、
 * 問題集と同型でないものを選んだ）。一辺はそのレベルの盤面の一辺の上限、島の数は問題集の中央値（11・15・19・24・24）にそろえた。
 * 輪は、数字の読み（ちょうど・少なくとも）を尽くしても橋が決まらない島で、つながりを読んで決める所。
 */
const previewBoards = {
  "1": {
    board: [
      ".2.2..1",
      "1......",
      ".1.....",
      "4..6..5",
      ".......",
      ".......",
      "1..1..2",
    ],
    marks: [
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
    ],
  },
  "2": {
    board: [
      "2.2.2.2.",
      "........",
      ".1.2..3.",
      "3....1..",
      "........",
      "2..1..2.",
      "........",
      "2...3..2",
    ],
    marks: [
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ],
  },
  "3": {
    board: [
      ".....2..2",
      "2..1...2.",
      "........2",
      "2..2.4.3.",
      "......2.3",
      ".2.2.4.3.",
      ".........",
      ".1.....2.",
      ".....1...",
    ],
    marks: [
      ".........",
      "o..o.....",
      ".........",
      "o..o.o...",
      ".........",
      "...o.o...",
      ".........",
      ".........",
      ".........",
    ],
  },
  "4": {
    board: [
      "1.2.2.1..1",
      "..........",
      "3.4..2.3.3",
      ".3.2......",
      "..1.3..3.2",
      "..........",
      ".2..1..2.2",
      "..........",
      ".........1",
      ".2.2...2..",
    ],
    marks: [
      "..o.o.o..o",
      "..........",
      "..o..o.o.o",
      "..........",
      "....o..o.o",
      "..........",
      ".o..o..o.o",
      "..........",
      "..........",
      ".o.o...o..",
    ],
  },
  "5": {
    board: [
      "1..2..3.1.",
      "..........",
      "2..3..4.1.",
      "..........",
      "1..3.2....",
      "....1.....",
      "1..3.1....",
      "....2.3..1",
      "1..2......",
      ".1..2.3..2",
    ],
    marks: [
      "o..o..o.o.",
      "..........",
      "o..o..o.o.",
      "..........",
      "o..o......",
      "..........",
      "o..o......",
      "....o.o..o",
      "o..o......",
      "....o.o..o",
    ],
  },
} as const satisfies Record<
  BridgesDifficulty,
  { board: readonly string[]; marks: readonly string[] }
>;

const MARK_NOTATION = "o";

/** 縮図の島の丸の半径と縁の太さ（マス幅を 1 とした値）。小さく描くので、盤面より縁を太くして丸に見えるようにする。 */
const ISLAND_RADIUS = 0.3;
const ISLAND_OUTLINE_WIDTH = 0.16;
/** 輪の半径と太さ。島の丸から離して描き、島の丸の色や大きさの違いに見えないようにする。 */
const MARK_RADIUS = 0.47;
const MARK_WIDTH = 0.08;

type PreviewBoard = {
  board: BridgesBoard;
  /** 輪を付ける島の番号。 */
  markedIslands: number[];
};

function createPreviewBoard(difficulty: BridgesDifficulty): PreviewBoard {
  const { board: rows, marks } = previewBoards[difficulty];
  const board = parseBridgesBoard(rows);
  const markRows: readonly string[] = marks;
  const markedIslands = board.islands.flatMap(({ row, column }, index) =>
    markRows[row]?.[column] === MARK_NOTATION ? [index] : [],
  );
  return { board, markedIslands };
}

type BridgesDifficultyPreviewProps = {
  difficulty: BridgesDifficulty;
};

/**
 * 難易度プレビューは、そのレベルの盤面の縮図を、解き始めの姿（島だけ。数字と橋は描かない）で描く模式図である。
 * - 盤面の一辺と島の数で、上のレベルほど盤面が広く島が多いことを示す。マスの大きさはどのレベルでもそろえる。
 * - 数字の読みだけでは橋が決まらない島に輪を付ける。上のレベルほど多く、つながりを読んで決める所が広いことを示す。
 * - 数字は縮図では読めない大きさになるので描かない。島の丸は盤面と同じ白い丸にし、輪は丸から離して線だけで描く。
 */
export function BridgesDifficultyPreview({
  difficulty,
}: BridgesDifficultyPreviewProps) {
  const { board, markedIslands } = createPreviewBoard(difficulty);
  const { width, height, islands } = board;
  const tone = bridgesIslandTones.short;

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-center [--preview-unit:5.5px] lg:h-28 lg:justify-center lg:[--preview-unit:11px]"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0"
        style={{
          width: `calc(var(--preview-unit) * ${width})`,
          height: `calc(var(--preview-unit) * ${height})`,
        }}
      >
        <rect
          width={width}
          height={height}
          className={bridgesToneClassNames.ground}
        />
        {islands.map(({ row, column }, island) => (
          <g key={`${row}:${column}`}>
            {markedIslands.includes(island) && (
              <circle
                cx={column + 0.5}
                cy={row + 0.5}
                r={MARK_RADIUS}
                fill="none"
                strokeWidth={MARK_WIDTH}
                className={bridgesToneClassNames.bridge}
              />
            )}
            <circle
              cx={column + 0.5}
              cy={row + 0.5}
              r={ISLAND_RADIUS}
              strokeWidth={ISLAND_OUTLINE_WIDTH}
              className={tone.disc}
            />
          </g>
        ))}
      </svg>
    </span>
  );
}

export const _private = {
  previewBoards,
  createPreviewBoard,
};
