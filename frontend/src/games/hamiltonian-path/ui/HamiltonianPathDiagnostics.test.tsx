import { cleanup, render, screen } from "@testing-library/react";

import { createHamiltonianPathDiagnosticSnapshot } from "@/games/hamiltonian-path/diagnostics";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import { HamiltonianPathDiagnostics } from "@/games/hamiltonian-path/ui/HamiltonianPathDiagnostics";

afterEach(cleanup);

function getRowValue(label: string): string | null | undefined {
  return screen.getByText(label).nextSibling?.textContent;
}

describe("HamiltonianPathDiagnostics", () => {
  // 仕切りで、始点から左右へ折り返す道だけが全マスを通る。
  const problem = parseHamiltonianPathBoard([
    "S . .",
    "- -",
    ". . .",
    "  - -",
    ". . .",
  ]);
  const snapshot = createHamiltonianPathDiagnosticSnapshot({
    difficulty: "1",
    problemIdentity: {
      generatorVersion: "1",
      seed: "hp-5-0-0",
      conditions: { size: 5, wallRatio: 0.15 },
    },
    problem,
    buildRevision: "abcdef1234567890",
  });

  beforeEach(() => {
    render(
      <HamiltonianPathDiagnostics snapshot={snapshot} onClose={vi.fn()} />,
    );
  });

  test("生成条件を盤面サイズと壁率で表示すること", () => {
    expect(getRowValue("生成条件")).toBe("5×5 / 壁率 15%");
  });

  test("盤面の壁・仕切り・有効マスを単位付きで表示すること", () => {
    const values = ["壁マス", "仕切り", "有効マス"].map(getRowValue);

    expect(values).toEqual(["0マス", "4本", "9マス"]);
  });

  test("一意性と、正解の道を始点から進む向きの矢印で表示すること", () => {
    const values = ["一意性", "正解の道"].map(getRowValue);

    expect(values[0]).toMatch(/^一意（探索 \d+節点）$/);
    expect(values[1]).toBe("→→↓←←↓→→");
  });

  test("迷う分岐が無い問題を提供範囲外と表示すること", () => {
    expect(getRowValue("判定")).toBe("提供範囲外（迷う分岐なし）");
  });
});
