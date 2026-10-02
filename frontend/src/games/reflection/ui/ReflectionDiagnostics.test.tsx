import { cleanup, render, screen } from "@testing-library/react";

import type { ReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";

const snapshot: ReflectionDiagnosticSnapshot = {
  formatVersion: 1,
  game: "reflection",
  difficulty: "4",
  problemIdentity: {
    generatorVersion: "3",
    seed: "rf-7-8-0",
    conditions: { size: 7, pieceCount: 8 },
  },
  problemPool: { poolVersion: "2", problemId: "4-17" },
  difficultyAssessment: {
    status: "classified",
    difficulty: "4",
    reasoningLevel: 4,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

function getRowValue(label: string): string | null | undefined {
  return screen.getByText(label).nextSibling?.textContent;
}

describe("ReflectionDiagnostics", () => {
  beforeEach(() => {
    render(<ReflectionDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("リフレクション固有の診断値を共通ダイアログへ表示すること", () => {
    expect(getRowValue("難易度")).toBe("レベル 4");
    expect(screen.getByText("rf-7-8-0")).toBeTruthy();
    expect(screen.getByText("7×7 / 8ピース")).toBeTruthy();
  });

  test("問題集の版と番号・分類・最高推論レベルを表示すること", () => {
    const values = ["問題集", "分類", "最高推論"].map(getRowValue);

    expect(values).toEqual(["v2 / 4-17", "レベル 4", "L4"]);
  });
});
