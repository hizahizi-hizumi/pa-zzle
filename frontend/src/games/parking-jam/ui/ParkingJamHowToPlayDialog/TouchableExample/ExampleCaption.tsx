import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import type { ParkingJamDirection } from "@/games/parking-jam/puzzle/board";
import type { ParkingJamExampleCaption } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/example-board";
import type { ParkingJamHowToPlayBlocker } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";

type ExampleCaptionProps = {
  caption: ParkingJamExampleCaption;
  /** 例が教える出られないわけ。当たったわけがこれだけなら、ルールそのもののわけとして添える。 */
  taughtBlocker?: ParkingJamHowToPlayBlocker;
};

/** 車の端の印の意味。手の動詞で言う。 */
const markLabels: HowToPlayVerdictLabels = {
  allowed: "出られる",
  disallowed: "出られない",
};

const directionNames = {
  up: "上",
  right: "右",
  down: "下",
  left: "左",
} as const satisfies Record<ParkingJamDirection, string>;

/**
 * 試した手の結果。どの手の答えかが分かるよう、試した向きを添える。
 * 出た後の盤面で同じ車がまた出られるとは限らないので、試した手の結果として「出られた」と言う。
 * 向きはどれも1字なので、向きが替わっても言葉の幅は変わらない。
 */
function getAttemptLabels(
  direction: ParkingJamDirection,
): HowToPlayVerdictLabels {
  const name = directionNames[direction];
  return { allowed: `${name}へ出られた`, disallowed: `${name}へ出られない` };
}

/** 当たった物の言葉。チュートリアルの一言と同じ言い方にし、車の幅の盤面の下に1行で収まる短さにする。 */
const blockerNames = {
  wall: "進む先に道路がない",
  "fixed-area": "植え込みがある",
  vehicle: "ほかの車がある",
} as const satisfies Record<ParkingJamHowToPlayBlocker, string>;

function describeBlockers(
  blockers: readonly ParkingJamHowToPlayBlocker[],
): string | undefined {
  if (blockers.includes("fixed-area") && blockers.includes("vehicle")) {
    return "植え込みとほかの車がある";
  }
  const [blocker] = blockers;
  return blocker === undefined ? undefined : blockerNames[blocker];
}

/**
 * 当たったわけを、例が教えるルールそのもののわけ（`ruleReason`）と、別のルールのわけ（`reason`）に分ける。
 * 例が教えるわけのほかに当たった物があれば、当たった物をすべて別のルールのわけとして添える。
 */
function splitReasons(
  blockers: readonly ParkingJamHowToPlayBlocker[],
  taughtBlocker: ParkingJamHowToPlayBlocker | undefined,
): { reason?: string; ruleReason?: string } {
  const onlyTaught =
    taughtBlocker !== undefined &&
    blockers.length > 0 &&
    blockers.every((blocker) => blocker === taughtBlocker);
  const text = describeBlockers(blockers);
  return onlyTaught ? { ruleReason: text } : { reason: text };
}

/**
 * 例の下に添える言葉。盤面の印の凡例か、試した手の向きと結果（当たったときは当たった物）の、どちらか1つを出す。
 * どれも同じ場所に重ね、場所はいちばん大きいものの幅で取るので、入れ替えても周りは動かない。
 */
export function ExampleCaption({
  caption,
  taughtBlocker,
}: ExampleCaptionProps) {
  const attempt =
    caption.kind === "exited" || caption.kind === "blocked" ? caption : null;
  const reasons =
    caption.kind === "blocked"
      ? splitReasons(caption.blockers, taughtBlocker)
      : {};
  return (
    <HowToPlayCaptionLayers
      layers={[
        {
          id: "legend",
          shown: caption.kind === "legend",
          content: (
            <HowToPlayMarkLegend
              labels={markLabels}
              shownMarks={
                caption.kind === "legend"
                  ? caption
                  : { allowed: true, disallowed: true }
              }
            />
          ),
        },
        {
          id: "attempt",
          shown: attempt !== null,
          content: (
            <HowToPlayVerdict
              verdict={caption.kind === "blocked" ? "disallowed" : "allowed"}
              labels={getAttemptLabels(attempt?.direction ?? "right")}
              reason={reasons.reason}
              ruleReason={reasons.ruleReason}
            />
          ),
        },
      ]}
    />
  );
}
