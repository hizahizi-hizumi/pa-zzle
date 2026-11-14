import { useMemo } from "react";
import { useLocation } from "react-router";
import {
  findGameCatalogEntry,
  findRecordProblemPlayDestination,
} from "@/app/game-integration/game-catalog";
import {
  createGameNavigation,
  openRecordProblemPlay,
} from "@/app/game-integration/game-navigation";
import { readRecordSaveOutcome } from "@/app/navigation/record-result-location-state";
import { findPlayRecord } from "@/features/records/storage";
import { createResultRecordFeedback } from "@/features/records/ui/result-record-feedback";
import { Link, useNavigate, useParams } from "@/router";

export function PlayResultView() {
  const { game: gameId, recordId } = useParams(
    "/puzzles/:game/result/:recordId",
  );
  const locationState = useLocation().state;
  const recordSaveOutcome = readRecordSaveOutcome(locationState);
  const navigate = useNavigate();
  const record = useMemo(() => findPlayRecord(recordId), [recordId]);
  const game = findGameCatalogEntry(gameId);
  const replayDestination = record && findRecordProblemPlayDestination(record);
  const noticeOutcome = recordSaveOutcome ?? null;

  const resultScreen =
    game && record?.gameId === game.id
      ? game.renderRecordResult(record, {
          recordFeedback: createResultRecordFeedback(
            noticeOutcome,
            game.playRecordDisplay,
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
