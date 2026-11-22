import { flatSceneColorClassName } from "@/games/water-sort/ui/art/flat/flat-scene-colors";
import { cn } from "@/lib/utils";

/**
 * 遊び方の図の試験管の後ろに敷く、プレイ画面と同じ壁と実験台の天板の縁。試験管を1段に並べた図の箱の最初の子に置く。
 * 試験管の幅は `--water-sort-figure-bottle` から読み、持ち上げた試験管と試験管ばさみが収まるよう上と左右に余白を取る。
 */
export function FlatFigureGround() {
  return (
    <span
      aria-hidden="true"
      data-lab-figure-ground=""
      className={cn(
        "pointer-events-none absolute -inset-x-[calc(var(--water-sort-figure-bottle)*0.3)] bottom-[calc(var(--water-sort-figure-bottle)*-0.12)] h-[calc(var(--water-sort-figure-bottle)*3.3)] overflow-hidden rounded-md bg-(--flat-wall)",
        flatSceneColorClassName,
      )}
    >
      <span className="absolute inset-x-0 bottom-0 h-[calc(var(--water-sort-figure-bottle)*0.2)] bg-(--flat-bench)" />
    </span>
  );
}
