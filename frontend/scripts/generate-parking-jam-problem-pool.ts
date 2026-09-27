import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  assessParkingJamDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
  parkingJamDifficulties,
} from "@/games/parking-jam/difficulty";
import { listParkingJamProblemPoolCandidateConditions } from "@/games/parking-jam/problem/generation/difficulty-candidate-space";
import {
  generateParkingJamProblem,
  ParkingJamGenerationExhaustedError,
  restoreParkingJamProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import { PARKING_JAM_GENERATOR_VERSION } from "@/games/parking-jam/problem/problem";
import {
  createParkingJamPoolSeed,
  listParkingJamPoolEntries,
  type ParkingJamProblemPoolConditions,
  type ParkingJamProblemPoolEntry,
  toParkingJamPoolConditions,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import {
  listParkingJamFixedAreaCells,
  listParkingJamVehicleCells,
  type ParkingJamBoard,
  type ParkingJamCell,
  type ParkingJamSide,
} from "@/games/parking-jam/puzzle/board";

const usage = `Usage: bun run generate:parking-jam-pool -- [options]

難易度に依らない候補空間の生成条件（生成余白のない条件を除く）ごとに、候補番号 0, 1, 2, ... の seed で
各条件最大2生成試行の問題を作り、本番の難易度判定でレベルに分類する。候補番号の周回順・条件の定義順に並べ、
各レベルの先頭から同型の重複を除いて問題集へ採る。レベルで生成条件を絞らないので、各レベルの盤面規模は
候補空間での現れやすさに従う。

Options:
  --per-level <n>  難易度ごとの問題数 (default: 1000)
  --jobs <n>       並列ワーカー数 (default: 4)
  --batch <n>      1ワーカーが一度に調べる周回数 (default: 4)
  --budget <n>     調べる周回数（候補番号）の上限 (default: 2000)
  --verify         生成せず、同梱の問題集の全問を復元→分析→判定し、選択と復元の時間を測る`;

const outputPath = new URL(
  "../src/games/parking-jam/problem/problem-pool.json",
  import.meta.url,
);
const maximumGenerationAttempts = 2;

type Candidate = {
  round: number;
  conditionIndex: number;
  milliseconds: number;
  generated: boolean;
  /** 提供範囲内でいずれかのレベルに分類された候補だけが持つ。 */
  accepted?: {
    difficulty: ParkingJamDifficulty;
    generationAttempt: number;
    key: string;
  };
};

function readPositiveInteger(name: string, fallback: number): number {
  const index = Bun.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(Bun.argv[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

/** 盤面外周の道路開口も1マスとして含めた座標で、盤面を回転・反転する。 */
type CellTransform = (cell: ParkingJamCell) => ParkingJamCell;

function listBoardTransforms(board: ParkingJamBoard): CellTransform[] {
  const lastRow = board.height - 1;
  const lastColumn = board.width - 1;
  const transforms: CellTransform[] = [
    ({ row, column }) => ({ row, column }),
    ({ row, column }) => ({ row, column: lastColumn - column }),
    ({ row, column }) => ({ row: lastRow - row, column }),
    ({ row, column }) => ({ row: lastRow - row, column: lastColumn - column }),
  ];
  if (board.width === board.height) {
    transforms.push(
      ({ row, column }) => ({ row: column, column: row }),
      ({ row, column }) => ({ row: lastColumn - column, column: row }),
      ({ row, column }) => ({ row: column, column: lastRow - row }),
      ({ row, column }) => ({
        row: lastColumn - column,
        column: lastRow - row,
      }),
    );
  }
  return transforms;
}

function toRoadOpeningCell(
  board: ParkingJamBoard,
  side: ParkingJamSide,
  offset: number,
): ParkingJamCell {
  if (side === "left") return { row: offset, column: -1 };
  if (side === "right") return { row: offset, column: board.width };
  if (side === "up") return { row: -1, column: offset };
  return { row: board.height, column: offset };
}

function listRoadOpeningCells(board: ParkingJamBoard): ParkingJamCell[] {
  return board.roadOpenings.flatMap((opening) =>
    Array.from({ length: opening.length }, (_, index) =>
      toRoadOpeningCell(board, opening.side, opening.startOffset + index),
    ),
  );
}

function encodeCells(
  cells: readonly ParkingJamCell[],
  transform: CellTransform,
): string {
  return cells
    .map(transform)
    .map(({ row, column }) => `${row}.${column}`)
    .sort()
    .join(",");
}

/** 盤面の大きさを保つ回転・反転で同型になる問題を同じ鍵へまとめる。車の番号は区別しない。 */
function createCanonicalProblemKey(board: ParkingJamBoard): string {
  const openingCells = listRoadOpeningCells(board);
  const fixedCells = board.fixedAreas.flatMap(listParkingJamFixedAreaCells);
  return listBoardTransforms(board)
    .map((transform) =>
      [
        board.vehicles
          .map((vehicle) =>
            encodeCells(listParkingJamVehicleCells(vehicle), transform),
          )
          .sort()
          .join("|"),
        encodeCells(fixedCells, transform),
        encodeCells(openingCells, transform),
      ].join("/"),
    )
    .sort()[0]!;
}

function evaluateCandidate(round: number, conditionIndex: number): Candidate {
  const conditions =
    listParkingJamProblemPoolCandidateConditions()[conditionIndex]!;
  const startedAt = performance.now();
  try {
    const generated = generateParkingJamProblem({
      seed: createParkingJamPoolSeed(round),
      ...conditions,
      maximumAttempts: maximumGenerationAttempts,
    });
    const assessment = assessParkingJamDifficulty(generated.difficultyAnalysis);
    return {
      round,
      conditionIndex,
      milliseconds: performance.now() - startedAt,
      generated: true,
      ...(assessment.status === "classified" && {
        accepted: {
          difficulty: assessment.difficulty,
          generationAttempt: generated.identity.generationAttempt,
          key: createCanonicalProblemKey(generated.problem.board),
        },
      }),
    };
  } catch (error) {
    if (!(error instanceof ParkingJamGenerationExhaustedError)) throw error;
    return {
      round,
      conditionIndex,
      milliseconds: performance.now() - startedAt,
      generated: false,
    };
  }
}

function runWorker(args: readonly string[]): void {
  const [start, count] = args.map(Number);
  const conditionCount = listParkingJamProblemPoolCandidateConditions().length;
  for (let round = start!; round < start! + count!; round += 1) {
    for (
      let conditionIndex = 0;
      conditionIndex < conditionCount;
      conditionIndex += 1
    ) {
      console.log(JSON.stringify(evaluateCandidate(round, conditionIndex)));
    }
  }
}

async function runBatch(start: number, count: number): Promise<Candidate[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for rounds ${start}..${start + count - 1}`);
  }
  return output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Candidate);
}

type Selection = {
  levels: Record<ParkingJamDifficulty, Candidate[]>;
  /** 採用の判断に使った、番号の連続した先頭の周回数。 */
  roundCount: number;
  duplicateCount: number;
};

/** 連続して揃った先頭の周回から、各レベルを周回順・条件順に同型の重複を除いて採る。 */
function selectFromPrefix(
  results: ReadonlyMap<number, Candidate[]>,
  perLevel: number,
): Selection & { satisfied: boolean } {
  const levels = Object.fromEntries(
    parkingJamDifficulties.map(({ id }) => [id, [] as Candidate[]]),
  ) as Record<ParkingJamDifficulty, Candidate[]>;
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  let roundCount = 0;
  const isSatisfied = () =>
    parkingJamDifficulties.every(({ id }) => levels[id].length >= perLevel);
  for (;;) {
    if (isSatisfied()) break;
    const candidates = results.get(roundCount);
    if (!candidates) break;
    for (const candidate of candidates) {
      const { accepted } = candidate;
      if (!accepted || levels[accepted.difficulty].length >= perLevel) continue;
      if (seenKeys.has(accepted.key)) {
        duplicateCount += 1;
        continue;
      }
      seenKeys.add(accepted.key);
      levels[accepted.difficulty].push(candidate);
    }
    roundCount += 1;
  }
  return { levels, roundCount, duplicateCount, satisfied: isSatisfied() };
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function formatShares(
  entries: readonly Candidate[],
  keyOf: (conditions: ParkingJamProblemPoolConditions) => string,
  conditionTable: readonly ParkingJamProblemPoolConditions[],
  keys: readonly string[],
): string {
  return keys
    .map(
      (key) =>
        `${key}=${entries.filter((entry) => keyOf(conditionTable[entry.conditionIndex]!) === key).length}`,
    )
    .join(" ");
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", 1000);
  const jobs = readPositiveInteger("jobs", 4);
  const batch = readPositiveInteger("batch", 4);
  const budget = readPositiveInteger("budget", 2000);
  const conditions = listParkingJamProblemPoolCandidateConditions();
  const conditionTable = conditions.map(toParkingJamPoolConditions);
  const results = new Map<number, Candidate[]>();
  let nextRound = 0;
  const startedAt = performance.now();

  async function runJob(): Promise<void> {
    for (;;) {
      if (selectFromPrefix(results, perLevel).satisfied) return;
      if (nextRound >= budget) return;
      const start = nextRound;
      const count = Math.min(batch, budget - start);
      nextRound += count;
      const candidates = await runBatch(start, count);
      for (let round = start; round < start + count; round += 1) {
        results.set(
          round,
          candidates.filter((candidate) => candidate.round === round),
        );
      }
      const progress = selectFromPrefix(results, perLevel);
      console.error(
        `周回 ${progress.roundCount}/${nextRound}: ${parkingJamDifficulties
          .map(({ id }) => `L${id}=${progress.levels[id].length}`)
          .join(
            " ",
          )} (${((performance.now() - startedAt) / 1000).toFixed(0)}s)`,
      );
    }
  }

  await Promise.all(Array.from({ length: jobs }, runJob));
  const wallSeconds = (performance.now() - startedAt) / 1000;
  const selection = selectFromPrefix(results, perLevel);
  if (!selection.satisfied) {
    throw new Error(
      `Budget exhausted: ${parkingJamDifficulties
        .map(({ id }) => `level ${id}=${selection.levels[id].length}`)
        .join(", ")}`,
    );
  }

  // 使われた生成条件だけを条件表に残し、定義順を保って番号を振り直す。
  const usedConditionIndexes = [
    ...new Set(
      parkingJamDifficulties.flatMap(({ id }) =>
        selection.levels[id].map((candidate) => candidate.conditionIndex),
      ),
    ),
  ].sort((left, right) => left - right);
  const tableIndexOf = new Map(
    usedConditionIndexes.map((conditionIndex, tableIndex) => [
      conditionIndex,
      tableIndex,
    ]),
  );
  const toEntry = (candidate: Candidate): ParkingJamProblemPoolEntry => [
    tableIndexOf.get(candidate.conditionIndex)!,
    candidate.round,
    candidate.accepted!.generationAttempt,
  ];
  const levelLines = parkingJamDifficulties.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${selection.levels[id]
        .map((candidate) => `      ${JSON.stringify(toEntry(candidate))}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < parkingJamDifficulties.length - 1 ? "," : ""}`,
  );
  const json = `{\n  "generatorVersion": ${JSON.stringify(PARKING_JAM_GENERATOR_VERSION)},\n  "difficultyModelVersion": ${JSON.stringify(PARKING_JAM_DIFFICULTY_MODEL_VERSION)},\n  "conditions": [\n${usedConditionIndexes
    .map(
      (conditionIndex) =>
        `    ${JSON.stringify(conditionTable[conditionIndex])}`,
    )
    .join(",\n")}\n  ],\n  "levels": {\n${levelLines.join("\n")}\n  }\n}\n`;
  writeFileSync(outputPath, json);

  const examined = [...results]
    .filter(([round]) => round < selection.roundCount)
    .flatMap(([, candidates]) => candidates);
  const durations = examined
    .map((candidate) => candidate.milliseconds)
    .sort((left, right) => left - right);
  const acceptedCounts = new Map<ParkingJamDifficulty, number>();
  for (const candidate of examined) {
    if (!candidate.accepted) continue;
    const { difficulty } = candidate.accepted;
    acceptedCounts.set(difficulty, (acceptedCounts.get(difficulty) ?? 0) + 1);
  }
  const sizeOf = ([width, height]: ParkingJamProblemPoolConditions) =>
    `${width}x${height}`;
  const vehiclesOf = ([, , vehicleCount]: ParkingJamProblemPoolConditions) =>
    String(vehicleCount);
  const fixedOf = ([
    ,
    ,
    ,
    ,
    ,
    fixedAreaCount,
  ]: ParkingJamProblemPoolConditions) => String(fixedAreaCount);
  console.log(
    `候補 ${examined.length}（${selection.roundCount}周回×${conditions.length}条件）/ 生成成功 ${examined.filter((candidate) => candidate.generated).length} / 同型重複で除外 ${selection.duplicateCount}`,
  );
  console.log(
    `候補1つの時間: mean=${(durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1)}ms p50=${quantile(durations, 0.5).toFixed(1)}ms p95=${quantile(durations, 0.95).toFixed(1)}ms max=${durations.at(-1)!.toFixed(1)}ms`,
  );
  for (const { id } of parkingJamDifficulties) {
    const entries = selection.levels[id];
    const lastRound = entries.at(-1)!.round;
    const yieldCount = acceptedCounts.get(id) ?? 0;
    console.log(
      `レベル${id}: ${entries.length}問（${lastRound + 1}周回目まで）/ 候補あたりの収率 ${((yieldCount / examined.length) * 100).toFixed(2)}% / 盤面 ${formatShares(entries, sizeOf, conditionTable, ["6x6", "6x8", "8x8"])} / 車両 ${formatShares(entries, vehiclesOf, conditionTable, ["8", "11", "14"])} / 固定物 ${formatShares(entries, fixedOf, conditionTable, ["0", "1"])}`,
    );
  }
  console.log(
    `全体: ${wallSeconds.toFixed(1)}s (wall, jobs=${jobs}) / JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`,
  );
}

type VerifyFailure = { difficulty: ParkingJamDifficulty; index: number };

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  for (const { id: difficulty } of parkingJamDifficulties) {
    listParkingJamPoolEntries(difficulty).forEach((entry, index) => {
      if (index % jobCount! !== jobIndex) return;
      const assessment = assessParkingJamDifficulty(
        restoreParkingJamProblem(toParkingJamPoolIdentity(entry))
          .difficultyAnalysis,
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
  for (const { id: difficulty } of parkingJamDifficulties) {
    for (let index = 0; index < 400; index += 1) {
      const startedAt = performance.now();
      selectParkingJamProblemForDifficulty(difficulty, `measure-${index}`);
      durations.push(performance.now() - startedAt);
    }
  }
  durations.sort((left, right) => left - right);
  const mean =
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return `選択+復元 ${durations.length}回: mean=${mean.toFixed(2)}ms p50=${quantile(durations, 0.5).toFixed(2)}ms p99=${quantile(durations, 0.99).toFixed(2)}ms max=${durations.at(-1)!.toFixed(2)}ms`;
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
  for (const { id: difficulty } of parkingJamDifficulties) {
    for (const entry of listParkingJamPoolEntries(difficulty)) {
      total += 1;
      const key = createCanonicalProblemKey(
        restoreParkingJamProblemWithoutAnalysis(toParkingJamPoolIdentity(entry))
          .problem.board,
      );
      if (keys.has(key)) duplicateCount += 1;
      keys.add(key);
    }
  }

  console.log(
    `${total}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s): 難易度不一致 ${failures.length} / 同型重複 ${duplicateCount}`,
  );
  for (const failure of failures) {
    console.log(`  不一致: レベル ${failure.difficulty} の ${failure.index}番`);
  }
  console.log(measureSelection());
  if (failures.length > 0 || duplicateCount > 0) process.exitCode = 1;
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
