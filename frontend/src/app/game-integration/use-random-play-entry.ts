import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import type { GameCatalogEntry } from "@/app/game-integration/game-catalog-entry";
import { toZukanGameSource } from "@/app/game-integration/game-catalog-entry";
import {
  createProblemIdSearch,
  hasProblemIdQuery,
} from "@/app/navigation/problem-id-query";
import {
  selectAnyRandomProblemId,
  selectRandomProblemId,
} from "@/features/random-play/random-problem-selection";
import {
  randomProblemSettings,
  randomProblemStatuses,
} from "@/features/random-play/random-problem-settings";
import { randomProblemUnavailable } from "@/features/random-play/random-problem-unavailable";
import type { DifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import { useNavigate } from "@/router";

/** 難易度だけの直接URLでも、出題条件を適用してから問題ID付きのプレイへ進む。 */
export function useRandomPlayEntry(
  game: GameCatalogEntry,
  difficulty: DifficultyLevel | undefined,
  avoidedProblemId?: ProblemId,
): "ready" | "redirecting" | "unavailable" {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useSyncExternalStore(
    randomProblemSettings.subscribe,
    randomProblemSettings.getSnapshot,
    randomProblemSettings.getSnapshot,
  );
  const selectedStatuses = settings.overrides[game.id] ?? settings.global;
  const requiresSelection =
    difficulty !== undefined &&
    !hasProblemIdQuery(location.search) &&
    selectedStatuses.length !== randomProblemStatuses.length;
  const selectedProblemId = useMemo(
    () =>
      difficulty !== undefined &&
      !hasProblemIdQuery(location.search) &&
      selectedStatuses.length !== randomProblemStatuses.length
        ? selectRandomProblemId(
            toZukanGameSource(game),
            difficulty,
            avoidedProblemId,
          )
        : null,
    [difficulty, game, avoidedProblemId, location.search, selectedStatuses],
  );

  useEffect(() => {
    if (!requiresSelection || difficulty === undefined) return;
    if (selectedProblemId === null) {
      const anyProblemId = selectAnyRandomProblemId(
        toZukanGameSource(game),
        difficulty,
        avoidedProblemId,
      );
      randomProblemUnavailable.show(
        game.id,
        game.name,
        anyProblemId === null
          ? undefined
          : () =>
              navigate(
                {
                  pathname: game.playPath,
                  search: createProblemIdSearch(anyProblemId),
                },
                {
                  params: { difficulty },
                  state: location.state,
                  replace: true,
                },
              ),
      );
      return;
    }
    randomProblemUnavailable.dismiss();
    navigate(
      {
        pathname: game.playPath,
        search: createProblemIdSearch(selectedProblemId),
      },
      { params: { difficulty }, state: location.state, replace: true },
    );
  }, [
    requiresSelection,
    difficulty,
    selectedProblemId,
    game,
    navigate,
    location.state,
    avoidedProblemId,
  ]);

  if (!requiresSelection) return "ready";
  return selectedProblemId === null ? "unavailable" : "redirecting";
}
