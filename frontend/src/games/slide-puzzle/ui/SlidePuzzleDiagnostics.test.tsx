import { cleanup, render, screen } from "@testing-library/react";

import type { SlidePuzzleDiagnosticSnapshot } from "@/games/slide-puzzle/diagnostics";
import { SlidePuzzleDiagnostics } from "@/games/slide-puzzle/ui/SlidePuzzleDiagnostics";

const snapshot: SlidePuzzleDiagnosticSnapshot = {
  formatVersion: 1,
  game: "slide-puzzle",
  difficulty: "3",
  problemIdentity: {
    generatorVersion: "1",
    seed: "fp30-0",
    conditions: { size: 4, scrambleLength: 30 },
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("SlidePuzzleDiagnostics", () => {
  beforeEach(() => {
    render(<SlidePuzzleDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("スライドパズル固有の診断値を共通ダイアログへ表示すること", () => {
    const difficulty = screen.getByText("レベル 3");
    const seed = screen.getByText("fp30-0");
    const conditions = screen.getByText("盤面 4×4 / 撹拌 30手");

    expect(difficulty).toBeTruthy();
    expect(seed).toBeTruthy();
    expect(conditions).toBeTruthy();
  });

  test("生成試行の行を表示しないこと", () => {
    const generationAttempt = screen.queryByText("生成試行");

    expect(generationAttempt).toBeNull();
  });
});
