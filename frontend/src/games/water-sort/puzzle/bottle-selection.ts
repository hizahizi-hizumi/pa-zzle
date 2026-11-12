import {
  getWaterSortPourAmount,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import {
  isCompleteWaterSortBottle,
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";

/**
 * ボトルを押したときに盤面が受け付けること。
 * - `source-selected` / `source-deselected`: 注ぐボトルを選んだ・選ぶのをやめた。
 * - `invalid`: 選べないボトルか、注げない注ぎ先を押した。
 * - `pour`: 選んでいるボトルから押したボトルへ注ぐ。
 */
export type WaterSortBottleSelection =
  | { type: "source-selected" | "source-deselected"; bottleIndex: number }
  | { type: "invalid"; bottleIndex: number }
  | { type: "pour"; move: WaterSortMove };

/**
 * 押したボトルを盤面が受け付けないわけ。
 * - `empty`: 空のボトルを注ぐボトルに選ぼうとした。
 * - `complete`: 1色で満杯のボトルを注ぐボトルに選ぼうとした。
 * - `no-destination`: 注げる先が無いボトルを注ぐボトルに選ぼうとした。
 * - `full`: 満杯のボトルへ注ごうとした。
 * - `different-color`: いちばん上の色が違うボトルへ注ごうとした。
 */
export type WaterSortRejection =
  | "empty"
  | "complete"
  | "no-destination"
  | "full"
  | "different-color";

/** 注ぐボトルに選べないわけを返す。空・1色で満杯・注げる先が無いの順に調べ、最初に当てはまった1つだけにする。選べるなら空。 */
export function listWaterSortSourceRejections(
  state: WaterSortState,
  bottleIndex: number,
): WaterSortRejection[] {
  const bottle = state[bottleIndex] ?? [];
  if (bottle.length === 0) {
    return ["empty"];
  }
  if (isCompleteWaterSortBottle(bottle)) {
    return ["complete"];
  }
  return listWaterSortLegalMoves(state).some(
    (move) => move.sourceBottleIndex === bottleIndex,
  )
    ? []
    : ["no-destination"];
}

/**
 * 注ぎ先へ注げないわけを、当てはまるものすべて返す。注げるなら空。
 * 前提: `move` の注ぐボトルと注ぎ先は違うボトルで、どちらも `state` にある。注ぐボトルに選べるか（1色で満杯か・注げる先があるか）は見ない。
 */
export function listWaterSortPourRejections(
  state: WaterSortState,
  move: WaterSortMove,
): WaterSortRejection[] {
  if (getWaterSortPourAmount(state, move) > 0) {
    return [];
  }
  const source = state[move.sourceBottleIndex] ?? [];
  const destination = state[move.destinationBottleIndex] ?? [];
  const rejections: WaterSortRejection[] = [];
  if (source.length === 0) {
    rejections.push("empty");
  }
  if (destination.length >= WATER_SORT_BOTTLE_CAPACITY) {
    rejections.push("full");
  }
  if (
    source.length > 0 &&
    destination.length > 0 &&
    destination.at(-1) !== source.at(-1)
  ) {
    rejections.push("different-color");
  }
  return rejections;
}

/** 注ぐボトルを `sourceBottleIndex` に選んでいる盤面で、`bottleIndex` のボトルを押す。 */
export function selectWaterSortBottle(
  state: WaterSortState,
  sourceBottleIndex: number | null,
  bottleIndex: number,
): WaterSortBottleSelection {
  if (sourceBottleIndex === null) {
    return listWaterSortSourceRejections(state, bottleIndex).length === 0
      ? { type: "source-selected", bottleIndex }
      : { type: "invalid", bottleIndex };
  }
  if (sourceBottleIndex === bottleIndex) {
    return { type: "source-deselected", bottleIndex };
  }
  const move = { sourceBottleIndex, destinationBottleIndex: bottleIndex };
  return getWaterSortPourAmount(state, move) > 0
    ? { type: "pour", move }
    : { type: "invalid", bottleIndex };
}
