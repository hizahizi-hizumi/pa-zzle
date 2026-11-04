/**
 * 一方向ドア面（変えると端末に残った記録・URL・問題の指し先などが取り返せなくなる面）を、コミット済みの golden ファイルに固定する。
 * golden と一致すれば、その面に触れていない。差分が出れば、その差分が影響の説明になる。
 * 意図した変更なら `GOLDEN_UPDATE_COMMAND` で golden を更新してコミットする。golden を変えた PR は、PO の承認が要る扱いになる。
 * CI（`CI=true`）では、golden との不一致も golden の欠落も失敗にする。
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

const GOLDEN_UPDATE_COMMAND = "bun run --cwd frontend test golden -u";

const goldenDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.dirname(goldenDir);

function describeGoldenMismatch(goldenPath: string): string {
  return [
    `一方向ドア面の golden（frontend/golden/${goldenPath}）と一致しない（golden が無いときを含む）。`,
    "意図しない変更なら、端末に残った記録や URL などを取り返せなくする変更になっていないか直す。",
    `意図した変更なら \`${GOLDEN_UPDATE_COMMAND}\` で golden を更新し、差分を影響の説明として PR に含める。その PR は PO の承認が要る扱いになる。`,
  ].join("\n");
}

/** オブジェクトのキーを並べ替え、実装の中でキーを足す順序が変わっても golden が変わらないようにする。配列の並びは保つ。 */
function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, member]) => [key, sortObjectKeys(member)]),
    );
  }
  return value;
}

export function formatGolden(value: unknown): string {
  return `${JSON.stringify(sortObjectKeys(value), null, 2)}\n`;
}

/** `value` が golden ファイル `frontend/golden/<goldenPath>` と一致することを確かめる。 */
export async function expectGoldenFile(
  value: unknown,
  goldenPath: string,
): Promise<void> {
  try {
    await expect(formatGolden(value)).toMatchFileSnapshot(
      path.join(goldenDir, goldenPath),
    );
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${describeGoldenMismatch(goldenPath)}\n\n${error.message}`;
    }
    throw error;
  }
}

/** golden のディレクトリ `frontend/golden/<directory>` にある golden ファイルの名前（拡張子なし）。 */
export function listGoldenFileNames(directory: string): string[] {
  const directoryPath = path.join(goldenDir, directory);
  if (!existsSync(directoryPath)) {
    return [];
  }
  return readdirSync(directoryPath)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort();
}

/** 固定した入力 `frontend/golden/fixtures/<fixturePath>` を読む。 */
export function readGoldenFixture(fixturePath: string): unknown {
  const filePath = path.join(goldenDir, "fixtures", fixturePath);
  if (!existsSync(filePath)) {
    throw new Error(
      `一方向ドア面の固定した入力 frontend/golden/fixtures/${fixturePath} が無い。ゲームを足したら、そのゲームの固定した入力を置く。`,
    );
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

/** `frontend/` からのパス（`import.meta.glob` のキーの形 `/src/...`）のファイルを JSON として読む。 */
export function readFrontendJson(frontendPath: string): unknown {
  return JSON.parse(readFileSync(path.join(frontendDir, frontendPath), "utf8"));
}

/** `import.meta.glob` で集めた `/src/games/<game>/...` のモジュールを、ゲームの ID（ディレクトリ名）で引けるようにする。 */
export function groupGameModules<Module>(
  modules: Record<string, Module>,
): [gameId: string, module: Module][] {
  return Object.entries(modules)
    .map(([modulePath, module]): [string, Module] => {
      const gameId = /^\/src\/games\/([^/]+)\//.exec(modulePath)?.[1];
      if (gameId === undefined) {
        throw new Error(`${modulePath} is not a game module`);
      }
      return [gameId, module];
    })
    .sort(([left], [right]) => (left < right ? -1 : 1));
}

/**
 * 標準配置（`.claude/rules/game-structure.md`）の名前の規則でモジュールの export を1つ選ぶ。
 * 新しいゲームも、標準の名前で置けば golden の対象に自動で入る。
 */
export function findGameExport(
  module: Record<string, unknown>,
  namePattern: RegExp,
): unknown {
  const matches = Object.entries(module).filter(([name]) =>
    namePattern.test(name),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one export matching ${namePattern}, found ${matches.map(([name]) => name).join(", ") || "none"}`,
    );
  }
  return matches[0]![1];
}
