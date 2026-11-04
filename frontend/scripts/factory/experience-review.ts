import {
  type ChangeClassification,
  type FileChangeStatus,
  type FileTreatment,
  formatChangedPath,
  isTestFile,
  renderChangeClassificationMarkdown,
  type Treatment,
} from "./change-treatment";
import {
  compareDocumentIds,
  documentIdPattern,
  type IdentifiedDocument,
} from "./document-ids";
import { escapeTableCell, renderTableRow } from "./markdown";
import { matchesAnyPathPattern, matchesPathPattern } from "./path-pattern";
import type { SourceFile } from "./requirement-trace";

export type ReferencedId = {
  id: string;
  /** 文書に無い ID は null */
  title: string | null;
  paths: string[];
};

export type ExperienceReviewInput = {
  classification: ChangeClassification;
  referencedIds: readonly ReferencedId[];
  /** E2E のスクリーンショットを収めた artifact。見つからなければ null。 */
  e2eArtifactUrl: string | null;
};

const goldenPattern = "frontend/golden/**";

const requirementReferenceSourcePatterns = [
  "frontend/e2e/**",
  goldenPattern,
  "docs/**/*.md",
  "*.md",
] as const;

const statusLabels: Readonly<Record<FileChangeStatus, string>> = {
  added: "追加",
  modified: "変更",
  deleted: "削除",
  renamed: "移動",
  copied: "複製",
  "type-changed": "種類の変更",
  unknown: "不明",
};

const experienceCheckItems = [
  "Cloudflare が PR に投稿したプレビュー URL で、変わった画面・ゲームを実際に遊んだ",
  "スマホ幅と PC 幅で、E2E のスクリーンショットとプレビューの見た目・操作に違和感がない",
  "操作がスクロールや拡大と取り違えられない",
  "上の要件・仕様の意図どおりの体験になっている",
] as const;

const approvalItems = [
  "承認の理由に挙がった各ファイルについて、変更の意図が PR に書かれ、納得できる",
  "合格基準（要求・要件・ルール・CI・検証・テスト）が弱まっていない",
] as const;

const goldenApprovalItem =
  "golden の差分（影響レポート）を読み、保存形式・問題ID・評価・難易度・URL への取り返しのつかない影響を受け入れられる";

/** 要件・仕様の ID を拾う対象になる、変更されたテスト・文書か。 */
export function isRequirementReferenceSource(filePath: string): boolean {
  return (
    isTestFile(filePath) ||
    matchesAnyPathPattern(filePath, requirementReferenceSourcePatterns)
  );
}

export function collectReferencedIds(
  changedFiles: readonly SourceFile[],
  documents: readonly IdentifiedDocument[],
): ReferencedId[] {
  const pathsById = new Map<string, Set<string>>();
  for (const file of changedFiles) {
    for (const match of file.text.matchAll(documentIdPattern)) {
      const paths = pathsById.get(match[0]) ?? new Set<string>();
      paths.add(file.path);
      pathsById.set(match[0], paths);
    }
  }
  const titlesById = new Map(
    documents.map((document) => [document.id, document.title]),
  );
  return [...pathsById]
    .map(([id, paths]) => ({
      id,
      title: titlesById.get(id) ?? null,
      paths: [...paths].sort(),
    }))
    .sort((left, right) => compareDocumentIds(left.id, right.id));
}

export function listGoldenChanges(
  classification: ChangeClassification,
): FileTreatment[] {
  return classification.files.filter(
    (file) =>
      matchesPathPattern(file.path, goldenPattern) ||
      (file.previousPath !== undefined &&
        matchesPathPattern(file.previousPath, goldenPattern)),
  );
}

export function listReviewItems(
  classification: ChangeClassification,
): string[] {
  const items: Record<Treatment, () => string[]> = {
    auto: () => [],
    "experience-check": () => [...experienceCheckItems],
    approval: () => [
      ...approvalItems,
      ...(listGoldenChanges(classification).length > 0
        ? [goldenApprovalItem]
        : []),
      ...(hasExperienceChange(classification) ? experienceCheckItems : []),
    ],
  };
  return items[classification.treatment]();
}

export function renderExperienceReviewMarkdown(
  input: ExperienceReviewInput,
): string {
  const goldenChanges = listGoldenChanges(input.classification);
  const reviewItems = listReviewItems(input.classification);
  const lines = [
    "# 体験レビュー票",
    "",
    renderChangeClassificationMarkdown(input.classification).trimEnd(),
    "",
    "## 変わった一方向ドア面",
    "",
    ...(goldenChanges.length === 0
      ? ["golden の変化はない。"]
      : goldenChanges.map(
          (file) =>
            `- ${formatChangedPath(file)}（${statusLabels[file.status]}）`,
        )),
    "",
    "## 関係する要件・仕様",
    "",
    ...(input.referencedIds.length === 0
      ? ["変更されたテスト・文書に、要件・仕様の ID は出てこない。"]
      : [
          "変更されたテスト・文書に出てくる ID。",
          "",
          "| ID | 題 | 出てくるファイル |",
          "|---|---|---|",
          ...input.referencedIds.map((referenced) =>
            renderTableRow([
              referenced.id,
              escapeTableCell(referenced.title ?? "（文書に無い ID）"),
              escapeTableCell(
                referenced.paths
                  .map((filePath) => `\`${filePath}\``)
                  .join("<br>"),
              ),
            ]),
          ),
        ]),
    "",
    "## E2E スクリーンショット",
    "",
    input.e2eArtifactUrl === null
      ? "E2E のスクリーンショットの artifact が無い。e2e ジョブの結果を確かめる。"
      : `[e2e-results](${input.e2eArtifactUrl}) に、スマホと PC の主要画面のスクリーンショットがある。`,
    "",
    "## PO が見ること",
    "",
    ...(reviewItems.length === 0
      ? ["なし。CI の合否だけで merge できる。"]
      : reviewItems.map((item) => `- [ ] ${item}`)),
  ];
  return `${lines.join("\n")}\n`;
}

function hasExperienceChange(classification: ChangeClassification): boolean {
  return classification.files.some((file) =>
    file.reasons.some((reason) => reason.treatment === "experience-check"),
  );
}
