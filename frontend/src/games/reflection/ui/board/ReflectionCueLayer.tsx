import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { ReflectionCue } from "@/games/reflection/ui/board/cue";
import { cn } from "@/lib/utils";

/**
 * 印・応え・覆いから抜く所を重ねる所。
 * - `cell`: マス。
 * - `row-clue`: 左右の辺の外周ヒント。
 * - `column-clue`: 上下の辺の外周ヒント。
 * - `stock`: ストックの種類のボタン。
 */
type ReflectionCuePlace = "cell" | "row-clue" | "column-clue" | "stock";

/** 印と応えの線は、隣り合う物の線と重ならないよう、押せる範囲の縁から少し内側に、角の立った形で引く。 */
const cueOutlineClassNames = {
  cell: "inset-1",
  "row-clue": "inset-0.5",
  "column-clue": "inset-0.5",
  stock: "inset-0.5",
} as const satisfies Record<ReflectionCuePlace, string>;

/**
 * 覆いから抜く形。マスとストックのボタンは、押せる範囲の角の立った四角のまま抜く。
 * 外周ヒントは、押せる範囲と、隣の無い向きへ押せる範囲より少し広がる一致の地を合わせた、角の立った四角で抜く。
 */
const spotlightClassNames = {
  cell: "inset-0",
  "row-clue": "inset-y-0 -inset-x-[5%]",
  "column-clue": "inset-x-0 -inset-y-[5%]",
  stock: "inset-0",
} as const satisfies Record<ReflectionCuePlace, string>;

/**
 * 指を置く所。マス目では、下のマスや外周ヒント（決め手の光が通る所）を指で隠さないよう、押すマスの中を指す。
 * ストックは下に一言しかないので、押す物のすぐ下から指す。
 */
const pointerPlacements = {
  cell: "center",
  "row-clue": "center",
  "column-clue": "center",
  stock: "below",
} as const satisfies Record<ReflectionCuePlace, "below" | "center">;

type ReflectionCueLayerProps = {
  cues: readonly ReflectionCue[];
  place: ReflectionCuePlace;
};

export function ReflectionCueLayer({ cues, place }: ReflectionCueLayerProps) {
  return cues.map(function renderCue(cue) {
    if (cue.kind === "spotlight") {
      return (
        <TutorialSpotlight
          key={cue.kind}
          active
          className={spotlightClassNames[place]}
        />
      );
    }
    return (
      <span
        key={cue.kind}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute",
          cueOutlineClassNames[place],
        )}
      >
        {cue.kind === "mark" ? (
          cue.pointed ? (
            <TutorialCue
              kind="pointer"
              recallId={cue.recallId}
              placement={pointerPlacements[place]}
            />
          ) : (
            <TutorialCue kind="mark" recallId={cue.recallId} />
          )
        ) : (
          <TutorialCue kind="acknowledgement" id={cue.id} />
        )}
      </span>
    );
  });
}
