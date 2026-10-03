import { Check, X } from "lucide-react";

type HowToPlayRuleMarkProps = {
  /** 隣の図がルール上できる形か。 */
  allowed: boolean;
};

/** 遊び方の図に添えて、ルール上できる形か（✓）できない形か（✗）を示す。 */
export function HowToPlayRuleMark({ allowed }: HowToPlayRuleMarkProps) {
  const Mark = allowed ? Check : X;

  return <Mark className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}
