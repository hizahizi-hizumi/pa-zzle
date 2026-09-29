/**
 * パーキングジャム難易度5段階の設計調査（Issue #405）用の分析スクリプト。
 * 本番の生成器・ルール・判定をそのまま使い、本番挙動は変えない。
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { listParkingJamDifficultyCandidateConditions } from "@/games/parking-jam/problem/generation/difficulty-candidate-space";
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
  validateParkingJamBoard,
} from "@/games/parking-jam/puzzle/board";
import {
  createProblemSeededRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";
import {
  analyzeParkingJamBoardStudyFeatures,
  analyzeParkingJamStudyFeatures,
  type ParkingJamStudyFeatures,
  renderParkingJamBoard,
} from "./parking-jam-difficulty-features";
import {
  addDecoyOpenings,
  removeUnusedOpenings,
} from "./parking-jam-difficulty-openings";
import {
  dependencyLeverOf,
  findStudyPlan,
  formatStudyAssessment,
  misreadLeverOf,
  type StudyAssessment,
  type StudyPlan,
  scaleLeverOf,
  studyPlans,
} from "./parking-jam-difficulty-plans";

const usage = `Usage: bun scripts/analyze-parking-jam-difficulty.ts <command> [options]

Commands:
  corpus    候補条件ごとに固定 seed で問題を生成し、特徴を JSONL へ書く
            --out <file> --seeds <n> (default 20) --shard <i> --shards <k>
            --space current|extended|fixed (default current) --attempts <n> (default 2)
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
/**
 * 固定物（植栽島）の量を現行候補空間（0〜1個）より広く振る候補。
 * 固定物2〜3個（長さ2）を、6×8・8×8、8・11台、開口3〜4×幅2〜3、遮断バイアス0.5・1で振る。
 */
function listFixedAreaConditions(): ParkingJamGenerationConditions[] {
  const conditions: ParkingJamGenerationConditions[] = [];
  for (const [width, height] of [
    [6, 8],
    [8, 8],
  ] as const)
    for (const vehicleCount of [8, 11])
      for (const roadOpeningCount of [3, 4])
        for (const roadOpeningSpan of [2, 3])
          for (const fixedAreaCount of [2, 3])
            for (const blockingPlacementProbability of [0.5, 1])
              conditions.push({
                width,
                height,
                vehicleCount,
                roadOpeningCount,
                roadOpeningSpan,
                fixedAreaCount,
                fixedAreaLength: 2,
                blockingPlacementProbability,
              });
  return conditions;
}

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
  /** 開口を変換した盤面など、identity から復元できない盤面の場合だけ持つ。 */
  board?: ParkingJamBoard;
  variant?: string;
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
      : space === "fixed"
        ? listFixedAreaConditions()
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

const planLevels = [
  "too-light",
  "1",
  "2",
  "3",
  "4",
  "5",
  "too-heavy",
  "unplaced",
] as const;

