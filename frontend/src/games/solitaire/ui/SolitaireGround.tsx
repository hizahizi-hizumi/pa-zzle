import { cn } from "@/lib/utils";

/** 札を広げる卓の地。プレイ画面とゲームのホームで同じ色にする。 */
export const solitaireGroundClassName = "bg-[#e1e9e2] dark:bg-[#18231d]";

export function SolitaireGround() {
  return <div className={cn("size-full", solitaireGroundClassName)} />;
}
