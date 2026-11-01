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
  measureLongestStair,
  type StateSpace,
  withGoal,
} from "@/games/ice-floor-maze/problem/generation/state-space";

/**
 * もろい岩・薄い氷のある盤面の特徴量（研究用の生成 v4 `ice_floor_hardest_generation_experiment.py` の `measure`）。
 * 氷と岩だけの盤面にも当てられる（要素が無いだけ）。
 */

/** 最短+この手数以内の道筋を「近い道筋」とみなす。 */
const NEAR_SLACK = 2;
/** 見た目どおりの読みの解が元の規則でも通るとき、元の規則での手数が最短よりこれ以上長ければ大きな遠回り。 */
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
 * - `misleading`: その盤面の最短+`NEAR_SLACK` 手以内のどの解も、元の規則では通らない。
 * - `detour`: 通る解はあるが、元の規則での手数が大きな遠回り。
 * - `shortcut`: 通り、遠回りでもない（静的な近道）。
 */
export type LooksReading = "unsolvable" | "misleading" | "detour" | "shortcut";

/**
 * 要素を変化しないマスに置き換えた盤面（静的な盤面）の解を、元の規則で試した結果。
 * - `shortest`: 静的な盤面の最少手数。`null` なら解なし。
 * - `passingMoveCount`: 静的な盤面の最短+`NEAR_SLACK` 手以内の解（同じ停止点を二度通らない）を元の規則で入力したとき、
 *   ゴールで止まるものの元の規則での最少手数。途中でゴールに止まればそこで数え、動かない入力は数えない。通るものが無ければ `null`。
 */
export type StaticSolution = {
  shortest: number | null;
  passingMoveCount: number | null;
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
  moves: readonly SolutionMove[];
  lingeringDecoyCount: number;
  rockShare: number;
};

/**
 * 最短解の1手で、それより前の自分の手が作った地形を使うこと。
 * - `water`: 割れてできた水面で止まる。
 * - `opening`: 崩れて空いたマスを通る・そこで止まる。
 * - `madeAt` / `gap`: 地形を作った手の番号（0始まり）と、作った手から使う手までの手数。
 */
export type SelfMadeTerrainUse = {
  cell: number;
  kind: "water" | "opening";
  madeAt: number;
  gap: number;
};

/**
 * 最短解の1手の様子。
 * - `slideLength`: 滑ったマスの数。
 * - `changedCells`: この手の後で崩れる・割れるマス。
 * - `selfMadeUses`: 前の自分の手が作った地形を使うこと。
 * - `useEventCount`: 要素を使う出来事（崩す・崩れた跡を通る・水面で止まる）の数。
 * - `freshAlternativeCount` / `temptingAlternativeCount`: 解の手のほかに、まだ訪れていない状態へ移る手の数と、
 *   そのうちもっともらしい手の数。前者が0の手が一本道。
 * - `lure` / `orderTrap`: もっともらしいが詰みか遠回りになる手がある / 後で使う要素を先に変化させて詰みか遠回りになる手がある。
 */
export type SolutionMove = {
  direction: number;
  from: number;
  to: number;
  slideLength: number;
  changedCells: readonly number[];
  selfMadeUses: readonly SelfMadeTerrainUse[];
  useEventCount: number;
  freshAlternativeCount: number;
  temptingAlternativeCount: number;
  lure: boolean;
  orderTrap: boolean;
};

/**
 * 最短解の手触りの集計。
 * - `shortSlideCount` / `averageSlideLength`: 1マスだけの滑りの数と、滑りの長さの平均。
 * - `longestStair`: 直交する2つの向きを交互に続けた手の最も長い連なり（階段）。
 * - `longestChoicelessStair`: 階段のうち、どの手にももっともらしい別の手が無い連なり。
 * - `longestIdleRun`: 要素を変えず使わず、誘い（もっともらしいが詰みか遠回りになる手）も無い手の最も長い連なり（読みどころの無い区間）。
 * - `selfMadeUseCount` / `selfMadeMaximumGap` / `selfMadeTotalGap`: 自分で作った地形を使う回数と、作ってから使うまでの手数の最大・合計。
 * - `quickReturnCount`: 薄い氷を割った直後の手で、その水面へ戻って止まる回数（割ってすぐ戻る手筋）。
 * - `variedUseCount`: 自分で作った地形を使ううち、割ってすぐ戻る手筋でないもの（遠くから水面で止まる・崩れた跡を通るなど）。
 * - `changedCellCount` / `maximumChangedPerMove` / `maximumChangeSpread`: 変わるマスの数の合計、1手の最大、1手で変わるマスどうしの
 *   マンハッタン距離の最大。
 * - `changedAreaSpan`: 解の全体で変わるマスを囲む長方形の幅と高さの和（マス数−1ずつ）。変わるマスが無ければ0。
 */
