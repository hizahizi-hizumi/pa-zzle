import { HowToPlayExample } from "@/components/HowToPlayExample";
import { takuzuTileNames } from "@/games/takuzu/ui/board/tile-names";
import {
  findTakuzuExampleHintCell,
  getTakuzuExampleLineTileCounts,
  judgeTakuzuExample,
  listTakuzuExampleDifferingColumns,
  listTakuzuExampleViolations,
  type TakuzuExampleBoard,
  type TakuzuExampleViolation,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import type {
  TakuzuHowToPlayFigureBoard,
  TakuzuHowToPlayViolation,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";
import { useShownVerdict } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableRuleExample/use-shown-verdict";
import { useTouchableExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/use-touchable-example";
import { VerdictCaption } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/VerdictCaption";

type TouchableRuleExampleProps = {
  board: TakuzuHowToPlayFigureBoard;
  /** 例が教える形のルール。触ってほかのルールに反したときは、判定の言葉に破ったルールを添える。 */
  rule: TakuzuHowToPlayViolation;
  /** 1行の例で、行の四角と丸の数を判定の横に添えるか。 */
  showsTileCounts?: boolean;
  /** 2行の例で、2つの行で違う列の真下に見比べる所の短い線を引き、判定の右にその凡例を添えるか。 */
  marksRowDifferences?: boolean;
  /** 渡すと、盤面をこの行数の盤面と同じ高さの場所の縦の中央に置く。横に並べたほかの例と、盤面の縦の中央をそろえる。 */
  centeredInRowCount?: number;
};

/** 行・列を埋め切ってから決まるルールか。そうしたルールの例では、空きのある間は ✓ を出さずに途中とする。 */
const waitsForFilledLines = {
  run: false,
  overfilled: true,
  duplicate: true,
} as const satisfies Record<TakuzuHowToPlayViolation, boolean>;

function describeViolation(violation: TakuzuExampleViolation): string {
  switch (violation.kind) {
    case "run":
      return "3つ以上続いている";
    case "overfilled":
      return `${takuzuTileNames[violation.tile]}が${violation.count}つ`;
    case "duplicate":
      return "同じ並び";
  }
}

/** 例が教えるルールとは別に破ったルールを、すべて「・」でつなぐ。破っていなければ `undefined`。 */
function describeOtherViolations(
  example: TakuzuExampleBoard,
  rule: TakuzuHowToPlayViolation,
): string | undefined {
  const descriptions = listTakuzuExampleViolations(example)
    .filter(({ kind }) => kind !== rule)
    .map(describeViolation);
  return descriptions.length > 0 ? descriptions.join("・") : undefined;
}

/**
 * 形のルールの触れる例。押すと本番と同じに変わり、違反の印と判定（✓ できる / ✕ できない / 途中）が、本番の判定から求めた今の姿で替わる。
 * 判定の言葉と、添える数・破ったルールは、違反の印と同じ間合いで替える。
 * 数を添える例では、超えた方のタイルを盤面でも囲み、判定の数と盤面のタイルを結び付ける。
 * 押す所の手がかりは、押す所を1回ずつ押していく途中の姿でだけ、まだ押していないマスに付ける。押して最初の形に戻ったときも付け直す。
 */
export function TouchableRuleExample({
  board,
  rule,
  showsTileCounts = false,
  marksRowDifferences = false,
  centeredInRowCount,
}: TouchableRuleExampleProps) {
  const { example, tap } = useTouchableExample(board);
  const shown = useShownVerdict(
    example,
    judgeTakuzuExample(example, waitsForFilledLines[rule]),
  );
  const hintCell = findTakuzuExampleHintCell(board, example);

  return (
    <HowToPlayExample
      figure={
        <HowToPlayFigure
          example={example}
          size="example"
          pressedCells={hintCell === null ? undefined : [hintCell]}
          marksRowDifferences={marksRowDifferences}
          marksOverfilledTiles={showsTileCounts}
          centeredInRowCount={centeredInRowCount}
          onTapCell={tap}
        />
      }
      caption={
        <VerdictCaption
          verdict={shown.verdict}
          reason={describeOtherViolations(shown.example, rule)}
          differenceLegend={
            marksRowDifferences
              ? listTakuzuExampleDifferingColumns(example).length > 0
                ? "shown"
                : "reserved"
              : undefined
          }
          tileCounts={
            showsTileCounts
              ? getTakuzuExampleLineTileCounts(shown.example, {
                  axis: "row",
                  index: 0,
                })
              : undefined
          }
        />
      }
    />
  );
}
