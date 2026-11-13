import { useMemo } from "react";
import { useLocation } from "react-router";
import { ResultEmblemContext } from "@/components/GameResultScreen/result-emblem";
import {
  findGameCatalogEntry,
  findRecordProblemPlayDestination,
} from "@/game-catalog/game-catalog";
import {
  createGameNavigation,
  openRecordProblemPlay,
} from "@/game-catalog/game-navigation";
import { readRecordSaveOutcome } from "@/game-catalog/record-result-location-state";
import { parseDifficultyLevel } from "@/games/difficulty";
import { findPlayRecord } from "@/records/storage";
import { createResultRecordFeedback } from "@/records/ui/result-record-feedback";
import { Link, useNavigate, useParams } from "@/router";
import { ZukanResultPiece } from "@/zukan/ui/ZukanResultPiece";

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
  const sheetPlace = useMemo(() => {
    const target = game && record ? game.recordProblemPlayTarget(record) : null;
    const difficulty = parseDifficultyLevel(target?.difficulty);
    if (!game || !target || difficulty === undefined) return null;
    const index = game.listPoolProblemIds(difficulty).indexOf(target.problemId);
    return index === -1 ? null : { difficulty, index };
  }, [game, record]);

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

  return (
    <ResultEmblemContext
      value={
        game && (
          <ZukanResultPiece
            pictogramSvg={game.pictogramSvg}
            sheetPlace={sheetPlace}
          />
        )
      }
    >
      {resultScreen}
    </ResultEmblemContext>
  );
}
