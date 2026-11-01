import {
  createHitofudePuzzleAdjacency,
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";

/**
 * 人間が道を決めるときの推論の段階。数字が大きいほど深い。
 * - `1` 局所次数: 道の途中のマスは2本、端のマスは1本の辺を使う。残りの通り道が足りるだけしか無いマスは全部使い、
 *   使い切ったマスの残りは使わない。入れる隣が1つだけのマスは終点になる。
 * - `2` 閉路・端点連結禁止: 決まった道片の両端を結んで輪にしない。始点と終点の道片を、全マスを通る前に結ばない。
 * - `3` 分断・到達: 通れる辺だけで盤面がつながらなくなる辺（橋）は必ず使う。関節点で分かれる領域は高々2つで、
 *   端のない側は道が入って出られないので成り立たない。2本の辺だけで残りとつながる領域（2辺カット）は、端も終点候補も
 *   無ければ2本とも使って通り抜け、端が1つなら1本だけ使う。
 * - `4` パリティ: 市松模様の色の数から終点の色を決める。関節点で分かれる領域の色の数が、通り抜けられる数と合うかを見る。
 * - `5` 1段仮置き: 1本の辺を使う・使わないと仮に決め、1〜4を進めた先で矛盾が出たら逆に決める。
 * - `6` 2段仮置き: 5の仮置きの中で、さらに5を重ねて矛盾を探す。
 */
export const hitofudePuzzleReasoningStages = [1, 2, 3, 4, 5, 6] as const;

export type HitofudePuzzleReasoningStage =
  (typeof hitofudePuzzleReasoningStages)[number];

type StageCounts = [number, number, number, number, number, number];

/**
 * - `solved`: 段階1〜6で全マスを通る道が決まった。
 * - `unresolved`: 2段仮置きまで使っても決まらない辺が残った（評価不能）。
 * - `work-limit-reached`: 推論を進めた回数が上限に達した（評価不能）。
 * - `contradiction`: 盤面に解が無い。
 *
 * - `firingCountByStage` / `decidedEdgeCountByStage`: 仮置きの外で、各段階の推論を使った回数と、それで決めた辺の数。添字0が段階1。
 * - `assumptionCount`: 段階1〜4で止まり、1段仮置きで辺を1本決めた回数。
 * - `deepAssumptionCount`: 1段仮置きでも決まらず、2段仮置きで辺を1本決めた回数。
 * - `refutationLengths`: 仮置きで辺を決めた回ごとの、仮置きから矛盾が出るまでの推論の手数。先読みの長さ。
 * - `stallCount`: 段階1〜2だけでは進めなくなった回数。
 * - `firstStallDecidedEdgeRatio` / `firstAssumptionDecidedEdgeRatio`: 最初に段階1〜2で止まった時点と、最初に仮置きへ進んだ
 *   時点で、使う・使わないが決まっていた辺の割合。止まらなかったら1。
 * - `edgeCount`: 道に使える辺（上下左右に隣り合う、穴でないマスの組）の数。
 */
export type HitofudePuzzleHumanSolveTrace = {
  status: "solved" | "unresolved" | "work-limit-reached" | "contradiction";
  firingCountByStage: Readonly<StageCounts>;
  decidedEdgeCountByStage: Readonly<StageCounts>;
  assumptionCount: number;
  deepAssumptionCount: number;
  refutationLengths: readonly number[];
  stallCount: number;
  firstStallDecidedEdgeRatio: number;
  firstAssumptionDecidedEdgeRatio: number;
  edgeCount: number;
};

/**
 * - `workLimit`: 推論を進めた回数（段階1〜4を1つ適用した回数。仮置きの中を含む）の上限。
 *   時間ではなく作業量で打ち切るのは、実行環境の速さで結果が変わらないようにするため。
 */
export type HitofudePuzzleHumanSolveOptions = {
  workLimit?: number;
};

/**
 * 推論を進めた回数の既定の上限。仕切りのあるルールの 8×8 の1,000問では、1回の解き進め・1本の道の反証とも1万回未満で終わる。
 * 上限は人間の能力を測ったものではなく、分析が終わらない盤面を評価不能として扱うためのもの。
 */
const HITOFUDE_PUZZLE_HUMAN_SOLVE_WORK_LIMIT = 200_000;

const UNKNOWN = 0;
const USED = 1;
const UNUSED = -1;

type EdgeState = typeof UNKNOWN | typeof USED | typeof UNUSED;

/** 道の途中のマス・道の端と決まったマス・まだ終点になり得るマス。終点が決まるまで、全マスが終点の候補になる。 */
const MIDDLE = 0;
const END = 1;
const END_CANDIDATE = 2;

type CellRole = typeof MIDDLE | typeof END | typeof END_CANDIDATE;

/** 関節点で分かれる領域の集計。マス数・色0の数・色1の数・端の数・終点候補の数。 */
type RegionSummary = [number, number, number, number, number];

const SIZE = 0;
const COLOR_ZERO = 1;
const ENDS = 3;
const END_CANDIDATES = 4;

/** 単一辺の仮置きで矛盾を探す、推論の手数の上限の段階。短い先読みで見つかる仮置きから使う。 */
const singleAssumptionBudgets = [3, 8, 20, 60] as const;
/** 2段仮置きの外側の仮置きに許す推論の手数と、試す辺の数。 */
const DEEP_ASSUMPTION_BUDGET = 200;
const DEEP_ASSUMPTION_EDGE_COUNT = 24;
/** 2段仮置きの内側で、1段仮置きを重ねる回数と手数の上限の段階。 */
const INNER_ASSUMPTION_ROUNDS = 3;
const innerAssumptionBudgets = [4, 12] as const;
/** 描画視点の反証で、1段仮置きを重ねる回数と手数の上限の段階。 */
const REFUTATION_ASSUMPTION_ROUNDS = 8;
const refutationAssumptionBudgets = [8, 30] as const;

/**
 * 取り除くと盤面が2つに分かれる2本の辺と、始点を含まない側の端・終点候補の数。
 */
type TwoEdgeCut = {
  edges: readonly [number, number];
  endCount: number;
  endCandidateCount: number;
};

/** 2辺カットを探すときの辺。`below` は木の辺の下のマス（部分木の根）で、木でない辺は `null`。 */
type TwoEdgeCutMember = { edge: number; below: number | null };

class ContradictionSignal extends Error {}
class BudgetExceededSignal extends Error {}
class WorkLimitSignal extends Error {}

const contradiction = new ContradictionSignal("contradiction");
const budgetExceeded = new BudgetExceededSignal("budget exceeded");
const workLimitReached = new WorkLimitSignal("work limit reached");

type SolverState = {
  edges: Int8Array;
  usedCounts: Int32Array;
  unknownCounts: Int32Array;
  roles: Uint8Array;
  freeEnd: number;
  usedTotal: number;
  parityApplied: boolean;
};

function copyState(state: SolverState): SolverState {
  return {
    edges: state.edges.slice(),
    usedCounts: state.usedCounts.slice(),
    unknownCounts: state.unknownCounts.slice(),
    roles: state.roles.slice(),
    freeEnd: state.freeEnd,
    usedTotal: state.usedTotal,
    parityApplied: state.parityApplied,
  };
}

function countUnknownEdges(state: SolverState): number {
  let count = 0;
  for (const value of state.edges) {
    if (value === UNKNOWN) {
      count += 1;
    }
  }
  return count;
}

function summarizeCell(
  colors: Uint8Array,
  state: SolverState,
  cell: number,
): RegionSummary {
  const color = colors[cell]!;
  return [
    1,
    1 - color,
    color,
    state.roles[cell] === END ? 1 : 0,
    state.roles[cell] === END_CANDIDATE ? 1 : 0,
  ];
}

/** 推論の手数を数え、上限を超えたら仮置きを打ち切る。 */
class StepTracker {
  readonly budget: number | null;
  steps = 0;
  readonly firings: StageCounts = [0, 0, 0, 0, 0, 0];
  readonly decided: StageCounts = [0, 0, 0, 0, 0, 0];

  constructor(budget: number | null = null) {
    this.budget = budget;
  }

  fire(stage: HitofudePuzzleReasoningStage, decidedEdgeCount: number): void {
    this.steps += 1;
    this.firings[stage - 1] = this.firings[stage - 1]! + 1;
    this.decided[stage - 1] = this.decided[stage - 1]! + decidedEdgeCount;
    if (this.budget !== null && this.steps > this.budget) {
      throw budgetExceeded;
    }
  }
}

/**
 * 辺ごとに「使う・使わない・未定」を決めていく、人間向けの解法器。終点は与えず、始点だけから推論する。
 * 研究用 Python（`scripts/research/hamiltonian_path_experiment.py` の `HumanSolver`）は2辺カットを持たない解法器として
 * 凍結しており、この解法器とは経過が一致しない。
 */
class HumanSolver {
  readonly #cellCount: number;
  readonly #colors: Uint8Array;
  readonly #edgeEnds: (readonly [number, number])[] = [];
  readonly #incidentEdges: number[][];
  readonly #edgeByCells = new Map<number, number>();
  readonly #start: number;
  readonly #cellIdByBoardCell: Map<number, number>;
  readonly #boardCells: readonly number[];
  readonly #workLimit: number;
  #work = 0;

  constructor(board: HitofudePuzzleBoard, workLimit: number) {
    const openCells = listHitofudePuzzleOpenCells(board);
    const adjacency = createHitofudePuzzleAdjacency(board);
    this.#cellIdByBoardCell = new Map(
      openCells.map((cell, index) => [cell, index]),
    );
    this.#boardCells = openCells;
    this.#cellCount = openCells.length;
    this.#colors = Uint8Array.from(openCells, (cell) => {
      const { row, column } = getHitofudePuzzleCellPosition(board.size, cell);
      return (row + column) & 1;
    });
    this.#incidentEdges = openCells.map(() => []);
    for (const cell of openCells) {
      for (const neighbor of adjacency[cell]!) {
        if (cell < neighbor) {
          const left = this.#cellIdByBoardCell.get(cell)!;
          const right = this.#cellIdByBoardCell.get(neighbor)!;
          const edge = this.#edgeEnds.length;
          this.#incidentEdges[left]!.push(edge);
          this.#incidentEdges[right]!.push(edge);
          this.#edgeEnds.push([left, right]);
          this.#edgeByCells.set(left * this.#cellCount + right, edge);
          this.#edgeByCells.set(right * this.#cellCount + left, edge);
        }
      }
    }
    this.#start = this.#cellIdByBoardCell.get(board.start)!;
    this.#workLimit = workLimit;
  }

  get edgeCount(): number {
    return this.#edgeEnds.length;
  }

  resetWork(): void {
    this.#work = 0;
  }

  initialState(): SolverState {
    const roles = new Uint8Array(this.#cellCount).fill(END_CANDIDATE);
    roles[this.#start] = END;
    return {
      edges: new Int8Array(this.#edgeEnds.length),
      usedCounts: new Int32Array(this.#cellCount),
      unknownCounts: Int32Array.from(
        this.#incidentEdges,
        (edges) => edges.length,
      ),
      roles,
      freeEnd: -1,
      usedTotal: 0,
      parityApplied: false,
    };
  }

  isComplete(state: SolverState): boolean {
    return state.usedTotal >= this.#cellCount - 1;
  }

  decidedEdgeRatio(state: SolverState): number {
    return 1 - countUnknownEdges(state) / this.#edgeEnds.length;
  }

  /** 道の順に並べた盤面のマスを、使う辺として置いた状態。 */
  stateWithPath(path: readonly number[]): SolverState {
    const state = this.initialState();
    const cellIds = path.map((cell) => this.#cellIdByBoardCell.get(cell)!);
    for (let index = 1; index < cellIds.length; index += 1) {
      const edge = this.#edgeByCells.get(
        cellIds[index - 1]! * this.#cellCount + cellIds[index]!,
      )!;
      this.setEdge(state, edge, USED);
    }
    return state;
  }

  /** 使う・使わないと決まった辺を、両端の盤面のマスの組（小さい方が先）で挙げる。 */
  listDecidedEdges(
    state: SolverState,
    value: typeof USED | typeof UNUSED,
  ): (readonly [number, number])[] {
    return this.#edgeEnds.flatMap(([left, right], edge) =>
      state.edges[edge] === value
        ? [[this.#boardCells[left]!, this.#boardCells[right]!] as const]
        : [],
    );
  }

  setEdge(state: SolverState, edge: number, value: EdgeState): boolean {
    const current = state.edges[edge]!;
    if (current === value) {
      return false;
    }
    if (current !== UNKNOWN) {
      throw contradiction;
    }
    state.edges[edge] = value;
    for (const cell of this.#edgeEnds[edge]!) {
      state.unknownCounts[cell] = state.unknownCounts[cell]! - 1;
      if (value === USED) {
        state.usedCounts[cell] = state.usedCounts[cell]! + 1;
      }
    }
    if (value === USED) {
      state.usedTotal += 1;
    }
    return true;
  }

  #makeEnd(state: SolverState, cell: number): void {
    if (state.freeEnd !== -1 && state.freeEnd !== cell) {
      throw contradiction;
    }
    state.freeEnd = cell;
    for (let other = 0; other < this.#cellCount; other += 1) {
      if (state.roles[other] === END_CANDIDATE) {
        state.roles[other] = MIDDLE;
      }
    }
    state.roles[cell] = END;
  }

  #setUnknownIncidentEdges(
    state: SolverState,
    cell: number,
    value: EdgeState,
  ): number {
    let decided = 0;
    for (const edge of this.#incidentEdges[cell]!) {
      if (state.edges[edge] === UNKNOWN && this.setEdge(state, edge, value)) {
        decided += 1;
      }
    }
    return decided;
  }

  #applyLocalDegree(state: SolverState, tracker: StepTracker): boolean {
    let progressed = false;
    let changed = true;
    while (changed) {
      changed = false;
      for (let cell = 0; cell < this.#cellCount; cell += 1) {
        const used = state.usedCounts[cell]!;
        const unknown = state.unknownCounts[cell]!;
        // 終点候補が途中のマスと分かっても、このマスの以降の判定は候補のときの次数で行う。
        const role = state.roles[cell]! as CellRole;
        const maximumDegree = role === END ? 1 : 2;
        const minimumDegree = role === MIDDLE ? 2 : 1;
        if (used > maximumDegree || used + unknown < minimumDegree) {
          throw contradiction;
        }
        if (role === END_CANDIDATE && used + unknown === 1) {
          this.#makeEnd(state, cell);
          tracker.fire(1, 0);
          changed = progressed = true;
          continue;
        }
        if (role === END_CANDIDATE && used === 2) {
          state.roles[cell] = MIDDLE;
        }
        if (unknown === 0) {
          continue;
        }
        if (used === maximumDegree) {
          tracker.fire(1, this.#setUnknownIncidentEdges(state, cell, UNUSED));
          changed = progressed = true;
        } else if (role !== END_CANDIDATE && used + unknown === minimumDegree) {
          tracker.fire(1, this.#setUnknownIncidentEdges(state, cell, USED));
          changed = progressed = true;
        }
      }
    }
    return progressed;
  }

  /** 使う辺でつながった道片ごとの代表マス。使う辺が輪になったら矛盾。 */
  #segments(state: SolverState): Int32Array {
    const parents = Int32Array.from(
      { length: this.#cellCount },
      (_, cell) => cell,
    );
    function find(cell: number): number {
      let current = cell;
      while (parents[current] !== current) {
        parents[current] = parents[parents[current]!]!;
        current = parents[current]!;
      }
      return current;
    }
    for (const [edge, [left, right]] of this.#edgeEnds.entries()) {
      if (state.edges[edge] === USED) {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot === rightRoot) {
          throw contradiction;
        }
        parents[leftRoot] = rightRoot;
      }
    }
    return Int32Array.from({ length: this.#cellCount }, (_, cell) =>
      find(cell),
    );
  }

  #listEnds(state: SolverState): number[] {
    const ends: number[] = [];
    for (let cell = 0; cell < this.#cellCount; cell += 1) {
      if (state.roles[cell] === END) {
        ends.push(cell);
      }
    }
    return ends;
  }

  #applyLoopAndEndJoin(state: SolverState, tracker: StepTracker): boolean {
    const segments = this.#segments(state);
    const segmentSizes = new Map<number, number>();
    for (const segment of segments) {
      segmentSizes.set(segment, (segmentSizes.get(segment) ?? 0) + 1);
    }
    const ends = this.#listEnds(state);
    const endSegments = new Set(ends.map((cell) => segments[cell]!));
    if (
      ends.length === 2 &&
      endSegments.size === 1 &&
      segmentSizes.get(segments[ends[0]!]!)! < this.#cellCount
    ) {
      throw contradiction;
    }
    let progressed = false;
    for (const [edge, [left, right]] of this.#edgeEnds.entries()) {
      if (state.edges[edge] !== UNKNOWN) {
        continue;
      }
      const leftSegment = segments[left]!;
      const rightSegment = segments[right]!;
      const closesLoop = leftSegment === rightSegment;
      const joinsEnds =
        ends.length === 2 &&
        endSegments.size === 2 &&
        endSegments.has(leftSegment) &&
        endSegments.has(rightSegment) &&
        leftSegment !== rightSegment &&
        segmentSizes.get(leftSegment)! + segmentSizes.get(rightSegment)! <
          this.#cellCount;
      if (closesLoop || joinsEnds) {
        this.setEdge(state, edge, UNUSED);
        tracker.fire(2, 1);
        progressed = true;
      }
    }
    return progressed;
  }

  /** 全体の色の数から自由な終点の色を決め、色の合わない終点候補を外す。 */
  #applyGlobalParity(state: SolverState): boolean {
    if (state.freeEnd !== -1) {
      return false;
    }
    const startColor = this.#colors[this.#start]!;
    const endColor = this.#cellCount % 2 === 1 ? startColor : 1 - startColor;
    let changed = false;
    for (let cell = 0; cell < this.#cellCount; cell += 1) {
      if (
        state.roles[cell] === END_CANDIDATE &&
        this.#colors[cell] !== endColor
      ) {
        state.roles[cell] = MIDDLE;
        changed = true;
      }
    }
    return changed;
  }

  /** 関節点 `cut` で分かれた領域 `region` に含まれる、決まった端の色。 */
  #endColorIn(state: SolverState, region: RegionSummary, cut: number): number {
    const ends = this.#listEnds(state);
    if (ends.length === 1) {
      return this.#colors[ends[0]!]!;
    }
    const [firstEnd, secondEnd] = ends as [number, number];
    const seen = new Set([cut, firstEnd]);
    const pending = [firstEnd];
    let reachedCount = 0;
    for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
      reachedCount += 1;
      for (const edge of this.#incidentEdges[cell]!) {
        if (state.edges[edge] === UNUSED) {
          continue;
        }
        const [left, right] = this.#edgeEnds[edge]!;
        const neighbor = left === cell ? right : left;
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    return reachedCount === region[SIZE]
      ? this.#colors[firstEnd]!
      : this.#colors[secondEnd]!;
  }

  /** マスごとの、使わないと決まっていない辺でつながる隣のマスとその辺。 */
  #passableNeighbors(state: SolverState): [number, number][][] {
    const passable: [number, number][][] = Array.from(
      { length: this.#cellCount },
      () => [],
    );
    for (const [edge, [left, right]] of this.#edgeEnds.entries()) {
      if (state.edges[edge] !== UNUSED) {
        passable[left]!.push([right, edge]);
        passable[right]!.push([left, edge]);
      }
    }
    return passable;
  }

  #applyRegionAndParity(
    state: SolverState,
    tracker: StepTracker,
    parity: boolean,
  ): boolean {
    if (parity && !state.parityApplied) {
      state.parityApplied = true;
      if (this.#applyGlobalParity(state)) {
        tracker.fire(4, 0);
        return true;
      }
    }
    const cellCount = this.#cellCount;
    const passable = this.#passableNeighbors(state);
    const discovery = new Int32Array(cellCount).fill(-1);
    const low = new Int32Array(cellCount);
    const summaries: RegionSummary[] = [];
    const cuts = new Map<number, RegionSummary[]>();
    const bridges: number[] = [];
    const colors = this.#colors;
    let timer = 0;

    function visit(cell: number, parentEdge: number): void {
      discovery[cell] = low[cell] = timer;
      timer += 1;
      const summary = summarizeCell(colors, state, cell);
      summaries[cell] = summary;
      for (const [neighbor, edge] of passable[cell]!) {
        if (edge === parentEdge) {
          continue;
        }
        if (discovery[neighbor] === -1) {
          visit(neighbor, edge);
          low[cell] = Math.min(low[cell]!, low[neighbor]!);
          const child = summaries[neighbor]!;
          for (let index = 0; index < summary.length; index += 1) {
            summary[index] = summary[index]! + child[index]!;
          }
          if (low[neighbor]! > discovery[cell]!) {
            bridges.push(edge);
          }
          if (low[neighbor]! >= discovery[cell]!) {
            const separated = cuts.get(cell) ?? [];
            separated.push([...child]);
            cuts.set(cell, separated);
          }
        } else {
          low[cell] = Math.min(low[cell]!, discovery[neighbor]!);
        }
      }
    }

    visit(this.#start, -1);
    if (timer !== cellCount) {
      throw contradiction;
    }
    const total = summaries[this.#start]!;
    const regionsByCut = new Map<number, RegionSummary[]>();
    for (const [cell, children] of cuts) {
      const regions = [...children];
      if (cell !== this.#start) {
        const own = summarizeCell(colors, state, cell);
        const rest = total.map(
          (value, index) =>
            value -
            own[index]! -
            children.reduce((sum, child) => sum + child[index]!, 0),
        ) as RegionSummary;
        if (rest[SIZE] > 0) {
          regions.push(rest);
        }
      }
      if (regions.length >= 2) {
        regionsByCut.set(cell, regions);
      }
    }

    let progressed = false;
    for (const edge of bridges) {
      if (state.edges[edge] === UNKNOWN) {
        this.setEdge(state, edge, USED);
        tracker.fire(3, 1);
        progressed = true;
      }
    }
    for (const [cut, regions] of regionsByCut) {
      if (regions.length >= 3 || state.roles[cut] === END) {
        throw contradiction;
      }
      if (
        regions.some(
          (region) => region[ENDS] === 0 && region[END_CANDIDATES] === 0,
        )
      ) {
        throw contradiction;
      }
      if (state.roles[cut] === END_CANDIDATE) {
        state.roles[cut] = MIDDLE;
        tracker.fire(3, 0);
        progressed = true;
      }
      if (parity) {
        this.#checkRegionParity(state, cut, regions);
      }
    }
    return progressed;
  }

  /**
   * 関節点で分かれた領域を道が通り抜けられるか、市松模様の色の数で確かめる。
   * 端を含む領域は端から関節点の隣まで、端を含まない領域は関節点の隣から入って終点まで、色が交互に並ぶ。
   */
  #checkRegionParity(
    state: SolverState,
    cut: number,
    regions: readonly RegionSummary[],
  ): void {
    const cutColor = this.#colors[cut]!;
    for (const region of regions) {
      const size = region[SIZE];
      const colorCounts = [region[COLOR_ZERO], region[COLOR_ZERO + 1]!];
      const longerColor =
        region[ENDS] >= 1 ? this.#endColorIn(state, region, cut) : 1 - cutColor;
      if (
        colorCounts[longerColor] !== Math.floor((size + 1) / 2) ||
        colorCounts[1 - longerColor] !== Math.floor(size / 2)
      ) {
        throw contradiction;
      }
      if (region[ENDS] >= 1) {
        const lastColor = size % 2 === 1 ? longerColor : 1 - longerColor;
        if (lastColor !== 1 - cutColor) {
          throw contradiction;
        }
      }
    }
  }

  /**
   * 2辺カットを、始点を根にした通れる辺の深さ優先の全域木で一度に見つける。木の辺には、その辺の下の部分木から外へ出る
   * 木でない辺の集合を、木でない辺にはその辺だけの集合を付ける。空でない集合が等しい2辺がちょうど2辺カットで、
   * 等しい木の辺どうしは根からの同じ道の上に並ぶ。空の集合の木の辺は橋なので、2辺カットに含めない。
   */
  #findTwoEdgeCuts(state: SolverState): TwoEdgeCut[] {
    const cellCount = this.#cellCount;
    const passable = this.#passableNeighbors(state);
    const discovery = new Int32Array(cellCount).fill(-1);
    const parentEdges = new Int32Array(cellCount).fill(-1);
    const order: number[] = [];

    function visit(cell: number): void {
      discovery[cell] = order.length;
      order.push(cell);
      for (const [neighbor, edge] of passable[cell]!) {
        if (discovery[neighbor] === -1) {
          parentEdges[neighbor] = edge;
          visit(neighbor);
        }
      }
    }

    visit(this.#start);
    if (order.length !== cellCount) {
      throw contradiction;
    }
    const isTreeEdge = new Uint8Array(this.#edgeEnds.length);
    for (const edge of parentEdges) {
      if (edge !== -1) {
        isTreeEdge[edge] = 1;
      }
    }
    const nonTreeEdges = this.#edgeEnds.flatMap((_, edge) =>
      state.edges[edge] !== UNUSED && isTreeEdge[edge] === 0 ? [edge] : [],
    );
    const wordCount = Math.max(1, Math.ceil(nonTreeEdges.length / 32));
    const crossingSets = new Uint32Array(cellCount * wordCount);
    for (const [index, edge] of nonTreeEdges.entries()) {
      for (const cell of this.#edgeEnds[edge]!) {
        const word = cell * wordCount + (index >> 5);
        crossingSets[word] = crossingSets[word]! ^ (1 << (index & 31));
      }
    }
    const endsBelow = Int32Array.from(state.roles, (role) =>
      role === END ? 1 : 0,
    );
    const candidatesBelow = Int32Array.from(state.roles, (role) =>
      role === END_CANDIDATE ? 1 : 0,
    );
    for (const cell of order.toReversed()) {
      const parentEdge = parentEdges[cell]!;
      if (parentEdge === -1) {
        continue;
      }
      const [left, right] = this.#edgeEnds[parentEdge]!;
      const parent = left === cell ? right : left;
      for (let word = 0; word < wordCount; word += 1) {
        const parentWord = parent * wordCount + word;
        crossingSets[parentWord] =
          crossingSets[parentWord]! ^ crossingSets[cell * wordCount + word]!;
      }
      endsBelow[parent] = endsBelow[parent]! + endsBelow[cell]!;
      candidatesBelow[parent] =
        candidatesBelow[parent]! + candidatesBelow[cell]!;
    }

    const groups = new Map<string, TwoEdgeCutMember[]>();
    function addMember(key: string, member: TwoEdgeCutMember): void {
      const members = groups.get(key) ?? [];
      members.push(member);
      groups.set(key, members);
    }
    for (const cell of order) {
      const edge = parentEdges[cell]!;
      const crossingSet = crossingSets.subarray(
        cell * wordCount,
        (cell + 1) * wordCount,
      );
      if (edge !== -1 && crossingSet.some((word) => word !== 0)) {
        addMember(crossingSet.join(","), { edge, below: cell });
      }
    }
    for (const [index, edge] of nonTreeEdges.entries()) {
      const crossingSet = new Uint32Array(wordCount);
      crossingSet[index >> 5] = 1 << (index & 31);
      addMember(crossingSet.join(","), { edge, below: null });
    }

    const cuts: TwoEdgeCut[] = [];
    for (const members of groups.values()) {
      // 木の辺を根に近い順に並べ、木でない辺（高々1本）を最後に置く。
      members.sort(
        (left, right) =>
          (left.below === null ? cellCount : discovery[left.below]!) -
          (right.below === null ? cellCount : discovery[right.below]!),
      );
      for (const [index, upper] of members.entries()) {
        for (const lower of members.slice(index + 1)) {
          const inside = upper.below!;
          const excluded = lower.below;
          cuts.push({
            edges: [upper.edge, lower.edge],
            endCount:
              endsBelow[inside]! -
              (excluded === null ? 0 : endsBelow[excluded]!),
            endCandidateCount:
              candidatesBelow[inside]! -
              (excluded === null ? 0 : candidatesBelow[excluded]!),
          });
        }
      }
    }
    return cuts;
  }

  /**
   * 2辺カットの、始点を含まない側の領域を道が何回出入りするかを、その領域の端の数から決める。道は全マスを通るので、
   * 端の無い領域には入って出る（2本とも使う）。端が1つの領域には入って終わる（1本だけ使う）。
   * 終点候補が残る領域は、端の数が決まらないので決めない。
   */
  #applyTwoEdgeCuts(state: SolverState, tracker: StepTracker): boolean {
    let progressed = false;
    for (const { edges, endCount, endCandidateCount } of this.#findTwoEdgeCuts(
      state,
    )) {
      if (endCandidateCount > 0) {
        continue;
      }
      const [first, second] = edges;
      if (endCount === 0) {
        const decided =
          Number(this.setEdge(state, first, USED)) +
          Number(this.setEdge(state, second, USED));
        if (decided > 0) {
          tracker.fire(3, decided);
          progressed = true;
        }
        continue;
      }
      const unusedEdge =
        state.edges[first] === USED
          ? second
          : state.edges[second] === USED
            ? first
            : null;
      if (unusedEdge !== null && this.setEdge(state, unusedEdge, UNUSED)) {
        tracker.fire(3, 1);
        progressed = true;
      }
    }
    return progressed;
  }

  propagate(
    state: SolverState,
    tracker: StepTracker,
    highestStage: 2 | 3 | 4 = 4,
  ): void {
    while (!this.isComplete(state)) {
      this.#work += 1;
      if (this.#work > this.#workLimit) {
        throw workLimitReached;
      }
      if (this.#applyLocalDegree(state, tracker)) {
        continue;
      }
      if (this.#applyLoopAndEndJoin(state, tracker)) {
        continue;
      }
      if (
        highestStage >= 3 &&
        (this.#applyRegionAndParity(state, tracker, highestStage >= 4) ||
          this.#applyTwoEdgeCuts(state, tracker))
      ) {
        continue;
      }
      return;
    }
    for (let edge = 0; edge < this.#edgeEnds.length; edge += 1) {
      if (state.edges[edge] === UNKNOWN) {
        this.setEdge(state, edge, UNUSED);
      }
    }
    this.#segments(state);
    for (let cell = 0; cell < this.#cellCount; cell += 1) {
      const role = state.roles[cell];
      const used = state.usedCounts[cell]!;
      const expected =
        role === END || (role === END_CANDIDATE && used === 1) ? 1 : 2;
      if (used !== expected) {
        throw contradiction;
      }
    }
  }

  /**
   * 未定の辺を、両端のマスの未定の辺が少ない順（同じなら辺の番号順）に並べる。辺の番号はマスの番号から決まるので、
   * 同じ盤面でも向きによって仮置きの結果が変わる。難易度の分析は8通りの向きで読み比べる（`analyzeHitofudePuzzleDifficulty`）。
   */
  #assumptionCandidates(state: SolverState): number[] {
    const candidates: [number, number][] = [];
    for (const [edge, [left, right]] of this.#edgeEnds.entries()) {
      if (state.edges[edge] === UNKNOWN) {
        candidates.push([
          Math.min(state.unknownCounts[left]!, state.unknownCounts[right]!),
          edge,
        ]);
      }
    }
    return candidates
      .sort((left, right) => left[0] - right[0] || left[1] - right[1])
      .map(([, edge]) => edge);
  }

  /** 仮置きして矛盾すれば、矛盾までの推論の手数を返す。手数の上限に達するか矛盾しなければ `null`。 */
  #tryAssumption(
    state: SolverState,
    edge: number,
    value: EdgeState,
    budget: number,
    nested: boolean,
  ): number | null {
    const assumed = copyState(state);
    const tracker = new StepTracker(budget);
    try {
      this.setEdge(assumed, edge, value);
      this.propagate(assumed, tracker);
      if (nested) {
        for (let round = 0; round < INNER_ASSUMPTION_ROUNDS; round += 1) {
          if (this.isComplete(assumed)) {
            break;
          }
          if (
            this.singleAssumption(
              assumed,
              new StepTracker(),
              innerAssumptionBudgets,
            ) === null
          ) {
            break;
          }
          this.propagate(assumed, tracker);
        }
      }
    } catch (error) {
      if (error === contradiction) {
        return tracker.steps;
      }
      if (error === budgetExceeded) {
        return null;
      }
      throw error;
    }
    return null;
  }

  /** 1段仮置きで辺を1本決める。決めたら矛盾までの手数を返し、決まらなければ `null`。 */
  singleAssumption(
    state: SolverState,
    tracker: StepTracker,
    budgets: readonly number[] = singleAssumptionBudgets,
  ): number | null {
    const candidates = this.#assumptionCandidates(state);
    for (const budget of budgets) {
      for (const edge of candidates) {
        for (const value of [USED, UNUSED] as const) {
          const length = this.#tryAssumption(state, edge, value, budget, false);
          if (length !== null) {
            this.setEdge(state, edge, value === USED ? UNUSED : USED);
            tracker.fire(5, 1);
            return length;
          }
        }
      }
    }
    return null;
  }

  /** 2段仮置きで辺を1本決める。決めたら矛盾までの手数を返し、決まらなければ `null`。 */
  deepAssumption(state: SolverState, tracker: StepTracker): number | null {
    const candidates = this.#assumptionCandidates(state).slice(
      0,
      DEEP_ASSUMPTION_EDGE_COUNT,
    );
    for (const edge of candidates) {
      for (const value of [USED, UNUSED] as const) {
        const length = this.#tryAssumption(
          state,
          edge,
          value,
          DEEP_ASSUMPTION_BUDGET,
          true,
        );
        if (length !== null) {
          this.setEdge(state, edge, value === USED ? UNUSED : USED);
          tracker.fire(6, 1);
          return length;
        }
      }
    }
    return null;
  }
}

