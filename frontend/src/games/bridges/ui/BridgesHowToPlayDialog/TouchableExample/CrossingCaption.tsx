import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import {
  type BridgesExampleBoard,
  type BridgesExampleCandidate,
  judgeBridgesExampleCrossing,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/example-board";
import {
  crossingWords,
  overIslandsReason,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/caption-words";

type CrossingCaptionProps = {
  example: BridgesExampleBoard;
  /** 盤面に手ごとの印を付けた線。凡例には、この中にある印の記号だけを並べる。 */
  candidates: readonly BridgesExampleCandidate[];
};

/** 盤面の印の意味。 */
const markLabels: HowToPlayVerdictLabels = {
  allowed: crossingWords.allowed,
  disallowed: crossingWords.disallowed,
};

/** 手を打った後の結果。架けられた・阻まれたを言う。 */
const resultLabels: HowToPlayVerdictLabels = {
  allowed: crossingWords.placed,
  disallowed: crossingWords.disallowed,
};

/**
 * 交差のルールの例の言葉。橋が触る前の姿にある間は盤面の印の凡例を、手を打った後はその結果
 * （阻まれた・架けられた・外れた・交差する所を押して決まらなかった）を出す。どれも同じ場所に重ねて入れ替える。
 * 例が教えるルールとは別に多すぎの島ができたときは、手の結果の下に添える。
 */
export function CrossingCaption({ example, candidates }: CrossingCaptionProps) {
  const { kind, overIslands } = judgeBridgesExampleCrossing(example);
  const reason = overIslands ? overIslandsReason : undefined;
  return (
    <HowToPlayCaptionLayers
      layers={[
        {
          id: "legend",
          shown: kind === "legend",
          content: (
            <HowToPlayMarkLegend
              labels={markLabels}
              shownMarks={{
                allowed: candidates.some(({ allowed }) => allowed),
                disallowed: candidates.some(({ allowed }) => !allowed),
              }}
            />
          ),
        },
        {
          id: "result",
          shown: kind === "blocked" || kind === "placed",
          content: (
            <HowToPlayVerdict
              verdict={kind === "placed" ? "allowed" : "disallowed"}
              labels={resultLabels}
              reason={reason}
            />
          ),
        },
        {
          id: "ambiguous",
          shown: kind === "ambiguous",
          content: (
            <HowToPlayVerdictLine>
              {crossingWords.ambiguous}
            </HowToPlayVerdictLine>
          ),
        },
        {
          id: "removed",
          shown: kind === "removed",
          content: (
            <HowToPlayVerdictLine>{crossingWords.removed}</HowToPlayVerdictLine>
          ),
        },
      ]}
    />
  );
}
