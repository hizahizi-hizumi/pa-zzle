/**
 * パーキングジャム難易度5段階の設計調査（Issue #405）用の分析スクリプト。
 * 本番の生成器・ルール・判定をそのまま使い、本番挙動は変えない。
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { analyzeParkingJamDifficulty } from "@/games/parking-jam/problem/difficulty-analysis";
import { listParkingJamDifficultyCandidateConditions } from "@/games/parking-jam/problem/generation/difficulty-candidate-space";
import { analyzeParkingJamSolvability } from "@/games/parking-jam/problem/generation/solvability";
import {
  generateParkingJamProblem,
  ParkingJamGenerationExhaustedError,
  restoreParkingJamProblem,
} from "@/games/parking-jam/problem/generator";
import {
  PARKING_JAM_GENERATOR_VERSION,
  type ParkingJamGenerationConditions,
  type ParkingJamProblemIdentity,
} from "@/games/parking-jam/problem/problem";
import {
  type ParkingJamBoard,
  type ParkingJamVehicle,
  validateParkingJamBoard,
} from "@/games/parking-jam/puzzle/board";
import {
  createProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import {
  analyzeParkingJamStudyFeatures,
  type ParkingJamStudyFeatures,
  renderParkingJamBoard,
} from "./parking-jam-difficulty-features";
import {
  findStudyPlan,
  formatStudyAssessment,
  type StudyAssessment,
  type StudyPlan,
  studyPlans,
} from "./parking-jam-difficulty-plans";

const usage = `Usage: bun scripts/analyze-parking-jam-difficulty.ts <command> [options]

Commands:
  corpus    候補条件ごとに固定 seed で問題を生成し、特徴を JSONL へ書く
            --out <file> --seeds <n> (default 20) --shard <i> --shards <k>
            --space current|extended (default current) --attempts <n> (default 2)
  report    corpus の JSONL を読み、分布・相関・分類案の比較を出力する
            --in <file>[,<file>...]
  supply    現行供給（candidate-space-v1 と同じ候補順・試行数）で、分類案の各レベルを要求したときの
            供給成功率と時間を測る
            --plan <id> (default D) --seeds <n> (default 40) --levels 1,2,3,4,5
            --profiles <n> (default 72) --attempts <n> (default 2) --space current|targeted
  pick      corpus から分類案の代表・境界・異常問題を選び、盤面図・特徴・伏せ字の遊び比べリストを出力する
            --in <file>[,<file>...] --plan <id> (default D)
  show      identity の JSON（1行1件）を読み、盤面図と特徴を出力する
            --in <file> --plan <id> (default D)`;

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

function readInteger(name: string, fallback: number): number {
  const value = Number(readOption(name) ?? fallback);
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`--${name} must be a non-negative integer`);
  return value;
}

/**
 * 現行 216 条件の外側で、依存の深い問題が現れやすいかを確かめる拡張候補。
 * 16台（道路開口4）と、道路開口2（5〜11台）を固定領域なしで振る。
 */
function listExtendedConditions(): ParkingJamGenerationConditions[] {
  const conditions: ParkingJamGenerationConditions[] = [];
  const sizes = [
    [6, 6],
    [6, 8],
    [8, 8],
  ] as const;
  const families = [
    { vehicleCounts: [16], roadOpeningCount: 4 },
    { vehicleCounts: [5, 8, 11], roadOpeningCount: 2 },
  ] as const;
  for (const [width, height] of sizes)
    for (const { vehicleCounts, roadOpeningCount } of families)
      for (const vehicleCount of vehicleCounts)
        for (const roadOpeningSpan of [2, 3])
          for (const blockingPlacementProbability of [0.5, 1])
            conditions.push({
              width,
              height,
              vehicleCount,
              roadOpeningCount,
              roadOpeningSpan,
              fixedAreaCount: 0,
              fixedAreaLength: 1,
              blockingPlacementProbability,
            });
  return conditions;
}

type CorpusRecord = {
  identity: ParkingJamProblemIdentity | null;
  conditions: ParkingJamGenerationConditions;
  seed: string;
  space: string;
  milliseconds: number;
  features: ParkingJamStudyFeatures | null;
};

type AnalyzedRecord = CorpusRecord & {
  identity: ParkingJamProblemIdentity;
  features: ParkingJamStudyFeatures;
};

