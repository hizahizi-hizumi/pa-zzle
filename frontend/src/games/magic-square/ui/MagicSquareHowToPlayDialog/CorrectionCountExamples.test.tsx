import { cleanup, render, screen } from "@testing-library/react";

import { CorrectionCountExamples } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/CorrectionCountExamples";
import { correctionCountFlows } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";

afterEach(() => {
  cleanup();
});

/** 図のコマごとの、マスの読み上げ名と行の合計の読み上げ。押せない図の要素から読む。 */
function readFrames(figure: HTMLElement): string[] {
  return [...figure.querySelectorAll('[role="group"]')].map((board) => {
    const cell = board.querySelector("button")?.getAttribute("aria-label");
    const sum = [...board.querySelectorAll(".sr-only")]
      .map((label) => label.textContent ?? "")
      .find((text) => text.startsWith("1行目の合計"));
    return `${cell} / ${sum}`;
  });
}

function getFigure(flow: string): HTMLElement {
  return screen.getByText(flow).closest("figure") as HTMLElement;
}

describe("CorrectionCountExamples", () => {
  beforeEach(() => {
    render(
      <CorrectionCountExamples
        examples={[
          { figure: correctionCountFlows.changed, flow: "替える流れ" },
          { figure: correctionCountFlows.mistyped, flow: "直す流れ" },
        ]}
      />,
    );
  });

  test("離れた数へ替える流れは、空きから合計と違う数を置いて 11 に替え、置き直しを1回と数えること", () => {
    const figure = getFigure("替える流れ");

    expect(readFrames(figure)).toEqual([
      "1行4列 空き / 1行目の合計 23",
      "1行4列 9 / 1行目の合計 32 埋まって合計と違う",
      "1行4列 11 / 1行目の合計 34 そろった",
    ]);
    expect(figure.textContent).toContain("→ 置き直し 1回");
  });

  test("隣の数へ直す流れは、空きから合計と違う数を置いて 11 に直し、置き直しに数えないこと", () => {
    const figure = getFigure("直す流れ");

    expect(readFrames(figure)).toEqual([
      "1行4列 空き / 1行目の合計 23",
      "1行4列 12 / 1行目の合計 35 埋まって合計と違う",
      "1行4列 11 / 1行目の合計 34 そろった",
    ]);
    expect(figure.textContent).toContain("→ 置き直し 0回");
  });

  test("どのコマも押せない図にすること", () => {
    const frames = [...document.querySelectorAll('[role="group"]')];

    expect(frames).toHaveLength(6);
    expect(frames.every((frame) => frame.closest("[inert]") !== null)).toBe(
      true,
    );
  });
});
