import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import {
  type HitofudePuzzleExampleBoard,
  type HitofudePuzzleExampleCandidate,
  judgeHitofudePuzzleExampleMove,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/example-board";
import {
  blockedLabels,
  describeRemainingCells,
  rejectionNames,
  rewoundText,
  shapeLabels,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/caption-words";

type MoveCaptionProps = {
  example: HitofudePuzzleExampleBoard;
  /** 今の道から弾かれた手の、本番の×が盤面に点いているか。点いている間だけ、弾かれたことを言う。 */
  blockedMarkShown: boolean;
  /** 盤面に手ごとの印を付けた候補のマス。凡例には、この中にある印の記号だけを並べる。 */
  candidates: readonly HitofudePuzzleExampleCandidate[];
};

/**
 * 通れないマスのルールの例の言葉。今の盤面と直前の手から、凡例・完成・行き止まり・弾かれたこととその理由・道が戻ったことの
 * どれか1つを、同じ場所に重ねて入れ替える。
 */
export function MoveCaption({
  example,
  blockedMarkShown,
  candidates,
}: MoveCaptionProps) {
  const caption = judgeHitofudePuzzleExampleMove(example, { blockedMarkShown });
  return (
    <HowToPlayCaptionLayers
      layers={[
        {
          id: "candidates",
          shown: caption.kind === "candidates",
          content: (
            <HowToPlayMarkLegend
              labels={blockedLabels}
              shownMarks={{
                allowed: candidates.some(({ rejection }) => rejection === null),
                disallowed: candidates.some(
                  ({ rejection }) => rejection !== null,
                ),
              }}
            />
          ),
        },
        {
          id: "shape",
          shown: caption.kind === "solved" || caption.kind === "deadEnd",
          content: (
            <HowToPlayVerdict
              verdict={caption.kind === "deadEnd" ? "disallowed" : "allowed"}
              labels={shapeLabels}
              ruleReason={
                caption.kind === "deadEnd"
                  ? describeRemainingCells(caption.remaining)
                  : undefined
              }
            />
          ),
        },
        {
          id: "rejected",
          shown: caption.kind === "rejected",
          content: (
            <HowToPlayVerdict
              verdict="disallowed"
              labels={blockedLabels}
              ruleReason={
                caption.kind === "rejected"
                  ? rejectionNames[caption.reason]
                  : undefined
              }
            />
          ),
        },
        {
          id: "rewound",
          shown: caption.kind === "rewound",
          content: <HowToPlayVerdictLine>{rewoundText}</HowToPlayVerdictLine>,
        },
      ]}
    />
  );
}
