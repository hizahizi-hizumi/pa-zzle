import { cleanup, render, screen } from "@testing-library/react";

import type { ReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";

const snapshot: ReflectionDiagnosticSnapshot = {
  formatVersion: 1,
  game: "reflection",
  difficulty: "4",
  problemIdentity: {
    generatorVersion: "2",
    seed: "rf-7-8-0",
    conditions: { size: 7, pieceCount: 8 },
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("ReflectionDiagnostics", () => {
  beforeEach(() => {
    render(<ReflectionDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("リフレクション固有の診断値を共通ダイアログへ表示すること", () => {
    expect(screen.getByText("レベル 4")).toBeTruthy();
    expect(screen.getByText("rf-7-8-0")).toBeTruthy();
    expect(screen.getByText("7×7 / 8ピース")).toBeTruthy();
  });
});
