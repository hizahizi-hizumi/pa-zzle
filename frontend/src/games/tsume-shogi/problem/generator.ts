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
  isTsumeShogiBaseMate,
  isTsumeShogiGenerationPlies,
  isTsumeShogiRootCheckRange,
  TSUME_SHOGI_GENERATOR_VERSION,
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

/**
 * - `fingerprint`: 問題集の重複を見分ける指紋。
 * - `validation`: 採用した問題の strict validator の結果（`verdict` は必ず `accepted`）。
 * - `baseCount`: 逆算の起点にした1手詰の数。
 * - `validatedCandidateCount`: 採用までに strict validator にかけた候補の数。
 */
export type TsumeShogiGeneratedProblem = TsumeShogiIdentifiedProblem & {
  fingerprint: TsumeShogiProblemFingerprint;
  validation: TsumeShogiValidation;
  baseCount: number;
  validatedCandidateCount: number;
};

/** 試行の上限までに条件を満たす問題を作れなかった。問題集の生成では、その seed を飛ばす。 */
export class TsumeShogiGenerationExhaustedError extends Error {}

/** 逆算の起点にする1手詰の数の上限。 */
const MAXIMUM_BASE_COUNT = 12;
/**
 * 逆算の起点の1手詰を探すときの、乱数局面の作り方。
 * - `maximumHandCount`: 攻方に持たせる持駒の枚数の上限。
 * - `maximumSamples`: 1つの起点を探すときに作る局面の数の上限。
 */
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
/** 1つの局面から1段さかのぼるときに調べる候補の数の上限。 */
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

/**
 * 詰み上がりの近くの局面を乱数で作る。玉を1〜3段目に置き、攻方の駒1〜3枚・玉方の駒0〜2枚を玉の周り（筋・段とも2以内）に、
 * 攻方の持駒を0〜`maximumHandCount`枚持たせる。詰将棋として成り立たない配置なら `null`。
 */
function sampleNearMatePosition(
  random: ProblemRandom,
  maximumHandCount: number,
): TsumeShogiPosition | null {
  const cells: (TsumeShogiPiece | null)[] = new Array(81).fill(null);
  const kingFile = randomInteger(1, 9, random);
  const kingRank = randomInteger(1, 3, random);
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

/** 生成条件の初手の王手の数の範囲に入るか。範囲が無ければ絞らない。 */
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

  constructor(
    random: ProblemRandom,
    conditions: TsumeShogiGenerationConditions,
  ) {
    this.#shuffle = function shuffle(values) {
      return shuffleProblemValues(values, random);
    };
    this.#conditions = conditions;
  }

  /**
   * `plies` 手で採用できる局面か。目標の手数の局面は、strict validator より先に初手の王手の数で安く絞る。
   */
  accepts(position: TsumeShogiPosition, plies: number): boolean {
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

  /** 起点の1手詰の詰め手が、生成条件の起点の種類に合うか。 */
  #acceptsBaseMate(validation: TsumeShogiValidation): boolean {
    switch (this.#conditions.baseMate) {
      case undefined:
        return true;
      case "board-move":
        return validation.mainLine!.moves[0]!.kind === "board";
    }
  }

  /** `plies` 手の問題 `position` から逆算で `targetPlies` 手の問題を作る。作れなければ `null`。 */
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
}

/**
 * identity の seed から逆算で問題を作る。乱数で作った詰み上がり近くの局面から strict validator が採用する1手詰を探し、
 * 王手と応手を1組ずつさかのぼって、各段で strict validator が採用する局面だけを残す。生成条件に初手の王手の数の範囲が
 * あれば、最後の段ではその範囲の局面だけを採る。起点の詰め手の種類があれば、その種類の手で詰める1手詰だけを起点にする。
 * 同じ identity からは同じ問題を作る。上限までに作れなければ `TsumeShogiGenerationExhaustedError` を投げる。
 */
export function generateTsumeShogiProblem(
  identity: TsumeShogiProblemIdentity,
): TsumeShogiGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const random = createProblemSeededRandom(`tsume-shogi:${seed}`);
  const generation = new RetroGeneration(random, conditions);

  for (let baseCount = 1; baseCount <= MAXIMUM_BASE_COUNT; baseCount += 1) {
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
      baseCount,
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
    const position = sampleNearMatePosition(random, maximumHandCount);
    if (position !== null && generation.accepts(position, 1)) {
      return position;
    }
  }
  return null;
}
