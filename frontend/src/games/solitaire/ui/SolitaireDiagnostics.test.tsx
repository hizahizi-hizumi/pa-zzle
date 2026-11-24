import { cleanup, render, screen } from "@testing-library/react";

import type { SolitaireDiagnosticSnapshot } from "@/games/solitaire/diagnostics";
import { SolitaireDiagnostics } from "@/games/solitaire/ui/SolitaireDiagnostics";

const snapshot: SolitaireDiagnosticSnapshot = {
  formatVersion: 1,
  game: "solitaire",
  difficulty: "2",
  problemIdentity: {
    generatorVersion: "1",
    seed: "GkjiCoEDrMsBJILRqXeZVmScdKObauntzhpfTgYANHxQvPFwUlWy",
    conditions: {},
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("SolitaireDiagnostics", () => {
  beforeEach(() => {
    render(<SolitaireDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("難易度と配った札の seed を共通ダイアログへ表示すること", () => {
    expect(screen.getByText("レベル 2")).toBeTruthy();
    expect(screen.getByText(snapshot.problemIdentity.seed)).toBeTruthy();
  });
});
