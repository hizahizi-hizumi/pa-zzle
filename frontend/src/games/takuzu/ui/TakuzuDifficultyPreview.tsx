import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import { takuzuTileClassNames } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuCell/TakuzuTile";
import { cn } from "@/lib/utils";

const BOARD_SIZE = 8;

/**
 * 各難易度で初めて要る読みの局面を、8×8 の盤面に描いた模式図。盤面の大きさは全難易度で同じ。
 * 読みに関わる行・列のタイルだけを置き、その読みで決まるマスは中抜きのタイルで示す。
 * - `cells`: `A` / `B` は置かれたタイル、`a` / `b` はその読みで決まるタイル、`.` は空き。
 * - `readingArea`: `#` はその読みで見る範囲（3マスの並び、または行・列）。
 *
 * 1: 並んだ2つの両隣・挟まれた1つ（3マスの並び）で決まる。
 * 2: 行のタイルを数える。A が4個そろった行の残りは B。
 * 3: 行に残り1個の B の置き場所を読む。右端に B を置くと A が3つ続くので、右端は A。
 * 4: 完成した行（下）と同じ並びにならないよう読む。上の行の置き方2通りのうち1つは下の行と同じ。
 * 5: 完成した行・列との見比べが、行でも列でも要る（何度も要ることを1枚にまとめた模式図）。
 */
export const takuzuDifficultyPreviewMoments = {
  "1": {
    cells: [
      "........",
      "bAAb....",
      "........",
      "........",
      ".....B..",
      ".....a..",
      ".....B..",
      "........",
    ],
    readingArea: [
      "........",
      "####....",
      "........",
      "........",
      ".....#..",
      ".....#..",
      ".....#..",
      "........",
    ],
  },
  "2": {
    cells: [
      "........",
      "........",
      "AABbAbbA",
      "........",
      "........",
      "........",
      "........",
      "........",
    ],
    readingArea: [
      "........",
      "........",
      "########",
      "........",
      "........",
      "........",
      "........",
      "........",
    ],
  },
  "3": {
    cells: [
      "........",
      "........",
      "........",
      "........",
      "........",
      "..ABBABa",
      "........",
      "........",
    ],
    readingArea: [
      "........",
      "........",
      "........",
      "........",
      "........",
      "########",
      "........",
      "........",
    ],
  },
  "4": {
    cells: [
      "........",
      "........",
      "BaABAABb",
      "........",
      "........",
      "........",
      "BBABAABA",
      "........",
    ],
    readingArea: [
      "........",
      "........",
      "########",
      "........",
      "........",
      "........",
      "########",
      "........",
    ],
  },
  "5": {
    cells: [
      "..b..A..",
      "BaABAABb",
      "..a..B..",
      "..B..B..",
      "BBABAABA",
      "..B..B..",
      "..A..A..",
      "..B..B..",
    ],
    readingArea: [
      "..#..#..",
      "########",
      "..#..#..",
      "..#..#..",
      "########",
      "..#..#..",
      "..#..#..",
      "..#..#..",
    ],
  },
} satisfies Record<
  TakuzuDifficulty,
  { cells: readonly string[]; readingArea: readonly string[] }
>;

// 小さな盤面では盤面用の太い縁取りが円を覆うので、B の縁を細くする。
const previewTileClassNames = {
  a: takuzuTileClassNames.a,
  b: cn(
    takuzuTileClassNames.b,
    "shadow-[inset_0_0_0_1px_var(--color-amber-600)] dark:shadow-[inset_0_0_0_1px_var(--color-amber-400)]",
  ),
} satisfies Record<TakuzuTile, string>;

// その読みで決まるマスは、置かれたタイルと同じ形・色の中抜きで示す。
const deducedTileClassNames = {
  a: "rounded-[12%] border-[1.5px] border-blue-700 dark:border-blue-400",
  b: "rounded-full border-[1.5px] border-amber-500 dark:border-amber-300",
} satisfies Record<TakuzuTile, string>;

type PreviewCell = {
  key: string;
  tile: TakuzuTile | null;
  deduced: boolean;
  inReadingArea: boolean;
};

function toPreviewCells({
  cells,
  readingArea,
}: (typeof takuzuDifficultyPreviewMoments)[TakuzuDifficulty]): PreviewCell[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, cellIndex) => {
    const row = Math.floor(cellIndex / BOARD_SIZE);
    const column = cellIndex % BOARD_SIZE;
    const mark = cells[row]?.[column] ?? ".";
    const lowerMark = mark.toLowerCase();
    return {
      key: `${row}-${column}`,
      tile: lowerMark === "a" || lowerMark === "b" ? lowerMark : null,
      deduced: mark === "a" || mark === "b",
      inReadingArea: readingArea[row]?.[column] === "#",
    };
  });
}

type TakuzuDifficultyPreviewProps = {
  difficulty: TakuzuDifficulty;
};

export function TakuzuDifficultyPreview({
  difficulty,
}: TakuzuDifficultyPreviewProps) {
  const cells = toPreviewCells(takuzuDifficultyPreviewMoments[difficulty]);

  return (
    <span
      aria-hidden="true"
      className="grid size-[88px] shrink-0 grid-cols-8 grid-rows-8 gap-px rounded-[3px] bg-slate-300 p-px lg:size-[120px] dark:bg-slate-700"
    >
      {cells.map(({ key, tile, deduced, inReadingArea }) => (
        <span
          key={key}
          data-reading-area={inReadingArea || undefined}
          className={cn(
            "flex items-center justify-center rounded-[10%] bg-slate-200 dark:bg-slate-800",
            inReadingArea && "bg-white dark:bg-slate-600",
          )}
        >
          {tile && (
            <span
              data-deduced={deduced || undefined}
              className={cn(
                "size-[80%]",
                deduced
                  ? deducedTileClassNames[tile]
                  : previewTileClassNames[tile],
              )}
            />
          )}
        </span>
      ))}
    </span>
  );
}
