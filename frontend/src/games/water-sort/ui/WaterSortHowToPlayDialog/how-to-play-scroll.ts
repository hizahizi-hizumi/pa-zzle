/**
 * `target` を含む領域が送られたときに呼ぶ。遊び方の層は中身を送る要素を持ち、送る要素の scroll は伝わらないので、文書で捕まえる。
 * 注ぐ動きは画面の座標で描き、盤面を送ると盤面から外れるので、送られたら動きを止めるのに使う。
 * 広い画面で隣の列を送っても盤面は動かないので、`target` を含まない領域の scroll では呼ばない。止める関数を返す。
 */
export function onHowToPlayScroll(
  target: Element,
  listener: () => void,
): () => void {
  function handleScroll(event: Event): void {
    if (event.target instanceof Node && event.target.contains(target)) {
      listener();
    }
  }
  document.addEventListener("scroll", handleScroll, {
    capture: true,
    passive: true,
  });
  return () => {
    document.removeEventListener("scroll", handleScroll, { capture: true });
  };
}
