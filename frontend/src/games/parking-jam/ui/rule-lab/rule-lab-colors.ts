import type { RuleLabColor } from "@/games/parking-jam/rule-lab/rule-lab";

const colorStyles: Record<RuleLabColor, string> = {
  A: "#e68d82",
  B: "#f0c66f",
  C: "#84baf0",
  D: "#c2a9ec",
  E: "#9cb0ea",
  F: "#98c8a7",
};

export function ruleLabColorStyle(color: RuleLabColor): string {
  return colorStyles[color];
}
