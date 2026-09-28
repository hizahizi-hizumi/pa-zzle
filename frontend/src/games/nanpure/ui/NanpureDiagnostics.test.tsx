import { cleanup, render, screen } from "@testing-library/react";

import type { NanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";

import { NanpureDiagnostics } from "@/games/nanpure/ui/NanpureDiagnostics";

const snapshot: NanpureDiagnosticSnapshot = {
  formatVersion: 1,
  game: "nanpure",
  difficulty: "3",
  problemIdentity: {
    generatorVersion: "2",
    seed: "np-locked-candidates-740",
    conditions: { removalTechniqueLimit: "locked-candidates" },
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("NanpureDiagnostics", () => {
  beforeEach(() => {
    render(<NanpureDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("ナンプレ固有の診断値を共通ダイアログへ表示すること", () => {
    expect(screen.getByText("レベル 3")).toBeTruthy();
    expect(screen.getByText("np-locked-candidates-740")).toBeTruthy();
    expect(screen.getByText("上限 locked-candidates")).toBeTruthy();
  });
});
