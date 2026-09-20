import { cleanup, render, screen } from "@testing-library/react";

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
  beforeEach(() => {
    render(<WaterSortDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
  });

  test("ウォーターソート固有の診断値を共通ダイアログへ表示すること", () => {
    expect(screen.getByText("ふつう")).toBeTruthy();
    expect(screen.getByText("diagnostics-ui-seed")).toBeTruthy();
    expect(screen.getByText("色 5 / 容量 4 / 空 2")).toBeTruthy();
  });
});
