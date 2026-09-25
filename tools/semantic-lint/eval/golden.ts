import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { YAML } from "bun";

export type GoldenFinding = {
  startLine: number;
  endLine: number;
  /**
   * 開始行での開始列と、終了行での終了列（1始まり、終了は範囲の直後の列）。
   * 変数名など文より細かい指摘位置を表すときだけ書き、省略すると行単位で採点する。
   */
  startColumn?: number;
  endColumn?: number;
  note?: string;
};

export type GoldenFile = {
  path: string;
  blob: string;
  note?: string;
  findings: GoldenFinding[];
};

export type GoldenSet = {
  ruleId: string;
  baseCommit: string;
  origin: string;
  files: GoldenFile[];
};

/**
 * goldenが参照するblobとworking treeの関係。
 * - current: working treeのファイルがgoldenのblobと一致する。
 * - changed: working treeのファイルが変わっている。評価にはgoldenのblobを使う。
 * - missing: working treeにファイルがない。評価にはgoldenのblobを使う。
 */
export type GoldenFileStatus = "current" | "changed" | "missing";

export type ResolvedGoldenFile = GoldenFile & {
  source: string;
  status: GoldenFileStatus;
};

export type BlobReader = (blob: string) => Promise<Uint8Array>;

const BLOB_PATTERN = /^[0-9a-f]{40}$/;

export async function loadGoldenSets(
  projectRoot: string,
  goldenDir: string,
): Promise<GoldenSet[]> {
  const directory = resolve(projectRoot, goldenDir);
  const paths = await collectGoldenManifests(directory);
  const sets: GoldenSet[] = [];

  for (const path of paths) {
    const value = YAML.parse(await Bun.file(path).text());
    sets.push(compileGoldenSet(value, path));
  }

  const seen = new Set<string>();

  for (const set of sets) {
    if (seen.has(set.ruleId)) {
      throw new Error(`同じruleのgoldenが複数あります: ${set.ruleId}`);
    }

    seen.add(set.ruleId);
  }

  return sets.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

export function compileGoldenSet(value: unknown, origin: string): GoldenSet {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.rule !== "string" ||
    !value.rule.includes("/") ||
    typeof value.baseCommit !== "string" ||
    !BLOB_PATTERN.test(value.baseCommit) ||
    !Array.isArray(value.files) ||
    value.files.length === 0
  ) {
    throw new Error(`golden manifestが不正です: ${origin}`);
  }

  const paths = new Set<string>();
  const files = value.files.map((item, index): GoldenFile => {
    const location = `${origin} files[${index}]`;

    if (
      !isRecord(item) ||
      typeof item.path !== "string" ||
      item.path.length === 0 ||
      typeof item.blob !== "string" ||
      !BLOB_PATTERN.test(item.blob) ||
      !Array.isArray(item.findings) ||
      !isOptionalString(item.note)
    ) {
      throw new Error(`golden fileが不正です: ${location}`);
    }

    if (paths.has(item.path)) {
      throw new Error(`golden fileのpathが重複しています: ${location}`);
    }

    paths.add(item.path);

    return {
      path: item.path,
      blob: item.blob,
      ...(item.note === undefined ? {} : { note: item.note }),
      findings: item.findings.map((finding, findingIndex) =>
        compileGoldenFinding(
          finding,
          `${location} findings[${findingIndex}]`,
        ),
      ),
    };
  });

  return {
    ruleId: value.rule,
    baseCommit: value.baseCommit,
    origin,
    files,
  };
}

function compileGoldenFinding(value: unknown, location: string): GoldenFinding {
  if (
    !isRecord(value) ||
    !Array.isArray(value.lines) ||
    value.lines.length !== 2 ||
    (value.columns !== undefined &&
      (!Array.isArray(value.columns) || value.columns.length !== 2)) ||
    !isOptionalString(value.note)
  ) {
    throw new Error(`golden findingが不正です: ${location}`);
  }

  const [startLine, endLine] = value.lines;

  if (
    !isPositiveInteger(startLine) ||
    !isPositiveInteger(endLine) ||
    startLine > endLine
  ) {
    throw new Error(`golden findingの行範囲が不正です: ${location}`);
  }

  // columnsは [開始列, 終了列] で、終了列は範囲の最後の文字の列（両端を含む）。
  const [startColumn, lastColumn] = Array.isArray(value.columns)
    ? value.columns
    : [undefined, undefined];

  if (
    value.columns !== undefined &&
    (!isPositiveInteger(startColumn) ||
      !isPositiveInteger(lastColumn) ||
      (startLine === endLine && startColumn > lastColumn))
  ) {
    throw new Error(`golden findingの列範囲が不正です: ${location}`);
  }

  return {
    startLine,
    endLine,
    ...(isPositiveInteger(startColumn) && isPositiveInteger(lastColumn)
      ? { startColumn, endColumn: lastColumn + 1 }
      : {}),
    ...(value.note === undefined ? {} : { note: value.note }),
  };
}

/** Gitと同じ方式でblob object idを計算する。 */
export function gitBlobHash(content: Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha1");
  hasher.update(`blob ${content.byteLength}\0`);
  hasher.update(content);

  return hasher.digest("hex");
}

/**
 * goldenのblobから評価対象のsourceを決める。
 * working treeが一致すればそれを使い、変わっていればgoldenのblobを読む。
 */
export async function resolveGoldenFiles(
  projectRoot: string,
  set: GoldenSet,
  readBlob: BlobReader = readGitBlob(projectRoot),
): Promise<ResolvedGoldenFile[]> {
  const decoder = new TextDecoder();

  return Promise.all(
    set.files.map(async (file) => {
      const status = await goldenFileStatus(projectRoot, file);
      const bytes =
        status === "current"
          ? await Bun.file(resolve(projectRoot, file.path)).bytes()
          : await readBlob(file.blob);

      if (gitBlobHash(bytes) !== file.blob) {
        throw new Error(
          `golden blobの内容が一致しません: ${file.path} ${file.blob}`,
        );
      }

      return {
        ...file,
        source: decoder.decode(bytes),
        status,
      };
    }),
  );
}

export async function goldenFileStatus(
  projectRoot: string,
  file: GoldenFile,
): Promise<GoldenFileStatus> {
  const handle = Bun.file(resolve(projectRoot, file.path));

  if (!(await handle.exists())) {
    return "missing";
  }

  return gitBlobHash(await handle.bytes()) === file.blob
    ? "current"
    : "changed";
}

export function readGitBlob(projectRoot: string): BlobReader {
  return async function readBlob(blob: string): Promise<Uint8Array> {
    const child = Bun.spawn(["git", "cat-file", "blob", blob], {
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).bytes(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    if (exitCode !== 0) {
      throw new Error(
        `golden blobを読み込めません: ${blob} ${stderr.trim()}`,
      );
    }

    return stdout;
  };
}

async function collectGoldenManifests(directory: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const paths: string[] = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await collectGoldenManifests(path)));
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))
    ) {
      paths.push(path);
    }
  }

  return paths.sort();
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
