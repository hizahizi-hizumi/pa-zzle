import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import {
  type BridgesBoard,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import { BridgesFigure } from "@/games/bridges/ui/board/BridgesFigure";

/**
 * レベルごとの帯。`board` は盤面の記法（`formatBridgesBoard`）、`marks` は同じ形の行で、`o` が印を付ける島。
 * 帯は4行で、それだけで一意解の小さな盤面になっている。帯の幅と、人間向け解法器で解いたときの入口の広さ・
 * 「少なくとも1本」の読みの回数・つながりの読みの回数・数字の読みだけでは決まらない行き先の割合は、
 * そのレベルの組み合わせ（`bridgesLevelCombinations`）に入れてある。島の数は帯の大きさに合わせて、上のレベルほど1つずつ増やす。
 * 印は、数字の読み（ちょうど・少なくとも）を尽くしても橋が決まらない島で、つながりを読んで決める所（0・0・4・6・9）。
 */
const previewStrips = {
  "1": {
    board: ["3..2.2.", ".......", "..1..2.", "2......"],
    marks: [".......", ".......", ".......", "......."],
  },
  "2": {
    board: ["..2....2", "...1.3..", "........", "..1..3.2"],
    marks: ["........", "........", "........", "........"],
  },
  "3": {
    board: [".2.2....2", ".........", "....1...2", ".2.3...2."],
    marks: [".o.o.....", ".........", ".........", ".o.o....."],
  },
  "4": {
    board: ["3.4..3..1.", "..........", "..2..3..1.", "2..1......"],
    marks: ["..o..o..o.", "..........", "..o..o..o.", ".........."],
  },
  "5": {
    board: ["2..3..3..2", ".....1....", "..........", "2..3.3.2.1"],
    marks: ["o..o..o..o", "..........", "..........", "o..o.o.o.o"],
  },
} as const satisfies Record<
  BridgesDifficulty,
  { board: readonly string[]; marks: readonly string[] }
>;

const MARK_NOTATION = "o";

type PreviewStrip = {
  board: BridgesBoard;
  /** 印を付ける島の番号。 */
  markedIslands: number[];
};

function createPreviewStrip(difficulty: BridgesDifficulty): PreviewStrip {
  const { board: rows, marks } = previewStrips[difficulty];
  const board = parseBridgesBoard(rows);
  const markedIslands = board.islands.flatMap(({ row, column }, index) =>
    marks[row]?.[column] === MARK_NOTATION ? [index] : [],
  );
  return { board, markedIslands };
}

type BridgesDifficultyPreviewProps = {
  difficulty: BridgesDifficulty;
};

/**
 * 難易度プレビューは、4行の帯の盤面を、解き始めの姿（島と数字だけ、橋は無し）で描く模式図である。実際の問題ではなく、答え（橋）は描かない。
 * - 帯の幅はそのレベルで遊ぶ盤面の一辺の上限で、上のレベルほど広く、島が多い。
 * - 数字の読みだけでは橋が決まらない島の丸を淡い黄色で塗る。上のレベルほど多く、つながりを読んで決める所が広いことを示す。
 * - レベル1と2の違い（入口の広さと「少なくとも1本」の読み）は図には表れず、幅と島の数の違いだけになる。
 * 盤面は遊ぶときと同じ絵（`BridgesFigure`）で、島はどれも本数が足りない姿で描く。
 * マスの大きさはどのレベルでもそろえ、最も広い帯がスマートフォンの見本の枠（幅 128px）に収まる大きさにする。
 */
export function BridgesDifficultyPreview({
  difficulty,
}: BridgesDifficultyPreviewProps) {
  const { board, markedIslands } = createPreviewStrip(difficulty);

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-center [--preview-unit:12px] lg:h-28 lg:justify-center lg:[--preview-unit:14px]"
    >
      <span
        className="relative"
        style={{
          width: `calc(var(--preview-unit) * ${board.width})`,
          height: `calc(var(--preview-unit) * ${board.height})`,
        }}
      >
        <BridgesFigure
          board={board}
          bridges={getBridgesNetwork(board).edges.map(() => 0)}
          islandStatuses={board.islands.map(() => "short")}
          highlightedIslands={markedIslands}
        />
      </span>
    </span>
  );
}

export const _private = {
  previewStrips,
  createPreviewStrip,
};
