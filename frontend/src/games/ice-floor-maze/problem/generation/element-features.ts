import {
  CELL_BRITTLE,
  CELL_ICE,
  CELL_OUTSIDE,
  CELL_ROCK,
  CELL_THIN,
  countBits,
  countShortestSolutions,
  createElementRules,
  DIRECTION_COUNT,
  type ElementRules,
  exploreStateSpace,
  findCanonicalSolution,
  findSlideEnd,
  findUsedCells,
  type GenerationBoard,
  getTarget,
  measureDistancesToGoal,
  replaySolution,
  type StateSpace,
  withGoal,
} from "@/games/ice-floor-maze/problem/generation/state-space";

/**
 * もろい岩・薄い氷のある盤面の特徴量（研究用の生成 v4 `ice_floor_hardest_generation_experiment.py` の `measure`）。
 * 氷と岩だけの盤面にも当てられる（要素が無いだけ）。
 */

/** 最短+この手数以内の道筋を「近い道筋」とみなす。 */
const NEAR_SLACK = 2;
/** 見た目どおりの読みの解が元の規則でも通るとき、これ以上長ければ大きな遠回り。 */
const DETOUR = 4;
/** 選択肢の後の最短が、分かれた状態からの最短よりこの手数以上長ければ遠回り。 */
export const FALSE_LEAD_COST = 3;

/**
 * 要素の役割。
 * - `used`: 最短解で変化させる。
 * - `decoy`: おとり。最短解で変化させず、最短解から外れたもっともらしい1手目か続くもっともらしい2手目が変化させ、その後が詰みか遠回り。
 * - `weak-decoy`: おとりの条件を、もっともらしくない手で満たす。
 * - `other`: 効くが上のどれでもない。
 * - `irrelevant`: 効かない。中立の形にしても最短解・選択肢が変わらない。
 */
export type ElementRole =
  | "used"
  | "decoy"
  | "weak-decoy"
  | "other"
  | "irrelevant";

/**
 * 見た目どおり（もろい岩→岩、薄い氷→氷）に読んだ盤面の結果。
 * - `unsolvable`: 解が無い。
 * - `misleading`: その最短解が元の規則では通らない。
 * - `detour`: 通るが大きな遠回り。
 * - `shortcut`: 通り、遠回りでもない（静的な近道）。
 */
export type LooksReading = "unsolvable" | "misleading" | "detour" | "shortcut";

/** 要素を変化しないマスに置き換えた盤面の解。`shortest` が `null` なら解なし。 */
export type StaticSolution = {
  shortest: number | null;
  passesOriginalRules: boolean;
};

export type ElementMetrics = {
  shortest: number;
  solutionCount: number;
  stateCount: number;
  nearExtraStateCount: number;
  deadStateCount: number;
  forcedMoveCount: number;
  lureCount: number;
  deadOptionCount: number;
  useCount: number;
  changedElementCount: number;
  elementCount: number;
  brittleCount: number;
  thinCount: number;
  unusedCellCount: number;
  roles: readonly ElementRole[];
  precedenceCount: number;
  softPrecedenceCount: number;
  orderChain: number;
  orderTrapCount: number;
  orderLureCount: number;
  solutionRepeatCount: number;
  nearRepeatCount: number;
  brittleChainCount: number;
  repeatMoveCount: number;
  liveRepeatMoveCount: number;
  looks: StaticSolution;
  other: StaticSolution;
  solution: readonly number[];
};

export function countRoles(metrics: ElementMetrics, role: ElementRole): number {
  return metrics.roles.filter((value) => value === role).length;
}

export function classifyLooksReading(metrics: ElementMetrics): LooksReading {
  const { looks } = metrics;
  if (looks.shortest === null) {
    return "unsolvable";
  }
  if (!looks.passesOriginalRules) {
    return "misleading";
  }
  return looks.shortest >= metrics.shortest + DETOUR ? "detour" : "shortcut";
}

/** 見た目どおり、またはもう一方（もろい岩→氷、薄い氷→岩）の盤面の解が元の規則でも短く通る。 */
export function hasStaticShortcut(metrics: ElementMetrics): boolean {
  const { other } = metrics;
  return (
    classifyLooksReading(metrics) === "shortcut" ||
    (other.shortest !== null &&
      other.passesOriginalRules &&
      other.shortest <= metrics.shortest + NEAR_SLACK)
  );
}

