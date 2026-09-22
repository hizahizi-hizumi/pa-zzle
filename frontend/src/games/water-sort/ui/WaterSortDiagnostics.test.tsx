import { cleanup, render, screen, within } from "@testing-library/react";

import type { WaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";

import { WaterSortDiagnostics } from "./WaterSortDiagnostics";

const snapshot: WaterSortDiagnosticSnapshot = {
  formatVersion: 1,
  game: "water-sort",
  difficulty: "normal",
  problemIdentity: {
    generatorVersion: "1",
    seed: "diagnostics-ui-seed",
    conditions: {
      colorCount: 5,
      capacity: 4,
      emptyBottleCount: 2,
    },
    generationAttempt: 7,
  },
  buildRevision: "abcdef1234567890",
};

afterEach(cleanup);

describe("WaterSortDiagnostics", () => {
  let dialog: HTMLElement;

  beforeEach(() => {
    render(<WaterSortDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
    dialog = screen.getByRole("dialog");
  });

  test("ウォーターソート固有の診断値を共通ダイアログへ表示すること", () => {
    const diagnostics = within(dialog);

    expect(diagnostics.getByText("ふつう")).toBeTruthy();
    expect(diagnostics.getByText("diagnostics-ui-seed")).toBeTruthy();
    expect(diagnostics.getByText("色 5 / 容量 4 / 空 2")).toBeTruthy();
  });
});
