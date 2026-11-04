import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  compareDocumentIds,
  documentIdPattern,
  type IdentifiedDocument,
} from "./document-ids";
import { escapeTableCell, renderTableRow } from "./markdown";
import { matchesAnyPathPattern } from "./path-pattern";

/** ID の参照をどのゲートの検査とみなすか。 */
export const verificationGates = ["unit-test", "golden", "e2e"] as const;
export type VerificationGate = (typeof verificationGates)[number];

export const verificationGateLabels: Readonly<
  Record<VerificationGate, string>
> = {
  "unit-test": "G1 単体テスト",
  golden: "G2 golden",
  e2e: "G3 E2E",
};

export type SourceFile = {
  /** リポジトリ直下からの相対パス */
  path: string;
  text: string;
};

export type IdOccurrence = {
  id: string;
  path: string;
  line: number;
};

export type RequirementTraceRow = IdentifiedDocument & {
  occurrences: Readonly<Record<VerificationGate, IdOccurrence[]>>;
};

export type RequirementTrace = {
  rows: RequirementTraceRow[];
  /** 検査から参照されているが、文書に無い ID */
  unknownIdOccurrences: IdOccurrence[];
};

const gatePatterns: Readonly<Record<VerificationGate, readonly string[]>> = {
  e2e: ["frontend/e2e/**"],
  golden: ["frontend/golden/**"],
  "unit-test": [
    "frontend/**/*.test.ts",
    "frontend/**/*.test.tsx",
    "frontend/**/*.test.mjs",
  ],
};

/** 変更の扱いの判定自身のテストは、ID を例として使うだけで要件を守る検査ではない。 */
const factoryDirectory = "frontend/scripts/factory/";

/** 依存・生成物・検査結果の置き場。検査のソースを持たない。 */
const ignoredFrontendDirectories = new Set([
  "node_modules",
  "dist",
  "generated",
  "e2e-results",
  "playwright-report",
  "test-results",
  "coverage",
  ".wrangler",
]);

/** golden や E2E の中のテストファイルは、そのゲートに数える。 */
const gateClassificationOrder: readonly VerificationGate[] = [
  "e2e",
  "golden",
  "unit-test",
];

export function classifyVerificationGate(
  filePath: string,
): VerificationGate | null {
  return (
    gateClassificationOrder.find((gate) =>
      matchesAnyPathPattern(filePath, gatePatterns[gate]),
    ) ?? null
  );
}

/** 1行に同じ ID が何度出てきても、その行の参照は1つと数える。 */
export function findIdOccurrences(file: SourceFile): IdOccurrence[] {
  return file.text.split("\n").flatMap((lineText, lineIndex) =>
    [...new Set(lineText.match(documentIdPattern) ?? [])].map((id) => ({
      id,
      path: file.path,
      line: lineIndex + 1,
    })),
  );
}

export function buildRequirementTrace(
  documents: readonly IdentifiedDocument[],
  verificationFiles: readonly SourceFile[],
): RequirementTrace {
  const occurrences = verificationFiles.flatMap(findIdOccurrences);
  const documentIds = new Set(documents.map((document) => document.id));
  return {
    rows: documents.map((document) => {
      const documentOccurrences = occurrences.filter(
        (occurrence) => occurrence.id === document.id,
      );
      return {
        ...document,
        occurrences: {
          "unit-test": filterByGate(documentOccurrences, "unit-test"),
          golden: filterByGate(documentOccurrences, "golden"),
          e2e: filterByGate(documentOccurrences, "e2e"),
        },
      };
    }),
    unknownIdOccurrences: occurrences
      .filter((occurrence) => !documentIds.has(occurrence.id))
      .sort((left, right) => compareDocumentIds(left.id, right.id)),
  };
}

export function renderRequirementTraceMarkdown(
  trace: RequirementTrace,
): string {
  const coveredCount = trace.rows.filter(isCovered).length;
  const lines = [
    "## 要件とテストの対応表",
    "",
    `検査から参照されている ID: ${coveredCount} / ${trace.rows.length}。参照が無いものは、機械で守られておらず PO の判断に任されている。`,
    "",
    `| ID | 題 | ${verificationGates.map((gate) => verificationGateLabels[gate]).join(" | ")} |`,
    `|---|---|${verificationGates.map(() => "---").join("|")}|`,
    ...trace.rows.map((row) =>
      renderTableRow([
        row.id,
        escapeTableCell(row.title),
        ...verificationGates.map((gate) =>
          formatOccurrences(row.occurrences[gate]),
        ),
      ]),
    ),
  ];
  if (trace.unknownIdOccurrences.length > 0) {
    lines.push(
      "",
      "### 文書に無い ID への参照",
      "",
      ...trace.unknownIdOccurrences.map(
        (occurrence) => `- ${occurrence.id}: ${formatLocation(occurrence)}`,
      ),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** frontend 配下の、ゲートに属する検査ファイルを読む。 */
export function loadVerificationFiles(repositoryRoot: string): SourceFile[] {
  return listFrontendFiles(repositoryRoot, "frontend")
    .filter(
      (filePath) =>
        classifyVerificationGate(filePath) !== null &&
        !filePath.startsWith(factoryDirectory),
    )
    .map((filePath) => ({
      path: filePath,
      text: readFileSync(path.join(repositoryRoot, filePath), "utf8"),
    }));
}

function listFrontendFiles(
  repositoryRoot: string,
  directory: string,
): string[] {
  return readdirSync(path.join(repositoryRoot, directory), {
    withFileTypes: true,
  })
    .flatMap((entry) => {
      const entryPath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        return ignoredFrontendDirectories.has(entry.name)
          ? []
          : listFrontendFiles(repositoryRoot, entryPath);
      }
      return entry.isFile() ? [entryPath] : [];
    })
    .sort();
}

function filterByGate(
  occurrences: readonly IdOccurrence[],
  gate: VerificationGate,
): IdOccurrence[] {
  return occurrences.filter(
    (occurrence) => classifyVerificationGate(occurrence.path) === gate,
  );
}

function isCovered(row: RequirementTraceRow): boolean {
  return verificationGates.some((gate) => row.occurrences[gate].length > 0);
}

function formatOccurrences(occurrences: readonly IdOccurrence[]): string {
  return occurrences.map(formatLocation).join("<br>");
}

function formatLocation(occurrence: IdOccurrence): string {
  return `\`${occurrence.path}:${occurrence.line}\``;
}
