import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 重ねる言葉の1つ。`id` は層の中で言葉を見分ける名前。 */
export type HowToPlayCaptionLayer = {
  id: string;
  shown: boolean;
  content: ReactNode;
};

type HowToPlayCaptionLayersProps = {
  /** 出しうる言葉のすべて。見せるのは `shown` の1つだけにする。どれも見せない間も場所は取る。 */
  layers: readonly HowToPlayCaptionLayer[];
};

/**
 * 例の下で入れ替える言葉の層。出しうる言葉をすべて同じ場所に重ね、場所はいちばん大きい言葉の幅と高さで取るので、
 * 入れ替えても周りは動かない。どの言葉も場所の中央、つまり盤面の真下の中央に置く。
 * 見せない言葉は場所を取ったまま隠し、読み上げからも外す。入れ替えはすぐに行い、古い言葉と新しい言葉を重ねて見せない。
 */
export function HowToPlayCaptionLayers({
  layers,
}: HowToPlayCaptionLayersProps) {
  return (
    <span className="grid">
      {layers.map(({ id, shown, content }) => (
        <span
          key={id}
          aria-hidden={!shown}
          data-how-to-play-caption-layer={id}
          className={cn(
            "col-start-1 row-start-1 flex items-center justify-center",
            shown ? null : "invisible",
          )}
        >
          {content}
        </span>
      ))}
    </span>
  );
}
