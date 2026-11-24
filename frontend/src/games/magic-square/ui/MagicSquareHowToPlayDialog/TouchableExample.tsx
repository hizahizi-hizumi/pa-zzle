import type { CSSProperties } from "react";

import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import {
  HowToPlayVerdictMark,
  type HowToPlayVerdictMarkKind,
} from "@/components/HowToPlayVerdictMark";
import { UndoButton } from "@/components/UndoButton";
import {
  isMagicSquareGivenCell,
  MAGIC_SQUARE_MEMO_CAPACITY,
  type MagicSquareValueState,
} from "@/games/magic-square/puzzle/rules";
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
  isMagicSquareExampleMemoFull,
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
import { useTouchableExample } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/use-touchable-example";
import { MagicSquareMemoToggle } from "@/games/magic-square/ui/MagicSquareMemoToggle";
import { MagicSquareNumberPad } from "@/games/magic-square/ui/MagicSquareNumberPad";
import { splitMagicSquareRejection } from "@/games/magic-square/ui/magic-square-rejection";

/**
 * 例の下に添える言葉。
 * - `line`: 形のルールの判定（✓ そろう / ✕ そろわない / 途中）と ✕ のわけ。盤面ごとに、その行の列で判定する。
 * - `given`: 最初から置いてある数のルールの、数のあるマスごとの ✓ / ✕ の印と、その凡例（✓ 変えられる / ✕ 変えられない）。
 *   最初から置いてある数のマスで数を押して受け付けられなかった間は、凡例の場所にそのわけを出す（本番の揺れが小さく、音を切ると分からないため）。
 * - `used-values`: 盤面の下に並んだ数ごとの ✓ / ✕ の印と、その凡例（✓ まだ置ける / ✕ もう置いてある）。
 * - `memo-limit`: メモが4つ書いてあるマスに5つ目を書こうとして受け付けられなかったときだけ、そのわけを出す。
 */
type TouchableExampleCaption = "line" | "given" | "used-values" | "memo-limit";

type TouchableExampleProps = {
  example: MagicSquareHowToPlayExample;
  caption?: TouchableExampleCaption;
};

const shapeLabels = { allowed: "そろう", disallowed: "そろわない" };
const givenLabels = { allowed: "変えられる", disallowed: "変えられない" };
/** 札の今の状態を言う凡例。例の下の言葉が、今した手の結果ではなく札の印の意味だと読めるよう、「まだ」「もう」で言う。 */
const valueLabels = { allowed: "まだ置ける", disallowed: "もう置いてある" };

/** 数の札の手がかりの単位。札の高さ（本番と同じ 44px）にする。 */
const valueUnitStyle = {
  "--how-to-play-unit": "2.75rem",
} as CSSProperties;

/**
 * マスの右上の角の内側に置く ✓ / ✕ の印。大きさは単位（マスの短い辺）の 0.28 倍にし、12〜20px に収める。
 * 中央の数にかからず、隣のマスとの間にもはみ出さない。単位は、マスの箱をコンテナにして受け取る。
 */
const cellMarkStyle = {
  width: "clamp(12px, 28cqmin, 20px)",
  height: "clamp(12px, 28cqmin, 20px)",
  top: "max(2px, 4cqmin)",
  right: "max(2px, 4cqmin)",
} as const satisfies CSSProperties;

/**
 * 数の札の右上の角に置く ✓ / ✕ の印。札は狭い画面で幅が 29px まで狭まり、2桁の数が札の幅いっぱいに近づくので、
 * 印を札の上端に掛けて数の字より上に置く。上と右へのはみ出しは、札どうしの間（4px）に収める。
 */
const valueMarkStyle = {
  width: "12px",
  height: "12px",
  top: "-3px",
  right: "-1px",
} as const satisfies CSSProperties;

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

function CornerVerdictMark({
  verdict,
  style,
}: {
  verdict: HowToPlayVerdictMarkKind;
  style: CSSProperties;
}) {
  return (
    <span className="absolute" style={style}>
      <HowToPlayVerdictMark verdict={verdict} placement="board-tag" />
    </span>
  );
}

