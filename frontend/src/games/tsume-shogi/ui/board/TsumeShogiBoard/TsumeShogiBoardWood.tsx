import { tsumeShogiToneClassNames as tone } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/wood-texture";
import { cn } from "@/lib/utils";

/**
 * 盤の木。榧の天柾の一枚板で、天面は升を歪めずに描き、四辺の縁に筋・段を書く。手前には板の厚みの側面を見せ、
 * 天面の柾目を側面へそのまま続ける。天面には左上からごく弱い照りを入れ、四辺へ向かってわずかに暗くする。
 * 升・罫線・駒は天面の上に重ねる。
 */
export function TsumeShogiBoardWood() {
  const woodImage = `url("${tsumeShogiWoodTextures.boardTop}")`;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative col-start-1 col-end-4 row-start-1 row-end-5 grid grid-rows-[minmax(0,1fr)_var(--board-thickness)]",
        tone.boardShadow,
      )}
    >
      <div
        className={cn("relative bg-size-[100%_100%]", tone.boardSurface)}
        style={{ backgroundImage: woodImage }}
      >
        <span
          className={cn("absolute inset-0", tone.boardSheen, tone.boardChamfer)}
        />
      </div>
      <div
        className={cn(
          "relative bg-size-[100%_auto] bg-bottom",
          tone.boardSurface,
        )}
        style={{ backgroundImage: woodImage }}
      >
        <span className={cn("absolute inset-0", tone.boardSide)} />
      </div>
    </div>
  );
}
