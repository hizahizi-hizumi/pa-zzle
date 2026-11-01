import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/board/real/wood-texture";
import { cn } from "@/lib/utils";

/**
 * 案R の盤の木。天面は柾目の通った榧。手前に同じ材の側面を、明度だけ下げてのぞかせて厚みを出す。
 * 光は左上の一つで、天面の左上の辺だけが光を受け、右辺・下辺は陰になる。縁の直下の濃い接地影と、下へ厚く広がる柔らかい落ち影で、
 * 盤が画面の上に置かれて見えるようにする。升・罫線・駒はこの上に重ねる。筋・段は盤の外（画面の地の上）に書く。
 */
export function RealBoardWood() {
  const woodImage = `url("${tsumeShogiWoodTextures.boardTop}")`;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none col-start-1 col-end-4 row-start-1 row-end-4 mt-[calc(var(--board-file-band)-var(--board-frame))] mx-(--board-wood-inset) flex flex-col",
        realTone.boardShadow,
      )}
    >
      <div
        className={cn(
          "relative flex-1 bg-size-[100%_100%]",
          realTone.boardTopFallback,
        )}
        style={{ backgroundImage: woodImage }}
      >
        <span
          className={cn(
            "absolute inset-0",
            realTone.topShade,
            realTone.topChamfer,
          )}
        />
      </div>
      <div
        className={cn(
          "relative h-[calc(var(--board-bottom)-var(--board-frame))] bg-bottom bg-size-[100%_auto]",
          realTone.boardTopFallback,
        )}
        style={{ backgroundImage: woodImage }}
      >
        <span className={cn("absolute inset-0", realTone.sideShade)} />
      </div>
    </div>
  );
}
