import { countHamiltonianPathHoleLayoutViolations } from "@/games/hamiltonian-path/problem/generation/hole-layout";
import { traceHamiltonianPathHumanSolve } from "@/games/hamiltonian-path/problem/generation/human-solver";
import { createRandomSelfAvoidingWalk } from "@/games/hamiltonian-path/problem/generation/self-avoiding-walk";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import { listHamiltonianPathBoardOrientations } from "@/games/hamiltonian-path/problem/generation/symmetry";
import type { HamiltonianPathBoardSize } from "@/games/hamiltonian-path/problem/problem";
import {
  type HamiltonianPathBoard,
  listHamiltonianPathCells,
  listHamiltonianPathGridNeighbors,
} from "@/games/hamiltonian-path/puzzle/board";
import { areHamiltonianPathOpenCellsConnected } from "@/games/hamiltonian-path/puzzle/rules";
import type { ProblemRandom } from "@/games/problem-seed";

/** 一意解の盤面と、そのただ1つの解の道。 */
export type HamiltonianPathUniqueHoleBoard = {
  board: HamiltonianPathBoard;
  solution: readonly number[];
};

/** 焼きなましを始める盤面の穴の割合。始めの自己回避路が通らないマスを穴にする。 */
const INITIAL_HOLE_RATIO = 0.15;

/** 焼きなましで穴を動かす回数の上限。これで一意解に着かなければ、その盤面は諦める。 */
const ANNEALING_ITERATIONS = {
  5: 1_000,
  6: 1_500,
  7: 2_000,
  8: 3_000,
} as const satisfies Record<HamiltonianPathBoardSize, number>;

const START_TEMPERATURE = 2;
const END_TEMPERATURE = 0.05;

/**
 * 解の数を数える上限。これより多い盤面は同じ多さとみなす。探索量の上限で打ち切った盤面も上限の数とみなす。
 * 解の数は対数で目的に入れるので、32 解で頭打ちにしても 1 解へ向かう勾配は残る。
 */
const SOLUTION_COUNT_CAP = 32;

/** 見た目の基準の違反1つを、解の数の対数の何倍に数えるか。 */
const LAYOUT_VIOLATION_WEIGHT = 1.5;

/**
 * 難しさへ歩く回数の上限。仮置きの回数が目標に届かなくても、ここまでで最も難しかった一意解の盤面を返す。
 */
const HARDENING_WALK_ITERATIONS = 20_000;

/** 難しさへ歩くときの、一意解の盤面どうしの比べ方。難しさ1の差を、解の数の対数1の差と同じ重さに数える。 */
const HARDENING_SCORE_WEIGHT = 1;
const HARDENING_TEMPERATURE = 0.5;

/** 難しさを見積もる人間向け解法器の、推論を進めた回数の上限。分析（200,000）より小さくとり、歩く1歩を軽くする。 */
const HARDNESS_ESTIMATE_WORK_LIMIT = 50_000;

/** 難しさの見積もりに数える、最も長い先読みの手数の上限。仮置きの回数の1回より重くならないようにする。 */
const LONGEST_REFUTATION_SCORE_CAP = 20;
const LONGEST_REFUTATION_SCORE_SCALE = 40;

type SolutionEstimate = {
  /** 見つけた解の数。探索量の上限で打ち切ったら `SOLUTION_COUNT_CAP` 以上。 */
  solutionCount: number;
  isUnique: boolean;
  firstSolution: readonly number[] | undefined;
};

function estimateSolutions(board: HamiltonianPathBoard): SolutionEstimate {
  const search = countHamiltonianPathSolutions(board, {
    solutionLimit: SOLUTION_COUNT_CAP,
  });
  const searchLimitReached = search.status === "search-limit-reached";
  const solutionCount = searchLimitReached
    ? Math.max(SOLUTION_COUNT_CAP, search.solutionCount)
    : search.solutionCount;
  return {
    solutionCount,
    isUnique: solutionCount === 1 && !searchLimitReached,
    firstSolution: search.firstSolutions[0],
  };
}

/** 焼きなましで下げる量。解の数の対数と、見た目の基準の違反の重み付きの和。 */
function measureEnergy(solutionCount: number, layoutViolations: number) {
  return (
    Math.log2(Math.max(1, solutionCount)) +
    LAYOUT_VIOLATION_WEIGHT * layoutViolations
  );
}

function accepts(
  energy: number,
  candidateEnergy: number,
  temperature: number,
  random: ProblemRandom,
): boolean {
  return (
    candidateEnergy <= energy ||
    random() < Math.exp((energy - candidateEnergy) / temperature)
  );
}

function pickValue<T>(values: readonly T[], random: ProblemRandom): T {
  return values[Math.floor(random() * values.length)]!;
}

