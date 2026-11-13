import {
  createProblemSeededRandom,
  type ProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";
import {
  createTsumeShogiProblemFingerprint,
  type TsumeShogiProblemFingerprint,
} from "@/games/tsume-shogi/problem/generation/fingerprint";
import {
  formatTsumeShogiBoardSfen,
  generateTsumeShogiRetroSteps,
} from "@/games/tsume-shogi/problem/generation/retro-moves";
import {
  type TsumeShogiValidation,
  validateTsumeShogiProblem,
} from "@/games/tsume-shogi/problem/generation/validator";
import {
  isTsumeShogiBaseKingArea,
  isTsumeShogiBaseMate,
  isTsumeShogiGenerationPlies,
  isTsumeShogiRootCheckRange,
  TSUME_SHOGI_GENERATOR_VERSION,
  type TsumeShogiBaseKingArea,
  type TsumeShogiBaseMate,
  type TsumeShogiGenerationConditions,
  type TsumeShogiIdentifiedProblem,
  type TsumeShogiProblemIdentity,
} from "@/games/tsume-shogi/problem/problem";
import { TsumeShogiMateSearch } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  createTsumeShogiPosition,
  type TsumeShogiHandPieceType,
  type TsumeShogiPiece,
  type TsumeShogiPieceType,
  type TsumeShogiPosition,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiSearchPosition } from "@/games/tsume-shogi/puzzle/search-position";

/** `validation` は採用した問題の strict validator の結果（`verdict` は必ず `accepted`）。 */
export type TsumeShogiGeneratedProblem = TsumeShogiIdentifiedProblem & {
  fingerprint: TsumeShogiProblemFingerprint;
  validation: TsumeShogiValidation;
  mateInOneBaseCount: number;
  validatedCandidateCount: number;
};

/** 試行の上限までに条件を満たす問題を作れなかった。問題集の生成では、その seed を飛ばす。 */
export class TsumeShogiGenerationExhaustedError extends Error {}

const MAXIMUM_MATE_IN_ONE_BASE_COUNT = 12;
/** 逆算の起点の1手詰を探すときの、乱数局面の作り方。 */
type BaseSampling = { maximumHandCount: number; maximumSamples: number };

const anyBaseSampling: BaseSampling = {
  maximumHandCount: 2,
  maximumSamples: 3000,
};

/**
 * 起点の詰め手の種類ごとの作り方。盤上の駒を動かして詰める1手詰は、持駒があると駒打ちの詰みと並んで攻方の正解が
 * 一意でなくなりやすいので持駒を持たせず、成・不成の両方で詰む局面も落ちて当たりにくいので局面を多く作る。
 */
const baseSamplings = {
  "board-move": { maximumHandCount: 0, maximumSamples: 20000 },
} as const satisfies Record<TsumeShogiBaseMate, BaseSampling>;
type InclusiveRange = { minimum: number; maximum: number };

type KingSquareRange = { file: InclusiveRange; rank: InclusiveRange };

const baseKingSquareRanges = {
  edge: { file: { minimum: 1, maximum: 9 }, rank: { minimum: 1, maximum: 3 } },
  middle: {
    file: { minimum: 2, maximum: 8 },
    rank: { minimum: 2, maximum: 5 },
  },
} as const satisfies Record<TsumeShogiBaseKingArea | "edge", KingSquareRange>;

const MAXIMUM_RETRO_STEPS_PER_POSITION = 300;

const attackerBoardTypes: readonly TsumeShogiPieceType[] = [
  "rook",
  "bishop",
  "gold",
  "silver",
  "knight",
  "lance",
  "pawn",
  "dragon",
  "horse",
  "promPawn",
];

const defenderBoardTypes: readonly TsumeShogiPieceType[] = [
  "gold",
  "silver",
  "knight",
  "lance",
  "pawn",
];

function pick<T>(values: readonly T[], random: ProblemRandom): T {
  return values[Math.floor(random() * values.length)]!;
}

function randomInteger(
  minimum: number,
  maximum: number,
  random: ProblemRandom,
): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