function runCorpus(): void {
  const out = readOption("out");
  if (!out) throw new Error(usage);
  const seeds = readInteger("seeds", 20);
  const shard = readInteger("shard", 0);
  const shards = Math.max(1, readInteger("shards", 1));
  const attempts = Math.max(1, readInteger("attempts", 2));
  const space = readOption("space") ?? "current";
  const conditions =
    space === "extended"
      ? listExtendedConditions()
      : listParkingJamDifficultyCandidateConditions();
  writeFileSync(out, "");
  let taskIndex = 0;
  for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
    for (const condition of conditions) {
      taskIndex += 1;
      if (taskIndex % shards !== shard) continue;
      const seed = `pj5-${space}-${seedIndex}`;
      const startedAt = performance.now();
      let record: CorpusRecord;
      try {
        const generated = generateParkingJamProblem({
          seed,
          ...condition,
          maximumAttempts: attempts,
        });
        record = {
          identity: generated.identity,
          conditions: condition,
          seed,
          space,
          milliseconds: performance.now() - startedAt,
          features: analyzeParkingJamStudyFeatures(generated),
        };
      } catch (error) {
        if (!(error instanceof ParkingJamGenerationExhaustedError)) throw error;
        record = {
          identity: null,
          conditions: condition,
          seed,
          space,
          milliseconds: performance.now() - startedAt,
          features: null,
        };
      }
      appendFileSync(out, `${JSON.stringify(record)}\n`);
    }
  }
}

function readRecords(paths: string): CorpusRecord[] {
  return paths.split(",").flatMap((path) =>
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as CorpusRecord),
  );
}

function isAnalyzed(record: CorpusRecord): record is AnalyzedRecord {
  return record.features !== null && record.identity !== null;
}

// ---- 統計 ----

function sortedNumbers(values: readonly number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

function quantileOf(sorted: readonly number[], ratio: number): number {
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))] ?? 0
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function median(values: readonly number[]): string {
  return values.length === 0
    ? "-"
    : formatNumber(quantileOf(sortedNumbers(values), 0.5));
}

function quartiles(values: readonly number[]): string {
  if (values.length === 0) return "-";
  const sorted = sortedNumbers(values);
  return `${formatNumber(quantileOf(sorted, 0.5))} (${formatNumber(quantileOf(sorted, 0.25))}–${formatNumber(quantileOf(sorted, 0.75))}, ${formatNumber(sorted[0] ?? 0)}–${formatNumber(sorted.at(-1) ?? 0)})`;
}

function percent(count: number, total: number): string {
  return total === 0 ? "-" : `${((count / total) * 100).toFixed(1)}%`;
}

function rank(values: readonly number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length).fill(0);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (
      end + 1 < order.length &&
      order[end + 1]?.value === order[start]?.value
    )
      end += 1;
    for (let position = start; position <= end; position += 1) {
      const entry = order[position];
      if (entry) ranks[entry.index] = (start + end) / 2;
    }
    start = end + 1;
  }
  return ranks;
}

function pearson(x: readonly number[], y: readonly number[]): number {
  const count = x.length;
  const meanX = x.reduce((total, value) => total + value, 0) / count;
  const meanY = y.reduce((total, value) => total + value, 0) / count;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let index = 0; index < count; index += 1) {
    const dx = (x[index] ?? 0) - meanX;
    const dy = (y[index] ?? 0) - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  return varianceX === 0 || varianceY === 0
    ? 0
    : covariance / Math.sqrt(varianceX * varianceY);
}

function spearman(x: readonly number[], y: readonly number[]): number {
  return pearson(rank(x), rank(y));
}

/** 2つのカテゴリ変数の関連の強さ（0〜1）。 */
function cramersV(pairs: readonly (readonly [string, string])[]): number {
  const rows = [...new Set(pairs.map(([row]) => row))];
  const columns = [...new Set(pairs.map(([, column]) => column))];
  if (rows.length < 2 || columns.length < 2) return 0;
  const total = pairs.length;
  const counts = new Map<string, number>();
  for (const [row, column] of pairs)
    counts.set(
      `${row}\u0000${column}`,
      (counts.get(`${row}\u0000${column}`) ?? 0) + 1,
    );
  const rowTotals = new Map(
    rows.map((row) => [row, pairs.filter(([r]) => r === row).length]),
  );
  const columnTotals = new Map(
    columns.map((column) => [
      column,
      pairs.filter(([, c]) => c === column).length,
    ]),
  );
  let chiSquare = 0;
  for (const row of rows)
    for (const column of columns) {
      const expected =
        ((rowTotals.get(row) ?? 0) * (columnTotals.get(column) ?? 0)) / total;
      const observed = counts.get(`${row}\u0000${column}`) ?? 0;
      chiSquare += (observed - expected) ** 2 / expected;
    }
  return Math.sqrt(
    chiSquare / (total * (Math.min(rows.length, columns.length) - 1)),
  );
}

function boardSizeOf(features: ParkingJamStudyFeatures): string {
  return `${features.width}x${features.height}`;
}

function conditionKey(conditions: ParkingJamGenerationConditions): string {
  return [
    `${conditions.width}x${conditions.height}`,
    `v${conditions.vehicleCount}`,
    `o${conditions.roadOpeningCount}x${conditions.roadOpeningSpan}`,
    `f${conditions.fixedAreaCount}`,
    `b${conditions.blockingPlacementProbability}`,
  ].join(" ");
}

// ---- report ----

