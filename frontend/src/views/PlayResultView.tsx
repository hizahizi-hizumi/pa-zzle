import { useMemo } from "react";
import { useLocation } from "react-router";

import {
  findGameCatalogEntry,
  findRecordProblemPlayDestination,
} from "@/game-catalog/game-catalog";
import {
  createGameNavigation,
  openRecordProblemPlay,
} from "@/game-catalog/game-navigation";
import { readRecordSaveOutcome } from "@/game-catalog/record-result-location-state";
import { findPlayRecord } from "@/records/storage";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { Link, useNavigate, useParams } from "@/router";

export function PlayResultView() {
  const { game: gameId, recordId } = useParams(
    "/puzzles/:game/result/:recordId",
  );
  const recordSaveOutcome = readRecordSaveOutcome(useLocation().state);
  const navigate = useNavigate();
  const record = useMemo(() => findPlayRecord(recordId), [recordId]);
  const game = findGameCatalogEntry(gameId);
  const replayDestination = record && findRecordProblemPlayDestination(record);

  const resultScreen =
    game && record?.gameId === game.id
      ? game.renderRecordResult(record, {
          recordOutcomeNotice: (
            <PlayRecordOutcomeNotice
              outcome={recordSaveOutcome ?? null}
              display={game.playRecordDisplay}
            />
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
