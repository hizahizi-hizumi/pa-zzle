import { ScopeRegistry } from "./registry.ts";
import { registerVitestScopes } from "./vitest.ts";

export async function createDefaultScopeRegistry(
  _projectRoot: string,
): Promise<ScopeRegistry> {
  const registry = new ScopeRegistry();
  registerVitestScopes(registry);

  return registry;
}
