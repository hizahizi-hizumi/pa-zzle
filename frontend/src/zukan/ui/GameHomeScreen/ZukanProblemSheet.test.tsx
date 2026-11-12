import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createRef } from "react";

import type { ProblemId } from "@/games/problem-id";
import {
  _private,
  ZukanProblemSheet,
} from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet";
import type { ZukanProblem } from "@/zukan/zukan-collection";

const { findNextSquareIndex } = _private;

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

/** 未挑戦の6問。番号は 1〜6、問題 ID は p-1〜p-6。 */
const problems: readonly ZukanProblem[] = Array.from(
  { length: 6 },
  (_, index) => ({
    kind: "unsolved",
    number: index + 1,
    difficulty: "2",
    problemId: `p-${index + 1}`,
    attempted: false,
  }),
);
/** 台紙の場所の大きさ。6問を1辺 30px のピースで3列2行に並べると、ちょうど収まる。 */
const SHEET_WIDTH_PX = 90;
const SHEET_HEIGHT_PX = 60;
const PIECE_SIZE_PX = 30;
const COLUMN_COUNT = 3;

const onSelect = vi.fn();

type SheetOptions = {
  arrangedProblems?: readonly ZukanProblem[];
  matchedCount?: number | null;
  selectedProblemId?: ProblemId | null;
  selectionDisabled?: boolean;
};

function createSheet({
  arrangedProblems = problems,
  matchedCount = null,
  selectedProblemId = "p-6",
  selectionDisabled = false,
}: SheetOptions = {}) {
  return (
    <ZukanProblemSheet
      difficulty="2"
      problems={problems}
      arrangedProblems={arrangedProblems}
      matchedCount={matchedCount}
      numberDigitCount={2}
      selectedProblemId={selectedProblemId}
      changes={undefined}
      changeStages={undefined}
      scrollerRef={createRef()}
      selectionDisabled={selectionDisabled}
      onSelect={onSelect}
    />
  );
}

function getSheet(): HTMLElement {
  return screen.getByRole("group", { name: "レベル 2の問題" });
}

function getSquare(numberLabel: string): HTMLElement {
  return within(getSheet()).getByRole("button", {
    name: new RegExp(`^${numberLabel} `),
  });
}

function listSelectedProblemIds(): ProblemId[] {
  return onSelect.mock.calls.map(([{ problemId }]) => problemId);
}

function listTabStopNumbers(): (string | undefined)[] {
  return within(getSheet())
    .getAllByRole("button")
    .filter((square) => square.tabIndex === 0)
    .map((square) => square.getAttribute("aria-label")?.split(" ")[0]);
}

/** 3列に並べたマスの、番号の順の位置 `index` の中心。 */
function centerOf(index: number): { clientX: number; clientY: number } {
  return {
    clientX: (index % COLUMN_COUNT) * PIECE_SIZE_PX + PIECE_SIZE_PX / 2,
    clientY:
      Math.floor(index / COLUMN_COUNT) * PIECE_SIZE_PX + PIECE_SIZE_PX / 2,
  };
}

/** 画面の点の下にあるマス。jsdom はレイアウトしないので、3列に並べた位置から引く。 */
function findSquareAtPoint(x: number, y: number): Element | null {
  const index =
    Math.floor(y / PIECE_SIZE_PX) * COLUMN_COUNT +
    Math.floor(x / PIECE_SIZE_PX);
  return document.querySelector(`[data-index="${index}"]`);
}

