import { type CSSProperties, useEffect, useLayoutEffect, useRef } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { useTouchTap } from "@/components/touch-tap";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import {
  getMagicSquareCellPosition,
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  isSameMagicSquareLine,
  listMagicSquareLinesThroughCell,
  type MagicSquareBoard as MagicSquareBoardCells,
  type MagicSquareLine,
} from "@/games/magic-square/puzzle/board";
import {
  isMagicSquareGivenCell,
  isMagicSquareLineViolation,
  MAGIC_SQUARE_MEMO_CAPACITY,
  type MagicSquareLineEvaluation,
  type MagicSquareLineStatus,
} from "@/games/magic-square/puzzle/rules";
import type { MagicSquareMemo } from "@/games/magic-square/puzzle/state";
import {
  getMagicSquareFrameUnits,
  getMagicSquareLineSumArea,
  getMagicSquareSlabArea,
  MAGIC_SQUARE_CELL_INSET_RATIO,
  MAGIC_SQUARE_MAGIC_SUM_AREA,
  MAGIC_SQUARE_SLAB_RIM_RATIO,
  MAGIC_SQUARE_SUM_BAND_RATIO,
} from "@/games/magic-square/ui/board/board-layout";
import {
  animateMagicSquareClear,
  MAGIC_SQUARE_CLEAR_HOLD_MS,
  MAGIC_SQUARE_CLEAR_STILL_HOLD_MS,
} from "@/games/magic-square/ui/board/clear-animation";
import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";
import { playAnimations, playRejectionShake } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** チュートリアルで次に押すマスに付ける指の印。`recallId` は `TutorialCue` と同じ。 */
export type MagicSquareCellCue = {
  cellIndex: number;
  recallId: number | null;
};

/** 受け付けなかった操作の知らせ。`id` が変わるたびに、そのマスを揺らす。 */
export type MagicSquareCellRejection = {
  id: number;
  cellIndex: number;
};

type MagicSquareBoardProps = {
  givens: MagicSquareBoardCells;
  /** 最初から置いてある数を含む今の盤面。 */
  board: MagicSquareBoardCells;
  /** マスごとのメモ。渡さなければ、どのマスにもメモを描かない。 */
  memos?: readonly MagicSquareMemo[];
  /** 並びは `listMagicSquareLines` と同じ。 */
  lineEvaluations: readonly MagicSquareLineEvaluation[];
  selectedCellIndex: number | null;
  interactionDisabled: boolean;
  clearing: boolean;
  onSelectCell: (cellIndex: number) => void;
  onClearAnimationComplete: () => void;
  rejection?: MagicSquareCellRejection | null;
  /** チュートリアルだけが渡す。渡さなければ本番と同じに描く。 */
  cue?: MagicSquareCellCue | null;
};

/** マスの一辺に対する、角丸と字の大きさ。 */
const SLAB_RADIUS_RATIO = 0.16;
const CELL_RADIUS_RATIO = 0.12;
const CELL_FONT_RATIO = 0.42;
const MEMO_FONT_RATIO = 0.26;
const SUM_FONT_RATIO = 0.34;
const MAGIC_SUM_LABEL_FONT_RATIO = 0.22;
const MAGIC_SUM_LABEL_MIN_FONT_PX = 10;
/** 斜めの合計を、刻みの線の分だけ角の外へ寄せる幅。 */
const DIAGONAL_SUM_OFFSET_RATIO = 0.07;

const cellShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-6%)" },
  { transform: "translateX(6%)" },
  { transform: "translateX(-3%)" },
  { transform: "translateX(0)" },
];

const lineSumColors = {
  incomplete: magicSquareTone.sumInk,
  matched: magicSquareTone.matched,
  unmatched: magicSquareTone.violated,
  overreached: magicSquareTone.violated,
} as const satisfies Record<MagicSquareLineStatus, string>;

const selectedLineImage = `linear-gradient(${magicSquareTone.selectedLine}, ${magicSquareTone.selectedLine})`;

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

/**
 * マスの面。空きはくぼみ、置いた数はくぼみに収めた札、最初から置いてある数は盤の面に刻んだ字で、面を持たない。
 * 選んだマスを通る列では、面にも列の薄い色を重ねる。
 */
function getCellFaceStyle(
  kind: "empty" | "placed" | "given",
  onSelectedLine: boolean,
): CSSProperties {
  const lineImage = onSelectedLine ? selectedLineImage : undefined;
  switch (kind) {
    case "empty":
      return {
        backgroundColor: magicSquareTone.recess,
        backgroundImage: lineImage,
        boxShadow: `inset 0 ${scaleByCell(0.05)} ${scaleByCell(0.08)} rgba(43,39,34,0.32), inset 0 -1px 0 rgba(255,255,255,0.3)`,
      };
    case "placed":
      return {
        backgroundColor: magicSquareTone.tablet,
        backgroundImage: lineImage,
        boxShadow: `inset 0 -${scaleByCell(0.05)} 0 rgba(43,39,34,0.14), 0 ${scaleByCell(0.03)} ${scaleByCell(0.05)} rgba(43,39,34,0.38)`,
      };
    case "given":
      return {};
  }
}

