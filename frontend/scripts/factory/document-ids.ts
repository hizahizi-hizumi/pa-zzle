import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** 要求・要件・仕様・画面の ID。front matter の `id` と、テストからの参照に使う。 */
export const documentIdPattern = /\b(?:RQ|FR|NFR|SPEC|SCR)-\d{3,}\b/g;

export const productDocumentsDirectory = "docs/プロダクト";
export const adrDirectory = "docs/adr";
export const adrIndexPath = "docs/adr/index.csv";

export type IdentifiedDocument = {
  /** リポジトリ直下からの相対パス */
  path: string;
  id: string;
  title: string;
};

export type DuplicatedValue = {
  value: string;
  paths: string[];
};

export type AdrIndexMismatch = {
  /** index.csv に行が無い ADR ファイル */
  filesWithoutIndexRow: string[];
  /** 指すファイルが無い、または ID とファイル名の番号が食い違う index.csv の行の ID */
  indexRowsWithoutFile: string[];
  /** index.csv に2回以上出てくる ID */
  duplicatedIndexIds: string[];
};

export function readFrontMatterId(markdown: string): string | null {
  const frontMatter = readFrontMatter(markdown);
  if (frontMatter === null) {
    return null;
  }
  const idLine = frontMatter.find((line) => /^id:/.test(line));
  if (idLine === undefined) {
    return null;
  }
  const id = idLine
    .slice("id:".length)
    .trim()
    .replace(/^["']|["']$/g, "");
  return id === "" ? null : id;
}

export function readDocumentTitle(markdown: string, id: string): string {
  const heading = markdown.split("\n").find((line) => line.startsWith("# "));
  if (heading === undefined) {
    return "";
  }
  const title = heading.slice("# ".length).trim();
  return title.startsWith(id) ? title.slice(id.length).trim() : title;
}

/** directory 配下の Markdown を、front matter に `id` があるものだけ読む。 */
export function loadIdentifiedDocuments(
  repositoryRoot: string,
  directory: string,
): IdentifiedDocument[] {
  return listFiles(repositoryRoot, directory)
    .filter((filePath) => filePath.endsWith(".md"))
    .flatMap((filePath) => {
      const markdown = readFileSync(
        path.join(repositoryRoot, filePath),
        "utf8",
      );
      const id = readFrontMatterId(markdown);
      return id === null
        ? []
        : [{ path: filePath, id, title: readDocumentTitle(markdown, id) }];
    })
    .sort((left, right) => compareDocumentIds(left.id, right.id));
}

/** directory 配下のファイルを、リポジトリ直下からの相対パスで返す。 */
export function listFiles(repositoryRoot: string, directory: string): string[] {
  return readdirSync(path.join(repositoryRoot, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(repositoryRoot, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    )
    .sort();
}

export function findDuplicatedValues(
  entries: readonly { value: string; path: string }[],
): DuplicatedValue[] {
  const pathsByValue = new Map<string, string[]>();
  for (const entry of entries) {
    pathsByValue.set(entry.value, [
      ...(pathsByValue.get(entry.value) ?? []),
      entry.path,
    ]);
  }
  return [...pathsByValue]
    .filter(([, paths]) => paths.length > 1)
    .map(([value, paths]) => ({ value, paths }));
}

/** `ADR-0001-problem-id.md` から `ADR-0001` を取り出す。ADR ではないファイルは null。 */
export function readAdrIdFromFileName(fileName: string): string | null {
  return /^(ADR-\d{4})-[^/]+\.md$/.exec(fileName)?.[1] ?? null;
}

/** index.csv の各行と ADR ファイルが一対一に対応しているかを調べる。 */
export function findAdrIndexMismatch(
  indexCsv: string,
  adrFilePaths: readonly string[],
): AdrIndexMismatch {
  const rows = parseCsv(indexCsv);
  const header = rows[0] ?? [];
  const idColumn = header.indexOf("id");
  const pathColumn = header.indexOf("path");
  const indexRows = rows
    .slice(1)
    .map((row) => ({ id: row[idColumn] ?? "", path: row[pathColumn] ?? "" }));
  const indexedPaths = new Set(indexRows.map((row) => row.path));
  const existingFilePaths = new Set(adrFilePaths);
  return {
    filesWithoutIndexRow: adrFilePaths.filter(
      (filePath) => !indexedPaths.has(filePath),
    ),
    indexRowsWithoutFile: indexRows
      .filter(
        (row) =>
          !existingFilePaths.has(row.path) ||
          readAdrIdFromFileName(path.posix.basename(row.path)) !== row.id,
      )
      .map((row) => row.id),
    duplicatedIndexIds: findDuplicatedValues(
      indexRows.map((row) => ({ value: row.id, path: row.path })),
    ).map((duplicated) => duplicated.value),
  };
}

export function compareDocumentIds(left: string, right: string): number {
  return left.localeCompare(right, "en", { numeric: true });
}

function readFrontMatter(markdown: string): string[] | null {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== "---") {
    return null;
  }
  const closingIndex = lines.indexOf("---", 1);
  return closingIndex < 0 ? null : lines.slice(1, closingIndex);
}

/** RFC 4180 の範囲（引用符で囲んだ値の中のカンマ・改行・二重の引用符）を読む。 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      rows.push([...row, value.replace(/\r$/, "")]);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value !== "" || row.length > 0) {
    rows.push([...row, value]);
  }
  return rows;
}

export const _private = { parseCsv };
