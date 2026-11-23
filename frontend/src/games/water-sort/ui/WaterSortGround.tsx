import { waterSortGroundClassName } from "@/games/water-sort/ui/water-sort-ground-color";
import { cn } from "@/lib/utils";

/** プレイ画面・チュートリアル・ゲームのホームの地。盤面より目立たない、無彩に近い1色。 */
export function WaterSortGround() {
  return <div className={cn("size-full", waterSortGroundClassName)} />;
}