function boardOf(record: AnalyzedRecord): ParkingJamBoard {
  return (
    record.board ?? restoreParkingJamProblem(record.identity).problem.board
  );
}

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
    "| レベル | 件数 | 車両数 8/11/14 | 盤面 6x6/6x8/8x8 | 固定物あり | 規模レバー 1/2/3 | 段数 | 最少先行台数の最大 | 初期遮断車数 | 平均合法車率 | 読み違いを誘う車 | 1車線ずれの開口 | 方向判断 | 遠い遮断 | v1 easy/normal/hard |",
  );
  console.log(
    "| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const level of planLevels) {
    const group = records.filter(
      (record) =>
        formatStudyAssessment(plan.classify(record.features)) === level,
    );
    function share(predicate: (record: AnalyzedRecord) => boolean): string {
      return percent(group.filter(predicate).length, group.length);
    }
    function values(name: keyof ParkingJamStudyFeatures): number[] {
      return group.map((record) => Number(record.features[name]));
    }
    console.log(
      `| ${level} | ${group.length} | ${[8, 11, 14].map((count) => share((record) => record.features.vehicleCount === count)).join(" / ")} | ${["6x6", "6x8", "8x8"].map((size) => share((record) => boardSizeOf(record.features) === size)).join(" / ")} | ${share((record) => record.features.fixedAreaCount > 0)} | ${[1, 2, 3].map((grade) => share((record) => scaleLeverOf(record.features) === grade)).join(" / ")} | ${quartiles(values("depth"))} | ${quartiles(values("maximumPrerequisiteCount"))} | ${quartiles(values("initialBlockedCount"))} | ${quartiles(values("meanLegalRatio"))} | ${quartiles(values("misreadVehicleRatio"))} | ${median(values("nearMissRatio"))} | ${median(values("directionChoiceRatio"))} | ${median(values("farBlockedRatio"))} | ${["easy", "normal", "hard"].map((label) => group.filter((record) => record.features.v1Difficulty.endsWith(`:${label}`)).length).join(" / ")} |`,
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

const leverFeatureNames = [
  "depth",
  "maximumPrerequisiteCount",
  "initialBlockedCount",
  "meanLegalRatio",
  "misreadVehicleRatio",
  "nearMissRatio",
  "directionChoiceRatio",
  "farBlockedRatio",
  "clearWallRatio",
  "hiddenLegalRatio",
  "sideBySideRatio",
  "vehicleCount",
  "cellCount",
  "occupancy",
  "fixedAreaCellCount",
] as const satisfies readonly (keyof ParkingJamStudyFeatures)[];

function printLeverCrossTable(
  records: readonly AnalyzedRecord[],
  rowLabel: string,
  rowLever: (features: ParkingJamStudyFeatures) => number,
  columnLabel: string,
  columnLever: (features: ParkingJamStudyFeatures) => number,
): void {
  console.log(
    `\n### ${rowLabel}レバー × ${columnLabel}レバー（件数と行内の割合）\n`,
  );
  console.log(`| ${rowLabel} \\ ${columnLabel} | 1 | 2 | 3 |`);
  console.log("| --- | ---: | ---: | ---: |");
  for (const rowGrade of [1, 2, 3]) {
    const row = records.filter(
      (record) => rowLever(record.features) === rowGrade,
    );
    console.log(
      `| ${rowGrade} | ${[1, 2, 3]
        .map((columnGrade) => {
          const count = row.filter(
            (record) => columnLever(record.features) === columnGrade,
          ).length;
          return `${count}（${percent(count, row.length)}）`;
        })
        .join(" | ")} |`,
    );
  }
}

function printLeverIndependence(records: readonly AnalyzedRecord[]): void {
  console.log("\n## レバーの独立性\n");
  console.log("### レバー特徴同士・規模との順位相関（Spearman）\n");
  console.log(`| | ${leverFeatureNames.join(" | ")} |`);
  console.log(`| --- |${leverFeatureNames.map(() => " ---: |").join("")}`);
  for (const rowName of leverFeatureNames) {
    const row = records.map((record) => record.features[rowName]);
    console.log(
      `| ${rowName} | ${leverFeatureNames
        .map((columnName) =>
          spearman(
            row,
            records.map((record) => record.features[columnName]),
          ).toFixed(2),
        )
        .join(" | ")} |`,
    );
  }

  const inRange = records.filter(
    (record) =>
      record.features.depth >= 2 &&
      record.features.initialBlockedCount >= 2 &&
      record.features.depth <= 6,
  );
  console.log(
    `\n### 依存レバー × 読み違いレバー（提供範囲内 ${inRange.length}問、件数と割合）\n`,
  );
  console.log("| 依存 \\ 読み違い | 1（<1/4） | 2（1/4〜1/2） | 3（≥1/2） |");
  console.log("| --- | ---: | ---: | ---: |");
  for (const dependency of [1, 2, 3] as const) {
    const row = inRange.filter(
      (record) => dependencyLeverOf(record.features) === dependency,
    );
    console.log(
      `| ${dependency} | ${[1, 2, 3]
        .map((misread) => {
          const count = row.filter(
            (record) => misreadLeverOf(record.features) === misread,
          ).length;
          return `${count}（${percent(count, row.length)}）`;
        })
        .join(" | ")} |`,
    );
  }

  printLeverCrossTable(
    inRange,
    "規模",
    scaleLeverOf,
    "依存",
    dependencyLeverOf,
  );
  printLeverCrossTable(
    inRange,
    "規模",
    scaleLeverOf,
    "読み違い",
    misreadLeverOf,
  );
  console.log(
    "\n### 規模レバー別の依存・読み違い特徴（中央値 (四分位, 最小–最大)）\n",
  );
  console.log(
    "| 規模 | 件数 | 段数 | 最少先行 | 初期遮断 | 平均合法車率 | 読み違いを誘う車 |",
  );
  console.log("| ---: | ---: | --- | --- | --- | --- | --- |");
  for (const grade of [1, 2, 3]) {
    const group = inRange.filter(
      (record) => scaleLeverOf(record.features) === grade,
    );
    console.log(
      `| ${grade} | ${group.length} | ${quartiles(group.map((r) => r.features.depth))} | ${quartiles(group.map((r) => r.features.maximumPrerequisiteCount))} | ${quartiles(group.map((r) => r.features.initialBlockedCount))} | ${quartiles(group.map((r) => r.features.meanLegalRatio))} | ${quartiles(group.map((r) => r.features.misreadVehicleRatio))} |`,
    );
  }
  console.log(
    "\n### 同じ依存段数の中での読み違い特徴の分布（中央値 (四分位, 最小–最大)）\n",
  );
  console.log(
    "| 段数 | 件数 | 読み違いを誘う車 | 1車線ずれの開口 | 方向判断 | 遠い遮断 |",
  );
  console.log("| ---: | ---: | --- | --- | --- | --- |");
  for (const depth of [2, 3, 4, 5]) {
    const group = inRange.filter((record) =>
      depth === 5
        ? record.features.depth >= 5
        : record.features.depth === depth,
    );
    console.log(
      `| ${depth === 5 ? "5〜6" : depth} | ${group.length} | ${quartiles(group.map((r) => r.features.misreadVehicleRatio))} | ${quartiles(group.map((r) => r.features.nearMissRatio))} | ${quartiles(group.map((r) => r.features.directionChoiceRatio))} | ${quartiles(group.map((r) => r.features.farBlockedRatio))} |`,
    );
  }

  console.log("\n### 生成条件ごとの読み違い特徴（平均）\n");
  console.log(
    "| 生成条件 | 値 | 件数 | 読み違いを誘う車 | 1車線ずれの開口 | 方向判断 | 遠い遮断 | 段数 |",
  );
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  const knobs = [
    ["道路開口数", (c: ParkingJamGenerationConditions) => c.roadOpeningCount],
    ["開口幅", (c: ParkingJamGenerationConditions) => c.roadOpeningSpan],
    ["固定物数", (c: ParkingJamGenerationConditions) => c.fixedAreaCount],
    [
      "遮断バイアス",
      (c: ParkingJamGenerationConditions) => c.blockingPlacementProbability,
    ],
    ["車両数", (c: ParkingJamGenerationConditions) => c.vehicleCount],
    ["マス数", (c: ParkingJamGenerationConditions) => c.width * c.height],
  ] as const;
  for (const [label, knob] of knobs) {
    const values = [...new Set(inRange.map((r) => knob(r.conditions)))].sort(
      (left, right) => left - right,
    );
    for (const value of values) {
      const group = inRange.filter((r) => knob(r.conditions) === value);
      function mean(name: keyof ParkingJamStudyFeatures): string {
        return (
          group.reduce((total, r) => total + Number(r.features[name]), 0) /
          group.length
        ).toFixed(2);
      }
      console.log(
        `| ${label} | ${value} | ${group.length} | ${mean("misreadVehicleRatio")} | ${mean("nearMissRatio")} | ${mean("directionChoiceRatio")} | ${mean("farBlockedRatio")} | ${mean("depth")} |`,
      );
    }
  }
}

function printVariantEffect(records: readonly AnalyzedRecord[]): void {
  const baseByIdentity = new Map(
    records
      .filter((record) => !record.variant)
      .map((record) => [JSON.stringify(record.identity), record]),
  );
  for (const variant of ["decoy", "trimmed"]) {
    const variants = records.filter((record) => record.variant === variant);
    if (variants.length === 0) continue;
    const pairs = variants.flatMap((record) => {
      const base = baseByIdentity.get(JSON.stringify(record.identity));
      return base ? [{ base, record }] : [];
    });
    const sameDependency = pairs.filter(
      ({ base, record }) =>
        dependencySignature(base.features) ===
        dependencySignature(record.features),
    ).length;
    console.log(
      `\n### 開口変換「${variant}」: ${pairs.length}問（依存特徴が元と同一 ${sameDependency}問）\n`,
    );
    console.log("| 読み違いレバー 元 \\ 変換後 | 1 | 2 | 3 |");
    console.log("| --- | ---: | ---: | ---: |");
    for (const from of [1, 2, 3]) {
      const row = pairs.filter(
        ({ base }) => misreadLeverOf(base.features) === from,
      );
      console.log(
        `| ${from} | ${[1, 2, 3]
          .map(
            (to) =>
              row.filter(({ record }) => misreadLeverOf(record.features) === to)
                .length,
          )
          .join(" | ")} |`,
      );
    }
    console.log(
      `\n読み違いを誘う車の割合の変化: ${quartiles(pairs.map(({ base, record }) => record.features.misreadVehicleRatio - base.features.misreadVehicleRatio))}`,
    );
  }
}

/**
 * 開口変換を供給に使う場合の収率。元の問題か、その開口変換（decoy / trimmed）のどれかが
 * そのレベルに当たれば、その候補からそのレベルの問題を1問作れるとみなす。
 */
function printTransformYield(
  records: readonly AnalyzedRecord[],
  candidateCount: number,
): void {
  const byIdentity = new Map<string, AnalyzedRecord[]>();
  for (const record of records) {
    const key = JSON.stringify(record.identity);
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), record]);
  }
  const transformedCount = [...byIdentity.values()].filter((group) =>
    group.some((record) => record.variant),
  ).length;
  if (transformedCount === 0) return;
  console.log(
    `\n## 開口変換を使う場合の収率（候補 ${candidateCount}、変換を試した問題 ${transformedCount}）\n`,
  );
  console.log("| 案 | 1 | 2 | 3 | 4 | 5 |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const plan of studyPlans.filter((candidate) =>
    ["M1", "M3", "T1", "T3", "T1s"].includes(candidate.id),
  )) {
    const counts = ["1", "2", "3", "4", "5"].map((level) => {
      const withoutTransform = [...byIdentity.values()].filter((group) =>
        group.some(
          (record) =>
            !record.variant &&
            formatStudyAssessment(plan.classify(record.features)) === level,
        ),
      ).length;
      const withTransform = [...byIdentity.values()].filter((group) =>
        group.some(
          (record) =>
            formatStudyAssessment(plan.classify(record.features)) === level,
        ),
      ).length;
      return `${percent(withoutTransform, candidateCount)} → ${percent(withTransform, candidateCount)}`;
    });
    console.log(`| ${plan.id} | ${counts.join(" | ")} |`);
  }
}