function isSignal(error: unknown): boolean {
  return error === contradiction || error === workLimitReached;
}

/**
 * 始点と盤面だけから（解を見ずに）、段階1〜6の推論で道を決めていく経過を追う。
 * 段階1〜2で止まるたびに段階3〜4を加え、それでも進まなければ1段仮置き、さらに2段仮置きを使う。
 */
export function traceHitofudePuzzleHumanSolve(
  board: HitofudePuzzleBoard,
  options: HitofudePuzzleHumanSolveOptions = {},
): HitofudePuzzleHumanSolveTrace {
  const solver = new HumanSolver(
    board,
    options.workLimit ?? HITOFUDE_PUZZLE_HUMAN_SOLVE_WORK_LIMIT,
  );
  const state = solver.initialState();
  const tracker = new StepTracker();
  let assumptionCount = 0;
  let deepAssumptionCount = 0;
  let stallCount = 0;
  const refutationLengths: number[] = [];
  let firstStallDecidedEdgeRatio: number | null = null;
  let firstAssumptionDecidedEdgeRatio: number | null = null;
  let status: HitofudePuzzleHumanSolveTrace["status"] = "unresolved";

  try {
    for (;;) {
      solver.propagate(state, tracker, 2);
      if (solver.isComplete(state)) {
        break;
      }
      stallCount += 1;
      firstStallDecidedEdgeRatio ??= solver.decidedEdgeRatio(state);
      const usedBefore = state.usedTotal;
      const unknownBefore = countUnknownEdges(state);
      solver.propagate(state, tracker, 4);
      if (solver.isComplete(state)) {
        break;
      }
      if (
        state.usedTotal !== usedBefore ||
        countUnknownEdges(state) !== unknownBefore
      ) {
        continue;
      }
      firstAssumptionDecidedEdgeRatio ??= solver.decidedEdgeRatio(state);
      const singleLength = solver.singleAssumption(state, tracker);
      if (singleLength !== null) {
        assumptionCount += 1;
        refutationLengths.push(singleLength);
        continue;
      }
      const deepLength = solver.deepAssumption(state, tracker);
      if (deepLength === null) {
        break;
      }
      deepAssumptionCount += 1;
      refutationLengths.push(deepLength);
    }
    if (solver.isComplete(state)) {
      status = "solved";
    }
  } catch (error) {
    if (!isSignal(error)) {
      throw error;
    }
    status = error === contradiction ? "contradiction" : "work-limit-reached";
  }

  return {
    status,
    firingCountByStage: tracker.firings,
    decidedEdgeCountByStage: tracker.decided,
    assumptionCount,
    deepAssumptionCount,
    refutationLengths,
    stallCount,
    firstStallDecidedEdgeRatio: firstStallDecidedEdgeRatio ?? 1,
    firstAssumptionDecidedEdgeRatio: firstAssumptionDecidedEdgeRatio ?? 1,
    edgeCount: solver.edgeCount,
  };
}

