import { TsumeShogiBoardLettering } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPieceBox/TsumeShogiBoardLettering";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/**
 * 玉方の持駒（駒箱）。盤上と攻方の持駒に無い駒はすべて玉方が使えるので、枚数を並べずに「残り全部」とだけ示す。
 * 駒箱は盤の脇に置く箱で駒台ではないので、木の台は置かず、盤の外の地に、盤の筋・段と同じ書体の小さな札として出す。
 */
export function TsumeShogiPieceBox() {
  return (
    <p
      className={cn(
        "flex size-full items-end gap-2 pb-1 text-play-meta",
        tsumeShogiToneClassNames.pieceBoxLabel,
      )}
    >
      <TsumeShogiBoardLettering text="玉方の持駒" />
      <TsumeShogiBoardLettering text="残り全部" />
    </p>
  );
}