function runReport(): void {
  const input = readOption("in");
  if (!input) throw new Error(usage);
  const records = readRecords(input);
  const allAnalyzed = records.filter(isAnalyzed);
  const analyzed = allAnalyzed.filter((record) => !record.variant);
  const milliseconds = sortedNumbers(
    records.map((record) => record.milliseconds),
  );
  console.log(
    `# 問題集合: ${records.length} 候補, 生成成功 ${analyzed.length} (${percent(analyzed.length, records.length)}), 候補1つあたりの時間 p50 ${quantileOf(milliseconds, 0.5).toFixed(0)}ms / p95 ${quantileOf(milliseconds, 0.95).toFixed(0)}ms（生成＋本番分析＋調査用分析）`,
  );
  printFeatureOverview(analyzed);
  printLeverIndependence(analyzed);
  printVariantEffect(allAnalyzed);
  printPlanComparison(
    analyzed,
    records.filter((record) => !record.variant).length,
  );
  printTransformYield(
    allAnalyzed,
    records.filter((record) => !record.variant).length,
  );
  for (const plan of studyPlans) printPlanDetail(analyzed, plan);
  const recommended = findStudyPlan("T3");
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
  const random = createProblemSeededRandom(
    `${PRODUCTION_SUPPLY_VERSION}:${seed}`,
  );
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
  const plan = findStudyPlan(readOption("plan") ?? "T3");
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
    `規模${scaleLeverOf(features)}: ${features.width}x${features.height}・${features.vehicleCount}台・固定物${features.fixedAreaCount}`,
    `依存${dependencyLeverOf(features)}: 段数${features.depth}（${features.layerSizes.join("/")}）・先行${features.maximumPrerequisiteCount}・初期遮断${features.initialBlockedCount}`,
    `読み違い${misreadLeverOf(features)}: ${(features.misreadVehicleRatio * 100).toFixed(0)}%（ずれ開口${(features.nearMissRatio * 100).toFixed(0)}%・方向判断${(features.directionChoiceRatio * 100).toFixed(0)}%・遠い遮断${(features.farBlockedRatio * 100).toFixed(0)}%）`,
    `平均合法率${features.meanLegalRatio.toFixed(2)}`,
    `v1 ${features.v1Difficulty.split(":")[1]}(${features.v1Score.toFixed(2)})`,
  ].join(" · ");
}

