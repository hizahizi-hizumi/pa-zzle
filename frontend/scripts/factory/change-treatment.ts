import { escapeTableCell, renderTableRow } from "./markdown";
import { matchesAnyPathPattern, matchesPathPattern } from "./path-pattern";

/** 変更を main へ入れるまでに誰が何を確かめるか。後ろほど厳しい。 */
export const treatments = ["auto", "experience-check", "approval"] as const;
export type Treatment = (typeof treatments)[number];

export const treatmentLabels: Readonly<Record<Treatment, string>> = {
  auto: "自動",
  "experience-check": "体験確認",
  approval: "承認",
};

export type FileChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed"
  | "unknown";

export type FileChange = {
  status: FileChangeStatus;
  path: string;
  previousPath?: string;
};

export type TreatmentReason = {
  treatment: Treatment;
  reason: string;
};

export type FileTreatment = FileChange & {
  treatment: Treatment;
  reasons: TreatmentReason[];
};

export type ChangeClassification = {
  treatment: Treatment;
  files: FileTreatment[];
};

/** `frontend/package.json` の base（merge-base）と head の内容。ファイルが無い側は null。 */
export type PackageManifestRevisions = {
  base: string | null;
  head: string | null;
};

export type ChangeClassificationInput = {
  changes: readonly FileChange[];
  frontendPackageManifest: PackageManifestRevisions;
};

export const frontendPackageManifestPath = "frontend/package.json";

type PathTouchKind = "added" | "modified" | "deleted";

type PathTouch = {
  path: string;
  kind: PathTouchKind;
};

type ChangeRule = TreatmentReason & {
  matches(touch: PathTouch, change: FileChange): boolean;
};

const testFilePatterns = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.mjs",
] as const;

const e2ePatterns = ["frontend/e2e/**"] as const;

/** 品質検証（`scripts/verify.sh` と E2E）が呼ぶ `frontend/package.json` のスクリプト。 */
const qualityGateScriptNames = [
  "check",
  "typecheck",
  "test",
  "build",
  "test:e2e",
] as const;

const dependencySectionNames = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const approvalRules: readonly ChangeRule[] = [
  touchedPathRule("approval", "要求・要件は実装が正しいかを判定する基準", [
    "docs/プロダクト/要求/**",
    "docs/プロダクト/要件/**",
  ]),
  touchedPathRule("approval", "ADR はプロジェクト全体の意思決定の記録", [
    "docs/adr/**",
  ]),
  touchedPathRule(
    "approval",
    "リポジトリ直下の文書とエージェント向けルールは、プロダクトの判断と作業の決まり",
    [
      "AGENTS.md",
      "CLAUDE.md",
      "APP.md",
      "GAME.md",
      "DESIGN.md",
      ".claude/rules/**",
      ".claude/settings.json",
    ],
  ),
  touchedPathRule("approval", "CI と全品質検証は合格基準そのもの", [
    ".github/**",
    "scripts/verify.sh",
    "scripts/chatgpt-verify.sh",
    "CODEOWNERS",
    "docs/CODEOWNERS",
  ]),
  touchedPathRule(
    "approval",
    "静的検査・テスト実行・依存ルールの設定は合格基準そのもの",
    [
      "frontend/biome.json",
      "frontend/vitest.config.ts",
      "frontend/playwright.config.ts",
      "frontend/tsconfig.json",
      "frontend/scripts/dependency-rules.ts",
      "frontend/scripts/generate-dependency-rules.ts",
    ],
  ),
  touchedPathRule("approval", "変更の扱いの判定と検査は合格基準そのもの", [
    "frontend/scripts/factory/**",
  ]),
  touchedPathRule(
    "approval",
    "一方向ドア面の golden が変わる。取り返しがつかない影響を確かめる",
    ["frontend/golden/**"],
  ),
  {
    treatment: "approval",
    reason: "既存の E2E の変更・削除は合格基準を緩めうる",
    matches(touch) {
      return (
        touch.kind !== "added" && matchesAnyPathPattern(touch.path, e2ePatterns)
      );
    },
  },
  {
    treatment: "approval",
    reason: "テストの削除は合格基準を緩めうる",
    matches(touch, change) {
      const remainsTestFile =
        change.status === "renamed" && isTestFile(change.path);
      return (
        touch.kind === "deleted" && isTestFile(touch.path) && !remainsTestFile
      );
    },
  },
];

