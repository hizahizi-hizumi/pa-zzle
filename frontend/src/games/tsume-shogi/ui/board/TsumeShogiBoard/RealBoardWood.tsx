import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/board/real/wood-texture";
import { cn } from "@/lib/utils";

/**
 * 案R の盤の木。天面は柾目の通った榧で、絹のつやを淡く重ねる。手前に木口側の面をのぞかせて厚みを出す。
 * 光は左上の一つで、天面の左上の辺だけが光を受け、右辺・下辺は陰になる。影は右下へ短く濃く落とす。
 * 升・罫線・駒はこの上に重ねる。筋・段は盤の外（画面の地の上）に書く。
 */
export function RealBoardWood() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none col-start-1 col-end-4 row-start-1 row-end-4 mt-[calc(var(--board-file-band)-var(--board-frame))] mr-[calc(var(--board-rank-band)-var(--board-frame))] flex flex-col",
        realTone.groundShadow,
      )}
    >
      <div
        className={cn(
          "relative flex-1 bg-size-[100%_100%]",
          realTone.boardTopFallback,
        )}
        style={{ backgroundImage: `url("${tsumeShogiWoodTextures.boardTop}")` }}
      >
        <span
          className={cn(
            "absolute inset-0",
            realTone.topSheen,
            realTone.topChamfer,
          )}
        />
      </div>
      <div
        className={cn(
          "relative h-[calc(var(--board-bottom)-var(--board-frame))] bg-size-[100%_100%]",
          realTone.boardSideFallback,
        )}
        style={{
          backgroundImage: `url("${tsumeShogiWoodTextures.boardSide}")`,
        }}
      >
        <span className={cn("absolute inset-0", realTone.sideShade)} />
      </div>
    </div>
  );
}
