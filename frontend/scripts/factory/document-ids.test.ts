import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  _private,
  adrDirectory,
  adrIndexPath,
  findAdrIndexMismatch,
  findDuplicatedValues,
  listFiles,
  loadIdentifiedDocuments,
  readAdrIdFromFileName,
  readDocumentTitle,
  readFrontMatterId,
} from "./document-ids";

const { parseCsv } = _private;

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("リポジトリの文書", () => {
  const identifiedDocuments = loadIdentifiedDocuments(repositoryRoot, "docs");
  const adrFilePaths = listFiles(repositoryRoot, adrDirectory).filter(
    (filePath) => readAdrIdFromFileName(path.posix.basename(filePath)) !== null,
  );
  const adrIndexCsv = readFileSync(
    path.join(repositoryRoot, adrIndexPath),
    "utf8",
  );

  test("docs/プロダクト の文書に front matter の id があること", () => {
    const productDocuments = identifiedDocuments.filter((document) =>
      document.path.startsWith("docs/プロダクト/"),
    );

    expect(productDocuments.length).toBeGreaterThan(0);
  });

  test("front matter の id がリポジトリ内で一意であること", () => {
    const duplicated = findDuplicatedValues(
      identifiedDocuments.map((document) => ({
        value: document.id,
        path: document.path,
      })),
    );

    expect(duplicated).toEqual([]);
  });

  test("ADR の番号がファイル名で一意であること", () => {
    const duplicated = findDuplicatedValues(
      adrFilePaths.map((filePath) => ({
        value: readAdrIdFromFileName(path.posix.basename(filePath)) ?? "",
        path: filePath,
      })),
    );

    expect(duplicated).toEqual([]);
  });

  test("docs/adr/index.csv の行と ADR ファイルが一対一に対応すること", () => {
    const mismatch = findAdrIndexMismatch(adrIndexCsv, adrFilePaths);

    expect(mismatch).toEqual({
      filesWithoutIndexRow: [],
      indexRowsWithoutFile: [],
      duplicatedIndexIds: [],
    });
  });
});

describe("readFrontMatterId", () => {
  const cases = [
    ["---\nid: FR-001\nupstream:\n  - RQ-001\n---\n# FR-001 題", "FR-001"],
    ['---\nid: "SCR-002"\n---\n# 題', "SCR-002"],
    ["---\nstatus: accepted\n---\n# 題", null],
    ["# id: FR-001", null],
  ] as const;

  test.each(cases)(
    "front matter の id を読むこと: %j",
    (markdown, expected) => {
      const id = readFrontMatterId(markdown);

      expect(id).toBe(expected);
    },
  );
});

describe("readDocumentTitle", () => {
  const cases = [
    [
      "---\nid: FR-001\n---\n# FR-001 遊ぶパズルを選べる\n",
      "FR-001",
      "遊ぶパズルを選べる",
    ],
    ["---\nid: SCR-001\n---\n# ホーム\n", "SCR-001", "ホーム"],
  ] as const;

  test.each(cases)(
    "見出しから ID を除いた題を読むこと: %j",
    (markdown, id, expected) => {
      const title = readDocumentTitle(markdown, id);

      expect(title).toBe(expected);
    },
  );
});

describe("readAdrIdFromFileName", () => {
  const cases = [
    ["ADR-0001-problem-id.md", "ADR-0001"],
    ["README.md", null],
    ["index.csv", null],
    ["ADR-01-short.md", null],
  ] as const;

  test.each(cases)(
    "ファイル名から ADR 番号を読むこと: %s",
    (fileName, expected) => {
      const id = readAdrIdFromFileName(fileName);

      expect(id).toBe(expected);
    },
  );
});

describe("findDuplicatedValues", () => {
  const entries = [
    { value: "FR-001", path: "a.md" },
    { value: "FR-002", path: "b.md" },
    { value: "FR-001", path: "c.md" },
  ];

  test("2つ以上のパスに出てくる値だけを返すこと", () => {
    const duplicated = findDuplicatedValues(entries);

    expect(duplicated).toEqual([{ value: "FR-001", paths: ["a.md", "c.md"] }]);
  });
});

describe("findAdrIndexMismatch", () => {
  const indexCsv = [
    "id,title,summary,status,date,path",
    'ADR-0001,題,"要約, カンマ入り",accepted,2026-10-02,docs/adr/ADR-0001-a.md',
    "ADR-0002,題,要約,accepted,2026-10-02,docs/adr/ADR-0002-missing.md",
    "ADR-0003,題,要約,accepted,2026-10-02,docs/adr/ADR-0004-c.md",
    "ADR-0001,題,要約,accepted,2026-10-02,docs/adr/ADR-0001-a.md",
    "",
  ].join("\n");
  const adrFilePaths = [
    "docs/adr/ADR-0001-a.md",
    "docs/adr/ADR-0004-c.md",
    "docs/adr/ADR-0005-unindexed.md",
  ];

  test("行の無いファイル、ファイルの無い行、重複した ID を返すこと", () => {
    const mismatch = findAdrIndexMismatch(indexCsv, adrFilePaths);

    expect(mismatch).toEqual({
      filesWithoutIndexRow: ["docs/adr/ADR-0005-unindexed.md"],
      indexRowsWithoutFile: ["ADR-0002", "ADR-0003"],
      duplicatedIndexIds: ["ADR-0001"],
    });
  });
});

describe("parseCsv", () => {
  const csv = 'a,"b, c","d ""e"""\r\nf,"g\nh",i\n';

  test("引用符で囲んだカンマ・改行・二重の引用符を値として読むこと", () => {
    const rows = parseCsv(csv);

    expect(rows).toEqual([
      ["a", "b, c", 'd "e"'],
      ["f", "g\nh", "i"],
    ]);
  });
});
