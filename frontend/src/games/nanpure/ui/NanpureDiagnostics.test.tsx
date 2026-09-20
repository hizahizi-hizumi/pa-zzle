import { cleanup, render, screen } from "@testing-library/react";

import type { NanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";

import { NanpureDiagnostics } from "./NanpureDiagnostics";

const snapshot: NanpureDiagnosticSnapshot = {
  formatVersion: 1,
  game: "nanpure",
  difficulty: "normal",
  problemIdentity: {
    generatorVersion: "1",
    seed: "diagnostics-ui-seed",
    conditions: { clueCount: 32 },
    generationAttempt: 7,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("NanpureDiagnostics", () => {
  beforeEach(() => {
    render(<NanpureDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("ナンプレ固有の診断値を共通ダイアログへ表示すること", () => {
    expect(screen.getByText("ふつう")).toBeTruthy();
    expect(screen.getByText("diagnostics-ui-seed")).toBeTruthy();
    expect(screen.getByText("ヒント 32")).toBeTruthy();
  });
});
