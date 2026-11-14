import { useMemo } from "react";
import type {
  GameCatalogEntry,
  GameNavigation,
  RecordProblemPlayDestination,
} from "@/app/game-integration/game-catalog-entry";
import { toZukanGameSource } from "@/app/game-integration/game-catalog-entry";
import { createRandomPlayLocationState } from "@/app/navigation/play-location-state";
import { createProblemIdSearch } from "@/app/navigation/problem-id-query";
import {
  selectAnyRandomProblemId,
  selectRandomProblemId,
} from "@/features/random-play/random-problem-selection";
import { randomProblemUnavailable } from "@/features/random-play/random-problem-unavailable";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
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
    backToAppHome() {
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
        level &&
        selectRandomProblemId(toZukanGameSource(game), level, avoidedProblemId);
      if (!problemId) {
        const anyProblemId =
          level &&
          selectAnyRandomProblemId(
            toZukanGameSource(game),
            level,
            avoidedProblemId,
          );
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
