import { isVitestScope, locateVitestUnits } from "./locators/vitest.ts";
import type { RuleConfig, SemanticUnit } from "./types.ts";

export function locateSemanticUnits(
  source: string,
  rule: RuleConfig,
): SemanticUnit[] {
  if (rule.scope === "file") {
    return [];
  }

  if (isVitestScope(rule.scope)) {
    return locateVitestUnits(source, rule.scope);
  }

  return [];
}