function CellMemo({ memo }: { memo: MagicSquareMemo }) {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-full grid-cols-2 grid-rows-2 place-items-center font-medium tabular-nums leading-none"
      style={{
        color: magicSquareTone.memoInk,
        fontSize: scaleByCell(MEMO_FONT_RATIO),
        padding: scaleByCell(0.03),
      }}
    >
      {Array.from({ length: MAGIC_SQUARE_MEMO_CAPACITY }, (_, slot) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: メモの枠は位置そのものが識別になる
        <span key={slot}>{memo[slot] ?? ""}</span>
      ))}
    </span>
  );
}

/** 斜めの合計の角に、盤の角から合計へ向かって刻む短い線。斜めの列の続きに見せ、縦の列の合計と見分ける。 */
function DiagonalMark({ from }: { from: "top-left" | "top-right" }) {
  const [startX, endX] = from === "top-left" ? [0.1, 0.3] : [0.9, 0.7];
  return (
    <svg
      aria-hidden="true"
      data-diagonal-mark=""
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      <line
        x1={startX}
        y1={0.1}
        x2={endX}
        y2={0.3}
        stroke={magicSquareTone.magicSumLabel}
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** 斜めの合計と、その下に敷く選んだ列の色を寄せる向き。どちらも盤の角から離れる向きで、下へは同じ幅だけ寄せる。 */
function getDiagonalSumOffset(from: "top-left" | "top-right"): string {
  const horizontal =
    from === "top-left"
      ? DIAGONAL_SUM_OFFSET_RATIO
      : -DIAGONAL_SUM_OFFSET_RATIO;
  return `${scaleByCell(horizontal)} ${scaleByCell(DIAGONAL_SUM_OFFSET_RATIO)}`;
}

function describeCell(
  row: number,
  column: number,
  cell: number | null,
  memo: MagicSquareMemo,
): string {
  const position = `${row + 1}行${column + 1}列`;
  if (cell !== null) {
    return `${position} ${cell}`;
  }
  return memo.length > 0
    ? `${position} 空き メモ ${memo.join(" ")}`
    : `${position} 空き`;
}

export function MagicSquareBoard({
  givens,
  board,
  memos,
  lineEvaluations,
  selectedCellIndex,
  interactionDisabled,
  clearing,
  onSelectCell,
  onClearAnimationComplete,
  rejection = null,
  cue = null,
}: MagicSquareBoardProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cellElementRefs = useRef(new Map<number, HTMLButtonElement>());
  // 同じ知らせは描き直しても一度だけ揺らす。描き始めにある知らせは、再読み込みで戻した前の操作なので揺らさない。
  const shownRejectionIdRef = useRef(rejection?.id ?? null);
  const { getTapHandlers } = useTouchTap();
  const { size } = board;
  const units = getMagicSquareFrameUnits(size);
  const selectedLines =
    selectedCellIndex === null
      ? []
      : listMagicSquareLinesThroughCell(size, selectedCellIndex);
  const selectedLineCells = new Set(
    selectedLines.flatMap((line) => getMagicSquareLineCellIndices(size, line)),
  );
  const slabArea = getMagicSquareSlabArea(size);

  useLayoutEffect(() => {
    if (!rejection || shownRejectionIdRef.current === rejection.id) {
      return;
    }
    shownRejectionIdRef.current = rejection.id;
    playRejectionShake(
      cellElementRefs.current.get(rejection.cellIndex),
      cellShakeKeyframes,
      { durationMs: 220, easing: "ease-out" },
    );
  }, [rejection]);

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
        return animateMagicSquareClear(frame, size);
      },
      completion: {
        type: "after-animations",
        holdMs: MAGIC_SQUARE_CLEAR_HOLD_MS,
      },
      reducedMotionHoldMs: MAGIC_SQUARE_CLEAR_STILL_HOLD_MS,
      unanimatedHoldMs: MAGIC_SQUARE_CLEAR_STILL_HOLD_MS,
      onFinished: onClearAnimationComplete,
    });
  }, [clearing, onClearAnimationComplete, size]);

  const frameStyle = {
    "--magic-square-cell": `min(calc(100cqw / ${units.columns}), calc(100cqh / ${units.rows}))`,
    width: scaleByCell(units.columns),
    height: scaleByCell(units.rows),
    paddingTop: scaleByCell(MAGIC_SQUARE_SLAB_RIM_RATIO),
    gridTemplateColumns: `${MAGIC_SQUARE_SUM_BAND_RATIO}fr repeat(${size}, 1fr) ${MAGIC_SQUARE_SUM_BAND_RATIO}fr`,
    gridTemplateRows: `repeat(${size}, 1fr) ${MAGIC_SQUARE_SUM_BAND_RATIO}fr`,
  } as CSSProperties;

  return (
    <div className="flex size-full items-center justify-center [container-type:size]">
      <div
        ref={frameRef}
        role="group"
        aria-label={`${MAGIC_SQUARE_DISPLAY_NAME}の盤面`}
        className="box-border grid touch-manipulation select-none font-sans [-webkit-touch-callout:none]"
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
            data-magic-sum=""
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
        <div
          className="grid"
          style={{
            gridRow: slabArea.row,
            gridColumn: slabArea.column,
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
            margin: scaleByCell(-MAGIC_SQUARE_SLAB_RIM_RATIO),
            padding: scaleByCell(MAGIC_SQUARE_SLAB_RIM_RATIO),
            borderRadius: scaleByCell(SLAB_RADIUS_RATIO),
            backgroundColor: magicSquareTone.slab,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(43,39,34,0.12), 0 1px 3px rgba(43,39,34,0.22)",
          }}
        >
          {board.cells.map((cell, cellIndex) => {
            const { row, column } = getMagicSquareCellPosition(size, cellIndex);
            const given = isMagicSquareGivenCell(givens, cellIndex);
            const selected = cellIndex === selectedCellIndex;
            const onSelectedLine = selectedLineCells.has(cellIndex);
            const memo = cell === null ? (memos?.[cellIndex] ?? []) : [];
            const faceKind =
              cell === null ? "empty" : given ? "given" : "placed";
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: マスの番号そのものが識別になる
                key={cellIndex}
                style={{
                  padding: scaleByCell(MAGIC_SQUARE_CELL_INSET_RATIO),
                  backgroundImage: onSelectedLine
                    ? selectedLineImage
                    : undefined,
                }}
              >
                <button
                  ref={(element) => {
                    if (!element) {
                      return;
                    }
                    cellElementRefs.current.set(cellIndex, element);
                    return () => {
                      cellElementRefs.current.delete(cellIndex);
                    };
                  }}
                  type="button"
                  aria-label={describeCell(row, column, cell, memo)}
                  aria-pressed={selected}
                  data-given={given || undefined}
                  className="relative flex size-full items-center justify-center outline-none"
                  style={{
                    ...getCellFaceStyle(faceKind, onSelectedLine),
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
                  {/* 光は数の字の下に敷き、字を薄めない。 */}
                  {(["first", "second"] as const).map((layer) => (
                    <span
                      key={layer}
                      aria-hidden="true"
                      data-clear-glint={layer}
                      data-row={row}
                      data-column={column}
                      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0"
                      style={{ backgroundColor: magicSquareTone.clearGlint }}
                    />
                  ))}
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
                        textShadow: given
                          ? "0 1px 0 rgba(255,255,255,0.4)"
                          : undefined,
                      }}
                    >
                      {cell}
                    </span>
                  )}
                  {memo.length > 0 && <CellMemo memo={memo} />}
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
        </div>
        {lineEvaluations.map(({ line, sum, status }) => {
          const area = getMagicSquareLineSumArea(size, line);
          const violated = isMagicSquareLineViolation(status);
          const onSelectedLine = selectedLines.some((selectedLine) =>
            isSameMagicSquareLine(selectedLine, line),
          );
          const diagonalFrom = line.kind === "diagonal" ? line.from : null;
          const sumOffset =
            diagonalFrom === null
              ? undefined
              : getDiagonalSumOffset(diagonalFrom);
          return (
            <div
              key={getLineKey(line)}
              className="relative flex items-center justify-center"
              style={{ gridRow: area.row, gridColumn: area.column }}
            >
              {onSelectedLine && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{
                    inset: scaleByCell(0.1),
                    translate: sumOffset,
                    borderRadius: scaleByCell(CELL_RADIUS_RATIO),
                    backgroundColor: magicSquareTone.selectedLine,
                  }}
                />
              )}
              {diagonalFrom && <DiagonalMark from={diagonalFrom} />}
              <span
                aria-label={`${describeLine(line)}の合計 ${sum}`}
                data-line-kind={line.kind}
                data-line-status={status}
                className={cn(
                  "relative font-semibold tabular-nums leading-none",
                  violated &&
                    "underline decoration-wavy decoration-[0.08em] underline-offset-[0.22em]",
                )}
                style={{
                  color: lineSumColors[status],
                  fontSize: scaleByCell(SUM_FONT_RATIO),
                  translate: sumOffset,
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
