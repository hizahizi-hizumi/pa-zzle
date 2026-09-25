import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  parseTakuzuDifficulty,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import { takuzuTechniques } from "@/games/takuzu/problem/generation/human-solver";
import {
  TAKUZU_BOARD_SIZE,
  TAKUZU_GENERATOR_VERSION,
  type TakuzuIdentifiedProblem,
  type TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";
import { restoreTakuzuProblem } from "@/games/takuzu/problem-selection";

export type TakuzuDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "takuzu",
  TakuzuDifficulty,
  TakuzuProblemIdentity
>;

export function createTakuzuDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  buildRevision: string | null;
}): TakuzuDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "takuzu",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    buildRevision,
  };
}

export function parseTakuzuDiagnosticSnapshot(
  serialized: string,
): TakuzuDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Takuzu diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseTakuzuDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "takuzu" ||
    !difficulty ||
    !isProblemIdentity(value.problemIdentity) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid Takuzu diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "takuzu",
    difficulty,
    problemIdentity: value.problemIdentity,
    buildRevision: value.buildRevision,
  };
}

/** 問題集に無い identity（生成器の版が変わった後の古い診断情報など）は復元できないので `null` を返す。 */
export function restoreTakuzuProblemFromDiagnosticSnapshot(
  snapshot: TakuzuDiagnosticSnapshot,
): TakuzuIdentifiedProblem | null {
  return restoreTakuzuProblem(snapshot.problemIdentity);
}

function isProblemIdentity(value: unknown): value is TakuzuProblemIdentity {
  if (!isRecord(value) || !isRecord(value.conditions)) {
    return false;
  }

  const { size, removalTechniqueLimit, extraGivenCount } = value.conditions;

  return (
    value.generatorVersion === TAKUZU_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    size === TAKUZU_BOARD_SIZE &&
    (removalTechniqueLimit === null ||
      takuzuTechniques.some(
        (technique) => technique === removalTechniqueLimit,
      )) &&
    Number.isInteger(extraGivenCount) &&
    Number(extraGivenCount) >= 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
