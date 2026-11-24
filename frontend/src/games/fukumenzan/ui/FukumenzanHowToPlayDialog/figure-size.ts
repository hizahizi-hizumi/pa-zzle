import type { CSSProperties } from "react";

import { howToPlayProblem } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";

/**
 * 遊び方の例と図の、式のマス1つの一辺。方眼の目（24px）の2つ分の 48px にし、札の並びを式の幅にそろえても札が 44px 四方を
 * 下回らないようにする。広い画面では 56px に広げ、できる形とできない形の対を面の中に横に並べられる大きさまでにする。
 */
export const exampleUnitClassName =
  "[--fukumenzan-example-unit:3rem] lg:[--fukumenzan-example-unit:3.5rem]";

const columnCount = howToPlayProblem.result.length + 1;
const rowCount = howToPlayProblem.addends.length + 1;

/** 例の式の置き場所。本番の盤面はマスの大きさを置き場所の大きさから決めるので、マスの大きさから置き場所の大きさを決めて渡す。 */
export const exampleEquationStyle = {
  width: `calc(var(--fukumenzan-example-unit) * ${columnCount})`,
  height: `calc(var(--fukumenzan-example-unit) * ${rowCount} + 1rem)`,
} satisfies CSSProperties;
