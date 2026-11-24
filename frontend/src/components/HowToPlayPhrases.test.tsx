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

describe("HowToPlayPhrases で最後の行に短い文節だけを残さない場合", () => {
  test.each([
    [
      "最後の文節が短いときは、前の文節と合わせて、短くなくなるまでまとめること",
      "時間も/0に戻して/同じ問題を/最初から/やり直します。",
      ["時間も", "0に戻して", "同じ問題を", "最初からやり直します。"],
    ],
    [
      "最後の文節が短くなければ、まとめないこと",
      "同じレベルのまま/問題を/変えずに遊べます。",
      ["同じレベルのまま", "問題を", "変えずに遊べます。"],
    ],
    [
      "まとめると長い塊になるときは、まとめないこと",
      "時間・ミス・/「待った」の回数も/0に戻します。",
      ["時間・ミス・", "「待った」の回数も", "0に戻します。"],
    ],
    ["文全体が短いときは、1つにまとめること", "押す/だけ", ["押すだけ"]],
  ])("%s", (_, text, expected) => {
    const { container } = render(
      <p>
        <HowToPlayPhrases text={text} avoidShortLastLine />
      </p>,
    );

    const phrases = listPhrases(container).map((phrase) => phrase.textContent);

    expect(phrases).toEqual(expected);
  });
});

describe("HowToPlayPhrases で終わりの文節をまとめた塊が次の行へ送られる場合", () => {
  const text =
    "外周の数字とピースが多くて/解く手間の/かかる問題ほど/長くなります。";

  /**
   * 文の列（幅 224px）の中で、まとめた塊を3行目に、その前の文節を2行目に描いたときの矩形を返す。
   * 前の文節の右端は `previousRight`（px）にする。
   */
  function mockLines(previousRight: number) {
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
      function getTop(this: HTMLElement) {
        const tops: Record<string, number> = {
          解く手間の: 24,
          "かかる問題ほど長くなります。": 48,
        };
        return tops[this.textContent ?? ""] ?? 0;
      },
    );
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(224);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function getRect(this: Element) {
        return this.textContent === "解く手間の"
          ? new DOMRect(0, 24, previousRight, 24)
          : new DOMRect(0, 0, 224, 72);
      },
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    [
      "前の行が列の幅の8割に届かずに折れるときは、まとめないこと",
      80,
      [
        "外周の数字とピースが多くて",
        "解く手間の",
        "かかる問題ほど",
        "長くなります。",
      ],
    ],
    [
      "前の行が列の幅の8割より長いときは、まとめたままにすること",
      200,
      [
        "外周の数字とピースが多くて",
        "解く手間の",
        "かかる問題ほど長くなります。",
      ],
    ],
  ])("%s", (_, previousRight, expected) => {
    mockLines(previousRight);
    const { container } = render(
      <p>
        <HowToPlayPhrases text={text} avoidShortLastLine />
      </p>,
    );

    const phrases = listPhrases(container).map((phrase) => phrase.textContent);

    expect(phrases).toEqual(expected);
  });
});
