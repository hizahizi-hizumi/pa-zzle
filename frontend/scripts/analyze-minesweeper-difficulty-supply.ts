import {
  assessMinesweeperDifficulty,
  classifyMinesweeperInferenceDifficulty,
  listMinesweeperDifficultyBoardConditions,
  type MinesweeperDifficulty,
  type MinesweeperDifficultyAssessment,
  minesweeperDifficulties,
} from "@/games/minesweeper/difficulty";
import { generateMinesweeperProblem } from "@/games/minesweeper/problem/generator";

const usage = `Usage: bun run analyze:minesweeper-supply -- [options]

各難易度の盤面範囲から生成条件を一様に選んで候補を1つずつ作り、難易度判定での採用率と採用にかかる時間を測る。

Options:
  --candidates <n>        難易度ごとの候補数 (default: 2000)
  --difficulties <d,...>  測る難易度 (default: 1,2,3,4,5)
  --jobs <n>              並列ワーカー数 (default: 1)`;

type SupplyTask = { difficulty: MinesweeperDifficulty; index: number };

type SupplyRecord = SupplyTask & {
  rows: number;
  columns: number;
  mineCount: number;
  milliseconds: number;
  assessment: MinesweeperDifficultyAssessment;
  roundCount: number | null;
  initialRevealedSafeCellRatio: number;
  /** 軽すぎ・盤面範囲外で除外した候補について、推論だけで決まる難易度。 */
  inferenceDifficulty: MinesweeperDifficulty | null;
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

function readDifficulties(): MinesweeperDifficulty[] {
  const value = readOption("difficulties");
  if (value === undefined) {
    return minesweeperDifficulties.map((difficulty) => difficulty.id);
  }
  return value.split(",").map((id) => {
    const difficulty = minesweeperDifficulties.find(
      (candidate) => candidate.id === id.trim(),
    );
    if (!difficulty) {
      throw new RangeError(`Invalid difficulty: ${id}`);
    }
    return difficulty.id;
  });
}

function createTasks(): SupplyTask[] {
  const candidateCount = readPositiveInteger("candidates", 2000);
  return readDifficulties().flatMap((difficulty) =>
    Array.from({ length: candidateCount }, (_, index) => ({
      difficulty,
      index,
    })),
  );
}

/** 候補番号から決定的に [0, 1) の値を作る。 */
function hashToUnit(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

/** 盤面サイズを一様に選び、そのサイズで密度範囲に入る地雷数を一様に選ぶ。 */
function chooseCondition({ difficulty, index }: SupplyTask) {
  const conditions = listMinesweeperDifficultyBoardConditions(difficulty);
  const sizes = [
    ...new Map(
      conditions.map((condition) => [
        `${condition.rows}x${condition.columns}`,
        condition,
      ]),
    ).keys(),
  ];
  const size =
    sizes[Math.floor(hashToUnit(`size:${difficulty}:${index}`) * sizes.length)];
  const mineCountChoices = conditions.filter(
    (condition) => `${condition.rows}x${condition.columns}` === size,
  );
  return mineCountChoices[
    Math.floor(
      hashToUnit(`mines:${difficulty}:${index}`) * mineCountChoices.length,
    )
  ]!;
}

function analyzeTask(task: SupplyTask): SupplyRecord {
  const { rows, columns, mineCount } = chooseCondition(task);
  const startedAt = performance.now();
  const generated = generateMinesweeperProblem({
    seed: `supply-${task.difficulty}-${task.index}`,
    conditions: { rows, columns, mineCount, startCellPlacement: "random" },
    maximumAttempts: 1,
  });
  const analysis = generated.difficultyAnalysis;
  const assessment = assessMinesweeperDifficulty(analysis, { rows, columns });
  const milliseconds = performance.now() - startedAt;
  const inferenceDifficulty =
    assessment.status === "out-of-range" && analysis.status === "analyzed"
      ? classifyMinesweeperInferenceDifficulty(analysis.features)
      : null;

  return {
    ...task,
    rows,
    columns,
    mineCount,
    milliseconds,
    assessment,
    roundCount:
      analysis.status === "analyzed" ? analysis.features.roundCount : null,
    initialRevealedSafeCellRatio: analysis.scale.initialRevealedSafeCellRatio,
    inferenceDifficulty,
  };
}

function formatAssessment(record: SupplyRecord): string {
  const { assessment } = record;
  switch (assessment.status) {
    case "classified":
      return `classified:${assessment.difficulty}`;
    case "out-of-range":
      return `out-of-range:${assessment.reason}:inference${record.inferenceDifficulty}`;
    case "unsupported":
      return `unsupported:${assessment.reason}`;
    case "unsolvable":
      return "unsolvable";
  }
}

function formatPercent(count: number, total: number): string {
  return `${Math.round((count / total) * 1000) / 10}%`;
}

function formatCounts(values: readonly (string | number)[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true }),
    )
    .map(
      ([value, count]) =>
        `${value}=${count} (${formatPercent(count, values.length)})`,
    )
    .join(", ");
}