/** 道がもう全マスを通れないと示すのに要った推論の段階。1段仮置きを重ねて示せたら `5`。 */
export type HitofudePuzzleRefutationStage = 2 | 3 | 4 | 5;

/**
 * - `findRefutationStage`: 始点から引いた道 `path` がもう全マスを通れないと示せる最も浅い段階。段階2〜4の推論、
 *   1段仮置きの重ね合わせの順に試し、示せなければ `null`。描画視点の分析で、誤った手を退けるのに要る段階として使う。
 */
export type HitofudePuzzleRefuter = {
  findRefutationStage(
    path: readonly number[],
  ): HitofudePuzzleRefutationStage | null | "work-limit-reached";
};

/** 同じ盤面で何本もの道を反証するための準備をしておく。 */
export function createHitofudePuzzleRefuter(
  board: HitofudePuzzleBoard,
  options: HitofudePuzzleHumanSolveOptions = {},
): HitofudePuzzleRefuter {
  const solver = new HumanSolver(
    board,
    options.workLimit ?? HITOFUDE_PUZZLE_HUMAN_SOLVE_WORK_LIMIT,
  );

  function refutesWithin(base: SolverState, highestStage: 2 | 3 | 4): boolean {
    try {
      solver.propagate(copyState(base), new StepTracker(), highestStage);
    } catch (error) {
      if (error === contradiction) {
        return true;
      }
      throw error;
    }
    return false;
  }

  function refutesWithAssumptions(base: SolverState): boolean {
    const state = copyState(base);
    try {
      solver.propagate(state, new StepTracker());
      for (let round = 0; round < REFUTATION_ASSUMPTION_ROUNDS; round += 1) {
        if (
          solver.isComplete(state) ||
          solver.singleAssumption(
            state,
            new StepTracker(),
            refutationAssumptionBudgets,
          ) === null
        ) {
          break;
        }
        solver.propagate(state, new StepTracker());
      }
    } catch (error) {
      if (error === contradiction) {
        return true;
      }
      throw error;
    }
    return false;
  }

  return {
    findRefutationStage(path) {
      solver.resetWork();
      const base = solver.stateWithPath(path);
      try {
        for (const stage of [2, 3, 4] as const) {
          if (refutesWithin(base, stage)) {
            return stage;
          }
        }
        return refutesWithAssumptions(base) ? 5 : null;
      } catch (error) {
        if (error === workLimitReached) {
          return "work-limit-reached";
        }
        throw error;
      }
    },
  };
}

/**
 * 盤面に始点から道 `path` を引いた状態から、段階 `highestStage` までの推論（仮置き無し）を進め、使う・使わないと決まった辺を
 * 返す。矛盾したら `null`。推論ごとの導き方を小さな盤面で確かめるために使う。
 */
function deduceHitofudePuzzleEdges(
  board: HitofudePuzzleBoard,
  path: readonly number[],
  highestStage: 2 | 3 | 4,
): {
  used: (readonly [number, number])[];
  unused: (readonly [number, number])[];
} | null {
  const solver = new HumanSolver(board, HITOFUDE_PUZZLE_HUMAN_SOLVE_WORK_LIMIT);
  const state = solver.stateWithPath(path);
  try {
    solver.propagate(state, new StepTracker(), highestStage);
  } catch (error) {
    if (error === contradiction) {
      return null;
    }
    throw error;
  }
  return {
    used: solver.listDecidedEdges(state, USED),
    unused: solver.listDecidedEdges(state, UNUSED),
  };
}

export const _private = { deduceHitofudePuzzleEdges };
