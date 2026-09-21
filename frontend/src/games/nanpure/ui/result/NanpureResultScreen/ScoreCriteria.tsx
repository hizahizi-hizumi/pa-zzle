import {
  NANPURE_MISTAKE_PENALTY,
  NANPURE_RESTART_PENALTY,
  NANPURE_SCORE_MAXIMUMS,
  NANPURE_SPEED_FULL_SCORE_MS,
  NANPURE_SPEED_PENALTY_PER_INTERVAL,
  NANPURE_UNDO_PENALTY,
} from "@/games/nanpure/score";
import { formatElapsedTime } from "@/games/nanpure/ui/format-elapsed-time";

export function ScoreCriteria() {
  return (
    <dl className="mt-3 grid gap-3 text-meta">
      <div>
        <dt className="font-semibold text-foreground">正確さ</dt>
        <dd className="mt-1">
          ミスなしで{NANPURE_SCORE_MAXIMUMS.accuracy}点。ミス1回につき
          {NANPURE_MISTAKE_PENALTY}点減点。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-1">
          {formatElapsedTime(NANPURE_SPEED_FULL_SCORE_MS)}以内で
          {NANPURE_SCORE_MAXIMUMS.speed}点。超過時間を1分単位で切り上げ、
          1分につき{NANPURE_SPEED_PENALTY_PER_INTERVAL}点減点。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">安定性</dt>
        <dd className="mt-1">
          待った・やり直しなしで{NANPURE_SCORE_MAXIMUMS.stability}
          点。待った1回につき
          {NANPURE_UNDO_PENALTY}点、やり直し1回につき
          {NANPURE_RESTART_PENALTY}点減点。
        </dd>
      </div>
      <div>
        <dt className="sr-only">下限</dt>
        <dd>各項目は0点を下限とします。</dd>
      </div>
    </dl>
  );
}
