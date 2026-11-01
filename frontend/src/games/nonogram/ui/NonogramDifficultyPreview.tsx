import type { CSSProperties } from "react";

import {
  type NonogramDifficulty,
  nonogramLevelCombinations,
} from "@/games/nonogram/difficulty";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

/**
 * 難易度プレビューは、盤面と上・左のヒントの欄に、行と列を交互に読んで1マスずつ決めていく「連鎖」を描いた模式図である。
 * 実際の問題ではない。
 *
 * - 盤面: そのレベルで遊ぶ盤面の大きさのうち最も大きいもの（`nonogramLevelCombinations` の `boardSizes` の最後）を、
 *   長い辺を横にして描く。プレビュー枠は横長（スマートフォンで 128×56px）なので、縦長のまま描くとマスが潰れ、
 *   ほかのゲームのプレビューより小さく軽く見えるため。マスの大きさはどのレベルでもそろえ、上のレベルほど盤面が広い。
 *   格子と5マスごとの線はプレイ画面と同じ色で描く。
 * - 連鎖: 1行目のヒントから読み始め、行の読みで決まったマスの列を読み、その列の読みで決まったマスの行を読む、を繰り返す。
 *   読む回数（`readingCounts`）は、そのレベルの問題集の連鎖の深さ（段の数）の中央値。
 *   読んだ行・列のヒントの欄と、読んで決まるマスを同じ色で示す。上のレベルの連鎖は下のレベルの連鎖の続きになる。
 * - 決まるマスが塗りか空白かは描かない（答えを描かない）。ヒントの数字と × は描かない。
 */
const previewChain = {
  readingCounts: { "1": 3, "2": 5, "3": 7, "4": 10, "5": 14 },
} as const satisfies {
  readingCounts: Record<NonogramDifficulty, number>;
};

/** 位置を数えやすくするため、この数のマスごとに濃い線を引く（プレイ画面の太い線と同じ間隔）。 */
const BLOCK_SIZE = 5;
/** 上・左のヒントの欄の幅（マス単位）。 */
const CLUE_BAND = 1.5;
/** ヒントの欄の1つ分を、隣の欄と外側から空ける幅（マス単位）。 */
const CLUE_INSET = 0.15;
/** ヒントの欄と盤面の間の幅（マス単位）。盤面の外周の線と重ねない。 */
const CLUE_GAP = 0.55;

// 読んだ行・列と決まるマスの色。プレイ画面で読んでいる行・列のヒントの地（`activeLine`）と同じ色相にし、
// 小さな図でも盤面の地と見分けられるよう濃くする。
const chainClassName = "bg-sky-300 dark:bg-sky-700";

type LineAxis = "row" | "column";
type ChainReading = { axis: LineAxis; index: number };
type CellPosition = { row: number; column: number };

type PreviewChain = {
  size: NonogramGridSize;
  readings: ChainReading[];
  /** 各読みで決まるマス。`readings` と同じ順。 */
  cells: CellPosition[];
};

function getPreviewBoardSize(difficulty: NonogramDifficulty): NonogramGridSize {
  const { boardSizes } = nonogramLevelCombinations[difficulty];
  const { width, height } = boardSizes[boardSizes.length - 1]!;
  return {
    width: Math.max(width, height),
    height: Math.min(width, height),
  };
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

function unit(value: number): string {
  return `calc(var(--preview-unit) * ${value})`;
}

function placeClue(axis: LineAxis, index: number): CSSProperties {
  const along = unit(CLUE_BAND + index + CLUE_INSET);
  const across = unit(CLUE_INSET);
  const thickness = unit(CLUE_BAND - CLUE_INSET - CLUE_GAP);
  const breadth = unit(1 - CLUE_INSET * 2);
  return axis === "row"
    ? { left: across, top: along, width: thickness, height: breadth }
    : { top: across, left: along, height: thickness, width: breadth };
}

type ClueBandProps = {
  axis: LineAxis;
  length: number;
  readings: readonly ChainReading[];
};

/** 盤面の左（行）または上（列）のヒントの欄。読んだ行・列の欄だけを連鎖の色にする。 */
function ClueBand({ axis, length, readings }: ClueBandProps) {
  const readIndices = new Set(
    readings.flatMap((reading) =>
      reading.axis === axis ? [reading.index] : [],
    ),
  );
  return Array.from({ length }, (_, index) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: 行・列の位置で決まる
      key={index}
      className={cn(
        "absolute rounded-[1px]",
        readIndices.has(index)
          ? chainClassName
          : nonogramToneClassNames.gridLineSurface,
      )}
      style={placeClue(axis, index)}
    />
  ));
}

/** マスの内側の境界のうち、5マスごとの境界（`block`）とそれ以外（`thin`）。 */
function listInnerBoundaries(length: number, kind: "thin" | "block") {
  return Array.from({ length: length - 1 }, (_, index) => index + 1).filter(
    (offset) => (offset % BLOCK_SIZE === 0) === (kind === "block"),
  );
}

const lineToneClassNames = {
  thin: nonogramToneClassNames.gridLine,
  block: nonogramToneClassNames.blockLine,
} as const;

/** 盤面の格子。細い線を先、5マスごとの線を後に描き、5マスごとの線を上に出す。 */
function GridLines({ width, height }: NonogramGridSize) {
  return (["thin", "block"] as const).flatMap((kind) => [
    ...listInnerBoundaries(width, kind).map((column) => (
      <span
        key={`${kind}-column-${column}`}
        className={cn("absolute inset-y-0 border-l", lineToneClassNames[kind])}
        style={{ left: unit(column) }}
      />
    )),
    ...listInnerBoundaries(height, kind).map((row) => (
      <span
        key={`${kind}-row-${row}`}
        className={cn("absolute inset-x-0 border-t", lineToneClassNames[kind])}
        style={{ top: unit(row) }}
      />
    )),
  ]);
}

type NonogramDifficultyPreviewProps = {
  difficulty: NonogramDifficulty;
};

export function NonogramDifficultyPreview({
  difficulty,
}: NonogramDifficultyPreviewProps) {
  const { size, readings, cells } = createPreviewChain(difficulty);
  const boardPlacement = {
    left: unit(CLUE_BAND),
    top: unit(CLUE_BAND),
    width: unit(size.width),
    height: unit(size.height),
  };

  return (
    <span
      aria-hidden="true"
      // 盤面（10行）とヒントの欄がプレビュー枠の高さ（56px）に収まり、最も広い盤面（15列）が枠の幅（128px）に
      // 収まるマスの大きさにする。PC では、ほかのゲームのプレビューと並べて重さがそろう大きさにとどめる。
      className="flex h-14 w-full items-center [--preview-unit:4.75px] lg:h-28 lg:justify-center lg:[--preview-unit:5.5px]"
    >
      {/* マスの大きさをどのレベルでもそろえるため、図の大きさを盤面の列・行の数に比例させる。 */}
      <span
        className="relative shrink-0"
        style={{
          width: unit(CLUE_BAND + size.width),
          height: unit(CLUE_BAND + size.height),
        }}
      >
        <ClueBand axis="row" length={size.height} readings={readings} />
        <ClueBand axis="column" length={size.width} readings={readings} />
        <span
          className="absolute overflow-hidden bg-background"
          style={boardPlacement}
        >
          {cells.map(({ row, column }) => (
            <span
              key={`${row}-${column}`}
              className={cn("absolute", chainClassName)}
              style={{
                left: unit(column),
                top: unit(row),
                width: unit(1),
                height: unit(1),
              }}
            />
          ))}
          <GridLines {...size} />
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

export const _private = { previewChain, createPreviewChain };
