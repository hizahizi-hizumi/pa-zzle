import { WaterSortIdeaProvider } from "@/games/water-sort/ui/ideas/WaterSortIdeaProvider";
import {
  type WaterSortPlayProps,
  WaterSortPlayScreen,
} from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayScreen";

export function WaterSortPlay(props: WaterSortPlayProps) {
  return (
    <WaterSortIdeaProvider>
      <WaterSortPlayScreen {...props} />
    </WaterSortIdeaProvider>
  );
}