/** 近傍の選び方の累積の割合。穴を足す・消す・動かす、始点を動かす。 */
const ADD_HOLE_UNTIL = 0.25;
const REMOVE_HOLE_UNTIL = 0.45;
const MOVE_HOLE_UNTIL = 0.85;
/** 穴・始点を動かす先を、隣のマスから選ぶ割合。残りは盤面のどこからでも選ぶ。 */
const MOVE_HOLE_TO_NEIGHBOR_RATIO = 0.7;
const MOVE_START_TO_NEIGHBOR_RATIO = 0.6;

/**
 * 盤面の無作為な近傍。穴を1つ足す・消す・動かすか、始点を動かす。外周に穴を置いてよい（外形が欠ける）。
 * 穴でないマスがつながらなくなる近傍や、動かせる先が無い近傍は `null`。
 */
function moveHoles(
  board: HamiltonianPathBoard,
  random: ProblemRandom,
): HamiltonianPathBoard | null {
  const { size } = board;
  const holes = new Set(board.holes);
  let { start } = board;
  const otherOpenCells = listHamiltonianPathCells(size).filter(
    (cell) => !holes.has(cell) && cell !== start,
  );
  const choice = random();
  if (choice < ADD_HOLE_UNTIL) {
    if (otherOpenCells.length === 0) {
      return null;
    }
    holes.add(pickValue(otherOpenCells, random));
  } else if (choice < REMOVE_HOLE_UNTIL) {
    if (board.holes.length === 0) {
      return null;
    }
    holes.delete(pickValue(board.holes, random));
  } else if (choice < MOVE_HOLE_UNTIL) {
    if (board.holes.length === 0) {
      return null;
    }
    const hole = pickValue(board.holes, random);
    const destinations = (
      random() < MOVE_HOLE_TO_NEIGHBOR_RATIO
        ? listHamiltonianPathGridNeighbors(size, hole)
        : otherOpenCells
    ).filter((cell) => !holes.has(cell) && cell !== start);
    if (destinations.length === 0) {
      return null;
    }
    holes.delete(hole);
    holes.add(pickValue(destinations, random));
  } else {
    const destinations = (
      random() < MOVE_START_TO_NEIGHBOR_RATIO
        ? listHamiltonianPathGridNeighbors(size, start)
        : otherOpenCells
    ).filter((cell) => !holes.has(cell));
    if (destinations.length === 0) {
      return null;
    }
    start = pickValue(destinations, random);
  }
  const moved = {
    size,
    holes: [...holes].sort((left, right) => left - right),
    start,
  };
  return areHamiltonianPathOpenCellsConnected(moved) ? moved : null;
}

function createInitialBoard(
  size: HamiltonianPathBoardSize,
  random: ProblemRandom,
): HamiltonianPathBoard {
  const cellCount = size * size;
  const path = createRandomSelfAvoidingWalk(
    size,
    Math.round(cellCount * (1 - INITIAL_HOLE_RATIO)),
    random,
  );
  const pathCells = new Set(path);
  return {
    size,
    holes: listHamiltonianPathCells(size).filter(
      (cell) => !pathCells.has(cell),
    ),
    start: path[0]!,
  };
}

/**
 * 穴の焼きなまし。無作為な自己回避路が通らないマスを穴にした盤面から始め、穴と始点を動かして、
 * 解の数の対数と見た目の基準の違反（`countHamiltonianPathHoleLayoutViolations`）の和を下げる。
 * 解が無くなる近傍は退ける。一意解で見た目の基準を満たす盤面に着いたら返し、上限の回数で着かなければ `null`。
 */
function annealHamiltonianPathHoles(
  size: HamiltonianPathBoardSize,
  random: ProblemRandom,
): HamiltonianPathUniqueHoleBoard | null {
  const iterations = ANNEALING_ITERATIONS[size];
  let board = createInitialBoard(size, random);
  let estimate = estimateSolutions(board);
  let layoutViolations = countHamiltonianPathHoleLayoutViolations(board);
  let energy = measureEnergy(estimate.solutionCount, layoutViolations);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (estimate.isUnique && layoutViolations === 0) {
      return { board, solution: estimate.firstSolution! };
    }
    const temperature =
      START_TEMPERATURE *
      (END_TEMPERATURE / START_TEMPERATURE) ** (iteration / iterations);
    const candidate = moveHoles(board, random);
    if (candidate === null) {
      continue;
    }
    const candidateViolations =
      countHamiltonianPathHoleLayoutViolations(candidate);
    const candidateEstimate = estimateSolutions(candidate);
    if (candidateEstimate.solutionCount === 0) {
      continue;
    }
    const candidateEnergy = measureEnergy(
      candidateEstimate.solutionCount,
      candidateViolations,
    );
    if (accepts(energy, candidateEnergy, temperature, random)) {
      board = candidate;
      estimate = candidateEstimate;
      layoutViolations = candidateViolations;
      energy = candidateEnergy;
    }
  }
  return null;
}

