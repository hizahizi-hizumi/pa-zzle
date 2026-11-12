import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 遊び方の図のボトルの大きさの決め方。
 * - `example`: ルールと操作の例。例のボトルの幅で描く。
 * - `flowFrame`: 手戻りの流れの図のコマ。2つの流れのコマを同じ列にそろえ、1段に3本のボトルの姿3つと矢印2つが面に収まる大きさにし、
 *   例のボトルより大きくしない。矢印の名前は3文字までの行に分けるので、矢印のまとまり2つ（2 × 42px）と間（4 × 8px）で 7.25rem を取る。
 * - `goal`: 入口のゴールの盤面。ボトルの幅は置き場所に合わせて盤面の側が決め、例のボトルの幅を上限に使う。
 */
type BottleSize = "example" | "flowFrame" | "goal";

/**
 * 例のボトルの幅（`--water-sort-example-bottle`）と、ボトルの間のボトルの幅に対する比（`--water-sort-figure-gap-ratio`）。
 * 間の比は、本番のプレイ画面の4列の盤面（スマートフォンでボトル約66px・間16px、PC でボトル約100px・間16px）に合わせる。
 * 本番より間を詰めると、注ぐ動きで傾いたボトルが隣のボトルに本番より深くかかるため。
 */
const exampleBottleWidth =
  "[--water-sort-example-bottle:--spacing(11)] [--water-sort-figure-gap-ratio:0.24] lg:[--water-sort-example-bottle:--spacing(18)] lg:[--water-sort-figure-gap-ratio:0.16]";

/** 図はボトルの幅を `--water-sort-figure-bottle` から読む。 */
const figureBottleWidths = {
  example: "[--water-sort-figure-bottle:var(--water-sort-example-bottle)]",
  flowFrame:
    "[--water-sort-figure-bottle:min(var(--water-sort-example-bottle),calc((100cqw-7.25rem)/(9+6*var(--water-sort-figure-gap-ratio))))]",
  goal: "",
} as const satisfies Record<BottleSize, string>;

type BottleSizeScopeProps = {
  size: BottleSize;
  children: ReactNode;
};

/**
 * 中に置いた遊び方の図に、ボトルの大きさを渡す。自分では箱を作らず、中の図の並びを変えない。
 * 大きさは CSS 変数で渡すので、置き場所の幅（`cqw`）を使う決め方は、図を描く所の置き場所の幅で決まる。
 */
export function BottleSizeScope({ size, children }: BottleSizeScopeProps) {
  return (
    <div
      className={cn("contents", exampleBottleWidth, figureBottleWidths[size])}
    >
      {children}
    </div>
  );
}
