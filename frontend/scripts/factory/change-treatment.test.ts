import {
  _private,
  type ChangeClassificationInput,
  classifyChanges,
  type FileChange,
  parseNameStatusOutput,
  reasonsAtTreatment,
  renderChangeClassificationMarkdown,
  strictestTreatment,
  type Treatment,
} from "./change-treatment";

const { listPathTouches, reasonsForPackageManifest } = _private;

const packageManifest = JSON.stringify({
  scripts: { test: "vitest run", dev: "vite" },
  dependencies: { react: "^19" },
  devDependencies: { vitest: "^5.0.0" },
});

const unchangedPackageManifest = {
  base: packageManifest,
  head: packageManifest,
};

function classifySingleChange(change: FileChange): Treatment {
  return classifyChanges({
    changes: [change],
    frontendPackageManifest: unchangedPackageManifest,
  }).treatment;
}

describe("classifyChanges", () => {
  describe("ファイルが1つ変わった場合", () => {
    const cases: readonly [FileChange, Treatment][] = [
      [
        { status: "modified", path: "docs/プロダクト/要件/FR-001.md" },
        "approval",
      ],
      [{ status: "added", path: "docs/プロダクト/要求/RQ-011.md" }, "approval"],
      [{ status: "added", path: "docs/adr/ADR-0015-x.md" }, "approval"],
      [{ status: "modified", path: "AGENTS.md" }, "approval"],
      [{ status: "modified", path: "DESIGN.md" }, "approval"],
      [{ status: "modified", path: ".claude/rules/vitest.md" }, "approval"],
      [{ status: "modified", path: ".claude/settings.json" }, "approval"],
      [
        { status: "modified", path: ".github/workflows/quality-gate.yml" },
        "approval",
      ],
      [{ status: "modified", path: "scripts/verify.sh" }, "approval"],
      [{ status: "modified", path: "frontend/biome.json" }, "approval"],
      [{ status: "modified", path: "frontend/vitest.config.ts" }, "approval"],
      [{ status: "added", path: "frontend/playwright.config.ts" }, "approval"],
      [
        { status: "modified", path: "frontend/scripts/dependency-rules.ts" },
        "approval",
      ],
      [
        {
          status: "modified",
          path: "frontend/scripts/factory/change-treatment.ts",
        },
        "approval",
      ],
      [
        { status: "added", path: "frontend/golden/problem-ids.json" },
        "approval",
      ],
      [
        { status: "modified", path: "frontend/e2e/main-flow.e2e.ts" },
        "approval",
      ],
      [
        { status: "deleted", path: "frontend/e2e/main-flow.e2e.ts" },
        "approval",
      ],
      [
        { status: "deleted", path: "frontend/src/games/score.test.ts" },
        "approval",
      ],
      [
        {
          status: "renamed",
          previousPath: "frontend/src/games/score.test.ts",
          path: "frontend/src/games/score-helper.ts",
        },
        "approval",
      ],
      [
        {
          status: "renamed",
          previousPath: "frontend/src/games/foo.ts",
          path: ".github/workflows/new.yml",
        },
        "approval",
      ],
      [
        {
          status: "modified",
          path: "frontend/src/games/nanpure/ui/NanpurePlay/NanpurePlay.tsx",
        },
        "experience-check",
      ],
      [
        {
          status: "modified",
          path: "frontend/src/records/ui/PlayRecordsScreen/PlayRecordsScreen.tsx",
        },
        "experience-check",
      ],
      [
        { status: "modified", path: "frontend/src/components/PlayHeader.tsx" },
        "experience-check",
      ],
      [
        { status: "modified", path: "frontend/src/pages/index.tsx" },
        "experience-check",
      ],
      [
        {
          status: "modified",
          path: "frontend/src/views/NotFoundView/NotFoundView.tsx",
        },
        "experience-check",
      ],
      [
        { status: "modified", path: "frontend/src/games/takuzu/play/rules.ts" },
        "experience-check",
      ],
      [
        {
          status: "modified",
          path: "frontend/src/games/takuzu/puzzle/board.ts",
        },
        "experience-check",
      ],
      [
        {
          status: "modified",
          path: "frontend/src/game-catalog/game-catalog.ts",
        },
        "experience-check",
      ],
      [
        { status: "added", path: "frontend/src/assets/sounds/tap.mp3" },
        "experience-check",
      ],
      [
        {
          status: "added",
          path: "frontend/src/games/nanpure/assets/sounds/fill.mp3",
        },
        "experience-check",
      ],
      [
        { status: "modified", path: "frontend/styles/globals.css" },
        "experience-check",
      ],
      [
        { status: "modified", path: "frontend/public/favicon.svg" },
        "experience-check",
      ],
      [{ status: "modified", path: "frontend/index.html" }, "experience-check"],
      [
        {
          status: "modified",
          path: "frontend/src/games/nanpure/problem/problem-pool.json",
        },
        "experience-check",
      ],
      [
        { status: "modified", path: "frontend/vite.config.ts" },
        "experience-check",
      ],
      [
        { status: "modified", path: "docs/プロダクト/仕様/パズル/SPEC-008.md" },
        "experience-check",
      ],
      [
        { status: "modified", path: "docs/プロダクト/画面/SCR-001.md" },
        "experience-check",
      ],
      [
        { status: "modified", path: "docs/パズル/難易度.md" },
        "experience-check",
      ],
      [{ status: "added", path: "unexpected/file.txt" }, "experience-check"],
      [
        { status: "unknown", path: "frontend/src/games/score.ts" },
        "experience-check",
      ],
      [{ status: "modified", path: "frontend/src/games/score.ts" }, "auto"],
      [{ status: "modified", path: "frontend/src/records/storage.ts" }, "auto"],
      [
        {
          status: "modified",
          path: "frontend/src/games/nanpure/problem/generator.ts",
        },
        "auto",
      ],
      [
        {
          status: "modified",
          path: "frontend/src/games/nanpure/session/session.ts",
        },
        "auto",
      ],
      [
        {
          status: "modified",
          path: "frontend/src/games/nanpure/ui/NanpurePlay/NanpurePlay.test.tsx",
        },
        "auto",
      ],
      [
        { status: "added", path: "frontend/src/games/score-extra.test.ts" },
        "auto",
      ],
      [
        {
          status: "renamed",
          previousPath: "frontend/src/games/score.test.ts",
          path: "frontend/src/games/score/score.test.ts",
        },
        "auto",
      ],
      [{ status: "added", path: "frontend/e2e/new-flow.e2e.ts" }, "auto"],
      [
        {
          status: "modified",
          path: "frontend/scripts/generate-nanpure-problem-pool.ts",
        },
        "auto",
      ],
      [{ status: "modified", path: "frontend/bun.lock" }, "auto"],
      [{ status: "modified", path: "frontend/package.json" }, "auto"],
      [{ status: "modified", path: "backend/app/main.py" }, "auto"],
      [{ status: "modified", path: "docs/メモ/ChatGPT画面確認.md" }, "auto"],
      [{ status: "modified", path: ".claude/skills/commit/SKILL.md" }, "auto"],
      [{ status: "modified", path: "scripts/chatgpt_playwright.py" }, "auto"],
    ];

    test.each(cases)(
      "変更に応じた扱いになること: %j → %s",
      (change, expected) => {
        const treatment = classifySingleChange(change);

        expect(treatment).toBe(expected);
      },
    );
  });

  describe("扱いの違うファイルが混ざっている場合", () => {
    const input: ChangeClassificationInput = {
      changes: [
        { status: "modified", path: "frontend/src/games/score.ts" },
        { status: "modified", path: "frontend/src/components/PlayHeader.tsx" },
        { status: "modified", path: "AGENTS.md" },
      ],
      frontendPackageManifest: unchangedPackageManifest,
    };

    test("最も厳しい扱いになること", () => {
      const classification = classifyChanges(input);

      expect(classification.treatment).toBe("approval");
    });

    test("厳しい扱いのファイルから順に並べること", () => {
      const classification = classifyChanges(input);

      expect(classification.files.map((file) => file.path)).toEqual([
        "AGENTS.md",
        "frontend/src/components/PlayHeader.tsx",
        "frontend/src/games/score.ts",
      ]);
    });
  });

  describe("変更が無い場合", () => {
    const input: ChangeClassificationInput = {
      changes: [],
      frontendPackageManifest: unchangedPackageManifest,
    };

    test("自動の扱いになること", () => {
      const classification = classifyChanges(input);

      expect(classification.treatment).toBe("auto");
    });
  });

  describe("frontend/package.json で依存パッケージが増えた場合", () => {
    const input: ChangeClassificationInput = {
      changes: [{ status: "modified", path: "frontend/package.json" }],
      frontendPackageManifest: {
        base: packageManifest,
        head: JSON.stringify({
          scripts: { test: "vitest run", dev: "vite" },
          dependencies: { react: "^19", zod: "^4" },
          devDependencies: { vitest: "^5.0.0" },
        }),
      },
    };

    test("増えたパッケージ名を理由にして承認の扱いになること", () => {
      const classification = classifyChanges(input);

      expect(classification.files[0]).toMatchObject({
        treatment: "approval",
        reasons: expect.arrayContaining([
          { treatment: "approval", reason: "依存パッケージ `zod` が増えた" },
        ]),
      });
    });
  });
});

