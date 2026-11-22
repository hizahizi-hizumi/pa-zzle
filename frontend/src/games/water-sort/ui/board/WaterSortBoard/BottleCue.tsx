import type { CSSProperties } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";

/**
 * 印と合図で囲む形。試験管の口の縁から底の丸みまでを、ガラスに重ねず少し外側から囲む。
 * 位置は試験管の形の座標（幅 36・高さ 100）の、口の縁（左右 1.7〜34.3、上 3.4）と底（97.2）から決める。
 */
const tubeOutlineStyle = {
  left: "calc(4.7% - 3px)",
  right: "calc(4.7% - 3px)",
  top: "calc(3.4% - 3px)",
  bottom: "calc(2.8% - 3px)",
  borderRadius: "5px 5px 50% 50% / 5px 5px 11% 11%",
} as const satisfies CSSProperties;

/**
 * そろった試験管の印の形。そろった印は置き場所の上の縁に載るので、口から上に出たゴム栓の頭（上 -4.1）より、
 * 印の大きさの分だけ上から囲み、印を栓に重ねない。
 */
const stopperedTubeOutlineStyle = {
  ...tubeOutlineStyle,
  top: "calc(-4.1% - 12px)",
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
