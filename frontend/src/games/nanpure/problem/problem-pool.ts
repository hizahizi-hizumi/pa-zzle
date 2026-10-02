import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import {
  assertNanpureProblem,
  createNanpureProblemIdentity,
  type NANPURE_GENERATOR_VERSION,
  type NanpureIdentifiedProblem,
  type NanpureProblem,
  type NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import problemPoolJson from "@/games/nanpure/problem/problem-pool.json";
import type { NanpureTechnique } from "@/games/nanpure/problem/technique";
import {
  isNanpureDigit,
  NANPURE_CELL_COUNT,
  type NanpureCell,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import { createProblemPoolIdLookup } from "@/games/problem-id";

/**
 * 事前生成した問題集の1問。
 * - 生成条件（手筋の上限。`null` は一意解だけを保つ条件）と候補番号から `createNanpureProblemIdentity` で identity を再構成する。
 * - `encodedProblem` は解の81桁とヒントの位置の16進21桁を並べた102文字（`encodeNanpurePoolProblem`）。
 *   実行時に生成器・解探索を呼ばずに問題を復元するため、生成結果そのものを持つ。
 */
export type NanpureProblemPoolEntry = readonly [
  removalTechniqueLimit: NanpureTechnique | null,
  candidateIndex: number,
  encodedProblem: string,
];

export type NanpureProblemPool = {
  generatorVersion: typeof NANPURE_GENERATOR_VERSION;
  levels: Record<NanpureDifficulty, readonly NanpureProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as NanpureProblemPool;

const cellsPerHexDigit = 4;
const maskHexDigitCount = Math.ceil(NANPURE_CELL_COUNT / cellsPerHexDigit);
const encodedLength = NANPURE_CELL_COUNT + maskHexDigitCount;

/** 行優先の81マスを4マスずつ16進1桁へ詰める。先頭のマスを最上位ビットにし、最後の桁の余りは 0 で埋める。 */
function encodeMask(bits: readonly boolean[]): string {
  let encoded = "";
  for (let start = 0; start < bits.length; start += cellsPerHexDigit) {
    let digit = 0;
    for (let offset = 0; offset < cellsPerHexDigit; offset += 1) {
      digit = (digit << 1) | (bits[start + offset] ? 1 : 0);
    }
    encoded += digit.toString(16);
  }
  return encoded;
}

function decodeMask(encoded: string): boolean[] {
  if (!/^[0-9a-f]+$/.test(encoded)) {
    throw new RangeError("Nanpure pool clue mask must be lowercase hex");
  }
  return Array.from(encoded)
    .flatMap((character) => {
      const digit = Number.parseInt(character, 16);
      return Array.from(
        { length: cellsPerHexDigit },
        (_, offset) => ((digit >> (cellsPerHexDigit - 1 - offset)) & 1) === 1,
      );
    })
    .slice(0, NANPURE_CELL_COUNT);
}

/** 解の81桁（数字 1〜9）と、ヒントのマスを 1 とした位置の16進21桁を並べる。 */
export function encodeNanpurePoolProblem({
  clues,
  solution,
}: NanpureProblem): string {
  return solution.join("") + encodeMask(clues.map((cell) => cell !== null));
}

export function decodeNanpurePoolProblem(encoded: string): NanpureProblem {
  if (encoded.length !== encodedLength) {
    throw new RangeError(
      `Nanpure pool problem must have ${encodedLength} characters`,
    );
  }
  const solution = Array.from(
    encoded.slice(0, NANPURE_CELL_COUNT),
    (character): NanpureDigit => {
      const digit = Number(character);
      if (!isNanpureDigit(digit)) {
        throw new RangeError("Nanpure pool solution must be digits 1 to 9");
      }
      return digit;
    },
  );
  const clueMask = decodeMask(encoded.slice(NANPURE_CELL_COUNT));
  const problem: NanpureProblem = {
    clues: solution.map(
      (digit, cellIndex): NanpureCell => (clueMask[cellIndex] ? digit : null),
    ),
    solution,
  };
  assertNanpureProblem(problem);
  return problem;
}

export function toNanpurePoolIdentity([
  removalTechniqueLimit,
  candidateIndex,
]: NanpureProblemPoolEntry): NanpureProblemIdentity {
  return createNanpureProblemIdentity(removalTechniqueLimit, candidateIndex);
}

export function toNanpurePooledProblem(
  entry: NanpureProblemPoolEntry,
): NanpureIdentifiedProblem {
  return {
    problem: decodeNanpurePoolProblem(entry[2]),
    identity: toNanpurePoolIdentity(entry),
  };
}

export function listNanpurePoolEntries(
  difficulty: NanpureDifficulty,
): readonly NanpureProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const findPoolPositionByProblemId = createProblemPoolIdLookup(
  problemPool.levels,
  toNanpurePoolIdentity,
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findNanpurePoolEntryByProblemId(
  difficulty: NanpureDifficulty,
  problemId: string,
): NanpureProblemPoolEntry | null {
  return findPoolPositionByProblemId(difficulty, problemId)?.entry ?? null;
}

let entriesBySeed: ReadonlyMap<string, NanpureProblemPoolEntry> | undefined;

function getEntriesBySeed(): ReadonlyMap<string, NanpureProblemPoolEntry> {
  entriesBySeed ??= new Map(
    Object.values(problemPool.levels)
      .flat()
      .map((entry) => [toNanpurePoolIdentity(entry).seed, entry]),
  );
  return entriesBySeed;
}

/** identity に一致する問題集の1問を探す。生成器の版や条件が違う identity には `null` を返す。 */
export function findNanpurePoolEntry(
  identity: NanpureProblemIdentity,
): NanpureProblemPoolEntry | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  const entry = getEntriesBySeed().get(identity.seed);
  if (!entry) {
    return null;
  }
  const { conditions } = toNanpurePoolIdentity(entry);
  return conditions.removalTechniqueLimit ===
    identity.conditions.removalTechniqueLimit
    ? entry
    : null;
}
