/** 写しを置く、画面の上の位置と大きさ（px）。 */
type MotionCopyBox = Pick<DOMRect, "left" | "top" | "width" | "height">;

/**
 * 要素を画面の間で動かして見せる演出のために、要素の写しを作り、渡した位置と大きさで画面の手前に固定する。
 * 元の要素は、写しが動く間も画面に残したままにできる。写しは読み上げず、操作も受けない。
 * 写しの中で、要素を現す動きをやり直させないよう、写しの中の動きは止める。
 * 写しを画面のどこへ置くか（`document.body` への追加）と、変形の基点は呼び出し側が決める。
 */
export function createMotionCopy(
  element: HTMLElement,
  { left, top, width, height }: MotionCopyBox,
): HTMLElement {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const descendant of copy.querySelectorAll<HTMLElement>("*")) {
    descendant.style.animation = "none";
  }
  copy.setAttribute("aria-hidden", "true");
  copy.inert = true;
  Object.assign(copy.style, {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    margin: "0",
    zIndex: "var(--layer-overlay)",
    pointerEvents: "none",
  });
  return copy;
}
