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
import {
  CandidateLegend,
  type CandidateLegendMarks,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/MoveCaption/CandidateLegend";
import { CaptionLayer } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/MoveCaption/CaptionLayer";

type MoveCaptionProps = {
  example: HitofudePuzzleExampleBoard;
  /** 今の道から弾かれた手の、本番の×が盤面に点いているか。点いている間だけ、弾かれたことを言う。 */
  blockedMarkShown: boolean;
  /** 盤面に手ごとの印を付けた候補のマス。凡例には、この中にある印の記号だけを並べる。 */
  candidates: readonly HitofudePuzzleExampleCandidate[];
};

/** 凡例は並べる記号ごとに別の言葉として重ね、記号の数が替わったら、残る言葉を横へ滑らせずに入れ替える。 */
const legendVariants = [
  "both",
  "allowed",
  "disallowed",
] as const satisfies readonly CandidateLegendMarks[];

function listLegendMarks(
  candidates: readonly HitofudePuzzleExampleCandidate[],
): CandidateLegendMarks {
  const allowedShown = candidates.some(({ rejection }) => rejection === null);
  const disallowedShown = candidates.some(
    ({ rejection }) => rejection !== null,
  );
  if (allowedShown && disallowedShown) {
    return "both";
  }
  return allowedShown ? "allowed" : "disallowed";
}

/**
 * 通れないマスのルールの例の言葉。今の盤面と直前の手から、凡例・完成・行き止まり・弾かれたこととその理由・道が戻ったことの
 * どれか1つを出す。どれも同じ場所に重ねて入れ替え、場所はいちばん大きいものの幅で取るので、入れ替えても周りは動かない。
 * どの言葉も、場所の中央、つまり盤面の真下の中央に置く。
 */
export function MoveCaption({
  example,
  blockedMarkShown,
  candidates,
}: MoveCaptionProps) {
  const caption = judgeHitofudePuzzleExampleMove(example, { blockedMarkShown });
  const legendMarks = listLegendMarks(candidates);
  return (
    <span className="grid">
      {legendVariants.map((marks) => (
        <CaptionLayer
          key={marks}
          shown={caption.kind === "candidates" && marks === legendMarks}
        >
          <CandidateLegend marks={marks} />
        </CaptionLayer>
      ))}
      <CaptionLayer
        shown={caption.kind === "solved" || caption.kind === "deadEnd"}
      >
        <HowToPlayVerdict
          verdict={caption.kind === "deadEnd" ? "disallowed" : "allowed"}
          labels={shapeLabels}
          reason={
            caption.kind === "deadEnd"
              ? describeRemainingCells(caption.remaining)
              : undefined
          }
        />
      </CaptionLayer>
      <CaptionLayer shown={caption.kind === "rejected"}>
        <HowToPlayVerdict
          verdict="disallowed"
          labels={blockedLabels}
          reason={
            caption.kind === "rejected"
              ? rejectionNames[caption.reason]
              : undefined
          }
        />
      </CaptionLayer>
      <CaptionLayer shown={caption.kind === "rewound"}>
        <HowToPlayVerdictLine>{rewoundText}</HowToPlayVerdictLine>
      </CaptionLayer>
    </span>
  );
}