/** 詰み上がりの近くの局面を乱数で作る。詰将棋として成り立たない配置なら `null`。 */
function sampleNearMatePosition(
  random: ProblemRandom,
  maximumHandCount: number,
  kingSquares: KingSquareRange,
): TsumeShogiPosition | null {
  const cells: (TsumeShogiPiece | null)[] = new Array(81).fill(null);
  const kingFile = randomInteger(
    kingSquares.file.minimum,
    kingSquares.file.maximum,
    random,
  );
  const kingRank = randomInteger(
    kingSquares.rank.minimum,
    kingSquares.rank.maximum,
    random,
  );
  cells[(kingRank - 1) * 9 + (9 - kingFile)] = {
    side: "defender",
    type: "king",
  };
  function placeNearKing(piece: TsumeShogiPiece): void {
    const file = kingFile + randomInteger(-2, 2, random);
    const rank = kingRank + randomInteger(-2, 2, random);
    if (file < 1 || file > 9 || rank < 1 || rank > 9) {
      return;
    }
    const index = (rank - 1) * 9 + (9 - file);
    if (cells[index] === null) {
      cells[index] = piece;
    }
  }
  const attackerCount = randomInteger(1, 3, random);
  for (let count = 0; count < attackerCount; count += 1) {
    placeNearKing({ side: "attacker", type: pick(attackerBoardTypes, random) });
  }
  const defenderCount = randomInteger(0, 2, random);
  for (let count = 0; count < defenderCount; count += 1) {
    placeNearKing({ side: "defender", type: pick(defenderBoardTypes, random) });
  }
  const hand: Partial<Record<TsumeShogiHandPieceType, number>> = {};
  const handCount = randomInteger(0, maximumHandCount, random);
  for (let count = 0; count < handCount; count += 1) {
    const type = pick(tsumeShogiHandPieceTypes, random);
    hand[type] = (hand[type] ?? 0) + 1;
  }
  try {
    return createTsumeShogiPosition(formatTsumeShogiBoardSfen(cells), hand);
  } catch {
    return null;
  }
}

/** 攻方の手番の局面で、`plies` 手より短く詰まず、`plies` 手で詰み、初手で詰む王手が1つだけか。strict validator の前の安い絞り込み。 */
function hasUniqueFirstMove(
  position: TsumeShogiPosition,
  plies: number,
  search: TsumeShogiMateSearch,
): boolean {
  const state = new TsumeShogiSearchPosition(position);
  if (
    (plies > 1 && search.isMateWithin(state, plies - 2)) ||
    !search.isMateWithin(state, plies)
  ) {
    return false;
  }
  let matingCheckCount = 0;
  for (const check of state.listAttackerChecks()) {
    state.play(check);
    if (search.isMateWithin(state, plies - 1)) {
      matingCheckCount += 1;
    }
    state.undo(check);
    if (matingCheckCount > 1) {
      return false;
    }
  }
  return matingCheckCount === 1;
}

function hasRootChecksWithin(
  position: TsumeShogiPosition,
  { rootChecks }: TsumeShogiGenerationConditions,
): boolean {
  if (rootChecks === undefined) {
    return true;
  }
  const count = new TsumeShogiSearchPosition(position).listAttackerChecks()
    .length;
  return rootChecks.minimum <= count && count <= rootChecks.maximum;
}

class RetroGeneration {
  readonly #shuffle: <T>(values: readonly T[]) => T[];
  readonly #search = new TsumeShogiMateSearch();
  readonly #conditions: TsumeShogiGenerationConditions;
  validatedCandidateCount = 0;

  get baseSampling(): BaseSampling {
    const { baseMate } = this.#conditions;
    return baseMate === undefined ? anyBaseSampling : baseSamplings[baseMate];
  }

  get baseKingSquares(): KingSquareRange {
    return baseKingSquareRanges[this.#conditions.baseKingArea ?? "edge"];
  }

  constructor(
    random: ProblemRandom,
    conditions: TsumeShogiGenerationConditions,
  ) {
    this.#shuffle = function shuffle(values) {
      return shuffleProblemValues(values, random);
    };
    this.#conditions = conditions;
  }