/** 1つの盤面と開始位置について、ゴールによらない状態のグラフ（研究用の `Context`）。 */
export type ElementContext = {
  board: GenerationBoard;
  start: number;
  rules: ElementRules;
  free: StateSpace | null;
  neutralFree: readonly (StateSpace | null)[];
  looksFree: StateSpace | null;
  otherFree: StateSpace | null;
};

function replaceCells(
  board: GenerationBoard,
  replace: (code: number, cell: number) => number,
): GenerationBoard {
  return {
    ...board,
    cells: board.cells.map((code, cell) => replace(code, cell)),
  };
}

function neutralCode(code: number): number {
  if (code === CELL_BRITTLE) {
    return CELL_ROCK;
  }
  return code === CELL_THIN ? CELL_ICE : code;
}

function otherCode(code: number): number {
  if (code === CELL_BRITTLE) {
    return CELL_ICE;
  }
  return code === CELL_THIN ? CELL_ROCK : code;
}

export function createElementContext(
  board: GenerationBoard,
  start: number,
  limit?: number,
): ElementContext {
  const rules = createElementRules(board);
  const free = exploreStateSpace(rules, start, { limit });
  const neutralFree = free
    ? Array.from(rules.elements, (elementCell) =>
        exploreStateSpace(
          createElementRules(
            replaceCells(board, (code, cell) =>
              cell === elementCell ? neutralCode(code) : code,
            ),
          ),
          start,
          { limit },
        ),
      )
    : [];
  return {
    board,
    start,
    rules,
    free,
    neutralFree,
    looksFree: exploreStateSpace(
      createElementRules(replaceCells(board, neutralCode)),
      start,
      { limit },
    ),
    otherFree: exploreStateSpace(
      createElementRules(replaceCells(board, otherCode)),
      start,
      { limit },
    ),
  };
}

/** 滑った先がゴール・ゴールへ近づく・ゴールと見通しで揃う、または滑りがゴールを通過する手（v2 の定義を今の状態の盤面で測る）。 */
function createPlausibility(
  space: StateSpace,
): (state: number, direction: number, target: number) => boolean {
  const { rules, goal, positions, masks } = space;
  const { width } = rules;
  const goalX = goal % width;
  const goalY = Math.floor(goal / width);
  function gap(cell: number): number {
    return (
      Math.abs((cell % width) - goalX) +
      Math.abs(Math.floor(cell / width) - goalY)
    );
  }
  function toward(cell: number): number {
    const x = cell % width;
    const y = Math.floor(cell / width);
    if (x === goalX && y !== goalY) {
      return goalY < y ? 0 : 2;
    }
    if (y === goalY && x !== goalX) {
      return goalX > x ? 1 : 3;
    }
    return -1;
  }
  function sees(cell: number, mask: number): boolean {
    const direction = toward(cell);
    if (direction < 0) {
      return false;
    }
    const end = findSlideEnd(rules, cell, mask, direction);
    const endX = end % width;
    const endY = Math.floor(end / width);
    return [endY <= goalY, endX >= goalX, endY >= goalY, endX <= goalX][
      direction
    ]!;
  }
  return function plausible(state, direction, target) {
    const from = positions[state]!;
    const to = positions[target]!;
    if (to === goal || gap(to) < gap(from) || sees(to, masks[target]!)) {
      return true;
    }
    const mask = masks[state]!;
    return (
      direction === toward(from) &&
      sees(from, mask) &&
      findSlideEnd(rules, from, mask, direction) !== goal
    );
  };
}

/**
 * 最短解の上の状態から1手、または解でない手の後にもう1手指した選択肢。
 * `kind` は 0 が遠回りでない、1 が遠回り、2 が詰み。
 */
type SolutionOption = {
  direction: number;
  source: number;
  target: number;
  kind: number;
  plausible: boolean;
  then: readonly SolutionOption[];
};

type SolutionStep = { state: number; options: readonly SolutionOption[] };

