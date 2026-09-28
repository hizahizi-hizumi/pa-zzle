import type { ReflectionOutcome } from "@/games/reflection/puzzle/laser";

export const reflectionOutcomeLabels = {
  exit: "退出",
  reflect: "反射",
  absorb: "吸収",
} as const satisfies Record<ReflectionOutcome, string>;