/**
 * 一意解の盤面の難しさの見積もり。回転・反転した8通りの盤面のうち、人間向け解法器が2段仮置き無しで解き切れた向きの
 * 「仮置きの回数＋最も長い先読みの手数の小さな重み」の最小。分析（`analyzeHamiltonianPathDifficulty`）の
 * 最も上手な読み順の、軽い代わり。どの向きでも解き切れなければ `null`。
 */
function estimateHamiltonianPathHardness(
  board: HamiltonianPathBoard,
): number | null {
  let easiest: number | null = null;
  for (const orientation of listHamiltonianPathBoardOrientations(board)) {
    const trace = traceHamiltonianPathHumanSolve(orientation.board, {
      workLimit: HARDNESS_ESTIMATE_WORK_LIMIT,
    });
    if (trace.status !== "solved" || trace.deepAssumptionCount > 0) {
      continue;
    }
    const longestRefutationLength = Math.max(0, ...trace.refutationLengths);
    const hardness =
      trace.assumptionCount +
      Math.min(longestRefutationLength, LONGEST_REFUTATION_SCORE_CAP) /
        LONGEST_REFUTATION_SCORE_SCALE;
    easiest = easiest === null ? hardness : Math.min(easiest, hardness);
    if (easiest === 0) {
      break;
    }
  }
  return easiest;
}

function createBoardKey({ holes, start }: HamiltonianPathBoard): string {
  return `${holes.join(",")}/${start}`;
}

/**
 * 一意解の盤面から、難しさへ歩く。一意解で見た目の基準を満たす盤面では難しいほど低く、それ以外の盤面では
 * 焼きなましと同じ量を低くする目的で、穴と始点を一定の温度で動かし続ける。歩く途中で一意解でなくなってもよい。
 * 仮置きの回数が `targetAssumptionCount` に届くか、上限の回数を歩いたら、通った一意解の盤面のうち最も難しいものを返す。
 */
function walkHamiltonianPathHolesTowardHardness(
  origin: HamiltonianPathUniqueHoleBoard,
  targetAssumptionCount: number,
  random: ProblemRandom,
): HamiltonianPathUniqueHoleBoard {
  const originHardness = estimateHamiltonianPathHardness(origin.board);
  let hardest = origin;
  let hardestHardness = originHardness ?? Number.NEGATIVE_INFINITY;
  let board = origin.board;
  let energy = -HARDENING_SCORE_WEIGHT * Math.max(0, originHardness ?? 0);
  const hardnessByBoard = new Map<string, number | null>();
  for (
    let iteration = 0;
    iteration < HARDENING_WALK_ITERATIONS &&
    hardestHardness < targetAssumptionCount;
    iteration += 1
  ) {
    const candidate = moveHoles(board, random);
    if (candidate === null) {
      continue;
    }
    const layoutViolations =
      countHamiltonianPathHoleLayoutViolations(candidate);
    const estimate = estimateSolutions(candidate);
    if (estimate.solutionCount === 0) {
      continue;
    }
    let candidateEnergy: number;
    if (estimate.isUnique && layoutViolations === 0) {
      const key = createBoardKey(candidate);
      const hardness = hardnessByBoard.has(key)
        ? hardnessByBoard.get(key)!
        : estimateHamiltonianPathHardness(candidate);
      hardnessByBoard.set(key, hardness);
      if (hardness === null) {
        continue;
      }
      candidateEnergy = -HARDENING_SCORE_WEIGHT * hardness;
      if (hardness > hardestHardness) {
        hardest = { board: candidate, solution: estimate.firstSolution! };
        hardestHardness = hardness;
      }
    } else {
      candidateEnergy = measureEnergy(estimate.solutionCount, layoutViolations);
    }
    if (accepts(energy, candidateEnergy, HARDENING_TEMPERATURE, random)) {
      board = candidate;
      energy = candidateEnergy;
    }
  }
  return hardest;
}

/**
 * 穴だけで一意解にした盤面を作る。焼きなましで一意解に着いたら、`targetAssumptionCount` が正なら難しさへ歩く。
 * 焼きなましが一意解に着かなければ `null`（同じ乱数列の続きで作り直せる）。
 * 乱数と探索量の上限だけで決まり、同じ乱数列からは同じ盤面を作る。
 */
export function createHamiltonianPathHoleBoard(
  size: HamiltonianPathBoardSize,
  targetAssumptionCount: number,
  random: ProblemRandom,
): HamiltonianPathUniqueHoleBoard | null {
  const annealed = annealHamiltonianPathHoles(size, random);
  if (annealed === null || targetAssumptionCount === 0) {
    return annealed;
  }
  return walkHamiltonianPathHolesTowardHardness(
    annealed,
    targetAssumptionCount,
    random,
  );
}

export const _private = {
  moveHoles,
  annealHamiltonianPathHoles,
  estimateHamiltonianPathHardness,
  walkHamiltonianPathHolesTowardHardness,
};