/** 最短解の各手の前の状態とそこでの全選択肢。`solution` がこのグラフで通らなければ `null`。 */
function listSolutionOptions(
  space: StateSpace,
  toGoal: Int32Array,
  solution: readonly number[],
): SolutionStep[] | null {
  const plausible = createPlausibility(space);
  const { positions, goal } = space;
  function option(
    source: number,
    direction: number,
    target: number,
    remaining: number,
    spent: number,
    then: readonly SolutionOption[] = [],
  ): SolutionOption {
    const after = toGoal[target]!;
    const kind =
      after < 0 ? 2 : after + spent - remaining >= FALSE_LEAD_COST ? 1 : 0;
    return {
      direction,
      source,
      target,
      kind,
      plausible: plausible(source, direction, target),
      then,
    };
  }

  const steps: SolutionStep[] = [];
  let state = 0;
  for (const move of solution) {
    const remaining = toGoal[state]!;
    if (remaining < 0) {
      return null;
    }
    const options: SolutionOption[] = [];
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = getTarget(space, state, direction);
      if (target < 0) {
        continue;
      }
      const then: SolutionOption[] = [];
      if (direction !== move && positions[target] !== goal) {
        for (let next = 0; next < DIRECTION_COUNT; next += 1) {
          const nextTarget = getTarget(space, target, next);
          if (nextTarget >= 0) {
            then.push(option(target, next, nextTarget, remaining, 2));
          }
        }
      }
      options.push(option(state, direction, target, remaining, 1, then));
    }
    if (options.length === 0) {
      return null;
    }
    steps.push({ state, options });
    const next = getTarget(space, state, move);
    if (next < 0) {
      return null;
    }
    state = next;
  }
  return positions[state] === goal ? steps : null;
}

/** 選択肢の性質（向き・詰みか遠回りか・もっともらしいか）を2手先まで並べた符号。状態の番号は盤面ごとに違うので使わない。 */
function formatOptionProfile(
  steps: readonly SolutionStep[] | null,
): string | null {
  if (steps === null) {
    return null;
  }
  function formatOption(option: SolutionOption): string {
    return `${option.direction}${option.kind}${option.plausible ? 1 : 0}`;
  }
  return steps
    .map(({ options }) =>
      options
        .map(
          (option) =>
            `${formatOption(option)}(${option.then.map(formatOption).join(",")})`,
        )
        .join(";"),
    )
    .join("|");
}

/** 1手の出来事のうち、要素を使う出来事（崩す・崩れた跡を通る・水面で止まる）の数。 */
function countUseEvents(
  rules: ElementRules,
  position: number,
  end: number,
  mask: number,
  direction: number,
): number {
  const { elementOf, kinds } = rules;
  let uses = 0;
  const hit = rules.beyond[direction]![end]!;
  const hitElement = hit >= 0 ? elementOf[hit]! : -1;
  if (hitElement >= 0) {
    const changed = ((mask >>> hitElement) & 1) === 1;
    if (kinds[hitElement] === CELL_BRITTLE && !changed) {
      uses += 1;
    }
    if (kinds[hitElement] === CELL_THIN && changed) {
      uses += 1;
    }
  }
  const step = rules.delta[direction]!;
  for (let cell = position + step; ; cell += step) {
    const element = elementOf[cell]!;
    if (
      element >= 0 &&
      kinds[element] === CELL_BRITTLE &&
      ((mask >>> element) & 1) === 1
    ) {
      uses += 1;
    }
    if (cell === end) {
      break;
    }
  }
  return uses;
}

/** 同じ向きが続く2手の数（研究用の `repeat_stats`）。 */
function measureRepeats(
  space: StateSpace,
  toGoal: Int32Array,
  shortest: number,
): { near: number; chains: number; moves: number; live: number } {
  const { masks, distances, count } = space;
  const { brittleBits } = space.rules;
  let near = 0;
  let chains = 0;
  let moves = 0;
  let live = 0;
  for (let state = 0; state < count; state += 1) {
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const middle = getTarget(space, state, direction);
      if (middle < 0) {
        continue;
      }
      const last = getTarget(space, middle, direction);
      if (last < 0) {
        continue;
      }
      moves += 1;
      if (toGoal[last]! >= 0) {
        live += 1;
        if (distances[state]! + toGoal[last]! <= shortest) {
          near += 1;
        }
      }
      const first = masks[middle]! & ~masks[state]! & brittleBits;
      const second = masks[last]! & ~masks[middle]! & brittleBits;
      if (first !== 0 && second !== 0) {
        chains += 1;
      }
    }
  }
  return { near, chains, moves, live };
}

/**
 * 最短解で a を b より先に変化させる要素の組のうち、b より先に a を変化させる手を除くと解けなくなる組の数、
 * 遠回りになる組の数、解けなくなる順序の最も長い連なり（研究用の `precedence_of`）。
 */
