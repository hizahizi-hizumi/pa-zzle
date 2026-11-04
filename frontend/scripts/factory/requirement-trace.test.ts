import {
  buildRequirementTrace,
  classifyVerificationGate,
  findIdOccurrences,
  renderRequirementTraceMarkdown,
} from "./requirement-trace";

describe("classifyVerificationGate", () => {
  const cases = [
    ["frontend/src/games/score.test.ts", "unit-test"],
    ["frontend/src/components/PlayHeader.test.tsx", "unit-test"],
    ["frontend/e2e/main-flow.e2e.ts", "e2e"],
    ["frontend/golden/problem-ids.test.ts", "golden"],
    ["frontend/golden/fixtures/records.json", "golden"],
    ["frontend/src/games/score.ts", null],
  ] as const;

  test.each(cases)("%s を %s のゲートに数えること", (filePath, expected) => {
    const gate = classifyVerificationGate(filePath);

    expect(gate).toBe(expected);
  });
});

describe("findIdOccurrences", () => {
  const file = {
    path: "frontend/src/a.test.ts",
    text: 'test("FR-001 と NFR-012 を守ること FR-001", () => {});\n// 要件NFR-003\nconst x = "XFR-001";',
  };

  test("行番号つきで ID を行ごとに1つずつ拾い、別の語の一部は拾わないこと", () => {
    const occurrences = findIdOccurrences(file);

    expect(occurrences).toEqual([
      { id: "FR-001", path: "frontend/src/a.test.ts", line: 1 },
      { id: "NFR-012", path: "frontend/src/a.test.ts", line: 1 },
      { id: "NFR-003", path: "frontend/src/a.test.ts", line: 2 },
    ]);
  });
});

describe("buildRequirementTrace", () => {
  const documents = [
    { id: "FR-001", title: "選べる", path: "docs/プロダクト/要件/FR-001.md" },
    { id: "NFR-001", title: "楽しい", path: "docs/プロダクト/要件/NFR-001.md" },
  ];
  const verificationFiles = [
    { path: "frontend/src/a.test.ts", text: "// FR-001" },
    { path: "frontend/e2e/flow.e2e.ts", text: "// FR-001\n// FR-999" },
  ];
  const trace = buildRequirementTrace(documents, verificationFiles);

  test("文書の ID ごとに、ゲート別の参照場所をまとめること", () => {
    const firstRow = trace.rows[0];

    expect(firstRow?.occurrences).toEqual({
      "unit-test": [{ id: "FR-001", path: "frontend/src/a.test.ts", line: 1 }],
      golden: [],
      e2e: [{ id: "FR-001", path: "frontend/e2e/flow.e2e.ts", line: 1 }],
    });
  });

  test("文書に無い ID への参照を別に挙げること", () => {
    const unknown = trace.unknownIdOccurrences;

    expect(unknown).toEqual([
      { id: "FR-999", path: "frontend/e2e/flow.e2e.ts", line: 2 },
    ]);
  });

  test("参照の数と、参照の無い ID を含む表を出すこと", () => {
    const markdown = renderRequirementTraceMarkdown(trace);

    expect(markdown).toContain("検査から参照されている ID: 1 / 2。");
    expect(markdown).toContain("| NFR-001 | 楽しい |  |  |  |");
    expect(markdown).toContain("- FR-999: `frontend/e2e/flow.e2e.ts:2`");
  });
});