function identityLine(record: AnalyzedRecord): string {
  const identity = `identity: \`${JSON.stringify(record.identity)}\``;
  return record.variant
    ? `${identity}（この問題を開口変換「${record.variant}」した盤面。開口: \`${JSON.stringify(record.board?.roadOpenings)}\`）`
    : identity;
}

function levelOf(plan: StudyPlan, record: AnalyzedRecord): string {
  return formatStudyAssessment(plan.classify(record.features));
}

function dependencySignature(features: ParkingJamStudyFeatures): string {
  return JSON.stringify([
    features.depth,
    features.layerSizes,
    features.maximumPrerequisiteCount,
    features.initialBlockedCount,
    features.meanLegalRatio.toFixed(6),
  ]);
}

function pickProblems(
  records: readonly AnalyzedRecord[],
  plan: StudyPlan,
): PickedProblem[] {
  const picked: PickedProblem[] = [];
  const used = new Set<AnalyzedRecord>();
  const baseRecords = records.filter((record) => !record.variant);
  function take(
    kind: string,
    note: string,
    candidates: readonly AnalyzedRecord[],
    score: (record: AnalyzedRecord) => number,
    count = 1,
  ): AnalyzedRecord[] {
    const ordered = [...candidates]
      .filter((record) => !used.has(record))
      .sort((left, right) => score(left) - score(right));
    const sizes = new Set<string>();
    const taken: AnalyzedRecord[] = [];
    for (const record of ordered) {
      if (taken.length >= count) break;
      const size = boardSizeOf(record.features);
      if (count > 1 && sizes.has(size) && ordered.length > count * 3) continue;
      sizes.add(size);
      used.add(record);
      picked.push({ kind, note, record });
      taken.push(record);
    }
    return taken;
  }
  function inLevel(level: string): AnalyzedRecord[] {
    return baseRecords.filter((record) => levelOf(plan, record) === level);
  }
  function leverDistance(
    record: AnalyzedRecord,
    target: { misread: number; legal: number; blocked: number },
  ): number {
    return (
      Math.abs(record.features.misreadVehicleRatio - target.misread) * 10 +
      Math.abs(record.features.meanLegalRatio - target.legal) * 10 +
      Math.abs(record.features.initialBlockedCount - target.blocked)
    );
  }

  for (const level of ["1", "2", "3", "4", "5"]) {
    const group = inLevel(level);
    const target = {
      misread: Number(median(group.map((r) => r.features.misreadVehicleRatio))),
      legal: Number(median(group.map((r) => r.features.meanLegalRatio))),
      blocked: Number(median(group.map((r) => r.features.initialBlockedCount))),
    };
    take(
      `代表 ${level}`,
      "レベル内の中央値に近い",
      group,
      (record) => leverDistance(record, target),
      2,
    );
  }

  // 読み違いだけが違う対: 同じ依存（段数・段ごとの車数・先行台数）で、読み違いが弱い／強い
  for (const dependency of [1, 2, 3] as const) {
    const pool = baseRecords.filter(
      (r) =>
        dependencyLeverOf(r.features) === dependency &&
        !levelOf(plan, r).startsWith("too"),
    );
    const bySignature = new Map<string, AnalyzedRecord[]>();
    for (const record of pool) {
      const key = JSON.stringify([
        record.features.depth,
        record.features.maximumPrerequisiteCount,
        record.features.initialBlockedCount,
        record.features.vehicleCount,
        record.features.cellCount,
        record.features.fixedAreaCount,
      ]);
      bySignature.set(key, [...(bySignature.get(key) ?? []), record]);
    }
    const pair = [...bySignature.values()]
      .map((group) => {
        const low = group.filter((r) => misreadLeverOf(r.features) === 1);
        const high = group.filter((r) => misreadLeverOf(r.features) === 3);
        return { low, high, size: Math.min(low.length, high.length) };
      })
      .filter((entry) => entry.size > 0)
      .sort((left, right) => right.size - left.size)[0];
    if (!pair) continue;
    take(
      `対A${dependency} 読み違い弱`,
      `依存${dependency}で読み違いだけが弱い（段数・先行台数・初期遮断・盤面・車両数・固定物数が同じ相手あり）`,
      pair.low,
      (r) => r.features.misreadVehicleRatio,
    );
    take(
      `対A${dependency} 読み違い強`,
      `依存${dependency}で読み違いだけが強い`,
      pair.high,
      (r) => -r.features.misreadVehicleRatio,
    );
  }

  // 依存だけが違う対: 読み違い割合と車両数・盤面がほぼ同じで、依存が弱い／強い
  for (const misread of [1, 2, 3] as const) {
    const pool = baseRecords.filter(
      (r) =>
        misreadLeverOf(r.features) === misread &&
        !levelOf(plan, r).startsWith("too"),
    );
    const low = pool.filter((r) => dependencyLeverOf(r.features) === 1);
    const high = pool.filter((r) => dependencyLeverOf(r.features) === 3);
    const [lowPick] = take(
      `対B${misread} 依存弱`,
      `読み違い${misread}で依存だけが弱い`,
      low.filter((r) => r.features.vehicleCount === 8),
      (r) =>
        Math.abs(
          r.features.misreadVehicleRatio -
            (misread === 1 ? 0.13 : misread === 2 ? 0.38 : 0.63),
        ),
    );
    if (!lowPick) continue;
    take(
      `対B${misread} 依存強`,
      `読み違い${misread}で依存だけが強い（盤面・車両数・読み違い割合を相手に揃える）`,
      high.filter(
        (r) =>
          r.features.vehicleCount === lowPick.features.vehicleCount &&
          boardSizeOf(r.features) === boardSizeOf(lowPick.features),
      ),
      (r) =>
        Math.abs(
          r.features.misreadVehicleRatio - lowPick.features.misreadVehicleRatio,
        ),
    );
  }

  // 同じ盤面の開口変換: 依存は完全に同じで、使われない開口だけが違う
  const variants = records.filter((record) => record.variant === "decoy");
  const decoyPair = variants
    .map((variant) => ({
      variant,
      base: baseRecords.find(
        (record) =>
          JSON.stringify(record.identity) === JSON.stringify(variant.identity),
      ),
    }))
    .filter(
      (entry) =>
        entry.base &&
        misreadLeverOf(entry.base.features) === 1 &&
        misreadLeverOf(entry.variant.features) >= 2 &&
        dependencyLeverOf(entry.variant.features) === 2 &&
        !used.has(entry.base),
    )[0];
  if (decoyPair?.base) {
    take("変換対 元", "開口変換の元の盤面", [decoyPair.base], () => 0);
    take(
      "変換対 開口追加",
      "同じ盤面に、どの車も使わない開口を隣の車線へ足しただけ（依存は同一）",
      [decoyPair.variant],
      () => 0,
    );
  }

  // 規模だけが違う対: 依存・読み違いのレバーと段数が同じで、読む範囲が狭い／広い
  const scalePool = baseRecords.filter(
    (r) =>
      levelOf(plan, r) === "3" &&
      dependencyLeverOf(r.features) === 2 &&
      misreadLeverOf(r.features) === 2,
  );
  const [smallScale] = take(
    "対S 規模小",
    "レベル3で読む範囲だけが狭い（6x6・8台）",
    scalePool.filter(
      (r) => r.features.cellCount === 36 && r.features.vehicleCount === 8,
    ),
    (r) => Math.abs(r.features.misreadVehicleRatio - 0.33),
  );
  if (smallScale)
    take(
      "対S 規模大",
      "レベル3で読む範囲だけが広い（8x8・14台、段数・初期遮断・読み違い割合を相手に揃える）",
      scalePool.filter(
        (r) =>
          r.features.cellCount === 64 &&
          r.features.vehicleCount >= 11 &&
          r.features.depth === smallScale.features.depth,
      ),
      (r) =>
        Math.abs(
          r.features.misreadVehicleRatio -
            smallScale.features.misreadVehicleRatio,
        ) *
          10 +
        Math.abs(
          r.features.initialBlockedCount -
            smallScale.features.initialBlockedCount,
        ) -
        r.features.vehicleCount / 100,
    );

  take(
    "境界 範囲外/1",
    "軽すぎ側: 塞がれた車が1台だけ",
    inLevel("too-light").filter((r) => r.features.depth === 2),
    (r) => -r.features.misreadVehicleRatio,
  );
  take(
    "組合せ外 依存強・読み違い弱",
    "深い依存だが読み違いを誘う車がほとんどない（この案では提供しない）",
    baseRecords.filter(
      (r) =>
        levelOf(plan, r) === "unplaced" &&
        dependencyLeverOf(r.features) === 3 &&
        misreadLeverOf(r.features) === 1,
    ),
    (r) => -r.features.depth,
  );
  take(
    "組合せ外 依存弱・読み違い強",
    "依存は浅いが読み違いを誘う車が半分以上（この案では提供しない）",
    baseRecords.filter(
      (r) =>
        levelOf(plan, r) === "unplaced" &&
        dependencyLeverOf(r.features) === 1 &&
        misreadLeverOf(r.features) === 3,
    ),
    (r) => -r.features.misreadVehicleRatio,
  );
  take(
    "異常 規模が小さいのに高い",
    "レベル5で読む範囲が最も小さい（6x8・8台）",
    inLevel("5").filter(
      (r) => r.features.cellCount === 48 && r.features.vehicleCount === 8,
    ),
    (r) => -r.features.misreadVehicleRatio,
  );
  take(
    "異常 規模が大きいのに低い",
    "8x8・14台でレベル3（規模3が入る最も低いレベル）",
    inLevel("3").filter(
      (r) => r.features.cellCount === 64 && r.features.vehicleCount === 14,
    ),
    (r) => r.features.depth,
  );
  return picked;
}

