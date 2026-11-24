import { cleanup, render, screen, within } from "@testing-library/react";
import { createShuttleParkingDiagnosticSnapshot } from "@/games/shuttle-parking/diagnostics";
import { selectShuttleParkingProblemForDifficulty } from "@/games/shuttle-parking/problem-selection";
import { ShuttleParkingDiagnostics } from "@/games/shuttle-parking/ui/ShuttleParkingDiagnostics";

afterEach(cleanup);

describe("ShuttleParkingDiagnostics", () => {
  const selected = selectShuttleParkingProblemForDifficulty(
    "4",
    "shuttle-parking-diagnostics-dialog",
  );

  beforeEach(() => {
    render(
      <ShuttleParkingDiagnostics
        snapshot={createShuttleParkingDiagnosticSnapshot({
          difficulty: "4",
          problemIdentity: selected.identity,
          buildRevision: null,
        })}
        onClose={vi.fn()}
      />,
    );
  });

  test("難易度と問題の符号と駐車場の大きさを示すこと", () => {
    const dialog = within(screen.getByRole("dialog", { name: "検証情報" }));

    expect(dialog.getByText("レベル 4")).toBeTruthy();
    expect(dialog.getByText(selected.identity.seed)).toBeTruthy();
    expect(
      dialog.getByText(
        `駐車場 ${selected.problem.lot.size}×${selected.problem.lot.size}`,
      ),
    ).toBeTruthy();
  });
});
