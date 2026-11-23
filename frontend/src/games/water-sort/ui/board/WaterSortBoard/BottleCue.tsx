import type { CSSProperties } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import {
  STOPPER_HEAD_TOP,
  TUBE_BOTTOM_ARC_TOP,
  TUBE_OUTER,
  TUBE_RIM,
  TUBE_VIEW_HEIGHT,
  TUBE_VIEW_WIDTH,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const rimInsetPercent = (TUBE_RIM.left / TUBE_VIEW_WIDTH) * 100;
const outlineHeight = TUBE_OUTER.bottom - TUBE_RIM.top;
const bottomArcPercent =
  ((TUBE_OUTER.bottom - TUBE_BOTTOM_ARC_TOP) / outlineHeight) * 100;

/** 印と合図で囲む形。試験管の口の縁から底の丸みまでを、ガラスに重ねず少し外側から囲む。 */
const tubeOutlineStyle = {
  left: `calc(${rimInsetPercent}% - 3px)`,
  right: `calc(${rimInsetPercent}% - 3px)`,
  top: `calc(${TUBE_RIM.top}% - 3px)`,
  bottom: `calc(${TUBE_VIEW_HEIGHT - TUBE_OUTER.bottom}% - 3px)`,
  borderRadius: `5px 5px 50% 50% / 5px 5px ${bottomArcPercent}% ${bottomArcPercent}%`,
} as const satisfies CSSProperties;

/**
 * そろった試験管の印の形。そろった印は置き場所の上の縁に載るので、口から上に出たゴム栓の頭より、
 * 印の大きさの分だけ上から囲み、印を栓に重ねない。
 */
const stopperedTubeOutlineStyle = {
  ...tubeOutlineStyle,
  top: `calc(${STOPPER_HEAD_TOP}% - 12px)`,
} as const satisfies CSSProperties;

type BottleCueProps = {
  cue: WaterSortBottleCue;
};

export function BottleCue({ cue }: BottleCueProps) {
  return (
    <span
      aria-hidden="true"
      data-bottle-cue={cue.kind === "completed" ? "completed" : "hint"}
      className="pointer-events-none absolute"
      style={
        cue.kind === "completed" ? stopperedTubeOutlineStyle : tubeOutlineStyle
      }
    >
      {cue.kind === "completed" ? (
        <TutorialCue kind="achievement" />
      ) : (
        <TutorialCue
          kind="pointer"
          recallId={cue.kind === "recall" ? cue.id : null}
        />
      )}
    </span>
  );
}
