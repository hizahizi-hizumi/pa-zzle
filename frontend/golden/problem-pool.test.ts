/**
 * 一方向ドア面: 問題 ID・生成器の版・問題集の並び・格納されている難易度（golden の仕組みは `golden-file.ts`）。
 * 問題 ID は記録・URL・図鑑の枠が問題を指す唯一の手がかりなので、問題 ID の求め方、生成器の版、問題集の並びと
 * 難易度の分け方のどれが変わっても、ここの golden に差分が出る。
 * golden の更新: `bun run --cwd frontend test golden -u`（その PR は PO の承認が要る扱いになる）。
 */

import { createHash } from "node:crypto";
import path from "node:path";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import {
  listTsumeShogiPoolEntries,
  listTsumeShogiPoolProblemIds,
  storeTsumeShogiProblemPool,
  toTsumeShogiPoolIdentity,
} from "@/games/tsume-shogi/problem/problem-pool";
import {
  expectGoldenFile,
  findGameExport,
  groupGameModules,
  listGoldenFileNames,
  readFrontendJson,
} from "./golden-file";

type ListPoolProblemIds = (difficulty: DifficultyLevel) => readonly ProblemId[];

const goldenDirectory = "snapshots/problem-pool";

const generatorVersionByGame = new Map(
  groupGameModules(
    import.meta.glob<Record<string, unknown>>(
      "/src/games/*/problem/problem.ts",
      {
        eager: true,
      },
    ),
  ).map(([gameId, module]) => [
    gameId,
    findGameExport(module, /^[A-Z_]+_GENERATOR_VERSION$/),
  ]),
);

/**
 * 問題集のファイルの版などの文字列の項目と、レベルごとの各問の中身の digest。
 * 問題 ID は identity だけから求めるので、生成器の版を上げずに問題の中身を変えると、同じ問題 ID が別の問題を指す。
 * その変化を、各問を golden に写さずに digest の差分で見えるようにする。
 */
function describePoolFile(poolFilePath: string) {
  const { levels, ...poolFile } = readFrontendJson(poolFilePath) as Record<
    string,
    unknown
  >;
  return {
    ...Object.fromEntries(
      Object.entries(poolFile).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    levelDigests: Object.fromEntries(
      Object.entries(levels as Record<string, unknown>).map(
        ([level, entries]) => [
          level,
          createHash("sha256").update(JSON.stringify(entries)).digest("hex"),
        ],
      ),
    ),
  };
}

const poolFilePaths = Object.keys(
  import.meta.glob("/src/games/*/problem/problem-pool*.json"),
);

function describePoolFiles(gameId: string) {
  return Object.fromEntries(
    poolFilePaths
      .filter((poolFilePath) =>
        poolFilePath.startsWith(`/src/games/${gameId}/`),
      )
      .map((poolFilePath) => [
        path.basename(poolFilePath),
        describePoolFile(poolFilePath),
      ]),
  );
}

const problemPools = groupGameModules(
  import.meta.glob<Record<string, unknown>>(
    "/src/games/*/problem/problem-pool.ts",
    { eager: true },
  ),
).map(([gameId, module]) => ({
  gameId,
  listPoolProblemIds: findGameExport(
    module,
    /^list[A-Za-z]+PoolProblemIds$/,
  ) as ListPoolProblemIds,
}));

function describeProblemPool(listPoolProblemIds: ListPoolProblemIds) {
  const problemIds = Object.fromEntries(
    difficultyLevels.map(({ id }) => [id, listPoolProblemIds(id)]),
  );
  return {
    problemCounts: Object.fromEntries(
      Object.entries(problemIds).map(([level, ids]) => [level, ids.length]),
    ),
    problemIds,
  };
}

describe.each(problemPools)(
  "SPEC-014・SPEC-005・SPEC-026 問題集: $gameId",
  ({ gameId, listPoolProblemIds }) => {
    test("各レベルの問題集の全問の問題 ID と並びと問題数、生成器と問題集の版が golden と一致すること", async () => {
      const problemPool = {
        currentGeneratorVersion: generatorVersionByGame.get(gameId),
        poolFiles: describePoolFiles(gameId),
        ...describeProblemPool(listPoolProblemIds),
      };

      await expectGoldenFile(problemPool, `${goldenDirectory}/${gameId}.json`);
    });
  },
);

describe("SPEC-014 問題集の golden", () => {
  const gameIds = problemPools.map(({ gameId }) => gameId).sort();

  test("今あるゲームの問題集だけを golden に持つこと", () => {
    const goldenGameIds = listGoldenFileNames(goldenDirectory);

    expect(goldenGameIds).toEqual(gameIds);
  });
});

// 詰将棋の問題 ID は索引（problem-pool-index.json）から求め、記録と URL はその ID で本体（problem-pool.json）の問題を引く。
describe("SPEC-014 詰将棋の問題集の本体", () => {
  beforeEach(() => {
    storeTsumeShogiProblemPool(
      readFrontendJson("/src/games/tsume-shogi/problem/problem-pool.json"),
    );
  });

  test("本体の各問から求めた問題 ID が索引の問題 ID と同じ並びであること", () => {
    const bodyProblemIds = difficultyLevels.map(({ id }) =>
      listTsumeShogiPoolEntries(id).map((entry) =>
        createProblemId(toTsumeShogiPoolIdentity(entry)),
      ),
    );

    expect(bodyProblemIds).toEqual(
      difficultyLevels.map(({ id }) => listTsumeShogiPoolProblemIds(id)),
    );
  });
});
