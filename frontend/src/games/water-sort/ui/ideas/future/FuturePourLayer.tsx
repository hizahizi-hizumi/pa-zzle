import { groupPourAnimationsByDestination } from "@/games/water-sort/ui/board/pour/pour-animation";
import { FieldReceiver } from "@/games/water-sort/ui/ideas/future/FuturePourLayer/FieldReceiver";
import { FieldTransfer } from "@/games/water-sort/ui/ideas/future/FuturePourLayer/FieldTransfer";
import type { PourAnimationLayerProps } from "@/games/water-sort/ui/ideas/overrides";

/**
 * 器を傾けずに、場の力で液を口から口へ渡す。
 * 盤面は注いでいる間の管を隠すので、注ぎ元と注ぎ先の管はここで描く。注ぐ途中でも次の管を選べる仕組みは盤面のまま。
 */
export function FuturePourLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <FieldReceiver
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
      {animations.map((animation) => (
        <FieldTransfer
          key={animation.id}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
    </>
  );
}
