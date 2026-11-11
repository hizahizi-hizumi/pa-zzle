import { cleanup, render, screen, within } from "@testing-library/react";

import { createBridgesDiagnosticSnapshot } from "@/games/bridges/diagnostics";
import type { BridgesDifficultyAssessment } from "@/games/bridges/difficulty";
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
      const levelSection = getSection("レベルの判定");

      const values = ["判定", "つながりの手詰まり"].map((label) =>
        getRowValue(label, levelSection),
      );

      expect(values).toEqual([
        "レベル 4",
        `${analysis.connectivityRoundCount}（条件 3以上）`,
      ]);
    });

    test("レベルが求める手筋に、1手の先読みと先読みの場所の最少数・続く長さ・最後のつながりの読みの置き所の条件と値を並べること", () => {
      const section = getSection("レベルが求める手筋");
      const { features } = snapshot.difficultyAssessment as Extract<
        BridgesDifficultyAssessment,
        { status: "classified" }
      >;

      const values = [
        "1手の先読み",
        "続けて要る先読み",
        "先読みの場所の最少数",
        "先読みの続く長さ",
        "最後のつながりの読みの置き所",
      ].map((label) => getRowValue(label, section));

      expect(values).toEqual([
        `${features.lookaheadRoundCount}（条件 1以上）`,
        "0（条件 0）",
        "1（条件 1）",
        "1（条件 1）",
        `${features.lastConnectivityDecidedRatio.toFixed(2)}（条件 0.5以上）`,
      ]);
    });

    test("レベルが問わない手筋は並べないこと", () => {
      const section = getSection("レベルが求める手筋");

      expect(
        ["唯一の通り道", "本数を見る先読み", "組を見る先読み"].map((label) =>
          within(section).queryByText(label),
        ),
      ).toEqual([null, null, null]);
    });

    test("数字と形の質に、架ける行き先と、外周の島・格子を含む盤面の形と、解き始めに決まらない大きい数字の条件と値を並べること", () => {
      const section = getSection("数字と形の質");
      const { features } = snapshot.difficultyAssessment as Extract<
        BridgesDifficultyAssessment,
        { status: "classified" }
      >;

      const values = [
        "架ける行き先の割合",
        "斜め隣に島がある島の割合",
        "外周の島の割合",
        "格子にそろう島の割合",
        "間が1マスの橋の割合",
        "長い橋",
        "解き始めに決まらない5以上の数字の島",
      ].map((label) => getRowValue(label, section));

      expect(values).toEqual([
        `${features.usedEdgeShare.toFixed(2)}（条件 0以上・0.85以下）`,
        `${features.diagonalNeighborShare.toFixed(2)}（条件 0以上・0.5以下）`,
        `${features.borderIslandShare.toFixed(2)}（条件 0以上・0.5以下）`,
        `${features.gridAlignmentShare.toFixed(2)}（条件 0以上・0.5以下）`,
        `${features.shortBridgeShare.toFixed(2)}（条件 0以上・0.5以下）`,
        `${features.longBridgeCount}（条件 1以上）`,
        `${features.lateHighClueCount}（条件 2以上）`,
      ]);
    });

    test("数字と形の質に、レベルが範囲を置かない島の割合は並べないこと", () => {
      const section = getSection("数字と形の質");

      expect(within(section).queryByText("島の割合")).toBeNull();
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