const reportedFeatureNames = [
  "vehicleCount",
  "cellCount",
  "occupancy",
  "initialBlockedCount",
  "initialAverageMinimumBlocking",
  "averageExitPathLength",
  "v1Score",
  "depth",
  "deepVehicleCount",
  "multiBlockedCount",
  "maximumPrerequisiteCount",
  "buriedVehicleCount",
  "requiredPrecedenceCount",
  "maximumRequiredSuccessorCount",
  "maximumForcedChainLength",
  "directionChoiceCount",
  "nearMissVehicleCount",
  "averageBlockerGap",
  "farBlockerCount",
  "meanScanCost",
  "meanLegalRatio",
  "expectedForcedSteps",
  "expectedScarceSteps",
  "cuedStepRatio",
  "expectedUncuedScarceSteps",
  "minimumLegalRatio",
  "orderFreedom",
] as const satisfies readonly (keyof ParkingJamStudyFeatures)[];

const planLevels = ["too-light", "1", "2", "3", "4", "5", "too-heavy"] as const;

function printFeatureOverview(records: readonly AnalyzedRecord[]): void {
  console.log("\n## 特徴の分布（中央値 (四分位, 最小–最大)）\n");
  for (const name of reportedFeatureNames)
    console.log(
      `- ${name}: ${quartiles(records.map((record) => record.features[name]))}`,
    );

  console.log("\n## 規模との順位相関（Spearman）\n");
  const vehicleCounts = records.map((record) => record.features.vehicleCount);
  const cellCounts = records.map((record) => record.features.cellCount);
  const occupancies = records.map((record) => record.features.occupancy);
  console.log("| 特徴 | 車両数 | マス数 | 車セル占有率 |");
  console.log("| --- | ---: | ---: | ---: |");
  for (const name of reportedFeatureNames) {
    const values = records.map((record) => record.features[name]);
    console.log(
      `| ${name} | ${spearman(values, vehicleCounts).toFixed(2)} | ${spearman(values, cellCounts).toFixed(2)} | ${spearman(values, occupancies).toFixed(2)} |`,
    );
  }

  console.log("\n## 特徴同士の順位相関（|ρ| ≥ 0.8 の組）\n");
  for (let left = 0; left < reportedFeatureNames.length; left += 1)
    for (
      let right = left + 1;
      right < reportedFeatureNames.length;
      right += 1
    ) {
      const leftName = reportedFeatureNames[left];
      const rightName = reportedFeatureNames[right];
      if (!leftName || !rightName) continue;
      const rho = spearman(
        records.map((record) => record.features[leftName]),
        records.map((record) => record.features[rightName]),
      );
      if (Math.abs(rho) >= 0.8)
        console.log(`- ${leftName} × ${rightName}: ${rho.toFixed(2)}`);
    }

  console.log("\n## 依存の段数 × 車両数（件数）\n");
  const depths = [
    ...new Set(records.map((record) => record.features.depth)),
  ].sort((left, right) => left - right);
  const vehicleCountValues = [...new Set(vehicleCounts)].sort(
    (left, right) => left - right,
  );
  console.log(`| 段数 | ${vehicleCountValues.join("台 | ")}台 |`);
  console.log(`| ---: |${vehicleCountValues.map(() => " ---: |").join("")}`);
  for (const depth of depths)
    console.log(
      `| ${depth} | ${vehicleCountValues
        .map(
          (count) =>
            records.filter(
              (record) =>
                record.features.depth === depth &&
                record.features.vehicleCount === count,
            ).length,
        )
        .join(" | ")} |`,
    );

  console.log("\n## 依存の段数 × 最少先行台数の最大（件数）\n");
  const prerequisites = [
    ...new Set(
      records.map((record) => record.features.maximumPrerequisiteCount),
    ),
  ].sort((left, right) => left - right);
  console.log(`| 段数 | ${prerequisites.join(" | ")} |`);
  console.log(`| ---: |${prerequisites.map(() => " ---: |").join("")}`);
  for (const depth of depths)
    console.log(
      `| ${depth} | ${prerequisites
        .map(
          (prerequisite) =>
            records.filter(
              (record) =>
                record.features.depth === depth &&
                record.features.maximumPrerequisiteCount === prerequisite,
            ).length,
        )
        .join(" | ")} |`,
    );
}

