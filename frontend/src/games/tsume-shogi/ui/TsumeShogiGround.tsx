import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 詰将棋の地。プレイ画面とゲームのホームの背景に敷く。 */
export function TsumeShogiGround() {
  return (
    <div className={cn("size-full", tsumeShogiToneClassNames.tableSurface)} />
  );
}
