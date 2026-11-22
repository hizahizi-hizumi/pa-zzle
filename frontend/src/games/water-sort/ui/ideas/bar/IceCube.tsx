import type { Ref } from "react";

type IceCubeProps = {
  elementRef?: Ref<HTMLSpanElement>;
};

/** そろったグラスの液面に浮かぶ、角の丸い氷。ほとんどが液に沈み、液の色を透かす。 */
export function IceCube({ elementRef }: IceCubeProps) {
  return (
    <span
      ref={elementRef}
      className="absolute top-[1.5%] left-[24%] aspect-square w-[50%] -rotate-[9deg] rounded-[24%] border border-white/70 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.75)_0,rgba(255,255,255,0.2)_34%,rgba(255,255,255,0.12)_60%,rgba(255,255,255,0.32)_100%)] shadow-[inset_0_0_3px_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.25)]"
    />
  );
}
