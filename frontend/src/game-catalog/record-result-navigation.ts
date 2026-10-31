import { useEffect } from "react";

import { createRecordResultLocationState } from "@/game-catalog/record-result-location-state";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import { useNavigate } from "@/router";

/**
 * クリアして結果を見せる段になったら、保存した記録の結果画面（`/puzzles/<game>/result/<記録ID>`）へ履歴を置き換えて遷移する。
 * 結果画面を記録から開き直せるので、結果を見たまま再読み込みしても次の問題が始まらない。
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
