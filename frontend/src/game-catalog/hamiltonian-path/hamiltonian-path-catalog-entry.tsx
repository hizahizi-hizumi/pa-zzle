import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedHamiltonianPathResult } from "@/game-catalog/hamiltonian-path/RecordedHamiltonianPathResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/hamiltonian-path/assets/pictogram.svg?raw";
import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import {
  hamiltonianPathPlayRecordDefinition,
  isHamiltonianPathPlayRecord,
  restoreHamiltonianPathRecordedResult,
} from "@/games/hamiltonian-path/play-record";
import {
  findHamiltonianPathPoolProblemFeatures,
  hamiltonianPathProblemFeatureAxes,
  listHamiltonianPathPoolProblemIds,
} from "@/games/hamiltonian-path/problem/problem-pool";
import { canSelectHamiltonianPathProblemById } from "@/games/hamiltonian-path/problem-selection";
import { hamiltonianPathPlayRecordDisplay } from "@/games/hamiltonian-path/ui/play-record-display";
import {
  formatHamiltonianPathProblemFeatures,
  hamiltonianPathProblemFeatureAxisDisplays,
} from "@/games/hamiltonian-path/ui/problem-features";

export const hamiltonianPathCatalogEntry = {
  id: hamiltonianPathPlayRecordDefinition.gameId,
  name: HAMILTONIAN_PATH_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/hamiltonian-path",
  playPath: "/puzzles/hamiltonian-path/play/:difficulty",
  playRecordDisplay: hamiltonianPathPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isHamiltonianPathPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectHamiltonianPathProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectHamiltonianPathProblemById,
    );
  },
  listPoolProblemIds: listHamiltonianPathPoolProblemIds,
  renderRecordResult(record, context) {
    const recorded = restoreHamiltonianPathRecordedResult(record);
    return recorded ? (
      <RecordedHamiltonianPathResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findHamiltonianPathPoolProblemFeatures(
      difficulty,
      problemId,
    );
    return features ? formatHamiltonianPathProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findHamiltonianPathPoolProblemFeatures,
    hamiltonianPathProblemFeatureAxes,
    hamiltonianPathProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
