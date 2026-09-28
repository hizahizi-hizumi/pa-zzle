import type { ReactElement } from "react";

import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";
import type { Path } from "@/router";

/** 記録の問題で再プレイを始められない理由。 */
export type RecordReplayUnavailableReason =
  /** 現在のアプリが読み取れない記録。 */
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

/** 記録から求めた、再プレイを始めるための開始条件。 */
export type RecordReplayStart<Start> =
  | { status: "available"; start: Start }
  | RecordReplayUnavailable;

export type RecordReplay =
  | { status: "available"; play: ReactElement }
  | RecordReplayUnavailable;

/** アプリが提供する1つのゲームの、入口・記録・記録からの再プレイ。 */
export type GameCatalogEntry = {
  /** 記録の `gameId` と同じ値。 */
  id: string;
  name: string;
  pictogramSvg: string;
  entryPath: Path;
  playRecordDisplay: PlayRecordDisplayDefinition;
  replayRecord: (record: PlayRecord) => RecordReplay;
};

export function unavailableRecordReplay(
  reason: RecordReplayUnavailableReason,
): RecordReplayUnavailable {
  return { status: "unavailable", reason };
}

export function renderRecordReplay<Start>(
  replayStart: RecordReplayStart<Start>,
  renderPlay: (start: Start) => ReactElement,
): RecordReplay {
  return replayStart.status === "available"
    ? { status: "available", play: renderPlay(replayStart.start) }
    : replayStart;
}
