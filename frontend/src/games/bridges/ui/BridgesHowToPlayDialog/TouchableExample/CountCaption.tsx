import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import {
  type BridgesExampleBoard,
  judgeBridgesExampleCount,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/example-board";

type CountCaptionProps = {
  example: BridgesExampleBoard;
};

/** 本番の島の読み上げ名と同じ言葉で、島の色が何を知らせるかを判定と結ぶ。 */
const countLabels: HowToPlayVerdictLabels = {
  allowed: "ちょうど",
  disallowed: "多すぎ",
};

/**
 * 数字と同じ本数のルールの判定。どの島もちょうどなら ✓、多すぎの島があれば ✕、ほかは途中。
 */
export function CountCaption({ example }: CountCaptionProps) {
  return (
    <HowToPlayVerdict
      verdict={judgeBridgesExampleCount(example)}
      labels={countLabels}
    />
  );
}
