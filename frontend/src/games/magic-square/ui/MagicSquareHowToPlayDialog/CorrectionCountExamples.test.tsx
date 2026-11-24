import { cleanup, render, screen } from "@testing-library/react";

import { CorrectionCountExamples } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/CorrectionCountExamples";
import { correctionCountFlows } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";

afterEach(() => {
  cleanup();
});

/** 図のコマごとの、マスの読み上げ名と縦の列の合計の読み上げ。押せない図の要素から読む。 */
function readFrames(figure: HTMLElement): string[] {
  return [...figure.querySelectorAll('[role="group"]')].map((board) => {
    const cell = board.querySelector("button")?.getAttribute("aria-label");
    const sum = [...board.querySelectorAll(".sr-only")]
      .map((label) => label.textContent ?? "")
      .find((text) => text.startsWith("2列目の合計"));
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
          { figure: correctionCountFlows.changed, flow: "色を変えた流れ" },
          { figure: correctionCountFlows.unchanged, flow: "色を変えない流れ" },
          { figure: correctionCountFlows.mistyped, flow: "押し間違えた流れ" },
        ]}
      />,
    );
  });

  test("色を変えた数を置き換える流れは、合計に届いた16を11に置き換え、置き直しを1回と数えること", () => {
    const figure = getFigure("色を変えた流れ");

    expect(readFrames(figure)).toEqual([
      "4行2列 空き / 2列目の合計 18",
      "4行2列 16 / 2列目の合計 34 空きがあるのに合計に届いた",
      "4行2列 11 / 2列目の合計 29",
    ]);
    expect(figure.textContent).toContain("→ 置き直し 1回");
  });

  test("色を変えなかった数を置き換える流れは、9を11に置き換え、置き直しに数えないこと", () => {
    const figure = getFigure("色を変えない流れ");

    expect(readFrames(figure)).toEqual([
      "4行2列 空き / 2列目の合計 18",
      "4行2列 9 / 2列目の合計 27",
      "4行2列 11 / 2列目の合計 29",
    ]);
    expect(figure.textContent).toContain("→ 置き直し 0回");
  });

  test("隣の数を押し間違えた流れは、合計に届いた16を隣の15にすぐ置き換え、置き直しに数えないこと", () => {
    const figure = getFigure("押し間違えた流れ");

    expect(readFrames(figure)).toEqual([
      "4行2列 空き / 2列目の合計 18",
      "4行2列 16 / 2列目の合計 34 空きがあるのに合計に届いた",
      "4行2列 15 / 2列目の合計 33",
    ]);
    expect(figure.textContent).toContain("→ 置き直し 0回");
  });

  test("どのコマも押せない図にすること", () => {
    const frames = [...document.querySelectorAll('[role="group"]')];

    expect(frames).toHaveLength(9);
    expect(frames.every((frame) => frame.closest("[inert]") !== null)).toBe(
      true,
    );
  });
});
