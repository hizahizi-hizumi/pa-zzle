import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 盤を置いた座卓の面。プレイ画面とチュートリアルで同じ地にし、同じ場所で遊んでいると分かるようにする。 */
export function TsumeShogiBackground() {
  return (
    <div className={cn("size-full", tsumeShogiToneClassNames.tableSurface)} />
  );
}
