import { Bottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle/Bottle";
import { Water } from "@/games/water-sort/ui/board/water-bottle/WaterBottle/Water";
import { useWaterSortIdea } from "@/games/water-sort/ui/ideas/IdeaContext";
import type { WaterBottleProps } from "@/games/water-sort/ui/ideas/overrides";

export function WaterBottle(props: WaterBottleProps) {
  const IdeaWaterBottle = useWaterSortIdea().overrides.WaterBottle;
  if (IdeaWaterBottle) {
    return <IdeaWaterBottle {...props} />;
  }

  const { contents, selected = false, waterOverlay } = props;
  return (
    <span aria-hidden="true" className="absolute inset-0">
      <span className="absolute inset-x-[4px] bottom-[4px] top-3 overflow-hidden rounded-b-[1.15rem] bg-black/[0.015]">
        <Water contents={contents} />
        {waterOverlay}
      </span>
      <Bottle selected={selected} />
    </span>
  );
}
