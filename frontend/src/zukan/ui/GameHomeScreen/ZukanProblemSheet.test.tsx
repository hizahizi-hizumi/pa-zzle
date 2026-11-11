import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createRef, type RefObject } from "react";

import {
  _private,
  ZukanProblemSheet,
} from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet";
import type { ZukanProblem } from "@/zukan/zukan-collection";

const { findNextSquareIndex } = _private;

describe("ZukanProblemSheet", () => {
  const problems: ZukanProblem[] = [
    {
      kind: "solved",
      number: 1,
      difficulty: "2",
      problemId: "p-solved",
      bestScore: 80,
      fastestElapsedMs: 60_000,
      fewestMoves: null,
      fewestMistakes: null,
      firstClearedAt: 0,
    },
    {
      kind: "unsolved",
      number: 2,
      difficulty: "2",
      problemId: "p-attempted",
      attempted: true,
    },
    {
      kind: "unsolved",
      number: 3,
      difficulty: "2",
      problemId: "p-untouched",
      attempted: false,
    },
  ];
  const onSelect = vi.fn();
  const onDeselect = vi.fn();

  function renderSheet(
    selectedProblemId: string | null,
    {
      coveredBottomHeight = 0,
      scrollerRef = createRef<HTMLDivElement>(),
    }: {
      coveredBottomHeight?: number;
      scrollerRef?: RefObject<HTMLDivElement | null>;
    } = {},
  ) {
    render(
      <ZukanProblemSheet
        header={<p>状態ごとの数</p>}
        difficulty="2"
        problems={problems}
        arrangedProblems={problems}
        matchedCount={null}
        numberDigitCount={2}
        selectedProblemId={selectedProblemId}
        coveredBottomHeight={coveredBottomHeight}
        changes={undefined}
        changeStages={undefined}
        scrollerRef={scrollerRef}
        onSelect={onSelect}
        onDeselect={onDeselect}
      />,
    );
  }

  function getSquare(numberLabel: string): HTMLElement {
    return within(
      screen.getByRole("group", { name: "レベル 2の問題" }),
    ).getByRole("button", { name: new RegExp(`^${numberLabel} `) });
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    // 台紙を置く領域を測れるようにし、ピースの並べ方を決めさせる。
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 300, 300),
    );
    onSelect.mockClear();
    onDeselect.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  describe("選んでいる問題が無い場合", () => {
    beforeEach(() => {
      renderSheet(null);
    });

    test("台紙の頭に渡した数え方を示すこと", () => {
      const header = screen.getByText("状態ごとの数");

      expect(header).toBeTruthy();
    });

    test("どのマスも選んだ姿にせず、最初のマスだけを Tab で止まるマスにすること", () => {
      const squares = within(
        screen.getByRole("group", { name: "レベル 2の問題" }),
      ).getAllByRole("button");
      const currentSquares = squares.filter((square) =>
        square.hasAttribute("aria-current"),
      );
      const tabStops = squares
        .filter((square) => square.tabIndex === 0)
        .map((square) => square.getAttribute("aria-label"));

      expect(currentSquares).toEqual([]);
      expect(tabStops).toEqual(["No.01 レベル 2 最高スコア80点"]);
    });

    test("どのピースにも、その問題の番号を載せること", () => {
      const squares = within(
        screen.getByRole("group", { name: "レベル 2の問題" }),
      ).getAllByRole("button");
      const numbers = squares.map((square) => square.textContent);

      expect(numbers).toEqual(["1", "2", "3"]);
    });

    test("マスを押すと、その問題を選んだと知らせること", () => {
      fireEvent.click(getSquare("No.03"));

      expect(onSelect.mock.calls).toEqual([[problems[2]]]);
      expect(onDeselect).not.toHaveBeenCalled();
    });
  });

  describe("問題を選んでいる場合", () => {
    beforeEach(() => {
      renderSheet("p-attempted");
    });

    test("選んでいるマスだけを選んだ姿にし、Tab で止まるマスにすること", () => {
      const square = getSquare("No.02");

      expect(square.getAttribute("aria-current")).toBe("true");
      expect(square.tabIndex).toBe(0);
      expect(getSquare("No.01").tabIndex).toBe(-1);
    });

    test("選んでいるマスをもう一度押すと、選択を解くと知らせること", () => {
      fireEvent.click(getSquare("No.02"));

      expect(onDeselect).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    test("別のマスを押すと、その問題を選んだと知らせること", () => {
      fireEvent.click(getSquare("No.01"));

      expect(onSelect.mock.calls).toEqual([[problems[0]]]);
      expect(onDeselect).not.toHaveBeenCalled();
    });

    test("Escape を押しても、選択を解くと知らせないこと", () => {
      fireEvent.keyDown(getSquare("No.02"), { key: "Escape" });

      expect(onDeselect).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("ジグソーを置ける領域の大きさが変わる場合", () => {
    // 3問を幅 300px に置くと上限の 84px、幅 120px に置くと2列の 60px のピースになる。
    const resizeCallbacks: ResizeObserverCallback[] = [];
    let scrollerRef: RefObject<HTMLDivElement | null>;

    function resizeArea(size: number) {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, size, size),
      );
      act(() => {
        for (const callback of resizeCallbacks) {
          callback([], {} as ResizeObserver);
        }
      });
    }

    beforeEach(() => {
      resizeCallbacks.length = 0;
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: ResizeObserverCallback) {
            resizeCallbacks.push(callback);
          }
          observe() {}
          disconnect() {}
        },
      );
      scrollerRef = createRef<HTMLDivElement>();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("下端に何も重ねていない場合", () => {
      beforeEach(() => {
        renderSheet(null, { scrollerRef });
      });

      test("領域に合わせてピースを組み直すこと", () => {
        resizeArea(120);
        const pieceSize =
          scrollerRef.current?.style.getPropertyValue("--zukan-piece-size");

        expect(pieceSize).toBe("60px");
      });
    });
  });

  describe("台紙の中身が見える高さに収まる場合", () => {
    beforeEach(() => {
      vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(300);
      vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(300);
      renderSheet(null);
    });

    test("下端を薄れさせないこと", () => {
      const fade = document.querySelector("[data-zukan-bottom-fade]");

      expect(fade).toBeNull();
    });
  });

  describe("台紙の中身が見える高さを超えてスクロールできる場合", () => {
    beforeEach(() => {
      vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(420);
      vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(300);
      renderSheet(null);
    });

    test("下端を薄れさせ、続きがあることを示すこと", () => {
      const fade = document.querySelector("[data-zukan-bottom-fade]");

      expect(fade?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("下端に重ねているものがある場合", () => {
    let scrollerRef: RefObject<HTMLDivElement | null>;

    beforeEach(() => {
      scrollerRef = createRef<HTMLDivElement>();
      renderSheet("p-attempted", { coveredBottomHeight: 120, scrollerRef });
    });

    test("選んだピースを、重ねたものの上へ寄せられるようにすること", () => {
      const scrollPaddingBottom =
        scrollerRef.current?.style.scrollPaddingBottom;

      expect(scrollPaddingBottom).toBe("120px");
    });
  });
});

describe("findNextSquareIndex", () => {
  describe("絞り込んでいない台紙の場合", () => {
    const squareCount = 23;
    const columnCount = 10;
    const cases = [
      ["ArrowRight", 4, 5],
      ["ArrowLeft", 4, 3],
      ["ArrowRight", 9, 10],
      ["ArrowLeft", 10, 9],
      ["ArrowDown", 4, 14],
      ["ArrowUp", 14, 4],
      ["ArrowLeft", 0, 0],
      ["ArrowRight", 22, 22],
      ["ArrowUp", 4, 4],
      ["ArrowDown", 22, 22],
      ["ArrowDown", 15, 22],
      ["Home", 14, 0],
      ["End", 4, 22],
    ] as const;

    test.each(cases)(
      "%s を位置 %i で押すと位置 %i へ移ること",
      (key, index, expected) => {
        const nextIndex = findNextSquareIndex(
          key,
          index,
          squareCount,
          columnCount,
          squareCount,
        );

        expect(nextIndex).toBe(expected);
      },
    );

    test("台紙の中を動くキーでなければ、移る先を返さないこと", () => {
      const nextIndex = findNextSquareIndex(
        "Enter",
        4,
        squareCount,
        columnCount,
        squareCount,
      );

      expect(nextIndex).toBeNull();
    });
  });

  describe("絞り込んで、当たった問題を前に、当たらなかった問題を行を改めて後ろに並べた台紙の場合", () => {
    // 当たった問題は位置 0〜11（2行目は2マス）、当たらなかった問題は位置 12〜34 で、行の頭から並ぶ。
    const squareCount = 35;
    const columnCount = 10;
    const matchedCount = 12;
    const cases = [
      ["ArrowDown", 1, 11],
      ["ArrowDown", 5, 11],
      ["ArrowDown", 11, 13],
      ["ArrowDown", 10, 12],
      ["ArrowUp", 12, 10],
      ["ArrowUp", 17, 11],
      ["ArrowDown", 17, 27],
      ["ArrowRight", 11, 12],
      ["ArrowLeft", 12, 11],
      ["End", 0, 34],
    ] as const;

    test.each(cases)(
      "%s を位置 %i で押すと、見えている行の並びに沿って位置 %i へ移ること",
      (key, index, expected) => {
        const nextIndex = findNextSquareIndex(
          key,
          index,
          squareCount,
          columnCount,
          matchedCount,
        );

        expect(nextIndex).toBe(expected);
      },
    );
  });

  describe("絞り込んで当たった問題が無い台紙の場合", () => {
    const squareCount = 15;
    const columnCount = 10;
    const matchedCount = 0;
    const cases = [
      ["ArrowUp", 3, 3],
      ["ArrowDown", 3, 13],
      ["Home", 9, 0],
    ] as const;

    test.each(cases)(
      "%s を位置 %i で押すと位置 %i へ移ること",
      (key, index, expected) => {
        const nextIndex = findNextSquareIndex(
          key,
          index,
          squareCount,
          columnCount,
          matchedCount,
        );

        expect(nextIndex).toBe(expected);
      },
    );
  });
});
