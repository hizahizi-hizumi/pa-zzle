import { cleanup, render, screen } from "@testing-library/react";

import type { MagicSquareDiagnosticSnapshot } from "@/games/magic-square/diagnostics";
import { MagicSquareDiagnostics } from "@/games/magic-square/ui/MagicSquareDiagnostics";

const snapshot: MagicSquareDiagnosticSnapshot = {
  formatVersion: 1,
  game: "magic-square",
  difficulty: "1",
  problemIdentity: {
    generatorVersion: "1",
    seed: "0.4.5.0.0.2.0.0.0.0.12.1.3.0.10.6",
    conditions: { size: 4 },
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("MagicSquareDiagnostics", () => {
  beforeEach(() => {
    render(<MagicSquareDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("難易度・seed・盤面の大きさを共通ダイアログへ表示すること", () => {
    const texts = [
      screen.getByText("レベル 1"),
      screen.getByText("0.4.5.0.0.2.0.0.0.0.12.1.3.0.10.6"),
      screen.getByText("4×4"),
    ];

    expect(texts.every(Boolean)).toBe(true);
  });
});