describe("reasonsForPackageManifest", () => {
  const cases: readonly [string, object, string[]][] = [
    [
      "版の更新だけ",
      {
        scripts: { test: "vitest run", dev: "vite" },
        dependencies: { react: "^19.1" },
        devDependencies: { vitest: "^5.1.0" },
      },
      [],
    ],
    [
      "dependencies から devDependencies への移動",
      {
        scripts: { test: "vitest run", dev: "vite" },
        devDependencies: { react: "^19", vitest: "^5.0.0" },
      },
      [],
    ],
    [
      "品質検証に使わないスクリプトの変更",
      {
        scripts: { test: "vitest run", dev: "vite --host" },
        dependencies: { react: "^19" },
        devDependencies: { vitest: "^5.0.0" },
      },
      [],
    ],
    [
      "依存パッケージの削除",
      {
        scripts: { test: "vitest run", dev: "vite" },
        dependencies: { react: "^19" },
      },
      ["依存パッケージ `vitest` が減った"],
    ],
    [
      "品質検証に使うスクリプトの変更",
      {
        scripts: { test: "vitest run --passWithNoTests", dev: "vite" },
        dependencies: { react: "^19" },
        devDependencies: { vitest: "^5.0.0" },
      },
      ["品質検証が使うスクリプト `test` が変わった"],
    ],
  ];

  test.each(cases)(
    "変化に応じた承認の理由を返すこと: %s",
    (_, head, expected) => {
      const reasons = reasonsForPackageManifest({
        base: packageManifest,
        head: JSON.stringify(head),
      });

      expect(reasons.map((reason) => reason.reason)).toEqual(expected);
    },
  );

  describe("JSON として読めない場合", () => {
    const revisions = { base: packageManifest, head: "{" };

    test("承認の理由を返すこと", () => {
      const reasons = reasonsForPackageManifest(revisions);

      expect(reasons.map((reason) => reason.treatment)).toEqual(["approval"]);
    });
  });
});

