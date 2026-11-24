import { writeFileSync } from "node:fs";
import { countMagicSquareSolutions } from "@/games/magic-square/problem/generation/solver";
import {
  listMagicSquarePoolEntries,
  restoreMagicSquarePoolEntry,
} from "@/games/magic-square/problem/problem-pool";
import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  listMagicSquareLines,
  listMagicSquareLinesThroughCell,
} from "@/games/magic-square/puzzle/board";
import { evaluateMagicSquareLine } from "@/games/magic-square/puzzle/rules";
import { calculateMagicSquarePlayScore } from "@/games/magic-square/score";
import {
  createMagicSquareSession,
  enterMagicSquareSessionValue,
  getMagicSquareSessionCorrectionCount,
  type MagicSquareSession,
  restartMagicSquareSession,
  selectMagicSquareSessionCell,
  undoMagicSquareSession,
} from "@/games/magic-square/session/session";
import {
  createProblemSeededRandom,
  type ProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";

type Cells = readonly (number | null)[];
type Rule = "E" | "B" | "N";
const rules: Rule[] = ["E", "B", "N"];

const padColumns: Record<number, number> = { 4: 8, 5: 7, 6: 8 };
function isPadNeighbor(size: number, a: number, b: number): boolean {
  const columns = padColumns[size]!;
  const [ra, ca] = [Math.floor((a - 1) / columns), (a - 1) % columns];
  const [rb, cb] = [Math.floor((b - 1) / columns), (b - 1) % columns];
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

function hasFeedback(size: number, cells: Cells, cellIndex: number): boolean {
  const value = cells[cellIndex];
  if (value === null || value === undefined) return false;
  const board = { size, cells };
  const magicSum = getMagicSquareMagicSum(size);
  return listMagicSquareLinesThroughCell(size, cellIndex).some((line) => {
    const { emptyCount, sum } = evaluateMagicSquareLine(board, line);
    return emptyCount === 0 || (sum >= magicSum && sum - value < magicSum);
  });
}

type Tracked = {
  cell: number;
  before: number | null;
  departures: { value: number; to: number | null; feedback: boolean }[];
  current: number | null;
  feedbackOf: Map<number, boolean>;
};

/** 本番の session を操作しながら、規則ごとの取り下げを数える。 */
class Recorder {
  session: MagicSquareSession;
  size: number;
  tracked: Tracked | null = null;
  counts: Record<Rule, number> = { E: 0, B: 0, N: 0 };
  presses = 0;
  constructor(session: MagicSquareSession) {
    this.session = session;
    this.size = session.problem.givens.size;
  }
  private close() {
    const t = this.tracked;
    if (!t) return;
    this.tracked = null;
    const final = t.current;
    const a = t.before !== null && final !== t.before ? 1 : 0;
    const feedbackDepartures = new Map<number, { to: number | null }>();
    for (const d of t.departures) {
      if (d.value === t.before || d.value === final || !d.feedback) continue;
      if (!feedbackDepartures.has(d.value))
        feedbackDepartures.set(d.value, { to: d.to });
    }
    const fb = feedbackDepartures.size;
    this.counts.B += a + fb;
    let e = 0;
    let first = true;
    for (const [value, { to }] of feedbackDepartures) {
      const free = first && to !== null && isPadNeighbor(this.size, value, to);
      first = false;
      if (!free) e += 1;
    }
    this.counts.E += a + e;
  }
  private change(cell: number, next: MagicSquareSession) {
    const before = this.session.puzzleState.cells[cell] ?? null;
    if (this.tracked && this.tracked.cell !== cell) this.close();
    if (!this.tracked)
      this.tracked = {
        cell,
        before,
        departures: [],
        current: before,
        feedbackOf: new Map(),
      };
    const after = next.puzzleState.cells[cell] ?? null;
    const t = this.tracked;
    if (before !== after) {
      if (before !== null)
        t.departures.push({
          value: before,
          to: after,
          feedback: t.feedbackOf.get(before) ?? false,
        });
      if (after !== null)
        t.feedbackOf.set(
          after,
          hasFeedback(this.size, next.puzzleState.cells, cell),
        );
      t.current = after;
    }
    this.session = next;
    if (next.status === "cleared") this.close();
  }
  select(cell: number) {
    if (this.tracked && this.tracked.cell !== cell) this.close();
    this.session = selectMagicSquareSessionCell(this.session, cell);
  }
  enter(cell: number, value: number) {
    this.select(cell);
    this.presses += 1;
    this.change(
      cell,
      enterMagicSquareSessionValue(this.session, value, this.presses),
    );
  }
  undo() {
    const cell = this.session.history.at(-1)?.cellIndex;
    if (cell === undefined) return;
    this.change(cell, undoMagicSquareSession(this.session));
  }
  restart() {
    this.close();
    const placed = this.session.puzzleState.cells.filter(
      (v, i) => v !== null && this.session.problem.givens.cells[i] === null,
    ).length;
    for (const rule of rules) this.counts[rule] += placed;
    this.session = restartMagicSquareSession(this.session);
  }
  get cells() {
    return this.session.puzzleState.cells;
  }
  check() {
    this.counts.N = getMagicSquareSessionCorrectionCount(this.session);
  }
}

function singleEmptyLines(size: number, cells: Cells) {
  return listMagicSquareLines(size)
    .map((line) => ({
      line,
      indices: getMagicSquareLineCellIndices(size, line),
    }))
    .filter(
      ({ indices }) => indices.filter((i) => cells[i] === null).length === 1,
    );
}

function unused(size: number, cells: Cells): number[] {
  const used = new Set(cells.filter((v): v is number => v !== null));
  return Array.from({ length: size * size }, (_, i) => i + 1).filter(
    (v) => !used.has(v),
  );
}

function isT1Solvable(
  size: number,
  givens: Cells,
  solution: readonly number[],
) {
  const cells = [...givens];
  for (;;) {
    const lines = singleEmptyLines(size, cells);
    if (lines.length === 0) break;
    const { indices } = lines[0]!;
    const empty = indices.find((i) => cells[i] === null)!;
    cells[empty] = solution[empty]!;
  }
  return cells.every((v) => v !== null);
}

/** 次に置くマス: 1マスだけ空いた列があればそこ、無ければ答えの分かるマス（読んだとみなす）。 */
function nextCell(size: number, cells: Cells): { cell: number; t1: boolean } {
  const lines = singleEmptyLines(size, cells);
  if (lines.length > 0) {
    const cell = lines[0]!.indices.find((i) => cells[i] === null)!;
    return { cell, t1: true };
  }
  return { cell: cells.indexOf(null), t1: false };
}

function solveByReading(r: Recorder, solution: readonly number[]) {
  while (r.session.status === "playing") {
    const { cell } = nextCell(r.size, r.cells);
    r.enter(cell, solution[cell]!);
  }
}

function mistypeNeighbor(size: number, cells: Cells, value: number) {
  return unused(size, cells).find(
    (v) => v !== value && isPadNeighbor(size, value, v),
  );
}

/** 推理で置き、`mistakeAt` の手（隣の数が空いていなければ次の手）で隣の数を押してから、すぐ正しい数に直す（置き換え）。 */
function solveWithMistypes(
  r: Recorder,
  solution: readonly number[],
  mistakeAt: ReadonlySet<number>,
): number {
  let step = 0;
  let pending = 0;
  let made = 0;
  while (r.session.status === "playing") {
    const { cell } = nextCell(r.size, r.cells);
    if (mistakeAt.has(step)) pending += 1;
    if (pending > 0) {
      const wrong = mistypeNeighbor(r.size, r.cells, solution[cell]!);
      if (wrong !== undefined) {
        r.enter(cell, wrong);
        pending -= 1;
        made += 1;
      }
    }
    r.enter(cell, solution[cell]!);
    step += 1;
  }
  return made;
}

/** 1マスだけ空いた列は、残りの数を乱順に置いて、そのマスを通る列が赤でなくなるまで試す。`fix` は直し方。 */
function solveByTrialOnLastCell(
  r: Recorder,
  solution: readonly number[],
  random: ProblemRandom,
  fix: "replace" | "undo" | "remove",
) {
  while (r.session.status === "playing") {
    const { cell, t1 } = nextCell(r.size, r.cells);
    if (!t1) {
      r.enter(cell, solution[cell]!);
      continue;
    }
    for (const value of shuffleProblemValues(unused(r.size, r.cells), random)) {
      r.enter(cell, value);
      if (r.session.status !== "playing") break;
      if (value === solution[cell]) break;
      if (fix === "undo") r.undo();
      if (fix === "remove") r.enter(cell, value);
    }
  }
}

/** 組の試し置き: 1マス空きの列は計算で埋め、止まったら2マス空きの列の組を乱順に置いて、矛盾が見えたら外す。 */
function solveByPairTrial(r: Recorder, random: ProblemRandom) {
  const size = r.size;
  const magicSum = getMagicSquareMagicSum(size);
  type Option = [number, number][];
  type Frame = { placed: number[]; options: Option[] };
  const visibleContradiction = (cells: Cells) =>
    listMagicSquareLines(size).some((line) => {
      const { emptyCount, sum } = evaluateMagicSquareLine(
        { size, cells },
        line,
      );
      if (emptyCount === 0) return sum !== magicSum;
      if (sum >= magicSum) return true;
      if (emptyCount === 1) {
        const need = magicSum - sum;
        return !unused(size, cells).includes(need);
      }
      return false;
    });
  const listOptions = (cells: Cells): Option[] => {
    const free = unused(size, cells);
    let best: Option[] | null = null;
    for (const line of listMagicSquareLines(size)) {
      const indices = getMagicSquareLineCellIndices(size, line);
      const empties = indices.filter((i) => cells[i] === null);
      if (empties.length !== 2) continue;
      const rest = magicSum - indices.reduce((s, i) => s + (cells[i] ?? 0), 0);
      const pairs: Option[] = [];
      for (const a of free)
        for (const b of free)
          if (a !== b && a + b === rest)
            pairs.push([
              [empties[0]!, a],
              [empties[1]!, b],
            ]);
      if (!best || pairs.length < best.length) best = pairs;
    }
    if (best) return best;
    // 2マス空きの列が無ければ、列の「あと」を超えない数が最も少ないマスに1つずつ試す
    let cellBest: Option[] | null = null;
    cells.forEach((v, cell) => {
      if (v !== null) return;
      const limit = Math.min(
        ...listMagicSquareLinesThroughCell(size, cell).map((line) => {
          const { sum } = evaluateMagicSquareLine({ size, cells }, line);
          return magicSum - sum;
        }),
      );
      const options: Option[] = free
        .filter((value) => value <= limit)
        .map((value) => [[cell, value]]);
      if (!cellBest || options.length < cellBest.length) cellBest = options;
    });
    return cellBest ?? [];
  };
  const stack: Frame[] = [];
  const removeBack = (placed: number[]) => {
    for (const cell of [...placed].reverse()) {
      const v = r.cells[cell];
      if (v !== null && v !== undefined) r.enter(cell, v);
    }
  };
  const apply = (frame: Frame, option: Option) => {
    for (const [cell, value] of option) {
      r.enter(cell, value);
      frame.placed.push(cell);
      if (r.session.status !== "playing") return;
    }
  };
  /** 一番上の枠の置いた数を外し、次の候補を置く。尽きたら1つ上の枠へ戻る。 */
  const backtrack = () => {
    for (;;) {
      const frame = stack.at(-1);
      if (!frame) throw new Error("exhausted");
      removeBack(frame.placed);
      frame.placed = [];
      const option = frame.options.shift();
      if (option) {
        apply(frame, option);
        return;
      }
      stack.pop();
    }
  };
  let guard = 0;
  while (r.session.status === "playing") {
    if (guard++ > 200_000) throw new Error("guard");
    if (visibleContradiction(r.cells)) {
      backtrack();
      continue;
    }
    const lines = singleEmptyLines(size, r.cells);
    if (lines.length > 0) {
      const { indices } = lines[0]!;
      const cell = indices.find((i) => r.cells[i] === null)!;
      const sum = indices.reduce((s, i) => s + (r.cells[i] ?? 0), 0);
      r.enter(cell, magicSum - sum);
      stack.at(-1)?.placed.push(cell);
      continue;
    }
    const options = shuffleProblemValues(listOptions(r.cells), random);
    if (options.length === 0) {
      backtrack();
      continue;
    }
    const frame: Frame = { placed: [], options };
    stack.push(frame);
    apply(frame, frame.options.shift()!);
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const problems = (["1", "2", "3", "4", "5"] as const).flatMap((level) =>
  listMagicSquarePoolEntries(level).slice(0, 2).map((entry, index) => {
    const pooled = restoreMagicSquarePoolEntry(entry);
    const { size } = pooled.problem.givens;
    const givens = pooled.problem.givens.cells.map((v) => v ?? 0);
    const [solution] = countMagicSquareSolutions(size, givens, {
      collect: true,
    }).solutions;
    return {
      name: `L${level}-${index + 1} ${size}×${size}`,
      pooled,
      size,
      solution: solution!,
      t1: isT1Solvable(size, pooled.problem.givens.cells, solution!),
    };
  }),
);

function newRecorder(p: (typeof problems)[number]) {
  return new Recorder(createMagicSquareSession(p.pooled.problem, 0));
}

function points(withdrawals: number, emptyCellCount: number) {
  return calculateMagicSquarePlayScore({
    elapsedMs: 0,
    correctionCount: withdrawals,
    workload: { emptyCellCount },
  }).total;
}

test("代表の解き方の取り下げと点", () => {
  const rows: string[] = [];
  const seeds = Array.from({ length: 21 }, (_, i) => `seed-${i}`);
  const report = (
    problem: string,
    model: string,
    counts: Record<Rule, number>,
    empty: number,
  ) => {
    rows.push(
      [
        problem,
        model,
        ...rules.map(
          (rule) => `${counts[rule]}(${points(counts[rule], empty)})`,
        ),
      ].join(" | "),
    );
  };
  const medianCounts = (list: Record<Rule, number>[]) =>
    Object.fromEntries(
      rules.map((rule) => [rule, median(list.map((c) => c[rule]))]),
    ) as Record<Rule, number>;

  for (const p of problems) {
    const empty = p.pooled.workload.emptyCellCount;
    const label = `${p.name} ${p.t1 ? "T1" : "T2要"} 空き${empty}`;
    {
      const r = newRecorder(p);
      solveByReading(r, p.solution);
      r.check();
      report(label, "推理", r.counts, empty);
    }
    for (const mistakes of [1, 2]) {
      let madeShort = 0;
      const seedsForMistakes = Array.from({ length: 201 }, (_, i) => `m-${i}`);
      const list = seedsForMistakes.flatMap((seed) => {
        const random = createProblemSeededRandom(seed);
        const steps = shuffleProblemValues(
          Array.from({ length: empty }, (_, i) => i),
          random,
        ).slice(0, mistakes);
        const r = newRecorder(p);
        const made = solveWithMistypes(r, p.solution, new Set(steps));
        r.check();
        if (made !== mistakes) {
          madeShort += 1;
          return [];
        }
        return [r.counts];
      });
      report(
        label,
        `押し間違い${mistakes}回 (${201 - madeShort}通り)`,
        medianCounts(list),
        empty,
      );
    }
    for (const fix of ["replace", "undo", "remove"] as const) {
      const list = seeds.map((seed) => {
        const r = newRecorder(p);
        solveByTrialOnLastCell(
          r,
          p.solution,
          createProblemSeededRandom(seed),
          fix,
        );
        r.check();
        return r.counts;
      });
      report(label, `最後の空きで試す(${fix})`, medianCounts(list), empty);
    }
    if (!p.t1) {
      const list = seeds.map((seed) => {
        const r = newRecorder(p);
        solveByPairTrial(r, createProblemSeededRandom(seed));
        r.check();
        return r.counts;
      });
      report(label, "組を試し置き", medianCounts(list), empty);
    }
    {
      // 半分まで推理で置いてから盤面を戻し、読み直して解く
      const r = newRecorder(p);
      for (let i = 0; i < Math.floor(empty / 2); i += 1) {
        const { cell } = nextCell(p.size, r.cells);
        r.enter(cell, p.solution[cell]!);
      }
      r.restart();
      solveByReading(r, p.solution);
      r.check();
      report(label, "半分で盤面を戻す", r.counts, empty);
    }
  }
  console.log(["問題 | 解き方 | " + rules.join(" | "), ...rows].join("\n"));
  writeFileSync("/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/score13/score-study-table.txt", ["問題 | 解き方 | " + rules.join(" | "), ...rows].join("\n") + "\n");
});

