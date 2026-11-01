import type { ReactNode } from "react";

import { tsumeShogiToneClassNames as tone } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/wood-texture";
import { cn } from "@/lib/utils";

type TsumeShogiKomadaiProps = {
  /** 駒台と同じ行の、左の空きに置く操作。駒台はその残りの幅までに抑え、操作に重ねない。 */
  leadingAction?: ReactNode;
  children: ReactNode;
};

/**
 * 攻方の駒台。盤から `--komadai-gap` だけ離した別の小さな台で、盤の右下に置き、幅は盤の半分ほど（持駒の種類が多いときだけ広がる）。
 * 四角い天板に盤と同じ材を一段暗く使い、真上から見るので厚みは自分の落ち影だけで表す。
 */
export function TsumeShogiKomadai({
  leadingAction,
  children,
}: TsumeShogiKomadaiProps) {
  return (
    <div className="flex size-full items-center gap-2 pt-(--komadai-gap)">
      {leadingAction && (
        <div className="flex shrink-0 items-center">{leadingAction}</div>
      )}
      <div
        className={cn(
          "ml-auto flex h-full min-w-1/2 max-w-full items-center gap-2 bg-size-[100%_100%] px-2",
          tone.komadaiSurface,
          tone.komadaiShadow,
        )}
        style={{
          backgroundImage: `linear-gradient(rgb(0 0 0/0.1), rgb(0 0 0/0.1)), url("${tsumeShogiWoodTextures.komadaiTop}")`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
