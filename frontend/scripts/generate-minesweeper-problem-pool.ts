import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  assessMinesweeperDifficulty,
  listMinesweeperDifficultyBoardConditions,
  type MinesweeperDifficulty,
  type MinesweeperDifficultyBoardCondition,
  minesweeperDifficulties,
} from "@/games/minesweeper/difficulty";
import {
  restoreMinesweeperProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { MINESWEEPER_GENERATOR_VERSION } from "@/games/minesweeper/problem/problem";
import {
  createMinesweeperPoolIdentity,
  listMinesweeperPoolEntries,
  type MinesweeperProblemPoolEntry,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";

const usage = `Usage: bun run generate:minesweeper-pool -- [options]

各難易度の盤面範囲にある盤面条件（サイズ×地雷数）ごとに、決定的な seed の候補を番号順に生成・分析し、
その難易度に分類された候補を盤面サイズ・地雷数が偏らないよう巡回して問題集へ採る。

Options:
  --per-level <n>  難易度ごとの問題数 (default: 1000)
  --jobs <n>       並列ワーカー数 (default: 4)
  --batch <n>      1ワーカーが一度に調べる候補数 (default: 400)
  --budget <n>     盤面条件ごとに調べる候補数の上限 (default: 200000)
  --verify         生成せず、同梱の問題集の全問を復元→分析→判定し、選択と復元の時間を測る`;

const outputPath = new URL(
  "../src/games/minesweeper/problem/problem-pool.json",
  import.meta.url,
);

type Condition = MinesweeperDifficultyBoardCondition;

type Candidate = {
  index: number;
  milliseconds: number;
  /** 難易度に分類された候補だけが持つ。 */
  accepted?: { key: string; roundCount: number };
};

type ConditionState = {
  difficulty: MinesweeperDifficulty;
  condition: Condition;
  results: Map<number, Candidate>;
  nextIndex: number;
  /** 番号の連続した先頭部分で見つかった、重複を除いた採用候補。 */
  prefixLength: number;
  accepted: Candidate[];
  seenKeys: Set<string>;
};

type SizeGroup = {
  difficulty: MinesweeperDifficulty;
  sizeKey: string;
  target: number;
  conditions: ConditionState[];
  /** 各盤面条件から巡回で採る周回数。全条件がこの周回分を満たすか予算切れになるまで候補を作る。 */
  rounds: number;
  done: boolean;
};

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(readOption(name) ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

function sizeKeyOf({ rows, columns }: { rows: number; columns: number }) {
  return `${rows}x${columns}`;
}

function conditionKeyOf(
  difficulty: MinesweeperDifficulty,
  condition: Condition,
): string {
  return `${difficulty}:${sizeKeyOf(condition)}:${condition.mineCount}`;
}

function parseDifficulty(value: string): MinesweeperDifficulty {
  const difficulty = minesweeperDifficulties.find(({ id }) => id === value);
  if (!difficulty) {
    throw new RangeError(`Invalid difficulty: ${value}`);
  }
  return difficulty.id;
}

function encodeTransformedCells(
  cells: readonly number[],
  columns: number,
  transform: (row: number, column: number) => [number, number],
): string {
  return cells
    .map((cell) => {
      const [row, column] = transform(
        Math.floor(cell / columns),
        cell % columns,
      );
      return row * columns + column;
    })
    .sort((left, right) => left - right)
    .join(",");
}

/** 盤面の大きさを保つ回転・反転で同型になる問題を同じ鍵へまとめる。 */
function createCanonicalProblemKey({
  board,
  initialRevealedCellIndices,
}: MinesweeperProblem): string {
  const { rows, columns } = board;
  const transforms: ((row: number, column: number) => [number, number])[] = [
    (row, column) => [row, column],
    (row, column) => [row, columns - 1 - column],
    (row, column) => [rows - 1 - row, column],
    (row, column) => [rows - 1 - row, columns - 1 - column],
  ];
  if (rows === columns) {
    transforms.push(
      (row, column) => [column, row],
      (row, column) => [columns - 1 - column, row],
      (row, column) => [column, rows - 1 - row],
      (row, column) => [columns - 1 - column, rows - 1 - row],
    );
  }
  return transforms
    .map(
      (transform) =>
        `${encodeTransformedCells(board.mineCellIndices, columns, transform)}|${encodeTransformedCells(initialRevealedCellIndices, columns, transform)}`,
    )
    .sort()[0]!;
}

function evaluateCandidate(
  difficulty: MinesweeperDifficulty,
  condition: Condition,
  index: number,
): Candidate {
  const startedAt = performance.now();
  const identity = createMinesweeperPoolIdentity(difficulty, condition, index);
  const { problem, difficultyAnalysis } = restoreMinesweeperProblem(identity);
  const assessment = assessMinesweeperDifficulty(difficultyAnalysis, condition);
  const isAccepted =
    assessment.status === "classified" &&
    assessment.difficulty === difficulty &&
    difficultyAnalysis.status === "analyzed";
  return {
    index,
    milliseconds: performance.now() - startedAt,
    ...(isAccepted && {
      accepted: {
        key: createCanonicalProblemKey(problem),
        roundCount: difficultyAnalysis.features.roundCount,
      },
    }),
  };
}

function runWorker(args: readonly string[]): void {
  const [difficulty, rows, columns, mineCount, start, count] = args;
  const condition = {
    rows: Number(rows),
    columns: Number(columns),
    mineCount: Number(mineCount),
  };
  const end = Number(start) + Number(count);
  for (let index = Number(start); index < end; index += 1) {
    console.log(
      JSON.stringify(
        evaluateCandidate(parseDifficulty(difficulty!), condition, index),
      ),
    );
  }
}

async function runBatch(
  state: ConditionState,
  start: number,
  count: number,
): Promise<Candidate[]> {
  const { difficulty, condition } = state;
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      difficulty,
      String(condition.rows),
      String(condition.columns),
      String(condition.mineCount),
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(
      `Worker failed for ${conditionKeyOf(difficulty, condition)}`,
    );
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Candidate);
}

/** 番号の連続した先頭部分を伸ばし、同型の重複を除きながら採用候補を番号順に積む。 */
function extendPrefix(state: ConditionState): void {
  for (;;) {
    const candidate = state.results.get(state.prefixLength);
    if (!candidate) {
      return;
    }
    state.prefixLength += 1;
    if (candidate.accepted && !state.seenKeys.has(candidate.accepted.key)) {
      state.seenKeys.add(candidate.accepted.key);
      state.accepted.push(candidate);
    }
  }
}

function createSizeGroups(perLevel: number): SizeGroup[] {
  return minesweeperDifficulties.flatMap(({ id: difficulty }) => {
    const bySize = new Map<string, ConditionState[]>();
    for (const condition of listMinesweeperDifficultyBoardConditions(
      difficulty,
    )) {
      const states = bySize.get(sizeKeyOf(condition)) ?? [];
      states.push({
        difficulty,
        condition,
        results: new Map(),
        nextIndex: 0,
        prefixLength: 0,
        accepted: [],
        seenKeys: new Set(),
      });
      bySize.set(sizeKeyOf(condition), states);
    }
    const sizes = [...bySize];
    return sizes.map(([sizeKey, conditions], sizeIndex) => {
      const target =
        Math.floor(perLevel / sizes.length) +
        (sizeIndex < perLevel % sizes.length ? 1 : 0);
      return {
        difficulty,
        sizeKey,
        target,
        conditions,
        rounds: Math.ceil(target / conditions.length),
        done: false,
      };
    });
  });
}

function isSatisfied(
  state: ConditionState,
  rounds: number,
  budget: number,
): boolean {
  return state.accepted.length >= rounds || state.prefixLength >= budget;
}

/**
 * 全条件が今の周回数を満たしたら、巡回で目標数に届くかを確かめ、届かなければ周回数を増やす。
 * 採る問題は各条件の番号順の先頭部分だけで決まるため、ワーカーの完了順に依存しない。
 */
function updateGroup(group: SizeGroup, budget: number): void {
  while (
    !group.done &&
    group.conditions.every((state) => isSatisfied(state, group.rounds, budget))
  ) {
    const available = group.conditions.reduce(
      (sum, state) => sum + Math.min(state.accepted.length, group.rounds),
      0,
    );
    if (available >= group.target) {
      group.done = true;
    } else if (
      group.conditions.every((state) => state.prefixLength >= budget)
    ) {
      throw new Error(
        `Only ${available}/${group.target} level ${group.difficulty} problems were generated on ${group.sizeKey} within the budget`,
      );
    } else {
      group.rounds += 1;
    }
  }
}

function selectGroupEntries(group: SizeGroup): Candidate[][] {
  const selected: Candidate[][] = group.conditions.map(() => []);
  let count = 0;
  for (let round = 0; round < group.rounds; round += 1) {
    group.conditions.forEach((state, conditionIndex) => {
      const candidate = state.accepted[round];
      if (candidate && count < group.target) {
        selected[conditionIndex]!.push(candidate);
        count += 1;
      }
    });
  }
  return selected;
}

function formatCounts(values: readonly (string | number)[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true }),
    )
    .map(([value, count]) => `${value}=${count}`)
    .join(" ");
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", 1000);
  const jobs = readPositiveInteger("jobs", 4);
  const batchSize = readPositiveInteger("batch", 400);
  const budget = readPositiveInteger("budget", 200_000);
  const groups = createSizeGroups(perLevel);
  const startedAt = performance.now();

  function pickNextState(): ConditionState | undefined {
    return groups
      .filter((group) => !group.done)
      .flatMap((group) =>
        group.conditions.filter(
          (state) =>
            !isSatisfied(state, group.rounds, budget) &&
            state.nextIndex < budget,
        ),
      )
      .sort((left, right) => left.nextIndex - right.nextIndex)[0];
  }

  let running = 0;
  async function runJob(): Promise<void> {
    for (;;) {
      const state = pickNextState();
      if (!state) {
        if (running === 0) {
          return;
        }
        // 実行中のバッチが周回数を増やして新しい仕事を生むことがあるため待つ。
        await Bun.sleep(50);
        continue;
      }
      const start = state.nextIndex;
      const count = Math.min(batchSize, budget - start);
      state.nextIndex += count;
      running += 1;
      try {
        for (const candidate of await runBatch(state, start, count)) {
          state.results.set(candidate.index, candidate);
        }
      } finally {
        running -= 1;
      }
      extendPrefix(state);
      for (const group of groups) {
        updateGroup(group, budget);
      }
      const remaining = groups.filter((group) => !group.done);
      console.error(
        `${Math.round((performance.now() - startedAt) / 1000)}s 未完了: ${
          remaining
            .map((group) => {
              const accepted = group.conditions.reduce(
                (sum, state) =>
                  sum + Math.min(state.accepted.length, group.rounds),
                0,
              );
              return `${group.difficulty}/${group.sizeKey}=${accepted}/${group.target}`;
            })
            .join(" ") || "なし"
        }`,
      );
    }
  }

  for (const group of groups) {
    updateGroup(group, budget);
  }
  await Promise.all(Array.from({ length: jobs }, runJob));
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const levels = Object.fromEntries(
    minesweeperDifficulties.map(({ id }) => [
      id,
      [] as MinesweeperProblemPoolEntry[],
    ]),
  ) as Record<MinesweeperDifficulty, MinesweeperProblemPoolEntry[]>;
  const report: string[] = [];
  for (const { id: difficulty } of minesweeperDifficulties) {
    const levelGroups = groups.filter(
      (group) => group.difficulty === difficulty,
    );
    const selectedPerGroup = levelGroups.map((group) =>
      selectGroupEntries(group).map((candidates, conditionIndex) =>
        candidates.map((candidate) => ({
          condition: group.conditions[conditionIndex]!.condition,
          candidate,
        })),
      ),
    );
    // 盤面サイズと地雷数を交互に並べ、ファイル上でも偏りが見えるようにする。
    const queues = selectedPerGroup.flat();
    const ordered: (typeof queues)[number] = [];
    for (let round = 0; queues.some((queue) => round < queue.length); ) {
      for (const queue of queues) {
        const item = queue[round];
        if (item) {
          ordered.push(item);
        }
      }
      round += 1;
    }
    levels[difficulty] = ordered.map(({ condition, candidate }) => [
      condition.rows,
      condition.columns,
      condition.mineCount,
      candidate.index,
    ]);

    const examined = levelGroups.flatMap((group) =>
      group.conditions.flatMap((state) => [...state.results.values()]),
    );
    const cpuSeconds =
      examined.reduce((sum, candidate) => sum + candidate.milliseconds, 0) /
      1000;
    const acceptedCount = examined.filter(
      (candidate) => candidate.accepted,
    ).length;
    const duplicateCount = levelGroups.reduce(
      (sum, group) =>
        sum +
        group.conditions.reduce(
          (inner, state) =>
            inner +
            [...state.results.values()].filter(
              (candidate) =>
                candidate.index < state.prefixLength && candidate.accepted,
            ).length -
            state.accepted.length,
          0,
        ),
      0,
    );
    const roundCounts = ordered
      .map(({ candidate }) => candidate.accepted!.roundCount)
      .sort((left, right) => left - right);
    report.push(
      `## 難易度 ${difficulty}: ${ordered.length}問`,
      `  候補 ${examined.length} / 分類一致 ${acceptedCount} (${((acceptedCount / examined.length) * 100).toFixed(2)}%) / 同型重複 ${duplicateCount} / 候補の計算 ${cpuSeconds.toFixed(1)}s (CPU)`,
      `  盤面: ${formatCounts(ordered.map(({ condition }) => sizeKeyOf(condition)))}`,
      `  地雷数: ${formatCounts(ordered.map(({ condition }) => condition.mineCount))}`,
      `  ラウンド数: min=${roundCounts[0]} p25=${quantile(roundCounts, 0.25)} median=${quantile(roundCounts, 0.5)} p75=${quantile(roundCounts, 0.75)} max=${roundCounts.at(-1)}`,
      `  条件ごとの調べた候補数: ${levelGroups
        .flatMap((group) =>
          group.conditions.map(
            (state) =>
              `${sizeKeyOf(state.condition)}-${state.condition.mineCount}:${state.prefixLength}`,
          ),
        )
        .join(" ")}`,
    );
  }

  const lines = minesweeperDifficulties.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((entry) => `      ${JSON.stringify(entry)}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < minesweeperDifficulties.length - 1 ? "," : ""}`,
  );
  const json = `{\n  "generatorVersion": ${JSON.stringify(MINESWEEPER_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
  writeFileSync(outputPath, json);

  console.log(report.join("\n"));
  console.log(
    `\n全体: ${wallSeconds.toFixed(1)}s (wall, jobs=${jobs}) / JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`,
  );
}

type VerifyFailure = { difficulty: MinesweeperDifficulty; index: number };

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  for (const { id: difficulty } of minesweeperDifficulties) {
    listMinesweeperPoolEntries(difficulty).forEach((entry, index) => {
      if (index % jobCount! !== jobIndex) {
        return;
      }
      const assessment = assessMinesweeperDifficulty(
        restoreMinesweeperProblem(toMinesweeperPoolIdentity(difficulty, entry))
          .difficultyAnalysis,
        { rows: entry[0], columns: entry[1] },
      );
      if (
        assessment.status !== "classified" ||
        assessment.difficulty !== difficulty
      ) {
        console.log(JSON.stringify({ difficulty, index }));
      }
    });
  }
}

function measureSelection(): string {
  const durations: number[] = [];
  for (const { id: difficulty } of minesweeperDifficulties) {
    for (let index = 0; index < 2000; index += 1) {
      const startedAt = performance.now();
      selectMinesweeperProblemForDifficulty(difficulty, `measure-${index}`);
      durations.push(performance.now() - startedAt);
    }
  }
  durations.sort((left, right) => left - right);
  const mean =
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return `選択+復元 ${durations.length}回: mean=${mean.toFixed(3)}ms p99=${quantile(durations, 0.99).toFixed(3)}ms max=${durations.at(-1)!.toFixed(3)}ms`;
}

async function runVerify(): Promise<void> {
  const jobs = readPositiveInteger("jobs", 4);
  const startedAt = performance.now();
  const outputs = await Promise.all(
    Array.from({ length: jobs }, async (_, jobIndex) => {
      const worker = Bun.spawn(
        [
          process.execPath,
          Bun.fileURLToPath(import.meta.url),
          "--verify-worker",
          String(jobIndex),
          String(jobs),
        ],
        { stdout: "pipe", stderr: "inherit" },
      );
      const output = await new Response(worker.stdout).text();
      if ((await worker.exited) !== 0) {
        throw new Error(`Verify worker ${jobIndex} failed`);
      }
      return output;
    }),
  );
  const failures = outputs
    .join("\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as VerifyFailure);

  const keys = new Set<string>();
  let duplicateCount = 0;
  let total = 0;
  for (const { id: difficulty } of minesweeperDifficulties) {
    for (const entry of listMinesweeperPoolEntries(difficulty)) {
      total += 1;
      const key = createCanonicalProblemKey(
        restoreMinesweeperProblemWithoutAnalysis(
          toMinesweeperPoolIdentity(difficulty, entry),
        ).problem,
      );
      if (keys.has(key)) {
        duplicateCount += 1;
      }
      keys.add(key);
    }
  }

  console.log(
    `${total}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s): 難易度不一致 ${failures.length} / 同型重複 ${duplicateCount}`,
  );
  for (const failure of failures) {
    console.log(`  不一致: 難易度 ${failure.difficulty} の ${failure.index}番`);
  }
  console.log(measureSelection());
  if (failures.length > 0 || duplicateCount > 0) {
    process.exitCode = 1;
  }
}

if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv.slice(Bun.argv.indexOf("--worker") + 1));
} else if (Bun.argv.includes("--verify-worker")) {
  runVerifyWorker(Bun.argv.slice(Bun.argv.indexOf("--verify-worker") + 1));
} else if (Bun.argv.includes("--verify")) {
  await runVerify();
} else {
  await runMain();
}
