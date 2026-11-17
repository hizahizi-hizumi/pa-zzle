import type { CSSProperties } from "react";

import type {
  ReflectionEntry,
  ReflectionSide,
} from "@/games/reflection/puzzle/laser";
import {
  getReflectionBoardOrigin,
  getReflectionFigureExtent,
} from "@/games/reflection/ui/board/board-geometry";

/**
 * 遊び方の盤面のマスの大きさ（`--reflection-figure-unit`）。外周の数字の帯もマスの大きさに比例するので、例の盤面は、
 * ゴールの盤面とマスの大きさをそろえれば、数字・印・ピースも同じ物に見える。
 * - 狭い画面: ゴールの盤面（5×5、外周の数字の帯を含めて 7 マス分）は、画面の幅から左右の余白（32px）を除いた幅と、
 *   遊び方の層が渡す上限（画面の高さから 24rem を除いた高さか、幅の7割の大きい方）の小さい方に収める。例も同じ式で決め、56px までにする。
 *   幅 320px でも、3×3 の例（5 マス分）が例の面の内側（画面の幅から 64px を除いた幅）に収まる。
 *   スマートフォンでは対の2つが横に収まらないので、面が縦に並べる。
 * - 広い画面: 例は 48px にし、3×3 の例2つと対の間が 640px の面の内側に横に並ぶようにする。ゴールの盤面のマスも 48px までにする。
 * 遊び方の手がかりの大きさも、同じマスの大きさから決める（`--how-to-play-unit`）。
 * Tailwind が組み立てた文字列を拾えないので、どの値もそのまま書く。
 */
export const reflectionFigureUnitClassName =
  "[--reflection-figure-unit:min(calc((100vw-32px)/7),calc(max(100svh-24rem,70vw)/7),56px)] lg:[--reflection-figure-unit:48px] [--how-to-play-unit:var(--reflection-figure-unit)]";

/** ゴールの盤面のマスの上限。例のマスと同じにする。 */
export const reflectionGoalUnitMaxClassName =
  "[--reflection-goal-unit-max:56px] lg:[--reflection-goal-unit-max:48px]";

/** `size` マス四方の盤面に、外周の数字の帯を含めた一辺。 */
export function getReflectionFigureSide(size: number): string {
  return `calc(var(--reflection-figure-unit) * ${getReflectionFigureExtent(size)})`;
}

/** 外周の数字の帯と、盤面との隙間を合わせた幅（マス単位）。 */
const CLUE_BAND_UNITS = getReflectionBoardOrigin().x;

/**
 * 例の盤面の置き場所と、その中の盤面の置き方。盤面そのものは本番と同じ大きさの格子で描き、置き場所からずらして置く。
 * - 上下: 描く外周の数字が1つも無い辺は、帯の場所を置き場所から切り落とし、盤面と例の下の言葉の間に余りの空きを残さない。
 * - 左右: どちらかの辺に描く数字があれば、両方の帯を残す。盤面の格子を置き場所の左右の中央に置き、例の下の言葉と、
 *   縦に並べた2つの例の盤面を、格子の中央にそろえるため。どちらにも数字が無ければ両方を切り落とす。
 */
export function getReflectionFigureFrame(
  size: number,
  visibleEntries: readonly ReflectionEntry[] | undefined,
): { frame: CSSProperties; board: CSSProperties } {
  function hasBand(sides: readonly ReflectionSide[]): boolean {
    return (
      visibleEntries === undefined ||
      visibleEntries.some((entry) => sides.includes(entry.side))
    );
  }
  const horizontal = hasBand(["left", "right"]) ? 0 : CLUE_BAND_UNITS;
  const top = hasBand(["top"]) ? 0 : CLUE_BAND_UNITS;
  const bottom = hasBand(["bottom"]) ? 0 : CLUE_BAND_UNITS;
  const extent = getReflectionFigureExtent(size);
  const unit = "var(--reflection-figure-unit)";
  return {
    frame: {
      width: `calc(${unit} * ${extent - horizontal * 2})`,
      height: `calc(${unit} * ${extent - top - bottom})`,
    },
    board: {
      left: `calc(${unit} * ${-horizontal})`,
      top: `calc(${unit} * ${-top})`,
      width: `calc(${unit} * ${extent})`,
      height: `calc(${unit} * ${extent})`,
    },
  };
}
