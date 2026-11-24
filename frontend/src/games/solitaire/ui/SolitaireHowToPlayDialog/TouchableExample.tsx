import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import {
  getSolitaireFixedBoardGeometry,
  getSolitaireSlotLeft,
} from "@/games/solitaire/ui/board/board-geometry";
import {
  FigureCardSizeScope,
  FigureCardWidth,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureCardWidth";
import type { SolitaireHowToPlayExample } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/HowToPlayBoard";
import {
  type ColumnAnswer,
  ColumnVerdicts,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample/ColumnVerdicts";
import {
  canPlayExampleTrial,
  countExampleTrialCards,
  getSolitaireExampleHintPile,
  hasMovedSinceTry,
  judgeSolitaireExampleColumns,
  type SolitaireColumnRejection,
  type SolitaireExampleBoard,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample/example-board";
import { useTouchableExample } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample/use-touchable-example";

/**
 * 図の下に添える言葉。
 * - `columns`: 各列の真下に、今選んでいる札をその列へ置けるかの答え（✓ / ✕）と、✕ には置けないわけ。置いた後は置いた列に「置けた」。
 * - `verdict`: 例が見せる手を打てるかの判定。打った後は、試した手の結果として `moved` の言葉にする。
 * - `amount`: 例が見せる手で動く札の枚数。動かした後は、動いた枚数にする。
 */
export type TouchableExampleCaption =
  | { kind: "columns" }
  | {
      kind: "verdict";
      labels: HowToPlayVerdictLabels;
      /** 打った後の言葉。今の盤面の答えと食い違わないよう、試した手の結果だと分かる言い方にし、`labels` と同じ字数にする。 */
      movedLabels: HowToPlayVerdictLabels;
    }
  | { kind: "amount" };

type TouchableExampleProps = {
  example: SolitaireHowToPlayExample;
  /** 渡さない例（操作の例・山札の例）は、言葉を添えない。 */
  caption?: TouchableExampleCaption;
};

const columnRejectionNames = {
  "not-king": "Kでない",
  "same-color": "同じ色",
  rank: "数違い",
} as const satisfies Record<SolitaireColumnRejection, string>;

/** 置き元を選ばずに札の無い山を押して弾かれたわけ。例が教えるルールとは別のわけなので、判定の下に添える。 */
const EMPTY_SOURCE_REASON = "札が無い";

function listColumnAnswers(
  board: SolitaireExampleBoard,
  columnIndexes: readonly number[],
): (ColumnAnswer | null)[] {
  const { lastTransfer } = board;
  if (lastTransfer !== null && hasMovedSinceTry(board)) {
    const { destination } = lastTransfer;
    return columnIndexes.map((columnIndex) =>
      destination.pile === "column" && destination.columnIndex === columnIndex
        ? { result: "placed" }
        : null,
    );
  }
  const verdicts = judgeSolitaireExampleColumns(board, columnIndexes);
  return columnIndexes.map((_, index) => {
    const verdict = verdicts?.[index] ?? null;
    if (verdict === null) {
      return null;
    }
    return verdict.allowed
      ? { result: "allowed" }
      : {
          result: "disallowed",
          reason:
            verdict.rejection === null
              ? null
              : columnRejectionNames[verdict.rejection],
        };
  });
}

/** 動く枚数の言葉。動かした後は、動いた枚数にする。 */
function describeAmount(
  board: SolitaireExampleBoard,
  example: SolitaireHowToPlayExample,
): { id: string; text: string } {
  const { lastTransfer } = board;
  if (lastTransfer !== null && hasMovedSinceTry(board)) {
    return {
      id: `moved-${lastTransfer.cardCount}`,
      text: `${lastTransfer.cardCount}枚が動いた`,
    };
  }
  const cardCount = countExampleTrialCards(board, example);
  return cardCount === 0
    ? { id: "none", text: "動かせない" }
    : { id: `move-${cardCount}`, text: `${cardCount}枚が動く` };
}

/** 動く枚数の言葉として出しうるもの。例の並びの枚数までを、動く前と動いた後の両方で並べる。 */
function listAmountLayers(example: SolitaireHowToPlayExample) {
  const maxCount = Math.max(
    ...example.state.columns.map((column) => column.length),
  );
  return [
    { id: "none", text: "動かせない" },
    ...Array.from({ length: maxCount }, (_, index) => [
      { id: `move-${index + 1}`, text: `${index + 1}枚が動く` },
      { id: `moved-${index + 1}`, text: `${index + 1}枚が動いた` },
    ]).flat(),
  ];
}

/**
 * 触れる例。押すと本番と同じに選び・札を移し・当てて戻し、図の下の言葉は、本番の判定で今の姿から求め直す。
 * 押す所の手がかりは、例が見せる手を押していく途中の姿のときだけ次に押す山に付け、受け付けない山を押したら、
 * 盤面が変わるか選び直すまで消す。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const { board, operation, press } = useTouchableExample(example);

  function renderCaption(cardWidth: number) {
    if (caption === undefined) {
      return undefined;
    }
    switch (caption.kind) {
      case "columns": {
        const geometry = getSolitaireFixedBoardGeometry({
          layout: example.layout,
          cardWidth,
          columnCardCapacity: example.columnCardCapacity,
        });
        return (
          <ColumnVerdicts
            answers={listColumnAnswers(board, example.layout.columns)}
            cardWidth={cardWidth}
            columnGap={getSolitaireSlotLeft(geometry, 1) - cardWidth}
          />
        );
      }
      case "verdict": {
        const moved = hasMovedSinceTry(board);
        const reason =
          board.rejectedPile !== null && board.selectedSource === null
            ? EMPTY_SOURCE_REASON
            : undefined;
        return (
          <HowToPlayVerdict
            verdict={
              moved || canPlayExampleTrial(board, example)
                ? "allowed"
                : "disallowed"
            }
            labels={moved ? caption.movedLabels : caption.labels}
            reason={reason}
          />
        );
      }
      case "amount": {
        const shown = describeAmount(board, example);
        return (
          <HowToPlayCaptionLayers
            layers={listAmountLayers(example).map(({ id, text }) => ({
              id,
              shown: id === shown.id,
              content: text,
            }))}
          />
        );
      }
    }
  }

  return (
    <FigureCardSizeScope size="example">
      <FigureCardWidth>
        {(cardWidth) => (
          <HowToPlayExample
            figure={
              <HowToPlayBoard
                state={board.state}
                layout={example.layout}
                cardWidth={cardWidth}
                columnCardCapacity={example.columnCardCapacity}
                selectedSource={board.selectedSource}
                operation={operation}
                onSelectPile={press}
                hintedPile={getSolitaireExampleHintPile(board, example)}
              />
            }
            caption={renderCaption(cardWidth)}
          />
        )}
      </FigureCardWidth>
    </FigureCardSizeScope>
  );
}
