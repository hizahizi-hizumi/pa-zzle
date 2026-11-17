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
 * 残りのマスの数は、ルールそのもののわけとして判定の下に添える（読み上げは「行き止まり・1マス残る」「途中・2マス残る」）。
 */
export function ShapeCaption({ example }: ShapeCaptionProps) {
  const verdict = judgeHitofudePuzzleExampleShape(example);
  return (
    <HowToPlayVerdict
      verdict={verdict}
      labels={shapeLabels}
      ruleReason={
        verdict === "allowed"
          ? undefined
          : describeRemainingCells(
              listHitofudePuzzleExampleRemainingCells(example).length,
            )
      }
    />
  );
}
