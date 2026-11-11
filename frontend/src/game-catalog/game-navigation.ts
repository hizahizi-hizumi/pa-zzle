import { useMemo } from "react";
import { leavePlayBoard } from "@/components/play-board-return";
import type {
  GameCatalogEntry,
  GameNavigation,
  GamePlayPath,
} from "@/game-catalog/game-catalog-entry";
import { createRandomPlayLocationState } from "@/game-catalog/play-location-state";
import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import {
  selectAnyRandomProblemId,
  selectRandomProblemId,
} from "@/game-catalog/random-problem-selection";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
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
      leavePlayBoard();
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
    startNewProblem(difficulty, avoidedProblemId, options) {
      function openProblem(problemId: ProblemId) {
        navigate(
          { pathname: game.playPath, search: createProblemIdSearch(problemId) },
          {
            params: { difficulty },
            state: createRandomPlayLocationState(),
            replace: options?.replacesHistory ?? false,
          },
        );
      }
      const level = parseDifficultyLevel(difficulty);
      const problemId =
        level && selectRandomProblemId(game, level, avoidedProblemId);
      if (!problemId) {
        const anyProblemId =
          level && selectAnyRandomProblemId(game, level, avoidedProblemId);
        randomProblemUnavailable.show(
          game.id,
          game.name,
          anyProblemId ? () => openProblem(anyProblemId) : undefined,
        );
        return;
      }
      openProblem(problemId);
    },
  };
}

export function useGameNavigation(game: GameNavigationTarget): GameNavigation {
  const navigate = useNavigate();
  return useMemo(() => createGameNavigation(navigate, game), [navigate, game]);
}

/** 問題集で引ける1問を始めるプレイ画面の、パス・難易度・問題 ID。 */
export type ProblemPlayDestination = {
  playPath: GamePlayPath;
  difficulty: string;
  problemId: ProblemId;
};

/**
 * 問題集で引ける1問を、その問題 ID を URL に載せたプレイ画面で開く。
 * 完了記録や離脱した試行の問題を遊び直すときと、ゲームのホームで始める問題を開くときに使う。
 */
export function openProblemPlay(
  navigate: Navigate,
  destination: ProblemPlayDestination,
): void {
  navigate(
    {
      pathname: destination.playPath,
      search: createProblemIdSearch(destination.problemId),
    },
    { params: { difficulty: destination.difficulty } },
  );
}
