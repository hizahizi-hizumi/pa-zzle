import { TutorialCue } from "@/components/TutorialCue";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";

/** ボトルの形。口の縁から底までの、底だけ丸い形。印と応えはこの形で囲む。 */
const bottleShapeClassName = "inset-0 rounded-b-[1.45rem]";

type BottleCueProps = {
  cue: WaterSortBottleCue;
};

/** ボトルに重ねる合図。種類ごとの意味は `WaterSortBottleCueKind` を正とする。 */
export function BottleCue({ cue }: BottleCueProps) {
  return (
    <span
      aria-hidden="true"
      data-bottle-cue={cue.kind === "completed" ? "completed" : "hint"}
      className={`pointer-events-none absolute ${bottleShapeClassName}`}
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