describe("ZukanProblemSheet", () => {
  let capturedPointers: Set<number>;

  beforeEach(() => {
    onSelect.mockClear();
    capturedPointers = new Set();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, SHEET_WIDTH_PX, SHEET_HEIGHT_PX),
    );
    document.elementFromPoint = findSquareAtPoint;
    Element.prototype.setPointerCapture = (pointerId: number) => {
      capturedPointers.add(pointerId);
    };
    Element.prototype.hasPointerCapture = (pointerId: number) =>
      capturedPointers.has(pointerId);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "elementFromPoint");
    Reflect.deleteProperty(Element.prototype, "setPointerCapture");
    Reflect.deleteProperty(Element.prototype, "hasPointerCapture");
  });

  describe("問題を選んでいる場合", () => {
    beforeEach(() => {
      render(createSheet());
    });

    test("台紙の場所に全問が収まる大きさのピースで、収まる列の数に並べること", () => {
      const { style } = getSheet();

      expect(style.getPropertyValue("--piece")).toBe(`${PIECE_SIZE_PX}px`);
      expect(style.gridTemplateColumns).toBe(
        `repeat(${COLUMN_COUNT}, var(--piece))`,
      );
    });

    test("選んでいるマスだけを、選んだ姿にして Tab で止まるマスにすること", () => {
      const currentSquares = within(getSheet())
        .getAllByRole("button", { current: true })
        .map((square) => square.getAttribute("aria-label"));
      const tabStops = listTabStopNumbers();

      expect(currentSquares).toEqual(["No.06 レベル 2 未挑戦"]);
      expect(tabStops).toEqual(["No.06"]);
    });

    test("マスを押さえると、離すのを待たずにそのマスを選ぶこと", () => {
      fireEvent.pointerDown(getSquare("No.01"), {
        pointerId: 1,
        pointerType: "touch",
        ...centerOf(0),
      });

      expect(listSelectedProblemIds()).toEqual(["p-1"]);
    });

    test("押さえたまま指を動かすと、指の下を通ったマスを、通った順に1回ずつ選ぶこと", () => {
      fireEvent.pointerDown(getSquare("No.01"), {
        pointerId: 1,
        pointerType: "touch",
        ...centerOf(0),
      });
      for (const index of [1, 1, 4, 4]) {
        fireEvent.pointerMove(getSheet(), { pointerId: 1, ...centerOf(index) });
      }

      expect(listSelectedProblemIds()).toEqual(["p-1", "p-2", "p-5"]);
    });

    test("なぞって選んでいるマスに戻っても、選び直さないこと", () => {
      fireEvent.pointerDown(getSquare("No.06"), {
        pointerId: 1,
        pointerType: "touch",
        ...centerOf(5),
      });
      fireEvent.pointerMove(getSheet(), { pointerId: 1, ...centerOf(5) });

      expect(listSelectedProblemIds()).toEqual([]);
    });

    test("押さえずに指を動かしても、マスを選ばないこと", () => {
      fireEvent.pointerMove(getSheet(), { pointerId: 1, ...centerOf(1) });

      expect(listSelectedProblemIds()).toEqual([]);
    });

    test("マウスの左ボタンでないボタンで押しても、マスを選ばないこと", () => {
      fireEvent.pointerDown(getSquare("No.01"), {
        pointerId: 1,
        pointerType: "mouse",
        button: 2,
        ...centerOf(0),
      });

      expect(listSelectedProblemIds()).toEqual([]);
    });

    test("キーでマスを押すと、そのマスを選ぶこと", () => {
      fireEvent.click(getSquare("No.03"));

      expect(listSelectedProblemIds()).toEqual(["p-3"]);
    });

    test("キーで選んでいるマスを押しても、選び直さないこと", () => {
      fireEvent.click(getSquare("No.06"));

      expect(listSelectedProblemIds()).toEqual([]);
    });

    test("マスで下矢印キーを押すと、次の行の同じ列のマスへフォーカスを移して選ぶこと", () => {
      const square = getSquare("No.02");
      square.focus();

      fireEvent.keyDown(square, { key: "ArrowDown" });

      expect(document.activeElement).toBe(getSquare("No.05"));
      expect(listSelectedProblemIds()).toEqual(["p-5"]);
    });
  });

  describe("マスを選べない場合", () => {
    beforeEach(() => {
      render(createSheet({ selectionDisabled: true }));
    });

    test("押さえても、なぞっても、キーで押しても、マスを選ばないこと", () => {
      fireEvent.pointerDown(getSquare("No.01"), {
        pointerId: 1,
        pointerType: "touch",
        ...centerOf(0),
      });
      fireEvent.pointerMove(getSheet(), { pointerId: 1, ...centerOf(1) });
      fireEvent.click(getSquare("No.03"));

      expect(listSelectedProblemIds()).toEqual([]);
    });
  });

  describe("問題を選んでいない場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = render(createSheet({ selectedProblemId: null })));
    });

    test("並びの最初のマスを Tab で止まるマスにすること", () => {
      const tabStops = listTabStopNumbers();

      expect(tabStops).toEqual(["No.01"]);
    });

    test("選んでから選ぶのをやめると、最後に選んだマスを Tab で止まるマスにすること", () => {
      fireEvent.click(getSquare("No.04"));
      rerender(createSheet({ selectedProblemId: null }));
      const tabStops = listTabStopNumbers();

      expect(tabStops).toEqual(["No.04"]);
    });
  });

  describe("絞り込んで並べ替えた場合", () => {
    /** 当たった問題は 4 番と 6 番。 */
    const arrangedProblems = [3, 5, 0, 1, 2, 4].map(
      (index) => problems[index] as ZukanProblem,
    );

    beforeEach(() => {
      render(
        createSheet({
          arrangedProblems,
          matchedCount: 2,
          selectedProblemId: null,
        }),
      );
    });

    test("当たらなかったマスに、条件外であることを読み上げ名で持たせること", () => {
      const filteredOutNumbers = within(getSheet())
        .getAllByRole("button", { name: /絞り込みの条件外$/ })
        .map((square) => square.getAttribute("aria-label")?.split(" ")[0]);

      expect(filteredOutNumbers).toEqual(["No.01", "No.02", "No.03", "No.05"]);
    });

    test("見えている並びの最初のマスを Tab で止まるマスにすること", () => {
      const tabStops = listTabStopNumbers();

      expect(tabStops).toEqual(["No.04"]);
    });

    test("マスで右矢印キーを押すと、見えている並びで次のマスへ移って選ぶこと", () => {
      const square = getSquare("No.04");
      square.focus();

      fireEvent.keyDown(square, { key: "ArrowRight" });

      expect(document.activeElement).toBe(getSquare("No.06"));
      expect(listSelectedProblemIds()).toEqual(["p-6"]);
    });
  });

  describe("絞り込んで当たる問題が無い場合", () => {
    beforeEach(() => {
      render(createSheet({ matchedCount: 0 }));
    });

    test("当たる問題が無いことを台紙の中に示すこと", () => {
      const notice = within(getSheet()).getByText(
        "条件に当たる問題はありません",
      );

      expect(notice).toBeTruthy();
    });
  });
});
