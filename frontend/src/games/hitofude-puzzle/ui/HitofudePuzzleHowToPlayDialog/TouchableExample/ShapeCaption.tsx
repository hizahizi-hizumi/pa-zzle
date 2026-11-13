import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import {
  type HitofudePuzzleExampleBoard,
  judgeHitofudePuzzleExampleShape,
  listHitofudePuzzleExampleRemainingCells,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/example-board";
import {
  describeRemainingCells,
  shapeLabels,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/caption-words";

type ShapeCaptionProps = {
  example: HitofudePuzzleExampleBoard;
};

/**
 * すべてのマスのルールの例の言葉。今の盤面を、完成か、行き止まりと残りのマスの数か、途中と残りのマスの数かで言う。
 * 判定の言葉は、どれも盤面の真下の中央に置く。残りのマスの数は、判定の下の2行目に、判定と同じく場所を取らずに重ねて中央に添え、
 * 狭い画面でも2つの例を横に並べられる幅に収める（読み上げは「行き止まり・1マス残る」「途中・2マス残る」）。
 * 途中の残りのマスの数は、共通の判定が ✕ のときにしかわけを添えないので、ここで同じ置き方で添える。
 */
export function ShapeCaption({ example }: ShapeCaptionProps) {
  const verdict = judgeHitofudePuzzleExampleShape(example);
  const remaining = describeRemainingCells(
    listHitofudePuzzleExampleRemainingCells(example).length,
  );
  return (
    <span className="relative flex">
      <HowToPlayVerdict
        verdict={verdict}
        labels={shapeLabels}
        reason={remaining}
      />
      {verdict === "incomplete" ? (
        <span className="absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap text-muted-foreground">
          <span className="sr-only">・</span>
          {remaining}
        </span>
      ) : null}
    </span>
  );
}