function measurePrecedence(
  space: StateSpace,
  firstChange: ReadonlyMap<number, number>,
  shortest: number,
): { strict: number; soft: number; chain: number } {
  const { masks, positions, goal, count } = space;
  const used = [...firstChange.keys()].sort(
    (left, right) => firstChange.get(left)! - firstChange.get(right)!,
  );
  const strict: [number, number][] = [];
  let soft = 0;
  const distances = new Int32Array(count);
  const queue = new Int32Array(count);
  for (let index = 0; index < used.length; index += 1) {
    const a = used[index]!;
    for (const b of used.slice(index + 1)) {
      if (firstChange.get(a) === firstChange.get(b)) {
        continue;
      }
      distances.fill(-1);
      distances[0] = 0;
      queue[0] = 0;
      let tail = 1;
      let reached = -1;
      for (let head = 0; head < tail; head += 1) {
        const state = queue[head]!;
        if (positions[state] === goal) {
          reached = distances[state]!;
          break;
        }
        for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
          const target = getTarget(space, state, direction);
          if (target < 0) {
            continue;
          }
          const targetMask = masks[target]!;
          if (
            ((targetMask >>> a) & 1) === 1 &&
            ((masks[state]! >>> a) & 1) === 0 &&
            ((targetMask >>> b) & 1) === 0
          ) {
            continue;
          }
          if (distances[target]! < 0) {
            distances[target] = distances[state]! + 1;
            queue[tail] = target;
            tail += 1;
          }
        }
      }
      if (reached < 0) {
        strict.push([a, b]);
      } else if (reached >= shortest + FALSE_LEAD_COST) {
        soft += 1;
      }
    }
  }
  const chainOf = new Map(used.map((element) => [element, 1]));
  const ordered = strict
    .map((pair, index) => ({ pair, index }))
    .sort(
      (left, right) =>
        firstChange.get(left.pair[0])! - firstChange.get(right.pair[0])! ||
        left.index - right.index,
    );
  for (const {
    pair: [a, b],
  } of ordered) {
    chainOf.set(b, Math.max(chainOf.get(b)!, chainOf.get(a)! + 1));
  }
  return {
    strict: strict.length,
    soft,
    chain: Math.max(0, ...chainOf.values()),
  };
}

function solveStatic(
  free: StateSpace | null,
  goal: number,
  rules: ElementRules,
  start: number,
): StaticSolution {
  if (!free) {
    return { shortest: null, passesOriginalRules: false };
  }
  const space = withGoal(free, goal);
  const toGoal = measureDistancesToGoal(space);
  if (toGoal[0]! < 0) {
    return { shortest: null, passesOriginalRules: false };
  }
  const moves = findCanonicalSolution(space, toGoal);
  return {
    shortest: moves.length,
    passesOriginalRules: replaySolution(rules, start, moves, goal),
  };
}

/**
 * `goal` の問題の特徴量。`space` は `goal` で止まった状態を終わりにした状態のグラフ。解けなければ `null`。
 */
