import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { GameHomeScreenProps } from "@/app/game-home/GameHomeScreen";
import {
  type GameCatalogEntry,
  toZukanGameSource,
} from "@/app/game-integration/game-catalog-entry";
import { openRecordProblemPlay } from "@/app/game-integration/game-navigation";
import { useRequestedProblemId } from "@/app/navigation/problem-id-query";
import {
  selectAnyRandomProblemId,
  selectRandomProblemId,
} from "@/features/random-play/random-problem-selection";
import { randomProblemUnavailable } from "@/features/random-play/random-problem-unavailable";
import {
  readPlayAttemptsSnapshot,
  subscribePlayAttempts,
} from "@/features/records/play-attempt-storage";
import { readPlayRecords } from "@/features/records/storage";
import {
  deriveGameZukan,
  type ZukanProblem,
} from "@/features/zukan/zukan-collection";
import {
  findZukanChanges,
  listUnchangedZukanDifficulties,
  listZukanViewedStatuses,
} from "@/features/zukan/zukan-last-viewed";
import {
  readZukanLastViewed,
  writeZukanLastViewed,
} from "@/features/zukan/zukan-last-viewed-storage";
import type { DifficultyLevel } from "@/games/difficulty";
import { useNavigate } from "@/router";

export type GameHome = {
  /** 遊び方とチュートリアルはゲームの View が描く。 */
  screenProps: Omit<
    GameHomeScreenProps,
    "ground" | "renderHowToPlayDialog" | "renderTutorial"
  >;
};

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
    () => deriveGameZukan(toZukanGameSource(game), records, attempts),
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
      gameId: game.id,
      gameTitle: game.name,
      pictogramSvg: game.pictogramSvg,
      pictogramShowcaseSvg: game.pictogramShowcaseSvg,
      zukan,
      changes,
      onLevelChangesShown: handleLevelChangesShown,
      initialSelectedProblemId: requestedProblemId,
      pickRandomProblemId(difficulty) {
        const problemId = selectRandomProblemId(
          toZukanGameSource(game),
          difficulty,
        );
        if (problemId === null) {
          const anyProblemId = selectAnyRandomProblemId(
            toZukanGameSource(game),
            difficulty,
          );
          randomProblemUnavailable.show(
            game.id,
            game.name,
            anyProblemId === null
              ? undefined
              : () =>
                  openRecordProblemPlay(navigate, {
                    playPath: game.playPath,
                    difficulty,
                    problemId: anyProblemId,
                  }),
          );
        }
        return problemId;
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
      records,
      playRecordDisplay: game.playRecordDisplay,
    },
  };
}
