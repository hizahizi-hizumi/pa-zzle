import { CircleAlert, Flag } from "lucide-react";
import type { ResultRecordFeedback } from "@/games/play";

type Props = { feedback: ResultRecordFeedback };

export function GameResultRecordNotice({ feedback }: Props) {
  if (feedback.kind !== "first-record" && feedback.kind !== "failed")
    return null;
  const failed = feedback.kind === "failed";
  return (
    <section
      className={`result-record-note ${failed ? "is-failed" : "is-first"}`}
      aria-label="記録通知"
    >
      <div className="result-record-heading">
        {failed ? (
          <CircleAlert aria-hidden="true" className="result-record-award" />
        ) : (
          <Flag aria-hidden="true" className="result-record-award" />
        )}
        <strong className="result-record-title">
          {failed ? "記録を保存できませんでした" : "初記録"}
        </strong>
      </div>
      {failed && (
        <small className="result-record-detail">
          今回の結果は保存されていません
        </small>
      )}
    </section>
  );
}
