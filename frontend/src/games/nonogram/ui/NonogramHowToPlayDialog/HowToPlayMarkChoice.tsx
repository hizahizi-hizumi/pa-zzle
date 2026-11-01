import type { NonogramMark } from "@/games/nonogram/session/session";
import { NonogramCellFace } from "@/games/nonogram/ui/board/NonogramCellFace";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type HowToPlayMarkChoiceProps = {
  mark: NonogramMark;
};

/** 遊び方の図で、入れる印に選んでいるボタンを、プレイ画面の切り替えのボタンと同じ見え方で小さく描く。 */
export function HowToPlayMarkChoice({ mark }: HowToPlayMarkChoiceProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        nonogramToneClassNames.selectedMark,
      )}
    >
      <span className="relative size-4">
        <NonogramCellFace state={mark} />
      </span>
    </span>
  );
}
