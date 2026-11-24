import type { CSSProperties } from "react";

import { howToPlayProblem } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";

const columnCount = howToPlayProblem.result.length + 1;
const rowCount = howToPlayProblem.addends.length + 1;

/**
 * 遊び方の例と図の、式のマス1つの一辺（`--fukumenzan-example-unit`）。例を並べる面の内側の幅（`@container`）から決め、4rem までにする。
 * - 面が狭いうちは、式の幅を面の内側の幅に合わせる。本番のプレイ画面の式も画面の幅に合わせて広がるので、札とマスの比が本番と同じになる。
 * - 面の内側が 572px からは、できる形とできない形の対を、間（`pairedExampleClassNames`）を含めて横に並べられる大きさにする。
 *   ほかの例も同じ大きさにそろえる。572px は、対を横に並べてもマスが本番のスマホの幅のマス（約52px）を下回らない幅。
 */
const narrowUnitClassName =
  "[--fukumenzan-example-unit:min(100cqw/var(--fukumenzan-example-columns),4rem)]";

/** 例と図の根の、式と札の並びを縦に並べて広い方の中央にそろえる組み方。 */
const figureLayoutClassName = "grid justify-items-center gap-3";

/** 触れる例の根。 */
export const exampleFigureClassName = `${figureLayoutClassName} ${narrowUnitClassName} @min-[35.75rem]:[--fukumenzan-example-unit:min((100cqw_-_2px)/(2*var(--fukumenzan-example-columns)_+_1),4rem)]`;

/**
 * × の数の図の根。右上の丸の小さな数と、× を付けた札の数字を読めるよう、面が広ければマスを本番の大きさに近い 4.5rem にする。
 * 4.5rem は、0〜9 の札を本番の広い画面と同じく1段に並べても、面の内側に収まる大きさ。
 */
export const candidateFigureClassName = `${figureLayoutClassName} ${narrowUnitClassName} @min-[35.75rem]:[--fukumenzan-example-unit:4.5rem]`;

/** 例と図の根に渡す、式の列の数。 */
export const exampleUnitStyle = {
  "--fukumenzan-example-columns": columnCount,
} as CSSProperties;

/** 例の式の置き場所。本番の盤面はマスの大きさを置き場所の大きさから決めるので、マスの大きさから置き場所の大きさを決めて渡す。 */
export const exampleEquationStyle = {
  width: `calc(var(--fukumenzan-example-unit) * ${columnCount})`,
  height: `calc(var(--fukumenzan-example-unit) * ${rowCount} + 1rem)`,
} satisfies CSSProperties;

/** 札の並びの置き場所。スマホの幅では本番と同じく式の幅にそろえ、広い画面では札の大きさから決める。 */
export const exampleCardRowClassName =
  "w-[calc(var(--fukumenzan-example-unit)*var(--fukumenzan-example-columns))] sm:w-auto";

/**
 * 対の例に足す間。どちらも、面の罫線を両方の式のマスにそろえるため。
 * - 横に並べるときは、できる形の例の右に足し、面が対の間に空ける間（広い画面では 2.5rem、ほかは 2rem）と合わせて、
 *   2つの式の間を式のマス1つ分（方眼の目の2つ分）にする。
 * - 縦に積むときは、できない形の例の上に足し、2つの式の上端の間を方眼の目の倍数にする。積んだ2つの式の上端の間は、マス3段に
 *   150px（式の答えの前の 16px・式と札の並びの間の 12px・札の並び 46px・例と判定の間の 12px・判定の行 24px・積んだ例の間の 40px）を
 *   足した長さ。
 */
export const pairedExampleClassNames = {
  allowed:
    "@min-[35.75rem]:mr-[calc(var(--fukumenzan-example-unit)_-_2rem)] lg:@min-[35.75rem]:mr-[calc(var(--fukumenzan-example-unit)_-_2.5rem)]",
  disallowed:
    "@max-[35.75rem]:mt-[calc(round(up,150px,var(--fukumenzan-example-unit)/2)_-_150px)]",
} as const;
