import type { TakuzuTile as TakuzuTileValue } from "@/games/takuzu/puzzle/board";

type TakuzuTileProps = {
  tile: TakuzuTileValue;
  given: boolean;
};

/**
 * A は濃い青の角丸の四角、B は明るい黄の円。明度・形・色相のどれか1つだけでも見分けられるようにする。
 * ダークでも A を B より暗く保ち、明度の関係を入れ替えない。
 */
const tileClassNames = {
  a: "rounded-[12%] bg-blue-700 shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)] dark:bg-blue-500",
  b: "rounded-full bg-amber-300 shadow-[inset_0_0_0_2px_var(--color-amber-600)] dark:bg-amber-200 dark:shadow-[inset_0_0_0_2px_var(--color-amber-400)]",
} satisfies Record<TakuzuTileValue, string>;

const givenMarkClassNames = {
  a: "bg-blue-200 dark:bg-blue-950",
  b: "bg-amber-700",
} satisfies Record<TakuzuTileValue, string>;

// 置いたタイルだけを小さく膨らませて出す。固定タイルは最初から盤面にあるので動かさない。
const placedTileClassName =
  "animate-in fade-in-0 zoom-in-75 duration-(--duration-fast) motion-reduce:animate-none";

export function TakuzuTile({ tile, given }: TakuzuTileProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-[86%] items-center justify-center ${tileClassNames[tile]} ${given ? "" : placedTileClassName}`}
    >
      {given ? (
        <span
          className={`size-[18%] rounded-full ${givenMarkClassNames[tile]}`}
        />
      ) : null}
    </span>
  );
}
