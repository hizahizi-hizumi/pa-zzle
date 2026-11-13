import { useLayoutEffect, useRef, useState } from "react";

export type ElementSize = {
  height: number;
  width: number;
};

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize | null>(null);

  // 初回はペイント前に同期測定するため、仮の寸法で描かれることはない。
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observedElement = element;

    function measure() {
      const width = observedElement.clientWidth;
      const height = observedElement.clientHeight;
      setSize((current) =>
        current?.width === width && current.height === height
          ? current
          : { height, width },
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(observedElement);

    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
