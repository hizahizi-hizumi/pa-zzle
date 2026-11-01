import { useMemo } from "react";

import type {
  GameCatalogEntry,
  GameNavigation,
  RecordProblemPlayDestination,
} from "@/game-catalog/game-catalog-entry";
import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import { useNavigate } from "@/router";

type Navigate = ReturnType<typeof useNavigate>;

type GameNavigationTarget = Pick<GameCatalogEntry, "homePath" | "playPath">;

export function createGameNavigation(
  navigate: Navigate,
  game: GameNavigationTarget,
): GameNavigation {
  return {
    openGameHome(selectedProblemId) {
      navigate({
        pathname: game.homePath,
        search:
          selectedProblemId === undefined
            ? ""
            : createProblemIdSearch(selectedProblemId),
      });
    },
    backToHome() {
      navigate("/");
    },
    startNewProblem(difficulty, avoidedProblemId) {
      navigate(game.playPath, {
        params: { difficulty },
        state: createPlayLocationState(avoidedProblemId),
      });
    },
  };
}

export function useGameNavigation(game: GameNavigationTarget): GameNavigation {
  const navigate = useNavigate();
  const { homePath, playPath } = game;
  return useMemo(
    () => createGameNavigation(navigate, { homePath, playPath }),
    [navigate, homePath, playPath],
  );
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
