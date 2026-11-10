import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SEA_LIT_MS } from "@/games/bridges/ui/board/clear-wave";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";
import { SeaWaves } from "@/games/bridges/ui/SeaWaves";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type BridgesSeaProps = {
  /**
   * 全島がつながった後の明るい海にし始めるまでの時間（ms）。盤面の最後の島が灯り切る時間を渡す。
   * 明るい海にしないなら `null`。動きを減らす設定では、待たずにすぐ明るい海にする。
   */
  litDelayMs?: number | null;
};

/**
 * プレイ画面の盤面の周りから、ブランドの帯と見出しの後ろまでを満たす海。
 * 明るい海は、平常の海の上に重ねた明るい面を `litDelayMs` 待って浮かび上がらせて見せる。浮かび上がり切ったら、重ねた面を外して
 * 海そのものを明るい色にする。ブランドの帯とブラウザの色は海そのものの色を写すので、そこで明るい海にそろう。
 */
export function BridgesSea({ litDelayMs = null }: BridgesSeaProps) {
  const litRef = useRef<HTMLDivElement>(null);
  const [settledDelayMs, setSettledDelayMs] = useState<number | null>(null);
  const settled =
    litDelayMs !== null &&
    (settledDelayMs === litDelayMs || prefersReducedMotion());

  useLayoutEffect(() => {
    if (litDelayMs === null || prefersReducedMotion()) {
      return;
    }
    const animation = litRef.current?.animate?.(
      [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: SEA_LIT_MS,
        delay: litDelayMs,
        easing: MOTION_EASING.standard,
        fill: "backwards",
      },
    );
    return () => animation?.cancel();
  }, [litDelayMs]);

  useEffect(() => {
    if (litDelayMs === null || prefersReducedMotion()) {
      return;
    }
    const timer = window.setTimeout(
      () => setSettledDelayMs(litDelayMs),
      litDelayMs + SEA_LIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [litDelayMs]);

  return (
    <div
      className={cn(
        "relative size-full",
        settled ? bridgesToneClassNames.seaLit : bridgesToneClassNames.sea,
      )}
    >
      {litDelayMs !== null && !settled && (
        <div
          ref={litRef}
          data-bridges-sea-lit=""
          className={cn("absolute inset-0", bridgesToneClassNames.seaLit)}
        />
      )}
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <SeaWaves unit={1} />
      </svg>
    </div>
  );
}
