/**
 * 一方向ドア面: 端末（localStorage）の保存形式（golden の仕組みは `golden-file.ts`）。
 * 保存したデータは遊ぶ人の端末にしか無く、読めなくなると取り返せない。今の形式と、コードが読み続けている前の形式の
 * 保存データを固定し（`fixtures/storage/`、記録は評価規則と同じ `fixtures/play-records/`）、今のコードで読んだ結果を固定する。
 * 保存のキーはコードの定数を使わず fixture かここに文字列で書くので、キーを変えると読めなくなったことが golden の差分に出る。
 * golden の更新: `bun run --cwd frontend test golden -u`（その PR は PO の承認が要る扱いになる）。
 */

import { gameCatalog } from "@/game-catalog/game-catalog";
import { toZukanGameSource } from "@/game-catalog/game-catalog-entry";
import {
  getAbandonedPlayAttempts,
  type PlayAttempt,
} from "@/records/play-attempt";
import { readPlayAttempts } from "@/records/play-attempt-storage";
import type { PlayRecord } from "@/records/play-record";
import { type PlayRecordStorage, readPlayRecords } from "@/records/storage";
import {
  deriveGameZukan,
  type GameZukan,
  getZukanProblemStatus,
} from "@/zukan/zukan-collection";
import { readZukanLastViewed } from "@/zukan/zukan-last-viewed-storage";
import {
  expectGoldenFile,
  listGoldenFileNames,
  readGoldenFixture,
} from "./golden-file";

type StoredItems = Record<string, unknown>;

type VolumeSettingsFixture = { label: string; items: StoredItems };

/** 完了記録を保存するキー。記録の fixture はゲームごとのファイルに分けて置くので、キーだけをここに書く。 */
const playRecordsStorageKey = "pa-zzle.play-records.v1";

/** 保存データの fixture を、保存したときと同じく JSON 文字列として持つ保存先。 */
function createFixtureStorage(items: StoredItems): PlayRecordStorage {
  const stored = new Map(
    Object.entries(items).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  return {
    getItem(key) {
      return stored.get(key) ?? null;
    },
    setItem(key, value) {
      stored.set(key, value);
    },
  };
}

function readFixedPlayRecords(): unknown[] {
  return listGoldenFileNames("fixtures/play-records").flatMap((gameId) =>
    (
      readGoldenFixture(`play-records/${gameId}.json`) as { record: unknown }[]
    ).map(({ record }) => record),
  );
}

function findCatalogEntry(gameId: string) {
  return gameCatalog.find((entry) => entry.id === gameId) ?? null;
}

function describeStoredPlayRecord(record: PlayRecord) {
  const entry = findCatalogEntry(record.gameId);
  return {
    recordId: record.id,
    gameId: record.gameId,
    payloadVersion: record.payloadVersion,
    knownGame: entry !== null,
    replayTarget: entry?.recordProblemPlayTarget(record) ?? null,
    hasRecordResult: entry?.hasRecordResult(record) ?? false,
  };
}

function describeStoredPlayAttempt(attempt: PlayAttempt) {
  return {
    ...attempt,
    replayTarget:
      findCatalogEntry(attempt.gameId)?.attemptProblemPlayTarget(attempt) ??
      null,
  };
}

/** 図鑑の全枠のうち、未挑戦でない枠だけ。未挑戦の枠は問題集の golden と同じ並びなので写さない。 */
function summarizeZukan({ sections, ...counts }: GameZukan) {
  return {
    ...counts,
    touchedProblems: sections.flatMap(({ problems }) =>
      problems
        .map((problem) => ({
          ...problem,
          status: getZukanProblemStatus(problem),
        }))
        .filter(({ status }) => status !== "untouched"),
    ),
  };
}

/**
 * 音量の設定はモジュールを読み込んだあと最初に使うときに端末から読むので、保存データごとにモジュールを読み込み直す。
 * `toggleMuted` は、消音を戻すときに覚えている音量（`unmutedVolume`）を確かめるために使う。
 */
async function readVolumeSettings(items: StoredItems) {
  vi.stubGlobal("window", { localStorage: createFixtureStorage(items) });
  vi.resetModules();
  const { soundEffectsVolumeSetting } = await import(
    "@/lib/sound-effects-setting"
  );
  const { backgroundMusicVolumeSetting } = await import(
    "@/lib/background-music-setting"
  );
  return Object.fromEntries(
    Object.entries({
      soundEffects: soundEffectsVolumeSetting,
      backgroundMusic: backgroundMusicVolumeSetting,
    }).map(([name, setting]) => {
      const volume = setting.getVolume();
      setting.toggleMuted();
      return [name, { volume, volumeAfterToggleMuted: setting.getVolume() }];
    }),
  );
}

describe("SPEC-001・SPEC-014 プレイ履歴の保存形式", () => {
  const storage = createFixtureStorage({
    [playRecordsStorageKey]: readFixedPlayRecords(),
  });

  test("保存した記録を今のコードで読んだ結果と、遊び直せる問題・結果画面を作り直せるかが golden と一致すること", async () => {
    const storedPlayRecords = readPlayRecords(storage).map(
      describeStoredPlayRecord,
    );

    await expectGoldenFile(
      storedPlayRecords,
      "snapshots/storage/play-records.json",
    );
  });
});

describe("SPEC-015 完了しなかったプレイの保存形式", () => {
  const storage = createFixtureStorage({
    ...(readGoldenFixture("storage/device.json") as StoredItems),
    [playRecordsStorageKey]: readFixedPlayRecords(),
  });

  test("保存した試行を今のコードで読んだ結果と、離脱として扱う試行が golden と一致すること", async () => {
    const attempts = readPlayAttempts(storage);
    const storedPlayAttempts = {
      attempts: attempts.map(describeStoredPlayAttempt),
      abandoned: getAbandonedPlayAttempts(
        attempts,
        readPlayRecords(storage),
      ).map(({ gameId, startedAt }) => ({ gameId, startedAt })),
    };

    await expectGoldenFile(
      storedPlayAttempts,
      "snapshots/storage/play-attempts.json",
    );
  });
});

describe("SPEC-026 図鑑の保存形式", () => {
  const storage = createFixtureStorage({
    ...(readGoldenFixture("storage/device.json") as StoredItems),
    [playRecordsStorageKey]: readFixedPlayRecords(),
  });

  test("図鑑を前回見たときの保存と、保存した記録と試行から導く図鑑の各問の状態が golden と一致すること", async () => {
    const records = readPlayRecords(storage);
    const attempts = readPlayAttempts(storage);
    const zukanByGame = Object.fromEntries(
      gameCatalog.map((entry) => [
        entry.id,
        {
          lastViewed: readZukanLastViewed(entry.id, storage),
          zukan: summarizeZukan(
            deriveGameZukan(toZukanGameSource(entry), records, attempts),
          ),
        },
      ]),
    );

    await expectGoldenFile(zukanByGame, "snapshots/storage/zukan.json");
  });
});

describe("SPEC-019 音量の設定の保存形式", () => {
  const fixtures = readGoldenFixture(
    "storage/volume-settings.json",
  ) as VolumeSettingsFixture[];

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test("保存した音量の設定を今のコードで読んだ音量と、消音を切り替えたあとの音量が golden と一致すること", async () => {
    const volumeSettings = [];
    for (const { label, items } of fixtures) {
      volumeSettings.push({ label, ...(await readVolumeSettings(items)) });
    }

    await expectGoldenFile(
      volumeSettings,
      "snapshots/storage/volume-settings.json",
    );
  });
});
