// ウォーターソート: 陽性 489bd6a1（easy/normal/hard を生成）と陰性 origin/main（問題集 1〜5）
import {
  type Adapter,
  fmt,
  greedy,
  greedyBacktrack,
  randomBlind,
  randomLegal,
  runLevel,
  sampleEvenly,
  type Summary,
  tableHeader,
} from "../scripts/naive-play-core.ts";

type S = readonly (readonly number[])[];
type M = { sourceBottleIndex: number; destinationBottleIndex: number };

const N = Number(process.env.N ?? 30);
const PLAYS = Number(process.env.PLAYS ?? 3);
const which = process.argv[2] ?? "both";

function players() {
  return [
    randomBlind({ maxMovesPerAttempt: 300, maxAttempts: 5 }, "blind-random(no aid)"),
    randomLegal({ maxMovesPerAttempt: 300, maxAttempts: 5 }, "random(aid)"),
    greedy({ maxMovesPerAttempt: 300, maxAttempts: 5, sideways: true }, "greedy(aid)"),
    greedyBacktrack({ undoBudget: 30, maxMoves: 400 }, "backtrack30(aid)"),
  ];
}

function makeAdapter(
  [initial, minMoves]: [S, number],
  rules: {
    listWaterSortLegalMoves(s: S): M[];
    applyWaterSortMove(s: S, m: M): S | null;
  },
  state: {
    isWaterSortCleared(s: S): boolean;
    createWaterSortStateKey(s: S): string;
    isCompleteWaterSortBottle(b: readonly number[]): boolean;
    countWaterSortColorBlocks(s: S): number;
  },
): Adapter<S, M> {
  return {
    initial,
    minMoves,
    legalMoves: (s) => rules.listWaterSortLegalMoves(s),
    blindMoves: (s) => {
      const ms: M[] = [];
      s.forEach((b, i) => {
        if (b.length === 0) return;
        s.forEach((_, j) => {
          if (i !== j) ms.push({ sourceBottleIndex: i, destinationBottleIndex: j });
        });
      });
      return ms;
    },
    apply: (s, m) => rules.applyWaterSortMove(s, m),
    isCleared: (s) => state.isWaterSortCleared(s),
    key: (s) => state.createWaterSortStateKey(s),
    progress: (s) =>
      3 * s.filter((b) => state.isCompleteWaterSortBottle(b)).length -
      2 * state.countWaterSortColorBlocks(s) +
      s.filter((b) => b.length === 0).length,
  };
}

const out: Summary[] = [];

if (which === "both" || which === "pos") {
  const root = "/tmp/naive/ws-pos/frontend/src/games/water-sort/game";
  const rules = await import(`${root}/rules.ts`);
  const state = await import(`${root}/state.ts`);
  const gen = await import(`${root}/generator.ts`);
  const diff = await import(`${root}/difficulty.ts`);
  const colors: Record<string, number> = { easy: 4, normal: 6, hard: 8 };
  for (const level of ["easy", "normal", "hard"]) {
    const t0 = Date.now();
    const problems: [S, number][] = [];
    for (let i = 0; i < N; i += 1) {
      const p = gen.generateWaterSortProblem({
        seed: `naive-${level}-${i}`,
        colorCount: colors[level],
        acceptCandidate: ({ solveResult }: { solveResult: { features: unknown } }) =>
          solveResult.features !== null &&
          diff.assessWaterSortDifficulty(solveResult.features).difficulty === level,
      });
      problems.push([p.initialState, p.solutionMoves.length]);
    }
    out.push(
      ...runLevel(
        { game: "water-sort", version: "pos 489bd6a1", level },
        problems,
        (p) => makeAdapter(p, rules, state),
        players(),
        PLAYS,
      ),
    );
    console.error(`pos ${level} ${Date.now() - t0}ms`);
  }
}

if (which === "both" || which === "neg") {
  const root = "/tmp/naive/main/frontend/src/games/water-sort";
  const rules = await import(`${root}/puzzle/rules.ts`);
  const state = await import(`${root}/puzzle/state.ts`);
  const pool = await import(`${root}/problem/problem-pool.ts`);
  const gen = await import(`${root}/problem/generator.ts`);
  for (const level of [1, 2, 3, 4, 5]) {
    const t0 = Date.now();
    const entries = sampleEvenly(pool.listWaterSortPoolEntries(level), N);
    const problems: [S, number][] = entries.map((e: unknown) => {
      const d = pool.decodeWaterSortPoolEntry(e);
      return [
        gen.restoreWaterSortProblemWithOptimalMoveCount(d.identity, d.optimalMoveCount).problem.initialState,
        d.optimalMoveCount,
      ];
    });
    out.push(
      ...runLevel(
        { game: "water-sort", version: "neg main", level: String(level) },
        problems,
        (p) => makeAdapter(p, rules, state),
        players(),
        PLAYS,
      ),
    );
    console.error(`neg ${level} ${Date.now() - t0}ms`);
  }
}

console.log(tableHeader);
for (const s of out) console.log(fmt(s));
