/**
 * 魔方陣の難易度（版 8）の確かめと計測。本番の読むモデル・分類・生成器をそのまま使い、本番挙動は変えない。
 */
import {
  assessMagicSquareDifficulty,
  classifyMagicSquareReadingOnBoard,
  findMagicSquareDisagreeingReading,
  MAGIC_SQUARE_SWEEP_LIMIT,
} from "@/games/magic-square/difficulty";
import { analyzeMagicSquareDifficulty } from "@/games/magic-square/problem/difficulty-analysis";
import { listAllMagicSquares4 } from "@/games/magic-square/problem/generation/answers";
import {
  createMagicSquareCandidateRandom,
  formatMagicSquareCandidateConditions,
  generateMagicSquareCandidate,
  type MagicSquareCandidateConditions,
} from "@/games/magic-square/problem/generation/candidate";
import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import { listMagicSquareReadingCombinations } from "@/games/magic-square/problem/generation/reading-parts";
import type { MagicSquareBoardSize } from "@/games/magic-square/problem/problem";

const usage = `Usage: bun scripts/analyze-magic-square-difficulty.ts <command> [options]

Commands:
  reference  移植の期待値（difficulty-reference.json の 88 候補）の全部で、レベル・範囲外の理由と、部品の組み合わせで
             基準と違うレベルになる最初の組と確かめた数を突き合わせる（単体テストは軽い候補だけを確かめる）
  timing     生成条件ごとに先頭の候補を作って分類し、1候補の時間と当たるレベルを出す
             --conditions <id>[,<id>...]（既定は全部。例: 5-T3-polish5） --count <n>（既定 12）`;

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function runReference(): void {
  const combinations = listMagicSquareReadingCombinations();
  let mismatches = 0;
  for (const entry of reference.cases) {
    const startedAt = performance.now();
    const analysis = analyzeMagicSquareDifficulty(entry.size, entry.givens);
    const assessment = assessMagicSquareDifficulty(analysis);
    const actual: Record<string, unknown> = {
      level:
        assessment.status === "classified"
          ? Number(assessment.difficulty)
          : null,
      reason: assessment.status === "out-of-range" ? assessment.reason : null,
    };
    const expected: Record<string, unknown> = {
      level: entry.level,
      reason: entry.reason,
    };
    if (entry.combinations !== null && analysis.status === "analyzed") {
      // 調査コードは、盤面の割り当てを当てない基準のレベルと、組み合わせだけを比べた。
      const { level } = classifyMagicSquareReadingOnBoard(
        analysis.features.reading,
        () => analysis.features.virtualReading,
        { sweepLimit: MAGIC_SQUARE_SWEEP_LIMIT, boardSize: null },
      );
      const readingId =
        level === null
          ? null
          : findMagicSquareDisagreeingReading(analysis, level);
      const position = combinations.findIndex(({ id }) => id === readingId);
      actual.firstDisagreeing = readingId;
      actual.checked = readingId === null ? combinations.length : position + 1;
      expected.firstDisagreeing = entry.combinations.firstDisagreeing;
      expected.checked = entry.combinations.checked;
    }
    const matches = JSON.stringify(actual) === JSON.stringify(expected);
    mismatches += matches ? 0 : 1;
    console.log(
      [
        matches ? "ok" : "MISMATCH",
        entry.id,
        JSON.stringify(actual),
        matches ? "" : `expected ${JSON.stringify(expected)}`,
        `${Math.round(performance.now() - startedAt)}ms`,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  console.log(`${reference.cases.length} cases, ${mismatches} mismatches`);
  process.exitCode = mismatches === 0 ? 0 : 1;
}

/** 調査で当たりやすかった生成条件（難易度の資料 §6.2）。 */
const timingConditions: readonly MagicSquareCandidateConditions[] = [
  { size: 4, maxTier: 1, finish: { kind: "add-back", count: 0 } },
  { size: 4, maxTier: 2, finish: { kind: "add-back", count: 0 } },
  { size: 4, maxTier: 2, finish: { kind: "add-back", count: 1 } },
  { size: 4, maxTier: 3, finish: { kind: "add-back", count: 1 } },
  ...([5, 6] as const).flatMap((size: MagicSquareBoardSize) => [
    { size, maxTier: 2, finish: { kind: "add-back", count: 0 } } as const,
    { size, maxTier: 2, finish: { kind: "add-back", count: 1 } } as const,
    { size, maxTier: 2, finish: { kind: "add-back", count: 2 } } as const,
    { size, maxTier: 2, finish: { kind: "polish", target: "5" } } as const,
    { size, maxTier: 2, finish: { kind: "polish", target: "4" } } as const,
    { size, maxTier: 3, finish: { kind: "polish", target: "5" } } as const,
    { size, maxTier: 3, finish: { kind: "polish", target: "4" } } as const,
  ]),
];

function quantile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function runTiming(): void {
  const count = Number(readOption("--count") ?? 12);
  const selected = readOption("--conditions")?.split(",");
  const conditions = timingConditions.filter(
    (candidate) =>
      !selected ||
      selected.includes(formatMagicSquareCandidateConditions(candidate)),
  );
  // 4×4 の答えは全部の魔方陣から選ぶ。数え上げは1プロセスで1回なので、時間に入れない。
  listAllMagicSquares4();
  for (const condition of conditions) {
    const generateMs: number[] = [];
    const assessMs: number[] = [];
    const outcomes = new Map<string, number>();
    for (let index = 0; index < count; index += 1) {
      const generatedAt = performance.now();
      const candidate = generateMagicSquareCandidate(
        condition,
        createMagicSquareCandidateRandom(condition, index),
      );
      const assessedAt = performance.now();
      const assessment = assessMagicSquareDifficulty(
        analyzeMagicSquareDifficulty(condition.size, candidate.givens),
      );
      const finishedAt = performance.now();
      generateMs.push(assessedAt - generatedAt);
      assessMs.push(finishedAt - assessedAt);
      const outcome =
        assessment.status === "classified"
          ? `L${assessment.difficulty}`
          : assessment.status === "out-of-range"
            ? assessment.reason
            : assessment.status;
      outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
    }
    const seconds = (values: readonly number[]) =>
      `${(quantile(values, 0.5) / 1000).toFixed(2)}/${(quantile(values, 0.95) / 1000).toFixed(2)}`;
    const total = generateMs.map((value, index) => value + assessMs[index]!);
    const mean = total.reduce((sum, value) => sum + value, 0) / count / 1000;
    console.log(
      [
        formatMagicSquareCandidateConditions(condition),
        `n=${count}`,
        `generate p50/p95 ${seconds(generateMs)}s`,
        `assess p50/p95 ${seconds(assessMs)}s`,
        `mean ${mean.toFixed(2)}s`,
        [...outcomes]
          .sort(([left], [right]) => (left < right ? -1 : 1))
          .map(([outcome, value]) => `${outcome}:${value}`)
          .join(" "),
      ].join("  "),
    );
  }
}

const command = process.argv[2];
if (command === "reference") {
  runReference();
} else if (command === "timing") {
  runTiming();
} else {
  console.error(usage);
  process.exitCode = 1;
}
