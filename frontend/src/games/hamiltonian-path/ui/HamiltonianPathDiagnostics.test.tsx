import { cleanup, render, screen, within } from "@testing-library/react";

import { createHamiltonianPathDiagnosticSnapshot } from "@/games/hamiltonian-path/diagnostics";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  createHamiltonianPathProblemIdentity,
  type HamiltonianPathProblemIdentity,
} from "@/games/hamiltonian-path/problem/problem";
import { HamiltonianPathDiagnostics } from "@/games/hamiltonian-path/ui/HamiltonianPathDiagnostics";

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

function createSnapshot(
  identity: HamiltonianPathProblemIdentity,
  difficulty: HamiltonianPathDifficulty,
) {
  const { problem } = generateHamiltonianPathProblem(identity);
  return createHamiltonianPathDiagnosticSnapshot({
    difficulty,
    problemIdentity: identity,
    problem,
    buildRevision: "abcdef1234567890",
  });
}

describe("HamiltonianPathDiagnostics", () => {
  describe("迷う分岐の無い問題の場合", () => {
    // hp-5-0-18: 5×5・壁なし・仕切り6本。始点から取り残しを避けるだけで道が1通りに決まる。
    const snapshot = createSnapshot(
      createHamiltonianPathProblemIdentity(5, 0, 18),
      "1",
    );

    beforeEach(() => {
      render(
        <HamiltonianPathDiagnostics snapshot={snapshot} onClose={vi.fn()} />,
      );
    });

    test("生成条件を盤面サイズと壁率で表示すること", () => {
      const value = getRowValue("生成条件");

      expect(value).toBe("5×5 / 壁率 0%");
    });

    test("盤面の壁・仕切り・有効マスを単位付きで表示すること", () => {
      const values = ["壁マス", "仕切り", "有効マス"].map((label) =>
        getRowValue(label),
      );

      expect(values).toEqual(["0マス", "6本", "25マス"]);
    });

    test("一意性と、正解の道を始点から進む向きの矢印で表示すること", () => {
      const values = ["一意性", "正解の道"].map((label) => getRowValue(label));

      expect(values).toEqual([
        "一意（探索 24節点）",
        "→↑←↑→↑←↑→→↓→↑→↓↓↓↓←←↑↑→↓",
      ]);
    });

    test("提供範囲外と表示し、レベルの条件の行を出さないこと", () => {
      const levelSection = getSection("レベルの判定");

      const assessment = getRowValue("判定", levelSection);
      const conditionRow = within(levelSection).queryByText("仮置き");

      expect(assessment).toBe("提供範囲外（迷う分岐なし）");
      expect(conditionRow).toBeNull();
    });
  });

  describe("レベル5に分類できた問題の場合", () => {
    // hp-8-0-45: 8×8・壁なし。仮置き7回・最も長い先読み19手で、レベル5 の組み合わせに当たる。
    const snapshot = createSnapshot(
      createHamiltonianPathProblemIdentity(8, 0, 45),
      "5",
    );

    beforeEach(() => {
      render(
        <HamiltonianPathDiagnostics snapshot={snapshot} onClose={vi.fn()} />,
      );
    });

    test("判定したレベルと、組み合わせの各条件にこの問題の値を並べて表示すること", () => {
      const levelSection = getSection("レベルの判定");

      const values = [
        "判定",
        "局所の推論だけで",
        "仮置き",
        "盤面サイズ",
        "最も長い先読み",
      ].map((label) => getRowValue(label, levelSection));

      expect(values).toEqual([
        "レベル 5",
        "決まらない（条件 決まらない）",
        "7回（条件 7回以上）",
        "8×8（条件 8）",
        "19手（条件 9手以上）",
      ]);
    });

    test("描画視点の分岐の数と、誤り手を見抜く段階と、最大誤進入を表示すること", () => {
      const drawingSection = getSection("描画視点の分岐");

      const values = ["分岐", "致命分岐", "見抜く段階", "最大誤進入"].map(
        (label) => getRowValue(label, drawingSection),
      );

      expect(values).toEqual([
        "13か所",
        "13か所",
        "2: 9 / 3: 0 / 4: 0 / 5: 4 / 6: 0",
        "32マス",
      ]);
    });
  });
});
