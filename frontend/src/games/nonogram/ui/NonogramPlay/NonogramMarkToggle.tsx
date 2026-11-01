import type { NonogramMark } from "@/games/nonogram/session/session";
import { NonogramCellFace } from "@/games/nonogram/ui/board/NonogramCellFace";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type NonogramMarkToggleProps = {
  mark: NonogramMark;
  disabled: boolean;
  onChange: (mark: NonogramMark) => void;
};

const markOptions = [
  { mark: "filled", label: "塗り" },
  { mark: "crossed", label: "バツ" },
] as const satisfies readonly { mark: NonogramMark; label: string }[];

/** タップ・ドラッグで入れる印を、盤面のマスと同じ見た目の2つのボタンから選ぶ。 */
export function NonogramMarkToggle({
  mark,
  disabled,
  onChange,
}: NonogramMarkToggleProps) {
  return (
    <div
      role="group"
      aria-label="入れる印"
      className="inline-flex h-12 items-center gap-0.5 rounded-full border-(length:--border-width-normal) bg-background p-0.5 shadow-raised"
    >
      {markOptions.map((option) => {
        const selected = option.mark === mark;
        return (
          <button
            key={option.mark}
            type="button"
            aria-label={option.label}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.mark)}
            className={cn(
              "flex aspect-square h-full touch-manipulation items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              selected
                ? nonogramToneClassNames.selectedMark
                : "hover:bg-accent",
            )}
          >
            <span aria-hidden="true" className="relative size-5">
              <NonogramCellFace state={option.mark} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
