import { type CSSProperties, useEffect, useRef } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { useTouchTap } from "@/components/touch-tap";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import {
  getMagicSquareCellPosition,
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  listMagicSquareLinesThroughCell,
  type MagicSquareBoard as MagicSquareBoardCells,
  type MagicSquareLine,
} from "@/games/magic-square/puzzle/board";
import {
  isMagicSquareGivenCell,
  isMagicSquareLineViolation,
  type MagicSquareLineEvaluation,
  type MagicSquareLineStatus,
} from "@/games/magic-square/puzzle/rules";
import {
  getMagicSquareCellArea,
  getMagicSquareFrameUnits,
  getMagicSquareLineSumArea,
  MAGIC_SQUARE_MAGIC_SUM_AREA,
  MAGIC_SQUARE_SUM_BAND_RATIO,
} from "@/games/magic-square/ui/board/board-layout";
import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";
import { MOTION_EASING, playAnimations } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** チュートリアルで次に押すマスに付ける指の印。`recallId` は `TutorialCue` と同じ。 */
export type MagicSquareCellCue = {
  cellIndex: number;
  recallId: number | null;
};

type MagicSquareBoardProps = {
  givens: MagicSquareBoardCells;
  /** 最初から置いてある数を含む今の盤面。 */
  board: MagicSquareBoardCells;
  /** 並びは `listMagicSquareLines` と同じ。 */
  lineEvaluations: readonly MagicSquareLineEvaluation[];
  selectedCellIndex: number | null;
  interactionDisabled: boolean;
  clearing: boolean;
  onSelectCell: (cellIndex: number) => void;
  onClearAnimationComplete: () => void;
  /** チュートリアルだけが渡す。渡さなければ本番と同じに描く。 */
  cue?: MagicSquareCellCue | null;
};

/** マスの一辺に対する、くぼみと札の間の余白と角丸、数の字の大きさ。 */
const CELL_INSET_RATIO = 0.05;
const CELL_RADIUS_RATIO = 0.12;
const CELL_FONT_RATIO = 0.42;
const SUM_FONT_RATIO = 0.34;
const MAGIC_SUM_LABEL_FONT_RATIO = 0.22;
const MAGIC_SUM_LABEL_MIN_FONT_PX = 10;

/**
 * クリアの演出。行・縦の列・斜めの合計を順に弾ませ、最後に盤の面を明るくして仕上げる。
 * 動きを減らす設定と動かせない環境では、そろった盤面を少し見せてから結果へ進む。
 */
const CLEAR_STAGE_INTERVAL_MS = 280;
const CLEAR_SUM_POP_MS = 420;
const CLEAR_FINISH_MS = 520;
const CLEAR_HOLD_MS = 400;
const CLEAR_STILL_HOLD_MS = 600;
const clearStageKinds = ["row", "column", "diagonal"] as const;
const sumPopKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.35)", offset: 0.4 },
  { transform: "scale(1)" },
];
const finishKeyframes: Keyframe[] = [
  { filter: "brightness(1)" },
  { filter: "brightness(1.12)", offset: 0.45 },
  { filter: "brightness(1)" },
];

const lineSumColors = {
  incomplete: magicSquareTone.sumInk,
  matched: magicSquareTone.matched,
  unmatched: magicSquareTone.violated,
  overreached: magicSquareTone.violated,
} as const satisfies Record<MagicSquareLineStatus, string>;

function describeLine(line: MagicSquareLine): string {
  switch (line.kind) {
    case "row":
      return `${line.index + 1}行目`;
    case "column":
      return `${line.index + 1}列目`;
    case "diagonal":
      return line.from === "top-left" ? "左上からの斜め" : "右上からの斜め";
  }
}

function getLineKey(line: MagicSquareLine): string {
  return line.kind === "diagonal"
    ? `diagonal-${line.from}`
    : `${line.kind}-${line.index}`;
}

function scaleByCell(ratio: number): string {
  return `calc(var(--magic-square-cell) * ${ratio})`;
}

