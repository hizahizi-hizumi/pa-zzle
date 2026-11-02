import { act, renderHook } from "@testing-library/react";

import {
  _private,
  useShortPlayArea,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/use-short-play-area";

const { getSquareWidthWithUndoFooter, shouldMoveUndoToHand } = _private;

/** 升の縦横比（横 35.2 : 縦 38.6）。 */
const squareAspect = 386 / 352;
/** 盤の升の外（駒台・直前の手の行・盤の縁）の高さ。 */
const fixedHeight = 150;

/** 盤が欄の幅と高さに収まる大きさ（幅で決まる升の幅は 34px）。 */
function layOut(areaHeight: number) {
  const heightLimitedSquareWidth =
    (areaHeight - fixedHeight) / 9 / squareAspect;
  const squareWidth = Math.min(34, heightLimitedSquareWidth);
  const squaresHeight = squareWidth * squareAspect * 9;
  return {
    areaHeight,
    contentHeight: fixedHeight + squaresHeight,
    squaresWidth: squareWidth * 9,
    squaresHeight,
  };
}

describe("getSquareWidthWithUndoFooter", () => {
  const cases = [
    ["欄を置いていて、盤が幅で決まる", layOut(700), true, 34],
    ["欄を回していて、欄を置いても盤が幅で決まる", layOut(812), false, 34],
    ["欄を置いていて、盤が高さで縮んでいる", layOut(400), true, 25.33],
    ["欄を回していて、欄を置くと盤が高さで縮む", layOut(512), false, 25.33],
  ] as const;

  test.each(cases)(
    "%s場合の升の幅を返すこと",
    (_, measurement, undoFooterShown, expected) => {
      const width = getSquareWidthWithUndoFooter({
        ...measurement,
        undoFooterShown,
      });

      expect(width).toBeCloseTo(expected, 1);
    },
  );
});

describe("shouldMoveUndoToHand", () => {
  const cases = [
    ["欄を置いていて升が28pxより小さくなる", 27.9, false, true],
    ["欄を置いていて升が28px以上", 28, false, false],
    ["欄を回していて、欄を置くと升が戻しの余裕に届かない", 28.5, true, true],
    ["欄を回していて、欄を置いても升が戻しの余裕を超える", 29, true, false],
  ] as const;

  test.each(cases)(
    "%s場合の判定を返すこと",
    (_, squareWidth, movedToHand, expected) => {
      const moved = shouldMoveUndoToHand(squareWidth, movedToHand);

      expect(moved).toBe(expected);
    },
  );
});

describe("useShortPlayArea", () => {
  let area: HTMLElement;
  let content: HTMLElement;
  let squares: HTMLElement;
  let notifyResize: () => void;

  /** 欄の高さを変え、待ったの欄の有無で盤の大きさが決まった後のように寸法を返す。 */
  function resizeArea(areaHeight: number): void {
    const layout = layOut(areaHeight);
    Object.defineProperty(area, "clientHeight", {
      configurable: true,
      value: layout.areaHeight,
    });
    content.getBoundingClientRect = () =>
      ({ height: layout.contentHeight }) as DOMRect;
    squares.getBoundingClientRect = () =>
      ({
        width: layout.squaresWidth,
        height: layout.squaresHeight,
      }) as DOMRect;
  }

  beforeEach(() => {
    area = document.createElement("main");
    content = document.createElement("div");
    squares = document.createElement("div");
    squares.setAttribute("data-board-squares", "");
    content.append(squares);
    area.append(content);
    document.body.append(area);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    resizeArea(700);
  });

  afterEach(() => {
    area.remove();
    vi.unstubAllGlobals();
  });

  test("升が十分に大きい間は待ったの欄を置くこと", () => {
    const { result } = renderHook(() =>
      useShortPlayArea({ current: area }, { current: content }),
    );

    expect(result.current).toBe(false);
  });

  test("欄を置くと升が小さくなりすぎる高さで欄を回し、高さが戻ると欄を戻すこと", () => {
    const { result } = renderHook(() =>
      useShortPlayArea({ current: area }, { current: content }),
    );
    resizeArea(400);
    act(() => notifyResize());
    const shortened = result.current;
    // 欄を回すと盤の欄が欄の高さだけ伸びる。
    resizeArea(512);
    act(() => notifyResize());
    const keptShort = result.current;
    resizeArea(812);
    act(() => notifyResize());
    const restored = result.current;

    expect([shortened, keptShort, restored]).toEqual([true, true, false]);
  });
});
