import { resolve } from "node:path";

import { ScopeRegistry } from "./registry.ts";
import { loadTypeScript, registerVitestScopes } from "./vitest.ts";

export async function createDefaultScopeRegistry(
  projectRoot: string,
): Promise<ScopeRegistry> {
  const registry = new ScopeRegistry();
  const ts = await loadTypeScriptFromProject(projectRoot);
  registerVitestScopes(registry, ts);

  return registry;
}

async function loadTypeScriptFromProject(projectRoot: string) {
  const bases = [
    process.cwd(),
    resolve(projectRoot, "frontend"),
    projectRoot,
  ];
  const errors: string[] = [];

  for (const base of bases) {
    try {
      return await loadTypeScript(base);
    } catch (error) {
      errors.push(
        `${base}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    "TypeScript parserを解決できません。\n" + errors.join("\n"),
  );
}
