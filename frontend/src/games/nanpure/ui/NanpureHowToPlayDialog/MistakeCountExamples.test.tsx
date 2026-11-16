import { cleanup, render, screen } from "@testing-library/react";

import { mistakeCountFlows } from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import { MistakeCountExamples } from "@/games/nanpure/ui/NanpureHowToPlayDialog/MistakeCountExamples";

afterEach(() => {
  cleanup();
});

/** 図のコマの、マスの数字と答えと違うかの別。押せない図は読み上げないので、描いた要素から読む。 */
function readFrames(figure: HTMLElement): string[] {
  return [...figure.querySelectorAll("[data-nanpure-example-board]")].map(
    (frame) => {
      const digit = frame.querySelector("[data-nanpure-digit]");
      if (digit === null) {
        return "空き";
      }
      const mistaken = digit.hasAttribute("data-nanpure-mistake");
      return `${digit.textContent}${mistaken ? "（違う）" : ""}`;
    },
  );
}

describe("MistakeCountExamples", () => {
  beforeEach(() => {
    render(
      <MistakeCountExamples
        examples={[
          { figure: mistakeCountFlows.undo, flow: "取り消す" },
          { figure: mistakeCountFlows.replace, flow: "入れ替える" },
        ]}
      />,
    );
  });

  test("取り消す流れは、空きから答えと違う数字を入れて空きに戻し、ミスを1回と数えること", () => {
    const figure = screen
      .getByText("取り消す")
      .closest("figure") as HTMLElement;

    const frames = readFrames(figure);

    expect(frames).toEqual(["空き", "9（違う）", "空き"]);
    expect(figure.textContent).toContain("→ ミス 1回");
  });

  test("入れ替える流れは、答えと違う数字を答えに入れ替えても、ミスを1回と数えること", () => {
    const figure = screen
      .getByText("入れ替える")
      .closest("figure") as HTMLElement;

    const frames = readFrames(figure);

    expect(frames).toEqual(["空き", "9（違う）", "5"]);
    expect(figure.textContent).toContain("→ ミス 1回");
  });
});
