// ウォーターソート: 瓶の間で注ぐ。補助なし・合法手のランダム・貪欲・試し置きして戻すの4人で比べる。
// 使い方は scripts/naive-play-core.ts の冒頭。引数は frontend/src/games/water-sort のパス（版ごとに複数可）。
import {
  type Adapter,
  fmt,
  greedy,
  greedyBacktrack,
  randomBlind,
  randomLegal,
  readNaivePlayOptions,
  runLevel,
  sampleEvenly,
  type Summary,
  tableHeader,
} from "../scripts/naive-play-core.ts";

type S = readonly (readonly number[])[];
type M = { sourceBottleIndex: number; destinationBottleIndex: number };

const options = readNaivePlayOptions({ n: 30, plays: 3, levels: [1, 2, 3, 4, 5] });

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

for (const root of options.roots) {
  const rules = await import(`${root}/puzzle/rules.ts`);
  const state = await import(`${root}/puzzle/state.ts`);
  const pool = await import(`${root}/problem/problem-pool.ts`);
  const gen = await import(`${root}/problem/generator.ts`);
  for (const level of options.levels) {
    const t0 = Date.now();
    const entries = sampleEvenly(pool.listWaterSortPoolEntries(level), options.n);
    const problems: [S, number][] = entries.map((e: unknown) => {
      const d = pool.decodeWaterSortPoolEntry(e);
      return [
        gen.restoreWaterSortProblemWithOptimalMoveCount(d.identity, d.optimalMoveCount).problem.initialState,
        d.optimalMoveCount,
      ];
    });
    out.push(
      ...runLevel(
        { game: "water-sort", version: root, level: String(level) },
        problems,
        (p) => makeAdapter(p, rules, state),
        players(),
        options.plays,
      ),
    );
    console.error(`${root} ${level} ${Date.now() - t0}ms`);
  }
}

console.log(tableHeader);
for (const s of out) console.log(fmt(s));