function quantile(sortedValues: readonly number[], ratio: number): number {
  return sortedValues[
    Math.min(sortedValues.length - 1, Math.floor(ratio * sortedValues.length))
  ]!;
}

function isAccepted(record: SupplyRecord): boolean {
  return (
    record.assessment.status === "classified" &&
    record.assessment.difficulty === record.difficulty
  );
}

function printDifficultySummary(
  difficulty: MinesweeperDifficulty,
  records: readonly SupplyRecord[],
): void {
  const accepted = records.filter(isAccepted);
  const totalMilliseconds = records.reduce(
    (sum, record) => sum + record.milliseconds,
    0,
  );
  const candidateMilliseconds = records
    .map((record) => record.milliseconds)
    .sort((left, right) => left - right);
  const roundCounts = accepted
    .map((record) => record.roundCount ?? 0)
    .sort((left, right) => left - right);

  console.log(`\n## 難易度 ${difficulty}`);
  console.log(
    `採用 ${accepted.length}/${records.length} (${formatPercent(accepted.length, records.length)})`,
  );
  console.log(
    `1採用あたり ${accepted.length === 0 ? "-" : Math.round(totalMilliseconds / accepted.length)}ms / 1候補 mean=${Math.round(totalMilliseconds / records.length)}ms p95=${Math.round(quantile(candidateMilliseconds, 0.95))}ms max=${Math.round(candidateMilliseconds.at(-1) ?? 0)}ms`,
  );
  console.log(`判定の内訳: ${formatCounts(records.map(formatAssessment))}`);
  const tooLight = records.filter(
    (record) =>
      record.assessment.status === "out-of-range" &&
      record.assessment.reason === "too-light",
  );
  if (tooLight.length > 0) {
    console.log(
      `軽すぎの理由: ラウンド数<6=${tooLight.filter((record) => (record.roundCount ?? 0) < 6).length}, 初期開示>0.6=${tooLight.filter((record) => record.initialRevealedSafeCellRatio > 0.6).length} (重複あり)`,
    );
  }
  if (accepted.length === 0) {
    return;
  }
  console.log(
    `採用問題の盤面: ${formatCounts(accepted.map((record) => `${record.rows}x${record.columns}`))}`,
  );
  console.log(
    `採用問題の地雷数: ${formatCounts(accepted.map((record) => record.mineCount))}`,
  );
  console.log(
    `採用問題のラウンド数: min=${roundCounts[0]} p25=${quantile(roundCounts, 0.25)} median=${quantile(roundCounts, 0.5)} p75=${quantile(roundCounts, 0.75)} max=${roundCounts.at(-1)}`,
  );
}

function sliceJobTasks(
  tasks: readonly SupplyTask[],
  jobCount: number,
  jobIndex: number,
): SupplyTask[] {
  return tasks.filter((_, index) => index % jobCount === jobIndex);
}

function runWorker(jobIndex: number): void {
  const jobCount = readPositiveInteger("jobs", 1);
  for (const task of sliceJobTasks(createTasks(), jobCount, jobIndex)) {
    console.log(JSON.stringify(analyzeTask(task)));
  }
}

async function runJobInWorker(jobIndex: number): Promise<SupplyRecord[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      ...Bun.argv.slice(2),
      "--worker",
      String(jobIndex),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Minesweeper supply worker ${jobIndex} failed`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as SupplyRecord);
}

async function runMain(): Promise<void> {
  if (Bun.argv.includes("--help")) {
    console.log(usage);
    return;
  }
  const jobCount = readPositiveInteger("jobs", 1);
  const records =
    jobCount === 1
      ? createTasks().map(analyzeTask)
      : (
          await Promise.all(
            Array.from({ length: jobCount }, (_, jobIndex) =>
              runJobInWorker(jobIndex),
            ),
          )
        ).flat();

  for (const difficulty of readDifficulties()) {
    printDifficultySummary(
      difficulty,
      records.filter((record) => record.difficulty === difficulty),
    );
  }
}

const workerIndex = Bun.argv.indexOf("--worker");
if (workerIndex >= 0) {
  runWorker(Number(Bun.argv[workerIndex + 1]));
} else {
  await runMain();
}
