import { Check, X } from "lucide-react";

type HowToPlayRuleMarkProps = {
  figureAllowed: boolean;
};

export function HowToPlayRuleMark({ figureAllowed }: HowToPlayRuleMarkProps) {
  const Mark = figureAllowed ? Check : X;

  return <Mark className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}
