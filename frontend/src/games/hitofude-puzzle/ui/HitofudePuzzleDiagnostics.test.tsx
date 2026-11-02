import { cleanup, render, screen, within } from "@testing-library/react";

import { createHitofudePuzzleDiagnosticSnapshot } from "@/games/hitofude-puzzle/diagnostics";
import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import {
  createHitofudePuzzleProblemIdentity,
  type HitofudePuzzleIdentifiedProblem,
} from "@/games/hitofude-puzzle/problem/problem";
import {
  listHitofudePuzzlePoolEntries,
  toHitofudePuzzlePooledProblem,
} from "@/games/hitofude-puzzle/problem/problem-pool";
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
  { problem, identity }: HitofudePuzzleIdentifiedProblem,
  difficulty: HitofudePuzzleDifficulty,
) {
  return createHitofudePuzzleDiagnosticSnapshot({
    difficulty,
    problemIdentity: identity,
    problem,
    buildRevision: "abcdef1234567890",
  });
}

describe("HitofudePuzzleDiagnostics", () => {
  describe("迷う分岐の無い問題の場合", () => {
    // hp-5-t0-4: 5×5 は問題集に無い盤面の大きさで、迷う分岐の無い問題になる。
    const identity = createHitofudePuzzleProblemIdentity(5, 0, 4);
    const snapshot = createSnapshot(
      { problem: generateHitofudePuzzleProblem(identity).problem, identity },
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

      expect(values).toEqual(["6マス", "19マス"]);
    });

    test("一意性と、正解の道を始点から進む向きの矢印で表示すること", () => {
      const values = ["一意性", "正解の道"].map((label) => getRowValue(label));

      expect(values).toEqual(["一意（探索 18節点）", "↑→↓↓←↓→↓←←↑←←↑→↑↑←"]);
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
    // 問題集のレベル5 の先頭の問題。生成し直さずに問題集の盤面をそのまま使う。
    const snapshot = createSnapshot(
      toHitofudePuzzlePooledProblem(listHitofudePuzzlePoolEntries("5")[0]!),
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
        "18か所",
        "18か所",
        "2: 18 / 3: 0 / 4: 0 / 5: 0 / 6: 0",
        "40マス",
      ]);
    });
  });
});
