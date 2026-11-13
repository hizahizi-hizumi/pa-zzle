import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

export function TsumeShogiGround() {
  return (
    <div className={cn("size-full", tsumeShogiToneClassNames.tableSurface)} />
  );
}
