import { cn } from "@/lib/utils";

/** プレイ画面とゲームのホームの地の色。盤面の穴と縁の欠けは塗らずにこの地を見せるので、遊び方で盤面を描くときも、盤面の下にこの地を敷く。 */
export const hitofudePuzzleGroundClassName = "bg-[#e8e6de] dark:bg-[#1a1916]";

export function HitofudePuzzleGround() {
  return <div className={cn("size-full", hitofudePuzzleGroundClassName)} />;
}