const experienceCheckRules: readonly ChangeRule[] = [
  touchedPathRule(
    "experience-check",
    "画面の見た目・操作が変わりうる",
    [
      "frontend/src/**/ui/**",
      "frontend/src/components/**",
      "frontend/src/pages/**",
      "frontend/src/views/**",
      "frontend/src/router.ts",
      "frontend/src/frontend.tsx",
      "frontend/src/index.css",
    ],
    { excludeTestFiles: true },
  ),
  touchedPathRule(
    "experience-check",
    "ゲームのルール・遊び方が変わりうる",
    ["frontend/src/games/*/play/**", "frontend/src/games/*/puzzle/**"],
    { excludeTestFiles: true },
  ),
  touchedPathRule(
    "experience-check",
    "ゲームの一覧と、選んで遊ぶ流れが変わりうる",
    ["frontend/src/game-catalog/**"],
    { excludeTestFiles: true },
  ),
  touchedPathRule(
    "experience-check",
    "見た目・音の素材が変わる",
    [
      "frontend/src/**/assets/**",
      "frontend/styles/**",
      "frontend/public/**",
      "frontend/index.html",
    ],
    { excludeTestFiles: true },
  ),
  touchedPathRule(
    "experience-check",
    "出題される問題が変わり、難易度の手応えが変わりうる",
    ["frontend/src/games/*/problem/problem-pool.json"],
  ),
  touchedPathRule(
    "experience-check",
    "配信するアプリのビルド・配信の設定が変わる",
    [
      "frontend/vite.config.ts",
      "frontend/vite-plugins/**",
      "frontend/wrangler.jsonc",
    ],
  ),
  touchedPathRule("experience-check", "仕様・画面・難易度の決まりが変わる", [
    "docs/プロダクト/README.md",
    "docs/プロダクト/仕様/**",
    "docs/プロダクト/画面/**",
    "docs/パズル/難易度*.md",
  ]),
];

const autoRules: readonly ChangeRule[] = [
  {
    treatment: "auto",
    reason: "テストの追加・変更",
    matches(touch) {
      return touch.kind !== "deleted" && isTestFile(touch.path);
    },
  },
  {
    treatment: "auto",
    reason: "E2E の追加",
    matches(touch) {
      return (
        touch.kind === "added" && matchesAnyPathPattern(touch.path, e2ePatterns)
      );
    },
  },
  touchedPathRule(
    "auto",
    "内部の実装・道具・資料・依存の更新。一方向ドア面に触れたかは golden の差分で判定する",
    [
      "frontend/src/**",
      "frontend/scripts/**",
      "frontend/README.md",
      "frontend/.gitignore",
      frontendPackageManifestPath,
      "frontend/bun.lock",
      "frontend/components.json",
      "frontend/*.d.ts",
      "frontend/vite.chatgpt.config.ts",
      "backend/**",
      "tools/**",
      "scripts/**",
      "docs/**",
      ".claude/**",
      ".semantic-lint/**",
      ".gitignore",
      ".node-version",
      ".bun-version",
    ],
  ),
];

const changeRules: readonly ChangeRule[] = [
  ...approvalRules,
  ...experienceCheckRules,
  ...autoRules,
];

const unexpectedPathReason: TreatmentReason = {
  treatment: "experience-check",
  reason: "想定外の場所のため、PO の確認に回す",
};

const unknownStatusReason: TreatmentReason = {
  treatment: "experience-check",
  reason: "差分の種類を判定できないため、PO の確認に回す",
};

export function classifyChanges(
  input: ChangeClassificationInput,
): ChangeClassification {
  const files = input.changes
    .map((change) => classifyFileChange(change, input.frontendPackageManifest))
    .sort(compareFileTreatments);
  return {
    treatment: strictestTreatment(files.map((file) => file.treatment)),
    files,
  };
}

