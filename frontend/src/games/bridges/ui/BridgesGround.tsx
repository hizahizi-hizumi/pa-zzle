import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";
import { SeaWaves, SeaWideWaves } from "@/games/bridges/ui/SeaWaves";
import { cn } from "@/lib/utils";

/**
 * PC の広い画面で、盤面の外の海にだけ波の印を足す範囲。盤面は画面の中央に高さいっぱいの正方形で置かれるので、
 * 中央の幅（画面の高さほど）を横のマスクで抜く。
 */
const WIDE_WAVES_CLASS_NAME =
  "absolute inset-0 hidden size-full lg:block [mask-image:linear-gradient(to_right,black_0,black_calc(50%-50vh),transparent_calc(50%-40vh),transparent_calc(50%+40vh),black_calc(50%+50vh))]";

/**
 * スマホの縦長の画面で、盤面の上下の海にだけ波の印を足す範囲。盤面は画面の幅いっぱいの正方形で上下の中ほどに置かれるので、
 * PC と同じやり方で、中央の高さ（画面の幅ほど）を縦のマスクで抜く。見出しの後ろには足さない。
 */
const TALL_WAVES_CLASS_NAME =
  "absolute inset-0 size-full lg:hidden landscape:hidden [mask-image:linear-gradient(to_bottom,transparent_0,transparent_6rem,black_9rem,black_calc(50%-50vw-1.5rem),transparent_calc(50%-50vw+1rem),transparent_calc(50%+50vw-1rem),black_calc(50%+50vw+1.5rem))]";

/**
 * ブリッジパズルの地。プレイ画面とゲームのホームの背景に敷く。
 *
 * プレイ画面の盤面の周りから、ブランドの帯と見出しの後ろまでを満たす海。クリアしても色を変えず、ブランドの帯とブラウザの色と
 * いつも同じ色でつなぐ。完成の演出は盤面の島ごとに見せる。
 */
export function BridgesGround() {
  return (
    <div className={cn("relative size-full", bridgesToneClassNames.sea)}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <SeaWaves unit={1} />
      </svg>
      <svg className={WIDE_WAVES_CLASS_NAME} aria-hidden="true">
        <SeaWideWaves />
      </svg>
      <svg className={TALL_WAVES_CLASS_NAME} aria-hidden="true">
        <SeaWideWaves />
      </svg>
    </div>
  );
}
