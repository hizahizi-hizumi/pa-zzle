import { createMotionCopy } from "@/lib/motion-copy";

describe("createMotionCopy", () => {
  const box = { left: 12, top: 34, width: 56, height: 78 };
  let element: HTMLElement;
  let descendant: HTMLElement;

  beforeEach(() => {
    element = document.createElement("div");
    element.dataset.board = "";
    descendant = document.createElement("span");
    descendant.textContent = "盤面";
    descendant.style.animation = "reveal 200ms";
    element.append(descendant);
    document.body.append(element);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  test("元の要素を残し、中身ごと写した別の要素を返すこと", () => {
    const copy = createMotionCopy(element, box);

    expect(copy).not.toBe(element);
    expect(copy.hasAttribute("data-board")).toBe(true);
    expect(copy.textContent).toBe("盤面");
    expect(element.isConnected).toBe(true);
  });

  test("写しを読み上げず、操作も受けないようにすること", () => {
    const copy = createMotionCopy(element, box);

    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.inert).toBe(true);
    expect(copy.style.pointerEvents).toBe("none");
  });

  test("写しを、渡した位置と大きさで画面の手前に固定すること", () => {
    const copy = createMotionCopy(element, box);
    const { position, left, top, width, height, margin, zIndex } = copy.style;

    expect({ position, left, top, width, height, margin, zIndex }).toEqual({
      position: "fixed",
      left: "12px",
      top: "34px",
      width: "56px",
      height: "78px",
      margin: "0px",
      zIndex: "var(--layer-overlay)",
    });
  });

  test("写しの中の動きを止め、元の要素の中の動きは変えないこと", () => {
    const copy = createMotionCopy(element, box);
    const copiedDescendant = copy.querySelector("span");

    expect(copiedDescendant?.style.animation).toBe("none");
    expect(descendant.style.animation).toBe("reveal 200ms");
  });
});
