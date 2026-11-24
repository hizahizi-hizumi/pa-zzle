import type { CSSProperties, ReactNode } from "react";

import { FukumenzanGround } from "@/games/fukumenzan/ui/FukumenzanGround";

type ExampleGroundProps = {
  children: ReactNode;
};

/** ゴールの盤面の下に敷く、プレイ画面と同じ方眼の紙。式のマスは地を透かして描くので、本番と同じ地の上で見せる。 */
export function ExampleGround({ children }: ExampleGroundProps) {
  return (
    <div className="relative isolate overflow-hidden rounded-md p-2">
      <div className="absolute inset-0 -z-10">
        <FukumenzanGround />
      </div>
      {children}
    </div>
  );
}

const panelGroundStyle = {
  width: "round(down, 100%, 24px)",
  height: "round(down, 100%, 24px)",
} satisfies CSSProperties;

/**
 * 例と図を並べる面に敷く方眼の紙。面そのものを盤面の地にして、例の盤面を地の箱で囲まない。
 * 紙は面の中央に、幅と高さを方眼の目（24px）の倍数に切りそろえて敷き、罫線の起点を紙の角にそろえる。
 */
export function PanelGround() {
  return (
    <div className="absolute inset-0 m-auto" style={panelGroundStyle}>
      <FukumenzanGround />
    </div>
  );
}