export type SolutionTexture = {
  shortSlideCount: number;
  averageSlideLength: number;
  longestStair: number;
  longestChoicelessStair: number;
  longestIdleRun: number;
  selfMadeUseCount: number;
  selfMadeMaximumGap: number;
  selfMadeTotalGap: number;
  quickReturnCount: number;
  variedUseCount: number;
  changedCellCount: number;
  maximumChangedPerMove: number;
  maximumChangeSpread: number;
  changedAreaSpan: number;
};

export function countRoles(metrics: ElementMetrics, role: ElementRole): number {
  return metrics.roles.filter((value) => value === role).length;
}

export function classifyLooksReading(metrics: ElementMetrics): LooksReading {
  const { looks } = metrics;
  if (looks.shortest === null) {
    return "unsolvable";
  }
  if (looks.passingMoveCount === null) {
    return "misleading";
  }
  return looks.passingMoveCount >= metrics.shortest + DETOUR
    ? "detour"
    : "shortcut";
}

/** 見た目どおり、またはもう一方（もろい岩→氷、薄い氷→岩）の盤面の解が元の規則でも短く通る。 */
export function hasStaticShortcut(metrics: ElementMetrics): boolean {
  const { other } = metrics;
  return (
    classifyLooksReading(metrics) === "shortcut" ||
    (other.passingMoveCount !== null &&
      other.passingMoveCount <= metrics.shortest + NEAR_SLACK)
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

/** 1手の滑りで、それより前の手が作った水面で止まること・崩れた跡を通ることを並べる。 */
function listSelfMadeUses(
  rules: ElementRules,
  position: number,
  end: number,
  mask: number,
  direction: number,
  firstChange: ReadonlyMap<number, number>,
  step: number,
): SelfMadeTerrainUse[] {
  const { elementOf, kinds } = rules;
  const uses: SelfMadeTerrainUse[] = [];
  function add(cell: number, kind: SelfMadeTerrainUse["kind"]): void {
    const madeAt = firstChange.get(elementOf[cell]!)!;
    uses.push({ cell, kind, madeAt, gap: step - madeAt });
  }
  const delta = rules.delta[direction]!;
  for (let cell = position + delta; ; cell += delta) {
    const element = elementOf[cell]!;
    if (
      element >= 0 &&
      kinds[element] === CELL_BRITTLE &&
      ((mask >>> element) & 1) === 1
    ) {
      add(cell, "opening");
    }
    if (cell === end) {
      break;
    }
  }
  const hit = rules.beyond[direction]![end]!;
  const hitElement = hit >= 0 ? elementOf[hit]! : -1;
  if (
    hitElement >= 0 &&
    kinds[hitElement] === CELL_THIN &&
    ((mask >>> hitElement) & 1) === 1
  ) {
    add(hit, "water");
  }
  return uses;
}

function listChangedCells(rules: ElementRules, changed: number): number[] {
  return Array.from(rules.elements).filter(
    (_, element) => ((changed >>> element) & 1) === 1,
  );
}

function describeMove(
  space: StateSpace,
  source: number,
  target: number,
  direction: number,
  firstChange: ReadonlyMap<number, number>,
  step: number,
  choices: Pick<
    SolutionMove,
    "freshAlternativeCount" | "temptingAlternativeCount" | "lure" | "orderTrap"
  >,
): SolutionMove {
  const { rules, positions, masks } = space;
  const from = positions[source]!;
  const to = positions[target]!;
  const mask = masks[source]!;
  return {
    direction,
    from,
    to,
    slideLength:
      Math.abs((to % rules.width) - (from % rules.width)) +
      Math.abs(Math.floor(to / rules.width) - Math.floor(from / rules.width)),
    changedCells: listChangedCells(rules, masks[target]! & ~mask),
    selfMadeUses: listSelfMadeUses(
      rules,
      from,
      to,
      mask,
      direction,
      firstChange,
      step,
    ),
    useEventCount: countUseEvents(rules, from, to, mask, direction),
    ...choices,
  };
}

/**
 * 詰みの状態で、要素を変えない滑りだけで行けるどの状態からも、要素を変えない滑りでその状態へ戻れるか（閉じ込め。
 * `puzzle/deadlock.ts` の `trapped` を状態のグラフで求めたもの）。
 */
function isConfined(space: StateSpace, state: number): boolean {
  const { masks } = space;
  const mask = masks[state]!;
  const reached = [state];
  const indexOf = new Map([[state, 0]]);
  const predecessors: number[][] = [[]];
  for (let index = 0; index < reached.length; index += 1) {
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = getTarget(space, reached[index]!, direction);
      if (target < 0 || masks[target] !== mask) {
        continue;
      }
      let targetIndex = indexOf.get(target);
      if (targetIndex === undefined) {
        targetIndex = reached.length;
        indexOf.set(target, targetIndex);
        reached.push(target);
        predecessors.push([]);
      }
      predecessors[targetIndex]!.push(index);
    }
  }
  const returnable = new Uint8Array(reached.length);
  returnable[0] = 1;
  const pending = [0];
  let returnableCount = 1;
  while (pending.length > 0) {
    for (const predecessor of predecessors[pending.pop()!]!) {
      if (returnable[predecessor] === 0) {
        returnable[predecessor] = 1;
        returnableCount += 1;
        pending.push(predecessor);
      }
    }
  }
  return returnableCount === reached.length;
}

/** 盤面として描くマス（駒が通るか止まるマスと、それに接する岩・もろい岩）のうち、岩の割合。 */
function measureRockShare(
  board: GenerationBoard,
  rules: ElementRules,
  used: Uint8Array,
): number {
  let drawn = 0;
  let rocks = 0;
  board.cells.forEach((code, cell) => {
    const isStopper = code === CELL_ROCK || code === CELL_BRITTLE;
    if (
      used[cell] === 1 ||
      (isStopper && rules.beyond.some((table) => used[table[cell]!] === 1))
    ) {
      drawn += 1;
      if (code === CELL_ROCK) {
        rocks += 1;
      }
    }
  });
  return drawn === 0 ? 0 : rocks / drawn;
}

function measureLongestRun(
  moves: readonly SolutionMove[],
  included: (move: SolutionMove) => boolean,
): number {
  let longest = 0;
  let length = 0;
  for (const move of moves) {
    length = included(move) ? length + 1 : 0;
    longest = Math.max(longest, length);
  }
  return longest;
}

function measureSpread(cells: readonly number[], width: number): number {
  let spread = 0;
  cells.forEach((left, index) => {
    for (const right of cells.slice(index + 1)) {
      spread = Math.max(
        spread,
        Math.abs((left % width) - (right % width)) +
          Math.abs(Math.floor(left / width) - Math.floor(right / width)),
      );
    }
  });
  return spread;
}

function isQuickReturn(use: SelfMadeTerrainUse): boolean {
  return use.kind === "water" && use.gap === 1;
}

/** 最短解の手の様子を集計する。`width` は盤面の幅。 */
export function summarizeSolutionMoves(
  moves: readonly SolutionMove[],
  width: number,
): SolutionTexture {
  const selfMadeUses = moves.flatMap((move) => move.selfMadeUses);
  const changedCells = moves.flatMap((move) => move.changedCells);
  const xs = changedCells.map((cell) => cell % width);
  const ys = changedCells.map((cell) => Math.floor(cell / width));
  const quickReturnCount = selfMadeUses.filter(isQuickReturn).length;
  const directions = moves.map((move) => move.direction);
  return {
    shortSlideCount: moves.filter((move) => move.slideLength === 1).length,
    averageSlideLength:
      moves.reduce((sum, move) => sum + move.slideLength, 0) /
      Math.max(1, moves.length),
    longestStair: measureLongestStair(
      directions,
      moves.map(() => true),
    ),
    longestChoicelessStair: measureLongestStair(
      directions,
      moves.map((move) => move.temptingAlternativeCount === 0),
    ),
    longestIdleRun: measureLongestRun(
      moves,
      (move) =>
        move.changedCells.length === 0 &&
        move.useEventCount === 0 &&
        !move.lure &&
        !move.orderTrap,
    ),
    selfMadeUseCount: selfMadeUses.length,
    selfMadeMaximumGap: Math.max(0, ...selfMadeUses.map((use) => use.gap)),
    selfMadeTotalGap: selfMadeUses.reduce((sum, use) => sum + use.gap, 0),
    quickReturnCount,
    variedUseCount: selfMadeUses.length - quickReturnCount,
    changedCellCount: changedCells.length,
    maximumChangedPerMove: Math.max(
      0,
      ...moves.map((move) => move.changedCells.length),
    ),
    maximumChangeSpread: Math.max(
      0,
      ...moves.map((move) => measureSpread(move.changedCells, width)),
    ),
    changedAreaSpan:
      changedCells.length === 0
        ? 0
        : Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys),
  };
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

/**
 * 静的な盤面の近い解（最短+`NEAR_SLACK` 手以内）を、元の規則で入力して試す。静的な盤面の状態と元の規則の状態の組を
 * 手数の層ごとにたどり、組ごとに元の規則での最少手数を持つ。近い解は、すぐ前の停止点へ戻る手を除けば同じ停止点を二度通らない
 * （二度通る解は最短より3手以上長い）。
 */
function solveStatic(
  free: StateSpace | null,
  goal: number,
  space: StateSpace,
): StaticSolution {
  if (!free) {
    return { shortest: null, passingMoveCount: null };
  }
  const statics = withGoal(free, goal);
  const staticToGoal = measureDistancesToGoal(statics);
  const shortest = staticToGoal[0]!;
  if (shortest < 0) {
    return { shortest: null, passingMoveCount: null };
  }
  const budget = shortest + NEAR_SLACK;
  const staticCount = statics.count;
  const realCount = space.count;
  function encode(previous: number, current: number, real: number): number {
    return ((previous + 1) * staticCount + current) * realCount + real;
  }
  let passingMoveCount: number | null = null;
  let frontier = new Map([[encode(-1, 0, 0), 0]]);
  for (let step = 1; step <= budget && frontier.size > 0; step += 1) {
    const next = new Map<number, number>();
    for (const [key, moveCount] of frontier) {
      const real = key % realCount;
      const pair = (key - real) / realCount;
      const current = pair % staticCount;
      const previous = (pair - current) / staticCount - 1;
      for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
        const staticTarget = getTarget(statics, current, direction);
        if (staticTarget < 0 || staticTarget === previous) {
          continue;
        }
        const left = staticToGoal[staticTarget]!;
        if (left < 0 || step + left > budget) {
          continue;
        }
        const realTarget = getTarget(space, real, direction);
        const moved = realTarget >= 0;
        const count = moved ? moveCount + 1 : moveCount;
        if (moved && space.positions[realTarget] === goal) {
          passingMoveCount = Math.min(passingMoveCount ?? count, count);
          continue;
        }
        if (left === 0) {
          continue;
        }
        const nextKey = encode(
          current,
          staticTarget,
          moved ? realTarget : real,
        );
        const known = next.get(nextKey);
        if (known === undefined || count < known) {
          next.set(nextKey, count);
        }
      }
    }
    frontier = next;
  }
  return { shortest, passingMoveCount };
}

