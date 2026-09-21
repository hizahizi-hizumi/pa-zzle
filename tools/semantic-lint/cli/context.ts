import { loadSemanticLintConfig } from "../config/config.ts";
import { findProjectRoot } from "../config/project.ts";
import { loadRulesets } from "../config/ruleset.ts";

export async function loadProjectContext() {
  const projectRoot = await findProjectRoot();
  const config = await loadSemanticLintConfig(projectRoot);
  const rules = await loadRulesets(projectRoot, config.rulesDir);

  return {
    projectRoot,
    config,
    rules,
  };
}