  accepts(position: TsumeShogiPosition, plies: number): boolean {
    // 目標の手数の局面は、strict validator より先に初手の王手の数で安く絞る。
    if (
      plies === this.#conditions.plies &&
      !hasRootChecksWithin(position, this.#conditions)
    ) {
      return false;
    }
    if (!hasUniqueFirstMove(position, plies, this.#search)) {
      return false;
    }
    this.validatedCandidateCount += 1;
    const validation = validateTsumeShogiProblem(position, plies);
    return (
      validation.verdict === "accepted" &&
      (plies !== 1 || this.#acceptsBaseMate(validation))
    );
  }

  #acceptsBaseMate(validation: TsumeShogiValidation): boolean {
    switch (this.#conditions.baseMate) {
      case undefined:
        return true;
      case "board-move":
        return validation.mainLine!.moves[0]!.kind === "board";
    }
  }

  extend(
    position: TsumeShogiPosition,
    plies: number,
    targetPlies: number,
  ): TsumeShogiPosition | null {
    if (plies === targetPlies) {
      return position;
    }
    let examined = 0;
    for (const step of generateTsumeShogiRetroSteps(position, this.#shuffle)) {
      examined += 1;
      if (examined > MAXIMUM_RETRO_STEPS_PER_POSITION) {
        break;
      }
      if (!this.accepts(step.position, plies + 2)) {
        continue;
      }
      const extended = this.extend(step.position, plies + 2, targetPlies);
      if (extended !== null) {
        return extended;
      }
    }
    return null;
  }
}

function validateIdentity(identity: TsumeShogiProblemIdentity): void {
  if (identity.generatorVersion !== TSUME_SHOGI_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Tsume Shogi generator version: ${identity.generatorVersion}`,
    );
  }
  if (!isTsumeShogiGenerationPlies(identity.conditions.plies)) {
    throw new RangeError(
      `Unsupported Tsume Shogi plies: ${identity.conditions.plies}`,
    );
  }
  const { rootChecks } = identity.conditions;
  if (rootChecks !== undefined && !isTsumeShogiRootCheckRange(rootChecks)) {
    throw new RangeError(
      `Unsupported Tsume Shogi root check range: ${JSON.stringify(rootChecks)}`,
    );
  }
  const { baseMate } = identity.conditions;
  if (baseMate !== undefined && !isTsumeShogiBaseMate(baseMate)) {
    throw new RangeError(`Unsupported Tsume Shogi base mate: ${baseMate}`);
  }
  const { baseKingArea } = identity.conditions;
  if (baseKingArea !== undefined && !isTsumeShogiBaseKingArea(baseKingArea)) {
    throw new RangeError(
      `Unsupported Tsume Shogi base king area: ${baseKingArea}`,
    );
  }
}

/**
 * identity の seed から逆算で問題を作る。乱数で作った詰み上がり近くの局面から strict validator が採用する1手詰を探し、
 * 王手と応手を1組ずつさかのぼって、各段で strict validator が採用する局面だけを残す。生成条件に初手の王手の数の範囲が
 * あれば、最後の段ではその範囲の局面だけを採る。起点の詰め手の種類があれば、その種類の手で詰める1手詰だけを起点にし、
 * 起点の玉の範囲があれば、その範囲に玉を置いた局面から起点を探す。
 * 同じ identity からは同じ問題を作る。上限までに作れなければ `TsumeShogiGenerationExhaustedError` を投げる。
 */
export function generateTsumeShogiProblem(
  identity: TsumeShogiProblemIdentity,
): TsumeShogiGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const random = createProblemSeededRandom(`tsume-shogi:${seed}`);
  const generation = new RetroGeneration(random, conditions);

  for (
    let mateInOneBaseCount = 1;
    mateInOneBaseCount <= MAXIMUM_MATE_IN_ONE_BASE_COUNT;
    mateInOneBaseCount += 1
  ) {
    const base = findMateInOneBase(random, generation);
    if (base === null) {
      break;
    }
    const position = generation.extend(base, 1, conditions.plies);
    if (position === null) {
      continue;
    }
    const validation = validateTsumeShogiProblem(position, conditions.plies);
    const problem = {
      initialPosition: position,
      plies: conditions.plies,
      mainLine: validation.mainLine!.moves,
    };
    return {
      problem,
      identity,
      fingerprint: createTsumeShogiProblemFingerprint(problem),
      validation,
      mateInOneBaseCount,
      validatedCandidateCount: generation.validatedCandidateCount,
    };
  }
  throw new TsumeShogiGenerationExhaustedError(
    `Could not generate a ${conditions.plies}-ply Tsume Shogi problem for seed ${seed}`,
  );
}

function findMateInOneBase(
  random: ProblemRandom,
  generation: RetroGeneration,
): TsumeShogiPosition | null {
  const { maximumHandCount, maximumSamples } = generation.baseSampling;
  for (let sample = 0; sample < maximumSamples; sample += 1) {
    const position = sampleNearMatePosition(
      random,
      maximumHandCount,
      generation.baseKingSquares,
    );
    if (position !== null && generation.accepts(position, 1)) {
      return position;
    }
  }
  return null;
}
