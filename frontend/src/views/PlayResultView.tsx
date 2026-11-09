import { useMemo } from "react";
import { useLocation } from "react-router";
import { isIssue690LivePreview } from "@/components/Issue690LiveCompare";
import {
  findGameCatalogEntry,
  findRecordProblemPlayDestination,
} from "@/game-catalog/game-catalog";
import {
  createGameNavigation,
  openRecordProblemPlay,
} from "@/game-catalog/game-navigation";
import {
  createIssue690SampleOutcome,
  createIssue690SampleRecord,
  ISSUE_690_SAMPLE_RECORD_ID,
} from "@/game-catalog/issue690-compare-sample";
import { createIssue690RestoredBoardSnapshot } from "@/game-catalog/issue690-restored-board-snapshot";
import {
  readIssue690BoardSnapshot,
  readRecordSaveOutcome,
} from "@/game-catalog/record-result-location-state";
import { findPlayRecord } from "@/records/storage";
import { Issue690RecordSummary } from "@/records/ui/Issue690RecordSummary";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { Link, useNavigate, useParams } from "@/router";

export function PlayResultView() {
  const { game: gameId, recordId } = useParams(
    "/puzzles/:game/result/:recordId",
  );
  const locationState = useLocation().state;
  const recordSaveOutcome = readRecordSaveOutcome(locationState);
  const liveSnapshot = readIssue690BoardSnapshot(locationState);
  const navigate = useNavigate();
  const previewEnabled = isIssue690LivePreview();
  const sampleEnabled =
    previewEnabled && recordId === ISSUE_690_SAMPLE_RECORD_ID;
  const record = useMemo(
    () =>
      sampleEnabled
        ? createIssue690SampleRecord(gameId)
        : findPlayRecord(recordId),
    [sampleEnabled, gameId, recordId],
  );
  const game = findGameCatalogEntry(gameId);
  const restoredBoardSnapshot = useMemo(
    () =>
      previewEnabled && record
        ? createIssue690RestoredBoardSnapshot(record)
        : undefined,
    [previewEnabled, record],
  );
  const replayDestination = record && findRecordProblemPlayDestination(record);
  const noticeOutcome =
    sampleEnabled && game && record
      ? createIssue690SampleOutcome(record, game.playRecordDisplay)
      : (recordSaveOutcome ?? null);

  const resultScreen =
    game && record?.gameId === game.id
      ? game.renderRecordResult(record, {
          issue690BoardSnapshot:
            liveSnapshot?.gameId === game.id
              ? liveSnapshot
              : restoredBoardSnapshot,
          issue690RecordSummary: (
            <Issue690RecordSummary
              outcome={noticeOutcome}
              display={game.playRecordDisplay}
            />
          ),
          recordOutcomeNotice: (
            <>
              <PlayRecordOutcomeNotice
                outcome={noticeOutcome}
                display={game.playRecordDisplay}
              />
            </>
          ),
          onReplay: replayDestination
            ? () => openRecordProblemPlay(navigate, replayDestination)
            : undefined,
          navigation: createGameNavigation(navigate, game),
        })
      : null;

  if (!resultScreen) {
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

  return resultScreen;
}
