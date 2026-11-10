import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";
import { SeaWaves } from "@/games/bridges/ui/SeaWaves";
import { cn } from "@/lib/utils";

/**
 * プレイ画面の盤面の周りから、ブランドの帯と見出しの後ろまでを満たす海。クリアしても色を変えず、ブランドの帯とブラウザの色と
 * いつも同じ色でつなぐ。完成の演出は盤面の島ごとに見せる。
 */
export function BridgesSea() {
  return (
    <div className={cn("relative size-full", bridgesToneClassNames.sea)}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <SeaWaves unit={1} />
      </svg>
    </div>
  );
}
