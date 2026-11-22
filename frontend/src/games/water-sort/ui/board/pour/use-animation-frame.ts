import { useLayoutEffect, useRef } from "react";

/** 描いている間、画面を描き直すたびに `draw` を呼ぶ。最初の1回は、描いた姿を画面に出す前に呼ぶ。 */
export function useAnimationFrame(draw: () => void) {
  const drawRef = useRef(draw);
  useLayoutEffect(() => {
    drawRef.current = draw;
  });

  useLayoutEffect(() => {
    let frame = 0;
    function tick() {
      drawRef.current();
      frame = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(frame);
  }, []);
}
