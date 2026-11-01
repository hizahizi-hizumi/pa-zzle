import { cleanup, render, screen } from "@testing-library/react";

import type { NonogramDiagnosticSnapshot } from "@/games/nonogram/diagnostics";
import { NonogramDiagnostics } from "@/games/nonogram/ui/NonogramDiagnostics";

const snapshot: NonogramDiagnosticSnapshot = {
  formatVersion: 1,
  game: "nonogram",
  difficulty: "5",
  problemIdentity: {
    generatorVersion: "1",
    seed: "ng-10x13-d0.45-s1-n-3",
    conditions: {
      width: 10,
      height: 13,
      blackProbability: 0.45,
      smoothingCount: 1,
      mirrored: false,
    },
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("NonogramDiagnostics", () => {
  beforeEach(() => {
    render(<NonogramDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("ノノグラム固有の診断値を共通ダイアログへ表示すること", () => {
    expect(screen.getByText("レベル 5")).toBeTruthy();
    expect(screen.getByText("ng-10x13-d0.45-s1-n-3")).toBeTruthy();
    expect(
      screen.getByText("10×13 / 黒 0.45 / 平滑化 1 / 対称なし"),
    ).toBeTruthy();
  });
});
