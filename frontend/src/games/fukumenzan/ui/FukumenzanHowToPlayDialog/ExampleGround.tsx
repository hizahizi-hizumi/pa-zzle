import type { ReactNode } from "react";

import { FukumenzanGround } from "@/games/fukumenzan/ui/FukumenzanGround";

type ExampleGroundProps = {
  children: ReactNode;
};

/** 例と図の下に敷く、プレイ画面と同じ方眼の紙。式のマスは地を透かして描くので、本番と同じ地の上で見せる。 */
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
