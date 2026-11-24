import { FukumenzanCardFace } from "@/games/fukumenzan/ui/board/FukumenzanCardFace";
import type { FukumenzanCardDrag } from "@/games/fukumenzan/ui/board/use-fukumenzan-input";
import { cn } from "@/lib/utils";

type FukumenzanDraggedCardProps = {
  drag: FukumenzanCardDrag;
  /** 札の大きさ。`play` は札の列と同じに広い画面で大きくする。`compact` はどの画面でも狭い画面の札の大きさにする（遊び方の例）。 */
  size?: "play" | "compact";
};

/** 運んでいる札。押した所を受けないので、下にある文字を落とし先として探せる。 */
export function FukumenzanDraggedCard({
  drag,
  size = "play",
}: FukumenzanDraggedCardProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed top-0 left-0 z-10 h-13 w-12 [container-type:size]",
        size === "play" && "sm:h-[4.5rem] sm:w-16",
      )}
      style={{
        transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)`,
      }}
    >
      <FukumenzanCardFace digit={drag.digit} />
    </div>
  );
}
