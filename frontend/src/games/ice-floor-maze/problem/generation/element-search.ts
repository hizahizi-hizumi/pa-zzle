import type { ElementMetrics } from "@/games/ice-floor-maze/problem/generation/element-features";
import {
  type ElementRecipe,
  type ElementVariant,
  evaluateElementBoard,
  listElementViolations,
  scoreElementHardness,
} from "@/games/ice-floor-maze/problem/generation/element-objective";
import {
  CELL_BRITTLE,
  CELL_ICE,
  CELL_ROCK,
  CELL_THIN,
  createElementRules,
  DIRECTION_COUNT,
  findSlideEnd,
  type GenerationBoard,
  maskAfterSlide,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import type { ProblemRandom } from "@/games/problem-seed";

/**
 * もろい岩・薄い氷のある問題の山登り（研究用の生成 v4 の `Searcher`）。悪くならなければ受理し、
 * 近傍は岩の追加・削除・入れ替え、開始位置の移動、要素の追加・削除・移動、おとりの候補の置き方。
 */

/**
 * 山登りの止め方。
 * - `iterations`: 山登りの回数。
 * - `stopWhenAccepted`: 採用条件を満たし、難しさの点（読み深さを除く）が `minimumHardness` 以上になった時点で止める。
 * - `giveUpAfter`: 打ち切る方式で、この回数までに採用条件を満たさなければ諦める。
 */
export type ElementSearchSettings = {
  iterations: number;
  stopWhenAccepted: boolean;
  minimumHardness: number;
  giveUpAfter: number;
};

/** 研究用の v4 と同じ、最後まで回す山登り。 */
export const fullElementSearch = {
  iterations: 3000,
  stopWhenAccepted: false,
  minimumHardness: 0,
  giveUpAfter: 3000,
} as const satisfies ElementSearchSettings;

/** 何回ごとにおとりの候補をすべて試すか。ランダムに置いた要素はほとんどおとりにならないため。 */
const POLISH_EVERY = 400;
const INITIAL_ROCK_DENSITY = 0.18;
const MINIMUM_ROCK_DENSITY = 0.08;

const tilesByVariant = {
  "brittle-rock": [CELL_BRITTLE],
  "thin-ice": [CELL_THIN],
  mixed: [CELL_BRITTLE, CELL_THIN],
} as const satisfies Record<ElementVariant, readonly number[]>;

type Candidate = {
  board: GenerationBoard;
  start: number;
  goal: number;
};

type Scored = Candidate & { score: number; metrics: ElementMetrics | null };

export type ElementSearchResult = Scored & {
  iterationCount: number;
  acceptedAtIteration: number | null;
};

function choose<T>(values: readonly T[], random: ProblemRandom): T {
  return values[Math.floor(random() * values.length)]!;
}

function randomIndex(length: number, random: ProblemRandom): number {
  return Math.floor(random() * length);
}

function countCells(cells: Uint8Array, codes: readonly number[]): number {
  let count = 0;
  for (const code of cells) {
    if (codes.includes(code)) {
      count += 1;
    }
  }
  return count;
}

function listCells(
  cells: Uint8Array,
  predicate: (code: number, cell: number) => boolean,
): number[] {
  const found: number[] = [];
  cells.forEach((code, cell) => {
    if (predicate(code, cell)) {
      found.push(cell);
    }
  });
  return found;
}

/** 山登りの1回の状態。 */
type Searcher = {
  recipe: ElementRecipe;
  random: ProblemRandom;
  tiles: readonly number[];
  cellCount: number;
  maximumRocks: number;
  minimumRocks: number;
};

function listHosts(cells: Uint8Array, start: number, tile: number): number[] {
  return listCells(
    cells,
    (code, cell) =>
      cell !== start &&
      (code === CELL_ICE || (tile === CELL_BRITTLE && code === CELL_ROCK)),
  );
}

function pickTile(searcher: Searcher, cells: Uint8Array): number {
  const { recipe, tiles, random } = searcher;
  if (recipe.variant !== "mixed") {
    return tiles[0]!;
  }
  const short = tiles.filter(
    (tile) => countCells(cells, [tile]) < recipe.minimumEach,
  );
  return choose(short.length > 0 ? short : tiles, random);
}

function createInitialBoard(searcher: Searcher): Candidate {
  const { recipe, random, cellCount } = searcher;
  const cells = Uint8Array.from({ length: cellCount }, () =>
    random() < INITIAL_ROCK_DENSITY ? CELL_ROCK : CELL_ICE,
  );
  const ice = listCells(cells, (code) => code === CELL_ICE);
  const start = ice[randomIndex(ice.length, random)]!;
  const placements = Math.floor(
    (recipe.elements.minimum + recipe.elements.maximum) / 2,
  );
  for (let count = 0; count < placements; count += 1) {
    const tile = pickTile(searcher, cells);
    cells[choose(listHosts(cells, start, tile), random)] = tile;
  }
  return {
    board: { width: recipe.width, height: recipe.height, cells },
    start,
    goal: -1,
  };
}

function mutateElements(
  searcher: Searcher,
  cells: Uint8Array,
  start: number,
): void {
  const { random, recipe, tiles } = searcher;
  const placed = listCells(cells, (code) => tiles.includes(code));
  const operation = random();
  if (
    (operation < 0.3 || placed.length === 0) &&
    placed.length < recipe.elements.maximum
  ) {
    const tile = pickTile(searcher, cells);
    const hosts = listHosts(cells, start, tile);
    if (hosts.length > 0) {
      cells[choose(hosts, random)] = tile;
    }
  } else if (operation < 0.5 && placed.length > recipe.elements.minimum) {
    const cell = choose(placed, random);
    cells[cell] =
      cells[cell] === CELL_BRITTLE
        ? choose([CELL_ICE, CELL_ROCK], random)
        : CELL_ICE;
  } else if (placed.length > 0) {
    const source = choose(placed, random);
    let tile = cells[source]!;
    if (recipe.variant === "mixed" && random() < 0.2) {
      tile = tile === CELL_BRITTLE ? CELL_THIN : CELL_BRITTLE;
    }
    cells[source] =
      cells[source] === CELL_BRITTLE && random() < 0.5 ? CELL_ROCK : CELL_ICE;
    const hosts = listHosts(cells, start, tile);
    if (hosts.length > 0) {
      cells[choose(hosts, random)] = tile;
    }
  }
}

function mutateRocks(
  searcher: Searcher,
  cells: Uint8Array,
  start: number,
): void {
  const { random, cellCount } = searcher;
  const rocks = countCells(cells, [CELL_ROCK]);
  const cell = randomIndex(cellCount, random);
  if (
    cell === start ||
    (cells[cell] !== CELL_ICE && cells[cell] !== CELL_ROCK)
  ) {
    return;
  }
  if (random() < 0.5) {
    if (cells[cell] === CELL_ROCK && rocks > searcher.minimumRocks) {
      cells[cell] = CELL_ICE;
    } else if (cells[cell] === CELL_ICE && rocks < searcher.maximumRocks) {
      cells[cell] = CELL_ROCK;
    }
    return;
  }
  const other = randomIndex(cellCount, random);
  if (
    other === start ||
    (cells[other] !== CELL_ICE && cells[other] !== CELL_ROCK)
  ) {
    return;
  }
  const swapped = cells[cell]!;
  cells[cell] = cells[other]!;
  cells[other] = swapped;
}

function mutate(searcher: Searcher, candidate: Candidate): Candidate {
  const { random } = searcher;
  const cells = candidate.board.cells.slice();
  let { start } = candidate;
  const roll = random();
  if (roll < 0.08) {
    const free = listCells(
      cells,
      (code, cell) => code === CELL_ICE && cell !== start,
    );
    if (free.length > 0) {
      start = choose(free, random);
    }
  } else if (roll < 0.4) {
    mutateElements(searcher, cells, start);
  } else {
    mutateRocks(searcher, cells, start);
  }
  return { board: { ...candidate.board, cells }, start, goal: -1 };
}

/**
 * おとりになりうる置き方: 最短解から外れた1手目・2手目の滑りを止める岩をもろい岩にする、その滑りが通る氷をもろい岩・薄い氷にする。
 * 置き方は `マス × 8 + 種類` の昇順。
 */
function listLureSpots(
  searcher: Searcher,
  candidate: Candidate,
  solution: readonly number[],
): [cell: number, tile: number][] {
  const { board, start, goal } = candidate;
  const rules = createElementRules(board);
  const slides = new Set<number>();
  const { cellCount } = rules;
  function encodeSlide(origin: number, direction: number, end: number): number {
    return (origin * DIRECTION_COUNT + direction) * cellCount + end;
  }
  function listMoves(
    position: number,
    mask: number,
  ): [number, number, number][] {
    const moves: [number, number, number][] = [];
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = findSlideEnd(rules, position, mask, direction);
      if (end !== position) {
        moves.push([
          direction,
          end,
          maskAfterSlide(rules, position, end, mask, direction),
        ]);
      }
    }
    return moves;
  }
  let position = start;
  let mask = 0;
  for (const move of solution) {
    const options = listMoves(position, mask);
    for (const [direction, end, after] of options) {
      if (direction === move) {
        continue;
      }
      slides.add(encodeSlide(position, direction, end));
      if (end !== goal) {
        for (const [nextDirection, nextEnd] of listMoves(end, after)) {
          slides.add(encodeSlide(end, nextDirection, nextEnd));
        }
      }
    }
    const chosen = options.find(([direction]) => direction === move)!;
    position = chosen[1];
    mask = chosen[2];
  }
  const spots = new Set<number>();
  const SPOT_RADIX = 8;
  for (const slide of slides) {
    const end = slide % cellCount;
    const direction = Math.floor(slide / cellCount) % DIRECTION_COUNT;
    const origin = Math.floor(slide / cellCount / DIRECTION_COUNT);
    const stopper = rules.beyond[direction]![end]!;
    if (
      searcher.tiles.includes(CELL_BRITTLE) &&
      stopper >= 0 &&
      board.cells[stopper] === CELL_ROCK
    ) {
      spots.add(stopper * SPOT_RADIX + CELL_BRITTLE);
    }
    const step = rules.delta[direction]!;
    for (let cell = origin + step; ; cell += step) {
      if (board.cells[cell] === CELL_ICE && cell !== start && cell !== goal) {
        for (const tile of searcher.tiles) {
          spots.add(cell * SPOT_RADIX + tile);
        }
      }
      if (cell === end) {
        break;
      }
    }
  }
  return [...spots]
    .sort((left, right) => left - right)
    .map((spot) => [Math.floor(spot / SPOT_RADIX), spot % SPOT_RADIX]);
}

