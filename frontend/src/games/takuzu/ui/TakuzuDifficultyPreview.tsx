import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";
import { cn } from "@/lib/utils";

/**
 * 各レベルで初めて要る読みの局面を 8×8 の盤面に置いたもの。図には、タイルのある行だけを切り出して描く。
 * `A` / `B` は置かれたタイル、`a` / `b` はその読みで決まるタイル、`.` は空き。
 * 図は読む前の局面として描く。置かれたタイルは盤面の固定タイルと同じ見た目で描き、決まるマスは空きのまま色付けだけする。
 * 全マスが埋まった行は、レベル 4・5 の見比べる相手の完成した行だけにし、控えめに描く。
 *
 * 1: 並んだ2つの両隣と、挟まれた1つが決まる。
 * 2: 行のタイルを数える。A が4個そろった行の残りは B。
 * 3: 行に残り1個の B の置き場所を読む。右端に B を置くと A が3つ続くので、右端は A。
 * 4: 完成した行（下）と同じ並びにならないよう読む。上の行の置き方2通りのうち1つは下の行と同じ。
 * 5: 上の2行のどちらも、完成した行（一番下）と同じ並びにならないよう読む（何度も要ることを1枚にまとめた模式図）。
 *
 * 行どうしを2行以上離して置くのは、列の中に並び・挟みの形を作らず、描いた読みだけで決まる局面にするため。
 */
const previewMoments = {
  "1": [
    "........",
    "........",
    "........",
    "bAAb.BaB",
    "........",
    "........",
    "........",
    "........",
  ],
  "2": [
    "........",
    "........",
    "........",
    "AABbAbbA",
    "........",
    "........",
    "........",
    "........",
  ],
  "3": [
    "........",
    "........",
    "........",
    "..ABBABa",
    "........",
    "........",
    "........",
    "........",
  ],
  "4": [
    "........",
    "........",
    "BaABAABb",
    "........",
    "........",
    "........",
    "BBABAABA",
    "........",
  ],
  "5": [
    "........",
    "BaABAABb",
    "........",
    "........",
    "BBAabABA",
    "........",
    "........",
    "BBABAABA",
  ],
} satisfies Record<TakuzuDifficulty, readonly string[]>;

type PreviewCell = {
  column: number;
  given: TakuzuCell;
  deduced: boolean;
};

type PreviewRow = {
  row: number;
  complete: boolean;
  cells: PreviewCell[];
};

function toPreviewCell(mark: string, column: number): PreviewCell {
  return {
    column,
    given: mark === "A" ? "a" : mark === "B" ? "b" : null,
    deduced: mark === "a" || mark === "b",
  };
}

function createPreviewRows(difficulty: TakuzuDifficulty): PreviewRow[] {
  return previewMoments[difficulty].flatMap(function toPreviewRow(marks, row) {
    return marks.includes("A") || marks.includes("B")
      ? [
          {
            row,
            complete: /^[AB]+$/.test(marks),
            cells: Array.from(marks, toPreviewCell),
          },
        ]
      : [];
  });
}

// 決まるマスはタイルを描かずに空けておき、背景だけを薄く色付けする。
// 盤面の違反の赤や置いたタイルの青と取り違えないよう、盤面では使わない淡い黄色にする。
const deducedCellClassName = "bg-amber-100 dark:bg-amber-300/15";

type TakuzuDifficultyPreviewProps = {
  difficulty: TakuzuDifficulty;
};

export function TakuzuDifficultyPreview({
  difficulty,
}: TakuzuDifficultyPreviewProps) {
  const rows = createPreviewRows(difficulty);

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-32 shrink-0 flex-col justify-center gap-0.5 lg:items-center"
    >
      {rows.map(function renderRow({ row, complete, cells }) {
        return (
          <span
            key={row}
            className={cn(
              "grid w-fit grid-cols-[repeat(8,15px)] auto-rows-[15px] gap-px border bg-border",
              // 見比べる相手の完成した行は、読む行より一段控えめに描く。
              complete ? "border-foreground/20" : "border-foreground/40",
            )}
          >
            {cells.map(function renderCell({ column, given, deduced }) {
              return (
                <span
                  key={`${row}-${column}`}
                  className={cn(
                    "flex items-center justify-center",
                    deduced ? deducedCellClassName : "bg-background",
                    complete && "[&>svg]:opacity-40",
                  )}
                >
                  <TakuzuCellFace cell={given} given size="figure" />
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

export const _private = { previewMoments, createPreviewRows };
