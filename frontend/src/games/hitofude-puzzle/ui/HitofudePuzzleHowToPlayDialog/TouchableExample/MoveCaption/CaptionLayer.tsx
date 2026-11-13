import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CaptionLayerProps = {
  shown: boolean;
  children: ReactNode;
};

/**
 * 同じ場所に重ねて入れ替える言葉の1つ。重ねた場所はいちばん大きい言葉の幅で取り、どの言葉もその中央、つまり盤面の中央に置く。
 * 見せない間は場所を取ったまま隠し、読み上げからも外す。入れ替えはすぐに行い、古い言葉と新しい言葉を重ねて見せない。
 */
export function CaptionLayer({ shown, children }: CaptionLayerProps) {
  return (
    <span
      aria-hidden={!shown}
      className={cn(
        "col-start-1 row-start-1 flex items-center justify-center",
        shown ? null : "invisible",
      )}
    >
      {children}
    </span>
  );
}
