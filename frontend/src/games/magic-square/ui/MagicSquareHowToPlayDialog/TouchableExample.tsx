import type { CSSProperties } from "react";

import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import {
  getMagicSquareFrameUnits,
  type MagicSquareBoardRegion,
} from "@/games/magic-square/ui/board/board-layout";
import {
  ExampleBoard,
  getMagicSquareExampleWidth,
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
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/press-hint-placement";
import {
  useTouchableExample,
  withExampleSelection,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/use-touchable-example";
import { MagicSquareMemoToggle } from "@/games/magic-square/ui/MagicSquareMemoToggle";
import { MagicSquareNumberPad } from "@/games/magic-square/ui/MagicSquareNumberPad";
import { splitMagicSquareRejection } from "@/games/magic-square/ui/magic-square-rejection";

/**
 * 例の下に添える言葉。
 * - `line`: 形のルールの判定（✓ そろう / ✕ そろわない / 途中）と ✕ のわけ。盤面ごとに、その行の列で判定する。
 * - `given`: 最初から置いてある数のルールの、数のあるマスごとの ✓ / ✕ の印と、その凡例（✓ 変えられる / ✕ 変えられない）。
 * - `used-values`: 数の欄のくぼみの数に付けた ✕ の凡例。数の欄の下に添える。
 */
type TouchableExampleCaption = "line" | "given" | "used-values";

type TouchableExampleProps = {
  example: MagicSquareHowToPlayExample;
  caption?: TouchableExampleCaption;
};

const shapeLabels = { allowed: "そろう", disallowed: "そろわない" };
const givenLabels = { allowed: "変えられる", disallowed: "変えられない" };
const valueLabels = { allowed: "置ける", disallowed: "置けない" };

/** 数の欄の札の手がかりと印の単位。札の高さ（本番と同じ 44px）にする。 */
const valueUnitStyle = {
  "--how-to-play-unit": "2.75rem",
} as CSSProperties;

/** 盤面のマスの手がかりと印の単位。盤面部品が描くマスの大きさにする。 */
const cellUnitStyle = {
  "--how-to-play-unit": "var(--magic-square-cell)",
} as CSSProperties;

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

/**
 * 触れる例の面の中身。盤面を `HowToPlayExample` で並べ、その下に本番と同じ盤面の下に並んだ数（とメモの切り替え）を盤面と同じ幅に置く。
 * 本番と同じく、マスを押して選び、数を押して置く。列の合計と色、受け付けない押し方の揺れは、本番と同じく今の盤面から出す。
 * 次に押す所には、盤面のマスか、数の欄の札か、メモの切り替えに手がかりを付ける。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const {
    state,
    valueStates,
    hint,
    operation,
    selectCell,
    enterValue,
    toggleMemoInput,
  } = useTouchableExample(example.boards, example.hints);
  const rejection = splitMagicSquareRejection(operation);
  const columns = Math.max(
    ...example.boards.map(
      ({ region }) =>
        getMagicSquareFrameUnits(MAGIC_SQUARE_EXAMPLE_SIZE, region).columns,
    ),
  );
  const width = getMagicSquareExampleWidth(columns);
  const usedValueShown = valueStates.includes("used");

  const pad = (
    <div className="flex justify-center" style={{ width }}>
      <div className="w-full">
        <MagicSquareNumberPad
          size={MAGIC_SQUARE_EXAMPLE_SIZE}
          valueStates={valueStates}
          memoInput={state.inputMode === "memo"}
          interactionDisabled={false}
          rejection={rejection.value}
          onEnterValue={enterValue}
          trailingActions={
            example.controls.includes("memo")
              ? [
                  <MagicSquareMemoToggle
                    key="memo"
                    active={state.inputMode === "memo"}
                    disabled={false}
                    onToggle={toggleMemoInput}
                    overlay={
                      hint?.kind === "memo" ? (
                        <HowToPlayPressHint
                          {...magicSquareControlHintPlacement}
                        />
                      ) : null
                    }
                  />,
                ]
              : []
          }
          renderValueOverlay={(value) => (
            <span
              className="pointer-events-none absolute inset-0"
              style={valueUnitStyle}
            >
              {caption === "used-values" &&
              valueStates[value - 1] === "used" ? (
                // 札の数を隠さないよう、右上の角に小さく置く。
                <span className="absolute top-0.5 right-0.5 size-3.5">
                  <HowToPlayVerdictMark
                    verdict="disallowed"
                    placement="board-tag"
                  />
                </span>
              ) : null}
              {hint?.kind === "value" && hint.value === value ? (
                <HowToPlayPressHint {...magicSquareCellHintPlacement} />
              ) : null}
            </span>
          )}
        />
      </div>
    </div>
  );

  return (
    <>
      {example.boards.map((definition, boardIndex) => {
        const session = state.sessions[boardIndex];
        if (session === undefined) {
          return null;
        }
        const selected = withExampleSelection(session, state, boardIndex);
        const hintedCellIndex =
          hint?.kind === "cell" && hint.board === boardIndex
            ? hint.cellIndex
            : null;
        const row = judgeMagicSquareExampleRow(session, definition.region);
        const cellMarks =
          caption === "given"
            ? listRegionCellIndexes(definition.region).flatMap((cellIndex) => {
                const verdict = judgeMagicSquareExampleCell(session, cellIndex);
                return verdict === null ? [] : [{ cellIndex, verdict }];
              })
            : [];
        return (
          <HowToPlayExample
            // biome-ignore lint/suspicious/noArrayIndexKey: 面の中の盤面は、並び順そのものが識別になる
            key={boardIndex}
            figure={
              <ExampleBoard
                session={session}
                region={definition.region}
                selectedCellIndex={selected.selectedCellIndex}
                width={width}
                rejection={
                  rejection.cell !== null &&
                  state.selection?.board === boardIndex
                    ? rejection.cell
                    : null
                }
                onSelectCell={(cellIndex) => selectCell(boardIndex, cellIndex)}
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
                        // 数を隠さず、下の縁に出る手がかりの指とも離れるよう、右上の角にマスの外へ少しはみ出して小さく置く。
                        <span className="absolute -top-1 -right-1 size-3.5">
                          <HowToPlayVerdictMark
                            verdict={mark.verdict}
                            placement="board-tag"
                          />
                        </span>
                      ) : null}
                      {cellIndex === hintedCellIndex ? (
                        <HowToPlayPressHint {...magicSquareCellHintPlacement} />
                      ) : null}
                    </span>
                  );
                }}
              />
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
              ) : undefined
            }
          />
        );
      })}
      {caption === "used-values" ? (
        <HowToPlayExample
          figure={pad}
          caption={
            <HowToPlayMarkLegend
              labels={valueLabels}
              shownMarks={{ allowed: false, disallowed: usedValueShown }}
            />
          }
        />
      ) : (
        <div className="flex w-full basis-full justify-center">{pad}</div>
      )}
    </>
  );
}
