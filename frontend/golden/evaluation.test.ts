/**
 * 一方向ドア面: 評価規則（golden の仕組みは `golden-file.ts`）。
 * 記録は評価点・評価段階を持たず、読むたびに今の評価規則で求め直すので、評価規則を変えると、過去の評価・自己ベスト・
 * 図鑑の最高段階が遡って変わる。固定した記録（`fixtures/play-records/<game>.json`）を今の評価規則で評価した結果を固定する。
 * 記録の `label` は、記録を作ったときの評価規則で何を表すプレイだったか（段階の境目など）を示す。
 * golden の更新: `bun run --cwd frontend test golden -u`（その PR は PO の承認が要る扱いになる）。
 * ゲームを足したら、そのゲームの固定した記録を `fixtures/play-records/<game>.json` に置く。
 */

import { getGameResultLevel } from "@/games/result";
import { isRecordObject } from "@/lib/type-guards";
import { isPlayRecord, type PlayRecord } from "@/records/play-record";
import {
  PLAY_SCORE_METRIC_ID,
  type PlayRecordDefinition,
} from "@/records/play-record-definition";
import {
  expectGoldenFile,
  findGameExport,
  groupGameModules,
  listGoldenFileNames,
  readGoldenFixture,
} from "./golden-file";

type FixedPlayRecord = { label: string; record: PlayRecord };

type RestoreRecordedResult = (record: PlayRecord) => { result: unknown } | null;

const goldenDirectory = "snapshots/evaluation";

/** ゲームごとに、何を良いプレイとして称えるか（評価の観点）を決めているパズルの仕様。 */
const puzzleSpecIds: Readonly<Record<string, string>> = {
  nanpure: "SPEC-008",
  "water-sort": "SPEC-009",
  minesweeper: "SPEC-010",
  "slide-puzzle": "SPEC-011",
  takuzu: "SPEC-012",
  reflection: "SPEC-013",
  "parking-jam": "SPEC-018",
  "hitofude-puzzle": "SPEC-020",
  "tsume-shogi": "SPEC-021",
  "ice-floor-maze": "SPEC-025",
};

function isFixedPlayRecord(value: unknown): value is FixedPlayRecord {
  return (
    isRecordObject(value) &&
    typeof value.label === "string" &&
    isPlayRecord(value.record)
  );
}

function readFixedPlayRecords(gameId: string): FixedPlayRecord[] {
  const fixture = readGoldenFixture(`play-records/${gameId}.json`);
  if (!Array.isArray(fixture) || !fixture.every(isFixedPlayRecord)) {
    throw new Error(
      `fixtures/play-records/${gameId}.json is not a list of labeled play records`,
    );
  }
  return fixture;
}

const playRecordGames = groupGameModules(
  import.meta.glob<Record<string, unknown>>("/src/games/*/play-record.ts", {
    eager: true,
  }),
).map(([gameId, module]) => ({
  gameId,
  puzzleSpecId: puzzleSpecIds[gameId] ?? "仕様未登録",
  definition: findGameExport(
    module,
    /^[a-z][A-Za-z]+PlayRecordDefinition$/,
  ) as PlayRecordDefinition,
  restoreRecordedResult: findGameExport(
    module,
    /^restore[A-Za-z]+RecordedResult$/,
  ) as RestoreRecordedResult,
}));

function evaluatePlayRecord(
  { label, record }: FixedPlayRecord,
  definition: PlayRecordDefinition,
  restoreRecordedResult: RestoreRecordedResult,
) {
  const metrics = Object.fromEntries(
    definition.personalBestMetrics.map((metric) => [
      metric.id,
      metric.getValue(record),
    ]),
  );
  const playScore = metrics[PLAY_SCORE_METRIC_ID] ?? null;
  return {
    label,
    recordId: record.id,
    recognized: definition.isRecord(record),
    comparisonKey: definition.getComparisonKey(record),
    clearPerformance: definition.getClearPerformance(record),
    metrics,
    resultLevel: playScore === null ? null : getGameResultLevel(playScore),
    restoredResult: restoreRecordedResult(record)?.result ?? null,
  };
}

describe.each(playRecordGames)(
  "SPEC-006・SPEC-002 評価規則: $gameId（$puzzleSpecId）",
  ({ gameId, definition, restoreRecordedResult }) => {
    const fixedPlayRecords = readFixedPlayRecords(gameId);

    test("固定した記録を今の評価規則で評価した評価点・評価段階・自己ベストの指標・結果が golden と一致すること", async () => {
      const evaluations = fixedPlayRecords.map((fixed) =>
        evaluatePlayRecord(fixed, definition, restoreRecordedResult),
      );

      await expectGoldenFile(evaluations, `${goldenDirectory}/${gameId}.json`);
    });
  },
);

describe("SPEC-006 評価規則の golden", () => {
  const gameIds = playRecordGames.map(({ gameId }) => gameId).sort();

  test("今あるゲームの評価規則だけを golden に持つこと", () => {
    const goldenGameIds = listGoldenFileNames(goldenDirectory);

    expect(goldenGameIds).toEqual(gameIds);
  });
});
