import {
  NANPURE_MISTAKE_PENALTY,
  NANPURE_RESTART_PENALTY,
  NANPURE_SCORE_MAXIMUMS,
  NANPURE_SPEED_FULL_SCORE_MS,
  NANPURE_SPEED_PENALTY_PER_INTERVAL,
  NANPURE_UNDO_PENALTY,
} from "@/games/nanpure/score";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

export const nanpureScoreCriteria = {
  items: [
    {
      label: "正確さ",
      description: (
        <>
          ミスなしで{NANPURE_SCORE_MAXIMUMS.accuracy}点。ミス1回につき
          {NANPURE_MISTAKE_PENALTY}点減点。
        </>
      ),
    },
    {
      label: "速さ",
      description: (
        <>
          {formatElapsedTime(NANPURE_SPEED_FULL_SCORE_MS)}以内で
          {NANPURE_SCORE_MAXIMUMS.speed}点。超過時間を1分単位で切り上げ、
          1分につき{NANPURE_SPEED_PENALTY_PER_INTERVAL}点減点。
        </>
      ),
    },
    {
      label: "安定性",
      description: (
        <>
          待った・やり直しなしで{NANPURE_SCORE_MAXIMUMS.stability}
          点。待った1回につき
          {NANPURE_UNDO_PENALTY}点、やり直し1回につき
          {NANPURE_RESTART_PENALTY}点減点。
        </>
      ),
    },
  ],
  note: {
    label: "下限",
    description: "各項目は0点を下限とします。",
  },
};
