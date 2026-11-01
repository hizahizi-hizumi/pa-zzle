import type { ParkingJamVehicleId } from "@/games/parking-jam/puzzle/board";

/**
 * 車に一時的に重ねる合図。チュートリアルで、次に動かす車や手の結果を、説明文に頼らず盤面の上で示すのに使う。
 * - `hint`: 次に動かす車を、出た瞬間から分かる強さで示す。`id` が変わるたびに一瞬光らせて付け直す。
 * - `rejected`: 出られなかった車を、車体の縁を一瞬警告の色にして示す。当たる動きを見せない動きを減らす設定でも伝わる。
 */
export type ParkingJamVehicleCueKind = "hint" | "rejected";

/** `id` が変わると、同じ車の同じ合図でもやり直す。1台に種類の違う合図を重ねてよい。 */
export type ParkingJamVehicleCue = {
  vehicleId: ParkingJamVehicleId;
  kind: ParkingJamVehicleCueKind;
  id: number;
};
