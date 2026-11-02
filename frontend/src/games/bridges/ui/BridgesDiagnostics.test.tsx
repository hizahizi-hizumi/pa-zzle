import { cleanup, render, screen, within } from "@testing-library/react";

import { createBridgesDiagnosticSnapshot } from "@/games/bridges/diagnostics";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import { BridgesDiagnostics } from "@/games/bridges/ui/BridgesDiagnostics";

afterEach(cleanup);

function getSection(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).closest("section")!;
}

function getRowValue(
  label: string,
  container: HTMLElement = document.body,
): string | null | undefined {
  return within(container).getByText(label).nextSibling?.textContent;
}

describe("BridgesDiagnostics", () => {
  describe("問題集のレベル4 の問題の場合", () => {
    const { problem, identity, analysis } = selectBridgesProblemForDifficulty(
      "4",
      "bridges-diagnostics",
    );
    const snapshot = createBridgesDiagnosticSnapshot({
      difficulty: "4",
      problemIdentity: identity,
      problem,
      buildRevision: "abcdef1234567890",
    });

    beforeEach(() => {
      render(<BridgesDiagnostics snapshot={snapshot} onClose={vi.fn()} />);
    });

    test("生成条件を盤面サイズと各割合で表示すること", () => {
      const value = getRowValue("生成条件");

      expect(value).toBe(
        `${identity.conditions.size}×${identity.conditions.size} / 島の密度 ${identity.conditions.islandDensity} / 2本 ${identity.conditions.doubleBridgeRate} / 輪 ${identity.conditions.extraBridgeRate} / 分割 ${identity.conditions.splitRate}`,
      );
    });

    test("レベルの判定に、判定したレベルとつながりの手詰まりの条件を並べること", () => {
      const section = getSection("レベルの判定");

      expect(getRowValue("判定", section)).toBe("レベル 4");
      expect(getRowValue("つながりの手詰まり", section)).toBe(
        `${analysis.connectivityRoundCount}（条件 2）`,
      );
    });

    test("一意解を示すこと", () => {
      const value = getRowValue("一意性", getSection("一意解"));

      expect(value).toMatch(/^一意（探索 \d+局面）$/);
    });

    test("人間向け解法器のつながりの手詰まりを問題集と同じ回数で示すこと", () => {
      const value = getRowValue(
        "つながりの手詰まり",
        getSection("人間向け解法器"),
      );

      expect(value).toBe(`${analysis.connectivityRoundCount}回`);
    });
  });
});