/** `git diff --name-status -z` の出力を読む。 */
export function parseNameStatusOutput(output: string): FileChange[] {
  const fields = output.split("\0").filter((field) => field !== "");
  const changes: FileChange[] = [];
  let index = 0;
  while (index < fields.length) {
    const statusCode = fields[index] ?? "";
    const status = parseStatusCode(statusCode);
    if (status === "renamed" || status === "copied") {
      changes.push({
        status,
        previousPath: requireField(fields, index + 1, statusCode),
        path: requireField(fields, index + 2, statusCode),
      });
      index += 3;
    } else {
      changes.push({
        status,
        path: requireField(fields, index + 1, statusCode),
      });
      index += 2;
    }
  }
  return changes;
}

export function strictestTreatment(values: readonly Treatment[]): Treatment {
  return values.reduce<Treatment>(
    (strictest, value) =>
      treatments.indexOf(value) > treatments.indexOf(strictest)
        ? value
        : strictest,
    "auto",
  );
}

export function isTestFile(filePath: string): boolean {
  return matchesAnyPathPattern(filePath, testFilePatterns);
}

export function renderChangeClassificationMarkdown(
  classification: ChangeClassification,
): string {
  const lines = [
    `## 変更の扱い: ${treatmentLabels[classification.treatment]}`,
    "",
  ];
  if (classification.files.length === 0) {
    lines.push("変更されたファイルはない。");
    return `${lines.join("\n")}\n`;
  }
  const strictFiles = classification.files.filter(
    (file) => file.treatment !== "auto",
  );
  const autoFiles = classification.files.filter(
    (file) => file.treatment === "auto",
  );
  if (strictFiles.length > 0) {
    lines.push(...renderFileTreatmentTable(strictFiles), "");
  }
  if (autoFiles.length > 0) {
    lines.push(
      "<details>",
      `<summary>自動の扱いのファイル（${autoFiles.length} 件）</summary>`,
      "",
      ...renderFileTreatmentTable(autoFiles),
      "",
      "</details>",
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function formatChangedPath(change: FileChange): string {
  return change.previousPath === undefined
    ? `\`${change.path}\``
    : `\`${change.previousPath}\` → \`${change.path}\``;
}

function renderFileTreatmentTable(files: readonly FileTreatment[]): string[] {
  return [
    "| ファイル | 扱い | 理由 |",
    "|---|---|---|",
    ...files.map((file) =>
      renderTableRow([
        escapeTableCell(formatChangedPath(file)),
        treatmentLabels[file.treatment],
        escapeTableCell(
          reasonsAtTreatment(file)
            .map((reason) => reason.reason)
            .join("<br>"),
        ),
      ]),
    ),
  ];
}

/** ファイルの扱いを決めた（最も厳しい）理由だけを返す。 */
export function reasonsAtTreatment(file: FileTreatment): TreatmentReason[] {
  return file.reasons.filter((reason) => reason.treatment === file.treatment);
}

function classifyFileChange(
  change: FileChange,
  frontendPackageManifest: PackageManifestRevisions,
): FileTreatment {
  const touches = listPathTouches(change);
  const reasons = [
    ...touches.flatMap((touch) => reasonsForTouch(touch, change)),
    ...(change.status === "unknown" ? [unknownStatusReason] : []),
    ...(touches.some((touch) => touch.path === frontendPackageManifestPath)
      ? reasonsForPackageManifest(frontendPackageManifest)
      : []),
  ];
  const uniqueReasons = deduplicateReasons(reasons).sort(
    (left, right) =>
      treatments.indexOf(right.treatment) - treatments.indexOf(left.treatment),
  );
  return {
    ...change,
    treatment: strictestTreatment(
      uniqueReasons.map((reason) => reason.treatment),
    ),
    reasons: uniqueReasons,
  };
}

function reasonsForTouch(
  touch: PathTouch,
  change: FileChange,
): TreatmentReason[] {
  const matchedRules = changeRules.filter((rule) =>
    rule.matches(touch, change),
  );
  if (matchedRules.length === 0) {
    return [unexpectedPathReason];
  }
  return matchedRules.map(({ treatment, reason }) => ({ treatment, reason }));
}

function reasonsForPackageManifest(
  revisions: PackageManifestRevisions,
): TreatmentReason[] {
  if (revisions.base === null || revisions.head === null) {
    return [
      {
        treatment: "approval",
        reason: `${frontendPackageManifestPath} が追加・削除された`,
      },
    ];
  }
  const base = parsePackageManifest(revisions.base);
  const head = parsePackageManifest(revisions.head);
  if (base === null || head === null) {
    return [
      {
        treatment: "approval",
        reason: `${frontendPackageManifestPath} を JSON として読めない`,
      },
    ];
  }
  const baseDependencies = collectDependencyNames(base);
  const headDependencies = collectDependencyNames(head);
  const addedDependencies = [...headDependencies].filter(
    (name) => !baseDependencies.has(name),
  );
  const removedDependencies = [...baseDependencies].filter(
    (name) => !headDependencies.has(name),
  );
  const changedGateScripts = qualityGateScriptNames.filter(
    (name) => readScript(base, name) !== readScript(head, name),
  );
  return [
    ...addedDependencies.map((name) => ({
      treatment: "approval" as const,
      reason: `依存パッケージ \`${name}\` が増えた`,
    })),
    ...removedDependencies.map((name) => ({
      treatment: "approval" as const,
      reason: `依存パッケージ \`${name}\` が減った`,
    })),
    ...changedGateScripts.map((name) => ({
      treatment: "approval" as const,
      reason: `品質検証が使うスクリプト \`${name}\` が変わった`,
    })),
  ];
}

type PackageManifest = Record<string, unknown>;

function parsePackageManifest(text: string): PackageManifest | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function collectDependencyNames(manifest: PackageManifest): Set<string> {
  return new Set(
    dependencySectionNames.flatMap((sectionName) => {
      const section = manifest[sectionName];
      return isRecord(section) ? Object.keys(section) : [];
    }),
  );
}

function readScript(manifest: PackageManifest, name: string): unknown {
  const scripts = manifest.scripts;
  return isRecord(scripts) ? scripts[name] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listPathTouches(change: FileChange): PathTouch[] {
  switch (change.status) {
    case "added":
    case "copied":
      return [{ path: change.path, kind: "added" }];
    case "deleted":
      return [{ path: change.path, kind: "deleted" }];
    case "renamed":
      return [
        { path: change.previousPath ?? change.path, kind: "deleted" },
        { path: change.path, kind: "added" },
      ];
    case "modified":
    case "type-changed":
    case "unknown":
      return [{ path: change.path, kind: "modified" }];
  }
}

function touchedPathRule(
  treatment: Treatment,
  reason: string,
  patterns: readonly string[],
  options: { excludeTestFiles?: boolean } = {},
): ChangeRule {
  return {
    treatment,
    reason,
    matches(touch) {
      if (options.excludeTestFiles === true && isTestFile(touch.path)) {
        return false;
      }
      return patterns.some((pattern) =>
        matchesPathPattern(touch.path, pattern),
      );
    },
  };
}

function deduplicateReasons(
  reasons: readonly TreatmentReason[],
): TreatmentReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = `${reason.treatment}\0${reason.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compareFileTreatments(
  left: FileTreatment,
  right: FileTreatment,
): number {
  const treatmentOrder =
    treatments.indexOf(right.treatment) - treatments.indexOf(left.treatment);
  if (treatmentOrder !== 0) {
    return treatmentOrder;
  }
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

function parseStatusCode(statusCode: string): FileChangeStatus {
  switch (statusCode[0]) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type-changed";
    default:
      return "unknown";
  }
}

function requireField(
  fields: readonly string[],
  index: number,
  statusCode: string,
): string {
  const field = fields[index];
  if (field === undefined) {
    throw new Error(
      `git diff の出力でステータス ${statusCode} のパスが欠けている`,
    );
  }
  return field;
}

export const _private = { listPathTouches, reasonsForPackageManifest };
