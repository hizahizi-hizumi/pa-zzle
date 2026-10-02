import { useState } from "react";

import { findGameCatalogEntry } from "@/game-catalog/game-catalog";
import {
  type RecordReplay,
  type RecordReplayUnavailableReason,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { getAbandonedPlayAttempts } from "@/records/play-attempt";
import { readPlayAttempts } from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { Link, useParams } from "@/router";

const unavailableReasonMessages: Record<RecordReplayUnavailableReason, string> =
  {
    "unsupported-record":
      "現在のバージョンでは、この記録の再プレイに対応していません。",
    "legacy-difficulty":
      "この記録は以前の難易度区分で遊んだため、今の難易度では再プレイできません。",
    "problem-not-in-pool": "この記録の問題は、現在の問題集にありません。",
    "problem-not-restorable": "この記録の問題を復元できません。",
  };

/**
 * 記録画面に並ぶプレイ（完了記録か離脱した試行）の問題で再プレイを始める。
 * 完了記録の id はゲーム・開始・完了の時刻と問題の識別情報から、試行の id はゲームと開始時刻から作るので、
 * 両者が同じ id になることはない。完了記録を先に探す。
 */
function replayStoredPlay(playId: string): RecordReplay | null {
  const records = readPlayRecords();
  const record = records.find((candidate) => candidate.id === playId);
  if (record) {
    const game = findGameCatalogEntry(record.gameId);
    return game
      ? game.replayRecord(record)
      : unavailableRecordReplay("unsupported-record");
  }

  // 記録画面に出ない試行（完了記録がある・離脱していない）は再プレイの対象にしない。
  const attempt = getAbandonedPlayAttempts(readPlayAttempts(), records).find(
    (candidate) => candidate.id === playId,
  );
  if (!attempt) {
    return null;
  }

  const game = findGameCatalogEntry(attempt.gameId);
  return game
    ? game.replayAttempt(attempt)
    : unavailableRecordReplay("unsupported-record");
}

export function RecordedProblemReplayView() {
  const { recordId } = useParams("/records/replay/:recordId");
  // 問題の復元は重いことがあるので、画面を開いたときに一度だけ行う。
  const [replay] = useState(() => replayStoredPlay(recordId));

  if (!replay) {
    return (
      <section className="mx-auto w-full max-w-3xl py-8 text-center">
        <h1 className="text-heading">記録が見つかりません</h1>
        <p className="mt-2 text-supporting text-muted-foreground">
          元の記録が削除されたか、この端末に保存されていません。
        </p>
        <Link
          to="/records"
          className="mt-6 inline-block text-supporting font-medium underline underline-offset-4"
        >
          記録へ戻る
        </Link>
      </section>
    );
  }

  if (replay.status === "available") {
    return replay.play;
  }

  return (
    <section className="mx-auto w-full max-w-3xl py-8 text-center">
      <h1 className="text-heading">この記録は再プレイできません</h1>
      <p className="mt-2 text-supporting text-muted-foreground">
        {unavailableReasonMessages[replay.reason]}
      </p>
      <Link
        to="/records"
        className="mt-6 inline-block text-supporting font-medium underline underline-offset-4"
      >
        記録へ戻る
      </Link>
    </section>
  );
}
