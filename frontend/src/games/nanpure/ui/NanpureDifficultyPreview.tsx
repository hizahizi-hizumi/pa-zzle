import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { NANPURE_SIZE } from "@/games/nanpure/puzzle/board";

/**
 * 各レベルで初めて要る読みを、9×9 の盤面のどこを読むかとして描いたもの。数字は小さすぎて読めないので描かない。
 * `.` は読まないマス、`-` は読む範囲、`#` は読みの手がかりになるマス、`*` はその読みで数字が決まる・候補が消えるマス。
 *
 * 1: 1つのブロックの中で、数字の置き場所を探す。
 * 2: 1マスから見える行・列・ブロックをまとめて読み、入る数字を決める。
 * 3: ブロックの中で候補が1本の行に並ぶ（手がかり）ので、その行のブロックの外から候補を消す。
 * 4: 行の中の2マスの組（手がかり）から、同じ行の他のマスの候補を消す。
 * 5: 離れた3マスの候補のつながり（手がかり）から、両端から見えるマスの候補を消す。
 */
const previewAreas = {
  "1": [
    ".........",
    ".........",
    ".........",
    "...--*...",
    "...---...",
    "...---...",
    ".........",
    ".........",
    ".........",
  ],
  "2": [
    "....-....",
    "....-....",
    "....-....",
    "...---...",
    "----*----",
    "...---...",
    "....-....",
    "....-....",
    "....-....",
  ],
  "3": [
    ".........",
    ".........",
    ".........",
    "---......",
    "#-#---*--",
    "---......",
    ".........",
    ".........",
    ".........",
  ],
  "4": [
    ".........",
    ".........",
    ".........",
    ".........",
    "-#-*-#-*-",
    ".........",
    ".........",
    ".........",
    ".........",
  ],
  "5": [
    ".........",
    "..#...*..",
    "..-......",
    "..-......",
    "..#---#..",
    ".........",
    ".........",
    ".........",
    ".........",
  ],
} satisfies Record<NanpureDifficulty, readonly string[]>;

type PreviewCellRole = "outside" | "read" | "clue" | "effect";

const cellRoleByMark: Readonly<Record<string, PreviewCellRole>> = {
  ".": "outside",
  "-": "read",
  "#": "clue",
  "*": "effect",
};

// 決まる・候補が消えるマスは、バイナリパズルの難易度の図と同じ淡い黄色にする。盤面の誤りの赤や選択の色と取り違えないため。
const cellClassNames = {
  outside: "bg-background",
  read: "bg-foreground/15",
  clue: "bg-foreground/55",
  effect: "bg-amber-300 dark:bg-amber-300/60",
} satisfies Record<PreviewCellRole, string>;

const BLOCK_SIZE = 3;
const blockIndices = Array.from(
  { length: BLOCK_SIZE * BLOCK_SIZE },
  (_, index) => index,
);

function getCellRole(
  difficulty: NanpureDifficulty,
  row: number,
  column: number,
): PreviewCellRole {
  const mark = previewAreas[difficulty][row]?.[column] ?? ".";
  return cellRoleByMark[mark] ?? "outside";
}

type NanpureDifficultyPreviewProps = {
  difficulty: NanpureDifficulty;
};

export function NanpureDifficultyPreview({
  difficulty,
}: NanpureDifficultyPreviewProps) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
    >
      <span className="grid grid-cols-3 gap-0.5 border border-foreground/55 bg-foreground/55">
        {blockIndices.map(function renderBlock(blockIndex) {
          const blockRow = Math.floor(blockIndex / BLOCK_SIZE) * BLOCK_SIZE;
          const blockColumn = (blockIndex % BLOCK_SIZE) * BLOCK_SIZE;
          return (
            <span
              key={blockIndex}
              className="grid grid-cols-[repeat(3,5px)] auto-rows-[5px] gap-px bg-border"
            >
              {blockIndices.map(function renderCell(cellIndex) {
                const row = blockRow + Math.floor(cellIndex / BLOCK_SIZE);
                const column = blockColumn + (cellIndex % BLOCK_SIZE);
                return (
                  <span
                    key={row * NANPURE_SIZE + column}
                    className={
                      cellClassNames[getCellRole(difficulty, row, column)]
                    }
                  />
                );
              })}
            </span>
          );
        })}
      </span>
    </span>
  );
}
