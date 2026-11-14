import { useEffect } from "react";
import { createRecordResultLocationState } from "@/app/navigation/record-result-location-state";
import type { PlayRecord } from "@/features/records/play-record";
import type { PlayRecordSaveOutcome } from "@/features/records/save-play-record";
import { useNavigate } from "@/router";

/**
 * 記録の結果画面へ移るので、結果を見たまま再読み込みしても、記録から結果画面を開き直し、次の問題が始まらない。
 *
 * 遷移するとき（記録があり、保存に失敗していない）は `true` を返す。プレイ側は結果画面を描かず、遷移を待つ。
 * 保存に失敗したプレイは `false` を返し、プレイ側でその場の結果画面を出す。
 */
export function useRecordResultNavigation(
  resultReached: boolean,
  record: PlayRecord | null,
  recordOutcome: PlayRecordSaveOutcome | null,
): boolean {
  const navigate = useNavigate();
  const navigatesToRecordResult =
    resultReached && record !== null && recordOutcome?.status !== "failed";

  // 保存結果は記録を保存する effect の後のレンダーで決まるので、遷移も effect で待つ。
  useEffect(() => {
    if (
      !resultReached ||
      !record ||
      !recordOutcome ||
      recordOutcome.status === "failed"
    ) {
      return;
    }
    navigate("/puzzles/:game/result/:recordId", {
      params: { game: record.gameId, recordId: record.id },
      replace: true,
      state: createRecordResultLocationState(recordOutcome),
    });
  }, [navigate, record, recordOutcome, resultReached]);

  return navigatesToRecordResult;
}
