import { useMemo } from "react";

import type {
  GameCatalogEntry,
  GameNavigation,
  RecordProblemPlayDestination,
} from "@/game-catalog/game-catalog-entry";
import { createRandomPlayLocationState } from "@/game-catalog/play-location-state";
import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import { selectRandomProblemId } from "@/game-catalog/random-problem-selection";
import { parseDifficultyLevel } from "@/games/difficulty";
import { randomProblemUnavailable } from "@/lib/random-problem-unavailable";
import { useNavigate } from "@/router";

type Navigate = ReturnType<typeof useNavigate>;

type GameNavigationTarget = GameCatalogEntry;

export function createGameNavigation(
  navigate: Navigate,
  game: GameNavigationTarget,
): GameNavigation {
  return {
    openGameHome(selectedProblemId, options) {
      navigate(
        {
          pathname: game.homePath,
          search:
            selectedProblemId === undefined
              ? ""
              : createProblemIdSearch(selectedProblemId),
        },
        // ゲームのホームは台紙のマスを一度に多く描くので、分けて描かずに一度に描き、開くまでの時間を縮める。
        { replace: options?.replacesHistory ?? false, flushSync: true },
      );
    },
    backToHome() {
      navigate("/");
    },
    startNewProblem(difficulty, avoidedProblemId) {
      const level = parseDifficultyLevel(difficulty);
      const problemId =
        level && selectRandomProblemId(game, level, avoidedProblemId);
      if (!problemId) {
        randomProblemUnavailable.show(game.id, game.name);
        return;
      }
      navigate(
        { pathname: game.playPath, search: createProblemIdSearch(problemId) },
        {
          params: { difficulty },
          state: createRandomPlayLocationState(),
          replace: true,
        },
      );
    },
  };
}

export function useGameNavigation(game: GameNavigationTarget): GameNavigation {
  const navigate = useNavigate();
  return useMemo(() => createGameNavigation(navigate, game), [navigate, game]);
}

/** 完了記録や離脱した試行の問題を、その問題 ID を URL に載せたプレイ画面で開く。 */
export function openRecordProblemPlay(
  navigate: Navigate,
  destination: RecordProblemPlayDestination,
): void {
  navigate(
    {
      pathname: destination.playPath,
      search: createProblemIdSearch(destination.problemId),
    },
    { params: { difficulty: destination.difficulty } },
  );
}
