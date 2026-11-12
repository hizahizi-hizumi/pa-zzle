import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 詰将棋の地。盤の台の灰緑で、ゲームのホームとプレイ画面の全体に敷く。 */
export function TsumeShogiGround() {
  return (
    <div className={cn("size-full", tsumeShogiToneClassNames.tableSurface)} />
  );
}
