import { cleanup, render, screen } from "@testing-library/react";

import type { TakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import { TakuzuDiagnostics } from "@/games/takuzu/ui/TakuzuDiagnostics";

const snapshot: TakuzuDiagnosticSnapshot = {
  formatVersion: 1,
  game: "takuzu",
  difficulty: "4",
  problemIdentity: {
    generatorVersion: "1",
    seed: "tk-duplicate-avoidance-2-160",
    conditions: {
      size: 8,
      removalTechniqueLimit: "duplicate-avoidance",
      extraGivenCount: 2,
    },
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("TakuzuDiagnostics", () => {
  beforeEach(() => {
    render(<TakuzuDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("バイナリパズル固有の診断値を共通ダイアログへ表示すること", () => {
    expect(screen.getByText("レベル 4")).toBeTruthy();
    expect(screen.getByText("tk-duplicate-avoidance-2-160")).toBeTruthy();
    expect(screen.getByText("8×8 / 上限 D / 手がかり追加 2")).toBeTruthy();
  });
});
