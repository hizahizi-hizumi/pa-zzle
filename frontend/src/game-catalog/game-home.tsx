import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import { openRecordProblemPlay } from "@/game-catalog/game-navigation";
import { useRequestedProblemId } from "@/game-catalog/problem-id-query";
import type { DifficultyLevel } from "@/games/difficulty";
import {
  readPlayAttemptsSnapshot,
  subscribePlayAttempts,
} from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { useNavigate } from "@/router";
import type { GameHomeScreenProps } from "@/zukan/ui/GameHomeScreen";
import { deriveGameZukan, type ZukanProblem } from "@/zukan/zukan-collection";
import {
  findZukanChanges,
  listUnchangedZukanDifficulties,
  listZukanViewedStatuses,
} from "@/zukan/zukan-last-viewed";
import {
  readZukanLastViewed,
  writeZukanLastViewed,
} from "@/zukan/zukan-last-viewed-storage";

export type GameHome = {
  /** ゲームのホーム `GameHomeScreen` へそのまま渡す、図鑑・選んでおく問題・プレイを始める操作。盤面の見本と遊び方はゲームの View が描く。 */
  screenProps: Omit<
    GameHomeScreenProps,
    "renderLevelPreview" | "renderHowToPlayDialog"
  >;
};

/**
 * 1ゲームのホームを、記録と離脱したプレイから導いた図鑑・前回図鑑を見たときの状態・URL で選んでおく問題・プレイ画面への遷移へつなぐ。
 * 前回の状態は、変化の無いレベルを開いたときに、変化のあるレベルを変化を見せ終えたときに今の状態で保存する。
 */
export function useGameHome(game: GameCatalogEntry): GameHome {
  const [records] = useState(() => readPlayRecords());
  // 開いたときの変化を求めるよう、見たレベルを保存する前に前回の状態を読んでおく。別のゲームのホームへ移ったら読み直す。
  const [lastViewed, setLastViewed] = useState(() => ({
    gameId: game.id,
    statuses: readZukanLastViewed(game.id),
  }));
  if (lastViewed.gameId !== game.id) {
    setLastViewed({ gameId: game.id, statuses: readZukanLastViewed(game.id) });
  }
  // 直前のプレイ画面の離脱は、この画面を描画したあとに保存されるので、保存へ追従する。
  const attempts = useSyncExternalStore(
    subscribePlayAttempts,
    readPlayAttemptsSnapshot,
  );
  const requestedProblemId = useRequestedProblemId();
  const navigate = useNavigate();
  const zukan = useMemo(
    () =>
      deriveGameZukan(
        {
          id: game.id,
          listPoolProblemIds: game.listPoolProblemIds,
          recordProblemPlayTarget: game.recordProblemPlayTarget,
          attemptProblemPlayTarget: game.attemptProblemPlayTarget,
          playRecordDefinition: game.playRecordDisplay.definition,
        },
        records,
        attempts,
      ),
    [game, records, attempts],
  );
  const changes = useMemo(
    () => findZukanChanges(zukan, lastViewed.statuses),
    [zukan, lastViewed],
  );

  // 変化の無いレベルは見せるものが無いので、開いたときに今の状態を保存する。変化のあるレベルは、見せ終えるまで前回の状態を残す。
  useEffect(() => {
    writeZukanLastViewed(
      game.id,
      listZukanViewedStatuses(
        zukan,
        listUnchangedZukanDifficulties(zukan, changes),
      ),
    );
  }, [game.id, zukan, changes]);

  const handleLevelChangesShown = useCallback(
    (difficulty: DifficultyLevel) => {
      writeZukanLastViewed(
        game.id,
        listZukanViewedStatuses(zukan, [difficulty]),
      );
    },
    [game.id, zukan],
  );

  const describeProblem = useCallback(
    ({ difficulty, problemId }: ZukanProblem) =>
      game.describePoolProblem(difficulty, problemId),
    [game],
  );

  const findProblemFeatureValues = useCallback(
    ({ difficulty, problemId }: ZukanProblem) =>
      game.problemFeatureFilter.findPoolProblemValues(difficulty, problemId),
    [game],
  );

  return {
    screenProps: {
      gameTitle: game.name,
      pictogramSvg: game.pictogramSvg,
      zukan,
      changes,
      onLevelChangesShown: handleLevelChangesShown,
      initialSelectedProblemId: requestedProblemId,
      onPlayRandom(difficulty) {
        navigate(game.playPath, { params: { difficulty } });
      },
      onPlayProblem({ difficulty, problemId }) {
        openRecordProblemPlay(navigate, {
          playPath: game.playPath,
          difficulty,
          problemId,
        });
      },
      describeProblem,
      featureAxes: game.problemFeatureFilter.axes,
      findProblemFeatureValues,
    },
  };
}
