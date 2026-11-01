import {
  type NonogramDifficulty,
  nonogramLevelCombinations,
} from "@/games/nonogram/difficulty";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import { PreviewGridLines } from "@/games/nonogram/ui/NonogramDifficultyPreview/PreviewGridLines";
import { toPreviewLength } from "@/games/nonogram/ui/NonogramDifficultyPreview/preview-unit";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

/**
 * 難易度プレビューは、盤面に、行と列を交互に読んで決まるマスをたどっていく「連鎖」を1本の線で描いた模式図である。
 * 実際の問題ではない。
 *
 * - 盤面: そのレベルで遊ぶ盤面の大きさのうち面積が最も大きいものを、プレイ画面と同じ向き（列を横、行を縦）で描く。
 *   マスの大きさはどのレベルでもそろえ、上のレベルほど盤面が広い。外周と5マスごとの線だけを、プレイ画面と同じ色で描く。
 * - 連鎖: 左のヒントから1本目の行を読み、行の読みで決まったマスの列を読み、その列の読みで決まったマスの行を読む、を繰り返す。
 *   線は盤面の左の外から入り、読んだ行・列に沿って、決まるマスからマスへ階段状に結ぶ。読む回数（`readingCounts`）は、
 *   そのレベルの問題集の連鎖の深さ（段の数）の中央値。上のレベルの連鎖は下のレベルの連鎖の続きになる。
 * - 決まるマスが塗りか空白かは描かない（答えを描かない）。マスを塗る形は使わず、線だけで描く。ヒントの数字と × は描かない。
 */
const previewChain = {
  readingCounts: { "1": 3, "2": 5, "3": 7, "4": 10, "5": 15 },
  /**
   * 読みごとに決まるマス（`[行, 列]`）。各レベルは先頭から読む回数の分だけ使う。
   * 線を外周の線と重ねないよう、どのレベルの盤面でも外周のマスより内側に置く。
   * 列は1マスずつ右へ進め、行は2マスずつ下げる。レベル4・5の盤面の高さに収めるため、2か所だけ行を1マス下げる。
   */
  decidedCells: [
    [1, 1],
    [3, 1],
    [3, 2],
    [5, 2],
    [5, 3],
    [7, 3],
    [7, 4],
    [8, 4],
    [8, 5],
    [10, 5],
    [10, 6],
    [11, 6],
    [11, 7],
    [13, 7],
    [13, 8],
  ],
} as const satisfies {
  readingCounts: Record<NonogramDifficulty, number>;
  decidedCells: readonly (readonly [row: number, column: number])[];
};

/** 連鎖の線を盤面の左の外へ出す長さ（マス単位）。左のヒントから読み始めることを示す。 */
const CHAIN_LEAD = 1.5;
/** 連鎖の線の太さ（マス単位）。 */
const CHAIN_WIDTH = 0.6;

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

/** 偶数番目（0始まり）の読みは決まるマスの行を、奇数番目の読みはその列を読む。 */
function toChainReading(
  { row, column }: CellPosition,
  readingIndex: number,
): ChainReading {
  return readingIndex % 2 === 0
    ? { axis: "row", index: row }
    : { axis: "column", index: column };
}

function createPreviewChain(difficulty: NonogramDifficulty): PreviewChain {
  const cells = previewChain.decidedCells
    .slice(0, previewChain.readingCounts[difficulty])
    .map(([row, column]) => ({ row, column }));
  return {
    size: getPreviewBoardSize(difficulty),
    readings: cells.map(toChainReading),
    cells,
  };
}

/** 連鎖の線の折れ点。座標はマス1辺を1とし、盤面の左上を原点とする。 */
function formatChainPoints(cells: readonly CellPosition[]): string {
  const [first] = cells;
  const lead = first ? [{ x: -CHAIN_LEAD, y: first.row + 0.5 }] : [];
  return [
    ...lead,
    ...cells.map(({ row, column }) => ({ x: column + 0.5, y: row + 0.5 })),
  ]
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
}

type NonogramDifficultyPreviewProps = {
  difficulty: NonogramDifficulty;
};

export function NonogramDifficultyPreview({
  difficulty,
}: NonogramDifficultyPreviewProps) {
  const { size, cells } = createPreviewChain(difficulty);

  return (
    <span
      aria-hidden="true"
      // 最も高い盤面（15行）がプレビュー枠の高さ（56px）に収まるマスの大きさにする。
      // PC では、ほかのゲームのプレビューと並べて重さがそろう大きさにとどめる。
      className="flex h-14 w-full items-center [--preview-unit:3.7px] lg:h-28 lg:justify-center lg:[--preview-unit:6px]"
    >
      {/* マスの大きさをどのレベルでもそろえるため、図の大きさを盤面の列・行の数に比例させる。 */}
      <span
        className="relative shrink-0"
        style={{
          width: toPreviewLength(CHAIN_LEAD + size.width),
          height: toPreviewLength(size.height),
        }}
      >
        <span
          className="absolute inset-y-0 right-0 bg-background"
          style={{ width: toPreviewLength(size.width) }}
        >
          <PreviewGridLines width={size.width} height={size.height} />
          <span
            className={cn(
              "absolute inset-0 border-2",
              nonogramToneClassNames.blockLine,
            )}
          />
        </span>
        <svg
          className={cn(
            "absolute inset-0 size-full",
            nonogramToneClassNames.previewChain,
          )}
          viewBox={`${-CHAIN_LEAD} 0 ${CHAIN_LEAD + size.width} ${size.height}`}
        >
          <polyline
            points={formatChainPoints(cells)}
            fill="none"
            stroke="currentColor"
            strokeWidth={CHAIN_WIDTH}
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

export const _private = { previewChain, createPreviewChain };