/** おとりの候補をすべて試し、点が最も上がるものを受け入れる。上がらなくなるまで繰り返す。 */
function polish(searcher: Searcher, current: Scored): Scored | null {
  let found: Scored | null = null;
  let candidate = current;
  while (
    countCells(candidate.board.cells, searcher.tiles) <
      searcher.recipe.elements.maximum &&
    candidate.metrics
  ) {
    let best: Scored | null = null;
    for (const [cell, tile] of listLureSpots(
      searcher,
      candidate,
      candidate.metrics.solution,
    )) {
      const cells = candidate.board.cells.slice();
      cells[cell] = tile;
      const board = { ...candidate.board, cells };
      const evaluation = evaluateElementBoard(
        board,
        candidate.start,
        searcher.recipe,
        candidate.score,
      );
      if (
        evaluation.metrics &&
        evaluation.score > candidate.score &&
        (!best || evaluation.score > best.score)
      ) {
        best = {
          board,
          start: candidate.start,
          goal: evaluation.goal,
          score: evaluation.score,
          metrics: evaluation.metrics,
        };
      }
    }
    if (!best) {
      break;
    }
    candidate = best;
    found = best;
  }
  return found;
}

function isAccepted(
  scored: Scored,
  recipe: ElementRecipe,
  settings: ElementSearchSettings,
): boolean {
  return (
    scored.metrics !== null &&
    listElementViolations(scored.metrics, recipe).length === 0 &&
    scoreElementHardness(scored.metrics) >= settings.minimumHardness
  );
}

