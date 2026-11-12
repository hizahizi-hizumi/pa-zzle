import { readZukanSheetView } from "@/zukan/ui/GameHomeScreen/zukan-sheet-view";

describe("readZukanSheetView", () => {
  let scroller: HTMLElement;

  beforeEach(() => {
    scroller = document.createElement("div");
    scroller.getBoundingClientRect = function getStubbedRect() {
      return { top: 10, height: 200 } as DOMRect;
    };
    document.body.append(scroller);
  });

  afterEach(() => {
    scroller.remove();
  });

  test("下端を覆うものが無ければ、スクロール領域の全体を見えている範囲とすること", () => {
    const view = readZukanSheetView(scroller);

    expect(view).toEqual({ top: 10, bottom: 210 });
  });

  describe("下端を覆う高さのスクロール余白を取っている場合", () => {
    beforeEach(() => {
      scroller.style.scrollPaddingBottom = "80px";
    });

    test("覆われた高さを、見えている範囲から除くこと", () => {
      const view = readZukanSheetView(scroller);

      expect(view).toEqual({ top: 10, bottom: 130 });
    });
  });
});