export function measureElementMetrics(
  context: ElementContext,
  goal: number,
  space: StateSpace = withGoal(context.free!, goal),
): ElementMetrics | null {
  const { rules, board, start } = context;
  const elementCount = rules.elements.length;
  const { masks, positions } = space;
  const toGoal = measureDistancesToGoal(space);
  if (toGoal[0]! < 0) {
    return null;
  }
  const shortest = toGoal[0]!;
  const solution = findCanonicalSolution(space, toGoal);
  const solutionCount = countShortestSolutions(space, toGoal, shortest);
  const steps = listSolutionOptions(space, toGoal, solution)!;

  let useCount = 0;
  const firstChange = new Map<number, number>();
  let state = 0;
  solution.forEach((move, step) => {
    const target = getTarget(space, state, move);
    useCount += countUseEvents(
      rules,
      positions[state]!,
      positions[target]!,
      masks[state]!,
      move,
    );
    const newly = masks[target]! & ~masks[state]!;
    for (let element = 0; element < elementCount; element += 1) {
      if (((newly >>> element) & 1) === 1 && !firstChange.has(element)) {
        firstChange.set(element, step);
      }
    }
    state = target;
  });
  const finalMask = masks[state]!;

  const visited = new Set([0]);
  let forcedMoveCount = 0;
  let lureCount = 0;
  let deadOptionCount = 0;
  let orderTrapCount = 0;
  let orderLureCount = 0;
  let decoyAny = 0;
  let decoyPlausible = 0;
  steps.forEach(({ state: source, options }, step) => {
    const fresh = options.filter((option) => !visited.has(option.target));
    if (fresh.length === 1) {
      forcedMoveCount += 1;
    }
    const move = solution[step]!;
    for (const option of options) {
      if (option.direction === move) {
        continue;
      }
      const bad = option.kind > 0;
      if (bad && option.plausible) {
        lureCount += 1;
      }
      if (option.kind === 2) {
        deadOptionCount += 1;
      }
      const newly = masks[option.target]! & ~masks[source]!;
      const early = [...firstChange].some(
        ([element, changedAt]) =>
          changedAt > step && ((newly >>> element) & 1) === 1,
      );
      if (bad && early) {
        orderTrapCount += 1;
        if (option.plausible) {
          orderLureCount += 1;
        }
      }
      const branches: [SolutionOption, boolean][] = [
        [option, option.plausible],
        ...option.then.map((next): [SolutionOption, boolean] => [
          next,
          option.plausible && next.plausible,
        ]),
      ];
      for (const [branch, tempting] of branches) {
        if (branch.kind === 0) {
          continue;
        }
        const changed =
          masks[branch.target]! & ~masks[branch.source]! & ~finalMask;
        decoyAny |= changed;
        if (tempting) {
          decoyPlausible |= changed;
        }
      }
    }
    visited.add(getTarget(space, source, move));
  });

  const profile = formatOptionProfile(steps);
  const roles = Array.from(
    { length: elementCount },
    (_, element): ElementRole => {
      const neutral = context.neutralFree[element];
      let relevant = true;
      if (neutral) {
        const neutralSpace = withGoal(neutral, goal);
        const neutralToGoal = measureDistancesToGoal(neutralSpace);
        if (neutralToGoal[0]! >= 0) {
          const neutralShortest = neutralToGoal[0]!;
          const neutralSolution = findCanonicalSolution(
            neutralSpace,
            neutralToGoal,
          );
          const neutralSolutionCount = countShortestSolutions(
            neutralSpace,
            neutralToGoal,
            neutralShortest,
          );
          const neutralProfile = formatOptionProfile(
            listSolutionOptions(neutralSpace, neutralToGoal, solution),
          );
          relevant =
            neutralShortest !== shortest ||
            neutralSolutionCount !== solutionCount ||
            neutralSolution.join() !== solution.join() ||
            neutralProfile !== profile;
        }
      }
      if (!relevant) {
        return "irrelevant";
      }
      if (((finalMask >>> element) & 1) === 1) {
        return "used";
      }
      if (((decoyPlausible >>> element) & 1) === 1) {
        return "decoy";
      }
      return ((decoyAny >>> element) & 1) === 1 ? "weak-decoy" : "other";
    },
  );

  let nearExtraStateCount = 0;
  let deadStateCount = 0;
  for (let index = 0; index < space.count; index += 1) {
    const remaining = toGoal[index]!;
    if (remaining < 0) {
      deadStateCount += 1;
      continue;
    }
    const total = space.distances[index]! + remaining;
    if (shortest < total && total <= shortest + NEAR_SLACK) {
      nearExtraStateCount += 1;
    }
  }
  const repeats = measureRepeats(space, toGoal, shortest);
  const precedence = measurePrecedence(space, firstChange, shortest);
  const used = findUsedCells(space);
  let unusedCellCount = 0;
  board.cells.forEach((code, cell) => {
    if (
      code !== CELL_ROCK &&
      code !== CELL_OUTSIDE &&
      code !== CELL_BRITTLE &&
      used[cell] === 0
    ) {
      unusedCellCount += 1;
    }
  });
  const brittleCount = countBits(rules.brittleBits);
  return {
    shortest,
    solutionCount,
    stateCount: space.count,
    nearExtraStateCount,
    deadStateCount,
    forcedMoveCount,
    lureCount,
    deadOptionCount,
    useCount,
    changedElementCount: firstChange.size,
    elementCount,
    brittleCount,
    thinCount: elementCount - brittleCount,
    unusedCellCount,
    roles,
    precedenceCount: precedence.strict,
    softPrecedenceCount: precedence.soft,
    orderChain: precedence.chain,
    orderTrapCount,
    orderLureCount,
    solutionRepeatCount: solution.filter(
      (move, index) => index > 0 && solution[index - 1] === move,
    ).length,
    nearRepeatCount: repeats.near,
    brittleChainCount: repeats.chains,
    repeatMoveCount: repeats.moves,
    liveRepeatMoveCount: repeats.live,
    looks: solveStatic(context.looksFree, goal, rules, start),
    other: solveStatic(context.otherFree, goal, rules, start),
    solution,
  };
}
