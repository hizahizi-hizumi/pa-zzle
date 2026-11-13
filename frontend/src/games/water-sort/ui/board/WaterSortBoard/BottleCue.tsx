import { TutorialCue } from "@/components/TutorialCue";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";

export const bottleShapeClassName = "inset-0 rounded-b-[1.45rem]";

type BottleCueProps = {
  cue: WaterSortBottleCue;
};

export function BottleCue({ cue }: BottleCueProps) {
  return (
    <span
      aria-hidden="true"
      data-bottle-cue={cue.kind === "completed" ? "completed" : "hint"}
      className={`pointer-events-none absolute ${bottleShapeClassName}`}
    >
      {cue.kind === "completed" ? (
        <TutorialCue kind="acknowledgement" id={cue.id} />
      ) : (
        <TutorialCue
          kind="mark"
          recallId={cue.kind === "recall" ? cue.id : null}
        />
      )}
    </span>
  );
}
