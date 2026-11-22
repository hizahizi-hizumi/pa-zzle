import { useEffect, useRef } from "react";
import { DeskParchment } from "@/games/water-sort/ui/ideas/alchemy/AlchemyGround/DeskParchment";
import { WorkshopCandle } from "@/games/water-sort/ui/ideas/alchemy/AlchemyGround/WorkshopCandle";
import { WorkshopDesk } from "@/games/water-sort/ui/ideas/alchemy/AlchemyGround/WorkshopDesk";
import { WorkshopWall } from "@/games/water-sort/ui/ideas/alchemy/AlchemyGround/WorkshopWall";
import { FINALE_DAWN_ATTRIBUTE } from "@/games/water-sort/ui/ideas/alchemy/alchemy-finale-targets";
import { prefersReducedMotion } from "@/lib/motion";

/** 蝋燭の光のゆらぎ。盤面から目を奪わないよう、ごく小さく遅く揺らす。 */
const CANDLELIGHT_FLICKER: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0.9, offset: 0.18 },
  { opacity: 0.97, offset: 0.33 },
  { opacity: 0.86, offset: 0.52 },
  { opacity: 0.95, offset: 0.7 },
  { opacity: 0.9, offset: 0.86 },
  { opacity: 1 },
];
const CANDLELIGHT_FLICKER_MS = 5300;

/** 夜の錬金術師の工房。石の壁に棚、手前に古い机と羊皮紙、右手に蝋燭。光は盤面のあたりに集める。 */
export function AlchemyGround() {
  const candlelightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const candlelight = candlelightRef.current;
    if (!candlelight?.animate || prefersReducedMotion()) {
      return;
    }
    const animation = candlelight.animate(CANDLELIGHT_FLICKER, {
      duration: CANDLELIGHT_FLICKER_MS,
      iterations: Number.POSITIVE_INFINITY,
      easing: "ease-in-out",
    });
    return () => animation.cancel();
  }, []);

  return (
    <div className="relative size-full overflow-hidden bg-[#110b07]">
      <WorkshopWall />
      <WorkshopDesk />
      <div
        ref={candlelightRef}
        className="absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle 380px at calc(100% - 34px) calc(100% - 96px), rgba(255, 164, 80, 0.2) 0%, rgba(255, 140, 60, 0.08) 45%, rgba(255, 140, 60, 0) 100%), radial-gradient(ellipse 75% 50% at 50% 44%, rgba(255, 196, 130, 0.08) 0%, rgba(255, 196, 130, 0) 100%)",
        }}
      />
      <DeskParchment />
      <WorkshopCandle />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 75% at 50% 46%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.5) 100%)",
        }}
      />
      <div
        {...{ [FINALE_DAWN_ATTRIBUTE]: "" }}
        className="absolute inset-0 opacity-0 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 95% 70% at 50% 45%, rgba(255, 190, 110, 0.3) 0%, rgba(255, 160, 80, 0.12) 50%, rgba(255, 140, 60, 0.03) 100%)",
        }}
      />
    </div>
  );
}
