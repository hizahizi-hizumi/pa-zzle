import { useLayoutEffect, useRef } from "react";

import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { FutureCell } from "@/games/water-sort/ui/ideas/future/FutureCell";
import { ReceivedFluid } from "@/games/water-sort/ui/ideas/future/FuturePourLayer/FieldReceiver/ReceivedFluid";
import {
  getFieldPourElapsed,
  getFieldPourFrame,
  getMovedSlotCount,
} from "@/games/water-sort/ui/ideas/future/future-pour-timing";

type FieldReceiverProps = {
  /** 同じ注ぎ先へ渡している注ぎ。先に始めたものから並ぶ。 */
  animations: readonly PourAnimation[];
};

const RECEIVER_LAYER = 1;

/** 注ぎ先の管。宙を渡ってきた液を口で受け、重みで少し沈みながら満ちていく。 */
export function FieldReceiver({ animations }: FieldReceiverProps) {
  const receiverRef = useRef<HTMLDivElement>(null);
  const first = animations[0];

  // 受けた重みの沈みは、最後に着いた注ぎに合わせる。
  useLayoutEffect(() => {
    const latest = animations[animations.length - 1];
    if (!latest) {
      return;
    }
    let frameRequest = 0;
    function render() {
      if (!latest) {
        return;
      }
      const t = getFieldPourElapsed(latest);
      const dip =
        getFieldPourFrame(t).receiverDip * latest.destination.rect.height;
      if (receiverRef.current) {
        receiverRef.current.style.transform = `translateY(${dip}px)`;
      }
      if (t < 1) {
        frameRequest = requestAnimationFrame(render);
      }
    }
    render();
    return () => cancelAnimationFrame(frameRequest);
  }, [animations]);

  if (!first) {
    return null;
  }

  return (
    <div
      ref={receiverRef}
      aria-hidden="true"
      className="pointer-events-none fixed will-change-transform"
      style={{
        left: first.destination.rect.left,
        top: first.destination.rect.top,
        width: first.destination.rect.width,
        height: first.destination.rect.height,
        zIndex: RECEIVER_LAYER,
      }}
    >
      <FutureCell
        contents={first.destination.before}
        role="pour-destination"
        selected
        waterOverlay={animations.map((animation) => (
          <ReceivedFluid
            key={animation.id}
            animation={animation}
            slotCount={getMovedSlotCount(animation)}
          />
        ))}
      />
    </div>
  );
}
