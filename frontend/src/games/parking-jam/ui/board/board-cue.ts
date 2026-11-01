import type {
  ParkingJamMove,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import type { ParkingJamExitContact } from "@/games/parking-jam/puzzle/rules";

/**
 * 車に一時的に重ねる合図。チュートリアルで、次に動かす車や手の結果を、説明文に頼らず盤面の上で示すのに使う。
 * - `hint`: 次に動かす車を、出た瞬間から分かる強さで示す。`id` が変わるたびに一瞬光らせて付け直す。
 * - `rejected`: 受け付けなかった車を、車体の縁を一瞬警告の色にして示す。動きを減らす設定でも伝わる。
 */
export type ParkingJamVehicleCueKind = "hint" | "rejected";

/** `id` が変わると、同じ車の同じ合図でもやり直す。1台に種類の違う合図を重ねてよい。 */
export type ParkingJamVehicleCue = {
  vehicleId: ParkingJamVehicleId;
  kind: ParkingJamVehicleCueKind;
  id: number;
};

/**
 * 出られない手で、車がまっすぐ進む先と、最初に当たるもの（ほかの車・植え込み・道路につながっていない外周）を示す合図。
 * - `rejected`: 出られなかった手の後に、警告の色で一瞬示す。
 * - `waiting`: 先に出す車に塞がれていることを、手順の間示し続ける。
 */
export type ParkingJamContactCue = {
  move: ParkingJamMove;
  contact: ParkingJamExitContact;
  tone: "rejected" | "waiting";
  id: number;
};
