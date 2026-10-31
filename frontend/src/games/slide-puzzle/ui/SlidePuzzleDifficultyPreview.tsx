import {
  type SlidePuzzleDifficulty,
  slidePuzzleDifficultyCriteria,
} from "@/games/slide-puzzle/difficulty";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

type PreviewRows = readonly [readonly number[], readonly number[]];

// 実際の開始盤面ではなく、難易度の違いを抽象化した表現。盤面の上2行を、そのレベルで遊ぶ盤面の幅で切り出す。
// 同じ盤面サイズの2段を説明文なしで見分けられるように、下の段（2・4）だけ1行目を揃えて描く。
// 崩した行には正しい位置のタイルを置かず、空きマスも含めない。
const previewRows = {
  "1": [
    [8, 7, 4],
    [2, 6, 5],
  ],
  "2": [
    [1, 2, 3, 4],
    [8, 11, 5, 6],
  ],
  "3": [
    [10, 4, 13, 9],
    [6, 7, 5, 15],
  ],
  "4": [
    [1, 2, 3, 4, 5],
    [15, 14, 6, 22, 24],
  ],
  "5": [
    [3, 12, 1, 21, 6],
    [2, 24, 14, 10, 9],
  ],
} satisfies Record<SlidePuzzleDifficulty, PreviewRows>;

/** タイルの大きさをどのレベルでもそろえるため、高さを固定して列数ぶん横に伸ばす。 */
const gridClassByColumnCount: Record<SlidePuzzleBoardSize, string> = {
  3: "grid-cols-3 aspect-3/2",
  4: "grid-cols-4 aspect-2/1",
  5: "grid-cols-5 aspect-5/2",
};

type SlidePuzzleDifficultyPreviewProps = {
  difficulty: SlidePuzzleDifficulty;
};

export function SlidePuzzleDifficultyPreview({
  difficulty,
}: SlidePuzzleDifficultyPreviewProps) {
  const columnCount = slidePuzzleDifficultyCriteria[difficulty].boardSize;
  const tiles = previewRows[difficulty].flat();

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-start lg:h-28 lg:items-center lg:justify-center"
    >
      {/* 下側の角を丸めず、盤面が下へ続く切り出しに見せる。 */}
      <span
        className={`grid h-12 ${gridClassByColumnCount[columnCount]} gap-[3px] rounded-t-md bg-muted px-[3px] pt-[3px] lg:h-[68px] lg:gap-1 lg:px-1 lg:pt-1`}
      >
        {tiles.map((tile) => (
          <span
            key={tile}
            className="flex items-center justify-center rounded-[3px] border border-border bg-card font-sans text-[11px] leading-none font-semibold text-card-foreground tabular-nums lg:rounded-md lg:text-sm"
          >
            {tile}
          </span>
        ))}
      </span>
    </span>
  );
}
