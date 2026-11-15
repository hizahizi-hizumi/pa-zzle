import { useMemo } from "react";
import { useLocation } from "react-router";
import type {
  GameCatalogEntry,
  GameNavigation,
  RecordProblemPlayDestination,
} from "@/app/game-integration/game-catalog-entry";
import { toZukanGameSource } from "@/app/game-integration/game-catalog-entry";
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

function cameFromGameHome(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "fromGameHome" in state &&
    state.fromGameHome === true
  );
}

export function createGameNavigation(
  navigate: Navigate,
  game: GameNavigationTarget,
  locationState?: unknown,
): GameNavigation {
  return {
    openGameHome(selectedProblemId, options) {
      if (options?.replacesHistory && cameFromGameHome(locationState)) {
        navigate(-1);
        return;
      }
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
      navigate("/", { replace: true });
    },
    startNewProblem(difficulty, avoidedProblemId, options) {
      function openProblem(problemId: ProblemId) {
        navigate(
          { pathname: game.playPath },
          {
            params: { problemId },
            state: cameFromGameHome(locationState)
              ? { fromGameHome: true }
              : null,
            replace: options?.replacesHistory ?? false,
            flushSync: game.synchronousProblemNavigation ?? false,
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
  const location = useLocation();
  return useMemo(
    () => createGameNavigation(navigate, game, location.state),
    [navigate, game, location.state],
  );
}

export function openRecordProblemPlay(
  navigate: Navigate,
  destination: RecordProblemPlayDestination,
  options?: { fromGameHome: boolean },
): void {
  navigate(destination.playPath, {
    params: { problemId: destination.problemId },
    state: options?.fromGameHome ? { fromGameHome: true } : null,
  });
}
