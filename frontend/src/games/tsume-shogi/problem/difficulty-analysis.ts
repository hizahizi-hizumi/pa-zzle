import {
  type TsumeShogiQualityIssue,
  validateTsumeShogiProblem,
} from "@/games/tsume-shogi/problem/generation/validator";
import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import { TsumeShogiMateSearch } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  formatTsumeShogiMoveUsi,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";
import {
  isTsumeShogiInterposition,
  type TsumeShogiSearchMove,
  TsumeShogiSearchPosition,
  toTsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/search-position";

/**
 * 人間が詰将棋を解くときの挑戦を、作意の各判断地点の特徴として観測する。用語と数え方は SPEC-021 の「難易度」。
 * 名前とコメントの plausibleWrong（もっともらしい誤王手）は仕様の効いていそうな誤王手、deepDecoy（深い紛れ）は数手先まで続く紛れ。
 * `remainingPlies` は判断地点の残りの手数（この攻方の手を含む）。
 */

export type TsumeShogiDecisionFeatures = {
  remainingPlies: number;
  checkCount: number;
  plausibleWrongCount: number;
  deepDecoyCount: number;
};

/** 作意の攻方の手に現れた手筋の数。1手が複数の手筋を持てば、それぞれに数える。 */
export type TsumeShogiMotifCounts = {
  drop: number;
  promotion: number;
  nonPromotion: number;
  capture: number;
  sacrifice: number;
  discoveredCheck: number;
  distantCheck: number;
};

export const tsumeShogiTesujiKinds = [
  "promotion",
  "nonPromotion",
  "capture",
  "sacrifice",
  "discoveredCheck",
  "distantCheck",
] as const satisfies readonly (keyof TsumeShogiMotifCounts)[];

/**
 * 難易度の特徴。`rootChecks` は初手の王手の数、`defenseBranching` は変化の幅、`tesujiKindCount` は作意の手筋の種類。
 * `decisions` は判断地点ごとの特徴で、作意の順。
 */
export type TsumeShogiDifficultyFeatures = {
  rootChecks: number;
  plausibleWrong: number;
  deepDecoyCount: number;
  defenseBranching: number;
  tesujiKindCount: number;
  decisions: TsumeShogiDecisionFeatures[];
  motifs: TsumeShogiMotifCounts;
};

const DEEP_DECOY_LENGTH = 4;

/** 深い紛れが起きうる判断地点の残りの手数の下限。誤王手・逃れ・脅しのある王手・逃れの4手に、詰みを確かめる1手が残る。 */
export const TSUME_SHOGI_DEEP_DECOY_MINIMUM_REMAINING_PLIES =
  DEEP_DECOY_LENGTH + 1;

/** 紛れの長さを数える探索は手数とともに重くなり、V1 の問題は5手までなので、それより長い問題は評価しない。 */
export const TSUME_SHOGI_ANALYSIS_MAXIMUM_PLIES = 5;

/**
 * - `analyzed`: strict validator が採用する問題で、特徴を求めた。
 * - `unsupported`: 問題としては成り立ちうるが、評価できない（`supported-subset`: strict validator の supported subset の外、
 *   `beyond-analysis-horizon`: 分析できる手数を超える）。
 * - `invalid`: 指定の手数の完全作として成り立たない、または問題の作意が strict validator の作意と違う。
 */
export type TsumeShogiDifficultyAnalysis =
  | {
      status: "analyzed";
      plies: number;
      features: TsumeShogiDifficultyFeatures;
    }
  | {
      status: "unsupported";
      reason: "supported-subset" | "beyond-analysis-horizon";
      plies: number;
      issues: TsumeShogiQualityIssue[];
    }
  | {
      status: "invalid";
      reason: "quality" | "main-line-mismatch";
      plies: number;
      issues: TsumeShogiQualityIssue[];
    };

function isMatedAfterCheckWithin(
  state: TsumeShogiSearchPosition,
  plies: number,
  search: TsumeShogiMateSearch,
): boolean {
  return plies >= 0 && search.isMateWithin(state, plies);
}

class DecoyReader {
  readonly #state: TsumeShogiSearchPosition;
  readonly #search: TsumeShogiMateSearch;

  constructor(state: TsumeShogiSearchPosition, search: TsumeShogiMateSearch) {
    this.#state = state;
    this.#search = search;
  }

  /** 王手の後（玉方の手番、残り `plies` 手は玉方の手を含む）、自然な応手の少なくとも1つが残りの手数以内に詰むか。 */
  threatens(plies: number): boolean {
    const state = this.#state;
    for (const response of state.listDefenderResponses()) {
      if (isTsumeShogiInterposition(response)) {
        continue;
      }
      state.play(response);
      const mated = isMatedAfterCheckWithin(state, plies - 1, this.#search);
      state.undo(response);
      if (mated) {
        return true;
      }
    }
    return false;
  }

  /**
   * 誤王手の後（玉方の手番、残り `plies` 手）、玉方が最も早く崩れを見せる逃れを選んだときに、脅しのある王手で続けられる
   * 手数（玉方の手を含む）。
   */
  defenderLength(plies: number): number {
    if (plies <= 0) {
      return 0;
    }
    const state = this.#state;
    let shortest = Number.POSITIVE_INFINITY;
    for (const response of state.listDefenderResponses()) {
      state.play(response);
      const length = isMatedAfterCheckWithin(state, plies - 1, this.#search)
        ? Number.POSITIVE_INFINITY
        : 1 + this.attackerLength(plies - 1);
      state.undo(response);
      shortest = Math.min(shortest, length);
      if (shortest === 1) {
        break;
      }
    }
    return shortest;
  }

  /** 逃れの後（攻方の手番、残り `plies` 手）、脅しのある王手で最も長く続けられる手数。 */
  attackerLength(plies: number): number {
    if (plies <= 0) {
      return 0;
    }
    const state = this.#state;
    let longest = 0;
    for (const check of state.listAttackerChecks()) {
      state.play(check);
      const length = this.threatens(plies - 1)
        ? 1 + this.defenderLength(plies - 1)
        : 0;
      state.undo(check);
      longest = Math.max(longest, length);
      if (longest >= plies) {
        break;
      }
    }
    return longest;
  }
}

function readDecision(
  state: TsumeShogiSearchPosition,
  remainingPlies: number,
  mainMove: TsumeShogiMove,
  search: TsumeShogiMateSearch,
): TsumeShogiDecisionFeatures {
  const reader = new DecoyReader(state, search);
  const mainUsi = formatTsumeShogiMoveUsi(mainMove);
  const checks = state.listAttackerChecks();
  let plausibleWrongCount = 0;
  let deepDecoyCount = 0;
  for (const check of checks) {
    if (formatTsumeShogiMoveUsi(toTsumeShogiMove(check)) === mainUsi) {
      continue;
    }
    state.play(check);
    const isWrong = !isMatedAfterCheckWithin(state, remainingPlies - 1, search);
    const isDeep =
      isWrong &&
      1 + reader.defenderLength(remainingPlies - 1) >= DEEP_DECOY_LENGTH;
    const isPlausible =
      isWrong && (isDeep || reader.threatens(remainingPlies - 1));
    state.undo(check);
    deepDecoyCount += isDeep ? 1 : 0;
    plausibleWrongCount += isPlausible ? 1 : 0;
  }
  return {
    remainingPlies,
    checkCount: checks.length,
    plausibleWrongCount,
    deepDecoyCount,
  };
}

function isSameSquare(left: TsumeShogiSquare, right: TsumeShogiSquare) {
  return left.file === right.file && left.rank === right.rank;
}

function isDistantLine(from: TsumeShogiSquare, to: TsumeShogiSquare): boolean {
  const fileDistance = Math.abs(from.file - to.file);
  const rankDistance = Math.abs(from.rank - to.rank);
  return (
    Math.max(fileDistance, rankDistance) >= 2 &&
    (fileDistance === 0 || rankDistance === 0 || fileDistance === rankDistance)
  );
}

function emptyMotifCounts(): TsumeShogiMotifCounts {
  return {
    drop: 0,
    promotion: 0,
    nonPromotion: 0,
    capture: 0,
    sacrifice: 0,
    discoveredCheck: 0,
    distantCheck: 0,
  };
}

/** 攻方の手 `move`（指す前の局面 `state`）の手筋を `counts` に足す。`nextMove` は作意の次の玉方の手。 */
function addAttackerMotifs(
  counts: TsumeShogiMotifCounts,
  state: TsumeShogiSearchPosition,
  searchMove: TsumeShogiSearchMove,
  nextMove: TsumeShogiMove | undefined,
): void {
  const move = toTsumeShogiMove(searchMove);
  if (move.kind === "drop") {
    counts.drop += 1;
  } else if (move.promote) {
    counts.promotion += 1;
  } else if (state.findMove({ ...move, promote: true }) !== null) {
    counts.nonPromotion += 1;
  }
  if (state.isOccupied(move.to)) {
    counts.capture += 1;
  }
  if (nextMove !== undefined && isSameSquare(nextMove.to, move.to)) {
    counts.sacrifice += 1;
  }
  state.play(searchMove);
  const king = state.defenderKingSquare;
  const checkers = state.listCheckingSquares();
  state.undo(searchMove);
  if (checkers.some((square) => !isSameSquare(square, move.to))) {
    counts.discoveredCheck += 1;
  }
  if (checkers.some((square) => isDistantLine(square, king))) {
    counts.distantCheck += 1;
  }
}

function countNaturalResponses(state: TsumeShogiSearchPosition): number {
  return state
    .listDefenderResponses()
    .filter((response) => !isTsumeShogiInterposition(response)).length;
}

function measureFeatures(
  problem: TsumeShogiProblem,
  search: TsumeShogiMateSearch,
): TsumeShogiDifficultyFeatures {
  const state = new TsumeShogiSearchPosition(problem.initialPosition);
  const decisions: TsumeShogiDecisionFeatures[] = [];
  const motifs = emptyMotifCounts();
  let defenseBranching = 0;
  for (const [index, move] of problem.mainLine.entries()) {
    const searchMove = state.findMove(move);
    if (searchMove === null) {
      throw new RangeError(`作意の ${index + 1} 手目が合法手ではありません`);
    }
    if (index % 2 === 0) {
      decisions.push(readDecision(state, problem.plies - index, move, search));
      addAttackerMotifs(motifs, state, searchMove, problem.mainLine[index + 1]);
    } else {
      defenseBranching += Math.max(0, countNaturalResponses(state) - 1);
    }
    state.play(searchMove);
  }
  return {
    rootChecks: decisions[0]!.checkCount,
    plausibleWrong: decisions.reduce(
      (sum, decision) => sum + decision.plausibleWrongCount,
      0,
    ),
    deepDecoyCount: decisions.reduce(
      (sum, decision) => sum + decision.deepDecoyCount,
      0,
    ),
    defenseBranching,
    tesujiKindCount: tsumeShogiTesujiKinds.filter((kind) => motifs[kind] > 0)
      .length,
    decisions,
    motifs,
  };
}

function isSameMainLine(
  left: readonly TsumeShogiMove[],
  right: readonly TsumeShogiMove[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (move, index) =>
        formatTsumeShogiMoveUsi(move) ===
        formatTsumeShogiMoveUsi(right[index]!),
    )
  );
}

/**
 * 問題を strict validator で確かめたうえで、作意の判断地点ごとの誤王手の紛れと、作意の手筋・玉方の応手の幅を特徴へまとめる。
 * 同じ問題からは同じ特徴を返す（王手・応手は決まった順に列挙し、作意は strict validator の作意と一致することを確かめる）。
 */
export function analyzeTsumeShogiDifficulty(
  problem: TsumeShogiProblem,
): TsumeShogiDifficultyAnalysis {
  const { plies } = problem;
  if (plies > TSUME_SHOGI_ANALYSIS_MAXIMUM_PLIES) {
    return {
      status: "unsupported",
      reason: "beyond-analysis-horizon",
      plies,
      issues: [],
    };
  }
  const validation = validateTsumeShogiProblem(problem.initialPosition, plies);
  const { issues } = validation;
  if (validation.verdict === "invalid") {
    return { status: "invalid", reason: "quality", plies, issues };
  }
  if (validation.verdict === "unsupported") {
    return { status: "unsupported", reason: "supported-subset", plies, issues };
  }
  if (!isSameMainLine(validation.mainLine!.moves, problem.mainLine)) {
    return { status: "invalid", reason: "main-line-mismatch", plies, issues };
  }
  return {
    status: "analyzed",
    plies,
    features: measureFeatures(problem, new TsumeShogiMateSearch()),
  };
}
