import { cleanup, render, screen } from "@testing-library/react";

import { CorrectionCountExamples } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/CorrectionCountExamples";
import { correctionCountFlows } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";

afterEach(() => {
  cleanup();
});

/** 図のコマごとの、数を置くマス（4行2列）の読み上げ名と縦の列の合計の読み上げ。押せない図の要素から読む。 */
function readFrames(figure: HTMLElement): string[] {
  return [...figure.querySelectorAll('[role="group"]')].map((board) => {
    const cell = [...board.querySelectorAll("button")]
      .map((button) => button.getAttribute("aria-label") ?? "")
      .find((label) => label.startsWith("4行2列"));
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

  test("隣の数を押し間違えた流れは、合計に届いた16を盤面の下に並んだ数で真上の8にすぐ置き換え、置き直しに数えないこと", () => {
    const figure = getFigure("押し間違えた流れ");

    expect(readFrames(figure)).toEqual([
      "4行2列 空き / 2列目の合計 18",
      "4行2列 16 / 2列目の合計 34 空きがあるのに合計に届いた",
      "4行2列 8 / 2列目の合計 26",
    ]);
    expect(figure.textContent).toContain("→ 置き直し 0回");
  });

  test("どのコマも押せない図にし、選んだマスの縁を出さないこと", () => {
    const frames = [...document.querySelectorAll('[role="group"]')];

    expect(frames).toHaveLength(9);
    expect(frames.every((frame) => frame.closest("[inert]") !== null)).toBe(
      true,
    );
    expect(document.querySelector('[aria-pressed="true"]')).toBeNull();
  });

  test("どのコマも、数を置くマスを含む2列目の4つのマスを見せること", () => {
    const labels = [
      ...getFigure("色を変えた流れ").querySelectorAll('[role="group"]'),
    ].map((board) =>
      [...board.querySelectorAll("button")].map((button) =>
        (button.getAttribute("aria-label") ?? "").slice(0, 4),
      ),
    );

    expect(labels[0]).toEqual(["1行2列", "2行2列", "3行2列", "4行2列"]);
  });
});

describe("CorrectionCountExamples に盤面の下に並んだ数を添える場合", () => {
  beforeEach(() => {
    render(
      <CorrectionCountExamples
        examples={[
          {
            figure: correctionCountFlows.mistyped,
            flow: "押し間違えた流れ",
            showPlacedValues: true,
          },
        ]}
      />,
    );
  });

  test("流れで置いた16と8を囲んだ、押せない数の並びを図の下に添えること", () => {
    const figure = getFigure("押し間違えた流れ");
    const pad = figure.querySelector(
      '[role="group"][aria-label="盤面の下に並んだ数"]',
    );
    const framed = [...(pad?.querySelectorAll("button") ?? [])]
      .filter((button) => button.querySelector("span[style]") !== null)
      .map((button) => button.textContent);

    expect(pad?.closest("[inert]")).not.toBeNull();
    expect(framed).toEqual(["8", "16"]);
  });
});
