import { cleanup, render, screen, within } from "@testing-library/react";

import { createHitofudePuzzleDiagnosticSnapshot } from "@/games/hitofude-puzzle/diagnostics";
import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import {
  createHitofudePuzzleProblemIdentity,
  type HitofudePuzzleProblemIdentity,
} from "@/games/hitofude-puzzle/problem/problem";
import { HitofudePuzzleDiagnostics } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDiagnostics";

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
  identity: HitofudePuzzleProblemIdentity,
  difficulty: HitofudePuzzleDifficulty,
) {
  const { problem } = generateHitofudePuzzleProblem(identity);
  return createHitofudePuzzleDiagnosticSnapshot({
    difficulty,
    problemIdentity: identity,
    problem,
    buildRevision: "abcdef1234567890",
  });
}

describe("HitofudePuzzleDiagnostics", () => {
  describe("迷う分岐の無い問題の場合", () => {
    // hp-5-t0-4: 5×5・穴4。始点から取り残しを避けるだけで道が1通りに決まる。
    const snapshot = createSnapshot(
      createHitofudePuzzleProblemIdentity(5, 0, 4),
      "1",
    );

    beforeEach(() => {
      render(
        <HitofudePuzzleDiagnostics snapshot={snapshot} onClose={vi.fn()} />,
      );
    });

    test("生成条件を盤面サイズと先読みの重さの目標で表示すること", () => {
      const value = getRowValue("生成条件");

      expect(value).toBe("5×5 / 先読みの重さの目標 0");
    });

    test("盤面の穴・有効マスを単位付きで表示すること", () => {
      const values = ["穴", "有効マス"].map((label) => getRowValue(label));

      expect(values).toEqual(["4マス", "21マス"]);
    });

    test("一意性と、正解の道を始点から進む向きの矢印で表示すること", () => {
      const values = ["一意性", "正解の道"].map((label) => getRowValue(label));

      expect(values).toEqual(["一意（探索 20節点）", "↑↑↑←↓←↑←←↓→↓→↓→↓←←↑←"]);
    });

    test("提供範囲外と表示し、レベルの条件の行を出さないこと", () => {
      const levelSection = getSection("レベルの判定");

      const assessment = getRowValue("判定", levelSection);
      const conditionRow = within(levelSection).queryByText("先読みの重さ");

      expect(assessment).toBe("提供範囲外（迷う分岐なし）");
      expect(conditionRow).toBeNull();
    });
  });

  describe("レベル5に分類できた問題の場合", () => {
    // hp-8-t0-7: 8×8・穴7。仮置き3局面・最も長い先読み9手（先読みの重さ4）で、レベル5 の組み合わせに当たる。
    const snapshot = createSnapshot(
      createHitofudePuzzleProblemIdentity(8, 0, 7),
      "5",
    );

    beforeEach(() => {
      render(
        <HitofudePuzzleDiagnostics snapshot={snapshot} onClose={vi.fn()} />,
      );
    });

    test("判定したレベルと、組み合わせの各条件にこの問題の値を並べて表示すること", () => {
      const levelSection = getSection("レベルの判定");

      const values = [
        "判定",
        "局所の推論だけで",
        "先読みの重さ",
        "盤面サイズ",
      ].map((label) => getRowValue(label, levelSection));

      expect(values).toEqual([
        "レベル 5",
        "決まらない（条件 決まらない）",
        "4（条件 4以上）",
        "8×8（条件 8）",
      ]);
    });

    test("描画視点の分岐の数と、誤り手を見抜く段階と、最大誤進入を表示すること", () => {
      const drawingSection = getSection("描画視点の分岐");

      const values = ["分岐", "致命分岐", "見抜く段階", "最大誤進入"].map(
        (label) => getRowValue(label, drawingSection),
      );

      expect(values).toEqual([
        "12か所",
        "12か所",
        "2: 11 / 3: 0 / 4: 0 / 5: 1 / 6: 0",
        "探索の上限超",
      ]);
    });
  });
});
