import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import {
  type BridgesExampleBoard,
  judgeBridgesExampleConnection,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/example-board";
import { overIslandsReason } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/caption-words";

type ConnectionCaptionProps = {
  example: BridgesExampleBoard;
};

const connectionLabels: HowToPlayVerdictLabels = {
  allowed: "できる",
  disallowed: "できない",
};

/**
 * 全部の島をつなげるルールの判定。本番はつながりを知らせないので、遊び方だけの読み方として添える。
 * 完成なら ✓、ほかとつながらない組があれば ✕、ほかは途中。多すぎの島があれば ✕ にし、破った数字のルールを下に添える。
 */
export function ConnectionCaption({ example }: ConnectionCaptionProps) {
  const { verdict, overIslands } = judgeBridgesExampleConnection(example);
  return (
    <HowToPlayVerdict
      verdict={verdict}
      labels={connectionLabels}
      reason={overIslands ? overIslandsReason : undefined}
    />
  );
}
