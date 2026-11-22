/** 1本そろった瓶を、陽にかざして戻すまで。 */
export const HOLD_TO_SUN_DURATION_MS = 950;

export const holdToSunKeyframes: Keyframe[] = [
  { transform: "translateY(0) rotate(0deg)", offset: 0, easing: "ease-out" },
  {
    transform: "translateY(-15%) rotate(-6deg)",
    offset: 0.28,
    easing: "ease-in-out",
  },
  {
    transform: "translateY(-17%) rotate(-4deg)",
    offset: 0.62,
    easing: "cubic-bezier(.5,0,.6,1.4)",
  },
  { transform: "translateY(0) rotate(0deg)", offset: 1 },
];

export const holdToSunGlintKeyframes: Keyframe[] = [
  { transform: "translateX(0)", opacity: 0, offset: 0 },
  { transform: "translateX(0)", opacity: 0, offset: 0.22 },
  { transform: "translateX(26px)", opacity: 0.95, offset: 0.42 },
  { transform: "translateX(58px)", opacity: 0, offset: 0.72 },
  { transform: "translateX(58px)", opacity: 0, offset: 1 },
];

/** 子どもの手つきで、ひょいと持って、とぽとぽと勢いよく注ぐ1回の長さ。 */
export const SUMMER_POUR_DURATION_MS = 1350;
/** 色水が移り始める所と移り終える所（長さに対する割合）。注ぐ音もこの間に鳴らす。 */
export const SUMMER_POUR_TRANSFER_START = 0.3;
export const SUMMER_POUR_TRANSFER_END = 0.7;
