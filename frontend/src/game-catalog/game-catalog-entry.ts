import type { ReactElement } from "react";

import type { PlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import type { PlayAttemptDisplayDefinition } from "@/records/ui/play-attempt-display";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";
import type { Path } from "@/router";

/** 完了記録や離脱した試行の問題で再プレイを始められない理由。 */
export type RecordReplayUnavailableReason =
  /** 現在のアプリが読み取れない記録・試行。 */
  | "unsupported-record"
  /** 今は無い難易度区分で遊んだ記録。 */
  | "legacy-difficulty"
  /** 問題集から問題を引けない記録。 */
  | "problem-not-in-pool"
  /** 記録の identity から問題を復元できない記録。 */
  | "problem-not-restorable";

type RecordReplayUnavailable = {
  status: "unavailable";
  reason: RecordReplayUnavailableReason;
};

/** 記録・試行の開始条件から求めた、再プレイを始めるための開始条件。 */
export type RecordReplayStart<Start> =
  | { status: "available"; start: Start }
  | RecordReplayUnavailable;

export type RecordReplay =
  | { status: "available"; play: ReactElement }
  | RecordReplayUnavailable;

/** アプリが提供する1つのゲームの、入口・記録・記録や離脱した試行からの再プレイ。 */
export type GameCatalogEntry = {
  /** 記録の `gameId` と同じ値。 */
  id: string;
  name: string;
  pictogramSvg: string;
  entryPath: Path;
  playRecordDisplay: PlayRecordDisplayDefinition;
  playAttemptDisplay: PlayAttemptDisplayDefinition;
  replayRecord: (record: PlayRecord) => RecordReplay;
  replayAttempt: (attempt: PlayAttempt) => RecordReplay;
};

export function unavailableRecordReplay(
  reason: RecordReplayUnavailableReason,
): RecordReplayUnavailable {
  return { status: "unavailable", reason };
}

function renderRecordReplay<Start>(
  replayStart: RecordReplayStart<Start>,
  renderPlay: (start: Start) => ReactElement,
): RecordReplay {
  return replayStart.status === "available"
    ? { status: "available", play: renderPlay(replayStart.start) }
    : replayStart;
}

type GameReplaySource<Conditions, Start> = {
  /** 今のアプリが読める完了記録なら、その開始条件を返す。 */
  readRecordConditions: (record: PlayRecord) => Conditions | null;
  /** 今のアプリが読める試行なら、その開始条件を返す。 */
  readAttemptConditions: (attempt: PlayAttempt) => Conditions | null;
  /** 難易度・問題識別情報などの開始条件から、再プレイを始める問題を復元する。 */
  resolveStart: (conditions: Conditions) => RecordReplayStart<Start>;
  renderPlay: (start: Start) => ReactElement;
};

/**
 * 完了記録と離脱した試行のどちらからでも、同じ開始条件の復元で再プレイを始める。
 * 記録と試行は開始条件を同じ意味で持つので、復元できない理由もどちらにも同じく当てはまる。
 */
export function createGameReplay<Conditions, Start>({
  readRecordConditions,
  readAttemptConditions,
  resolveStart,
  renderPlay,
}: GameReplaySource<Conditions, Start>): Pick<
  GameCatalogEntry,
  "replayRecord" | "replayAttempt"
> {
  function replay(conditions: Conditions | null): RecordReplay {
    return conditions === null
      ? unavailableRecordReplay("unsupported-record")
      : renderRecordReplay(resolveStart(conditions), renderPlay);
  }

  return {
    replayRecord(record) {
      return replay(readRecordConditions(record));
    },
    replayAttempt(attempt) {
      return replay(readAttemptConditions(attempt));
    },
  };
}
