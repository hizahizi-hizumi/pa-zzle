import { cn } from "@/lib/utils";

/** プレイ画面とゲームのホームの地の色。遊び方で、プレイ画面の知らせを本番と同じ見た目で描くときも、この地の上に置く。 */
export const waterSortGroundClassName = "bg-[#e5eef0] dark:bg-[#1c292d]";

export function WaterSortGround() {
  return <div className={cn("size-full", waterSortGroundClassName)} />;
}
