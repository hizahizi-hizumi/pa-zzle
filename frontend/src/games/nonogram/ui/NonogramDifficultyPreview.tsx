import {
  type NonogramDifficulty,
  nonogramLevelCombinations,
} from "@/games/nonogram/difficulty";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import { PreviewClueBand } from "@/games/nonogram/ui/NonogramDifficultyPreview/PreviewClueBand";
import { PreviewGridLines } from "@/games/nonogram/ui/NonogramDifficultyPreview/PreviewGridLines";
import {
  PREVIEW_CLUE_BAND,
  toPreviewLength,
} from "@/games/nonogram/ui/NonogramDifficultyPreview/preview-unit";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

/**
 * 難易度プレビューは、盤面と上・左のヒントの欄に、行と列を交互に読んで1マスずつ決めていく「連鎖」を描いた模式図である。
 * 実際の問題ではない。
 *
 * - 盤面: そのレベルで遊ぶ盤面の大きさのうち面積が最も大きいものを、プレイ画面と同じ向き（列を横、行を縦）で描く。
 *   マスの大きさはどのレベルでもそろえ、上のレベルほど盤面が広い。線は5マスごとの線と外周だけにし、プレイ画面と同じ色で描く。
 * - 連鎖: 1行目のヒントから読み始め、行の読みで決まったマスの列を読み、その列の読みで決まったマスの行を読む、を繰り返す。
 *   読む回数（`readingCounts`）は、そのレベルの問題集の連鎖の深さ（段の数）の中央値。
 *   読んだ行・列のヒントの欄と、読んで決まるマスを同じ色で示す。上のレベルの連鎖は下のレベルの連鎖の続きになる。
 * - 決まるマスが塗りか空白かは描かない（答えを描かない）。ヒントの数字と × は描かない。
 */
const previewChain = {
  readingCounts: { "1": 3, "2": 5, "3": 7, "4": 10, "5": 15 },
} as const satisfies {
  readingCounts: Record<NonogramDifficulty, number>;
};

type ChainReading = { axis: "row" | "column"; index: number };
type CellPosition = { row: number; column: number };

type PreviewChain = {
  size: NonogramGridSize;
  readings: ChainReading[];
  /** 各読みで決まるマス。`readings` と同じ順。 */
  cells: CellPosition[];
};

function getPreviewBoardSize(difficulty: NonogramDifficulty): NonogramGridSize {
  const { boardSizes } = nonogramLevelCombinations[difficulty];
  const { width, height } = boardSizes.reduce((largest, candidate) =>
    candidate.width * candidate.height > largest.width * largest.height
      ? candidate
      : largest,
  );
  return { width, height };
}

/**
 * 1行目を読んで左上のマスが決まり、その列を読んで1つ下のマスが決まり、その行を読んで1つ右のマスが決まる、と
 * 行と列を交互に読む。決まるマスは左上から右下へ階段状に並ぶ。
 */
function createPreviewChain(difficulty: NonogramDifficulty): PreviewChain {
  const readings: ChainReading[] = [];
  const cells: CellPosition[] = [];
  let row = 0;
  let column = 0;
  for (
    let readingIndex = 0;
    readingIndex < previewChain.readingCounts[difficulty];
    readingIndex++
  ) {
    if (readingIndex % 2 === 0) {
      readings.push({ axis: "row", index: row });
      if (readingIndex > 0) column += 1;
    } else {
      readings.push({ axis: "column", index: column });
      row += 1;
    }
    cells.push({ row, column });
  }
  return { size: getPreviewBoardSize(difficulty), readings, cells };
}

function listReadIndices(
  readings: readonly ChainReading[],
  axis: ChainReading["axis"],
): ReadonlySet<number> {
  return new Set(
    readings.flatMap((reading) =>
      reading.axis === axis ? [reading.index] : [],
    ),
  );
}

type NonogramDifficultyPreviewProps = {
  difficulty: NonogramDifficulty;
};

export function NonogramDifficultyPreview({
  difficulty,
}: NonogramDifficultyPreviewProps) {
  const { size, readings, cells } = createPreviewChain(difficulty);
  const boardPlacement = {
    left: toPreviewLength(PREVIEW_CLUE_BAND),
    top: toPreviewLength(PREVIEW_CLUE_BAND),
    width: toPreviewLength(size.width),
    height: toPreviewLength(size.height),
  };

  return (
    <span
      aria-hidden="true"
      // 最も高い盤面（15行）とヒントの欄がプレビュー枠の高さ（56px）に収まるマスの大きさにする。
      // PC では、ほかのゲームのプレビューと並べて重さがそろう大きさにとどめる。
      className="flex h-14 w-full items-center [--preview-unit:3.25px] lg:h-28 lg:justify-center lg:[--preview-unit:5.5px]"
    >
      {/* マスの大きさをどのレベルでもそろえるため、図の大きさを盤面の列・行の数に比例させる。 */}
      <span
        className="relative shrink-0"
        style={{
          width: toPreviewLength(PREVIEW_CLUE_BAND + size.width),
          height: toPreviewLength(PREVIEW_CLUE_BAND + size.height),
        }}
      >
        <PreviewClueBand
          axis="row"
          length={size.height}
          readIndices={listReadIndices(readings, "row")}
        />
        <PreviewClueBand
          axis="column"
          length={size.width}
          readIndices={listReadIndices(readings, "column")}
        />
        <span
          className="absolute overflow-hidden bg-background"
          style={boardPlacement}
        >
          {cells.map(({ row, column }) => (
            <span
              key={`${row}-${column}`}
              className={cn("absolute", nonogramToneClassNames.previewChain)}
              style={{
                left: toPreviewLength(column),
                top: toPreviewLength(row),
                width: toPreviewLength(1),
                height: toPreviewLength(1),
              }}
            />
          ))}
          <PreviewGridLines width={size.width} height={size.height} />
        </span>
        {/* 外周は盤面の外側に 1px ずつ広げて描き、端のマスの色を覆わない。 */}
        <span
          className={cn("absolute border", nonogramToneClassNames.blockLine)}
          style={{
            left: `calc(${boardPlacement.left} - 1px)`,
            top: `calc(${boardPlacement.top} - 1px)`,
            width: `calc(${boardPlacement.width} + 2px)`,
            height: `calc(${boardPlacement.height} + 2px)`,
          }}
        />
      </span>
    </span>
  );
}

export const _private = { createPreviewChain };