function printPlanComparison(
  records: readonly AnalyzedRecord[],
  candidateCount: number,
): void {
  console.log("\n## 分類案の比較\n");
  console.log(
    "| 案 | 軽すぎ / 1 / 2 / 3 / 4 / 5 / 重すぎ（候補1つあたりの収率） | 規模との関連 Cramér's V（車両数 / 盤面） | ρ(レベル, 車両数) | ρ(レベル, マス数) | 4レベル以上が出る条件の割合 |",
  );
  console.log("| --- | --- | ---: | ---: | ---: | ---: |");
  const byCondition = new Map<string, AnalyzedRecord[]>();
  for (const record of records) {
    const key = conditionKey(record.conditions);
    byCondition.set(key, [...(byCondition.get(key) ?? []), record]);
  }
  const richConditions = [...byCondition.values()].filter(
    (group) => group.length >= 20,
  );
  for (const plan of studyPlans) {
    const assessments = records.map((record) =>
      formatStudyAssessment(plan.classify(record.features)),
    );
    const yieldText = planLevels
      .map((level) =>
        percent(
          assessments.filter((assessment) => assessment === level).length,
          candidateCount,
        ),
      )
      .join(" / ");
    const classified = records.filter(
      (_record, index) => !(assessments[index] ?? "").startsWith("too"),
    );
    const classifiedLevels = classified.map((record) =>
      Number(formatStudyAssessment(plan.classify(record.features))),
    );
    const vehicleV = cramersV(
      classified.map((record, index) => [
        String(classifiedLevels[index]),
        String(record.features.vehicleCount),
      ]),
    );
    const sizeV = cramersV(
      classified.map((record, index) => [
        String(classifiedLevels[index]),
        boardSizeOf(record.features),
      ]),
    );
    const diverseConditionCount = richConditions.filter(
      (group) =>
        new Set(
          group
            .map((record) => plan.classify(record.features))
            .filter((assessment) => assessment.status === "classified")
            .map((assessment) => formatStudyAssessment(assessment)),
        ).size >= 4,
    ).length;
    console.log(
      `| ${plan.id} | ${yieldText} | ${vehicleV.toFixed(2)} / ${sizeV.toFixed(2)} | ${spearman(
        classifiedLevels,
        classified.map((record) => record.features.vehicleCount),
      ).toFixed(2)} | ${spearman(
        classifiedLevels,
        classified.map((record) => record.features.cellCount),
      ).toFixed(
        2,
      )} | ${percent(diverseConditionCount, richConditions.length)} (${richConditions.length}条件) |`,
    );
  }
}

function printPlanDetail(
  records: readonly AnalyzedRecord[],
  plan: StudyPlan,
): void {
  console.log(`\n## 案${plan.id}: ${plan.summary}\n`);
  console.log(
    "| レベル | 件数 | 車両数 8/11/14 | 盤面 6x6/6x8/8x8 | 段数 | 最少先行台数の最大 | 初期遮断車数 | 2台以上に塞がれた車 | 平均合法車率 | 手がかりのない探索局面 | 1車線ずれの開口に接する車 | 2セル以上先の遮断 | v1 easy/normal/hard |",
  );
  console.log(
    "| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const level of planLevels) {
    const group = records.filter(
      (record) =>
        formatStudyAssessment(plan.classify(record.features)) === level,
    );
    function share(predicate: (record: AnalyzedRecord) => boolean): string {
      return percent(group.filter(predicate).length, group.length);
    }
    console.log(
      `| ${level} | ${group.length} | ${[8, 11, 14].map((count) => share((record) => record.features.vehicleCount === count)).join(" / ")} | ${["6x6", "6x8", "8x8"].map((size) => share((record) => boardSizeOf(record.features) === size)).join(" / ")} | ${quartiles(group.map((record) => record.features.depth))} | ${quartiles(group.map((record) => record.features.maximumPrerequisiteCount))} | ${quartiles(group.map((record) => record.features.initialBlockedCount))} | ${median(group.map((record) => record.features.multiBlockedCount))} | ${quartiles(group.map((record) => record.features.meanLegalRatio))} | ${median(group.map((record) => record.features.expectedUncuedScarceSteps))} | ${median(group.map((record) => record.features.nearMissVehicleCount))} | ${median(group.map((record) => record.features.farBlockerCount))} | ${["easy", "normal", "hard"].map((label) => group.filter((record) => record.features.v1Difficulty.endsWith(`:${label}`)).length).join(" / ")} |`,
    );
  }
}

function printCrossTable(
  records: readonly AnalyzedRecord[],
  rowPlan: StudyPlan,
  columnPlan: StudyPlan,
): void {
  console.log(`\n### 案${rowPlan.id}（行）× 案${columnPlan.id}（列）\n`);
  console.log(
    `| ${rowPlan.id} \\ ${columnPlan.id} | ${planLevels.join(" | ")} |`,
  );
  console.log(`| --- |${planLevels.map(() => " ---: |").join("")}`);
  for (const rowLevel of planLevels) {
    const row = records.filter(
      (record) =>
        formatStudyAssessment(rowPlan.classify(record.features)) === rowLevel,
    );
    console.log(
      `| ${rowLevel} | ${planLevels
        .map(
          (columnLevel) =>
            row.filter(
              (record) =>
                formatStudyAssessment(columnPlan.classify(record.features)) ===
                columnLevel,
            ).length,
        )
        .join(" | ")} |`,
    );
  }
}