export function MagicSquareBoard({
  givens,
  board,
  lineEvaluations,
  selectedCellIndex,
  interactionDisabled,
  clearing,
  onSelectCell,
  onClearAnimationComplete,
  cue = null,
}: MagicSquareBoardProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const { getTapHandlers } = useTouchTap();
  const { size } = board;
  const units = getMagicSquareFrameUnits(size);
  const selectedLineCells = new Set(
    selectedCellIndex === null
      ? []
      : listMagicSquareLinesThroughCell(size, selectedCellIndex).flatMap(
          (line) => getMagicSquareLineCellIndices(size, line),
        ),
  );

  useEffect(() => {
    if (!clearing) {
      return;
    }
    return playAnimations({
      animate() {
        const frame = frameRef.current;
        if (typeof frame?.animate !== "function") {
          return [];
        }
        const sums = clearStageKinds.flatMap((kind, stage) =>
          Array.from(
            frame.querySelectorAll<HTMLElement>(`[data-line-kind="${kind}"]`),
            (element) =>
              element.animate(sumPopKeyframes, {
                duration: CLEAR_SUM_POP_MS,
                delay: stage * CLEAR_STAGE_INTERVAL_MS,
                easing: MOTION_EASING.celebrate,
              }),
          ),
        );
        const finish = frame.animate(finishKeyframes, {
          duration: CLEAR_FINISH_MS,
          delay: clearStageKinds.length * CLEAR_STAGE_INTERVAL_MS,
          easing: MOTION_EASING.standard,
        });
        return [...sums, finish];
      },
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: CLEAR_STILL_HOLD_MS,
      unanimatedHoldMs: CLEAR_STILL_HOLD_MS,
      onFinished: onClearAnimationComplete,
    });
  }, [clearing, onClearAnimationComplete]);

  const frameStyle = {
    "--magic-square-cell": `min(calc(100cqw / ${units.columns}), calc(100cqh / ${units.rows}))`,
    width: `calc(var(--magic-square-cell) * ${units.columns})`,
    height: `calc(var(--magic-square-cell) * ${units.rows})`,
    gridTemplateColumns: `${MAGIC_SQUARE_SUM_BAND_RATIO}fr repeat(${size}, 1fr) ${MAGIC_SQUARE_SUM_BAND_RATIO}fr`,
    gridTemplateRows: `repeat(${size}, 1fr) ${MAGIC_SQUARE_SUM_BAND_RATIO}fr`,
  } as CSSProperties;

  return (
    <div className="flex size-full items-center justify-center [container-type:size]">
      <div
        ref={frameRef}
        role="group"
        aria-label={`${MAGIC_SQUARE_DISPLAY_NAME}の盤面`}
        className="grid touch-manipulation select-none font-sans [-webkit-touch-callout:none]"
        style={frameStyle}
      >
        <div
          className="flex flex-col items-center justify-center leading-none"
          style={{
            gridRow: MAGIC_SQUARE_MAGIC_SUM_AREA.row,
            gridColumn: MAGIC_SQUARE_MAGIC_SUM_AREA.column,
          }}
        >
          <span
            style={{
              color: magicSquareTone.magicSumLabel,
              fontSize: `max(${MAGIC_SUM_LABEL_MIN_FONT_PX}px, ${scaleByCell(MAGIC_SUM_LABEL_FONT_RATIO)})`,
            }}
          >
            合計
          </span>
          <span
            className="font-bold tabular-nums"
            style={{
              color: magicSquareTone.givenInk,
              fontSize: scaleByCell(SUM_FONT_RATIO),
              marginTop: scaleByCell(0.06),
            }}
          >
            {getMagicSquareMagicSum(size)}
          </span>
        </div>
        {board.cells.map((cell, cellIndex) => {
          const { row, column } = getMagicSquareCellPosition(size, cellIndex);
          const area = getMagicSquareCellArea(size, cellIndex);
          const given = isMagicSquareGivenCell(givens, cellIndex);
          const selected = cellIndex === selectedCellIndex;
          const face =
            cell === null
              ? { backgroundColor: magicSquareTone.recess }
              : given
                ? { backgroundColor: magicSquareTone.slab }
                : {
                    backgroundColor: magicSquareTone.tablet,
                    boxShadow: `inset 0 0 0 1px ${magicSquareTone.tabletEdge}`,
                  };
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: マスの番号そのものが識別になる
              key={cellIndex}
              style={{
                gridRow: area.row,
                gridColumn: area.column,
                padding: scaleByCell(CELL_INSET_RATIO),
                backgroundColor: magicSquareTone.slab,
              }}
            >
              <button
                type="button"
                aria-label={`${row + 1}行${column + 1}列 ${cell ?? "空き"}`}
                aria-pressed={selected}
                data-given={given || undefined}
                className="relative flex size-full items-center justify-center outline-none"
                style={{
                  ...face,
                  borderRadius: scaleByCell(CELL_RADIUS_RATIO),
                  outline: selected
                    ? `3px solid ${magicSquareTone.selection}`
                    : undefined,
                  outlineOffset: selected ? "-1px" : undefined,
                }}
                {...getTapHandlers(() => {
                  if (!interactionDisabled) {
                    onSelectCell(cellIndex);
                  }
                })}
              >
                {!selected && selectedLineCells.has(cellIndex) && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[inherit]"
                    style={{ backgroundColor: magicSquareTone.selectedLine }}
                  />
                )}
                {cell !== null && (
                  <span
                    className={cn(
                      "relative tabular-nums leading-none",
                      given ? "font-bold" : "font-semibold",
                    )}
                    style={{
                      color: given
                        ? magicSquareTone.givenInk
                        : magicSquareTone.placedInk,
                      fontSize: scaleByCell(CELL_FONT_RATIO),
                    }}
                  >
                    {cell}
                  </span>
                )}
                {cue?.cellIndex === cellIndex && (
                  <TutorialCue
                    kind="pointer"
                    recallId={cue.recallId}
                    placement="center"
                  />
                )}
              </button>
            </div>
          );
        })}
        {lineEvaluations.map(({ line, sum, status }) => {
          const area = getMagicSquareLineSumArea(size, line);
          const violated = isMagicSquareLineViolation(status);
          return (
            <div
              key={getLineKey(line)}
              className="flex items-center justify-center"
              style={{ gridRow: area.row, gridColumn: area.column }}
            >
              <span
                aria-label={`${describeLine(line)}の合計 ${sum}`}
                data-line-kind={line.kind}
                data-line-status={status}
                className={cn(
                  "font-semibold tabular-nums leading-none",
                  violated &&
                    "underline decoration-[0.12em] underline-offset-[0.18em]",
                )}
                style={{
                  color: lineSumColors[status],
                  fontSize: scaleByCell(SUM_FONT_RATIO),
                }}
              >
                {sum}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
