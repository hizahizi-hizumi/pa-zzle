import { resolve } from "node:path";

import { isInScopes } from "./project.ts";
import type { RuleConfig, Target } from "./types.ts";

export async function discoverTargets(
  projectRoot: string,
  scopes: string[],
  rules: RuleConfig[],
): Promise<Target[]> {
  const targets = new Map<string, Map<string, RuleConfig>>();

  for (const rule of rules) {
    for (const pattern of rule.paths) {
      const glob = new Bun.Glob(pattern);

      for await (const path of glob.scan({
        cwd: projectRoot,
        onlyFiles: true,
        dot: true,
      })) {
        const projectPath = path.replaceAll("\\", "/");

        if (isExcluded(projectPath, rule)) {
          continue;
        }

        const absolutePath = resolve(projectRoot, projectPath);

        if (!isInScopes(absolutePath, scopes)) {
          continue;
        }

        const targetRules =
          targets.get(projectPath) ?? new Map<string, RuleConfig>();
        targetRules.set(rule.id, rule);
        targets.set(projectPath, targetRules);
      }
    }
  }

  return [...targets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, targetRules]) => ({
      absolutePath: resolve(projectRoot, path),
      path,
      rules: [...targetRules.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }));
}

function isExcluded(path: string, rule: RuleConfig): boolean {
  return rule.excludePaths.some((pattern) => new Bun.Glob(pattern).match(path));
}
