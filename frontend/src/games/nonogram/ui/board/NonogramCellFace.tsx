import type { NonogramCellState } from "@/games/nonogram/puzzle/board";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

type NonogramCellFaceProps = {
  state: NonogramCellState;
};

/**
 * 1マスの見た目。塗りはマス全体を塗り、× はマスの中央に細い線で描く。
 * 親のマスの大きさいっぱいに描くので、親は `relative` にする。
 */
export function NonogramCellFace({ state }: NonogramCellFaceProps) {
  if (state === "filled") {
    return (
      <span
        aria-hidden="true"
        className={cn("absolute inset-0", nonogramToneClassNames.filled)}
      />
    );
  }
  if (state === "crossed") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 10 10"
        className={cn(
          "absolute inset-[24%] overflow-visible",
          nonogramToneClassNames.cross,
        )}
      >
        <path
          d="M0 0 10 10 M10 0 0 10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={1.4}
        />
      </svg>
    );
  }
  return null;
}