/** 山登りで問題を作る。打ち切る方式で諦めたら `null`。返す問題は盤面の外へ置き換える前の盤面。 */
export function searchElementProblem(
  recipe: ElementRecipe,
  random: ProblemRandom,
  settings: ElementSearchSettings = fullElementSearch,
): ElementSearchResult | null {
  const cellCount = recipe.width * recipe.height;
  const searcher: Searcher = {
    recipe,
    random,
    tiles: tilesByVariant[recipe.variant],
    cellCount,
    maximumRocks: Math.floor(recipe.maximumRockDensity * cellCount),
    minimumRocks: Math.floor(MINIMUM_ROCK_DENSITY * cellCount),
  };
  const initial = createInitialBoard(searcher);
  const evaluation = evaluateElementBoard(initial.board, initial.start, recipe);
  let current: Scored = { ...initial, ...evaluation };
  let best = current;
  let acceptedAtIteration: number | null = isAccepted(current, recipe, settings)
    ? 0
    : null;
  let iteration = 1;
  for (; iteration < settings.iterations; iteration += 1) {
    if (settings.stopWhenAccepted) {
      if (acceptedAtIteration !== null) {
        break;
      }
      if (iteration >= settings.giveUpAfter) {
        return null;
      }
    }
    if (iteration % POLISH_EVERY === 0 && current.metrics) {
      const polished = polish(searcher, current);
      if (polished) {
        current = polished;
        if (polished.score >= best.score) {
          best = polished;
        }
      }
    } else {
      const next = mutate(searcher, current);
      const nextEvaluation = evaluateElementBoard(
        next.board,
        next.start,
        recipe,
        current.score,
      );
      if (nextEvaluation.score >= current.score) {
        current = { ...next, ...nextEvaluation };
        if (current.score >= best.score) {
          best = current;
        }
      }
    }
    if (
      settings.stopWhenAccepted &&
      acceptedAtIteration === null &&
      isAccepted(current, recipe, settings)
    ) {
      acceptedAtIteration = iteration;
      best = current;
    }
  }
  if (settings.stopWhenAccepted && acceptedAtIteration === null) {
    return null;
  }
  return { ...best, iterationCount: iteration, acceptedAtIteration };
}