function printPicked(picked: readonly PickedProblem[], plan: StudyPlan): void {
  console.log(`# 案${plan.id} の代表・境界・異常問題\n`);
  for (const { kind, note, record } of picked) {
    console.log(`## ${kind}（${levelOf(plan, record)}）: ${note}\n`);
    console.log(`- ${identityLine(record)}`);
    console.log(`- ${describe(record.features)}\n`);
    console.log("```text");
    console.log(renderParkingJamBoard(boardOf(record)));
    console.log("```\n");
  }

  const random = createProblemSeededRandom(`pj5-blind-${plan.id}`);
  const blind = shuffleProblemValues(picked, random);
  console.log("# 伏せ字の遊び比べリスト\n");
  blind.forEach((entry, index) => {
    const code = `P${String(index + 1).padStart(2, "0")}`;
    console.log(`## ${code}\n`);
    console.log(`- ${identityLine(entry.record)}\n`);
    console.log("```text");
    console.log(renderParkingJamBoard(boardOf(entry.record)));
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
  const plan = findStudyPlan(readOption("plan") ?? "T3");
  const records = readRecords(input).filter(isAnalyzed);
  printPicked(pickProblems(records, plan), plan);
}

function runShow(): void {
  const input = readOption("in");
  if (!input) throw new Error(usage);
  const plan = findStudyPlan(readOption("plan") ?? "T3");
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

// ---- decoy ----

function runDecoy(): void {
  const input = readOption("in");
  const out = readOption("out");
  if (!input || !out) throw new Error(usage);
  const seedLimit = readInteger("seed-limit", 20);
  writeFileSync(out, "");
  for (const record of readRecords(input).filter(isAnalyzed)) {
    if (record.variant) continue;
    const seedIndex = Number(record.seed.split("-").at(-1));
    if (seedIndex >= seedLimit) continue;
    const board = restoreParkingJamProblem(record.identity).problem.board;
    const variants = [
      {
        variant: "decoy",
        board: addDecoyOpenings(
          board,
          2,
          record.conditions.roadOpeningSpan,
          createProblemSeededRandom(
            `pj5-decoy:${JSON.stringify(record.identity)}`,
          ),
        ),
      },
      { variant: "trimmed", board: removeUnusedOpenings(board) },
    ];
    for (const { variant, board: variantBoard } of variants) {
      if (
        JSON.stringify(variantBoard.roadOpenings) ===
        JSON.stringify(board.roadOpenings)
      )
        continue;
      validateParkingJamBoard(variantBoard);
      const startedAt = performance.now();
      const features = analyzeParkingJamBoardStudyFeatures(variantBoard);
      if (
        dependencySignature(features) !== dependencySignature(record.features)
      )
        throw new Error(`Opening transform changed dependency: ${record.seed}`);
      const variantRecord: CorpusRecord = {
        ...record,
        milliseconds: performance.now() - startedAt,
        features,
        board: variantBoard,
        variant,
      };
      appendFileSync(out, `${JSON.stringify(variantRecord)}\n`);
    }
  }
}

const commands: Record<string, () => void> = {
  corpus: runCorpus,
  report: runReport,
  supply: runSupply,
  pick: runPick,
  show: runShow,
  decoy: runDecoy,
};
const command = commands[Bun.argv[2] ?? ""];
if (command) command();
else console.log(usage);
