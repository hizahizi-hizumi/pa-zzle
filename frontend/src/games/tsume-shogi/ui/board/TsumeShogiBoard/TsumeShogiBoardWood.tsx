import { tsumeShogiToneClassNames as tone } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/wood-texture";
import { cn } from "@/lib/utils";

/**
 * 盤の木。真上から見た榧の天柾の一枚板で、四辺の縁に筋・段を書く。
 * 左上からごく弱い照りを入れ、四辺へ向かってわずかに暗くする。厚みは帯で描かず、下へ厚く広がる落ち影で表す。
 * 升・罫線・駒はこの上に重ねる。
 */
export function TsumeShogiBoardWood() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative col-start-1 col-end-4 row-start-1 row-end-4 bg-size-[100%_100%]",
        tone.boardSurface,
        tone.boardShadow,
      )}
      style={{ backgroundImage: `url("${tsumeShogiWoodTextures.boardTop}")` }}
    >
      <span
        className={cn("absolute inset-0", tone.boardSheen, tone.boardChamfer)}
      />
    </div>
  );
}
