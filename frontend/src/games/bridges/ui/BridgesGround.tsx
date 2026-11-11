import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";
import { SeaWaves } from "@/games/bridges/ui/SeaWaves";
import { cn } from "@/lib/utils";

/**
 * ブリッジパズルの地。無地の海にまばらな波の印を散らし、ゲームのホームとプレイ画面の全体に敷く。
 * 盤面の位置に依らない姿にし、どの画面に敷いても盤面や文字の後ろで目立たない密度に保つ。
 */
export function BridgesGround() {
  return (
    <div className={cn("relative size-full", bridgesToneClassNames.sea)}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <SeaWaves unit={1} />
      </svg>
    </div>
  );
}
