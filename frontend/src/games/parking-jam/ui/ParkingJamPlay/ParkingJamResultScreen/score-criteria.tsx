import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  PARKING_JAM_FAILED_MOVE_PENALTY,
  PARKING_JAM_RESTART_PENALTY,
  PARKING_JAM_UNDO_PENALTY,
} from "@/games/parking-jam/score";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

export function getParkingJamScoreCriteria(result: ParkingJamResult) {
  return {
    items: [
      {
        label: "正確さ",
        description: `出せない方向を1回選ぶごとに -${PARKING_JAM_FAILED_MOVE_PENALTY}点`,
      },
      {
        label: "速さ",
        description: `${formatElapsedTime(result.speedFullScoreMs)}まで満点、2倍の時間で0点`,
      },
      {
        label: "安定性",
        description: `待った1回 -${PARKING_JAM_UNDO_PENALTY}点、やり直し1回 -${PARKING_JAM_RESTART_PENALTY}点`,
      },
    ],
  };
}
