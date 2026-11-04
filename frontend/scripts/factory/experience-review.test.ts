import {
  type ChangeClassification,
  classifyChanges,
  type FileChange,
} from "./change-treatment";
import {
  collectReferencedIds,
  isRequirementReferenceSource,
  listGoldenChanges,
  listReviewItems,
  renderExperienceReviewMarkdown,
} from "./experience-review";

const packageManifest = "{}";

function classify(changes: FileChange[]): ChangeClassification {
  return classifyChanges({
    changes,
    frontendPackageManifest: { base: packageManifest, head: packageManifest },
  });
}

describe("isRequirementReferenceSource", () => {
  const cases = [
    ["frontend/src/games/score.test.ts", true],
    ["frontend/e2e/main-flow.e2e.ts", true],
    ["frontend/golden/problem-ids.json", true],
    ["docs/プロダクト/要件/FR-001.md", true],
    ["GAME.md", true],
    ["frontend/src/games/score.ts", false],
  ] as const;

  test.each(cases)("%s から ID を拾うかを返すこと", (filePath, expected) => {
    const isSource = isRequirementReferenceSource(filePath);

    expect(isSource).toBe(expected);
  });
});

describe("collectReferencedIds", () => {
  const changedFiles = [
    { path: "frontend/src/b.test.ts", text: "// FR-001 SPEC-003" },
    { path: "docs/プロダクト/要件/FR-001.md", text: "---\nid: FR-001\n---" },
  ];
  const documents = [
    { id: "FR-001", title: "選べる", path: "docs/プロダクト/要件/FR-001.md" },
  ];

  test("ID ごとに題と出てくるファイルをまとめること", () => {
    const referenced = collectReferencedIds(changedFiles, documents);

    expect(referenced).toEqual([
      {
        id: "FR-001",
        title: "選べる",
        paths: ["docs/プロダクト/要件/FR-001.md", "frontend/src/b.test.ts"],
      },
      { id: "SPEC-003", title: null, paths: ["frontend/src/b.test.ts"] },
    ]);
  });
});

describe("listGoldenChanges", () => {
  const classification = classify([
    { status: "modified", path: "frontend/golden/problem-ids.json" },
    {
      status: "renamed",
      previousPath: "frontend/golden/old.json",
      path: "frontend/src/old.json",
    },
    { status: "modified", path: "frontend/src/games/score.ts" },
  ]);

  test("golden の中で変わったファイルだけを返すこと", () => {
    const goldenChanges = listGoldenChanges(classification);

    expect(goldenChanges.map((file) => file.path)).toEqual([
      "frontend/golden/problem-ids.json",
      "frontend/src/old.json",
    ]);
  });
});

describe("listReviewItems", () => {
  describe("自動の扱いの場合", () => {
    const classification = classify([
      { status: "modified", path: "frontend/src/games/score.ts" },
    ]);

    test("PO が見ることは無いこと", () => {
      const items = listReviewItems(classification);

      expect(items).toEqual([]);
    });
  });

  describe("体験確認の扱いの場合", () => {
    const classification = classify([
      { status: "modified", path: "frontend/src/components/PlayHeader.tsx" },
    ]);

    test("プレビューで遊ぶ観点を挙げること", () => {
      const items = listReviewItems(classification);

      expect(items[0]).toContain("プレビュー URL");
    });
  });

  describe("文書だけの承認の扱いの場合", () => {
    const classification = classify([
      { status: "modified", path: "AGENTS.md" },
    ]);

    test("影響の確認だけを挙げ、遊ぶ観点を挙げないこと", () => {
      const items = listReviewItems(classification);

      expect(items.some((item) => item.includes("合格基準"))).toBe(true);
      expect(items.some((item) => item.includes("プレビュー URL"))).toBe(false);
    });
  });

  describe("golden と画面が変わる承認の扱いの場合", () => {
    const classification = classify([
      { status: "modified", path: "frontend/golden/problem-ids.json" },
      { status: "modified", path: "frontend/src/components/PlayHeader.tsx" },
    ]);

    test("golden の影響と遊ぶ観点の両方を挙げること", () => {
      const items = listReviewItems(classification);

      expect(items.some((item) => item.includes("golden の差分"))).toBe(true);
      expect(items.some((item) => item.includes("プレビュー URL"))).toBe(true);
    });
  });
});

describe("renderExperienceReviewMarkdown", () => {
  const classification = classify([
    { status: "modified", path: "frontend/golden/problem-ids.json" },
  ]);

  describe("E2E の artifact がある場合", () => {
    const markdown = renderExperienceReviewMarkdown({
      classification,
      referencedIds: [],
      e2eArtifactUrl: "https://example.com/artifact",
    });

    test("扱い・一方向ドア面・artifact・チェックリストを載せること", () => {
      const sections = markdown
        .split("\n")
        .filter((line) => line.startsWith("#"));

      expect(sections).toEqual([
        "# 体験レビュー票",
        "## 変更の扱い: 承認",
        "## 変わった一方向ドア面",
        "## 関係する要件・仕様",
        "## E2E スクリーンショット",
        "## PO が見ること",
      ]);
      expect(markdown).toContain(
        "- `frontend/golden/problem-ids.json`（変更）",
      );
      expect(markdown).toContain("[e2e-results](https://example.com/artifact)");
    });
  });

  describe("E2E の artifact が無い場合", () => {
    const markdown = renderExperienceReviewMarkdown({
      classification,
      referencedIds: [],
      e2eArtifactUrl: null,
    });

    test("artifact が無いことを知らせること", () => {
      const notice = markdown.includes("artifact が無い");

      expect(notice).toBe(true);
    });
  });
});