function printV1Correspondence(
  records: readonly AnalyzedRecord[],
  plan: StudyPlan,
): void {
  console.log(`\n### visual-local-load-v1（行）× 案${plan.id}（列）\n`);
  console.log(`| v1 | ${planLevels.join(" | ")} |`);
  console.log(`| --- |${planLevels.map(() => " ---: |").join("")}`);
  for (const label of ["easy", "normal", "hard"]) {
    const row = records.filter((record) =>
      record.features.v1Difficulty.endsWith(`:${label}`),
    );
    console.log(
      `| ${label} | ${planLevels
        .map(
          (level) =>
            row.filter(
              (record) =>
                formatStudyAssessment(plan.classify(record.features)) === level,
            ).length,
        )
        .join(" | ")} |`,
    );
  }
}

function runReport(): void {
  const input = readOption("in");
  if (!input) throw new Error(usage);
  const records = readRecords(input);
  const analyzed = records.filter(isAnalyzed);
  const milliseconds = sortedNumbers(
    records.map((record) => record.milliseconds),
  );
  console.log(
    `# 問題集合: ${records.length} 候補, 生成成功 ${analyzed.length} (${percent(analyzed.length, records.length)}), 候補1つあたりの時間 p50 ${quantileOf(milliseconds, 0.5).toFixed(0)}ms / p95 ${quantileOf(milliseconds, 0.95).toFixed(0)}ms（生成＋本番分析＋調査用分析）`,
  );
  printFeatureOverview(analyzed);
  printPlanComparison(analyzed, records.length);
  for (const plan of studyPlans) printPlanDetail(analyzed, plan);
  const recommended = findStudyPlan("D");
  for (const plan of studyPlans)
    if (plan !== recommended) printCrossTable(analyzed, recommended, plan);
  printV1Correspondence(analyzed, recommended);
}

// ---- supply ----

const PRODUCTION_SUPPLY_VERSION = "candidate-space-v1";

/** 本番 `candidate-space-v1` と同じ、生成余白のない条件を除く規則。 */
function hasSupplyGenerationCapacity(
  conditions: ParkingJamGenerationConditions,
): boolean {
  const minimumOccupiedCellCount =
    conditions.vehicleCount * 2 +
    conditions.fixedAreaCount * conditions.fixedAreaLength;
  return (
    minimumOccupiedCellCount * 3 <= conditions.width * conditions.height * 2
  );
}

/**
 * 段数の深い問題が出やすかった候補領域（corpus の条件別収率から選ぶ）。
 * レベルごとに候補領域を寄せる供給が成り立つかを見るための仮置きで、判定には使わない。
 */
function isTargetedCondition(
  level: number,
  conditions: ParkingJamGenerationConditions,
): boolean {
  if (level <= 2) return conditions.vehicleCount <= 11;
  if (level === 3) return conditions.blockingPlacementProbability > 0;
  return (
    conditions.blockingPlacementProbability === 1 &&
    conditions.roadOpeningCount === 4 &&
    conditions.vehicleCount <= 11 &&
    conditions.width * conditions.height >= 48
  );
}

function listSupplyConditions(
  seed: string,
  level: number,
  space: string,
  profiles: number,
): ParkingJamGenerationConditions[] {
  const random = createProblemRandom(`${PRODUCTION_SUPPLY_VERSION}:${seed}`);
  const candidates = listParkingJamDifficultyCandidateConditions()
    .filter(hasSupplyGenerationCapacity)
    .filter(
      (conditions) =>
        space !== "targeted" || isTargetedCondition(level, conditions),
    );
  return shuffleProblemValues(candidates, random).slice(0, profiles);
}

type SupplyResult = {
  level: number;
  seed: string;
  milliseconds: number;
  candidateCount: number;
  identity: ParkingJamProblemIdentity | null;
};

function supplyOnce(
  plan: StudyPlan,
  level: number,
  seed: string,
  space: string,
  profiles: number,
  attempts: number,
): SupplyResult {
  const startedAt = performance.now();
  let candidateCount = 0;
  for (const conditions of listSupplyConditions(seed, level, space, profiles)) {
    try {
      const generated = generateParkingJamProblem({
        seed,
        ...conditions,
        maximumAttempts: attempts,
        acceptCandidate: (candidate) => {
          candidateCount += 1;
          const assessment: StudyAssessment = plan.classify(
            analyzeParkingJamStudyFeatures({
              problem: { board: candidate.board },
              identity: {
                generatorVersion: PARKING_JAM_GENERATOR_VERSION,
                seed,
                conditions,
                generationAttempt: candidate.attempt,
              },
              solvabilityAnalysis: candidate.solvabilityAnalysis,
              difficultyAnalysis: candidate.difficultyAnalysis,
            }),
          );
          return (
            assessment.status === "classified" && assessment.level === level
          );
        },
      });
      return {
        level,
        seed,
        milliseconds: performance.now() - startedAt,
        candidateCount,
        identity: generated.identity,
      };
    } catch (error) {
      if (!(error instanceof ParkingJamGenerationExhaustedError)) throw error;
    }
  }
  return {
    level,
    seed,
    milliseconds: performance.now() - startedAt,
    candidateCount,
    identity: null,
  };
}

