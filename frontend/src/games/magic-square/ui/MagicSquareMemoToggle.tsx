import { Pencil } from "lucide-react";

import { useTouchTap } from "@/components/touch-tap";
import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";
import { cn } from "@/lib/utils";

type MagicSquareMemoToggleProps = {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
};

/**
 * 数を置く入れ方とメモを書く入れ方の切り替え。隣の待ったと同じ丸い形にし、メモを書く間はメモの字と同じ石墨の色で塗る。
 */
export function MagicSquareMemoToggle({
  active,
  disabled,
  onToggle,
}: MagicSquareMemoToggleProps) {
  const { getTapHandlers } = useTouchTap();

  return (
    <button
      type="button"
      aria-label="メモ"
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex size-12 items-center justify-center rounded-full border-(length:--border-width-normal) outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        !active && "bg-background hover:bg-accent hover:text-accent-foreground",
      )}
      style={
        active
          ? {
              backgroundColor: magicSquareTone.memoInk,
              borderColor: magicSquareTone.memoInk,
              color: magicSquareTone.tablet,
            }
          : undefined
      }
      {...getTapHandlers(onToggle)}
    >
      <Pencil aria-hidden="true" className="size-5" />
    </button>
  );
}
