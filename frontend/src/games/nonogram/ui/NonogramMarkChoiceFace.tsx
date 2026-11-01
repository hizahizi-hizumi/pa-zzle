import type { NonogramMark } from "@/games/nonogram/session/session";
import { NonogramCellFace } from "@/games/nonogram/ui/board/NonogramCellFace";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type NonogramMarkChoiceFaceSize = "default" | "compact";

type NonogramMarkChoiceFaceProps = {
  mark: NonogramMark;
  selected: boolean;
  /** `default` はプレイ画面の切り替えのボタン、`compact` は遊び方の図に並べる大きさ。 */
  size: NonogramMarkChoiceFaceSize;
};

const sizeClassNames = {
  default: { surface: "size-10.5", figure: "size-5" },
  compact: { surface: "size-8", figure: "size-4" },
} as const satisfies Record<
  NonogramMarkChoiceFaceSize,
  { surface: string; figure: string }
>;

/**
 * 入れる印の選択肢の見た目。印の図は盤面のマスと同じに描く。
 * 選んでいるかどうかは丸い地だけで示し、印の図は選んでいなくても弱めない。
 */
export function NonogramMarkChoiceFace({
  mark,
  selected,
  size,
}: NonogramMarkChoiceFaceProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        sizeClassNames[size].surface,
        selected && nonogramToneClassNames.selectedMark,
      )}
    >
      <span className={cn("relative", sizeClassNames[size].figure)}>
        <NonogramCellFace state={mark} />
      </span>
    </span>
  );
}