function runSupply(): void {
  const plan = findStudyPlan(readOption("plan") ?? "D");
  const seeds = readInteger("seeds", 40);
  const profiles = readInteger("profiles", 72);
  const attempts = Math.max(1, readInteger("attempts", 2));
  const space = readOption("space") ?? "current";
  const levels = (readOption("levels") ?? "1,2,3,4,5")
    .split(",")
    .map((value) => Number(value));
  console.log(
    `# 供給計測: 案${plan.id}, ${space}, 最大${profiles}条件 × ${attempts}試行, 各レベル${seeds} seed`,
  );
  console.log(
    "\n| レベル | 成功 | 時間 p50 | p95 | 最大 | 生成候補数 p50 | 最大 | 採用問題の車両数 8/11/14 | 盤面 6x6/6x8/8x8 |",
  );
  console.log("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
  for (const level of levels) {
    const results: SupplyResult[] = [];
    for (let index = 0; index < seeds; index += 1)
      results.push(
        supplyOnce(
          plan,
          level,
          `pj5-supply-${level}-${index}`,
          space,
          profiles,
          attempts,
        ),
      );
    const times = sortedNumbers(results.map((result) => result.milliseconds));
    const candidates = sortedNumbers(
      results.map((result) => result.candidateCount),
    );
    const supplied = results.filter((result) => result.identity !== null);
    function countBy(predicate: (result: SupplyResult) => boolean): number {
      return supplied.filter(predicate).length;
    }
    console.log(
      `| ${level} | ${supplied.length}/${results.length} | ${quantileOf(times, 0.5).toFixed(0)}ms | ${quantileOf(times, 0.95).toFixed(0)}ms | ${(times.at(-1) ?? 0).toFixed(0)}ms | ${quantileOf(candidates, 0.5)} | ${candidates.at(-1) ?? 0} | ${[8, 11, 14].map((count) => countBy((result) => result.identity?.conditions.vehicleCount === count)).join(" / ")} | ${[36, 48, 64].map((cells) => countBy((result) => (result.identity?.conditions.width ?? 0) * (result.identity?.conditions.height ?? 0) === cells)).join(" / ")} |`,
    );
  }
}

// ---- pick / show ----

type PickedProblem = {
  kind: string;
  note: string;
  record: AnalyzedRecord;
};

function describe(features: ParkingJamStudyFeatures): string {
  return [
    `${features.width}x${features.height}`,
    `${features.vehicleCount}台`,
    `段数${features.depth}（${features.layerSizes.join("/")}）`,
    `最少先行${features.maximumPrerequisiteCount}`,
    `初期遮断${features.initialBlockedCount}`,
    `二重遮断${features.multiBlockedCount}`,
    `平均合法率${features.meanLegalRatio.toFixed(2)}`,
    `探索局面${features.expectedUncuedScarceSteps.toFixed(2)}`,
    `ずれ開口${features.nearMissVehicleCount}`,
    `v1 ${features.v1Difficulty.split(":")[1]}(${features.v1Score.toFixed(2)})`,
  ].join(" · ");
}

function levelOf(plan: StudyPlan, record: AnalyzedRecord): string {
  return formatStudyAssessment(plan.classify(record.features));
}

function pickProblems(
  records: readonly AnalyzedRecord[],
  plan: StudyPlan,
): PickedProblem[] {
  const picked: PickedProblem[] = [];
  const used = new Set<AnalyzedRecord>();
  function take(
    kind: string,
    note: string,
    candidates: readonly AnalyzedRecord[],
    score: (record: AnalyzedRecord) => number,
    count = 1,
  ): void {
    const ordered = [...candidates]
      .filter((record) => !used.has(record))
      .sort((left, right) => score(left) - score(right));
    const sizes = new Set<string>();
    let takenCount = 0;
    for (const record of ordered) {
      if (takenCount >= count) break;
      const size = boardSizeOf(record.features);
      if (count > 1 && sizes.has(size) && ordered.length > count * 3) continue;
      sizes.add(size);
      used.add(record);
      picked.push({ kind, note, record });
      takenCount += 1;
    }
  }
  function inLevel(level: string): AnalyzedRecord[] {
    return records.filter((record) => levelOf(plan, record) === level);
  }

  for (const level of ["1", "2", "3", "4", "5"]) {
    const group = inLevel(level);
    const centers = {
      legal: Number(median(group.map((r) => r.features.meanLegalRatio))),
      blocked: Number(median(group.map((r) => r.features.initialBlockedCount))),
      prerequisite: Number(
        median(group.map((r) => r.features.maximumPrerequisiteCount)),
      ),
    };
    take(
      `代表 ${level}`,
      "レベル内の中央値に近い",
      group,
      (record) =>
        Math.abs(record.features.meanLegalRatio - centers.legal) * 10 +
        Math.abs(record.features.initialBlockedCount - centers.blocked) +
        Math.abs(
          record.features.maximumPrerequisiteCount - centers.prerequisite,
        ),
      2,
    );
  }

  take(
    "境界 範囲外/1",
    "軽すぎ側: 塞がれた車が1台だけ",
    inLevel("too-light").filter((r) => r.features.depth === 2),
    (r) => -r.features.vehicleCount,
  );
  take(
    "境界 1/2",
    "1の上端: 1台待ちだけだが初期遮断が多い",
    inLevel("1"),
    (r) => -r.features.initialBlockedCount,
  );
  take(
    "境界 1/2",
    "2の下端: 2台に塞がれた車が1台だけ",
    inLevel("2").filter((r) => r.features.multiBlockedCount === 1),
    (r) => r.features.initialBlockedCount,
  );
  take(
    "境界 2/3",
    "2の上端: 平均合法率が低い",
    inLevel("2"),
    (r) => r.features.meanLegalRatio,
  );
  take(
    "境界 2/3",
    "3の下端: 3段目の車が1台だけで合法率が高い",
    inLevel("3").filter((r) => r.features.deepVehicleCount === 1),
    (r) => -r.features.meanLegalRatio,
  );
  take(
    "境界 3/4",
    "3の上端: 枝分かれが大きい",
    inLevel("3"),
    (r) => -r.features.maximumPrerequisiteCount,
  );
  take(
    "境界 3/4",
    "4の下端: 合法率が高い",
    inLevel("4"),
    (r) => -r.features.meanLegalRatio,
  );
  take(
    "境界 4/5",
    "4の上端: 合法率が低い",
    inLevel("4"),
    (r) => r.features.meanLegalRatio,
  );
  take(
    "境界 4/5",
    "5の下端: 合法率が高い",
    inLevel("5"),
    (r) => -r.features.meanLegalRatio,
  );
  take(
    "境界 5/範囲外",
    "重すぎ側: 段数7以上",
    inLevel("too-heavy"),
    (r) => -r.features.depth,
  );
  take(
    "異常 小さいのに高い",
    "6x6・8台で4以上",
    records.filter(
      (r) =>
        r.features.cellCount === 36 &&
        r.features.vehicleCount === 8 &&
        Number(levelOf(plan, r)) >= 4,
    ),
    (r) => -r.features.depth,
  );
  take(
    "異常 大きいのに低い",
    "8x8・14台で1",
    records.filter(
      (r) =>
        r.features.cellCount === 64 &&
        r.features.vehicleCount === 14 &&
        levelOf(plan, r) === "1",
    ),
    (r) => -r.features.initialBlockedCount,
  );
  take(
    "異常 v1 hard なのに低い",
    "局所負荷は高いが段数2",
    records.filter(
      (r) =>
        r.features.v1Difficulty.endsWith(":hard") &&
        ["1", "2"].includes(levelOf(plan, r)),
    ),
    (r) => -r.features.v1Score,
  );
  take(
    "異常 v1 easy なのに高い",
    "局所負荷は低いが段数4以上",
    records.filter(
      (r) =>
        r.features.v1Difficulty.endsWith(":easy") &&
        Number(levelOf(plan, r)) >= 4,
    ),
    (r) => r.features.v1Score,
  );
  take(
    "異常 見誤りを誘う開口が多い",
    "1車線ずれの開口に接する車が多い低レベル",
    records.filter((r) => ["1", "2"].includes(levelOf(plan, r))),
    (r) => -r.features.nearMissVehicleCount,
  );
  return picked;
}

function printPicked(picked: readonly PickedProblem[], plan: StudyPlan): void {
  console.log(`# 案${plan.id} の代表・境界・異常問題\n`);
  for (const { kind, note, record } of picked) {
    console.log(`## ${kind}（${levelOf(plan, record)}）: ${note}\n`);
    console.log(`- identity: \`${JSON.stringify(record.identity)}\``);
    console.log(`- ${describe(record.features)}\n`);
    const generated = restoreParkingJamProblem(record.identity);
    console.log("```text");
    console.log(renderParkingJamBoard(generated.problem.board));
    console.log("```\n");
  }

  const random = createProblemRandom(`pj5-blind-${plan.id}`);
  const blind = shuffleProblemValues(picked, random);
  console.log("# 伏せ字の遊び比べリスト\n");
  blind.forEach((entry, index) => {
    const code = `P${String(index + 1).padStart(2, "0")}`;
    const generated = restoreParkingJamProblem(entry.record.identity);
    console.log(`## ${code}\n`);
    console.log(`- identity: \`${JSON.stringify(entry.record.identity)}\`\n`);
    console.log("```text");
    console.log(renderParkingJamBoard(generated.problem.board));
    console.log("```\n");
  });
  console.log("# 答え合わせ表\n");
  console.log(`| コード | 案${plan.id} | 種類 | v1 | 特徴 |`);
  console.log("| --- | ---: | --- | --- | --- |");
  blind.forEach((entry, index) => {
    const code = `P${String(index + 1).padStart(2, "0")}`;
    console.log(
      `| ${code} | ${levelOf(plan, entry.record)} | ${entry.kind} | ${entry.record.features.v1Difficulty.split(":")[1]} | ${describe(entry.record.features)} |`,
    );
  });
}

function runPick(): void {
  const input = readOption("in");
  if (!input) throw new Error(usage);
  const plan = findStudyPlan(readOption("plan") ?? "D");
  const records = readRecords(input).filter(isAnalyzed);
  printPicked(pickProblems(records, plan), plan);
}

function runShow(): void {
  const input = readOption("in");
  if (!input) throw new Error(usage);
  const plan = findStudyPlan(readOption("plan") ?? "D");
  const identities = readFileSync(input, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ParkingJamProblemIdentity);
  for (const identity of identities) {
    const generated = restoreParkingJamProblem(identity);
    const features = analyzeParkingJamStudyFeatures(generated);
    console.log(JSON.stringify(identity));
    console.log(renderParkingJamBoard(generated.problem.board));
    console.log(
      `案${plan.id}=${formatStudyAssessment(plan.classify(features))} ${describe(features)}\n`,
    );
  }
}

// ---- preview ----

/**
 * 難易度選択プレビューの5段階配置案（4行7列、右の上2行・上の中央2列・左の下2行が開口）。
 * 形式は本番 `ParkingJamDifficultyPreview` の `previewVehicleLayouts` と同じで、同じ英小文字のマスが1台。
 */
const previewLayoutProposal = {
  width: 7,
  height: 4,
  roadOpenings: [
    { side: "right", startOffset: 0, length: 2 },
    { side: "up", startOffset: 2, length: 2 },
    { side: "left", startOffset: 2, length: 2 },
  ],
  layouts: [
    [".......", "aac....", "..c..bb", "......."],
    [".......", "aac.dd.", "..c..bb", "......."],
    [".ee....", "aac.dd.", "..c..bb", "......."],
    [".ee....", "aacfdd.", "..cf.bb", "...f..."],
    [".ee..gg", "aacfdd.", "..cf.bb", "...f..."],
  ],
} as const;

function toLayoutBoard(layout: readonly string[]): ParkingJamBoard {
  const cellsById = new Map<string, { row: number; column: number }[]>();
  layout.forEach((marks, row) => {
    Array.from(marks).forEach((mark, column) => {
      if (mark === ".") return;
      cellsById.set(mark, [...(cellsById.get(mark) ?? []), { row, column }]);
    });
  });
  const vehicles = [...cellsById].map(([id, cells]): ParkingJamVehicle => {
    const length = cells.length;
    if (length !== 2 && length !== 3)
      throw new RangeError(`Invalid preview vehicle: ${id}`);
    return {
      id,
      row: Math.min(...cells.map((cell) => cell.row)),
      column: Math.min(...cells.map((cell) => cell.column)),
      orientation: cells.every((cell) => cell.row === cells[0]?.row)
        ? "horizontal"
        : "vertical",
      length,
    };
  });
  return {
    width: previewLayoutProposal.width,
    height: previewLayoutProposal.height,
    vehicles,
    fixedAreas: [],
    roadOpenings: previewLayoutProposal.roadOpenings,
  };
}

function runPreview(): void {
  const plan = findStudyPlan(readOption("plan") ?? "D+");
  previewLayoutProposal.layouts.forEach((layout, index) => {
    const board = toLayoutBoard(layout);
    validateParkingJamBoard(board);
    const solvabilityAnalysis = analyzeParkingJamSolvability(board);
    if (solvabilityAnalysis.status !== "solvable")
      throw new Error(`Preview level ${index + 1} is unsolvable`);
    const features = analyzeParkingJamStudyFeatures({
      problem: { board },
      identity: {
        generatorVersion: PARKING_JAM_GENERATOR_VERSION,
        seed: `preview-${index + 1}`,
        conditions: {
          width: board.width,
          height: board.height,
          vehicleCount: board.vehicles.length,
          roadOpeningCount: board.roadOpenings.length,
          roadOpeningSpan: 2,
          fixedAreaCount: 0,
          fixedAreaLength: 1,
          blockingPlacementProbability: 0,
        },
        generationAttempt: 1,
      },
      solvabilityAnalysis,
      difficultyAnalysis: analyzeParkingJamDifficulty(
        board,
        solvabilityAnalysis,
      ),
    });
    console.log(
      `レベル${index + 1}（案${plan.id}=${formatStudyAssessment(plan.classify(features))}）`,
    );
    console.log(renderParkingJamBoard(board));
    console.log(`${describe(features)}\n`);
  });
}

const commands: Record<string, () => void> = {
  corpus: runCorpus,
  report: runReport,
  supply: runSupply,
  pick: runPick,
  show: runShow,
  preview: runPreview,
};
const command = commands[Bun.argv[2] ?? ""];
if (command) command();
else console.log(usage);
