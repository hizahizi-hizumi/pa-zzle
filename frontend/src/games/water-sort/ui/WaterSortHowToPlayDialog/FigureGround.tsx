import { waterSortGroundClassName } from "@/games/water-sort/ui/water-sort-ground-color";
import { cn } from "@/lib/utils";

/**
 * 遊び方の図の試験管の後ろに敷く、プレイ画面と同じ地。試験管のガラスはプレイ画面の地に合わせた色なので、遊び方の白い面の上では見分けにくい。
 * 試験管を1段に並べた図の箱（下の端が試験管の箱の下の端）の中で、最初の子に置く。試験管の幅は `--water-sort-figure-bottle` から読む。
 * 持ち上げた試験管と試験管ばさみが少し上へ出ても地の中に収まるよう、試験管の上と左右に余白を取る。
 */
export function FigureGround() {
  return (
    <span
      aria-hidden="true"
      data-figure-ground=""
      className={cn(
        "pointer-events-none absolute -inset-x-[calc(var(--water-sort-figure-bottle)*0.3)] bottom-[calc(var(--water-sort-figure-bottle)*-0.12)] h-[calc(var(--water-sort-figure-bottle)*3.3)] rounded-md",
        waterSortGroundClassName,
      )}
    />
  );
}
