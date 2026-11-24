import { type CSSProperties, useLayoutEffect, useRef } from "react";

import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import {
  HowToPlayVerdictMark,
  type HowToPlayVerdictMarkKind,
} from "@/components/HowToPlayVerdictMark";
import { UndoButton } from "@/components/UndoButton";
import {
  getMagicSquareFrameUnits,
  type MagicSquareBoardRegion,
} from "@/games/magic-square/ui/board/board-layout";
import {
  ExampleBoard,
  getMagicSquareExampleWidth,
  MAGIC_SQUARE_EXAMPLE_PAD_WIDTH,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/ExampleBoard";
import {
  getMagicSquareExampleCellIndex,
  judgeMagicSquareExampleCell,
  judgeMagicSquareExampleRow,
  MAGIC_SQUARE_EXAMPLE_SIZE,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import type { MagicSquareHowToPlayExample } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";
import {
  magicSquareCellHintPlacement,
  magicSquareControlHintPlacement,
  magicSquareMarkedCellHintPlacement,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/press-hint-placement";
import {
  useTouchableExample,
  withExampleSelection,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/use-touchable-example";
import { MagicSquareMemoToggle } from "@/games/magic-square/ui/MagicSquareMemoToggle";
import { MagicSquareNumberPad } from "@/games/magic-square/ui/MagicSquareNumberPad";
import { splitMagicSquareRejection } from "@/games/magic-square/ui/magic-square-rejection";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  playRejectionShake,
} from "@/lib/motion";

/**
 * 例の下に添える言葉。
 * - `line`: 形のルールの判定（✓ そろう / ✕ そろわない / 途中）と ✕ のわけ。盤面ごとに、その行の列で判定する。
 * - `given`: 最初から置いてある数のルールの、数のあるマスごとの ✓ / ✕ の印と、その凡例（✓ 変えられる / ✕ 変えられない）。
 * - `used-values`: 盤面の下に並んだ数のくぼみの数に付けた ✕ の印と、その凡例。
 */
type TouchableExampleCaption = "line" | "given" | "used-values";

type TouchableExampleProps = {
  example: MagicSquareHowToPlayExample;
  caption?: TouchableExampleCaption;
};

const shapeLabels = { allowed: "そろう", disallowed: "そろわない" };
const givenLabels = { allowed: "変えられる", disallowed: "変えられない" };
const valueLabels = { allowed: "置ける", disallowed: "置けない" };

/** 数の札の手がかりの単位。札の高さ（本番と同じ 44px）にする。 */
const valueUnitStyle = {
  "--how-to-play-unit": "2.75rem",
} as CSSProperties;

/** 盤面のマスの手がかりの単位。盤面部品が描くマスの大きさにする。 */
const cellUnitStyle = {
  "--how-to-play-unit": "var(--magic-square-cell)",
} as CSSProperties;

/** 受け付けなかった手で、そのわけの印を一度だけふくらませる。 */
const markPulseKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.5)" },
  { transform: "scale(1)" },
];

/** 範囲のマスの番号。行ごとに左から並べる。 */
function listRegionCellIndexes(region: MagicSquareBoardRegion): number[] {
  return Array.from({ length: region.rowCount }, (_, rowOffset) =>
    Array.from({ length: region.columnCount }, (_, columnOffset) =>
      getMagicSquareExampleCellIndex([
        region.row + rowOffset,
        region.column + columnOffset,
      ]),
    ),
  ).flat();
}

type CornerVerdictMarkProps = {
  verdict: HowToPlayVerdictMarkKind;
  /** 受け付けなかった手の知らせの番号。変わるたびに印をふくらませる。描き始めにある番号ではふくらませない。 */
  pulseId: number | null;
};

/**
 * マスと数の札の右上の角に、半分を外へ出して置く ✓ / ✕ の印。中身の数と、縁や内側に引く手がかりの枠を隠さない。
 * その印のわけで受け付けなかった手では、盤面の揺れと合わせて印を一度ふくらませ、弾かれたわけを指す。
 */
function CornerVerdictMark({ verdict, pulseId }: CornerVerdictMarkProps) {
  const markRef = useRef<HTMLSpanElement>(null);
  const shownPulseIdRef = useRef(pulseId);

  useLayoutEffect(() => {
    if (pulseId === null || shownPulseIdRef.current === pulseId) {
      return;
    }
    shownPulseIdRef.current = pulseId;
    playRejectionShake(markRef.current, markPulseKeyframes, {
      durationMs: MOTION_DURATION_MS.slow,
      easing: MOTION_EASING.standard,
    });
  }, [pulseId]);

  return (
    <span ref={markRef} className="absolute -top-1.5 -right-1.5 size-3.5">
      <HowToPlayVerdictMark verdict={verdict} placement="board-tag" />
    </span>
  );
}

/**
 * 触れる例の面の中身。盤面ごとに、本番と同じく盤面の下にその盤面の数を並べ、待ったとメモの切り替えをその後ろに置く。
 * 本番と同じく、マスを押して選び、数を押して置く。列の合計と色、受け付けない押し方の揺れは、本番と同じく今の盤面から出す。
 * 次に押す所には、盤面のマスか、数の札か、メモの切り替えに手がかりを付ける。数の札の手がかりは、選んでいる盤面の下の数に付ける。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const {
    state,
    valueStatesFor,
    hint,
    operation,
    operationBoard,
    cleared,
    canUndoFor,
    selectCell,
    enterValue,
    toggleMemoInput,
    undo,
  } = useTouchableExample(example.boards, example.hints);
  const rejection = splitMagicSquareRejection(operation);
  const columns = Math.max(
    ...example.boards.map(
      ({ region }) =>
        getMagicSquareFrameUnits(MAGIC_SQUARE_EXAMPLE_SIZE, region).columns,
    ),
  );
  const boardWidth = getMagicSquareExampleWidth(columns);
  const hintedValueBoard = state.selection?.board ?? 0;

  return (
    <>
      {example.boards.map((definition, boardIndex) => {
        const session = state.sessions[boardIndex];
        if (session === undefined) {
          return null;
        }
        const selected = withExampleSelection(session, state, boardIndex);
        const valueStates = valueStatesFor(boardIndex);
        const boardRejection =
          operationBoard === boardIndex
            ? rejection
            : { cell: null, value: null };
        const hintedCellIndex =
          hint?.kind === "cell" && hint.board === boardIndex
            ? hint.cellIndex
            : null;
        const hintedValue =
          hint?.kind === "value" && hintedValueBoard === boardIndex
            ? hint.value
            : null;
        const row = judgeMagicSquareExampleRow(session, definition.region);
        const cellMarks =
          caption === "given"
            ? listRegionCellIndexes(definition.region).flatMap((cellIndex) => {
                const verdict = judgeMagicSquareExampleCell(session, cellIndex);
                return verdict === null ? [] : [{ cellIndex, verdict }];
              })
            : [];
        const usedValueShown =
          caption === "used-values" && valueStates.includes("used");
        const trailingActions = example.controls.map((control) =>
          control === "undo" ? (
            <UndoButton
              key="undo"
              disabled={!canUndoFor(boardIndex)}
              onUndo={() => undo(boardIndex)}
            />
          ) : (
            <MagicSquareMemoToggle
              key="memo"
              active={state.inputMode === "memo"}
              disabled={cleared}
              onToggle={toggleMemoInput}
              overlay={
                hint?.kind === "memo" ? (
                  <HowToPlayPressHint {...magicSquareControlHintPlacement} />
                ) : null
              }
            />
          ),
        );
        return (
          <HowToPlayExample
            // biome-ignore lint/suspicious/noArrayIndexKey: 面の中の盤面は、並び順そのものが識別になる
            key={boardIndex}
            figure={
              <div className="flex flex-col items-center gap-3">
                <ExampleBoard
                  session={session}
                  region={definition.region}
                  selectedCellIndex={selected.selectedCellIndex}
                  width={boardWidth}
                  rejection={boardRejection.cell}
                  onSelectCell={(cellIndex) =>
                    selectCell(boardIndex, cellIndex)
                  }
                  renderCellOverlay={(cellIndex) => {
                    const mark = cellMarks.find(
                      (cellMark) => cellMark.cellIndex === cellIndex,
                    );
                    if (cellIndex !== hintedCellIndex && mark === undefined) {
                      return null;
                    }
                    return (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-[inherit]"
                        style={cellUnitStyle}
                      >
                        {mark !== undefined ? (
                          <CornerVerdictMark
                            verdict={mark.verdict}
                            pulseId={
                              boardRejection.cell?.cellIndex === cellIndex
                                ? boardRejection.cell.id
                                : null
                            }
                          />
                        ) : null}
                        {cellIndex === hintedCellIndex ? (
                          <HowToPlayPressHint
                            {...(mark === undefined
                              ? magicSquareCellHintPlacement
                              : magicSquareMarkedCellHintPlacement)}
                          />
                        ) : null}
                      </span>
                    );
                  }}
                />
                <div style={{ width: MAGIC_SQUARE_EXAMPLE_PAD_WIDTH }}>
                  <MagicSquareNumberPad
                    size={MAGIC_SQUARE_EXAMPLE_SIZE}
                    valueStates={valueStates}
                    memoInput={state.inputMode === "memo"}
                    interactionDisabled={cleared}
                    rejection={boardRejection.value}
                    onEnterValue={(value) => enterValue(boardIndex, value)}
                    trailingActions={trailingActions}
                    renderValueOverlay={(value) => {
                      const marked =
                        caption === "used-values" &&
                        valueStates[value - 1] === "used";
                      if (!marked && value !== hintedValue) {
                        return null;
                      }
                      return (
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={valueUnitStyle}
                        >
                          {marked ? (
                            <CornerVerdictMark
                              verdict="disallowed"
                              pulseId={null}
                            />
                          ) : null}
                          {value === hintedValue ? (
                            <HowToPlayPressHint
                              {...magicSquareCellHintPlacement}
                            />
                          ) : null}
                        </span>
                      );
                    }}
                  />
                </div>
              </div>
            }
            caption={
              caption === "line" ? (
                <HowToPlayVerdict
                  verdict={row.verdict}
                  labels={shapeLabels}
                  ruleReason={row.reason ?? undefined}
                />
              ) : caption === "given" ? (
                <HowToPlayMarkLegend
                  labels={givenLabels}
                  shownMarks={{
                    allowed: cellMarks.some(
                      ({ verdict }) => verdict === "allowed",
                    ),
                    disallowed: cellMarks.some(
                      ({ verdict }) => verdict === "disallowed",
                    ),
                  }}
                />
              ) : caption === "used-values" ? (
                <HowToPlayMarkLegend
                  labels={valueLabels}
                  shownMarks={{ allowed: false, disallowed: usedValueShown }}
                />
              ) : undefined
            }
          />
        );
      })}
    </>
  );
}
