import type { ReflectionClue } from "@/games/reflection/puzzle/laser";
import { ReflectionOutcomeMark } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import {
  reflectionOutcomeToneClassNames,
  reflectionToneClassNames,
} from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ClueMatchExampleProps = {
  matched: boolean;
};

const matchExampleClue: ReflectionClue = { outcome: "exit", distance: 3 };

/** 盤面の外周ヒントと同じ並び（数字の下に結果の形）で、一致しているときの地と数字の色を見せる見本。 */
export function ClueMatchExample({ matched }: ClueMatchExampleProps) {
  return (
    <span
      className={cn(
        "flex size-10 flex-col items-center justify-center gap-0.5 leading-none text-foreground",
        matched && reflectionToneClassNames.clueMatchSurface,
      )}
    >
      <span
        className={cn(
          "font-semibold tabular-nums",
          matched && reflectionToneClassNames.clueMatchLabel,
        )}
      >
        {matchExampleClue.distance}
      </span>
      <span
        className={cn(
          "flex",
          reflectionOutcomeToneClassNames[matchExampleClue.outcome],
        )}
      >
        <ReflectionOutcomeMark
          outcome={matchExampleClue.outcome}
          size="inline"
        />
      </span>
    </span>
  );
}