/** 盤面の下に並んだ数の状態ごとの印。置ける数に ✓、盤面にある数（くぼみ）に ✕。選んだマスの数（押すと外す札）には付けない。 */
const valueVerdicts = {
  available: "allowed",
  used: "disallowed",
  selected: null,
} as const satisfies Record<
  MagicSquareValueState,
  HowToPlayVerdictMarkKind | null
>;

/**
 * 触れる例の面の中身。盤面ごとに、本番と同じく盤面の下にその盤面の数を並べ、待ったとメモの切り替えをその後ろに置く。
 * 本番と同じく、マスを押して選び、数を押して置く。列の合計と色、受け付けない押し方の揺れは、本番と同じく今の盤面から出す。
 * 次に押す所には、盤面のマスか、数の札か、メモの切り替えに手がかりを付ける。数の札の手がかりは、手がかりの手が指す盤面の下の数に付ける。
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

  return (
    <>
      {example.boards.map((definition, boardIndex) => {
        const session = state.sessions[boardIndex];
        if (session === undefined) {
          return null;
        }
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
          hint?.kind === "value" && hint.board === boardIndex
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
        const valueMarks =
          caption === "used-values"
            ? valueStates.map((valueState) => valueVerdicts[valueState])
            : [];
        const givenRejected =
          caption === "given" &&
          operation?.type === "rejected" &&
          operation.cellIndex !== null &&
          operationBoard === boardIndex &&
          isMagicSquareGivenCell(session.problem.givens, operation.cellIndex);
        const memoLimitShown =
          caption === "memo-limit" &&
          operation?.type === "rejected" &&
          operation.cellIndex !== null &&
          operationBoard === boardIndex &&
          state.inputMode === "memo" &&
          isMagicSquareExampleMemoFull(
            session,
            operation.cellIndex,
            operation.value,
          );
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
                  selectedCellIndex={session.selectedCellIndex}
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
                      // 手がかりと印の単位を、このマスの大きさにする。
                      <span className="pointer-events-none absolute inset-0 rounded-[inherit] [container-type:size]">
                        {mark !== undefined ? (
                          <CornerVerdictMark
                            verdict={mark.verdict}
                            style={cellMarkStyle}
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
                      const verdict = valueMarks[value - 1] ?? null;
                      if (verdict === null && value !== hintedValue) {
                        return null;
                      }
                      return (
                        <span
                          className="pointer-events-none absolute inset-0 [container-type:size]"
                          style={valueUnitStyle}
                        >
                          {verdict !== null ? (
                            <CornerVerdictMark
                              verdict={verdict}
                              style={valueMarkStyle}
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
                <HowToPlayCaptionLayers
                  layers={[
                    {
                      id: "legend",
                      shown: !givenRejected,
                      content: (
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
                      ),
                    },
                    {
                      id: "given-rejected",
                      shown: givenRejected,
                      content: (
                        <HowToPlayVerdictLine
                          mark={<HowToPlayVerdictMark verdict="disallowed" />}
                        >
                          最初から置いてある数
                        </HowToPlayVerdictLine>
                      ),
                    },
                  ]}
                />
              ) : caption === "used-values" ? (
                <HowToPlayMarkLegend
                  labels={valueLabels}
                  shownMarks={{
                    allowed: valueMarks.includes("allowed"),
                    disallowed: valueMarks.includes("disallowed"),
                  }}
                />
              ) : caption === "memo-limit" ? (
                <HowToPlayCaptionLayers
                  layers={[
                    {
                      id: "memo-limit",
                      shown: memoLimitShown,
                      content: (
                        <HowToPlayVerdictLine
                          mark={<HowToPlayVerdictMark verdict="disallowed" />}
                        >
                          {`メモは${MAGIC_SQUARE_MEMO_CAPACITY}つまで`}
                        </HowToPlayVerdictLine>
                      ),
                    },
                  ]}
                />
              ) : undefined
            }
          />
        );
      })}
    </>
  );
}
