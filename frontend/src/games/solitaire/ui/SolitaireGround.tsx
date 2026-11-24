import { solitaireToneClassNames } from "@/games/solitaire/ui/solitaire-tone";
import { cn } from "@/lib/utils";

/** 札を広げる卓の地。プレイ画面とゲームのホームで同じ色にする。 */
export function SolitaireGround() {
  return <div className={cn("size-full", solitaireToneClassNames.ground)} />;
}