/**
 * `goal` の問題の特徴量。`space` は `goal` で止まった状態を終わりにした状態のグラフ。解けなければ `null`。
 */
export function measureElementMetrics(
  context: ElementContext,
  goal: number,
  space: StateSpace = withGoal(context.free!, goal),
): ElementMetrics | null {
  const { rules, board } = context;
  const elementCount = rules.elements.length;
  const { masks } = space;
  const toGoal = measureDistancesToGoal(space);
  if (toGoal[0]! < 0) {
    return null;
  }
  const shortest = toGoal[0]!;
  const solution = findCanonicalSolution(space, toGoal);
  const solutionCount = countShortestSolutions(space, toGoal, shortest);
  const steps = listSolutionOptions(space, toGoal, solution)!;

  const firstChange = new Map<number, number>();
  let state = 0;
  solution.forEach((move, step) => {
    const target = getTarget(space, state, move);
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
  let decoyLingering = 0;
  const moves: SolutionMove[] = steps.map(
    ({ state: source, options }, step) => {
      const move = solution[step]!;
      const fresh = options.filter(
        (option) => option.direction !== move && !visited.has(option.target),
      );
      if (fresh.length === 0) {
        forcedMoveCount += 1;
      }
      let lure = false;
      let orderTrap = false;
      for (const option of options) {
        if (option.direction === move) {
          continue;
        }
        const bad = option.kind > 0;
        if (bad && option.plausible) {
          lureCount += 1;
          lure = true;
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
          orderTrap = true;
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
            if (branch.kind !== 2 || !isConfined(space, branch.target)) {
              decoyLingering |= changed;
            }
          }
        }
      }
      const target = getTarget(space, source, move);
      visited.add(target);
      return describeMove(space, source, target, move, firstChange, step, {
        freshAlternativeCount: fresh.length,
        temptingAlternativeCount: fresh.filter((option) => option.plausible)
          .length,
        lure,
        orderTrap,
      });
    },
  );
  const useCount = moves.reduce((sum, item) => sum + item.useEventCount, 0);

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
    looks: solveStatic(context.looksFree, goal, space),
    other: solveStatic(context.otherFree, goal, space),
    solution,
    moves,
    lingeringDecoyCount: roles.filter(
      (role, element) =>
        role === "decoy" && ((decoyLingering >>> element) & 1) === 1,
    ).length,
    rockShare: measureRockShare(board, rules, used),
  };
}
