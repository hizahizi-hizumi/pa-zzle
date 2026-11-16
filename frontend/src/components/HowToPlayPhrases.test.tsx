import { cleanup, render } from "@testing-library/react";

import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";

afterEach(cleanup);

function listPhrases(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("span"));
}

describe("HowToPlayPhrases", () => {
  describe("始め括弧で始まる文節がある場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <p>
          <HowToPlayPhrases text="時間・引き直し・/「待った」の回数は/そのままです。" />
        </p>,
      ));
    });

    test("文節ごとにまとめて描き、区切りの「/」は描かないこと", () => {
      const phrases = listPhrases(container).map(
        (phrase) => phrase.textContent,
      );

      expect(phrases).toEqual([
        "時間・引き直し・",
        "「待った」の回数は",
        "そのままです。",
      ]);
    });

    test("括弧の左の空きを、ほかの字の左の空きを残して詰め、行の頭でも括弧を本文の列から出さないこと", () => {
      const bracket = listPhrases(container)[1];

      const indent = bracket?.style.marginInlineStart;

      expect(indent).toBe("-0.46em");
    });

    test("前の文節の後ろに同じ幅を足して、行の途中では詰めを打ち消すこと", () => {
      const previous = listPhrases(container)[0];

      const added = previous?.style.marginInlineEnd;

      expect(added).toBe("0.46em");
    });

    test("書体が括弧を詰める環境でも、二重に詰めないこと", () => {
      const bracket = listPhrases(container)[1];

      const trim = bracket?.style.getPropertyValue("text-spacing-trim");

      expect(trim).toBe("space-all");
    });
  });

  describe("始め括弧の無い文の場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <p>
          <HowToPlayPhrases text="穴は/通れません。" />
        </p>,
      ));
    });

    test("文節の幅を変えないこと", () => {
      const styles = listPhrases(container).map((phrase) =>
        phrase.getAttribute("style"),
      );

      expect(styles).toEqual([null, null]);
    });
  });
});
