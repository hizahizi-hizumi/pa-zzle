import { cleanup, render, screen, within } from "@testing-library/react";

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
  let dialog: HTMLElement;

  beforeEach(() => {
    render(<NanpureDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
    dialog = screen.getByRole("dialog");
  });

  test("ナンプレ固有の診断値を共通ダイアログへ表示すること", () => {
    const diagnostics = within(dialog);

    expect(diagnostics.getByText("ふつう")).toBeTruthy();
    expect(diagnostics.getByText("diagnostics-ui-seed")).toBeTruthy();
    expect(diagnostics.getByText("ヒント 32")).toBeTruthy();
  });
});
