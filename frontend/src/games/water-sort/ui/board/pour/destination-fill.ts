import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { getLandedRatio } from "@/games/water-sort/ui/board/pour/pour-timing";

export type DestinationFill = {
  /** 注ぎ始める前からあった液（段）。 */
  baseSlots: number;
  /** 注がれている液を、下にある同じ試薬の液とひとつにして描く範囲（段）。 */
  incoming: {
    colorIndex: number;
    fromSlot: number;
    toSlot: number;
  } | null;
  /** 今の液面（段）。 */
  surfaceSlots: number;
};

/**
 * 同じ注ぎ先へ続けて注いだ `animations`（成り立った順）が、それぞれの時刻までに届けた液を順に積む。
 * 後の注ぎは前の注ぎの液面に乗るので、後から注ぎ始めても前の注ぎの液が一度に入ったようには見えない。
 * 続けて同じ注ぎ先へ注げるのは前の注ぎと同じ試薬だけなので、注がれる液はひとつの層になる。
 */
export function getDestinationFill(
  animations: readonly PourAnimation[],
  getElapsedMs: (animationId: number) => number,
): DestinationFill | null {
  const first = animations[0];
  if (!first) {
    return null;
  }
  const base = first.destination.before;
  const landedSlots = animations.reduce((sum, animation) => {
    const slotCount =
      animation.destination.after.length - animation.destination.before.length;
    return (
      sum +
      slotCount * getLandedRatio(animation.timing, getElapsedMs(animation.id))
    );
  }, 0);
  const surfaceSlots = base.length + landedSlots;
  if (landedSlots <= 0) {
    return { baseSlots: base.length, incoming: null, surfaceSlots };
  }
  let fromSlot = base.length;
  while (fromSlot > 0 && base[fromSlot - 1] === first.colorIndex) {
    fromSlot -= 1;
  }
  return {
    baseSlots: base.length,
    incoming: { colorIndex: first.colorIndex, fromSlot, toSlot: surfaceSlots },
    surfaceSlots,
  };
}
