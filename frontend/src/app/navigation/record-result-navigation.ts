import { useEffect } from "react";
import { createRecordResultLocationState } from "@/app/navigation/record-result-location-state";
import type { PlayRecord } from "@/features/records/play-record";
import type { PlayRecordSaveOutcome } from "@/features/records/save-play-record";
import { useNavigate } from "@/router";

/**
 * 記録の結果画面へ移るので、結果を見たまま再読み込みしても、記録から結果画面を開き直し、次の問題が始まらない。
 *
 * 記録の保存成否に関係なく、プレイから独立した結果画面へ移る。
 * 保存失敗時の結果はブラウザ履歴の state から表示する。
 */
export function useRecordResultNavigation(
  resultReached: boolean,
  record: PlayRecord | null,
  recordOutcome: PlayRecordSaveOutcome | null,
): boolean {
  const navigate = useNavigate();
  const navigatesToRecordResult = resultReached && record !== null;

  // 保存結果は記録を保存する effect の後のレンダーで決まるので、遷移も effect で待つ。
  useEffect(() => {
    if (!resultReached || !record || !recordOutcome) {
      return;
    }
    navigate("/puzzles/:game/result/:recordId", {
      params: { game: record.gameId, recordId: record.id },
      replace: true,
      state: createRecordResultLocationState(recordOutcome, record),
    });
  }, [navigate, record, recordOutcome, resultReached]);

  return navigatesToRecordResult;
}