describe("listPathTouches", () => {
  const renamed: FileChange = {
    status: "renamed",
    previousPath: "a/old.ts",
    path: "b/new.ts",
  };

  test("移動を、元の場所の削除と新しい場所の追加として扱うこと", () => {
    const touches = listPathTouches(renamed);

    expect(touches).toEqual([
      { path: "a/old.ts", kind: "deleted" },
      { path: "b/new.ts", kind: "added" },
    ]);
  });
});

describe("parseNameStatusOutput", () => {
  const output = [
    "M",
    "frontend/src/games/score.ts",
    "R087",
    "docs/プロダクト/画面/SCR-001.md",
    "docs/プロダクト/画面/SCR-008.md",
    "A",
    "frontend/golden/ids.json",
    "D",
    "frontend/src/games/score.test.ts",
    "C100",
    "a.ts",
    "b.ts",
    "",
  ].join("\0");

  test("-z の出力を変更の一覧として読むこと", () => {
    const changes = parseNameStatusOutput(output);

    expect(changes).toEqual([
      { status: "modified", path: "frontend/src/games/score.ts" },
      {
        status: "renamed",
        previousPath: "docs/プロダクト/画面/SCR-001.md",
        path: "docs/プロダクト/画面/SCR-008.md",
      },
      { status: "added", path: "frontend/golden/ids.json" },
      { status: "deleted", path: "frontend/src/games/score.test.ts" },
      { status: "copied", previousPath: "a.ts", path: "b.ts" },
    ]);
  });

  describe("パスが欠けている場合", () => {
    const truncatedOutput = "M\0";

    test("例外を投げること", () => {
      const act = () => parseNameStatusOutput(truncatedOutput);

      expect(act).toThrow();
    });
  });
});

describe("strictestTreatment", () => {
  const cases: readonly [Treatment[], Treatment][] = [
    [[], "auto"],
    [["auto", "experience-check"], "experience-check"],
    [["experience-check", "approval", "auto"], "approval"],
  ];

  test.each(cases)("最も厳しい扱いを返すこと: %j", (values, expected) => {
    const treatment = strictestTreatment(values);

    expect(treatment).toBe(expected);
  });
});

describe("reasonsAtTreatment", () => {
  const classification = classifyChanges({
    changes: [{ status: "modified", path: "docs/プロダクト/要件/FR-001.md" }],
    frontendPackageManifest: unchangedPackageManifest,
  });

  test("ファイルの扱いを決めた理由だけを返すこと", () => {
    const reasons = reasonsAtTreatment(classification.files[0]!);

    expect(reasons).toEqual([
      {
        treatment: "approval",
        reason: "要求・要件は実装が正しいかを判定する基準",
      },
    ]);
  });
});

describe("renderChangeClassificationMarkdown", () => {
  const classification = classifyChanges({
    changes: [
      { status: "modified", path: "frontend/src/components/PlayHeader.tsx" },
      { status: "modified", path: "frontend/src/games/score.ts" },
    ],
    frontendPackageManifest: unchangedPackageManifest,
  });

  test("扱いを見出しにし、自動のファイルを折りたたむこと", () => {
    const markdown = renderChangeClassificationMarkdown(classification);

    expect(markdown).toBe(
      [
        "## 変更の扱い: 体験確認",
        "",
        "| ファイル | 扱い | 理由 |",
        "|---|---|---|",
        "| `frontend/src/components/PlayHeader.tsx` | 体験確認 | 画面の見た目・操作が変わりうる |",
        "",
        "<details>",
        "<summary>自動の扱いのファイル（1 件）</summary>",
        "",
        "| ファイル | 扱い | 理由 |",
        "|---|---|---|",
        "| `frontend/src/games/score.ts` | 自動 | 内部の実装・道具・資料・依存の更新。一方向ドア面に触れたかは golden の差分で判定する |",
        "",
        "</details>",
        "",
      ].join("\n"),
    );
  });
});
