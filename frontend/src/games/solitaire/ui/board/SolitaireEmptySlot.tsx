import type { ReactNode } from "react";

import { SOLITAIRE_CARD_ASPECT_RATIO } from "@/games/solitaire/ui/board/board-geometry";
import { solitaireToneClassNames } from "@/games/solitaire/ui/solitaire-tone";
import { cn } from "@/lib/utils";

type SolitaireEmptySlotProps = {
  /** 札の幅（px）。高さは縦横比から決まる。 */
  width: number;
  /** 跡の中央に描く印（組札のマーク・山札を戻す印）。 */
  children?: ReactNode;
};

/** 札の無い山の跡。 */
export function SolitaireEmptySlot({
  width,
  children,
}: SolitaireEmptySlotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex items-center justify-center font-sans leading-none",
        solitaireToneClassNames.emptySlot,
      )}
      style={{
        width,
        height: width * SOLITAIRE_CARD_ASPECT_RATIO,
        borderRadius: width * 0.1,
        fontSize: width * 0.5,
      }}
    >
      {children}
    </span>
  );
}
